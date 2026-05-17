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

      <div className="settings-card" style={{ marginBottom: 24 }}>
        <h3 style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--vermillion)",
          marginBottom: 12,
        }}>
          Account
        </h3>
        <div className="form-group">
          <label className="form-label">Username</label>
          <div className="form-input" style={{ color: "var(--ink-soft)" }}>
            {user?.username}
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3 style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--vermillion)",
          marginBottom: 12,
        }}>
          About
        </h3>
        <p style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontSize: 15,
          color: "var(--ink-soft)",
          lineHeight: 1.5,
        }}>
          Folio is a self-hosted study journal for JLPT N5 &amp; N4 — kanji, vocabulary, radicals, and grammar — with WaniKani-style SRS layered on top of community-curated reference data.
        </p>
        <div style={{
          marginTop: 16,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--ink-faded)",
        }}>
          Sources · {" "}
          <a href="https://github.com/jamsinclair/open-anki-jlpt-decks" target="_blank" rel="noopener noreferrer" style={{ color: "var(--vermillion)", textDecoration: "underline" }}>
            open-anki-jlpt-decks
          </a>{" "}
          ·{" "}
          <a href="https://docs.api.wanikani.com/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--vermillion)", textDecoration: "underline" }}>
            WaniKani API
          </a>
        </div>
      </div>
    </>
  );
}
