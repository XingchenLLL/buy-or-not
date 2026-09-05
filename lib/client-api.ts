export type Choice = 'yes' | 'maybe' | 'no';

export type ClientVote = {
  id: string | number;
  nickname: string;
  choice: Choice;
  comment: string;
  createdAt: number;
};

export type ClientPoll = {
  slug: string;
  title: string;
  price: string;
  description: string;
  question: string;
  imageUrl: string;
  deadline: number | null;
  createdAt: number;
  counts: Record<Choice, number>;
  total: number;
  votes: ClientVote[];
  isOwner?: boolean;
};

type CreatePollInput = {
  title: FormDataEntryValue | null;
  price: FormDataEntryValue | null;
  description: FormDataEntryValue | null;
  question: FormDataEntryValue | null;
  imageKey: string;
  deadline: number;
};

type VoteInput = {
  choice: Choice;
  nickname: string;
  comment: string;
  guestToken: string;
};

type CloudBaseResult<T> = { ok: true; data: T } | { ok: false; error: string };

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const cloudBaseConfig = {
  envId: env?.VITE_TCB_ENV_ID?.trim() || '',
  region: env?.VITE_TCB_REGION?.trim() || 'ap-shanghai',
  accessKey: env?.VITE_TCB_ACCESS_KEY?.trim() || '',
  functionName: env?.VITE_TCB_FUNCTION_NAME?.trim() || 'buy-or-not-api',
};

type CloudBaseApp = {
  auth: ((options?: { persistence: 'local' }) => {
    getSession: () => Promise<{ data?: { session?: unknown }; error?: { message?: string } | null }>;
    signInAnonymously: () => Promise<{ data?: unknown; error?: { message?: string } | null }>;
  });
  callFunction: (options: {
    name: string;
    data: Record<string, unknown>;
    parse: boolean;
  }) => Promise<{ result: unknown }>;
  uploadFile: (options: { cloudPath: string; filePath: string }) => Promise<{ fileID: string }>;
};

let appPromise: Promise<CloudBaseApp> | null = null;

function isCloudBaseConfigured() {
  return Boolean(cloudBaseConfig.envId);
}

async function getCloudBaseApp() {
  if (!cloudBaseConfig.envId || !cloudBaseConfig.accessKey) {
    throw new Error('腾讯云环境尚未配置，请填写 CloudBase 环境 ID 和 Publishable Key');
  }

  if (!appPromise) {
    appPromise = (async () => {
      const { default: Cloudbase } = await import('@cloudbase/js-sdk');
      const app = Cloudbase.init({
        env: cloudBaseConfig.envId,
        region: cloudBaseConfig.region,
        accessKey: cloudBaseConfig.accessKey,
        auth: { detectSessionInUrl: true },
      });
      const auth = app.auth({ persistence: 'local' });
      const session = await auth.getSession();
      if (session.error || !session.data?.session) {
        const login = await auth.signInAnonymously();
        if (login.error) throw new Error(login.error.message || '匿名访问初始化失败');
      }
      return app as unknown as CloudBaseApp;
    })();
  }

  return appPromise;
}

async function callCloudBase<T>(operation: string, payload: Record<string, unknown> = {}) {
  const app = await getCloudBaseApp();
  const response = await app.callFunction({
    name: cloudBaseConfig.functionName,
    data: { operation, ...payload },
    parse: true,
  });
  const result = (typeof response.result === 'string'
    ? JSON.parse(response.result)
    : response.result) as CloudBaseResult<T>;
  if (!result?.ok) throw new Error(result?.error || '云端请求失败');
  return result.data;
}

async function restJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || '请求失败，请重试');
  return body;
}

export async function getPoll(slug: string, ownerKey = '') {
  if (isCloudBaseConfigured()) {
    return callCloudBase<ClientPoll>('getPoll', { slug, ownerKey });
  }
  return restJson<ClientPoll>(
    `/api/polls/${encodeURIComponent(slug)}${ownerKey ? `?key=${encodeURIComponent(ownerKey)}` : ''}`,
  );
}

export async function submitPollVote(slug: string, input: VoteInput) {
  if (isCloudBaseConfigured()) {
    return callCloudBase<ClientPoll>('submitVote', { slug, ...input });
  }
  const body = await restJson<{ poll: ClientPoll }>(`/api/polls/${encodeURIComponent(slug)}/votes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return body.poll;
}

export async function removePollVote(slug: string, voteId: string | number, ownerKey: string) {
  if (isCloudBaseConfigured()) {
    return callCloudBase<ClientPoll>('deleteVote', { slug, voteId: String(voteId), ownerKey });
  }
  const body = await restJson<{ poll: ClientPoll }>(
    `/api/polls/${encodeURIComponent(slug)}/votes/${encodeURIComponent(String(voteId))}?key=${encodeURIComponent(ownerKey)}`,
    { method: 'DELETE' },
  );
  return body.poll;
}

export async function uploadPollImage(file: File) {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(file.type)) throw new Error('只支持 JPG、PNG 和 WebP');
  if (file.size > 5 * 1024 * 1024) throw new Error('图片不能超过 5MB');

  if (isCloudBaseConfigured()) {
    const app = await getCloudBaseApp();
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const upload = await app.uploadFile({
      cloudPath: `polls/${crypto.randomUUID()}.${extension}`,
      filePath: file as unknown as string,
    });
    return upload.fileID;
  }

  const data = new FormData();
  data.set('image', file);
  const body = await restJson<{ key: string }>('/api/uploads', { method: 'POST', body: data });
  return body.key;
}

export async function createPoll(input: CreatePollInput) {
  if (isCloudBaseConfigured()) {
    return callCloudBase<{ slug: string; ownerKey: string }>('createPoll', {
      title: input.title,
      price: input.price,
      description: input.description,
      question: input.question,
      imageFileId: input.imageKey,
      deadline: input.deadline,
    });
  }
  return restJson<{ slug: string; ownerKey: string }>('/api/polls', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}
