"use client";

import { useAuth } from "@/app/components/AuthProvider";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Your account and app info</p>
      </div>

      <div className="card settings-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Account</h3>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="form-input" style={{ color: "var(--text-secondary)" }}>
              {user?.username}
            </div>
          </div>
        </div>
      </div>

      <div className="card settings-card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>About</h3>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          This dashboard tracks JLPT N4 and N5 kanji and vocabulary from community-curated lists.
          It includes WaniKani data for meanings, readings, mnemonics, and radicals.
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
              — Meanings, readings, mnemonics &amp; radicals
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
