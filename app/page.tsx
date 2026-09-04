'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, ChevronRight, Clock3, Copy, ImagePlus,
  MessageCircleMore, Plus, Send, Share2, ShoppingBag, Sparkles,
  ThumbsDown, ThumbsUp, Trash2, Users, X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Choice = 'yes' | 'maybe' | 'no';
type Vote = { id: number; nickname: string; choice: Choice; comment: string; createdAt: number };
type Poll = {
  slug: string; title: string; price: string; description: string; question: string;
  imageUrl: string; deadline: number | null; createdAt: number;
  counts: Record<Choice, number>; total: number; votes: Vote[]; isOwner?: boolean;
};

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<unknown>;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

const demoPoll: Poll = {
  slug: 'demo',
  title: '这副头戴式耳机，值得买吗？',
  price: '¥1,299',
  description: '通勤和学习时用，试戴很舒服，但手里已经有一副入耳式耳机了。有点心动，想听听你们的真话。',
  question: '如果是你，你会买吗？',
  imageUrl: '/demo/headphones.png',
  deadline: Date.now() + 2 * 24 * 60 * 60 * 1000,
  createdAt: Date.now() - 40 * 60 * 1000,
  counts: { yes: 6, maybe: 2, no: 3 }, total: 11,
  votes: [
    { id: 1, nickname: '阿青', choice: 'yes', comment: '你上周试戴完还在念叨，真喜欢就买吧。平均到每天其实不贵。', createdAt: Date.now() - 8 * 60 * 1000 },
    { id: 2, nickname: '小林', choice: 'no', comment: '先等一个月！你现在那副其实够用，而且马上可能有活动。', createdAt: Date.now() - 23 * 60 * 1000 },
    { id: 3, nickname: '水杯同学', choice: 'maybe', comment: '如果降到 1000 左右就冲，原价我会再蹲蹲。', createdAt: Date.now() - 31 * 60 * 1000 },
  ],
};

const choiceMeta: Record<Choice, { label: string; short: string; icon: typeof ThumbsUp; className: string }> = {
  yes: { label: '建议买', short: '买', icon: ThumbsUp, className: 'choice-yes' },
  maybe: { label: '再想想', short: '等等', icon: Sparkles, className: 'choice-maybe' },
  no: { label: '不建议', short: '不买', icon: ThumbsDown, className: 'choice-no' },
};

function getGuestToken() {
  const key = 'buy-or-not-guest';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

function timeAgo(value: number) {
  const minutes = Math.max(1, Math.round((Date.now() - value) / 60_000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}

function deadlineText(value: number | null) {
  if (!value) return '不限时';
  const left = value - Date.now();
  if (left <= 0) return '已结束';
  const hours = Math.ceil(left / 3_600_000);
  if (hours < 24) return `还有 ${hours} 小时`;
  return `还有 ${Math.ceil(hours / 24)} 天`;
}

function Logo() {
  return <div className="logo-lockup" aria-label="买不买"><span className="logo-mark">么</span><span>买不买</span></div>;
}

export default function Home() {
  const [poll, setPoll] = useState<Poll>(demoPoll);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [nickname, setNickname] = useState('');
  const [comment, setComment] = useState('');
  const [submittedChoice, setSubmittedChoice] = useState<Choice | null>(null);
  const [notice, setNotice] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const ownerKeyRef = useRef('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('p');
    const ownerKey = params.get('key') || '';
    ownerKeyRef.current = ownerKey;
    if (!slug) return;
    setLoading(true);
    fetch(`/api/polls/${encodeURIComponent(slug)}${ownerKey ? `?key=${encodeURIComponent(ownerKey)}` : ''}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('这个咨询不存在或已删除');
        return response.json() as Promise<Poll>;
      })
      .then(setPoll)
      .catch((error: Error) => setNotice(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: 'submit_purchase_opinion',
      title: '送出购买意见',
      description: '为当前的物品咨询提交买、等等或不买的意见，并可选留言。',
      inputSchema: {
        type: 'object',
        properties: {
          choice: { type: 'string', enum: ['yes', 'maybe', 'no'], description: 'yes=建议买，maybe=再想想，no=不建议' },
          nickname: { type: 'string', minLength: 1, maxLength: 20 },
          comment: { type: 'string', maxLength: 240 },
        },
        required: ['choice', 'nickname'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = input as { choice?: string; nickname?: string; comment?: string };
        if (!value || !['yes', 'maybe', 'no'].includes(value.choice || '')) throw new Error('无效的投票选项');
        if (!value.nickname?.trim() || value.nickname.trim().length > 20) throw new Error('昵称需要在 1–20 个字之间');
        if ((value.comment || '').length > 240) throw new Error('留言不能超过 240 个字');
        const choice = value.choice as Choice;
        if (poll.slug === 'demo') {
          const newVote: Vote = { id: Date.now(), nickname: value.nickname.trim(), choice, comment: value.comment?.trim() || '', createdAt: Date.now() };
          setPoll((current) => ({ ...current, total: current.total + 1, counts: { ...current.counts, [choice]: current.counts[choice] + 1 }, votes: [newVote, ...current.votes] }));
        } else {
          const response = await fetch(`/api/polls/${encodeURIComponent(poll.slug)}/votes`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ choice, nickname: value.nickname.trim(), comment: value.comment?.trim() || '', guestToken: getGuestToken() }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || '投票失败');
          setPoll(body.poll);
        }
        setNickname(value.nickname.trim()); setSelected(choice); setSubmittedChoice(choice);
        setNotice('收到，你的意见已记下');
        return { status: 'saved', choice, nickname: value.nickname.trim() };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [poll.slug]);

  const percentages = useMemo(() => {
    const total = Math.max(1, poll.total);
    return { yes: Math.round((poll.counts.yes / total) * 100), maybe: Math.round((poll.counts.maybe / total) * 100), no: Math.round((poll.counts.no / total) * 100) };
  }, [poll]);

  async function submitVote(event: FormEvent) {
    event.preventDefault();
    if (!selected) return setNotice('先选一个意见吧');
    if (!nickname.trim()) return setNotice('告诉朋友你是谁');
    if (poll.slug === 'demo') {
      const newVote: Vote = { id: Date.now(), nickname: nickname.trim(), choice: selected, comment: comment.trim(), createdAt: Date.now() };
      setPoll((current) => ({ ...current, total: current.total + 1, counts: { ...current.counts, [selected]: current.counts[selected] + 1 }, votes: [newVote, ...current.votes] }));
      setSubmittedChoice(selected); setComment(''); setNotice('收到，你的意见已记下'); return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/polls/${encodeURIComponent(poll.slug)}/votes`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ choice: selected, nickname: nickname.trim(), comment: comment.trim(), guestToken: getGuestToken() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '投票失败，请重试');
      setPoll(body.poll); setSubmittedChoice(selected); setComment(''); setNotice('收到，你的意见已记下');
    } catch (error) { setNotice(error instanceof Error ? error.message : '投票失败，请重试'); }
    finally { setLoading(false); }
  }

  async function sharePoll() {
    const shareUrl = new URL(window.location.href); shareUrl.searchParams.delete('key');
    const payload = { title: poll.title, text: `帮我参谋一下：${poll.title}`, url: shareUrl.toString() };
    try {
      if (navigator.share) await navigator.share(payload);
      else { await navigator.clipboard.writeText(payload.url); setNotice('邀请链接已复制'); }
    } catch { /* Native share dismissal needs no error. */ }
  }

  async function deleteVote(voteId: number) {
    if (!poll.isOwner || !ownerKeyRef.current) return;
    const response = await fetch(`/api/polls/${encodeURIComponent(poll.slug)}/votes/${voteId}?key=${encodeURIComponent(ownerKeyRef.current)}`, { method: 'DELETE' });
    if (response.ok) { const body = await response.json(); setPoll(body.poll); setNotice('这条留言已删除'); }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <Logo />
        <div className="topbar-actions">{poll.isOwner && <span className="owner-pill">主人视图</span>}<CreateDialog open={createOpen} onOpenChange={setCreateOpen} /></div>
      </header>

      <section className="poll-grid" aria-busy={loading}>
        <article className="item-panel">
          <div className="context-line">
            <button className="text-button" onClick={() => (window.location.href = '/')}><ArrowLeft aria-hidden="true" />今天的纠结</button>
            <span className="tiny-dot" /><span>{timeAgo(poll.createdAt)}发起</span>
          </div>
          <div className="item-visual">
            <img src={poll.imageUrl || '/demo/headphones.png'} alt={poll.title} />
            <span className="price-tag">{poll.price || '价格未填'}</span>
            <span className="deadline-tag"><Clock3 aria-hidden="true" /> {deadlineText(poll.deadline)}</span>
          </div>
          <div className="item-copy"><p className="eyebrow">帮我参谋一下</p><h1>{poll.title}</h1><p className="description">{poll.description}</p></div>
          <button className="share-strip" onClick={sharePoll}>
            <span className="share-strip-icon"><Share2 aria-hidden="true" /></span>
            <span><strong>叫个懂你的朋友来看看</strong><small>安全的私密链接，只有拿到链接的人能进入</small></span>
            <ChevronRight aria-hidden="true" />
          </button>
        </article>

        <aside className="decision-panel">
          <div className="decision-card">
            <div className="decision-heading"><div><p className="eyebrow">{submittedChoice ? '大家怎么说' : '你的一票很重要'}</p><h2>{poll.question}</h2></div><span className="people-count"><Users aria-hidden="true" /> {poll.total}</span></div>
            {submittedChoice ? <Results poll={poll} percentages={percentages} onEdit={() => setSubmittedChoice(null)} /> : (
              <form onSubmit={submitVote}>
                <div className="choice-grid" role="radiogroup" aria-label="选择你的意见">
                  {(Object.keys(choiceMeta) as Choice[]).map((choice) => {
                    const meta = choiceMeta[choice]; const Icon = meta.icon;
                    return <button key={choice} className={`choice-button ${meta.className} ${selected === choice ? 'is-selected' : ''}`} type="button" role="radio" aria-checked={selected === choice} onClick={() => setSelected(choice)}><span className="choice-icon"><Icon aria-hidden="true" /></span><span>{meta.label}</span>{selected === choice && <Check className="choice-check" aria-hidden="true" />}</button>;
                  })}
                </div>
                <div className="form-stack">
                  <label><span>你是谁</span><Input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} placeholder="输入昵称" autoComplete="nickname" /></label>
                  <label><span>想说的话 <small>可选</small></span><Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={240} placeholder="说说你的理由，真话最有用…" /></label>
                </div>
                <Button className="submit-vote" type="submit" disabled={loading}>{loading ? '正在记下…' : '送出我的意见'}<Send aria-hidden="true" /></Button>
                <p className="privacy-note">你的意见将展示给发起者和其他受邀朋友。</p>
              </form>
            )}
          </div>
          <section className="comments-section">
            <div className="comments-heading"><h2><MessageCircleMore aria-hidden="true" /> 朋友们的真话</h2><span>{poll.votes.filter((vote) => vote.comment).length} 条</span></div>
            <div className="comments-list">
              {poll.votes.filter((vote) => vote.comment).map((vote) => (
                <article className="comment-card" key={vote.id}>
                  <div className={`avatar avatar-${vote.choice}`}>{vote.nickname.slice(0, 1)}</div>
                  <div className="comment-body"><div className="comment-meta"><strong>{vote.nickname}</strong><span className={`opinion-chip ${choiceMeta[vote.choice].className}`}>{choiceMeta[vote.choice].short}</span><time>{timeAgo(vote.createdAt)}</time>{poll.isOwner && <button className="delete-comment" onClick={() => deleteVote(vote.id)} aria-label={`删除 ${vote.nickname} 的留言`}><Trash2 aria-hidden="true" /></button>}</div><p>{vote.comment}</p></div>
                </article>
              ))}
              {poll.votes.every((vote) => !vote.comment) && <p className="empty-comments">还没有人留言，你来说第一句吧。</p>}
            </div>
          </section>
        </aside>
      </section>

      <footer><Logo /><p>少一点纠结，多一点朋友的真话。</p></footer>
      {notice && <output className="notice" aria-live="polite"><Check aria-hidden="true" /> {notice}<button onClick={() => setNotice('')} aria-label="关闭提示"><X aria-hidden="true" /></button></output>}
    </main>
  );
}

function Results({ poll, percentages, onEdit }: { poll: Poll; percentages: Record<Choice, number>; onEdit: () => void }) {
  const leader = (Object.keys(choiceMeta) as Choice[]).sort((a, b) => poll.counts[b] - poll.counts[a])[0];
  return <div className="results-wrap">
    <div className={`result-verdict ${choiceMeta[leader].className}`}><span>当前风向</span><strong>{choiceMeta[leader].label}</strong></div>
    <div className="result-bars">{(Object.keys(choiceMeta) as Choice[]).map((choice) => <div className="result-row" key={choice}><div className="result-label"><span>{choiceMeta[choice].label}</span><strong>{percentages[choice]}%</strong></div><div className="bar-track"><span className={`bar-fill ${choiceMeta[choice].className}`} style={{ width: `${percentages[choice]}%` }} /></div><small>{poll.counts[choice]} 票</small></div>)}</div>
    <Button className="share-results" onClick={onEdit}><Copy aria-hidden="true" /> 修改我的意见</Button>
  </div>;
}

function CreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [submitting, setSubmitting] = useState(false); const [preview, setPreview] = useState(''); const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  async function createPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setSubmitting(true); setError('');
    try {
      let imageKey = ''; const file = data.get('image');
      if (file instanceof File && file.size > 0) {
        const upload = new FormData(); upload.set('image', file);
        const uploadResponse = await fetch('/api/uploads', { method: 'POST', body: upload }); const uploadBody = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadBody.error || '图片上传失败'); imageKey = uploadBody.key;
      }
      const deadlineDays = Number(data.get('deadlineDays') || 3);
      const response = await fetch('/api/polls', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: data.get('title'), price: data.get('price'), description: data.get('description'), question: data.get('question') || '如果是你，你会买吗？', imageKey, deadline: Date.now() + deadlineDays * 86400000 }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || '创建失败');
      window.location.href = `/?p=${encodeURIComponent(body.slug)}&key=${encodeURIComponent(body.ownerKey)}`;
    } catch (caught) { setError(caught instanceof Error ? caught.message : '创建失败，请重试'); setSubmitting(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger render={<Button className="create-button" />}><Plus aria-hidden="true" /> 发起新咨询</DialogTrigger>
    <DialogContent className="create-dialog">
      <DialogHeader><span className="dialog-icon"><ShoppingBag aria-hidden="true" /></span><DialogTitle>有东西拿不定主意？</DialogTitle><DialogDescription>把它发给朋友，听听大家的真实想法。</DialogDescription></DialogHeader>
      <form className="create-form" onSubmit={createPoll}>
        <button type="button" className={`image-picker ${preview ? 'has-image' : ''}`} onClick={() => fileRef.current?.click()}>{preview ? <img src={preview} alt="待购物品预览" /> : <><ImagePlus aria-hidden="true" /><span>上传物品图片</span><small>JPG、PNG 或 WebP，最大 5MB</small></>}</button>
        <input ref={fileRef} className="sr-only" type="file" name="image" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) setPreview(URL.createObjectURL(file)); }} />
        <label><span>你在纠结什么？</span><Input name="title" required maxLength={80} placeholder="例如：这副头戴式耳机值得买吗？" /></label>
        <div className="two-fields"><label><span>价格 <small>可选</small></span><Input name="price" maxLength={30} placeholder="¥1,299" /></label><label><span>收集多久</span><select name="deadlineDays" defaultValue="3"><option value="1">1 天</option><option value="3">3 天</option><option value="7">7 天</option><option value="30">30 天</option></select></label></div>
        <label><span>说说你的纠结</span><Textarea name="description" required maxLength={500} placeholder="你为什么想买，又在担心什么？" /></label>
        <label><span>想问朋友的话</span><Input name="question" maxLength={80} placeholder="如果是你，你会买吗？" /></label>
        {error && <p className="form-error">{error}</p>}
        <Button className="create-submit" type="submit" disabled={submitting}>{submitting ? '正在生成…' : '生成咨询链接'} <ChevronRight aria-hidden="true" /></Button>
      </form>
    </DialogContent>
  </Dialog>;
}
