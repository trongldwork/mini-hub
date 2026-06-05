import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';

// ----------------------------------------------------
// Custom hook: persists theme in localStorage + applies to <html>
// ----------------------------------------------------
function useTheme() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('minihub-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('minihub-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return { theme, toggleTheme };
}

// ----------------------------------------------------
// Auth Modal — Tab: New Player (register) | Returning Player (login)
// ----------------------------------------------------
function AuthModal({ onNameSet }) {
  const [tab, setTab] = useState('new'); // 'new' | 'returning'

  // ---- New Player state ----
  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState('');
  const [newLoading, setNewLoading] = useState(false);

  // After registration: show secret reveal step
  const [secret, setSecret] = useState(null); // string when revealed
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [registeredName, setRegisteredName] = useState('');

  // ---- Returning Player state ----
  const [retName, setRetName] = useState('');
  const [retSecret, setRetSecret] = useState('');
  const [retError, setRetError] = useState('');
  const [retLoading, setRetLoading] = useState(false);

  // -- Register new player --
  const handleRegister = async (e) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) return;
    setNewError('');
    setNewLoading(true);
    try {
      const res = await fetch('/api/players/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName }),
      });
      const data = await res.json();
      if (res.ok) {
        setRegisteredName(data.name);
        setSecret(data.secret);
      } else {
        setNewError(data.error || 'Failed to register');
      }
    } catch {
      setNewError('Connection to server failed. Please start backend.');
    } finally {
      setNewLoading(false);
    }
  };

  // -- Copy secret to clipboard --
  const handleCopy = () => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // -- Confirm secret saved, enter the game --
  const handleConfirmSaved = () => {
    if (!confirmed) return;
    sessionStorage.setItem('player', registeredName);
    onNameSet(registeredName);
  };

  // -- Login returning player --
  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanName = retName.trim();
    const cleanSecret = retSecret.trim().toUpperCase();
    if (!cleanName || !cleanSecret) return;
    setRetError('');
    setRetLoading(true);
    try {
      const res = await fetch('/api/players/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, secret: cleanSecret }),
      });
      const data = await res.json();
      if (res.ok) {
        sessionStorage.setItem('player', data.name);
        onNameSet(data.name);
      } else {
        setRetError(data.error || 'Login failed');
      }
    } catch {
      setRetError('Connection to server failed. Please start backend.');
    } finally {
      setRetLoading(false);
    }
  };

  // ====== Secret Reveal Step ======
  if (secret) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-logo">🔑</div>
          <h2 className="modal-title">Save Your Secret<span className="logo-dot">.</span></h2>
          <p className="modal-desc">
            This is your <strong>one-time recovery key</strong> for <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{registeredName}</span>.<br />
            Save it now — it will <strong>never be shown again</strong>.
          </p>

          <div className="secret-box">
            <span className="secret-value">{secret}</span>
            <button className="btn-copy" onClick={handleCopy}>
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>

          <label className="confirm-check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>I have saved my secret key safely</span>
          </label>

          <button
            className="btn-primary"
            onClick={handleConfirmSaved}
            disabled={!confirmed}
            style={{ marginTop: '1.25rem' }}
          >
            Enter the Arena →
          </button>
        </div>
      </div>
    );
  }

  // ====== Tab-based auth form ======
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-logo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', margin: '0 auto 1rem auto', width: '48px', height: '48px' }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} />
        </div>
        <h2 className="modal-title">Enter Arena<span className="logo-dot">.</span></h2>

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'new' ? 'active' : ''}`}
            onClick={() => { setTab('new'); setNewError(''); setRetError(''); }}
          >
            New Player
          </button>
          <button
            className={`auth-tab ${tab === 'returning' ? 'active' : ''}`}
            onClick={() => { setTab('returning'); setNewError(''); setRetError(''); }}
          >
            Returning Player
          </button>
        </div>

        {tab === 'new' ? (
          <form onSubmit={handleRegister}>
            <p className="modal-desc" style={{ marginTop: '0.5rem' }}>
              Choose a unique nickname to register and join the leaderboard.
            </p>
            <div className="form-group">
              <label htmlFor="nickname">Nickname</label>
              <input
                id="nickname"
                type="text"
                className="input-text"
                placeholder="e.g. GamerPro12"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={20}
                required
                disabled={newLoading}
                autoComplete="off"
              />
            </div>
            {newError && <div className="modal-error">{newError}</div>}
            <button type="submit" className="btn-primary" disabled={newLoading || !newName.trim()}>
              {newLoading ? 'Registering...' : 'Register & Get Secret Key'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <p className="modal-desc" style={{ marginTop: '0.5rem' }}>
              Enter your nickname and the secret key you received when you first registered.
            </p>
            <div className="form-group">
              <label htmlFor="ret-name">Nickname</label>
              <input
                id="ret-name"
                type="text"
                className="input-text"
                placeholder="Your registered nickname"
                value={retName}
                onChange={(e) => setRetName(e.target.value)}
                maxLength={20}
                required
                disabled={retLoading}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label htmlFor="ret-secret">Secret Key</label>
              <input
                id="ret-secret"
                type="text"
                className="input-text input-mono"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={retSecret}
                onChange={(e) => setRetSecret(e.target.value.toUpperCase())}
                maxLength={19}
                required
                disabled={retLoading}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {retError && <div className="modal-error">{retError}</div>}
            <button type="submit" className="btn-primary" disabled={retLoading || !retName.trim() || !retSecret.trim()}>
              {retLoading ? 'Verifying...' : 'Log In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Header Component
// ----------------------------------------------------
function Header({ playerName, onLogout, theme, onToggleTheme }) {
  const navigate = useNavigate();
  const initial = playerName ? playerName.charAt(0).toUpperCase() : '';

  return (
    <header className="main-header">
      <div className="logo-section" onClick={() => navigate('/')}>
        <img src="/logo.jpg" alt="Mini Hub" className="logo-img" style={{ height: '40px', width: 'auto', borderRadius: '8px', objectFit: 'contain' }} />
      </div>

      <div className="header-right">
        {/* Dark / Light mode toggle */}
        <button
          className="btn-theme-toggle"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {playerName && (
          <>
            <div className="player-info">
              <div className="player-avatar">{initial}</div>
              <span>Player: </span>
              <span className="player-name-val">{playerName}</span>
            </div>
            <button className="btn-change-name" onClick={onLogout}>
              Change Nickname
            </button>
          </>
        )}
      </div>
    </header>
  );
}

// ----------------------------------------------------
// Leaderboard Component
// ----------------------------------------------------
function Leaderboard({ gameId, scoreLabel, refreshTrigger }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchScores = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/scores?gameId=${gameId}&limit=10`);
        if (res.ok && active) {
          const data = await res.json();
          setScores(data);
        }
      } catch (err) {
        console.error('Failed to load leaderboard', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchScores();

    return () => {
      active = false;
    };
  }, [gameId, refreshTrigger]);

  const currentPlayer = sessionStorage.getItem('player') || '';

  return (
    <div className="leaderboard-container">
      <div className="lbd-title-row">
        <h3 className="lbd-title">Leaderboard</h3>
        <span className="lbd-subtitle">Top 10</span>
      </div>
      {loading ? (
        <div className="lbd-empty">Loading leaderboard...</div>
      ) : scores.length === 0 ? (
        <div className="lbd-empty">No scores submitted yet.<br />Be the first!</div>
      ) : (
        <div className="lbd-list">
          {scores.map((score, index) => (
            <div key={index} className="lbd-item">
              <div className="lbd-item-left">
                <span className={`lbd-rank lbd-rank-${score.rank}`}>
                  {score.rank}
                </span>
                <span className={`lbd-player-name ${score.playerName.toLowerCase() === currentPlayer.toLowerCase() ? 'highlighted' : ''}`}>
                  {score.playerName}
                </span>
              </div>
              <span className="lbd-score">
                {score.score}<span className="lbd-score-unit">{scoreLabel}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// Game Grid List Component (Home Page)
// ----------------------------------------------------
function GameList({ games }) {
  return (
    <main className="main-content">
      <h2 className="section-title">Available Games</h2>
      {games.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '3rem' }}>
          Loading game registry...
        </div>
      ) : (
        <div className="game-grid">
          {games.map((game) => (
            <Link
              key={game.id}
              to={`/game/${game.id}`}
              className="game-card"
            >
              <div
                className="game-icon-container"
                style={{ backgroundColor: game.color + '18' }}
              >
                <div className="game-icon-bg" style={{ backgroundColor: game.color }} />
                <span className="game-icon-emoji">{game.icon}</span>
              </div>
              <div className="game-info-container">
                <h3 className="game-title">{game.name}</h3>
                <p className="game-desc">{game.description}</p>
                <div className="game-footer">
                  <span className="game-tag">{game.scoreLabel}</span>
                  <button className="btn-play">PLAY</button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

// ----------------------------------------------------
// Game Player View Component (Play Page)
// ----------------------------------------------------
function GamePlay({ games, playerName }) {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [paused, setPaused] = useState(false);
  const [iframeHeight, setIframeHeight] = useState('600px');
  const iframeRef = useRef(null);

  const game = games.find((g) => g.id === gameId);

  // Set up message listener for communicating with the game iframe
  useEffect(() => {
    if (!game) return;

    const handleGameMessage = async (event) => {
      const { data } = event;
      if (!data || typeof data !== 'object') return;

      switch (data.type) {
        case 'GAME_READY':
          setIframeLoaded(true);
          break;

        case 'GAME_RESIZE':
          if (data.height) {
            setIframeHeight(`${data.height}px`);
          }
          break;

        case 'GAME_OVER':
          try {
            const response = await fetch('/api/scores', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                gameId: game.id,
                playerName: playerName,
                score: Number(data.score),
                metadata: data.metadata || {}
              })
            });
            if (response.ok) {
              setRefreshTrigger((prev) => prev + 1);
            }
          } catch (err) {
            console.error('Failed to submit score', err);
          }
          break;

        case 'GAME_EXIT':
          navigate('/');
          break;

        case 'GAME_RESTART':
          if (iframeRef.current) {
            setIframeLoaded(false);
            iframeRef.current.src = iframeRef.current.src;
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('message', handleGameMessage);
    return () => {
      window.removeEventListener('message', handleGameMessage);
    };
  }, [game, playerName]);

  if (!game) {
    return (
      <main className="main-content" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>Game not found</h2>
        <button className="btn-control" onClick={() => navigate('/')} style={{ marginTop: '1.5rem' }}>
          ← Back to Home
        </button>
      </main>
    );
  }

  const handlePauseToggle = () => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    const command = paused ? 'RESUME' : 'PAUSE';
    iframeRef.current.contentWindow.postMessage({ type: command }, '*');
    setPaused(!paused);
  };

  const handleRestart = () => {
    if (iframeRef.current) {
      setIframeLoaded(false);
      setPaused(false);
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const iframeUrl = `${game.iframeUrl || `games/${game.id}/index.html`}?player=${encodeURIComponent(playerName)}`;

  return (
    <main className="main-content">
      <div className="player-page-layout">
        <div>
          <h2 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {game.name}
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              {game.scoreDirection === 'lower-is-better' ? '⬇ Lower is better' : '⬆ Higher is better'}
            </span>
          </h2>
          <div className="iframe-wrapper" style={{ height: iframeHeight, aspectRatio: 'auto' }}>
            {!iframeLoaded && (
              <div className="iframe-loading-overlay">
                <div className="spinner"></div>
                <p className="loading-label">Loading Game...</p>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={iframeUrl}
              className="game-iframe"
              title={game.name}
              allow="autoplay; keyboard"
            />
          </div>
          <div className="game-controls-bar">
            <div className="game-meta-left">
              <button className="btn-control" onClick={() => navigate('/')}>
                ← Back to Arena
              </button>
              <button className="btn-control" onClick={handlePauseToggle}>
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
            </div>
            <button className="btn-control btn-control-danger" onClick={handleRestart}>
              ↺ Restart
            </button>
          </div>
        </div>

        <div>
          <Leaderboard
            gameId={game.id}
            scoreLabel={game.scoreLabel}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>
    </main>
  );
}

// ----------------------------------------------------
// Admin Panel Component (with login gate)
// ----------------------------------------------------
function AdminPanel({ games, setGames }) {
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('adminToken') || '');
  const [secretInput, setSecretInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  // Helper: build auth headers
  const authHeaders = () => ({ 'Authorization': `Bearer ${adminToken}` });

  // Verify the admin secret against the backend
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    const value = secretInput.trim();
    if (!value) return;
    setLoginError('');
    setLoginLoading(true);
    try {
      // Lightweight check: hit an admin endpoint and see if 401
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${value}` },
      });
      if (res.ok) {
        sessionStorage.setItem('adminToken', value);
        setAdminToken(value);
      } else {
        const data = await res.json().catch(() => ({}));
        setLoginError(data.error || 'Invalid admin secret');
      }
    } catch {
      setLoginError('Connection to server failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogoutAdmin = () => {
    sessionStorage.removeItem('adminToken');
    setAdminToken('');
  };

  // ---- If not authenticated, show login gate ----
  if (!adminToken) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-logo">🔐</div>
          <h2 className="modal-title">Admin Access<span className="logo-dot">.</span></h2>
          <p className="modal-desc">Enter the admin secret to manage games.</p>
          <form onSubmit={handleAdminLogin}>
            <div className="form-group">
              <label htmlFor="admin-secret">Admin Secret</label>
              <input
                id="admin-secret"
                type="password"
                className="input-text"
                placeholder="Enter admin secret"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                required
                disabled={loginLoading}
                autoComplete="off"
              />
            </div>
            {loginError && <div className="modal-error">{loginError}</div>}
            <button type="submit" className="btn-primary" disabled={loginLoading || !secretInput.trim()}>
              {loginLoading ? 'Verifying...' : 'Unlock Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---- Authenticated admin dashboard ----
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setStatus({ type: '', text: '' });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setStatus({ type: '', text: '' });

    const formData = new FormData();
    formData.append('gameZip', file);

    try {
      const res = await fetch('/api/admin/upload-game', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });

      if (res.status === 401) { handleLogoutAdmin(); return; }

      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', text: data.message });
        setFile(null);
        const fileInput = document.getElementById('game-zip-input');
        if (fileInput) fileInput.value = '';

        const reloadRes = await fetch('/api/games');
        if (reloadRes.ok) {
          const freshGames = await reloadRes.json();
          setGames(freshGames);
        }
      } else {
        setStatus({ type: 'error', text: data.error || 'Failed to upload game.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Error uploading game. Is server running?' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (gameId) => {
    if (!window.confirm(`Are you sure you want to remove the game '${gameId}'?`)) return;

    try {
      const res = await fetch(`/api/admin/games/${gameId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (res.status === 401) { handleLogoutAdmin(); return; }

      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', text: data.message });
        setGames(games.filter((g) => g.id !== gameId));
      } else {
        setStatus({ type: 'error', text: data.error || 'Failed to delete game.' });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Connection to server failed.' });
    }
  };

  return (
    <main className="main-content">
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 className="section-title" style={{ margin: 0 }}>⚙️ Admin Panel</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-control" onClick={() => navigate('/')}>
              ← Back to Arena
            </button>
            <button className="btn-control btn-control-danger" onClick={handleLogoutAdmin}>
              🔒 Lock
            </button>
          </div>
        </div>

        {status.text && (
          <div className={`status-banner ${status.type}`} style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            borderRadius: 'var(--border-radius-sm)',
            background: status.type === 'success' ? '#2e7d32' : 'var(--color-primary)',
            color: '#fff',
            fontWeight: 600
          }}>
            {status.text}
          </div>
        )}

        {/* Upload game box */}
        <section className="dashboard-section" style={{
          background: 'var(--color-bg-elevated)',
          padding: '1.75rem',
          borderRadius: 'var(--border-radius-sm)',
          marginBottom: '2rem',
          border: '1px solid var(--color-border)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--color-text)' }}>📤 Upload New Game</h3>
          <div style={{
            fontSize: '0.88rem',
            color: 'var(--color-text-secondary)',
            marginBottom: '1.5rem',
            background: 'var(--color-bg-surface)',
            padding: '1rem',
            borderRadius: 'var(--border-radius-sm)',
            borderLeft: '4px solid var(--color-primary)'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text)' }}>💡 Instructions & Guidelines:</h4>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: '1.4rem' }}>
              <li>Must be a valid <strong>.zip</strong> file containing <code>game.json</code> and <code>index.html</code> directly at the root.</li>
              <li>Read player name via URL parameter: <code>new URLSearchParams(window.location.search).get('player')</code>.</li>
              <li>Communicate with parent frame via postMessage:
                <ul style={{ paddingLeft: '1.2rem', margin: '0.2rem 0' }}>
                  <li>Ready event: <code>window.parent.postMessage({"{"} type: 'GAME_READY' {"}"}, '*')</code></li>
                  <li>Over event: <code>window.parent.postMessage({"{"} type: 'GAME_OVER', score: number, metadata: {"{"} ... {"}"} {"}"}, '*')</code></li>
                  <li>Resize event (optional): <code>window.parent.postMessage({"{"} type: 'GAME_RESIZE', height: number {"}"}, '*')</code></li>
                </ul>
              </li>
            </ul>
            <div style={{ marginTop: '0.75rem' }}>
              <a
                href="/downloads/sample-game.zip"
                download
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: 'var(--color-primary)',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.85rem'
                }}
              >
                📥 Download Sample Game Zip Template (.zip)
              </a>
            </div>
          </div>

          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              id="game-zip-input"
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              required
              style={{
                background: 'var(--color-bg-surface)',
                border: '1.5px dashed var(--color-border)',
                padding: '1.5rem',
                borderRadius: 'var(--border-radius-sm)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            />
            {file && (
              <div style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)' }}>
                Selected file: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
              </div>
            )}
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !file}
              style={{ width: 'fit-content', padding: '0.75rem 2rem' }}
            >
              {loading ? 'Uploading & Extracting...' : 'Upload Game'}
            </button>
          </form>
        </section>

        {/* Manage games box */}
        <section className="dashboard-section" style={{
          background: 'var(--color-bg-elevated)',
          padding: '1.75rem',
          borderRadius: 'var(--border-radius-sm)',
          border: '1px solid var(--color-border)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--color-text)' }}>🎮 Installed Games</h3>
          {games.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>No games installed.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {games.map((g) => (
                <div key={g.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--color-bg-surface)',
                  padding: '1rem',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '1.75rem' }}>{g.icon}</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem' }}>{g.name}</h4>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                        ID: <code>{g.id}</code> | {g.scoreLabel}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-control btn-control-danger"
                    onClick={() => handleDelete(g.id)}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}


// ----------------------------------------------------
// Main App Component
// ----------------------------------------------------
function App() {
  const [playerName, setPlayerName] = useState(() => sessionStorage.getItem('player') || '');
  const [games, setGames] = useState([]);
  const { theme, toggleTheme } = useTheme();

  // Load available games registry
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch('/api/games');
        if (response.ok) {
          const data = await response.json();
          setGames(data);
        }
      } catch (err) {
        console.error('Failed to load games config:', err);
      }
    };
    fetchGames();
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('player');
    setPlayerName('');
  };

  return (
    <HashRouter>
      <div className="app-container">
        <Header
          playerName={playerName}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <Routes>
          <Route
            path="/"
            element={!playerName ? <AuthModal onNameSet={setPlayerName} /> : <GameList games={games} />}
          />
          <Route
            path="/game/:gameId"
            element={!playerName ? <AuthModal onNameSet={setPlayerName} /> : <GamePlay games={games} playerName={playerName} />}
          />
          <Route
            path="/admin"
            element={<AdminPanel games={games} setGames={setGames} />}
          />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;
