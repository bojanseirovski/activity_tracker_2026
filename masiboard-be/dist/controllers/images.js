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
const uuid_1 = require("uuid");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const s3_1 = require("../lib/s3");
const router = (0, express_1.Router)();
const VALID_ENTITY_TYPES = ['user', 'activity_type', 'challenge', 'team', 'entry'];
function getExtension(mimetype) {
    const map = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
    };
    return map[mimetype] || 'jpg';
}
function verifyOwnership(entityType, entityId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        switch (entityType) {
            case 'user':
                return entityId === userId;
            case 'activity_type': {
                const rows = yield db_1.db.select({ createdBy: schema_1.activityTypes.createdBy }).from(schema_1.activityTypes).where((0, drizzle_orm_1.eq)(schema_1.activityTypes.id, entityId));
                return ((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.createdBy) === userId;
            }
            case 'challenge': {
                const rows = yield db_1.db.select({ createdBy: schema_1.challenges.createdBy }).from(schema_1.challenges).where((0, drizzle_orm_1.eq)(schema_1.challenges.id, entityId));
                return ((_b = rows[0]) === null || _b === void 0 ? void 0 : _b.createdBy) === userId;
            }
            case 'team': {
                const rows = yield db_1.db.select({ createdBy: schema_1.teams.createdBy }).from(schema_1.teams).where((0, drizzle_orm_1.eq)(schema_1.teams.id, entityId));
                return ((_c = rows[0]) === null || _c === void 0 ? void 0 : _c.createdBy) === userId;
            }
            case 'entry': {
                const rows = yield db_1.db.select({ userId: schema_1.entries.userId }).from(schema_1.entries).where((0, drizzle_orm_1.eq)(schema_1.entries.id, entityId));
                return ((_d = rows[0]) === null || _d === void 0 ? void 0 : _d.userId) === userId;
            }
            default:
                return false;
        }
    });
}
// Upload image
router.post('/images/upload', auth_1.requireAuth, upload_1.upload.single('image'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'No image file provided' });
        const entityType = req.body.entity_type;
        const entityId = parseInt(req.body.entity_id);
        if (!VALID_ENTITY_TYPES.includes(entityType)) {
            return res.status(400).json({ error: 'Invalid entity_type. Must be one of: user, activity_type, challenge, team, entry' });
        }
        if (isNaN(entityId)) {
            return res.status(400).json({ error: 'Invalid entity_id' });
        }
        const isOwner = yield verifyOwnership(entityType, entityId, req.userId);
        if (!isOwner)
            return res.status(403).json({ error: 'Forbidden' });
        // For non-entry entities, replace existing image (one image per entity)
        if (entityType !== 'entry') {
            const existing = yield db_1.db.select().from(schema_1.images)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.images.entityType, entityType), (0, drizzle_orm_1.eq)(schema_1.images.entityId, entityId)));
            if (existing[0]) {
                yield (0, s3_1.deleteFromS3)(existing[0].s3Key);
                yield db_1.db.delete(schema_1.images).where((0, drizzle_orm_1.eq)(schema_1.images.id, existing[0].id));
            }
        }
        // Upload new image
        const ext = getExtension(file.mimetype);
        const s3Key = `${entityType}/${entityId}/${(0, uuid_1.v4)()}.${ext}`;
        const url = yield (0, s3_1.uploadToS3)(s3Key, file.buffer, file.mimetype);
        const rows = yield db_1.db.insert(schema_1.images).values({
            entityType,
            entityId,
            s3Key,
            url,
            uploadedBy: req.userId,
        }).returning();
        res.status(201).json({
            id: rows[0].id,
            entity_type: rows[0].entityType,
            entity_id: rows[0].entityId,
            url: rows[0].url,
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Failed to upload image' });
    }
}));
// List images for an entity
router.get('/images', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const entityType = req.query.entity_type;
    const entityId = Number(req.query.entity_id);
    if (!entityType || isNaN(entityId))
        return res.status(400).json({ error: 'entity_type and entity_id required' });
    try {
        const rows = yield db_1.db.select({ id: schema_1.images.id, url: schema_1.images.url })
            .from(schema_1.images)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.images.entityType, entityType), (0, drizzle_orm_1.eq)(schema_1.images.entityId, entityId)));
        res.json(rows);
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch images' });
    }
}));
// Delete image
router.delete('/images/:id', auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = Number(req.params.id);
    try {
        const rows = yield db_1.db.select().from(schema_1.images).where((0, drizzle_orm_1.eq)(schema_1.images.id, id));
        if (!rows[0])
            return res.status(404).json({ error: 'Image not found' });
        if (rows[0].uploadedBy !== req.userId)
            return res.status(403).json({ error: 'Forbidden' });
        yield (0, s3_1.deleteFromS3)(rows[0].s3Key);
        yield db_1.db.delete(schema_1.images).where((0, drizzle_orm_1.eq)(schema_1.images.id, id));
        res.json({ message: 'Image deleted' });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete image' });
    }
}));
exports.default = router;
