import crypto from 'node:crypto';
import { config } from './config.js';

const sessions = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24;

function sign(value) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(value)
    .digest('base64url');
}

function pack(id) {
  return `${id}.${sign(id)}`;
}

function unpack(cookie) {
  if (!cookie || typeof cookie !== 'string') return null;
  const [id, sig] = cookie.split('.');
  if (!id || !sig) return null;
  const expected = sign(id);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return id;
}

export function createSession(data = {}) {
  const id = crypto.randomBytes(24).toString('base64url');
  sessions.set(id, { ...data, _created: Date.now() });
  return { id, cookie: pack(id) };
}

export function getSession(req) {
  const id = unpack(req.cookies?.pf_sid);
  if (!id) return null;
  const s = sessions.get(id);
  if (!s) return null;
  if (Date.now() - s._created > SESSION_TTL_MS) {
    sessions.delete(id);
    return null;
  }
  return { id, data: s };
}

export function updateSession(id, patch) {
  const existing = sessions.get(id);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  sessions.set(id, next);
  return next;
}

export function destroySession(id) {
  sessions.delete(id);
}

export function setSessionCookie(res, cookie) {
  res.cookie('pf_sid', cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie('pf_sid', { path: '/' });
}
