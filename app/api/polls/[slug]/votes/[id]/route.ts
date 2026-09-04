import { getPoll, isOwner, removeVote } from '@/lib/polls';

export async function DELETE(request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await context.params;
  const ownerKey = new URL(request.url).searchParams.get('key') || '';
  if (!await isOwner(slug, ownerKey)) return Response.json({ error: '无权删除' }, { status: 403 });
  await removeVote(slug, Number(id));
  return Response.json({ poll: await getPoll(slug, ownerKey) });
}
