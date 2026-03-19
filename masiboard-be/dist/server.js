var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const cryptoUtils = require('crypto');
const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true
}));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
function initializeDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        yield pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);
        yield pool.query(`
        CREATE TABLE IF NOT EXISTS activity_types (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            created_by INTEGER REFERENCES users(id)
        )
    `);
        yield pool.query(`
        CREATE TABLE IF NOT EXISTS entries (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            points INTEGER NOT NULL,
            date TEXT NOT NULL,
            activity_type_id INTEGER REFERENCES activity_types(id),
            user_id INTEGER REFERENCES users(id)
        )
    `);
        yield pool.query(`
        CREATE TABLE IF NOT EXISTS entry_likes (
            entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
            user_id  INTEGER REFERENCES users(id)  ON DELETE CASCADE,
            PRIMARY KEY (entry_id, user_id)
        )
    `);
        yield pool.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
            token      TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at    TIMESTAMPTZ
        )
    `);
        console.log('Database initialized');
    });
}
// API Routes
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    next();
}
const ALLOWED_SORT_COLS = new Set(['date', 'points', 'activity_type']);
function buildOrderClause(sort, order) {
    const col = ALLOWED_SORT_COLS.has(sort) ? sort : 'points';
    const dir = (order === null || order === void 0 ? void 0 : order.toLowerCase()) === 'asc' ? 'ASC' : 'DESC';
    const sqlCol = col === 'activity_type' ? 'at.name' : `e.${col}`;
    return `ORDER BY ${sqlCol} ${dir}`;
}
// Activity Types routes
app.get('/api/activity-types', (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { rows } = yield pool.query('SELECT * FROM activity_types ORDER BY name ASC');
        res.json(rows);
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch activity types' });
    }
}));
app.get('/api/activity-types/:id', (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { rows } = yield pool.query('SELECT * FROM activity_types WHERE id = $1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ error: 'Activity type not found' });
        res.json(rows[0]);
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch activity type' });
    }
}));
app.post('/api/activity-types', requireAuth, (req, res) => __awaiter(this, void 0, void 0, function* () {
    const { name } = req.body;
    if (!name)
        return res.status(400).json({ error: 'Name is required' });
    try {
        const { rows } = yield pool.query('INSERT INTO activity_types (name, created_by) VALUES ($1, $2) RETURNING id', [name, req.session.userId]);
        res.status(201).json({ id: rows[0].id, name });
    }
    catch (err) {
        if (err.code === '23505')
            return res.status(400).json({ error: 'Activity type already exists' });
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create activity type' });
    }
}));
app.put('/api/activity-types/:id', requireAuth, (req, res) => __awaiter(this, void 0, void 0, function* () {
    const { name } = req.body;
    if (!name)
        return res.status(400).json({ error: 'Name is required' });
    try {
        const { rows } = yield pool.query('SELECT * FROM activity_types WHERE id = $1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ error: 'Activity type not found' });
        if (rows[0].created_by !== req.session.userId)
            return res.status(403).json({ error: 'Forbidden' });
        yield pool.query('UPDATE activity_types SET name = $1 WHERE id = $2', [name, req.params.id]);
        res.json({ id: Number(req.params.id), name });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update activity type' });
    }
}));
app.delete('/api/activity-types/:id', requireAuth, (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { rows } = yield pool.query('SELECT * FROM activity_types WHERE id = $1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ error: 'Activity type not found' });
        if (rows[0].created_by !== req.session.userId)
            return res.status(403).json({ error: 'Forbidden' });
        yield pool.query('DELETE FROM activity_types WHERE id = $1', [req.params.id]);
        res.json({ message: 'Activity type deleted successfully' });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete activity type' });
    }
}));
// Register endpoint
app.post('/api/register', (req, res) => __awaiter(this, void 0, void 0, function* () {
    var _a, _b;
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
        const hashedPassword = yield bcrypt.hash(password, 10);
        const { rows } = yield pool.query('INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id', [username, email, hashedPassword]);
        req.session.userId = rows[0].id;
        req.session.username = username;
        res.status(201).json({ message: 'User registered successfully', sessionId: req.session.id });
    }
    catch (err) {
        if (err.code === '23505') {
            if ((_a = err.constraint) === null || _a === void 0 ? void 0 : _a.includes('email'))
                return res.status(400).json({ error: 'Email already exists' });
            if ((_b = err.constraint) === null || _b === void 0 ? void 0 : _b.includes('username'))
                return res.status(400).json({ error: 'Username already exists' });
        }
        console.error(err.message);
        res.status(500).json({ error: 'Failed to register user' });
    }
}));
// Login endpoint
app.post('/api/login', (req, res) => __awaiter(this, void 0, void 0, function* () {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const { rows } = yield pool.query('SELECT id, username, email, password FROM users WHERE email = $1', [email]);
        const user = rows[0];
        const valid = user && (yield bcrypt.compare(password, user.password));
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.email = user.email;
        res.json({ message: 'Login successful', sessionId: req.session.id, userId: user.id });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to login' });
    }
}));
// Logout endpoint
app.post('/api/logout', requireAuth, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ message: 'Logout successful' });
    });
});
// Current user profile
app.get('/api/user/me', requireAuth, (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { rows } = yield pool.query(`
            SELECT u.id, u.username, u.email,
                    COUNT(e.id) AS "totalEntries",
                    COALESCE(SUM(e.points), 0) AS "totalPoints"
            FROM users u
            LEFT JOIN entries e ON e.user_id = u.id
            WHERE u.id = $1
            GROUP BY u.id
        `, [req.session.userId]);
        if (!rows[0])
            return res.status(404).json({ error: 'User not found' });
        res.json({
            id: rows[0].id,
            username: rows[0].username,
            email: rows[0].email,
            totalEntries: rows[0].totalEntries,
            totalPoints: rows[0].totalPoints,
        });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Database error' });
    }
}));
// Public user profile
app.get('/api/users/:id', (req, res) => __awaiter(this, void 0, void 0, function* () {
    var _a, _b;
    const userId = parseInt(req.params.id);
    if (isNaN(userId))
        return res.status(400).json({ error: 'Invalid user id' });
    try {
        const { rows } = yield pool.query(`
            SELECT u.username, COUNT(e.id) AS total_entries
            FROM users u
            LEFT JOIN entries e ON e.user_id = u.id
            WHERE u.id = $1
            GROUP BY u.id
        `, [userId]);
        if (!rows[0])
            return res.status(404).json({ error: 'User not found' });
        const { rows: rankRows } = yield pool.query(`
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
        const { rows: actRows } = yield pool.query(`
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
            position: (_b = (_a = rankRows[0]) === null || _a === void 0 ? void 0 : _a.position) !== null && _b !== void 0 ? _b : 0,
            last_activity_types: actRows.map(r => r.name),
        });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
}));
// Create entry
app.post('/api/entries', requireAuth, (req, res) => __awaiter(this, void 0, void 0, function* () {
    const { name, points, date, activity_type_id } = req.body;
    try {
        const { rows } = yield pool.query('INSERT INTO entries (name, points, date, activity_type_id, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id', [name, points, date, activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null, req.session.userId]);
        res.status(201).json({ id: rows[0].id, name, points, date, activity_type_id: activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null, user_id: req.session.userId });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to insert entry' });
    }
}));
// Leaderboard
app.get('/api/leaderboard', (req, res) => __awaiter(this, void 0, void 0, function* () {
    var _a;
    const page = parseInt(req.query.page || '1', 10);
    const limit = 10;
    const offset = (page - 1) * limit;
    const orderClause = buildOrderClause(req.query.sort, req.query.order);
    try {
        const sessionUserId = (_a = req.session.userId) !== null && _a !== void 0 ? _a : null;
        const { rows } = yield pool.query(`
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
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
}));
// Top performers
app.get('/api/top-performers', (req, res) => __awaiter(this, void 0, void 0, function* () {
    var _a;
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
    const dir = ((_a = req.query.order) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'asc' ? 'ASC' : 'DESC';
    try {
        const { rows } = yield pool.query(`
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
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch top performers' });
    }
}));
// Search entries
app.get('/api/search', (req, res) => __awaiter(this, void 0, void 0, function* () {
    const query = req.query.q || '';
    const orderClause = buildOrderClause(req.query.sort, req.query.order);
    try {
        const { rows } = yield pool.query(`
            SELECT e.*, at.name AS activity_type
            FROM entries e
            LEFT JOIN activity_types at ON at.id = e.activity_type_id
            WHERE e.name ILIKE $1
            ${orderClause}
        `, [`%${query}%`]);
        res.json(rows);
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to search entries' });
    }
}));
// Get a single entry by ID
app.get('/api/entries/:id', (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { rows } = yield pool.query(`
            SELECT e.*, at.name AS activity_type
            FROM entries e
            LEFT JOIN activity_types at ON at.id = e.activity_type_id
            WHERE e.id = $1
        `, [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ error: 'Entry not found' });
        res.json(rows[0]);
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch entry' });
    }
}));
// Update an entry by ID
app.put('/api/entries/:id', requireAuth, (req, res) => __awaiter(this, void 0, void 0, function* () {
    const id = req.params.id;
    const { name, points, date, activity_type_id } = req.body;
    try {
        const result = yield pool.query('UPDATE entries SET name = $1, points = $2, date = $3, activity_type_id = $4 WHERE id = $5', [name, points, date, activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null, id]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Entry not found' });
        res.json({ id, name, points, date, activity_type_id: activity_type_id !== null && activity_type_id !== void 0 ? activity_type_id : null });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update entry' });
    }
}));
// Delete an entry by ID
app.delete('/api/entries/:id', requireAuth, (req, res) => __awaiter(this, void 0, void 0, function* () {
    const id = req.params.id;
    try {
        const result = yield pool.query('DELETE FROM entries WHERE id = $1', [id]);
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
app.get('/api/entries/:id/likes', (req, res) => __awaiter(this, void 0, void 0, function* () {
    var _a;
    const entryId = parseInt(req.params.id);
    const sessionUserId = (_a = req.session.userId) !== null && _a !== void 0 ? _a : null;
    try {
        const { rows } = yield pool.query(`
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
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch likes' });
    }
}));
// Like an entry
app.post('/api/entries/:id/likes', requireAuth, (req, res) => __awaiter(this, void 0, void 0, function* () {
    const entryId = parseInt(req.params.id);
    try {
        const { rows: entryRows } = yield pool.query('SELECT user_id FROM entries WHERE id = $1', [entryId]);
        if (!entryRows[0])
            return res.status(404).json({ error: 'Entry not found' });
        if (entryRows[0].user_id === req.session.userId)
            return res.status(403).json({ error: 'Cannot like your own entry' });
        yield pool.query('INSERT INTO entry_likes (entry_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [entryId, req.session.userId]);
        const { rows } = yield pool.query('SELECT COUNT(*)::int AS count FROM entry_likes WHERE entry_id = $1', [entryId]);
        res.json({ count: rows[0].count });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to like entry' });
    }
}));
// Unlike an entry
app.delete('/api/entries/:id/likes', requireAuth, (req, res) => __awaiter(this, void 0, void 0, function* () {
    const entryId = parseInt(req.params.id);
    try {
        yield pool.query('DELETE FROM entry_likes WHERE entry_id = $1 AND user_id = $2', [entryId, req.session.userId]);
        const { rows } = yield pool.query('SELECT COUNT(*)::int AS count FROM entry_likes WHERE entry_id = $1', [entryId]);
        res.json({ count: rows[0].count });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to unlike entry' });
    }
}));
// Forgot password — request reset link
app.post('/api/auth/forgot-password', (req, res) => __awaiter(this, void 0, void 0, function* () {
    const { email } = req.body;
    // Always respond 200 to prevent email enumeration
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
    if (!email)
        return;
    try {
        const { rows } = yield pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (!rows[0])
            return;
        const token = cryptoUtils.randomBytes(32).toString('hex');
        yield pool.query(`INSERT INTO password_reset_tokens (user_id, token, expires_at)
                VALUES ($1, $2, NOW() + INTERVAL '1 day')`, [rows[0].id, token]);
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${token}`;
        const mailerSend = new MailerSend({ apiKey: process.env.MAILERSEND_API_KEY || '' });
        const emailParams = new EmailParams()
            .setFrom(new Sender(process.env.MAILERSEND_FROM_EMAIL || 'noreply@example.com', 'Masiboard'))
            .setTo([new Recipient(email)])
            .setSubject('Reset your password')
            .setHtml(`<p>Click the link below to reset your password. This link expires in 24 hours.</p><p><a href="${resetLink}">${resetLink}</a></p>`)
            .setText(`Reset your password by visiting: ${resetLink}\n\nThis link expires in 24 hours.`);
        yield mailerSend.email.send(emailParams);
    }
    catch (err) {
        console.error('Forgot password error:', err);
    }
}));
// Reset password — verify token and update password
app.post('/api/auth/reset-password', (req, res) => __awaiter(this, void 0, void 0, function* () {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ message: 'Token and password are required.' });
    }
    try {
        const { rows } = yield pool.query(`SELECT id, user_id FROM password_reset_tokens
                WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`, [token]);
        if (!rows[0]) {
            return res.status(400).json({ message: 'Invalid or expired reset link.' });
        }
        const hashedPassword = yield bcrypt.hash(password, 10);
        yield pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, rows[0].user_id]);
        yield pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [rows[0].id]);
        res.json({ message: 'Password updated successfully.' });
    }
    catch (err) {
        console.error('Reset password error:', err.message);
        res.status(500).json({ message: 'Failed to reset password.' });
    }
}));
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});
const PORT = process.env.PORT || 3000;
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        yield initializeDatabase();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    });
}
start().catch(console.error);
