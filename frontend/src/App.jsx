import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Studio from './pages/Studio.jsx';
import Footer from './components/Footer.jsx';
import BalanceBadge from './components/BalanceBadge.jsx';
import { BrandMark, LogoutIcon, SparkleIcon } from './components/Icons.jsx';

export default function App() {
  const [authState, setAuthState] = useState({
    loading: true,
    connected: false,
    clientId: null,
    topupReturnUrl: null,
  });
  const [balanceTick, setBalanceTick] = useState(0);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status', { credentials: 'include' });
      const body = await res.json();
      setAuthState({
        loading: false,
        connected: Boolean(body.connected),
        clientId: body.clientId || null,
        topupReturnUrl: body.topupReturnUrl || null,
      });
    } catch {
      setAuthState({ loading: false, connected: false, clientId: null, topupReturnUrl: null });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = () => {
    window.location.href = '/api/auth/login';
  };

  const disconnect = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setAuthState((s) => ({ ...s, connected: false }));
    navigate('/');
  };

  const requestBalanceRefresh = useCallback(() => setBalanceTick((n) => n + 1), []);

  const openTopUp = useCallback(() => {
    if (!authState.clientId) return;
    const url =
      `https://app.agnic.ai/topup` +
      `?client_id=${encodeURIComponent(authState.clientId)}` +
      `&return_url=${encodeURIComponent(authState.topupReturnUrl || window.location.origin)}`;
    const narrow = window.innerWidth < 640;
    if (narrow) {
      window.location.href = url;
      return;
    }
    const w = window.open(
      url,
      'agnic-topup',
      'width=480,height=720,resizable=yes,scrollbars=yes,noopener=no'
    );
    if (!w) window.location.href = url;
  }, [authState.clientId, authState.topupReturnUrl]);

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="PixelForge home">
          <BrandMark />
          <span>PixelForge</span>
          <small>Beta</small>
        </Link>

        <nav className="topnav" aria-label="Primary">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
          >
            Home
          </NavLink>
          <NavLink
            to="/studio"
            className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
          >
            Studio
          </NavLink>

          <span style={{ width: 12 }} aria-hidden="true" />

          {authState.loading ? (
            <span className="muted small">…</span>
          ) : authState.connected ? (
            <>
              <BalanceBadge
                clientId={authState.clientId}
                topupReturnUrl={authState.topupReturnUrl}
                refreshKey={balanceTick}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={disconnect}
                title="Disconnect from Agnic"
              >
                <LogoutIcon className="ico" />
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={connect}>
              <SparkleIcon className="ico" />
              <span>Connect with Agnic</span>
            </button>
          )}
        </nav>
      </header>

      <main className="main">
        <Routes>
          <Route
            path="/"
            element={<Landing connected={authState.connected} onConnect={connect} />}
          />
          <Route
            path="/studio"
            element={
              <Studio
                connected={authState.connected}
                loading={authState.loading}
                onConnect={connect}
                onAfterGenerate={requestBalanceRefresh}
                onTopUp={openTopUp}
              />
            }
          />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
