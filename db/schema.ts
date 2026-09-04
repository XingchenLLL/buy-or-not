import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const polls = sqliteTable('polls', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  ownerKeyHash: text('owner_key_hash').notNull(),
  title: text('title').notNull(),
  price: text('price').notNull().default(''),
  description: text('description').notNull(),
  question: text('question').notNull(),
  imageKey: text('image_key').notNull().default(''),
  deadline: integer('deadline'),
  createdAt: integer('created_at').notNull(),
});

export const votes = sqliteTable('votes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pollId: integer('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
  guestTokenHash: text('guest_token_hash').notNull(),
  nickname: text('nickname').notNull(),
  choice: text('choice', { enum: ['yes', 'maybe', 'no'] }).notNull(),
  comment: text('comment').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  uniqueIndex('idx_votes_poll_guest').on(table.pollId, table.guestTokenHash),
  index('idx_votes_poll_created').on(table.pollId, table.createdAt),
]);
