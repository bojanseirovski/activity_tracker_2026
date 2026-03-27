import { Router } from 'express';
import { eq, and, gt, isNull, sql } from 'drizzle-orm';
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cryptoUtils = require('crypto');
const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');
import { db } from '../db';
import { users, passwordResetTokens } from '../db/schema';
import { requireAuth, JWT_SECRET, JWT_EXPIRES_IN } from '../middleware/auth';

const router = Router();

// Register
router.post('/register', async (req, res) => {
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
        const rows = await db.insert(users).values({ username, email, password: hashedPassword }).returning({ id: users.id });
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

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const rows = await db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            password: users.password,
        }).from(users).where(eq(users.email, email));
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

// Logout
router.post('/logout', requireAuth, (_req, res) => {
    res.json({ message: 'Logout successful' });
});

// Forgot password
router.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    res.json({ message: 'If that email is registered, a reset link has been sent.' });

    if (!email) return;

    try {
        const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
        if (!rows[0]) return;

        const token = cryptoUtils.randomBytes(32).toString('hex');
        await db.insert(passwordResetTokens).values({
            userId: rows[0].id,
            token,
            expiresAt: sql`NOW() + INTERVAL '1 day'`,
        });

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

// Reset password
router.post('/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ message: 'Token and password are required.' });
    }

    try {
        const rows = await db.select({
            id: passwordResetTokens.id,
            userId: passwordResetTokens.userId,
        }).from(passwordResetTokens).where(
            and(
                eq(passwordResetTokens.token, token),
                gt(passwordResetTokens.expiresAt, sql`NOW()`),
                isNull(passwordResetTokens.usedAt),
            )
        );
        if (!rows[0]) {
            return res.status(400).json({ message: 'Invalid or expired reset link.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, rows[0].userId!));
        await db.update(passwordResetTokens).set({ usedAt: sql`NOW()` }).where(eq(passwordResetTokens.id, rows[0].id));

        res.json({ message: 'Password updated successfully.' });
    } catch (err: any) {
        console.error('Reset password error:', err.message);
        res.status(500).json({ message: 'Failed to reset password.' });
    }
});

export default router;
