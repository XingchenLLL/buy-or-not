import { getDb } from '@/db';
import { polls } from '@/db/schema';
import { assertFriendlyText, cleanText, hashToken } from '@/lib/polls';

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const title = cleanText(body.title, 80, true);
    const price = cleanText(body.price, 30);
    const description = cleanText(body.description, 500, true);
    const question = cleanText(body.question, 80, true);
    const imageKey = cleanText(body.imageKey, 180);
    assertFriendlyText(title, description, question);
    const rawDeadline = typeof body.deadline === 'number' ? body.deadline : null;
    const deadline = rawDeadline && Number.isFinite(rawDeadline) ? Math.round(rawDeadline) : null;
    const ownerKey = crypto.randomUUID().replaceAll('-', '');
    const slug = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    await getDb().insert(polls).values({ slug, ownerKeyHash: await hashToken(ownerKey), title, price, description, question, imageKey, deadline, createdAt: Date.now() }).run();
    return Response.json({ slug, ownerKey }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '创建失败' }, { status: 400 });
  }
}
