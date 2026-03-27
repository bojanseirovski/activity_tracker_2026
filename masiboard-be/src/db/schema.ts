import { pgTable, serial, text, integer, timestamp, primaryKey, boolean } from 'drizzle-orm/pg-core';

// ── Users ──────────────────────────────────────────────────────────────
export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    username: text('username').unique().notNull(),
    email: text('email').unique().notNull(),
    password: text('password').notNull(),
    profileImagePublic: boolean('profile_image_public').default(true).notNull(),
});

// ── Activity Types ─────────────────────────────────────────────────────
export const activityTypes = pgTable('activity_types', {
    id: serial('id').primaryKey(),
    name: text('name').unique().notNull(),
    createdBy: integer('created_by').references(() => users.id),
});

// ── Entries ─────────────────────────────────────────────────────────────
export const entries = pgTable('entries', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    points: integer('points').notNull(),
    date: text('date').notNull(),
    activityTypeId: integer('activity_type_id').references(() => activityTypes.id),
    userId: integer('user_id').references(() => users.id),
});

// ── Entry Likes ─────────────────────────────────────────────────────────
export const entryLikes = pgTable('entry_likes', {
    entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => [
    primaryKey({ columns: [table.entryId, table.userId] }),
]);

// ── Password Reset Tokens ───────────────────────────────────────────────
export const passwordResetTokens = pgTable('password_reset_tokens', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').unique().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
});

// ── Challenges ──────────────────────────────────────────────────────────
export const challenges = pgTable('challenges', {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    activityTypeId: integer('activity_type_id').references(() => activityTypes.id),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
});

// ── Teams ───────────────────────────────────────────────────────────────
export const teams = pgTable('teams', {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    activityTypeId: integer('activity_type_id').references(() => activityTypes.id),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
});

// ── Challenge Members ───────────────────────────────────────────────────
export const challengeMembers = pgTable('challenge_members', {
    challengeId: integer('challenge_id').notNull().references(() => challenges.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => [
    primaryKey({ columns: [table.challengeId, table.userId] }),
]);

// ── Team Members ────────────────────────────────────────────────────────
export const teamMembers = pgTable('team_members', {
    teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => [
    primaryKey({ columns: [table.teamId, table.userId] }),
]);

// ── Entry ↔ Challenges ─────────────────────────────────────────────────
export const entryChallenges = pgTable('entry_challenges', {
    entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
    challengeId: integer('challenge_id').notNull().references(() => challenges.id, { onDelete: 'cascade' }),
}, (table) => [
    primaryKey({ columns: [table.entryId, table.challengeId] }),
]);

// ── Entry ↔ Teams ───────────────────────────────────────────────────────
export const entryTeams = pgTable('entry_teams', {
    entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
    teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
}, (table) => [
    primaryKey({ columns: [table.entryId, table.teamId] }),
]);

// ── User Preferences ───────────────────────────────────────────────────
export const userPreferences = pgTable('user_preferences', {
    userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    unit: text('unit').notNull().default('km'),
});

// ── Images ──────────────────────────────────────────────────────────────
export const images = pgTable('images', {
    id: serial('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    s3Key: text('s3_key').notNull(),
    url: text('url').notNull(),
    uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
