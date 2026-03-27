import { Router } from 'express';
import { eq, sql, and, isNotNull, desc } from 'drizzle-orm';
import { db } from '../db';
import { users, entries, activityTypes, challengeMembers, challenges, entryChallenges, teamMembers, teams, entryTeams, images, userPreferences } from '../db/schema';
import { requireAuth, JWT_SECRET } from '../middleware/auth';
const jwt = require('jsonwebtoken');

const router = Router();

// Current user profile
router.get('/user/me', requireAuth, async (req, res) => {
    try {
        const rows = await db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            profileImagePublic: users.profileImagePublic,
            totalEntries: sql<number>`COUNT(DISTINCT ${entries.id})`,
            totalPoints: sql<number>`COALESCE(SUM(${entries.points}), 0)`,
            image_url: images.url,
            unit: userPreferences.unit,
        })
        .from(users)
        .leftJoin(entries, eq(entries.userId, users.id))
        .leftJoin(images, and(eq(images.entityType, 'user'), eq(images.entityId, users.id)))
        .leftJoin(userPreferences, eq(userPreferences.userId, users.id))
        .where(eq(users.id, req.userId!))
        .groupBy(users.id, images.url, userPreferences.unit);

        if (!rows[0]) return res.status(404).json({ error: 'User not found' });
        res.json({
            id: rows[0].id,
            username: rows[0].username,
            email: rows[0].email,
            profileImagePublic: rows[0].profileImagePublic,
            totalEntries: rows[0].totalEntries,
            totalPoints: rows[0].totalPoints,
            image_url: rows[0].image_url ?? null,
            unit: rows[0].unit ?? 'km',
        });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update current user profile
router.post('/user/me', requireAuth, async (req, res) => {
    const { username, profile_image_public, unit } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const updates: Record<string, any> = { username };
    if (typeof profile_image_public === 'boolean') {
        updates.profileImagePublic = profile_image_public;
    }

    try {
        const rows = await db.update(users)
            .set(updates)
            .where(eq(users.id, req.userId!))
            .returning({ id: users.id, username: users.username, email: users.email, profileImagePublic: users.profileImagePublic });
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

        let savedUnit = 'km';
        if (unit === 'km' || unit === 'mi') {
            await db.insert(userPreferences).values({ userId: req.userId!, unit })
                .onConflictDoUpdate({ target: userPreferences.userId, set: { unit } });
            savedUnit = unit;
        } else {
            const prefRows = await db.select({ unit: userPreferences.unit }).from(userPreferences).where(eq(userPreferences.userId, req.userId!));
            savedUnit = prefRows[0]?.unit ?? 'km';
        }

        res.json({ ...rows[0], profile_image_public: rows[0].profileImagePublic, unit: savedUnit });
    } catch (err: any) {
        if (err.code === '23505') return res.status(409).json({ error: 'Username already taken' });
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Public user profile
router.get('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

    const authHeader = req.headers['authorization'] as string | undefined;
    let requestingUserId: number | null = null;
    if (authHeader?.startsWith('Bearer ')) {
        try { requestingUserId = (jwt.verify(authHeader.slice(7), JWT_SECRET) as any).userId; } catch {}
    }

    try {
        const rows = await db.select({
            username: users.username,
            profileImagePublic: users.profileImagePublic,
            total_entries: sql<number>`COUNT(DISTINCT ${entries.id})`,
            image_url: images.url,
        })
        .from(users)
        .leftJoin(entries, eq(entries.userId, users.id))
        .leftJoin(images, and(eq(images.entityType, 'user'), eq(images.entityId, users.id)))
        .where(eq(users.id, userId))
        .groupBy(users.id, images.url);

        if (!rows[0]) return res.status(404).json({ error: 'User not found' });

        const { rows: rankRows } = await db.execute(sql`
            SELECT user_id, total_points, position
            FROM (
                SELECT user_id,
                       SUM(points) AS total_points,
                       RANK() OVER (ORDER BY SUM(points) DESC) AS position
                FROM entries
                GROUP BY user_id
            ) ranked
            WHERE user_id = ${userId}
        `);

        const actRows = await db.select({ name: activityTypes.name })
            .from(entries)
            .leftJoin(activityTypes, eq(activityTypes.id, entries.activityTypeId))
            .where(and(eq(entries.userId, userId), isNotNull(activityTypes.name)))
            .orderBy(desc(entries.date))
            .limit(3);

        // Show image only if public or if the requesting user is the profile owner
        const showImage = rows[0].profileImagePublic || requestingUserId === userId;

        res.json({
            username: rows[0].username,
            total_entries: Number(rows[0].total_entries),
            position: (rankRows[0] as any)?.position ?? 0,
            last_activity_types: actRows.map(r => r.name),
            image_url: showImage ? (rows[0].image_url ?? null) : null,
        });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// User challenges
router.get('/users/:id/challenges', async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
    try {
        const rows = await db.select({
            id: challenges.id,
            title: challenges.title,
            start_date: challenges.startDate,
            end_date: challenges.endDate,
            activity_type_name: activityTypes.name,
            user_points: sql<number>`COALESCE(SUM(${entries.points}), 0)`,
        })
        .from(challengeMembers)
        .innerJoin(challenges, eq(challenges.id, challengeMembers.challengeId))
        .leftJoin(activityTypes, eq(activityTypes.id, challenges.activityTypeId))
        .leftJoin(entryChallenges, eq(entryChallenges.challengeId, challenges.id))
        .leftJoin(entries, and(eq(entries.id, entryChallenges.entryId), eq(entries.userId, userId)))
        .where(eq(challengeMembers.userId, userId))
        .groupBy(challenges.id, challenges.title, challenges.startDate, challenges.endDate, activityTypes.name)
        .orderBy(desc(challenges.endDate));

        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch user challenges' });
    }
});

// User teams
router.get('/users/:id/teams', async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
    try {
        const rows = await db.select({
            id: teams.id,
            title: teams.title,
            activity_type_name: activityTypes.name,
            user_points: sql<number>`COALESCE(SUM(${entries.points}), 0)`,
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .leftJoin(activityTypes, eq(activityTypes.id, teams.activityTypeId))
        .leftJoin(entryTeams, eq(entryTeams.teamId, teams.id))
        .leftJoin(entries, and(eq(entries.id, entryTeams.entryId), eq(entries.userId, userId)))
        .where(eq(teamMembers.userId, userId))
        .groupBy(teams.id, teams.title, activityTypes.name)
        .orderBy(teams.title);

        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch user teams' });
    }
});

// User stats: average distance for past week, month, year
router.get('/users/:id/stats', async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
    try {
        const { rows } = await db.execute(sql`
            SELECT
                COALESCE(AVG(CASE WHEN e.date::date >= CURRENT_DATE - INTERVAL '7 days' THEN e.points END), 0) AS avg_week,
                COALESCE(AVG(CASE WHEN e.date::date >= CURRENT_DATE - INTERVAL '30 days' THEN e.points END), 0) AS avg_month,
                COALESCE(AVG(CASE WHEN e.date::date >= CURRENT_DATE - INTERVAL '365 days' THEN e.points END), 0) AS avg_year
            FROM entries e
            WHERE e.user_id = ${userId}
        `);
        const prefRows = await db.select({ unit: userPreferences.unit })
            .from(userPreferences)
            .where(eq(userPreferences.userId, userId));
        const unit = prefRows[0]?.unit ?? 'km';
        const row = rows[0] as any;
        res.json({
            avg_week: Number(row?.avg_week ?? 0),
            avg_month: Number(row?.avg_month ?? 0),
            avg_year: Number(row?.avg_year ?? 0),
            unit,
        });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
});

export default router;
