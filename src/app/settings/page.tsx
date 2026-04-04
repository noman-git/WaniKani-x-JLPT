"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/wanikani/sync", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setSyncResult(`❌ Error: ${data.error}`);
      } else {
        setSyncResult(
          `✅ Synced successfully!\n` +
          `Total subjects fetched: ${data.stats.totalFetched}\n` +
          `Matched to JLPT items: ${data.stats.matchedToJLPT}\n` +
          `Not in JLPT lists: ${data.stats.notInJLPT}`
        );
      }
    } catch {
      setSyncResult("❌ Sync failed. Check your network and API token.");
    }
    setSyncing(false);
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your WaniKani integration</p>
      </div>

      <div className="card settings-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>WaniKani API Token</h3>
        <div className="form-group">
          <label className="form-label">API Token</label>
          <div className="form-input" style={{ color: "var(--text-muted)", userSelect: "none" }}>
            ••••••••••••••••••••••••••• (stored in .env)
          </div>
          <div className="form-hint">
            Your token is stored in the <code>.env</code> file at the project root.
            Get your token from{" "}
            <a
              href="https://www.wanikani.com/settings/personal_access_tokens"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent-n5)" }}
            >
              WaniKani Settings → API Tokens
            </a>
          </div>
        </div>
      </div>

      <div className="card settings-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Sync with WaniKani</h3>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
          Fetch your WaniKani subjects and match them against JLPT N4/N5 items.
          This will identify which items you&apos;re already studying on WaniKani.
        </p>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          ⚠️ This may take 15-30 seconds due to WaniKani API rate limits (60 req/min).
        </p>
        <button className="btn btn-primary" onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <>
              <span className="loading-spinner" /> Syncing... (this takes a moment)
            </>
          ) : (
            "🔄 Sync Now"
          )}
        </button>
        {syncResult && (
          <pre
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-glass)",
              border: "1px solid var(--border-subtle)",
              fontSize: 13,
              color: "var(--text-secondary)",
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
            }}
          >
            {syncResult}
          </pre>
        )}
      </div>

      <div className="card settings-card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>About</h3>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          This dashboard tracks JLPT N4 and N5 kanji and vocabulary from community-curated lists.
          It integrates with WaniKani to show which items you&apos;re already studying there.
        </p>
        <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
          <strong>Data Sources:</strong>
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.8 }}>
            <li>
              <a href="https://github.com/jamsinclair/open-anki-jlpt-decks" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-n5)" }}>
                open-anki-jlpt-decks
              </a>{" "}
              — Tanos-based vocabulary lists
            </li>
            <li>
              <a href="https://docs.api.wanikani.com/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-n5)" }}>
                WaniKani API v2
              </a>{" "}
              — Subject matching
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
