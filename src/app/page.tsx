"use client";

import { useState, useEffect, useCallback } from "react";

interface Stats {
  level: string;
  type: string;
  total: number;
  known: number;
  learning: number;
  onWanikani: number;
}

function ProgressRing({ percent, size = 100, stroke = 8, color }: { percent: number; size?: number; stroke?: number; color: string }) {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="progress-ring-container">
      <svg className="progress-ring" width={size} height={size}>
        <circle className="progress-ring-bg" strokeWidth={stroke} r={radius} cx={size / 2} cy={size / 2} />
        <circle
          className="progress-ring-fill"
          strokeWidth={stroke}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
        />
      </svg>
      <span style={{ fontSize: "20px", fontWeight: 700, color }}>{Math.round(percent)}%</span>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/items?limit=1");
      const data = await res.json();
      setStats(data.stats || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/wanikani/sync", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setSyncResult(`Error: ${data.error}`);
      } else {
        setSyncResult(`Synced ${data.stats.totalFetched} items — ${data.stats.matchedToJLPT} matched to JLPT`);
        loadStats();
      }
    } catch (error) {
      setSyncResult("Sync failed. Check your API token.");
    }
    setSyncing(false);
  };

  const getStats = (level: string, type: string) => {
    return stats.find((s) => s.level === level && s.type === type) || { total: 0, known: 0, learning: 0, onWanikani: 0 };
  };

  const totalItems = stats.reduce((sum, s) => sum + s.total, 0);
  const totalKnown = stats.reduce((sum, s) => sum + s.known, 0);
  const totalLearning = stats.reduce((sum, s) => sum + s.learning, 0);
  const totalOnWk = stats.reduce((sum, s) => sum + s.onWanikani, 0);
  const overallPercent = totalItems > 0 ? ((totalKnown / totalItems) * 100) : 0;

  const n5k = getStats("N5", "kanji");
  const n5v = getStats("N5", "vocab");
  const n4k = getStats("N4", "kanji");
  const n4v = getStats("N4", "vocab");

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">JLPT Study Dashboard</h1>
        <p className="page-subtitle">Track your N4 & N5 kanji and vocabulary mastery</p>
      </div>

      {/* Sync Banner */}
      <div className="sync-banner">
        <div className="sync-banner-text">
          <strong>WaniKani Sync</strong> — Connect your WaniKani account to see which JLPT items you&apos;re already studying.
          {syncResult && <div style={{ marginTop: 8 }}>{syncResult}</div>}
        </div>
        <button className="btn btn-primary" onClick={handleSync} disabled={syncing}>
          {syncing ? <><span className="loading-spinner" /> Syncing...</> : "🔄 Sync Now"}
        </button>
      </div>

      {/* Overview Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--accent-known)" }}>{totalKnown}</div>
          <div className="stat-label">Known</div>
          <div className="stat-sub">of {totalItems} total items</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--accent-learning)" }}>{totalLearning}</div>
          <div className="stat-label">Learning</div>
          <div className="stat-sub">in progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--accent-blue)" }}>{totalOnWk}</div>
          <div className="stat-label">On WaniKani</div>
          <div className="stat-sub">matched items</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--accent-danger)" }}>{totalItems - totalOnWk}</div>
          <div className="stat-label">Not on WK</div>
          <div className="stat-sub">study elsewhere</div>
        </div>
      </div>

      {/* Progress by Level & Type */}
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, letterSpacing: "-0.5px" }}>Progress by Category</h2>
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
        {[
          { label: "N5 Kanji", stats: n5k, color: "var(--accent-n5)", badgeClass: "badge-n5" },
          { label: "N5 Vocabulary", stats: n5v, color: "var(--accent-n5)", badgeClass: "badge-n5" },
          { label: "N4 Kanji", stats: n4k, color: "var(--accent-n4)", badgeClass: "badge-n4" },
          { label: "N4 Vocabulary", stats: n4v, color: "var(--accent-n4)", badgeClass: "badge-n4" },
        ].map(({ label, stats: s, color, badgeClass }) => {
          const pct = s.total > 0 ? (s.known / s.total) * 100 : 0;
          return (
            <div key={label} className="card" style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <ProgressRing percent={pct} size={90} stroke={7} color={color} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{label}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="badge badge-known">{s.known} known</span>
                  <span className="badge badge-learning">{s.learning} learning</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                  {s.total} total · {s.onWanikani} on WK
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
