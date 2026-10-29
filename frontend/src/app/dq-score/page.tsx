'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { api } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import TopHeader from '@/components/TopHeader';

interface DqScoreResponse {
  payPeriod: string;
  totalRows: number;
  flaggedRows: number;
  dqScore: number;
}

function downloadCsv(headers: string[], rows: (string | number | null)[][], filename: string) {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

export default function DqScorePage() {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [monthInput, setMonthInput] = useState('');
  const [payPeriod, setPayPeriod] = useState('');
  const [focused, setFocused] = useState(false);
  const [data, setData] = useState<DqScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    setAuthorized(true);
    api.get<{ payPeriod: string }>('/dashboard/latest-month')
      .then((r) => {
        const period = r.payPeriod || '2020-01';
        setMonthInput(period);
        setPayPeriod(period);
        load(period);
      })
      .catch(() => {
        setMonthInput('2020-01');
        setPayPeriod('2020-01');
        load('2020-01');
      });
  }, [router]);

  const load = async (periodArg?: string) => {
    const raw = typeof periodArg === 'string' ? periodArg : monthInput;
    const period = String(raw ?? '').trim();
    if (!/^\d{4}-\d{2}$/.test(period)) {
      setError('Enter the month as YYYY-MM, then click Load.');
      return;
    }
    setPayPeriod(period);
    setLoading(true);
    setError('');
    try {
      const res = await api.get<DqScoreResponse>(`/rules/dq-score?payPeriod=${period}`);
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load DQ score');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const rows = await api.get<Record<string, string>[]>(`/dashboard/export?payPeriod=${payPeriod}`);
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    downloadCsv(headers, rows.map((r) => headers.map((h) => r[h] ?? '')), `payroll-anomalies-${payPeriod}.csv`);
  };

  const dqColor = (s: number) => s >= 90 ? '#16a34a' : s >= 70 ? '#f59e0b' : '#dc2626';
  const dqBg = (s: number) => s >= 90 ? '#dcfce7' : s >= 70 ? '#fffbeb' : '#fef2f2';
  const dqLabel = (s: number) => s >= 90 ? 'Excellent' : s >= 70 ? 'Acceptable' : 'Needs Attention';

  if (!authorized) return null;

  return (
    <div style={styles.pageWrapper}>
      <Sidebar currentPath={pathname} />
      <div style={styles.rightColumn}>
        <TopHeader />
        <main style={styles.main}>
          <div style={styles.pageHeading}>
            <div>
              <h1 style={styles.pageTitle}>Data Quality Score</h1>
              <p style={styles.pageSubtitle}>Overall payroll data quality for a given pay period</p>
            </div>
            <div style={styles.headingActions}>
              <div style={styles.periodRow}>
                <input style={styles.periodInput} type="text" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={focused || monthInput ? '' : 'YYYY-MM'} />
                <button style={styles.loadBtn} onClick={() => load()} disabled={loading}>{loading ? 'Loading…' : 'Load Report'}</button>
                <button style={styles.exportBtn} onClick={handleExport} disabled={!payPeriod}>Export Report</button>
              </div>
            </div>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          {data && data.totalRows === 0 && (
            <div style={styles.noDataCard}>
              <div style={styles.noDataIcon}>
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={1.8}>
                  <path d="M9 17v-6m3 6V7m3 10v-3" />
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                </svg>
              </div>
              <h2 style={styles.noDataTitle}>No data found</h2>
              <p style={styles.noDataText}>There are no payroll records for {data.payPeriod}. Import attendance for this month, then load the report again.</p>
            </div>
          )}

          {data && data.totalRows > 0 && (
            <>
              {/* Score hero card */}
              <div style={{ ...styles.heroCard, background: dqBg(data.dqScore), borderColor: dqColor(data.dqScore) }}>
                <div style={styles.heroLeft}>
                  <p style={styles.heroLabel}>Pay Period: {data.payPeriod}</p>
                  <div style={{ ...styles.heroScore, color: dqColor(data.dqScore) }}>{data.dqScore}%</div>
                  <span style={{ ...styles.heroStatusBadge, background: dqColor(data.dqScore), color: '#fff' }}>
                    {dqLabel(data.dqScore)}
                  </span>
                </div>
                <div style={styles.heroRight}>
                  <div style={styles.progressContainer}>
                    <div style={styles.progressTrack}>
                      <div style={{ ...styles.progressFill, width: `${data.dqScore}%`, background: dqColor(data.dqScore) }} />
                    </div>
                    <div style={styles.progressLabels}>
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div style={styles.statsGrid}>
                {[
                  { label: 'Total Rows', value: data.totalRows, color: '#2563eb', bg: '#dbeafe' },
                  { label: 'Flagged Rows', value: data.flaggedRows, color: '#dc2626', bg: '#fee2e2' },
                  { label: 'Clean Rows', value: data.totalRows - data.flaggedRows, color: '#16a34a', bg: '#dcfce7' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} style={{ ...styles.statCard, borderTop: `3px solid ${color}` }}>
                    <div style={{ ...styles.statNum, color }}>{value}</div>
                    <div style={styles.statLabel}>{label}</div>
                    <div style={{ ...styles.statBar, background: '#f1f5f9' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: bg, width: `${data.totalRows > 0 ? (value / data.totalRows) * 100 : 0}%`, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!data && !loading && !error && (
            <div style={styles.emptyState}>
              <p style={{ color: '#94a3b8', fontSize: 14 }}>Enter a pay period and click Load Score</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageWrapper: { display: 'flex', minHeight: '100vh', background: '#f1f5f9' },
  rightColumn: { marginLeft: 260, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  main: { flex: 1, padding: '32px 40px' },
  pageHeading: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 },
  pageTitle: { margin: '0 0 4px', fontSize: 26, fontWeight: 700, color: '#0f172a' },
  pageSubtitle: { margin: 0, fontSize: 13, color: '#64748b' },
  headingActions: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 },
  periodRow: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 8, boxShadow: '0 1px 3px rgba(15,23,42,.06)' },
  periodInput: { padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: 168, background: '#fff', outline: 'none', color: '#0f172a' },
  loadBtn: { padding: '9px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  exportBtn: { display: 'flex', alignItems: 'center', padding: '9px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  errorBox: { padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 20 },
  heroCard: { borderRadius: 16, padding: '32px 40px', border: '2px solid', display: 'flex', gap: 40, alignItems: 'center', marginBottom: 24 },
  heroLeft: { display: 'flex', flexDirection: 'column', gap: 8 },
  heroLabel: { margin: 0, fontSize: 13, fontWeight: 600, color: '#64748b' },
  heroScore: { fontSize: 72, fontWeight: 800, lineHeight: 1, margin: '4px 0' },
  heroStatusBadge: { display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, width: 'fit-content' },
  heroRight: { flex: 1 },
  progressContainer: {},
  progressTrack: { height: 16, background: 'rgba(255,255,255,0.6)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 8, transition: 'width 0.6s ease' },
  progressLabels: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 },
  statCard: { background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' },
  statNum: { fontSize: 32, fontWeight: 700, marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 },
  statBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, gap: 12 },
  noDataCard: { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', padding: '56px 32px', textAlign: 'center', maxWidth: 560, margin: '24px auto' },
  noDataIcon: { width: 64, height: 64, borderRadius: 16, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  noDataTitle: { margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#0f172a' },
  noDataText: { margin: 0, fontSize: 14, lineHeight: 1.6, color: '#64748b' },
};