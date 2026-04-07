import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { images, activityTypes, challenges, teams, entries } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadToS3, deleteFromS3 } from '../lib/s3';

const router = Router();

const VALID_ENTITY_TYPES = ['user', 'activity_type', 'challenge', 'team', 'entry'] as const;
type EntityType = typeof VALID_ENTITY_TYPES[number];

function getExtension(mimetype: string): string {
    const map: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
    };
    return map[mimetype] || 'jpg';
}

async function verifyOwnership(entityType: EntityType, entityId: number, userId: number): Promise<boolean> {
    switch (entityType) {
        case 'user':
            return entityId === userId;
        case 'activity_type': {
            const rows = await db.select({ createdBy: activityTypes.createdBy }).from(activityTypes).where(eq(activityTypes.id, entityId));
            return rows[0]?.createdBy === userId;
        }
        case 'challenge': {
            const rows = await db.select({ createdBy: challenges.createdBy }).from(challenges).where(eq(challenges.id, entityId));
            return rows[0]?.createdBy === userId;
        }
        case 'team': {
            const rows = await db.select({ createdBy: teams.createdBy }).from(teams).where(eq(teams.id, entityId));
            return rows[0]?.createdBy === userId;
        }
        case 'entry': {
            const rows = await db.select({ userId: entries.userId }).from(entries).where(eq(entries.id, entityId));
            return rows[0]?.userId === userId;
        }
        default:
            return false;
    }
}

// Upload image
router.post('/images/upload', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No image file provided' });

        const entityType = req.body.entity_type as EntityType;
        const entityId = parseInt(req.body.entity_id);

        if (!VALID_ENTITY_TYPES.includes(entityType)) {
            return res.status(400).json({ error: 'Invalid entity_type. Must be one of: user, activity_type, challenge, team, entry' });
        }
        if (isNaN(entityId)) {
            return res.status(400).json({ error: 'Invalid entity_id' });
        }

        const isOwner = await verifyOwnership(entityType, entityId, req.userId!);
        if (!isOwner) return res.status(403).json({ error: 'Forbidden' });

        // For non-entry entities, replace existing image (one image per entity)
        if (entityType !== 'entry') {
            const existing = await db.select().from(images)
                .where(and(eq(images.entityType, entityType), eq(images.entityId, entityId)));
            if (existing[0]) {
                await deleteFromS3(existing[0].s3Key);
                await db.delete(images).where(eq(images.id, existing[0].id));
            }
        }

        // Upload new image
        const ext = getExtension(file.mimetype);
        const s3Key = `${entityType}/${entityId}/${uuidv4()}.${ext}`;
        const url = await uploadToS3(s3Key, file.buffer, file.mimetype);

        const rows = await db.insert(images).values({
            entityType,
            entityId,
            s3Key,
            url,
            uploadedBy: req.userId,
        }).returning();

        res.status(201).json({
            id: rows[0].id,
            entity_type: rows[0].entityType,
            entity_id: rows[0].entityId,
            url: rows[0].url,
        });
    } catch (err: any) {
        console.log(err);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// List images for an entity
router.get('/images', async (req, res) => {
    const entityType = req.query.entity_type as string;
    const entityId = Number(req.query.entity_id);
    if (!entityType || isNaN(entityId)) return res.status(400).json({ error: 'entity_type and entity_id required' });
    try {
        const rows = await db.select({ id: images.id, url: images.url })
            .from(images)
            .where(and(eq(images.entityType, entityType), eq(images.entityId, entityId)));
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch images' });
    }
});

// Delete image
router.delete('/images/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    try {
        const rows = await db.select().from(images).where(eq(images.id, id));
        if (!rows[0]) return res.status(404).json({ error: 'Image not found' });
        if (rows[0].uploadedBy !== req.userId) return res.status(403).json({ error: 'Forbidden' });

        await deleteFromS3(rows[0].s3Key);
        await db.delete(images).where(eq(images.id, id));
        res.json({ message: 'Image deleted' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

export default router;
