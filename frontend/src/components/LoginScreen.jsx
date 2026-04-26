import React, { useState } from 'react';
import { API } from '../api';

export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid password');
        return;
      }
      localStorage.setItem('auth_token', data.token);
      onLogin(data.token);
    } catch {
      setError('Could not reach server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.bg} />
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logoMark} />
          <span style={styles.logoText}>NEON</span>
        </div>
        <p style={styles.subtitle}>Enter your password to continue</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={styles.input}
            autoFocus
            autoComplete="current-password"
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading || !password} style={styles.btn}>
            {loading ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#06060f',
    zIndex: 9999,
  },
  bg: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 70% 50% at 50% 60%, rgba(255,110,0,0.10) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    width: 360,
    padding: '40px 36px',
    background: 'rgba(20, 8, 0, 0.70)',
    border: '1px solid rgba(255,110,0,0.28)',
    borderRadius: 20,
    backdropFilter: 'blur(24px)',
    boxShadow: '0 0 0 1px rgba(255,110,0,0.12), 0 24px 64px rgba(0,0,0,0.7)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
  },
  logoMark: {
    width: 10, height: 10,
    borderRadius: '50%',
    background: '#ff6e00',
    boxShadow: '0 0 12px 3px rgba(255,110,0,0.6)',
  },
  logoText: {
    fontFamily: "'Orbitron', sans-serif",
    fontSize: 18, fontWeight: 700, letterSpacing: '0.18em',
    color: '#ffffff',
  },
  subtitle: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 13, color: 'rgba(255,140,60,0.65)',
    margin: '0 0 28px',
    textAlign: 'center',
  },
  form: {
    width: '100%', display: 'flex', flexDirection: 'column', gap: 12,
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '11px 14px',
    background: 'rgba(0,0,0,0.50)',
    border: '1px solid rgba(255,110,0,0.28)',
    borderRadius: 10,
    color: '#ffffff',
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.18s',
  },
  error: {
    margin: 0,
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    color: '#ff3d5a',
    textAlign: 'center',
  },
  btn: {
    width: '100%', marginTop: 4,
    padding: '11px 0',
    background: '#ff6e00',
    border: 'none',
    borderRadius: 10,
    color: '#ffffff',
    fontFamily: "'Inter', sans-serif",
    fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.18s, opacity 0.18s',
  },
};
