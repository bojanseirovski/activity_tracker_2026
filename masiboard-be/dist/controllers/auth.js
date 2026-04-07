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
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cryptoUtils = require('crypto');
const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Register
router.post('/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const rows = yield db_1.db.insert(schema_1.users).values({ username, email, password: hashedPassword }).returning({ id: schema_1.users.id });
        const token = jwt.sign({ userId: rows[0].id }, auth_1.JWT_SECRET, { expiresIn: auth_1.JWT_EXPIRES_IN });
        res.status(201).json({ message: 'User registered successfully', token });
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
// Login
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const rows = yield db_1.db.select({
            id: schema_1.users.id,
            username: schema_1.users.username,
            email: schema_1.users.email,
            password: schema_1.users.password,
        }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        const user = rows[0];
        const valid = user && (yield bcrypt.compare(password, user.password));
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id }, auth_1.JWT_SECRET, { expiresIn: auth_1.JWT_EXPIRES_IN });
        res.json({ message: 'Login successful', token, userId: user.id });
    }
    catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to login' });
    }
}));
// Logout
router.post('/logout', auth_1.requireAuth, (_req, res) => {
    res.json({ message: 'Logout successful' });
});
// Forgot password
router.post('/auth/forgot-password', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
    if (!email)
        return;
    try {
        const rows = yield db_1.db.select({ id: schema_1.users.id }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        if (!rows[0])
            return;
        const token = cryptoUtils.randomBytes(32).toString('hex');
        yield db_1.db.insert(schema_1.passwordResetTokens).values({
            userId: rows[0].id,
            token,
            expiresAt: (0, drizzle_orm_1.sql) `NOW() + INTERVAL '1 day'`,
        });
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
// Reset password
router.post('/auth/reset-password', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ message: 'Token and password are required.' });
    }
    try {
        const rows = yield db_1.db.select({
            id: schema_1.passwordResetTokens.id,
            userId: schema_1.passwordResetTokens.userId,
        }).from(schema_1.passwordResetTokens).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.passwordResetTokens.token, token), (0, drizzle_orm_1.gt)(schema_1.passwordResetTokens.expiresAt, (0, drizzle_orm_1.sql) `NOW()`), (0, drizzle_orm_1.isNull)(schema_1.passwordResetTokens.usedAt)));
        if (!rows[0]) {
            return res.status(400).json({ message: 'Invalid or expired reset link.' });
        }
        const hashedPassword = yield bcrypt.hash(password, 10);
        yield db_1.db.update(schema_1.users).set({ password: hashedPassword }).where((0, drizzle_orm_1.eq)(schema_1.users.id, rows[0].userId));
        yield db_1.db.update(schema_1.passwordResetTokens).set({ usedAt: (0, drizzle_orm_1.sql) `NOW()` }).where((0, drizzle_orm_1.eq)(schema_1.passwordResetTokens.id, rows[0].id));
        res.json({ message: 'Password updated successfully.' });
    }
    catch (err) {
        console.error('Reset password error:', err.message);
        res.status(500).json({ message: 'Failed to reset password.' });
    }
}));
exports.default = router;
