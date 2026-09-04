import { env } from 'cloudflare:workers';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  const form = await request.formData();
  const image = form.get('image');
  if (!(image instanceof File)) return Response.json({ error: '请选择图片' }, { status: 400 });
  if (!allowedTypes.has(image.type)) return Response.json({ error: '只支持 JPG、PNG 和 WebP' }, { status: 415 });
  if (image.size > 5 * 1024 * 1024) return Response.json({ error: '图片不能超过 5MB' }, { status: 413 });
  const extension = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
  const key = `polls/${crypto.randomUUID()}.${extension}`;
  await env.FILES.put(key, image.stream(), { httpMetadata: { contentType: image.type } });
  return Response.json({ key }, { status: 201 });
}
