import { useCallback, useEffect, useRef, useState } from 'react';

function formatUsd(stringAmount) {
  if (stringAmount == null) return '—';
  const n = Number(stringAmount);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function BalanceBadge({ clientId, topupReturnUrl, refreshKey }) {
  const [balance, setBalance] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const popupRef = useRef(null);

  const refetch = useCallback(async () => {
    setState((s) => (s === 'idle' ? 'loading' : s));
    setError(null);
    try {
      const res = await fetch('/api/balance', { credentials: 'include' });
      if (res.status === 401) {
        setState('idle');
        setBalance(null);
        return;
      }
      const body = await res.json();
      if (!res.ok) {
        setState('error');
        setError(body?.body?.error?.message || `Failed (${res.status})`);
        return;
      }
      setBalance(body);
      setState('ready');
    } catch (err) {
      setState('error');
      setError(err?.message || 'Network error');
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, refreshKey]);

  useEffect(() => {
    function onMessage(ev) {
      if (ev.origin !== 'https://app.agnic.ai') return;
      refetch();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refetch]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('topup') === 'success') {
      refetch();
      params.delete('topup');
      params.delete('session_id');
      const qs = params.toString();
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (qs ? `?${qs}` : '')
      );
    }
  }, [refetch]);

  const onTopUp = useCallback(() => {
    if (!clientId) return;
    const url =
      `https://app.agnic.ai/topup` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&return_url=${encodeURIComponent(topupReturnUrl)}`;
    const narrow = window.innerWidth < 640;
    if (narrow) {
      window.location.href = url;
      return;
    }
    const features = 'width=480,height=720,resizable=yes,scrollbars=yes,noopener=no';
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }
    popupRef.current = window.open(url, 'agnic-topup', features);
    if (!popupRef.current) {
      window.location.href = url;
    }
  }, [clientId, topupReturnUrl]);

  return (
    <div className="balance" aria-live="polite">
      <div className="balance-amount" title="Agnic credit balance — read from Agnic, not calculated by PixelForge">
        {state === 'loading' && <span className="muted">Loading…</span>}
        {state === 'error' && (
          <span className="error-text" title={error || ''}>—</span>
        )}
        {state === 'ready' && (
          <>
            <span className="balance-label">Credit</span>
            <span className="balance-value">{formatUsd(balance?.creditBalance)}</span>
          </>
        )}
      </div>
      <button className="btn btn-primary btn-sm" onClick={onTopUp} disabled={!clientId}>
        Top up
      </button>
    </div>
  );
}
