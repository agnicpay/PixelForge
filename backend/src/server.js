import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  gatewayFetch,
  refreshAccessToken,
  tokensFromResponse,
} from './agnic.js';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getSession,
  setSessionCookie,
  updateSession,
} from './sessions.js';
import { codeChallengeFor, generateCodeVerifier, generateState } from './pkce.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: config.frontendOrigin,
    credentials: true,
  })
);

function getOrCreateSession(req, res) {
  const existing = getSession(req);
  if (existing) return existing;
  const { id, cookie } = createSession();
  setSessionCookie(res, cookie);
  return { id, data: { _created: Date.now() } };
}

async function ensureFreshAccessToken(session) {
  const { data } = session;
  if (!data.accessToken) return null;
  const skewMs = 30_000;
  if (data.expiresAt && data.expiresAt - skewMs > Date.now()) return data.accessToken;
  if (!data.refreshToken) return null;
  try {
    const refreshed = tokensFromResponse(await refreshAccessToken(data.refreshToken));
    updateSession(session.id, refreshed);
    return refreshed.accessToken;
  } catch {
    updateSession(session.id, {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    });
    return null;
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/auth/status', (req, res) => {
  const s = getSession(req);
  res.json({
    connected: Boolean(s?.data?.accessToken),
    clientId: config.clientId,
    topupReturnUrl: config.topupReturnUrl,
  });
});

app.get('/api/balance', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'not_connected' });
  const accessToken = await ensureFreshAccessToken(session);
  if (!accessToken) return res.status(401).json({ error: 'not_connected' });

  const upstream = await gatewayFetch({
    accessToken,
    path: '/api/balance',
    partnerAttribution: false,
  });
  if (!upstream.ok) {
    return res.status(upstream.status).json({
      error: 'upstream_error',
      status: upstream.status,
      body: upstream.body,
    });
  }
  const b = upstream.body || {};
  res.json({
    creditBalance: b.creditBalance ?? null,
    usdcBalance: b.usdcBalance ?? null,
    totalBalance: b.totalBalance ?? null,
    hasWallet: Boolean(b.hasWallet),
    network: b.network ?? null,
    chainType: b.chainType ?? null,
  });
});

app.get('/api/auth/login', (req, res) => {
  const verifier = generateCodeVerifier();
  const state = generateState();
  const challenge = codeChallengeFor(verifier);

  const { id, cookie } = createSession({
    pkceVerifier: verifier,
    oauthState: state,
  });
  setSessionCookie(res, cookie);

  void id;
  res.redirect(buildAuthorizeUrl({ state, codeChallenge: challenge }));
});

app.get('/api/auth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const session = getSession(req);
  if (!session) {
    return res.status(400).type('html').send(renderError('Session expired before callback. Please retry the connection.'));
  }
  if (error) {
    destroySession(session.id);
    clearSessionCookie(res);
    return res.status(400).type('html').send(renderError(`Authorization failed: ${error}${error_description ? ` — ${error_description}` : ''}`));
  }
  if (!code || !state) {
    return res.status(400).type('html').send(renderError('Missing code or state in callback.'));
  }
  if (state !== session.data.oauthState) {
    destroySession(session.id);
    clearSessionCookie(res);
    return res.status(400).type('html').send(renderError('Invalid state parameter (possible CSRF). Please retry.'));
  }
  if (!session.data.pkceVerifier) {
    return res.status(400).type('html').send(renderError('Missing PKCE verifier. Please retry the connection.'));
  }

  try {
    const tokenResponse = await exchangeCodeForToken({
      code,
      codeVerifier: session.data.pkceVerifier,
    });
    const tokens = tokensFromResponse(tokenResponse);
    updateSession(session.id, {
      ...tokens,
      pkceVerifier: null,
      oauthState: null,
    });
    res.redirect(`${config.frontendOrigin}/studio`);
  } catch (err) {
    const detail = err.body?.error_description || err.body?.error || err.message;
    res
      .status(err.status || 500)
      .type('html')
      .send(renderError(`Token exchange failed: ${detail}`));
  }
});

app.post('/api/auth/logout', (req, res) => {
  const s = getSession(req);
  if (s) destroySession(s.id);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/models', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'not_connected' });
  const accessToken = await ensureFreshAccessToken(session);
  if (!accessToken) return res.status(401).json({ error: 'not_connected' });

  const upstream = await gatewayFetch({ accessToken, path: '/v1/models' });
  if (!upstream.ok) {
    return res.status(upstream.status).json({
      error: 'upstream_error',
      status: upstream.status,
      body: upstream.body,
    });
  }
  const all = Array.isArray(upstream.body?.data) ? upstream.body.data : [];
  const imageModels = all
    .filter((m) => {
      const out = m?.architecture?.output_modalities;
      return Array.isArray(out) && out.includes('image');
    })
    .map((m) => ({
      id: m.id,
      name: m.name || m.id,
      description: m.description || '',
      provider: m.top_provider?.name || (m.id || '').split('/')[0] || '',
      pricing: m.pricing || null,
    }));
  res.json({ data: imageModels });
});

app.post('/api/generate', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'not_connected' });
  const accessToken = await ensureFreshAccessToken(session);
  if (!accessToken) return res.status(401).json({ error: 'not_connected' });

  const { model, prompt, aspectRatio } = req.body || {};
  if (!model || typeof model !== 'string') {
    return res.status(400).json({ error: 'invalid_model' });
  }
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'invalid_prompt' });
  }
  const ar = typeof aspectRatio === 'string' && aspectRatio ? aspectRatio : '1:1';

  const upstream = await gatewayFetch({
    accessToken,
    path: '/v1/chat/completions',
    method: 'POST',
    body: {
      model,
      messages: [{ role: 'user', content: prompt.trim() }],
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: ar },
    },
  });

  if (upstream.status === 402) {
    return res.status(402).json({
      error: 'insufficient_credit',
      message: "You're out of Agnic credit — top up at https://app.agnic.ai/topup",
      topupUrl: 'https://app.agnic.ai/topup',
    });
  }
  if (!upstream.ok) {
    return res.status(upstream.status).json({
      error: 'upstream_error',
      status: upstream.status,
      body: upstream.body,
    });
  }

  const choice = upstream.body?.choices?.[0]?.message;
  const images = Array.isArray(choice?.images)
    ? choice.images
        .map((im) => im?.image_url?.url || im?.url || null)
        .filter(Boolean)
    : [];
  res.json({
    requestId: upstream.body?.id || null,
    model,
    images,
    text: typeof choice?.content === 'string' ? choice.content : '',
  });
});

function renderError(message) {
  const safe = String(message).replace(/[<>&]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'
  );
  return `<!doctype html><meta charset="utf-8"><title>PixelForge — error</title>
<body style="font-family:system-ui;max-width:560px;margin:64px auto;padding:0 16px;line-height:1.5">
<h1 style="margin:0 0 12px">Connection failed</h1>
<p style="color:#444">${safe}</p>
<p><a href="${config.frontendOrigin}">Back to PixelForge</a></p>
</body>`;
}

app.listen(config.port, () => {
  console.log(`PixelForge backend on http://localhost:${config.port}`);
  console.log(`  Agnic API base: ${config.apiBase}`);
  console.log(`  Frontend origin: ${config.frontendOrigin}`);
  console.log(`  Redirect URI:    ${config.redirectUri}`);
});
