import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SparkleIcon,
  DownloadIcon,
  ImageIcon,
  ErrorIcon,
  WalletIcon,
} from '../components/Icons.jsx';

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:2'];

function extFromDataUrl(url) {
  if (!url || typeof url !== 'string') return 'png';
  if (url.startsWith('data:image/png'))  return 'png';
  if (url.startsWith('data:image/jpeg')) return 'jpg';
  if (url.startsWith('data:image/jpg'))  return 'jpg';
  if (url.startsWith('data:image/webp')) return 'webp';
  return 'png';
}

export default function Studio({ connected, loading, onConnect, onAfterGenerate, onTopUp }) {
  const [models, setModels] = useState([]);
  const [modelsState, setModelsState] = useState('idle');
  const [modelsError, setModelsError] = useState(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState([]);
  const [genError, setGenError] = useState(null);
  const [insufficientCredit, setInsufficientCredit] = useState(false);

  const fetchModels = useCallback(async () => {
    setModelsState('loading');
    setModelsError(null);
    try {
      const res = await fetch('/api/models', { credentials: 'include' });
      if (res.status === 401) {
        setModelsState('idle');
        return;
      }
      const body = await res.json();
      if (!res.ok) {
        setModelsState('error');
        setModelsError(body?.body?.error?.message || `Failed to load models (${res.status})`);
        return;
      }
      const list = Array.isArray(body?.data) ? body.data : [];
      setModels(list);
      setModelsState('ready');
      setSelectedModel((current) => current || list[0]?.id || '');
    } catch (err) {
      setModelsState('error');
      setModelsError(err?.message || 'Network error');
    }
  }, []);

  useEffect(() => {
    if (connected) fetchModels();
  }, [connected, fetchModels]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!selectedModel || !prompt.trim() || generating) return;
    setGenerating(true);
    setGenError(null);
    setInsufficientCredit(false);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, prompt: prompt.trim(), aspectRatio }),
      });
      const body = await res.json();
      if (res.status === 402 || body?.error === 'insufficient_credit') {
        setInsufficientCredit(true);
        if (typeof onAfterGenerate === 'function') onAfterGenerate();
        return;
      }
      if (!res.ok) {
        setGenError(
          body?.body?.error?.message ||
            body?.message ||
            `Generation failed (${res.status})`
        );
        return;
      }
      if (!Array.isArray(body?.images) || body.images.length === 0) {
        setGenError('Model returned no images. Try a different model or refine the prompt.');
        return;
      }
      const ts = Date.now();
      setResults((prev) => [
        ...body.images.map((url, i) => ({
          id: `${ts}-${i}`,
          url,
          model: body.model || selectedModel,
          requestId: body.requestId || null,
          prompt: prompt.trim(),
        })),
        ...prev,
      ]);
      if (typeof onAfterGenerate === 'function') onAfterGenerate();
    } catch (err) {
      setGenError(err?.message || 'Network error');
    } finally {
      setGenerating(false);
    }
  };

  const modelOptions = useMemo(
    () =>
      models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} — {m.id}
        </option>
      )),
    [models]
  );

  const activeModel = useMemo(
    () => models.find((m) => m.id === selectedModel) || null,
    [models, selectedModel]
  );

  if (loading) {
    return (
      <div className="studio-locked">
        <div className="lock-card">
          <span className="muted">Checking session…</span>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="studio-locked">
        <div className="lock-card">
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--grad-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}>
            <WalletIcon width="26" height="26" />
          </div>
          <h1>Connect to start generating</h1>
          <p className="lead">
            PixelForge proxies your generations through the Agnic AI Gateway.
            Agnic bills you directly — PixelForge never sees your card.
          </p>
          <button className="btn btn-primary btn-lg" onClick={onConnect}>
            <SparkleIcon className="ico" />
            Connect with Agnic
          </button>
          <p className="legal">
            Payments and billing are handled by Agnic. You contract directly
            with Agnic; PixelForge never receives or holds your funds.
          </p>
        </div>
      </div>
    );
  }

  const canGenerate =
    !generating && Boolean(selectedModel) && Boolean(prompt.trim());

  return (
    <div className="studio">
      <aside className="studio-sidebar" aria-label="Generation controls">
        <form className="sidebar-inner" onSubmit={onSubmit}>
          <header className="sidebar-header">
            <div className="sidebar-title">
              <span className="ico-wrap"><ImageIcon /></span>
              <h2>Image Generator</h2>
            </div>
            <span className="pill">Live</span>
          </header>

          <div className="field">
            <label htmlFor="model" className="field-label">Model</label>
            <select
              id="model"
              className="select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={modelsState !== 'ready' || models.length === 0}
            >
              {modelsState === 'loading' && <option value="">Loading models…</option>}
              {modelsState === 'error'   && <option value="">Couldn't load models</option>}
              {modelsState === 'ready' && models.length === 0 && (
                <option value="">No image-capable models available</option>
              )}
              {modelsState === 'ready' && modelOptions}
            </select>
            {activeModel?.description && (
              <p className="select-hint clamp-2">{activeModel.description}</p>
            )}
            {modelsState === 'error' && (
              <p className="select-hint error-text">{modelsError}</p>
            )}
          </div>

          <div className="field">
            <label htmlFor="prompt" className="field-label">Prompt</label>
            <textarea
              id="prompt"
              className="input"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A dieselpunk lighthouse on a copper coast at dusk, volumetric fog, cinematic 35mm"
              required
            />
          </div>

          <div className="field">
            <span className="field-label">Aspect Ratio</span>
            <div className="chip-group" role="radiogroup" aria-label="Aspect ratio">
              {ASPECT_RATIOS.map((ar) => (
                <button
                  key={ar}
                  type="button"
                  role="radio"
                  aria-checked={ar === aspectRatio}
                  className={`chip${ar === aspectRatio ? ' is-active' : ''}`}
                  onClick={() => setAspectRatio(ar)}
                >
                  {ar}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block"
            disabled={!canGenerate}
          >
            <SparkleIcon className="ico" />
            {generating ? 'Generating…' : 'Generate'}
          </button>

          <p className="sidebar-footer">
            Each generation is billed by Agnic. Need credit?{' '}
            <a href="https://app.agnic.ai/topup" target="_blank" rel="noreferrer">
              Top up
            </a>{' '}
            — your balance is in the header.
          </p>
        </form>
      </aside>

      <section className="canvas" aria-label="Generated images">
        <header className="canvas-header">
          <h1>Your generations</h1>
          <span className="canvas-meta">
            {results.length === 0
              ? 'No generations yet'
              : `${results.length} image${results.length === 1 ? '' : 's'}`}
          </span>
        </header>

        {insufficientCredit && (
          <div className="banner banner-warn" role="status">
            <div className="banner-content">
              <span className="ico-wrap"><WalletIcon /></span>
              <span>You're out of Agnic credit — top up at https://app.agnic.ai/topup</span>
            </div>
            {typeof onTopUp === 'function' ? (
              <button className="btn btn-primary btn-sm" onClick={onTopUp}>Top up</button>
            ) : (
              <a className="btn btn-primary btn-sm" href="https://app.agnic.ai/topup" target="_blank" rel="noreferrer">Top up</a>
            )}
          </div>
        )}

        {genError && (
          <div className="banner banner-error" role="alert">
            <div className="banner-content">
              <span className="ico-wrap"><ErrorIcon /></span>
              <span>{genError}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setGenError(null)}>Dismiss</button>
          </div>
        )}

        <div className="results-grid">
          {generating && (
            <article className="card card-skeleton" aria-busy="true">
              <div className="skeleton" />
              <div className="card-meta">
                <span className="muted small">Generating with {selectedModel}…</span>
              </div>
            </article>
          )}

          {results.length === 0 && !generating && (
            <div className="empty" style={{ gridColumn: '1 / -1' }}>
              <span className="empty-ico"><ImageIcon width="22" height="22" /></span>
              <h3>Nothing here yet</h3>
              <p>Write a prompt on the left, pick a model, and hit Generate. Results will show up here in a responsive grid.</p>
            </div>
          )}

          {results.map((r, idx) => {
            const ext = extFromDataUrl(r.url);
            return (
              <article key={r.id} className="card">
                <div className="card-media">
                  <img src={r.url} alt={r.prompt} loading="lazy" />
                  <div className="card-overlay">
                    <a
                      className="btn btn-soft btn-sm"
                      href={r.url}
                      download={`pixelforge-${idx + 1}.${ext}`}
                    >
                      <DownloadIcon className="ico" />
                      Download
                    </a>
                    <span className="pill" title={r.requestId || ''}>
                      {r.requestId ? `id ${String(r.requestId).slice(0, 8)}` : 'image'}
                    </span>
                  </div>
                </div>
                <div className="card-meta">
                  <div className="card-meta-row">
                    <span className="pill">{r.model}</span>
                  </div>
                  <p className="muted small clamp-2">{r.prompt}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
