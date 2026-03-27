import { Router } from 'express';
import { eq, asc, and } from 'drizzle-orm';
import { db } from '../db';
import { activityTypes, images } from '../db/schema';
import { requireAuth, JWT_SECRET } from '../middleware/auth';
const jwt = require('jsonwebtoken');

const router = Router();

router.get('/activity-types', async (req, res) => {
    // Activity attachments only visible to authenticated users
    const authHeader = req.headers['authorization'] as string | undefined;
    let isAuthenticated = false;
    if (authHeader?.startsWith('Bearer ')) {
        try { jwt.verify(authHeader.slice(7), JWT_SECRET); isAuthenticated = true; } catch {}
    }

    try {
        const rows = await db.select({
            id: activityTypes.id,
            name: activityTypes.name,
            createdBy: activityTypes.createdBy,
            image_url: images.url,
        })
        .from(activityTypes)
        .leftJoin(images, and(eq(images.entityType, 'activity_type'), eq(images.entityId, activityTypes.id)))
        .orderBy(asc(activityTypes.name));

        res.json(rows.map(r => ({
            ...r,
            image_url: isAuthenticated ? (r.image_url ?? null) : null,
        })));
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch activity types' });
    }
});

router.get('/activity-types/:id', async (req, res) => {
    const authHeader = req.headers['authorization'] as string | undefined;
    let isAuthenticated = false;
    if (authHeader?.startsWith('Bearer ')) {
        try { jwt.verify(authHeader.slice(7), JWT_SECRET); isAuthenticated = true; } catch {}
    }

    try {
        const rows = await db.select({
            id: activityTypes.id,
            name: activityTypes.name,
            createdBy: activityTypes.createdBy,
            image_url: images.url,
        })
        .from(activityTypes)
        .leftJoin(images, and(eq(images.entityType, 'activity_type'), eq(images.entityId, activityTypes.id)))
        .where(eq(activityTypes.id, Number(req.params.id)));

        if (!rows[0]) return res.status(404).json({ error: 'Activity type not found' });
        res.json({
            ...rows[0],
            image_url: isAuthenticated ? (rows[0].image_url ?? null) : null,
        });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch activity type' });
    }
});

router.post('/activity-types', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const rows = await db.insert(activityTypes).values({ name, createdBy: req.userId }).returning();
        res.status(201).json({ id: rows[0].id, name });
    } catch (err: any) {
        if (err.code === '23505') return res.status(400).json({ error: 'Activity type already exists' });
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create activity type' });
    }
});

router.put('/activity-types/:id', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const rows = await db.select().from(activityTypes).where(eq(activityTypes.id, Number(req.params.id)));
        if (!rows[0]) return res.status(404).json({ error: 'Activity type not found' });
        if (rows[0].createdBy !== req.userId) return res.status(403).json({ error: 'Forbidden' });

        await db.update(activityTypes).set({ name }).where(eq(activityTypes.id, Number(req.params.id)));
        res.json({ id: Number(req.params.id), name });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update activity type' });
    }
});

router.delete('/activity-types/:id', requireAuth, async (req, res) => {
    try {
        const rows = await db.select().from(activityTypes).where(eq(activityTypes.id, Number(req.params.id)));
        if (!rows[0]) return res.status(404).json({ error: 'Activity type not found' });
        if (rows[0].createdBy !== req.userId) return res.status(403).json({ error: 'Forbidden' });

        await db.delete(activityTypes).where(eq(activityTypes.id, Number(req.params.id)));
        res.json({ message: 'Activity type deleted successfully' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete activity type' });
    }
});

export default router;
