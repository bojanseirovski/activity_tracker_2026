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
const jwt = require('jsonwebtoken');
const router = (0, express_1.Router)();
// Current user profile
router.get('/user/me', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const rows = yield db_1.db.select({
            id: schema_1.users.id,
            username: schema_1.users.username,
            email: schema_1.users.email,
            profileImagePublic: schema_1.users.profileImagePublic,
            totalEntries: (0, drizzle_orm_1.sql) `COUNT(DISTINCT ${schema_1.entries.id})`,
            totalPoints: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema_1.entries.points}), 0)`,
            image_url: schema_1.images.url,
            unit: schema_1.userPreferences.unit,
        })
            .from(schema_1.users)
            .leftJoin(schema_1.entries, (0, drizzle_orm_1.eq)(schema_1.entries.userId, schema_1.users.id))
            .leftJoin(schema_1.images, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.images.entityType, 'user'), (0, drizzle_orm_1.eq)(schema_1.images.entityId, schema_1.users.id)))
            .leftJoin(schema_1.userPreferences, (0, drizzle_orm_1.eq)(schema_1.userPreferences.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, req.userId))
            .groupBy(schema_1.users.id, schema_1.images.url, schema_1.userPreferences.unit);
        if (!rows[0])
            return res.status(404).json({ error: 'User not found' });
        res.json({
            id: rows[0].id,
            username: rows[0].username,
            email: rows[0].email,
            profileImagePublic: rows[0].profileImagePublic,
            totalEntries: rows[0].totalEntries,
            totalPoints: rows[0].totalPoints,
            image_url: (_a = rows[0].image_url) !== null && _a !== void 0 ? _a : null,
            unit: (_b = rows[0].unit) !== null && _b !== void 0 ? _b : 'km',
        });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Database error' });
    }
}));
// Update current user profile
router.post('/user/me', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { username, profile_image_public, unit } = req.body;
    if (!username)
        return res.status(400).json({ error: 'Username is required' });
    const updates = { username };
    if (typeof profile_image_public === 'boolean') {
        updates.profileImagePublic = profile_image_public;
    }
    try {
        const rows = yield db_1.db.update(schema_1.users)
            .set(updates)
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, req.userId))
            .returning({ id: schema_1.users.id, username: schema_1.users.username, email: schema_1.users.email, profileImagePublic: schema_1.users.profileImagePublic });
        if (rows.length === 0)
            return res.status(404).json({ error: 'User not found' });
        let savedUnit = 'km';
        if (unit === 'km' || unit === 'mi') {
            yield db_1.db.insert(schema_1.userPreferences).values({ userId: req.userId, unit })
                .onConflictDoUpdate({ target: schema_1.userPreferences.userId, set: { unit } });
            savedUnit = unit;
        }
        else {
            const prefRows = yield db_1.db.select({ unit: schema_1.userPreferences.unit }).from(schema_1.userPreferences).where((0, drizzle_orm_1.eq)(schema_1.userPreferences.userId, req.userId));
            savedUnit = (_b = (_a = prefRows[0]) === null || _a === void 0 ? void 0 : _a.unit) !== null && _b !== void 0 ? _b : 'km';
        }
        res.json(Object.assign(Object.assign({}, rows[0]), { profile_image_public: rows[0].profileImagePublic, unit: savedUnit }));
    }
    catch (err) {
        if (err.code === '23505')
            return res.status(409).json({ error: 'Username already taken' });
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update profile' });
    }
}));
// Public user profile
router.get('/users/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const userId = parseInt(req.params.id);
    if (isNaN(userId))
        return res.status(400).json({ error: 'Invalid user id' });
    const authHeader = req.headers['authorization'];
    let requestingUserId = null;
    if (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) {
        try {
            requestingUserId = jwt.verify(authHeader.slice(7), auth_1.JWT_SECRET).userId;
        }
        catch (_d) { }
    }
    try {
        const rows = yield db_1.db.select({
            username: schema_1.users.username,
            profileImagePublic: schema_1.users.profileImagePublic,
            total_entries: (0, drizzle_orm_1.sql) `COUNT(DISTINCT ${schema_1.entries.id})`,
            image_url: schema_1.images.url,
        })
            .from(schema_1.users)
            .leftJoin(schema_1.entries, (0, drizzle_orm_1.eq)(schema_1.entries.userId, schema_1.users.id))
            .leftJoin(schema_1.images, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.images.entityType, 'user'), (0, drizzle_orm_1.eq)(schema_1.images.entityId, schema_1.users.id)))
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .groupBy(schema_1.users.id, schema_1.images.url);
        if (!rows[0])
            return res.status(404).json({ error: 'User not found' });
        const { rows: rankRows } = yield db_1.db.execute((0, drizzle_orm_1.sql) `
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
        const actRows = yield db_1.db.select({ name: schema_1.activityTypes.name })
            .from(schema_1.entries)
            .leftJoin(schema_1.activityTypes, (0, drizzle_orm_1.eq)(schema_1.activityTypes.id, schema_1.entries.activityTypeId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.entries.userId, userId), (0, drizzle_orm_1.isNotNull)(schema_1.activityTypes.name)))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.entries.date))
            .limit(3);
        // Show image only if public or if the requesting user is the profile owner
        const showImage = rows[0].profileImagePublic || requestingUserId === userId;
        res.json({
            username: rows[0].username,
            total_entries: Number(rows[0].total_entries),
            position: (_b = (_a = rankRows[0]) === null || _a === void 0 ? void 0 : _a.position) !== null && _b !== void 0 ? _b : 0,
            last_activity_types: actRows.map(r => r.name),
            image_url: showImage ? ((_c = rows[0].image_url) !== null && _c !== void 0 ? _c : null) : null,
        });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
}));
// User challenges
router.get('/users/:id/challenges', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = parseInt(req.params.id);
    if (isNaN(userId))
        return res.status(400).json({ error: 'Invalid user id' });
    try {
        const rows = yield db_1.db.select({
            id: schema_1.challenges.id,
            title: schema_1.challenges.title,
            start_date: schema_1.challenges.startDate,
            end_date: schema_1.challenges.endDate,
            activity_type_name: schema_1.activityTypes.name,
            user_points: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema_1.entries.points}), 0)`,
        })
            .from(schema_1.challengeMembers)
            .innerJoin(schema_1.challenges, (0, drizzle_orm_1.eq)(schema_1.challenges.id, schema_1.challengeMembers.challengeId))
            .leftJoin(schema_1.activityTypes, (0, drizzle_orm_1.eq)(schema_1.activityTypes.id, schema_1.challenges.activityTypeId))
            .leftJoin(schema_1.entryChallenges, (0, drizzle_orm_1.eq)(schema_1.entryChallenges.challengeId, schema_1.challenges.id))
            .leftJoin(schema_1.entries, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.entries.id, schema_1.entryChallenges.entryId), (0, drizzle_orm_1.eq)(schema_1.entries.userId, userId)))
            .where((0, drizzle_orm_1.eq)(schema_1.challengeMembers.userId, userId))
            .groupBy(schema_1.challenges.id, schema_1.challenges.title, schema_1.challenges.startDate, schema_1.challenges.endDate, schema_1.activityTypes.name)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.challenges.endDate));
        res.json(rows);
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch user challenges' });
    }
}));
// User teams
router.get('/users/:id/teams', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = parseInt(req.params.id);
    if (isNaN(userId))
        return res.status(400).json({ error: 'Invalid user id' });
    try {
        const rows = yield db_1.db.select({
            id: schema_1.teams.id,
            title: schema_1.teams.title,
            activity_type_name: schema_1.activityTypes.name,
            user_points: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema_1.entries.points}), 0)`,
        })
            .from(schema_1.teamMembers)
            .innerJoin(schema_1.teams, (0, drizzle_orm_1.eq)(schema_1.teams.id, schema_1.teamMembers.teamId))
            .leftJoin(schema_1.activityTypes, (0, drizzle_orm_1.eq)(schema_1.activityTypes.id, schema_1.teams.activityTypeId))
            .leftJoin(schema_1.entryTeams, (0, drizzle_orm_1.eq)(schema_1.entryTeams.teamId, schema_1.teams.id))
            .leftJoin(schema_1.entries, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.entries.id, schema_1.entryTeams.entryId), (0, drizzle_orm_1.eq)(schema_1.entries.userId, userId)))
            .where((0, drizzle_orm_1.eq)(schema_1.teamMembers.userId, userId))
            .groupBy(schema_1.teams.id, schema_1.teams.title, schema_1.activityTypes.name)
            .orderBy(schema_1.teams.title);
        res.json(rows);
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch user teams' });
    }
}));
// User stats: average distance for past week, month, year
router.get('/users/:id/stats', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const userId = parseInt(req.params.id);
    if (isNaN(userId))
        return res.status(400).json({ error: 'Invalid user id' });
    try {
        const { rows } = yield db_1.db.execute((0, drizzle_orm_1.sql) `
            SELECT
                COALESCE(AVG(CASE WHEN e.date::date >= CURRENT_DATE - INTERVAL '7 days' THEN e.points END), 0) AS avg_week,
                COALESCE(AVG(CASE WHEN e.date::date >= CURRENT_DATE - INTERVAL '30 days' THEN e.points END), 0) AS avg_month,
                COALESCE(AVG(CASE WHEN e.date::date >= CURRENT_DATE - INTERVAL '365 days' THEN e.points END), 0) AS avg_year
            FROM entries e
            WHERE e.user_id = ${userId}
        `);
        const prefRows = yield db_1.db.select({ unit: schema_1.userPreferences.unit })
            .from(schema_1.userPreferences)
            .where((0, drizzle_orm_1.eq)(schema_1.userPreferences.userId, userId));
        const unit = (_b = (_a = prefRows[0]) === null || _a === void 0 ? void 0 : _a.unit) !== null && _b !== void 0 ? _b : 'km';
        const row = rows[0];
        res.json({
            avg_week: Number((_c = row === null || row === void 0 ? void 0 : row.avg_week) !== null && _c !== void 0 ? _c : 0),
            avg_month: Number((_d = row === null || row === void 0 ? void 0 : row.avg_month) !== null && _d !== void 0 ? _d : 0),
            avg_year: Number((_e = row === null || row === void 0 ? void 0 : row.avg_year) !== null && _e !== void 0 ? _e : 0),
            unit,
        });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
}));
exports.default = router;
