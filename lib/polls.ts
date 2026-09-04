import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { polls, votes } from '@/db/schema';

export type Choice = 'yes' | 'maybe' | 'no';

export async function hashToken(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function cleanText(value: unknown, max: number, required = false) {
  const textValue = typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '') : '';
  if (required && !textValue) throw new Error('请把必填内容补充完整');
  if (textValue.length > max) throw new Error('填写的内容太长了');
  return textValue;
}

export function assertFriendlyText(...values: string[]) {
  const unsafe = /(身份证|银行卡|支付密码|验证码|裸照|代开发票|枪支|毒品)/i;
  if (unsafe.test(values.join(' '))) throw new Error('内容中包含不适合公开分享的信息');
}

export async function getPoll(slug: string, ownerKey = '') {
  const db = getDb();
  const poll = await db.select().from(polls).where(eq(polls.slug, slug)).get();
  if (!poll) return null;
  const voteRows = await db.select().from(votes).where(eq(votes.pollId, poll.id)).orderBy(desc(votes.updatedAt)).all();
  const counts: Record<Choice, number> = { yes: 0, maybe: 0, no: 0 };
  for (const vote of voteRows) counts[vote.choice] += 1;
  const isOwner = ownerKey ? (await hashToken(ownerKey)) === poll.ownerKeyHash : false;
  return {
    slug: poll.slug, title: poll.title, price: poll.price, description: poll.description,
    question: poll.question,
    imageUrl: poll.imageKey ? `/api/files/${encodeURIComponent(poll.imageKey)}` : '/demo/headphones.png',
    deadline: poll.deadline, createdAt: poll.createdAt, counts, total: voteRows.length,
    votes: voteRows.map((vote) => ({ id: vote.id, nickname: vote.nickname, choice: vote.choice, comment: vote.comment, createdAt: vote.updatedAt })),
    isOwner,
  };
}

export async function findPollRecord(slug: string) {
  return getDb().select().from(polls).where(eq(polls.slug, slug)).get();
}

export async function isOwner(slug: string, ownerKey: string) {
  if (!ownerKey) return false;
  const row = await findPollRecord(slug);
  return Boolean(row && row.ownerKeyHash === await hashToken(ownerKey));
}

export async function removeVote(slug: string, voteId: number) {
  const poll = await findPollRecord(slug);
  if (!poll) return false;
  await getDb().delete(votes).where(and(eq(votes.id, voteId), eq(votes.pollId, poll.id))).run();
  return true;
}
