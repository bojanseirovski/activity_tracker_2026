import { Router } from 'express';
import { eq, sql, ilike, and } from 'drizzle-orm';
const jwt = require('jsonwebtoken');
import { db } from '../db';
import { challenges, activityTypes, challengeMembers, entryChallenges, entries, images } from '../db/schema';
import { requireAuth, JWT_SECRET } from '../middleware/auth';

const router = Router();

// List challenges (optional search)
router.get('/challenges', async (req, res) => {
    const q = req.query.q as string | undefined;
    try {
        const query = db.select({
            id: challenges.id,
            title: challenges.title,
            start_date: challenges.startDate,
            end_date: challenges.endDate,
            created_by: challenges.createdBy,
            activity_type_name: activityTypes.name,
            member_count: sql<number>`COUNT(DISTINCT ${challengeMembers.userId})`,
            image_url: images.url,
        })
        .from(challenges)
        .leftJoin(activityTypes, eq(activityTypes.id, challenges.activityTypeId))
        .leftJoin(challengeMembers, eq(challengeMembers.challengeId, challenges.id))
        .leftJoin(images, and(eq(images.entityType, 'challenge'), eq(images.entityId, challenges.id)))
        .groupBy(challenges.id, activityTypes.name, images.url)
        .orderBy(sql`${challenges.startDate} DESC`);

        const rows = q
            ? await query.where(ilike(challenges.title, `%${q}%`))
            : await query;

        res.json(rows.map(r => ({ ...r, image_url: r.image_url ?? null })));
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch challenges' });
    }
});

// Get challenge detail (public)
router.get('/challenges/:id', async (req, res) => {
    const id = Number(req.params.id);
    const authHeader = req.headers['authorization'] as string | undefined;
    let requestingUserId: number | null = null;
    if (authHeader?.startsWith('Bearer ')) {
        try { requestingUserId = (jwt.verify(authHeader.slice(7), JWT_SECRET) as any).userId; } catch {}
    }
    try {
        const rows = await db.select({
            id: challenges.id,
            title: challenges.title,
            activityTypeId: challenges.activityTypeId,
            startDate: challenges.startDate,
            endDate: challenges.endDate,
            createdBy: challenges.createdBy,
            activity_type_name: activityTypes.name,
            member_count: sql<number>`COUNT(DISTINCT ${challengeMembers.userId})`,
            total_points: sql<number>`COALESCE(SUM(${entries.points}), 0)`,
            image_url: images.url,
        })
        .from(challenges)
        .leftJoin(activityTypes, eq(activityTypes.id, challenges.activityTypeId))
        .leftJoin(challengeMembers, eq(challengeMembers.challengeId, challenges.id))
        .leftJoin(entryChallenges, eq(entryChallenges.challengeId, challenges.id))
        .leftJoin(entries, eq(entries.id, entryChallenges.entryId))
        .leftJoin(images, and(eq(images.entityType, 'challenge'), eq(images.entityId, challenges.id)))
        .where(eq(challenges.id, id))
        .groupBy(challenges.id, activityTypes.name, images.url);

        if (!rows[0]) return res.status(404).json({ error: 'Challenge not found' });

        let is_member = false;
        if (requestingUserId) {
            const mr = await db.select().from(challengeMembers)
                .where(and(eq(challengeMembers.challengeId, id), eq(challengeMembers.userId, requestingUserId)));
            is_member = mr.length > 0;
        }
        res.json({ ...rows[0], is_member, image_url: rows[0].image_url ?? null });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch challenge' });
    }
});

// Create challenge
router.post('/challenges', requireAuth, async (req, res) => {
    const { title, activity_type_id, start_date, end_date } = req.body;
    if (!title || !start_date || !end_date) return res.status(400).json({ error: 'title, start_date and end_date are required' });
    try {
        const rows = await db.insert(challenges).values({
            title,
            activityTypeId: activity_type_id ?? null,
            startDate: start_date,
            endDate: end_date,
            createdBy: req.userId,
        }).returning();
        res.status(201).json(rows[0]);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create challenge' });
    }
});

// Update challenge (owner only)
router.put('/challenges/:id', requireAuth, async (req, res) => {
    const { title, activity_type_id, start_date, end_date } = req.body;
    try {
        const rows = await db.select().from(challenges).where(eq(challenges.id, Number(req.params.id)));
        if (!rows[0]) return res.status(404).json({ error: 'Challenge not found' });
        if (rows[0].createdBy !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        await db.update(challenges).set({
            title,
            activityTypeId: activity_type_id ?? null,
            startDate: start_date,
            endDate: end_date,
        }).where(eq(challenges.id, Number(req.params.id)));
        res.json({ ...rows[0], title, activityTypeId: activity_type_id ?? null, startDate: start_date, endDate: end_date });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update challenge' });
    }
});

// Delete challenge (owner only)
router.delete('/challenges/:id', requireAuth, async (req, res) => {
    try {
        const rows = await db.select().from(challenges).where(eq(challenges.id, Number(req.params.id)));
        if (!rows[0]) return res.status(404).json({ error: 'Challenge not found' });
        if (rows[0].createdBy !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        await db.delete(challenges).where(eq(challenges.id, Number(req.params.id)));
        res.json({ message: 'Challenge deleted' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete challenge' });
    }
});

// Join challenge
router.post('/challenges/:id/join', requireAuth, async (req, res) => {
    try {
        await db.insert(challengeMembers).values({
            challengeId: Number(req.params.id),
            userId: req.userId!,
        }).onConflictDoNothing();
        res.json({ message: 'Joined challenge' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to join challenge' });
    }
});

// Leave challenge
router.delete('/challenges/:id/join', requireAuth, async (req, res) => {
    try {
        await db.delete(challengeMembers).where(
            and(eq(challengeMembers.challengeId, Number(req.params.id)), eq(challengeMembers.userId, req.userId!))
        );
        res.json({ message: 'Left challenge' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to leave challenge' });
    }
});

// Challenge leaderboard (public)
router.get('/challenges/:id/leaderboard', async (req, res) => {
    try {
        const { rows } = await db.execute(sql`
            SELECT u.id, u.username,
                   COALESCE(SUM(e.points), 0) AS total_points,
                   RANK() OVER (ORDER BY COALESCE(SUM(e.points), 0) DESC) AS rank
            FROM challenge_members cm
            JOIN users u ON u.id = cm.user_id
            LEFT JOIN entry_challenges ec ON ec.challenge_id = cm.challenge_id
            LEFT JOIN entries e ON e.id = ec.entry_id AND e.user_id = u.id
            WHERE cm.challenge_id = ${Number(req.params.id)}
            GROUP BY u.id, u.username
            ORDER BY total_points DESC
        `);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Challenge stats: total distance + top 20 users
router.get('/challenges/:id/stats', async (req, res) => {
    const id = Number(req.params.id);
    try {
        const totalRows = await db.select({
            total_distance: sql<number>`COALESCE(SUM(${entries.points}), 0)`,
        })
        .from(entryChallenges)
        .leftJoin(entries, eq(entries.id, entryChallenges.entryId))
        .where(eq(entryChallenges.challengeId, id));

        const { rows: topUsers } = await db.execute(sql`
            SELECT u.id, u.username,
                   COALESCE(SUM(e.points), 0) AS total_points,
                   RANK() OVER (ORDER BY COALESCE(SUM(e.points), 0) DESC) AS rank
            FROM challenge_members cm
            JOIN users u ON u.id = cm.user_id
            LEFT JOIN entry_challenges ec ON ec.challenge_id = cm.challenge_id
            LEFT JOIN entries e ON e.id = ec.entry_id AND e.user_id = u.id
            WHERE cm.challenge_id = ${id}
            GROUP BY u.id, u.username
            ORDER BY total_points DESC
            LIMIT 20
        `);

        res.json({
            total_distance: Number(totalRows[0]?.total_distance ?? 0),
            top_users: topUsers,
        });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch challenge stats' });
    }
});

export default router;
