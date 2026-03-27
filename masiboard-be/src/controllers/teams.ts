import { Router } from 'express';
import { eq, sql, ilike, and } from 'drizzle-orm';
const jwt = require('jsonwebtoken');
import { db } from '../db';
import { teams, activityTypes, teamMembers, entryTeams, entries, images } from '../db/schema';
import { requireAuth, JWT_SECRET } from '../middleware/auth';

const router = Router();

// List teams (optional search)
router.get('/teams', async (req, res) => {
    const q = req.query.q as string | undefined;
    try {
        const query = db.select({
            id: teams.id,
            title: teams.title,
            created_by: teams.createdBy,
            activity_type_name: activityTypes.name,
            member_count: sql<number>`COUNT(DISTINCT ${teamMembers.userId})`,
            image_url: images.url,
        })
        .from(teams)
        .leftJoin(activityTypes, eq(activityTypes.id, teams.activityTypeId))
        .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
        .leftJoin(images, and(eq(images.entityType, 'team'), eq(images.entityId, teams.id)))
        .groupBy(teams.id, activityTypes.name, images.url)
        .orderBy(teams.title);

        const rows = q
            ? await query.where(ilike(teams.title, `%${q}%`))
            : await query;

        res.json(rows.map(r => ({ ...r, image_url: r.image_url ?? null })));
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// Get team detail (public)
router.get('/teams/:id', async (req, res) => {
    const id = Number(req.params.id);
    const authHeader = req.headers['authorization'] as string | undefined;
    let requestingUserId: number | null = null;
    if (authHeader?.startsWith('Bearer ')) {
        try { requestingUserId = (jwt.verify(authHeader.slice(7), JWT_SECRET) as any).userId; } catch {}
    }
    try {
        const rows = await db.select({
            id: teams.id,
            title: teams.title,
            activityTypeId: teams.activityTypeId,
            createdBy: teams.createdBy,
            activity_type_name: activityTypes.name,
            member_count: sql<number>`COUNT(DISTINCT ${teamMembers.userId})`,
            total_points: sql<number>`COALESCE(SUM(${entries.points}), 0)`,
            image_url: images.url,
        })
        .from(teams)
        .leftJoin(activityTypes, eq(activityTypes.id, teams.activityTypeId))
        .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
        .leftJoin(entryTeams, eq(entryTeams.teamId, teams.id))
        .leftJoin(entries, eq(entries.id, entryTeams.entryId))
        .leftJoin(images, and(eq(images.entityType, 'team'), eq(images.entityId, teams.id)))
        .where(eq(teams.id, id))
        .groupBy(teams.id, activityTypes.name, images.url);

        if (!rows[0]) return res.status(404).json({ error: 'Team not found' });

        let is_member = false;
        if (requestingUserId) {
            const mr = await db.select().from(teamMembers)
                .where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, requestingUserId)));
            is_member = mr.length > 0;
        }
        res.json({ ...rows[0], is_member, image_url: rows[0].image_url ?? null });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch team' });
    }
});

// Create team
router.post('/teams', requireAuth, async (req, res) => {
    const { title, activity_type_id } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    try {
        const rows = await db.insert(teams).values({
            title,
            activityTypeId: activity_type_id ?? null,
            createdBy: req.userId,
        }).returning();
        res.status(201).json(rows[0]);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// Update team (owner only)
router.put('/teams/:id', requireAuth, async (req, res) => {
    const { title, activity_type_id } = req.body;
    try {
        const rows = await db.select().from(teams).where(eq(teams.id, Number(req.params.id)));
        if (!rows[0]) return res.status(404).json({ error: 'Team not found' });
        if (rows[0].createdBy !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        await db.update(teams).set({ title, activityTypeId: activity_type_id ?? null }).where(eq(teams.id, Number(req.params.id)));
        res.json({ ...rows[0], title, activityTypeId: activity_type_id ?? null });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update team' });
    }
});

// Delete team (owner only)
router.delete('/teams/:id', requireAuth, async (req, res) => {
    try {
        const rows = await db.select().from(teams).where(eq(teams.id, Number(req.params.id)));
        if (!rows[0]) return res.status(404).json({ error: 'Team not found' });
        if (rows[0].createdBy !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        await db.delete(teams).where(eq(teams.id, Number(req.params.id)));
        res.json({ message: 'Team deleted' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete team' });
    }
});

// Join team
router.post('/teams/:id/join', requireAuth, async (req, res) => {
    try {
        await db.insert(teamMembers).values({
            teamId: Number(req.params.id),
            userId: req.userId!,
        }).onConflictDoNothing();
        res.json({ message: 'Joined team' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to join team' });
    }
});

// Leave team
router.delete('/teams/:id/join', requireAuth, async (req, res) => {
    try {
        await db.delete(teamMembers).where(
            and(eq(teamMembers.teamId, Number(req.params.id)), eq(teamMembers.userId, req.userId!))
        );
        res.json({ message: 'Left team' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to leave team' });
    }
});

// Team leaderboard (public)
router.get('/teams/:id/leaderboard', async (req, res) => {
    try {
        const { rows } = await db.execute(sql`
            SELECT u.id, u.username,
                   COALESCE(SUM(e.points), 0) AS total_points,
                   RANK() OVER (ORDER BY COALESCE(SUM(e.points), 0) DESC) AS rank
            FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            LEFT JOIN entry_teams et ON et.team_id = tm.team_id
            LEFT JOIN entries e ON e.id = et.entry_id AND e.user_id = u.id
            WHERE tm.team_id = ${Number(req.params.id)}
            GROUP BY u.id, u.username
            ORDER BY total_points DESC
        `);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Team stats: average distance for week/month/year + top 20 users
router.get('/teams/:id/stats', async (req, res) => {
    const id = Number(req.params.id);
    try {
        const { rows: avgRows } = await db.execute(sql`
            SELECT
                COALESCE(AVG(CASE WHEN e.date::date >= CURRENT_DATE - INTERVAL '7 days' THEN e.points END), 0) AS avg_week,
                COALESCE(AVG(CASE WHEN e.date::date >= CURRENT_DATE - INTERVAL '30 days' THEN e.points END), 0) AS avg_month,
                COALESCE(AVG(CASE WHEN e.date::date >= CURRENT_DATE - INTERVAL '365 days' THEN e.points END), 0) AS avg_year
            FROM entry_teams et
            JOIN entries e ON e.id = et.entry_id
            WHERE et.team_id = ${id}
        `);

        const { rows: topUsers } = await db.execute(sql`
            SELECT u.id, u.username,
                   COALESCE(SUM(e.points), 0) AS total_points,
                   RANK() OVER (ORDER BY COALESCE(SUM(e.points), 0) DESC) AS rank
            FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            LEFT JOIN entry_teams et ON et.team_id = tm.team_id
            LEFT JOIN entries e ON e.id = et.entry_id AND e.user_id = u.id
            WHERE tm.team_id = ${id}
            GROUP BY u.id, u.username
            ORDER BY total_points DESC
            LIMIT 20
        `);

        const row = avgRows[0] as any;
        res.json({
            avg_week: Number(row?.avg_week ?? 0),
            avg_month: Number(row?.avg_month ?? 0),
            avg_year: Number(row?.avg_year ?? 0),
            top_users: topUsers,
        });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch team stats' });
    }
});

export default router;
