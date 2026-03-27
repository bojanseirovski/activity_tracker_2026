"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const jwt = require('jsonwebtoken');
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// List teams (optional search)
router.get('/teams', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const q = req.query.q;
    try {
        const query = db_1.db.select({
            id: schema_1.teams.id,
            title: schema_1.teams.title,
            created_by: schema_1.teams.createdBy,
            activity_type_name: schema_1.activityTypes.name,
            member_count: (0, drizzle_orm_1.sql) `COUNT(DISTINCT ${schema_1.teamMembers.userId})`,
            image_url: schema_1.images.url,
        })
            .from(schema_1.teams)
            .leftJoin(schema_1.activityTypes, (0, drizzle_orm_1.eq)(schema_1.activityTypes.id, schema_1.teams.activityTypeId))
            .leftJoin(schema_1.teamMembers, (0, drizzle_orm_1.eq)(schema_1.teamMembers.teamId, schema_1.teams.id))
            .leftJoin(schema_1.images, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.images.entityType, 'team'), (0, drizzle_orm_1.eq)(schema_1.images.entityId, schema_1.teams.id)))
            .groupBy(schema_1.teams.id, schema_1.activityTypes.name, schema_1.images.url)
            .orderBy(schema_1.teams.title);
        const rows = q
            ? yield query.where((0, drizzle_orm_1.ilike)(schema_1.teams.title, `%${q}%`))
            : yield query;
        res.json(rows.map(r => { var _a; return (Object.assign(Object.assign({}, r), { image_url: (_a = r.image_url) !== null && _a !== void 0 ? _a : null })); }));
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
}));
// Get team detail (public)
router.get('/teams/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const id = Number(req.params.id);
    const authHeader = req.headers['authorization'];
    let requestingUserId = null;
    if (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) {
        try {
            requestingUserId = jwt.verify(authHeader.slice(7), auth_1.JWT_SECRET).userId;
        }
        catch (_b) { }
    }
    try {
        const rows = yield db_1.db.select({
            id: schema_1.teams.id,
            title: schema_1.teams.title,
            activityTypeId: schema_1.teams.activityTypeId,
            createdBy: schema_1.teams.createdBy,
            activity_type_name: schema_1.activityTypes.name,
            member_count: (0, drizzle_orm_1.sql) `COUNT(DISTINCT ${schema_1.teamMembers.userId})`,
            total_points: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema_1.entries.points}), 0)`,
            image_url: schema_1.images.url,
        })
            .from(schema_1.teams)
            .leftJoin(schema_1.activityTypes, (0, drizzle_orm_1.eq)(schema_1.activityTypes.id, schema_1.teams.activityTypeId))
            .leftJoin(schema_1.teamMembers, (0, drizzle_orm_1.eq)(schema_1.teamMembers.teamId, schema_1.teams.id))
            .leftJoin(schema_1.entryTeams, (0, drizzle_orm_1.eq)(schema_1.entryTeams.teamId, schema_1.teams.id))
            .leftJoin(schema_1.entries, (0, drizzle_orm_1.eq)(schema_1.entries.id, schema_1.entryTeams.entryId))
            .leftJoin(schema_1.images, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.images.entityType, 'team'), (0, drizzle_orm_1.eq)(schema_1.images.entityId, schema_1.teams.id)))
            .where((0, drizzle_orm_1.eq)(schema_1.teams.id, id))
            .groupBy(schema_1.teams.id, schema_1.activityTypes.name, schema_1.images.url);
        if (!rows[0])
            return res.status(404).json({ error: 'Team not found' });
        let is_member = false;
        if (requestingUserId) {
            const mr = yield db_1.db.select().from(schema_1.teamMembers)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.teamMembers.teamId, id), (0, drizzle_orm_1.eq)(schema_1.teamMembers.userId, requestingUserId)));
            is_member = mr.length > 0;
        }
        res.json(Object.assign(Object.assign({}, rows[0]), { is_member, image_url: (_a = rows[0].image_url) !== null && _a !== void 0 ? _a : null }));
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch team' });
    }
}));
// Create team
router.post('/teams', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, activity_type_id } = req.body;
    if (!title)
        return res.status(400).json({ error: 'title is required' });
    try {
        const rows = yield db_1.db.insert(schema_1.teams).values({
            title,
            activityTypeId: activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null,
            createdBy: req.userId,
        }).returning();
        res.status(201).json(rows[0]);
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create team' });
    }
}));
// Update team (owner only)
router.put('/teams/:id', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, activity_type_id } = req.body;
    try {
        const rows = yield db_1.db.select().from(schema_1.teams).where((0, drizzle_orm_1.eq)(schema_1.teams.id, Number(req.params.id)));
        if (!rows[0])
            return res.status(404).json({ error: 'Team not found' });
        if (rows[0].createdBy !== req.userId)
            return res.status(403).json({ error: 'Forbidden' });
        yield db_1.db.update(schema_1.teams).set({ title, activityTypeId: activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null }).where((0, drizzle_orm_1.eq)(schema_1.teams.id, Number(req.params.id)));
        res.json(Object.assign(Object.assign({}, rows[0]), { title, activityTypeId: activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null }));
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update team' });
    }
}));
// Delete team (owner only)
router.delete('/teams/:id', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rows = yield db_1.db.select().from(schema_1.teams).where((0, drizzle_orm_1.eq)(schema_1.teams.id, Number(req.params.id)));
        if (!rows[0])
            return res.status(404).json({ error: 'Team not found' });
        if (rows[0].createdBy !== req.userId)
            return res.status(403).json({ error: 'Forbidden' });
        yield db_1.db.delete(schema_1.teams).where((0, drizzle_orm_1.eq)(schema_1.teams.id, Number(req.params.id)));
        res.json({ message: 'Team deleted' });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete team' });
    }
}));
// Join team
router.post('/teams/:id/join', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield db_1.db.insert(schema_1.teamMembers).values({
            teamId: Number(req.params.id),
            userId: req.userId,
        }).onConflictDoNothing();
        res.json({ message: 'Joined team' });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to join team' });
    }
}));
// Leave team
router.delete('/teams/:id/join', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield db_1.db.delete(schema_1.teamMembers).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.teamMembers.teamId, Number(req.params.id)), (0, drizzle_orm_1.eq)(schema_1.teamMembers.userId, req.userId)));
        res.json({ message: 'Left team' });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to leave team' });
    }
}));
// Team leaderboard (public)
router.get('/teams/:id/leaderboard', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { rows } = yield db_1.db.execute((0, drizzle_orm_1.sql) `
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
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
}));
// Team stats: average distance for week/month/year + top 20 users
router.get('/teams/:id/stats', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const id = Number(req.params.id);
    try {
        const { rows: avgRows } = yield db_1.db.execute((0, drizzle_orm_1.sql) `
            SELECT
                COALESCE(AVG(CASE WHEN e.date::date >= CURRENT_DATE - INTERVAL '7 days' THEN e.points END), 0) AS avg_week,
                COALESCE(AVG(CASE WHEN e.date::date >= CURRENT_DATE - INTERVAL '30 days' THEN e.points END), 0) AS avg_month,
                COALESCE(AVG(CASE WHEN e.date::date >= CURRENT_DATE - INTERVAL '365 days' THEN e.points END), 0) AS avg_year
            FROM entry_teams et
            JOIN entries e ON e.id = et.entry_id
            WHERE et.team_id = ${id}
        `);
        const { rows: topUsers } = yield db_1.db.execute((0, drizzle_orm_1.sql) `
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
        const row = avgRows[0];
        res.json({
            avg_week: Number((_a = row === null || row === void 0 ? void 0 : row.avg_week) !== null && _a !== void 0 ? _a : 0),
            avg_month: Number((_b = row === null || row === void 0 ? void 0 : row.avg_month) !== null && _b !== void 0 ? _b : 0),
            avg_year: Number((_c = row === null || row === void 0 ? void 0 : row.avg_year) !== null && _c !== void 0 ? _c : 0),
            top_users: topUsers,
        });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch team stats' });
    }
}));
exports.default = router;
