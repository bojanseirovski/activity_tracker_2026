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
// List challenges (optional search)
router.get('/challenges', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const q = req.query.q;
    try {
        const query = db_1.db.select({
            id: schema_1.challenges.id,
            title: schema_1.challenges.title,
            start_date: schema_1.challenges.startDate,
            end_date: schema_1.challenges.endDate,
            created_by: schema_1.challenges.createdBy,
            activity_type_name: schema_1.activityTypes.name,
            member_count: (0, drizzle_orm_1.sql) `COUNT(DISTINCT ${schema_1.challengeMembers.userId})`,
            image_url: schema_1.images.url,
        })
            .from(schema_1.challenges)
            .leftJoin(schema_1.activityTypes, (0, drizzle_orm_1.eq)(schema_1.activityTypes.id, schema_1.challenges.activityTypeId))
            .leftJoin(schema_1.challengeMembers, (0, drizzle_orm_1.eq)(schema_1.challengeMembers.challengeId, schema_1.challenges.id))
            .leftJoin(schema_1.images, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.images.entityType, 'challenge'), (0, drizzle_orm_1.eq)(schema_1.images.entityId, schema_1.challenges.id)))
            .groupBy(schema_1.challenges.id, schema_1.activityTypes.name, schema_1.images.url)
            .orderBy((0, drizzle_orm_1.sql) `${schema_1.challenges.startDate} DESC`);
        const rows = q
            ? yield query.where((0, drizzle_orm_1.ilike)(schema_1.challenges.title, `%${q}%`))
            : yield query;
        res.json(rows.map(r => { var _a; return (Object.assign(Object.assign({}, r), { image_url: (_a = r.image_url) !== null && _a !== void 0 ? _a : null })); }));
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch challenges' });
    }
}));
// Get challenge detail (public)
router.get('/challenges/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            id: schema_1.challenges.id,
            title: schema_1.challenges.title,
            activityTypeId: schema_1.challenges.activityTypeId,
            startDate: schema_1.challenges.startDate,
            endDate: schema_1.challenges.endDate,
            createdBy: schema_1.challenges.createdBy,
            activity_type_name: schema_1.activityTypes.name,
            member_count: (0, drizzle_orm_1.sql) `COUNT(DISTINCT ${schema_1.challengeMembers.userId})`,
            total_points: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema_1.entries.points}), 0)`,
            image_url: schema_1.images.url,
        })
            .from(schema_1.challenges)
            .leftJoin(schema_1.activityTypes, (0, drizzle_orm_1.eq)(schema_1.activityTypes.id, schema_1.challenges.activityTypeId))
            .leftJoin(schema_1.challengeMembers, (0, drizzle_orm_1.eq)(schema_1.challengeMembers.challengeId, schema_1.challenges.id))
            .leftJoin(schema_1.entryChallenges, (0, drizzle_orm_1.eq)(schema_1.entryChallenges.challengeId, schema_1.challenges.id))
            .leftJoin(schema_1.entries, (0, drizzle_orm_1.eq)(schema_1.entries.id, schema_1.entryChallenges.entryId))
            .leftJoin(schema_1.images, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.images.entityType, 'challenge'), (0, drizzle_orm_1.eq)(schema_1.images.entityId, schema_1.challenges.id)))
            .where((0, drizzle_orm_1.eq)(schema_1.challenges.id, id))
            .groupBy(schema_1.challenges.id, schema_1.activityTypes.name, schema_1.images.url);
        if (!rows[0])
            return res.status(404).json({ error: 'Challenge not found' });
        let is_member = false;
        if (requestingUserId) {
            const mr = yield db_1.db.select().from(schema_1.challengeMembers)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.challengeMembers.challengeId, id), (0, drizzle_orm_1.eq)(schema_1.challengeMembers.userId, requestingUserId)));
            is_member = mr.length > 0;
        }
        res.json(Object.assign(Object.assign({}, rows[0]), { is_member, image_url: (_a = rows[0].image_url) !== null && _a !== void 0 ? _a : null }));
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch challenge' });
    }
}));
// Create challenge
router.post('/challenges', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, activity_type_id, start_date, end_date } = req.body;
    if (!title || !start_date || !end_date)
        return res.status(400).json({ error: 'title, start_date and end_date are required' });
    try {
        const rows = yield db_1.db.insert(schema_1.challenges).values({
            title,
            activityTypeId: activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null,
            startDate: start_date,
            endDate: end_date,
            createdBy: req.userId,
        }).returning();
        res.status(201).json(rows[0]);
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create challenge' });
    }
}));
// Update challenge (owner only)
router.put('/challenges/:id', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, activity_type_id, start_date, end_date } = req.body;
    try {
        const rows = yield db_1.db.select().from(schema_1.challenges).where((0, drizzle_orm_1.eq)(schema_1.challenges.id, Number(req.params.id)));
        if (!rows[0])
            return res.status(404).json({ error: 'Challenge not found' });
        if (rows[0].createdBy !== req.userId)
            return res.status(403).json({ error: 'Forbidden' });
        yield db_1.db.update(schema_1.challenges).set({
            title,
            activityTypeId: activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null,
            startDate: start_date,
            endDate: end_date,
        }).where((0, drizzle_orm_1.eq)(schema_1.challenges.id, Number(req.params.id)));
        res.json(Object.assign(Object.assign({}, rows[0]), { title, activityTypeId: activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null, startDate: start_date, endDate: end_date }));
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update challenge' });
    }
}));
// Delete challenge (owner only)
router.delete('/challenges/:id', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rows = yield db_1.db.select().from(schema_1.challenges).where((0, drizzle_orm_1.eq)(schema_1.challenges.id, Number(req.params.id)));
        if (!rows[0])
            return res.status(404).json({ error: 'Challenge not found' });
        if (rows[0].createdBy !== req.userId)
            return res.status(403).json({ error: 'Forbidden' });
        yield db_1.db.delete(schema_1.challenges).where((0, drizzle_orm_1.eq)(schema_1.challenges.id, Number(req.params.id)));
        res.json({ message: 'Challenge deleted' });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete challenge' });
    }
}));
// Join challenge
router.post('/challenges/:id/join', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield db_1.db.insert(schema_1.challengeMembers).values({
            challengeId: Number(req.params.id),
            userId: req.userId,
        }).onConflictDoNothing();
        res.json({ message: 'Joined challenge' });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to join challenge' });
    }
}));
// Leave challenge
router.delete('/challenges/:id/join', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield db_1.db.delete(schema_1.challengeMembers).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.challengeMembers.challengeId, Number(req.params.id)), (0, drizzle_orm_1.eq)(schema_1.challengeMembers.userId, req.userId)));
        res.json({ message: 'Left challenge' });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to leave challenge' });
    }
}));
// Challenge leaderboard (public)
router.get('/challenges/:id/leaderboard', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { rows } = yield db_1.db.execute((0, drizzle_orm_1.sql) `
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
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
}));
// Challenge stats: total distance + top 20 users
router.get('/challenges/:id/stats', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const id = Number(req.params.id);
    try {
        const totalRows = yield db_1.db.select({
            total_distance: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema_1.entries.points}), 0)`,
        })
            .from(schema_1.entryChallenges)
            .leftJoin(schema_1.entries, (0, drizzle_orm_1.eq)(schema_1.entries.id, schema_1.entryChallenges.entryId))
            .where((0, drizzle_orm_1.eq)(schema_1.entryChallenges.challengeId, id));
        const { rows: topUsers } = yield db_1.db.execute((0, drizzle_orm_1.sql) `
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
            total_distance: Number((_b = (_a = totalRows[0]) === null || _a === void 0 ? void 0 : _a.total_distance) !== null && _b !== void 0 ? _b : 0),
            top_users: topUsers,
        });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch challenge stats' });
    }
}));
exports.default = router;
