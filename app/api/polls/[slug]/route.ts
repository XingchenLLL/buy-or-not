import { getPoll } from '@/lib/polls';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const ownerKey = new URL(request.url).searchParams.get('key') || '';
  const poll = await getPoll(slug, ownerKey);
  if (!poll) return Response.json({ error: '咨询不存在' }, { status: 404 });
  return Response.json(poll);
}
