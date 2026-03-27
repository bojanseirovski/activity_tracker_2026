"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.images = exports.userPreferences = exports.entryTeams = exports.entryChallenges = exports.teamMembers = exports.challengeMembers = exports.teams = exports.challenges = exports.passwordResetTokens = exports.entryLikes = exports.entries = exports.activityTypes = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// ── Users ──────────────────────────────────────────────────────────────
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    username: (0, pg_core_1.text)('username').unique().notNull(),
    email: (0, pg_core_1.text)('email').unique().notNull(),
    password: (0, pg_core_1.text)('password').notNull(),
    profileImagePublic: (0, pg_core_1.boolean)('profile_image_public').default(true).notNull(),
});
// ── Activity Types ─────────────────────────────────────────────────────
exports.activityTypes = (0, pg_core_1.pgTable)('activity_types', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.text)('name').unique().notNull(),
    createdBy: (0, pg_core_1.integer)('created_by').references(() => exports.users.id),
});
// ── Entries ─────────────────────────────────────────────────────────────
exports.entries = (0, pg_core_1.pgTable)('entries', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.text)('name').notNull(),
    points: (0, pg_core_1.integer)('points').notNull(),
    date: (0, pg_core_1.text)('date').notNull(),
    activityTypeId: (0, pg_core_1.integer)('activity_type_id').references(() => exports.activityTypes.id),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id),
});
// ── Entry Likes ─────────────────────────────────────────────────────────
exports.entryLikes = (0, pg_core_1.pgTable)('entry_likes', {
    entryId: (0, pg_core_1.integer)('entry_id').notNull().references(() => exports.entries.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.entryId, table.userId] }),
]);
// ── Password Reset Tokens ───────────────────────────────────────────────
exports.passwordResetTokens = (0, pg_core_1.pgTable)('password_reset_tokens', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }),
    token: (0, pg_core_1.text)('token').unique().notNull(),
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }).notNull(),
    usedAt: (0, pg_core_1.timestamp)('used_at', { withTimezone: true }),
});
// ── Challenges ──────────────────────────────────────────────────────────
exports.challenges = (0, pg_core_1.pgTable)('challenges', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    title: (0, pg_core_1.text)('title').notNull(),
    activityTypeId: (0, pg_core_1.integer)('activity_type_id').references(() => exports.activityTypes.id),
    startDate: (0, pg_core_1.text)('start_date').notNull(),
    endDate: (0, pg_core_1.text)('end_date').notNull(),
    createdBy: (0, pg_core_1.integer)('created_by').references(() => exports.users.id, { onDelete: 'set null' }),
});
// ── Teams ───────────────────────────────────────────────────────────────
exports.teams = (0, pg_core_1.pgTable)('teams', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    title: (0, pg_core_1.text)('title').notNull(),
    activityTypeId: (0, pg_core_1.integer)('activity_type_id').references(() => exports.activityTypes.id),
    createdBy: (0, pg_core_1.integer)('created_by').references(() => exports.users.id, { onDelete: 'set null' }),
});
// ── Challenge Members ───────────────────────────────────────────────────
exports.challengeMembers = (0, pg_core_1.pgTable)('challenge_members', {
    challengeId: (0, pg_core_1.integer)('challenge_id').notNull().references(() => exports.challenges.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.challengeId, table.userId] }),
]);
// ── Team Members ────────────────────────────────────────────────────────
exports.teamMembers = (0, pg_core_1.pgTable)('team_members', {
    teamId: (0, pg_core_1.integer)('team_id').notNull().references(() => exports.teams.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.teamId, table.userId] }),
]);
// ── Entry ↔ Challenges ─────────────────────────────────────────────────
exports.entryChallenges = (0, pg_core_1.pgTable)('entry_challenges', {
    entryId: (0, pg_core_1.integer)('entry_id').notNull().references(() => exports.entries.id, { onDelete: 'cascade' }),
    challengeId: (0, pg_core_1.integer)('challenge_id').notNull().references(() => exports.challenges.id, { onDelete: 'cascade' }),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.entryId, table.challengeId] }),
]);
// ── Entry ↔ Teams ───────────────────────────────────────────────────────
exports.entryTeams = (0, pg_core_1.pgTable)('entry_teams', {
    entryId: (0, pg_core_1.integer)('entry_id').notNull().references(() => exports.entries.id, { onDelete: 'cascade' }),
    teamId: (0, pg_core_1.integer)('team_id').notNull().references(() => exports.teams.id, { onDelete: 'cascade' }),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.entryId, table.teamId] }),
]);
// ── User Preferences ───────────────────────────────────────────────────
exports.userPreferences = (0, pg_core_1.pgTable)('user_preferences', {
    userId: (0, pg_core_1.integer)('user_id').primaryKey().references(() => exports.users.id, { onDelete: 'cascade' }),
    unit: (0, pg_core_1.text)('unit').notNull().default('km'),
});
// ── Images ──────────────────────────────────────────────────────────────
exports.images = (0, pg_core_1.pgTable)('images', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    entityType: (0, pg_core_1.text)('entity_type').notNull(),
    entityId: (0, pg_core_1.integer)('entity_id').notNull(),
    s3Key: (0, pg_core_1.text)('s3_key').notNull(),
    url: (0, pg_core_1.text)('url').notNull(),
    uploadedBy: (0, pg_core_1.integer)('uploaded_by').references(() => exports.users.id, { onDelete: 'set null' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
