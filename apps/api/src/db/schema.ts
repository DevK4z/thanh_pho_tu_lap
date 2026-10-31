import { sql } from 'drizzle-orm';
import { type AnyPgColumn, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { ActKey, HouseStyle, Mode, PendingReward, PlotItem, Provider, QuitReason } from '@tptl/shared';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  provider: text('provider').$type<Provider>().notNull(),
  /** id tài khoản bên Google/Facebook; null với tài khoản khách. */
  providerSub: text('provider_sub'),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  currentGroupId: uuid('current_group_id').references((): AnyPgColumn => groups.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('users_provider_sub_key').on(t.provider, t.providerSub)]);

/** Phiên đăng nhập: chỉ lưu SHA-256 của token. */
export const authSessions = pgTable('auth_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
}, (t) => [index('auth_sessions_user_idx').on(t.userId)]);

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** Tên chuẩn hóa (chữ thường, gộp khoảng trắng) để chặn trùng tên. */
  nameKey: text('name_key').notNull().unique(),
  ownerId: uuid('owner_id').notNull().references((): AnyPgColumn => users.id),
  createdAt: ts('created_at').notNull().defaultNow(),
});

/** Thành phố của một người trong một nhóm. */
export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  style: text('style').$type<HouseStyle>().notNull(),
  dailyGoal: integer('daily_goal').notNull(),
  totalFocusMin: integer('total_focus_min').notNull().default(0),
  plot: jsonb('plot').$type<PlotItem[]>().notNull().default([]),
  pending: jsonb('pending').$type<PendingReward[]>().notNull().default([]),
  quitReasons: jsonb('quit_reasons').$type<Partial<Record<QuitReason, number>>>().notNull().default({}),
  gold: integer('gold').notNull().default(0),
  wood: integer('wood').notNull().default(0),
  /** Phiên thành công liên tiếp; về 0 khi thất bại. */
  currentStreak: integer('current_streak').notNull().default(0),
  bestStreak: integer('best_streak').notNull().default(0),
  tasksDone: integer('tasks_done').notNull().default(0),
  tasksFailed: integer('tasks_failed').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastAt: ts('last_at'),
}, (t) => [uniqueIndex('players_group_user_key').on(t.groupId, t.userId)]);

export const dayStats = pgTable('day_stats', {
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  day: text('day').notNull(),
  s: integer('s').notNull().default(0),
  c: integer('c').notNull().default(0),
  q: integer('q').notNull().default(0),
  pl: integer('pl').notNull().default(0),
  ac: integer('ac').notNull().default(0),
  cs: integer('cs').notNull().default(0),
  aw: integer('aw').notNull().default(0),
  dn: integer('dn').notNull().default(0),
  ms: integer('ms').notNull().default(0),
  qa: integer('qa').notNull().default(0),
  qc: integer('qc').notNull().default(0),
  fs: integer('fs').notNull().default(0),
  fn: integer('fn').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.playerId, t.day] })]);

/** Câu hỏi đã phát cho một phiên, kèm đáp án đúng (không bao giờ gửi xuống trình duyệt). */
export interface StoredQuestion { id: string; q: string; o: string[]; a: number; ans?: number }
export interface SessionQuestions { checks: StoredQuestion[]; verify: StoredQuestion[] }

export const focusSessions = pgTable('focus_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  act: text('act').$type<ActKey>().notNull(),
  mode: text('mode').$type<Mode>().notNull(),
  plannedSec: integer('planned_sec').notNull(),
  goal: text('goal').notNull().default(''),
  day: text('day').notNull(),
  startedAt: ts('started_at').notNull().defaultNow(),
  endedAt: ts('ended_at'),
  status: text('status').$type<'active' | 'done' | 'quit'>().notNull().default('active'),
  reason: text('reason').$type<QuitReason>(),
  activeSec: integer('active_sec').notNull().default(0),
  awaySec: integer('away_sec').notNull().default(0),
  dist: integer('dist').notNull().default(0),
  missed: integer('missed').notNull().default(0),
  qa: integer('qa').notNull().default(0),
  qc: integer('qc').notNull().default(0),
  focus: integer('focus'),
  self: integer('self'),
  note: text('note').notNull().default(''),
  questions: jsonb('questions').$type<SessionQuestions>().notNull(),
}, (t) => [
  index('focus_sessions_player_idx').on(t.playerId, t.startedAt),
  // Mỗi người chỉ có tối đa một phiên đang chạy.
  uniqueIndex('focus_sessions_one_active').on(t.playerId).where(sql`${t.status} = 'active'`),
]);

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  act: text('act').$type<ActKey | 'all'>().notNull(),
  q: text('q').notNull(),
  options: jsonb('options').$type<string[]>().notNull(),
  answer: integer('answer').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('questions_group_idx').on(t.groupId)]);
