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
router.get('/activity-types', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Activity attachments only visible to authenticated users
    const authHeader = req.headers['authorization'];
    let isAuthenticated = false;
    if (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) {
        try {
            jwt.verify(authHeader.slice(7), auth_1.JWT_SECRET);
            isAuthenticated = true;
        }
        catch (_a) { }
    }
    try {
        const rows = yield db_1.db.select({
            id: schema_1.activityTypes.id,
            name: schema_1.activityTypes.name,
            createdBy: schema_1.activityTypes.createdBy,
            image_url: schema_1.images.url,
        })
            .from(schema_1.activityTypes)
            .leftJoin(schema_1.images, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.images.entityType, 'activity_type'), (0, drizzle_orm_1.eq)(schema_1.images.entityId, schema_1.activityTypes.id)))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.activityTypes.name));
        res.json(rows.map(r => {
            var _a;
            return (Object.assign(Object.assign({}, r), { image_url: isAuthenticated ? ((_a = r.image_url) !== null && _a !== void 0 ? _a : null) : null }));
        }));
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch activity types' });
    }
}));
router.get('/activity-types/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const authHeader = req.headers['authorization'];
    let isAuthenticated = false;
    if (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) {
        try {
            jwt.verify(authHeader.slice(7), auth_1.JWT_SECRET);
            isAuthenticated = true;
        }
        catch (_b) { }
    }
    try {
        const rows = yield db_1.db.select({
            id: schema_1.activityTypes.id,
            name: schema_1.activityTypes.name,
            createdBy: schema_1.activityTypes.createdBy,
            image_url: schema_1.images.url,
        })
            .from(schema_1.activityTypes)
            .leftJoin(schema_1.images, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.images.entityType, 'activity_type'), (0, drizzle_orm_1.eq)(schema_1.images.entityId, schema_1.activityTypes.id)))
            .where((0, drizzle_orm_1.eq)(schema_1.activityTypes.id, Number(req.params.id)));
        if (!rows[0])
            return res.status(404).json({ error: 'Activity type not found' });
        res.json(Object.assign(Object.assign({}, rows[0]), { image_url: isAuthenticated ? ((_a = rows[0].image_url) !== null && _a !== void 0 ? _a : null) : null }));
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch activity type' });
    }
}));
router.post('/activity-types', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name } = req.body;
    if (!name)
        return res.status(400).json({ error: 'Name is required' });
    try {
        const rows = yield db_1.db.insert(schema_1.activityTypes).values({ name, createdBy: req.userId }).returning();
        res.status(201).json({ id: rows[0].id, name });
    }
    catch (err) {
        if (err.code === '23505')
            return res.status(400).json({ error: 'Activity type already exists' });
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create activity type' });
    }
}));
router.put('/activity-types/:id', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name } = req.body;
    if (!name)
        return res.status(400).json({ error: 'Name is required' });
    try {
        const rows = yield db_1.db.select().from(schema_1.activityTypes).where((0, drizzle_orm_1.eq)(schema_1.activityTypes.id, Number(req.params.id)));
        if (!rows[0])
            return res.status(404).json({ error: 'Activity type not found' });
        if (rows[0].createdBy !== req.userId)
            return res.status(403).json({ error: 'Forbidden' });
        yield db_1.db.update(schema_1.activityTypes).set({ name }).where((0, drizzle_orm_1.eq)(schema_1.activityTypes.id, Number(req.params.id)));
        res.json({ id: Number(req.params.id), name });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update activity type' });
    }
}));
router.delete('/activity-types/:id', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rows = yield db_1.db.select().from(schema_1.activityTypes).where((0, drizzle_orm_1.eq)(schema_1.activityTypes.id, Number(req.params.id)));
        if (!rows[0])
            return res.status(404).json({ error: 'Activity type not found' });
        if (rows[0].createdBy !== req.userId)
            return res.status(403).json({ error: 'Forbidden' });
        yield db_1.db.delete(schema_1.activityTypes).where((0, drizzle_orm_1.eq)(schema_1.activityTypes.id, Number(req.params.id)));
        res.json({ message: 'Activity type deleted successfully' });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete activity type' });
    }
}));
exports.default = router;
