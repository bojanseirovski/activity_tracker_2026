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
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const s3_1 = require("../lib/s3");
const router = (0, express_1.Router)();
const ALLOWED_SORT_COLS = new Set(['date', 'points', 'activity_type']);
function buildOrderClause(sort, order) {
    const col = ALLOWED_SORT_COLS.has(sort) ? sort : 'points';
    const dir = (order === null || order === void 0 ? void 0 : order.toLowerCase()) === 'asc' ? 'ASC' : 'DESC';
    const sqlCol = col === 'activity_type' ? 'at.name' : `e.${col}`;
    return `ORDER BY ${sqlCol} ${dir}`;
}
// Create entry
router.post('/entries', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, points, date, activity_type_id, challenge_ids, team_ids, tracking_data } = req.body;
    try {
        const result = yield db_1.db.transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const rows = yield tx.insert(schema_1.entries).values({
                name,
                points,
                date,
                activityTypeId: activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null,
                userId: req.userId,
                trackingData: tracking_data !== null && tracking_data !== void 0 ? tracking_data : null,
            }).returning({ id: schema_1.entries.id });
            const entryId = rows[0].id;
            if (Array.isArray(challenge_ids)) {
                for (const cid of challenge_ids) {
                    yield tx.insert(schema_1.entryChallenges).values({ entryId, challengeId: cid }).onConflictDoNothing();
                }
            }
            if (Array.isArray(team_ids)) {
                for (const tid of team_ids) {
                    yield tx.insert(schema_1.entryTeams).values({ entryId, teamId: tid }).onConflictDoNothing();
                }
            }
            return entryId;
        }));
        res.status(201).json({ id: result, name, points, date, activity_type_id: activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null, user_id: req.userId });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to insert entry' });
    }
}));
// Leaderboard
router.get('/leaderboard', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const page = parseInt(req.query.page || '1', 10);
    const limit = 10;
    const offset = (page - 1) * limit;
    const orderClause = buildOrderClause(req.query.sort, req.query.order);
    const sessionUserId = (_a = req.userId) !== null && _a !== void 0 ? _a : null;
    try {
        const { rows } = yield db_1.db.execute(drizzle_orm_1.sql.raw(`
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
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
}));
// Top performers
router.get('/top-performers', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
    const dir = ((_a = req.query.order) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'asc' ? 'ASC' : 'DESC';
    try {
        const { rows } = yield db_1.db.execute((0, drizzle_orm_1.sql) `
            SELECT u.id AS user_id,
                    u.username,
                    COUNT(e.id)                 AS total_entries,
                    COALESCE(SUM(e.points), 0)  AS total_points,
                    COALESCE(AVG(e.points), 0)  AS avg_points
            FROM users u
            LEFT JOIN entries e ON e.user_id = u.id
            GROUP BY u.id
            ORDER BY total_points ${drizzle_orm_1.sql.raw(dir)}
            LIMIT ${limit}
        `);
        res.json(rows);
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch top performers' });
    }
}));
// Search entries
router.get('/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const query = req.query.q || '';
    const orderClause = buildOrderClause(req.query.sort, req.query.order);
    try {
        const { rows } = yield db_1.db.execute((0, drizzle_orm_1.sql) `
            SELECT e.*, at.name AS activity_type_name, img.url AS image_url,
                   COALESCE(up.unit, 'km') AS unit
            FROM entries e
            LEFT JOIN activity_types at ON at.id = e.activity_type_id
            LEFT JOIN images img ON img.entity_type = 'entry' AND img.entity_id = e.id
            LEFT JOIN user_preferences up ON up.user_id = e.user_id
            WHERE e.name ILIKE ${`%${query}%`}
            ${drizzle_orm_1.sql.raw(orderClause)}
        `);
        res.json(rows);
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to search entries' });
    }
}));
// Get a single entry by ID
router.get('/entries/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const rows = yield db_1.db.select({
            id: schema_1.entries.id,
            name: schema_1.entries.name,
            points: schema_1.entries.points,
            date: schema_1.entries.date,
            activityTypeId: schema_1.entries.activityTypeId,
            userId: schema_1.entries.userId,
            activity_type: schema_1.activityTypes.name,
            image_url: schema_1.images.url,
            unit: schema_1.userPreferences.unit,
            tracking_data: schema_1.entries.trackingData,
        })
            .from(schema_1.entries)
            .leftJoin(schema_1.activityTypes, (0, drizzle_orm_1.eq)(schema_1.activityTypes.id, schema_1.entries.activityTypeId))
            .leftJoin(schema_1.images, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.images.entityType, 'entry'), (0, drizzle_orm_1.eq)(schema_1.images.entityId, schema_1.entries.id)))
            .leftJoin(schema_1.userPreferences, (0, drizzle_orm_1.eq)(schema_1.userPreferences.userId, schema_1.entries.userId))
            .where((0, drizzle_orm_1.eq)(schema_1.entries.id, Number(req.params.id)));
        if (!rows[0])
            return res.status(404).json({ error: 'Entry not found' });
        res.json(Object.assign(Object.assign({}, rows[0]), { unit: (_a = rows[0].unit) !== null && _a !== void 0 ? _a : 'km' }));
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch entry' });
    }
}));
// Update an entry by ID
router.put('/entries/:id', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = Number(req.params.id);
    const { name, points, date, activity_type_id, challenge_ids, team_ids } = req.body;
    try {
        yield db_1.db.transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield tx.update(schema_1.entries).set({
                name,
                points,
                date,
                activityTypeId: activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null,
            }).where((0, drizzle_orm_1.eq)(schema_1.entries.id, id));
            if (result.rowCount === 0) {
                throw new Error('NOT_FOUND');
            }
            if (Array.isArray(challenge_ids)) {
                yield tx.delete(schema_1.entryChallenges).where((0, drizzle_orm_1.eq)(schema_1.entryChallenges.entryId, id));
                for (const cid of challenge_ids) {
                    yield tx.insert(schema_1.entryChallenges).values({ entryId: id, challengeId: cid }).onConflictDoNothing();
                }
            }
            if (Array.isArray(team_ids)) {
                yield tx.delete(schema_1.entryTeams).where((0, drizzle_orm_1.eq)(schema_1.entryTeams.entryId, id));
                for (const tid of team_ids) {
                    yield tx.insert(schema_1.entryTeams).values({ entryId: id, teamId: tid }).onConflictDoNothing();
                }
            }
        }));
        res.json({ id, name, points, date, activity_type_id: activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null });
    }
    catch (err) {
        if (err.message === 'NOT_FOUND')
            return res.status(404).json({ error: 'Entry not found' });
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update entry' });
    }
}));
// Delete an entry by ID
router.delete('/entries/:id', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = Number(req.params.id);
    try {
        // Clean up associated image from S3 and DB
        const imgRows = yield db_1.db.select().from(schema_1.images)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.images.entityType, 'entry'), (0, drizzle_orm_1.eq)(schema_1.images.entityId, id)));
        if (imgRows[0]) {
            yield (0, s3_1.deleteFromS3)(imgRows[0].s3Key);
            yield db_1.db.delete(schema_1.images).where((0, drizzle_orm_1.eq)(schema_1.images.id, imgRows[0].id));
        }
        const result = yield db_1.db.delete(schema_1.entries).where((0, drizzle_orm_1.eq)(schema_1.entries.id, id));
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Entry not found' });
        res.json({ message: 'Entry deleted successfully' });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
}));
// Get likes for an entry
router.get('/entries/:id/likes', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const entryId = parseInt(req.params.id);
    const sessionUserId = (_a = req.userId) !== null && _a !== void 0 ? _a : null;
    try {
        const rows = yield db_1.db.select({
            user_id: schema_1.users.id,
            username: schema_1.users.username,
            liked_by_me: (0, drizzle_orm_1.sql) `(${schema_1.users.id} = ${sessionUserId})`,
        })
            .from(schema_1.entryLikes)
            .innerJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.entryLikes.userId))
            .where((0, drizzle_orm_1.eq)(schema_1.entryLikes.entryId, entryId));
        res.json({
            count: rows.length,
            liked_by_me: rows.some(r => r.liked_by_me),
            users: rows.map(r => ({ user_id: r.user_id, username: r.username })),
        });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch likes' });
    }
}));
// Like an entry
router.post('/entries/:id/likes', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const entryId = parseInt(req.params.id);
    try {
        const entryRows = yield db_1.db.select({ userId: schema_1.entries.userId }).from(schema_1.entries).where((0, drizzle_orm_1.eq)(schema_1.entries.id, entryId));
        if (!entryRows[0])
            return res.status(404).json({ error: 'Entry not found' });
        if (entryRows[0].userId === req.userId)
            return res.status(403).json({ error: 'Cannot like your own entry' });
        yield db_1.db.insert(schema_1.entryLikes).values({ entryId, userId: req.userId }).onConflictDoNothing();
        const countRows = yield db_1.db.select({ count: (0, drizzle_orm_1.sql) `COUNT(*)::int` }).from(schema_1.entryLikes).where((0, drizzle_orm_1.eq)(schema_1.entryLikes.entryId, entryId));
        res.json({ count: countRows[0].count });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to like entry' });
    }
}));
// Unlike an entry
router.delete('/entries/:id/likes', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const entryId = parseInt(req.params.id);
    try {
        yield db_1.db.delete(schema_1.entryLikes).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.entryLikes.entryId, entryId), (0, drizzle_orm_1.eq)(schema_1.entryLikes.userId, req.userId)));
        const countRows = yield db_1.db.select({ count: (0, drizzle_orm_1.sql) `COUNT(*)::int` }).from(schema_1.entryLikes).where((0, drizzle_orm_1.eq)(schema_1.entryLikes.entryId, entryId));
        res.json({ count: countRows[0].count });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to unlike entry' });
    }
}));
exports.default = router;
