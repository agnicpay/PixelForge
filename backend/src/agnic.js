import { config } from './config.js';

export async function exchangeCodeForToken({ code, codeVerifier }) {
  const res = await fetch(`${config.apiBase}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      code_verifier: codeVerifier,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Token exchange failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function refreshAccessToken(refreshToken) {
  const res = await fetch(`${config.apiBase}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Token refresh failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export function tokensFromResponse(body) {
  const expiresIn = Number(body.expires_in) || 3600;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || null,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: body.scope || null,
    tokenType: body.token_type || 'Bearer',
  };
}

export function buildAuthorizeUrl({ state, codeChallenge }) {
  const u = new URL(`${config.apiBase}/oauth/authorize`);
  u.searchParams.set('client_id', config.clientId);
  u.searchParams.set('redirect_uri', config.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('scope', config.scope);
  return u.toString();
}

export async function gatewayFetch({
  accessToken,
  path,
  method = 'GET',
  body,
  partnerAttribution = true,
}) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };
  if (partnerAttribution) headers['X-Partner-Id'] = config.clientId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${config.apiBase}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { ok: res.ok, status: res.status, body: parsed };
}
