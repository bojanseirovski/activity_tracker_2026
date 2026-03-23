const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');
const cryptoUtils = require('crypto');
const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');
const serverless = require('serverless-http');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(bodyParser.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    if (req.body && Buffer.isBuffer(req.body)) {
        try {
            req.body = JSON.parse(req.body.toString('utf8'));
        } catch (e) {
            req.body = {};
        }
    }
    if (typeof req.body === 'string') {
        try {
            req.body = JSON.parse(req.body);
        } catch (e) {
            req.body = {};
        }
    }
    next();
});
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2  // Lambda: avoid exhausting PostgreSQL connections across concurrent instances
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret';
const JWT_EXPIRES_IN = '7d';

declare global {
    namespace Express {
        interface Request { userId?: number; }
    }
}

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS activity_types (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            created_by INTEGER REFERENCES users(id)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS entries (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            points INTEGER NOT NULL,
            date TEXT NOT NULL,
            activity_type_id INTEGER REFERENCES activity_types(id),
            user_id INTEGER REFERENCES users(id)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS entry_likes (
            entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
            user_id  INTEGER REFERENCES users(id)  ON DELETE CASCADE,
            PRIMARY KEY (entry_id, user_id)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
            token      TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at    TIMESTAMPTZ
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS challenges (
            id               SERIAL PRIMARY KEY,
            title            TEXT NOT NULL,
            activity_type_id INTEGER REFERENCES activity_types(id),
            start_date       TEXT NOT NULL,
            end_date         TEXT NOT NULL,
            created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS teams (
            id               SERIAL PRIMARY KEY,
            title            TEXT NOT NULL,
            activity_type_id INTEGER REFERENCES activity_types(id),
            created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS challenge_members (
            challenge_id INTEGER REFERENCES challenges(id) ON DELETE CASCADE,
            user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (challenge_id, user_id)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS team_members (
            team_id  INTEGER REFERENCES teams(id) ON DELETE CASCADE,
            user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (team_id, user_id)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS entry_challenges (
            entry_id     INTEGER REFERENCES entries(id) ON DELETE CASCADE,
            challenge_id INTEGER REFERENCES challenges(id) ON DELETE CASCADE,
            PRIMARY KEY (entry_id, challenge_id)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS entry_teams (
            entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
            team_id  INTEGER REFERENCES teams(id) ON DELETE CASCADE,
            PRIMARY KEY (entry_id, team_id)
        )
    `);

    console.log('Database initialized');
}

// API Routes

function requireAuth(req: any, res: any, next: any) {
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

const ALLOWED_SORT_COLS = new Set(['date', 'points', 'activity_type']);

function buildOrderClause(sort: string | undefined, order: string | undefined): string {
    const col = ALLOWED_SORT_COLS.has(sort) ? sort : 'points';
    const dir = order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const sqlCol = col === 'activity_type' ? 'at.name' : `e.${col}`;
    return `ORDER BY ${sqlCol} ${dir}`;
}

// Activity Types routes
app.get('/api/activity-types', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM activity_types ORDER BY name ASC');
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch activity types' });
    }
});

app.get('/api/activity-types/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM activity_types WHERE id = $1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Activity type not found' });
        res.json(rows[0]);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch activity type' });
    }
});

app.post('/api/activity-types', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const { rows } = await pool.query(
            'INSERT INTO activity_types (name, created_by) VALUES ($1, $2) RETURNING id',
            [name, req.userId]
        );
        res.status(201).json({ id: rows[0].id, name });
    } catch (err: any) {
        if (err.code === '23505') return res.status(400).json({ error: 'Activity type already exists' });
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create activity type' });
    }
});

app.put('/api/activity-types/:id', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const { rows } = await pool.query('SELECT * FROM activity_types WHERE id = $1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Activity type not found' });
        if (rows[0].created_by !== req.userId) return res.status(403).json({ error: 'Forbidden' });

        await pool.query('UPDATE activity_types SET name = $1 WHERE id = $2', [name, req.params.id]);
        res.json({ id: Number(req.params.id), name });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update activity type' });
    }
});

app.delete('/api/activity-types/:id', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM activity_types WHERE id = $1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Activity type not found' });
        if (rows[0].created_by !== req.userId) return res.status(403).json({ error: 'Forbidden' });

        await pool.query('DELETE FROM activity_types WHERE id = $1', [req.params.id]);
        res.json({ message: 'Activity type deleted successfully' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete activity type' });
    }
});

// Register endpoint
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const { rows } = await pool.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
            [username, email, hashedPassword]
        );
        const token = jwt.sign({ userId: rows[0].id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.status(201).json({ message: 'User registered successfully', token });
    } catch (err: any) {
        if (err.code === '23505') {
            if (err.constraint?.includes('email')) return res.status(400).json({ error: 'Email already exists' });
            if (err.constraint?.includes('username')) return res.status(400).json({ error: 'Username already exists' });
        }
        console.error(err.message);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const { rows } = await pool.query('SELECT id, username, email, password FROM users WHERE email = $1', [email]);
        const user = rows[0];
        const valid = user && await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.json({ message: 'Login successful', token, userId: user.id });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Logout endpoint
app.post('/api/logout', requireAuth, (_req, res) => {
    res.json({ message: 'Logout successful' });
});

// Current user profile
app.get('/api/user/me', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT u.id, u.username, u.email,
                    COUNT(e.id) AS "totalEntries",
                    COALESCE(SUM(e.points), 0) AS "totalPoints"
            FROM users u
            LEFT JOIN entries e ON e.user_id = u.id
            WHERE u.id = $1
            GROUP BY u.id
        `, [req.userId]);
        if (!rows[0]) return res.status(404).json({ error: 'User not found' });
        res.json({
            id: rows[0].id,
            username: rows[0].username,
            email: rows[0].email,
            totalEntries: rows[0].totalEntries,
            totalPoints: rows[0].totalPoints,
        });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update current user profile (username only)
app.post('/api/user/me', requireAuth, async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    try {
        const result = await pool.query(
            'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, email',
            [username, req.userId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err: any) {
        if (err.code === '23505') return res.status(409).json({ error: 'Username already taken' });
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Public user profile
app.get('/api/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

    try {
        const { rows } = await pool.query(`
            SELECT u.username, COUNT(e.id) AS total_entries
            FROM users u
            LEFT JOIN entries e ON e.user_id = u.id
            WHERE u.id = $1
            GROUP BY u.id
        `, [userId]);
        if (!rows[0]) return res.status(404).json({ error: 'User not found' });

        const { rows: rankRows } = await pool.query(`
            SELECT user_id, total_points, position
            FROM (
                SELECT user_id,
                       SUM(points) AS total_points,
                       RANK() OVER (ORDER BY SUM(points) DESC) AS position
                FROM entries
                GROUP BY user_id
            ) ranked
            WHERE user_id = $1
        `, [userId]);

        const { rows: actRows } = await pool.query(`
            SELECT at.name
            FROM entries e
            LEFT JOIN activity_types at ON at.id = e.activity_type_id
            WHERE e.user_id = $1 AND at.name IS NOT NULL
            ORDER BY e.date DESC
            LIMIT 3
        `, [userId]);

        res.json({
            username: rows[0].username,
            total_entries: parseInt(rows[0].total_entries),
            position: rankRows[0]?.position ?? 0,
            last_activity_types: actRows.map(r => r.name),
        });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

app.get('/api/users/:id/challenges', async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
    try {
        const { rows } = await pool.query(`
            SELECT c.id, c.title, c.start_date, c.end_date,
                at.name AS activity_type_name,
                COALESCE(SUM(e.points), 0) AS user_points
            FROM challenge_members cm
            JOIN challenges c ON c.id = cm.challenge_id
            LEFT JOIN activity_types at ON at.id = c.activity_type_id
            LEFT JOIN entry_challenges ec ON ec.challenge_id = c.id
            LEFT JOIN entries e ON e.id = ec.entry_id AND e.user_id = $1
            WHERE cm.user_id = $1
            GROUP BY c.id, c.title, c.start_date, c.end_date, at.name
            ORDER BY c.end_date DESC
        `, [userId]);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch user challenges' });
    }
});

app.get('/api/users/:id/teams', async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
    try {
        const { rows } = await pool.query(`
            SELECT t.id, t.title,
                at.name AS activity_type_name,
                COALESCE(SUM(e.points), 0) AS user_points
            FROM team_members tm
            JOIN teams t ON t.id = tm.team_id
            LEFT JOIN activity_types at ON at.id = t.activity_type_id
            LEFT JOIN entry_teams et ON et.team_id = t.id
            LEFT JOIN entries e ON e.id = et.entry_id AND e.user_id = $1
            WHERE tm.user_id = $1
            GROUP BY t.id, t.title, at.name
            ORDER BY t.title
        `, [userId]);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch user teams' });
    }
});

// Create entry
app.post('/api/entries', requireAuth, async (req, res) => {
    const { name, points, date, activity_type_id, challenge_ids, team_ids } = req.body;

    try {
        await pool.query('BEGIN');
        const { rows } = await pool.query(
            'INSERT INTO entries (name, points, date, activity_type_id, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, points, date, activity_type_id ?? null, req.userId]
        );
        const entryId = rows[0].id;
        if (Array.isArray(challenge_ids)) {
            for (const cid of challenge_ids) {
                await pool.query('INSERT INTO entry_challenges (entry_id, challenge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [entryId, cid]);
            }
        }
        if (Array.isArray(team_ids)) {
            for (const tid of team_ids) {
                await pool.query('INSERT INTO entry_teams (entry_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [entryId, tid]);
            }
        }
        await pool.query('COMMIT');
        res.status(201).json({ id: entryId, name, points, date, activity_type_id: activity_type_id ?? null, user_id: req.userId });
    } catch (err: any) {
        await pool.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: 'Failed to insert entry' });
    }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = 10;
    const offset = (page - 1) * limit;
    const orderClause = buildOrderClause(req.query.sort as string, req.query.order as string);

    try {
        const sessionUserId = req.userId ?? null;
        const { rows } = await pool.query(`
            SELECT e.*, at.name AS activity_type,
                   COUNT(el.user_id)::int                        AS like_count,
                   COALESCE(BOOL_OR(el.user_id = $3), false)     AS liked_by_me
            FROM entries e
            LEFT JOIN activity_types at ON at.id = e.activity_type_id
            LEFT JOIN entry_likes el ON el.entry_id = e.id
            GROUP BY e.id, at.name
            ${orderClause}
            LIMIT $1 OFFSET $2
        `, [limit, offset, sessionUserId]);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Top performers
app.get('/api/top-performers', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 100);
    const dir = (req.query.order as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    try {
        const { rows } = await pool.query(`
            SELECT u.id AS user_id,
                    u.username,
                    COUNT(e.id)                 AS total_entries,
                    COALESCE(SUM(e.points), 0)  AS total_points,
                    COALESCE(AVG(e.points), 0)  AS avg_points
            FROM users u
            LEFT JOIN entries e ON e.user_id = u.id
            GROUP BY u.id
            ORDER BY total_points ${dir}
            LIMIT $1
        `, [limit]);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch top performers' });
    }
});

// Search entries
app.get('/api/search', async (req, res) => {
    const query = req.query.q as string || '';
    const orderClause = buildOrderClause(req.query.sort as string, req.query.order as string);

    try {
        const { rows } = await pool.query(`
            SELECT e.*, at.name AS activity_type
            FROM entries e
            LEFT JOIN activity_types at ON at.id = e.activity_type_id
            WHERE e.name ILIKE $1
            ${orderClause}
        `, [`%${query}%`]);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to search entries' });
    }
});

// Get a single entry by ID
app.get('/api/entries/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT e.*, at.name AS activity_type
            FROM entries e
            LEFT JOIN activity_types at ON at.id = e.activity_type_id
            WHERE e.id = $1
        `, [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Entry not found' });
        res.json(rows[0]);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch entry' });
    }
});

// Update an entry by ID
app.put('/api/entries/:id', requireAuth, async (req, res) => {
    const id = req.params.id;
    const { name, points, date, activity_type_id, challenge_ids, team_ids } = req.body;

    try {
        await pool.query('BEGIN');
        const result = await pool.query(
            'UPDATE entries SET name = $1, points = $2, date = $3, activity_type_id = $4 WHERE id = $5',
            [name, points, date, activity_type_id ?? null, id]
        );
        if (result.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'Entry not found' });
        }
        if (Array.isArray(challenge_ids)) {
            await pool.query('DELETE FROM entry_challenges WHERE entry_id = $1', [id]);
            for (const cid of challenge_ids) {
                await pool.query('INSERT INTO entry_challenges (entry_id, challenge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, cid]);
            }
        }
        if (Array.isArray(team_ids)) {
            await pool.query('DELETE FROM entry_teams WHERE entry_id = $1', [id]);
            for (const tid of team_ids) {
                await pool.query('INSERT INTO entry_teams (entry_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, tid]);
            }
        }
        await pool.query('COMMIT');
        res.json({ id, name, points, date, activity_type_id: activity_type_id ?? null });
    } catch (err: any) {
        await pool.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update entry' });
    }
});

// Delete an entry by ID
app.delete('/api/entries/:id', requireAuth, async (req, res) => {
    const id = req.params.id;

    try {
        const result = await pool.query('DELETE FROM entries WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Entry not found' });
        res.json({ message: 'Entry deleted successfully' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
});

// Get likes for an entry
app.get('/api/entries/:id/likes', async (req, res) => {
    const entryId = parseInt(req.params.id);
    const sessionUserId = req.userId ?? null;
    try {
        const { rows } = await pool.query(`
            SELECT u.id AS user_id, u.username,
                    (u.id = $2) AS liked_by_me
            FROM entry_likes el
            JOIN users u ON u.id = el.user_id
            WHERE el.entry_id = $1
        `, [entryId, sessionUserId]);
        res.json({
            count: rows.length,
            liked_by_me: rows.some(r => r.liked_by_me),
            users: rows.map(r => ({ user_id: r.user_id, username: r.username })),
        });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch likes' });
    }
});

// Like an entry
app.post('/api/entries/:id/likes', requireAuth, async (req, res) => {
    const entryId = parseInt(req.params.id);
    try {
        const { rows: entryRows } = await pool.query('SELECT user_id FROM entries WHERE id = $1', [entryId]);
        if (!entryRows[0]) return res.status(404).json({ error: 'Entry not found' });
        if (entryRows[0].user_id === req.userId)
            return res.status(403).json({ error: 'Cannot like your own entry' });

        await pool.query(
            'INSERT INTO entry_likes (entry_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [entryId, req.userId]
        );
        const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM entry_likes WHERE entry_id = $1', [entryId]);
        res.json({ count: rows[0].count });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to like entry' });
    }
});

// Unlike an entry
app.delete('/api/entries/:id/likes', requireAuth, async (req, res) => {
    const entryId = parseInt(req.params.id);
    try {
        await pool.query('DELETE FROM entry_likes WHERE entry_id = $1 AND user_id = $2', [entryId, req.userId]);
        const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM entry_likes WHERE entry_id = $1', [entryId]);
        res.json({ count: rows[0].count });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to unlike entry' });
    }
});

// Forgot password — request reset link
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    // Always respond 200 to prevent email enumeration
    res.json({ message: 'If that email is registered, a reset link has been sent.' });

    if (!email) return;

    try {
        const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (!rows[0]) return;

        const token = cryptoUtils.randomBytes(32).toString('hex');
        await pool.query(
            `INSERT INTO password_reset_tokens (user_id, token, expires_at)
                VALUES ($1, $2, NOW() + INTERVAL '1 day')`,
            [rows[0].id, token]
        );

        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${token}`;

        const mailerSend = new MailerSend({ apiKey: process.env.MAILERSEND_API_KEY || '' });
        const emailParams = new EmailParams()
            .setFrom(new Sender(process.env.MAILERSEND_FROM_EMAIL || 'noreply@example.com', 'Masiboard'))
            .setTo([new Recipient(email)])
            .setSubject('Reset your password')
            .setHtml(`<p>Click the link below to reset your password. This link expires in 24 hours.</p><p><a href="${resetLink}">${resetLink}</a></p>`)
            .setText(`Reset your password by visiting: ${resetLink}\n\nThis link expires in 24 hours.`);

        await mailerSend.email.send(emailParams);
    } catch (err: any) {
        console.error('Forgot password error:', err);
    }
});

// Reset password — verify token and update password
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ message: 'Token and password are required.' });
    }

    try {
        const { rows } = await pool.query(
            `SELECT id, user_id FROM password_reset_tokens
                WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
            [token]
        );
        if (!rows[0]) {
            return res.status(400).json({ message: 'Invalid or expired reset link.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, rows[0].user_id]);
        await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [rows[0].id]);

        res.json({ message: 'Password updated successfully.' });
    } catch (err: any) {
        console.error('Reset password error:', err.message);
        res.status(500).json({ message: 'Failed to reset password.' });
    }
});

// ─── Challenges ───────────────────────────────────────────────────────────────

// List challenges (optional search)
app.get('/api/challenges', async (req, res) => {
    const q = req.query.q as string | undefined;
    try {
        const { rows } = await pool.query(`
            SELECT c.id, c.title, c.start_date, c.end_date, c.created_by,
                   at.name AS activity_type_name,
                   COUNT(DISTINCT cm.user_id) AS member_count
            FROM challenges c
            LEFT JOIN activity_types at ON at.id = c.activity_type_id
            LEFT JOIN challenge_members cm ON cm.challenge_id = c.id
            ${q ? "WHERE LOWER(c.title) LIKE LOWER($1)" : ""}
            GROUP BY c.id, at.name
            ORDER BY c.start_date DESC
        `, q ? [`%${q}%`] : []);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch challenges' });
    }
});

// Get challenge detail (public)
app.get('/api/challenges/:id', async (req, res) => {
    const id = req.params.id;
    const authHeader = req.headers['authorization'] as string | undefined;
    let requestingUserId: number | null = null;
    if (authHeader?.startsWith('Bearer ')) {
        try { requestingUserId = (jwt.verify(authHeader.slice(7), JWT_SECRET) as any).userId; } catch {}
    }
    try {
        const { rows } = await pool.query(`
            SELECT c.*, at.name AS activity_type_name,
                   COUNT(DISTINCT cm.user_id) AS member_count,
                   COALESCE(SUM(e.points), 0) AS total_points
            FROM challenges c
            LEFT JOIN activity_types at ON at.id = c.activity_type_id
            LEFT JOIN challenge_members cm ON cm.challenge_id = c.id
            LEFT JOIN entry_challenges ec ON ec.challenge_id = c.id
            LEFT JOIN entries e ON e.id = ec.entry_id
            WHERE c.id = $1
            GROUP BY c.id, at.name
        `, [id]);
        if (!rows[0]) return res.status(404).json({ error: 'Challenge not found' });
        let is_member = false;
        if (requestingUserId) {
            const { rows: mr } = await pool.query(
                'SELECT 1 FROM challenge_members WHERE challenge_id=$1 AND user_id=$2',
                [id, requestingUserId]
            );
            is_member = mr.length > 0;
        }
        res.json({ ...rows[0], is_member });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch challenge' });
    }
});

// Create challenge
app.post('/api/challenges', requireAuth, async (req, res) => {
    const { title, activity_type_id, start_date, end_date } = req.body;
    if (!title || !start_date || !end_date) return res.status(400).json({ error: 'title, start_date and end_date are required' });
    try {
        const { rows } = await pool.query(
            'INSERT INTO challenges (title, activity_type_id, start_date, end_date, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
            [title, activity_type_id ?? null, start_date, end_date, req.userId]
        );
        res.status(201).json(rows[0]);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create challenge' });
    }
});

// Update challenge (owner only)
app.put('/api/challenges/:id', requireAuth, async (req, res) => {
    const { title, activity_type_id, start_date, end_date } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM challenges WHERE id=$1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Challenge not found' });
        if (rows[0].created_by !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        await pool.query(
            'UPDATE challenges SET title=$1, activity_type_id=$2, start_date=$3, end_date=$4 WHERE id=$5',
            [title, activity_type_id ?? null, start_date, end_date, req.params.id]
        );
        res.json({ ...rows[0], title, activity_type_id: activity_type_id ?? null, start_date, end_date });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update challenge' });
    }
});

// Delete challenge (owner only)
app.delete('/api/challenges/:id', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM challenges WHERE id=$1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Challenge not found' });
        if (rows[0].created_by !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        await pool.query('DELETE FROM challenges WHERE id=$1', [req.params.id]);
        res.json({ message: 'Challenge deleted' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete challenge' });
    }
});

// Join challenge
app.post('/api/challenges/:id/join', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'INSERT INTO challenge_members (challenge_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [req.params.id, req.userId]
        );
        res.json({ message: 'Joined challenge' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to join challenge' });
    }
});

// Leave challenge
app.delete('/api/challenges/:id/join', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM challenge_members WHERE challenge_id=$1 AND user_id=$2',
            [req.params.id, req.userId]
        );
        res.json({ message: 'Left challenge' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to leave challenge' });
    }
});

// Challenge leaderboard (public)
app.get('/api/challenges/:id/leaderboard', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT u.id, u.username,
                   COALESCE(SUM(e.points), 0) AS total_points,
                   RANK() OVER (ORDER BY COALESCE(SUM(e.points), 0) DESC) AS rank
            FROM challenge_members cm
            JOIN users u ON u.id = cm.user_id
            LEFT JOIN entry_challenges ec ON ec.challenge_id = cm.challenge_id
            LEFT JOIN entries e ON e.id = ec.entry_id AND e.user_id = u.id
            WHERE cm.challenge_id = $1
            GROUP BY u.id, u.username
            ORDER BY total_points DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// ─── Teams ────────────────────────────────────────────────────────────────────

// List teams (optional search)
app.get('/api/teams', async (req, res) => {
    const q = req.query.q as string | undefined;
    try {
        const { rows } = await pool.query(`
            SELECT t.id, t.title, t.created_by,
                   at.name AS activity_type_name,
                   COUNT(DISTINCT tm.user_id) AS member_count
            FROM teams t
            LEFT JOIN activity_types at ON at.id = t.activity_type_id
            LEFT JOIN team_members tm ON tm.team_id = t.id
            ${q ? "WHERE LOWER(t.title) LIKE LOWER($1)" : ""}
            GROUP BY t.id, at.name
            ORDER BY t.title ASC
        `, q ? [`%${q}%`] : []);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// Get team detail (public)
app.get('/api/teams/:id', async (req, res) => {
    const id = req.params.id;
    const authHeader = req.headers['authorization'] as string | undefined;
    let requestingUserId: number | null = null;
    if (authHeader?.startsWith('Bearer ')) {
        try { requestingUserId = (jwt.verify(authHeader.slice(7), JWT_SECRET) as any).userId; } catch {}
    }
    try {
        const { rows } = await pool.query(`
            SELECT t.*, at.name AS activity_type_name,
                   COUNT(DISTINCT tm.user_id) AS member_count,
                   COALESCE(SUM(e.points), 0) AS total_points
            FROM teams t
            LEFT JOIN activity_types at ON at.id = t.activity_type_id
            LEFT JOIN team_members tm ON tm.team_id = t.id
            LEFT JOIN entry_teams et ON et.team_id = t.id
            LEFT JOIN entries e ON e.id = et.entry_id
            WHERE t.id = $1
            GROUP BY t.id, at.name
        `, [id]);
        if (!rows[0]) return res.status(404).json({ error: 'Team not found' });
        let is_member = false;
        if (requestingUserId) {
            const { rows: mr } = await pool.query(
                'SELECT 1 FROM team_members WHERE team_id=$1 AND user_id=$2',
                [id, requestingUserId]
            );
            is_member = mr.length > 0;
        }
        res.json({ ...rows[0], is_member });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch team' });
    }
});

// Create team
app.post('/api/teams', requireAuth, async (req, res) => {
    const { title, activity_type_id } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    try {
        const { rows } = await pool.query(
            'INSERT INTO teams (title, activity_type_id, created_by) VALUES ($1,$2,$3) RETURNING *',
            [title, activity_type_id ?? null, req.userId]
        );
        res.status(201).json(rows[0]);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// Update team (owner only)
app.put('/api/teams/:id', requireAuth, async (req, res) => {
    const { title, activity_type_id } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM teams WHERE id=$1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Team not found' });
        if (rows[0].created_by !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        await pool.query('UPDATE teams SET title=$1, activity_type_id=$2 WHERE id=$3', [title, activity_type_id ?? null, req.params.id]);
        res.json({ ...rows[0], title, activity_type_id: activity_type_id ?? null });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update team' });
    }
});

// Delete team (owner only)
app.delete('/api/teams/:id', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM teams WHERE id=$1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Team not found' });
        if (rows[0].created_by !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        await pool.query('DELETE FROM teams WHERE id=$1', [req.params.id]);
        res.json({ message: 'Team deleted' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete team' });
    }
});

// Join team
app.post('/api/teams/:id/join', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'INSERT INTO team_members (team_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [req.params.id, req.userId]
        );
        res.json({ message: 'Joined team' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to join team' });
    }
});

// Leave team
app.delete('/api/teams/:id/join', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM team_members WHERE team_id=$1 AND user_id=$2',
            [req.params.id, req.userId]
        );
        res.json({ message: 'Left team' });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to leave team' });
    }
});

// Team leaderboard (public)
app.get('/api/teams/:id/leaderboard', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT u.id, u.username,
                   COALESCE(SUM(e.points), 0) AS total_points,
                   RANK() OVER (ORDER BY COALESCE(SUM(e.points), 0) DESC) AS rank
            FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            LEFT JOIN entry_teams et ON et.team_id = tm.team_id
            LEFT JOIN entries e ON e.id = et.entry_id AND e.user_id = u.id
            WHERE tm.team_id = $1
            GROUP BY u.id, u.username
            ORDER BY total_points DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Lambda handler — lazy-initializes the DB on first invocation
let initialized = false;

export const handler = async (event: any, context: any) => {
    if (!initialized) {
        await initializeDatabase();
        initialized = true;
    }
    if (event.rawPath) {
        event.rawPath = event.rawPath.replace(/^\/default/, '');
    }
    if (event.requestContext?.http?.path) {
        event.requestContext.http.path = event.requestContext.http.path.replace(/^\/default/, '');
    }
    // Decode base64 body
    if (event.body && event.isBase64Encoded) {
        event.body = Buffer.from(event.body, 'base64').toString('utf8');
        event.isBase64Encoded = false;
    }
    return serverlessHandler(event, context);
};

const serverlessHandler = serverless(app);

// Local development (ts-node / nodemon)
if (process.env.IS_OFFLINE || process.env.NODE_ENV === 'development') {
    const PORT = process.env.PORT || 3000;
    initializeDatabase().then(() => {
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    }).catch(console.error);
}
