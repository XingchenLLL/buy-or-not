'use strict';

const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const Cloudbase = require('@cloudbase/node-sdk');

const app = Cloudbase.init({ env: Cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const polls = db.collection('polls');
const votes = db.collection('votes');

const CHOICES = new Set(['yes', 'maybe', 'no']);
const MAX_VOTES_PER_POLL = 200;

function hashToken(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function matchesHash(value, expectedHash) {
  if (!value || !expectedHash) return false;
  const actual = Buffer.from(hashToken(value), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function cleanText(value, max, required = false) {
  const text = typeof value === 'string'
    ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '')
    : '';
  if (required && !text) throw new Error('请把必填内容补充完整');
  if (text.length > max) throw new Error('填写的内容太长了');
  return text;
}

function assertFriendlyText(...values) {
  const unsafe = /(身份证|银行卡|支付密码|验证码|裸照|代开发票|枪支|毒品)/i;
  if (unsafe.test(values.join(' '))) throw new Error('内容中包含不适合公开分享的信息');
}

function cleanSlug(value) {
  const slug = cleanText(value, 24, true).toLowerCase();
  if (!/^[a-f0-9]{12}$/.test(slug)) throw new Error('咨询链接无效');
  return slug;
}

async function findPoll(slug) {
  const result = await polls.where({ slug }).limit(1).get();
  return result.data?.[0] || null;
}

async function resolveImageUrl(fileID) {
  if (!fileID) return '';
  try {
    const result = await app.getTempFileURL({ fileList: [fileID] });
    return result.fileList?.[0]?.tempFileURL || '';
  } catch {
    return '';
  }
}

async function presentPoll(slug, ownerKey = '') {
  const poll = await findPoll(slug);
  if (!poll) throw new Error('这个咨询不存在或已删除');

  const voteResult = await votes
    .where({ pollId: poll._id })
    .orderBy('updatedAt', 'desc')
    .limit(MAX_VOTES_PER_POLL)
    .get();
  const rows = voteResult.data || [];
  const counts = { yes: 0, maybe: 0, no: 0 };
  for (const vote of rows) {
    if (CHOICES.has(vote.choice)) counts[vote.choice] += 1;
  }

  return {
    slug: poll.slug,
    title: poll.title,
    price: poll.price || '',
    description: poll.description,
    question: poll.question,
    imageUrl: (await resolveImageUrl(poll.imageFileId)) || '/demo/headphones.png',
    deadline: poll.deadline || null,
    createdAt: poll.createdAt,
    counts,
    total: rows.length,
    votes: rows.map((vote) => ({
      id: vote._id,
      nickname: vote.nickname,
      choice: vote.choice,
      comment: vote.comment || '',
      createdAt: vote.updatedAt,
    })),
    isOwner: matchesHash(ownerKey, poll.ownerKeyHash),
  };
}

async function createPoll(input) {
  const title = cleanText(input.title, 80, true);
  const price = cleanText(input.price, 30);
  const description = cleanText(input.description, 500, true);
  const question = cleanText(input.question, 80, true);
  const imageFileId = cleanText(input.imageFileId, 512);
  assertFriendlyText(title, description, question);

  if (imageFileId && !imageFileId.startsWith('cloud://')) {
    throw new Error('图片地址无效，请重新上传');
  }

  const rawDeadline = typeof input.deadline === 'number' ? input.deadline : null;
  const deadline = rawDeadline && Number.isFinite(rawDeadline) ? Math.round(rawDeadline) : null;
  const ownerKey = randomBytes(24).toString('hex');
  const slug = randomBytes(6).toString('hex');
  const now = Date.now();

  await polls.add({
    slug,
    ownerKeyHash: hashToken(ownerKey),
    title,
    price,
    description,
    question,
    imageFileId,
    deadline,
    createdAt: now,
  });

  return { slug, ownerKey };
}

async function submitVote(input) {
  const slug = cleanSlug(input.slug);
  const poll = await findPoll(slug);
  if (!poll) throw new Error('咨询不存在');
  if (poll.deadline && poll.deadline < Date.now()) throw new Error('这个咨询已经结束');

  const choice = cleanText(input.choice, 10, true);
  if (!CHOICES.has(choice)) throw new Error('请选择有效的意见');
  const nickname = cleanText(input.nickname, 20, true);
  const comment = cleanText(input.comment, 240);
  const guestToken = cleanText(input.guestToken, 100, true);
  assertFriendlyText(nickname, comment);

  const now = Date.now();
  const voteId = `v_${hashToken(`${poll._id}:${guestToken}`)}`;
  const current = await votes.doc(voteId).get();
  const createdAt = current.data?.[0]?.createdAt || now;

  await votes.doc(voteId).set({
    pollId: poll._id,
    guestTokenHash: hashToken(guestToken),
    nickname,
    choice,
    comment,
    createdAt,
    updatedAt: now,
  });

  return presentPoll(slug);
}

async function deleteVote(input) {
  const slug = cleanSlug(input.slug);
  const ownerKey = cleanText(input.ownerKey, 100, true);
  const voteId = cleanText(input.voteId, 100, true);
  const poll = await findPoll(slug);
  if (!poll) throw new Error('咨询不存在');
  if (!matchesHash(ownerKey, poll.ownerKeyHash)) throw new Error('没有删除权限');

  const result = await votes.where({ _id: voteId, pollId: poll._id }).limit(1).get();
  if (!result.data?.length) throw new Error('这条留言不存在');
  await votes.doc(voteId).remove();
  return presentPoll(slug, ownerKey);
}

exports.main = async (event) => {
  try {
    const operation = cleanText(event?.operation, 40, true);
    let data;
    if (operation === 'getPoll') {
      data = await presentPoll(cleanSlug(event.slug), cleanText(event.ownerKey, 100));
    } else if (operation === 'createPoll') {
      data = await createPoll(event);
    } else if (operation === 'submitVote') {
      data = await submitVote(event);
    } else if (operation === 'deleteVote') {
      data = await deleteVote(event);
    } else {
      throw new Error('不支持的操作');
    }
    return { ok: true, data };
  } catch (error) {
    console.error('buy-or-not-api error', error);
    return { ok: false, error: error instanceof Error ? error.message : '请求失败，请重试' };
  }
};
