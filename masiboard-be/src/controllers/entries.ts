import { Router } from 'express';
import { eq, sql, and } from 'drizzle-orm';
import { db } from '../db';
import { entries, activityTypes, entryLikes, entryChallenges, entryTeams, users, images, userPreferences } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { deleteFromS3 } from '../lib/s3';

const router = Router();

const ALLOWED_SORT_COLS = new Set(['date', 'points', 'activity_type']);

function buildOrderClause(sort: string | undefined, order: string | undefined): string {
    const col = ALLOWED_SORT_COLS.has(sort as string) ? sort : 'points';
    const dir = order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const sqlCol = col === 'activity_type' ? 'at.name' : `e.${col}`;
    return `ORDER BY ${sqlCol} ${dir}`;
}

// Create entry
router.post('/entries', requireAuth, async (req, res) => {
    const { name, points, date, activity_type_id, challenge_ids, team_ids } = req.body;

    try {
        const result = await db.transaction(async (tx) => {
            const rows = await tx.insert(entries).values({
                name,
                points,
                date,
                activityTypeId: activity_type_id ?? null,
                userId: req.userId,
            }).returning({ id: entries.id });
            const entryId = rows[0].id;

            if (Array.isArray(challenge_ids)) {
                for (const cid of challenge_ids) {
                    await tx.insert(entryChallenges).values({ entryId, challengeId: cid }).onConflictDoNothing();
                }
            }
            if (Array.isArray(team_ids)) {
                for (const tid of team_ids) {
                    await tx.insert(entryTeams).values({ entryId, teamId: tid }).onConflictDoNothing();
                }
            }
            return entryId;
        });
        res.status(201).json({ id: result, name, points, date, activity_type_id: activity_type_id ?? null, user_id: req.userId });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to insert entry' });
    }
});

// Leaderboard
router.get('/leaderboard', async (req, res) => {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = 10;
    const offset = (page - 1) * limit;
    const orderClause = buildOrderClause(req.query.sort as string, req.query.order as string);
    const sessionUserId = req.userId ?? null;

    try {
        const { rows } = await db.execute(sql.raw(`
            SELECT e.*, at.name AS activity_type,
                   COUNT(el.user_id)::int                        AS like_count,
                   COALESCE(BOOL_OR(el.user_id = ${sessionUserId === null ? 'NULL' : '$3'}), false) AS liked_by_me,
                   MAX(img.url) AS image_url,
                   COALESCE(up.unit, 'km') AS unit
            FROM entries e
            LEFT JOIN activity_types at ON at.id = e.activity_type_id
            LEFT JOIN entry_likes el ON el.entry_id = e.id
            LEFT JOIN images img ON img.entity_type = 'entry' AND img.entity_id = e.id
            LEFT JOIN user_preferences up ON up.user_id = e.user_id
            GROUP BY e.id, at.name, up.unit
            ${orderClause}
            LIMIT ${limit} OFFSET ${offset}
        `));
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Top performers
router.get('/top-performers', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 100);
    const dir = (req.query.order as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    try {
        const { rows } = await db.execute(sql`
            SELECT u.id AS user_id,
                    u.username,
                    COUNT(e.id)                 AS total_entries,
                    COALESCE(SUM(e.points), 0)  AS total_points,
                    COALESCE(AVG(e.points), 0)  AS avg_points
            FROM users u
            LEFT JOIN entries e ON e.user_id = u.id
            GROUP BY u.id
            ORDER BY total_points ${sql.raw(dir)}
            LIMIT ${limit}
        `);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch top performers' });
    }
});

// Search entries
router.get('/search', async (req, res) => {
    const query = req.query.q as string || '';
    const orderClause = buildOrderClause(req.query.sort as string, req.query.order as string);

    try {
        const { rows } = await db.execute(sql`
            SELECT e.*, at.name AS activity_type_name, img.url AS image_url,
                   COALESCE(up.unit, 'km') AS unit
            FROM entries e
            LEFT JOIN activity_types at ON at.id = e.activity_type_id
            LEFT JOIN images img ON img.entity_type = 'entry' AND img.entity_id = e.id
            LEFT JOIN user_preferences up ON up.user_id = e.user_id
            WHERE e.name ILIKE ${`%${query}%`}
            ${sql.raw(orderClause)}
        `);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to search entries' });
    }
});

// Get a single entry by ID
router.get('/entries/:id', async (req, res) => {
    try {
        const rows = await db.select({
            id: entries.id,
            name: entries.name,
            points: entries.points,
            date: entries.date,
            activityTypeId: entries.activityTypeId,
            userId: entries.userId,
            activity_type: activityTypes.name,
            image_url: images.url,
            unit: userPreferences.unit,
        })
        .from(entries)
        .leftJoin(activityTypes, eq(activityTypes.id, entries.activityTypeId))
        .leftJoin(images, and(eq(images.entityType, 'entry'), eq(images.entityId, entries.id)))
        .leftJoin(userPreferences, eq(userPreferences.userId, entries.userId))
        .where(eq(entries.id, Number(req.params.id)));

        if (!rows[0]) return res.status(404).json({ error: 'Entry not found' });
        res.json({ ...rows[0], unit: rows[0].unit ?? 'km' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch entry' });
    }
});

// Update an entry by ID
router.put('/entries/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { name, points, date, activity_type_id, challenge_ids, team_ids } = req.body;

    try {
        await db.transaction(async (tx) => {
            const result = await tx.update(entries).set({
                name,
                points,
                date,
                activityTypeId: activity_type_id ?? null,
            }).where(eq(entries.id, id));

            if (result.rowCount === 0) {
                throw new Error('NOT_FOUND');
            }

            if (Array.isArray(challenge_ids)) {
                await tx.delete(entryChallenges).where(eq(entryChallenges.entryId, id));
                for (const cid of challenge_ids) {
                    await tx.insert(entryChallenges).values({ entryId: id, challengeId: cid }).onConflictDoNothing();
                }
            }
            if (Array.isArray(team_ids)) {
                await tx.delete(entryTeams).where(eq(entryTeams.entryId, id));
                for (const tid of team_ids) {
                    await tx.insert(entryTeams).values({ entryId: id, teamId: tid }).onConflictDoNothing();
                }
            }
        });
        res.json({ id, name, points, date, activity_type_id: activity_type_id ?? null });
    } catch (err: any) {
        if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Entry not found' });
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update entry' });
    }
});

// Delete an entry by ID
router.delete('/entries/:id', requireAuth, async (req, res) => {
    const id = Number(req.params.id);

    try {
        // Clean up associated image from S3 and DB
        const imgRows = await db.select().from(images)
            .where(and(eq(images.entityType, 'entry'), eq(images.entityId, id)));
        if (imgRows[0]) {
            await deleteFromS3(imgRows[0].s3Key);
            await db.delete(images).where(eq(images.id, imgRows[0].id));
        }

        const result = await db.delete(entries).where(eq(entries.id, id));
        if (result.rowCount === 0) return res.status(404).json({ error: 'Entry not found' });
        res.json({ message: 'Entry deleted successfully' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
});

// Get likes for an entry
router.get('/entries/:id/likes', async (req, res) => {
    const entryId = parseInt(req.params.id);
    const sessionUserId = req.userId ?? null;
    try {
        const rows = await db.select({
            user_id: users.id,
            username: users.username,
            liked_by_me: sql<boolean>`(${users.id} = ${sessionUserId})`,
        })
        .from(entryLikes)
        .innerJoin(users, eq(users.id, entryLikes.userId))
        .where(eq(entryLikes.entryId, entryId));

        res.json({
            count: rows.length,
            liked_by_me: rows.some(r => r.liked_by_me),
            users: rows.map(r => ({ user_id: r.user_id, username: r.username })),
        });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch likes' });
    }
});

// Like an entry
router.post('/entries/:id/likes', requireAuth, async (req, res) => {
    const entryId = parseInt(req.params.id);
    try {
        const entryRows = await db.select({ userId: entries.userId }).from(entries).where(eq(entries.id, entryId));
        if (!entryRows[0]) return res.status(404).json({ error: 'Entry not found' });
        if (entryRows[0].userId === req.userId)
            return res.status(403).json({ error: 'Cannot like your own entry' });

        await db.insert(entryLikes).values({ entryId, userId: req.userId! }).onConflictDoNothing();
        const countRows = await db.select({ count: sql<number>`COUNT(*)::int` }).from(entryLikes).where(eq(entryLikes.entryId, entryId));
        res.json({ count: countRows[0].count });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to like entry' });
    }
});

// Unlike an entry
router.delete('/entries/:id/likes', requireAuth, async (req, res) => {
    const entryId = parseInt(req.params.id);
    try {
        await db.delete(entryLikes).where(
            and(eq(entryLikes.entryId, entryId), eq(entryLikes.userId, req.userId!))
        );
        const countRows = await db.select({ count: sql<number>`COUNT(*)::int` }).from(entryLikes).where(eq(entryLikes.entryId, entryId));
        res.json({ count: countRows[0].count });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to unlike entry' });
    }
});

export default router;
