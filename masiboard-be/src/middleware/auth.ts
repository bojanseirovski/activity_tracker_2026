const jwt = require('jsonwebtoken');

export const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret';
export const JWT_EXPIRES_IN = '7d';

declare global {
    namespace Express {
        interface Request { userId?: number; }
    }
}

export function requireAuth(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    try {
        const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number };
        req.userId = payload.userId;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
