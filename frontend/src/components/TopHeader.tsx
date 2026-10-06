'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, getRole, getUsername, openPowerBiSignOut } from '@/lib/auth';

export default function TopHeader() {
  const router = useRouter();
  const username = getUsername() ?? '';
  const role = getRole() ?? '';
  const initials = username.slice(0, 2).toUpperCase() || 'U';
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const logout = () => {
    clearSession();
    openPowerBiSignOut();
    router.push('/login');
  };

  return (
    <header style={styles.header}>
      <div style={styles.searchWrapper}>
        <span style={styles.searchIcon}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input style={styles.searchInput} type="text" placeholder="Search…" />
      </div>

      <div style={styles.rightControls}>
        <button style={styles.iconBtn} title="Notifications">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={2}>
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </button>

        <button style={styles.iconBtn} title="Settings">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={2}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>

        <div ref={box} style={styles.avatarWrapper}>
          <button style={styles.avatarButton} onClick={() => setOpen((v) => !v)} aria-label="Account menu">
            <div style={styles.avatar}>{initials}</div>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={2}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {open && (
            <div style={styles.dropdown}>
              <div style={styles.who}>{username}</div>
              <div style={styles.role}>{role}</div>
              <button style={styles.logout} onClick={logout}>Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    background: '#fff',
    padding: '0 40px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    flexShrink: 0,
  },
  searchWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: 12, display: 'flex', alignItems: 'center', pointerEvents: 'none' },
  searchInput: {
    background: '#f1f5f9',
    border: 'none',
    borderRadius: 20,
    padding: '8px 16px 8px 38px',
    fontSize: 14,
    color: '#374151',
    width: 280,
    outline: 'none',
  },
  rightControls: { display: 'flex', alignItems: 'center', gap: 8 },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrapper: { position: 'relative' },
  avatarButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: '#2563eb',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: 48,
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    minWidth: 180,
    boxShadow: '0 8px 24px rgba(15,23,42,.12)',
    padding: 10,
    zIndex: 300,
  },
  who: { fontSize: 13, fontWeight: 700, color: '#0f172a' },
  role: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  logout: {
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: '#fee2e2',
    color: '#b91c1c',
    borderRadius: 6,
    padding: '8px 10px',
    cursor: 'pointer',
    fontWeight: 600,
  },
};