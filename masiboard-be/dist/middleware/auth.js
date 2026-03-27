"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_EXPIRES_IN = exports.JWT_SECRET = void 0;
exports.requireAuth = requireAuth;
const jwt = require('jsonwebtoken');
exports.JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret';
exports.JWT_EXPIRES_IN = '7d';
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer '))) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const payload = jwt.verify(authHeader.slice(7), exports.JWT_SECRET);
        req.userId = payload.userId;
        next();
    }
    catch (_a) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
