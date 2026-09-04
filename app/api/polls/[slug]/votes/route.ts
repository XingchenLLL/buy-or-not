import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { votes } from '@/db/schema';
import { assertFriendlyText, cleanText, findPollRecord, getPoll, hashToken, type Choice } from '@/lib/polls';

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const poll = await findPollRecord(slug);
    if (!poll) return Response.json({ error: '咨询不存在' }, { status: 404 });
    if (poll.deadline && poll.deadline < Date.now()) return Response.json({ error: '这个咨询已经结束' }, { status: 409 });
    const body = await request.json() as Record<string, unknown>;
    const choice = body.choice as Choice;
    if (!['yes', 'maybe', 'no'].includes(choice)) throw new Error('请选择有效的意见');
    const nickname = cleanText(body.nickname, 20, true);
    const comment = cleanText(body.comment, 240);
    const guestToken = cleanText(body.guestToken, 100, true);
    assertFriendlyText(nickname, comment);
    const guestTokenHash = await hashToken(guestToken);
    const now = Date.now();
    const current = await getDb().select().from(votes).where(and(eq(votes.pollId, poll.id), eq(votes.guestTokenHash, guestTokenHash))).get();
    if (current) await getDb().update(votes).set({ choice, nickname, comment, updatedAt: now }).where(eq(votes.id, current.id)).run();
    else await getDb().insert(votes).values({ pollId: poll.id, guestTokenHash, nickname, choice, comment, createdAt: now, updatedAt: now }).run();
    return Response.json({ poll: await getPoll(slug) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '投票失败' }, { status: 400 });
  }
}
