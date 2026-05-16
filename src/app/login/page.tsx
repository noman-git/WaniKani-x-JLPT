"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/AuthProvider";

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    let err: string | null;
    if (mode === "login") {
      err = await login(username, password);
    } else {
      err = await register(username, password, displayName, inviteCode);
    }

    if (err) {
      setError(err);
      setSubmitting(false);
    } else {
      router.push("/");
    }
  };

  const now = new Date();
  const dateMark = now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }).toUpperCase();

  return (
    <div className="login-page">
      {/* Left — form */}
      <div className="login-card">
        <div className="login-header">
          <div className="login-subtitle" style={{ marginBottom: 18 }}>
            Folio · a study journal
          </div>
          <h1 className="login-title">
            {mode === "login" ? <>Welcome <em style={{ color: "var(--vermillion)", fontStyle: "italic" }}>back.</em></> : <>Open a <em style={{ color: "var(--vermillion)", fontStyle: "italic" }}>new folio.</em></>}
          </h1>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setError(null); }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`login-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => { setMode("register"); setError(null); }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {mode === "register" && (
            <div className="form-group">
              <label className="form-label">Invite code</label>
              <input
                type="text"
                className="form-input"
                placeholder="given by the keeper"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              placeholder="your handle"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              autoComplete="username"
            />
          </div>

          {mode === "register" && (
            <div className="form-group">
              <label className="form-label">Display name</label>
              <input
                type="text"
                className="form-input"
                placeholder="how the desk shall greet you"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <div className="login-error">{error}</div>
          )}

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={submitting}
          >
            {submitting
              ? "One moment…"
              : mode === "login"
              ? "Enter the folio →"
              : "Open the folio →"}
          </button>
        </form>

        <p className="login-footer">
          {mode === "login" ? (
            <>No folio yet? Ask the keeper for an invite code.</>
          ) : (
            <>An invite code from the keeper is required to register a new folio.</>
          )}
        </p>
      </div>

      {/* Right — journal cover */}
      <aside className="login-cover" aria-hidden>
        <div className="login-cover-folio">
          Folio <span>no.</span> 0001 ·· edition i.
        </div>
        <div className="login-cover-vertical">日本語勉強日記</div>

        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          padding: 40,
          position: "relative",
        }}>
          <div className="login-cover-kanji">語</div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 22,
            color: "var(--ink-soft)",
            letterSpacing: "-0.01em",
            textAlign: "center",
            maxWidth: 360,
            lineHeight: 1.4,
          }}>
            “Language is a folio<br />
            of small attentions,<br />
            <span style={{ color: "var(--vermillion)" }}>kept by patient hands.</span>”
          </div>
        </div>

        <div className="login-cover-hanko">印</div>

        <div className="login-cover-meta">
          <div className="login-cover-meta-row">
            <span>date</span><span>·</span><span style={{ color: "var(--ink)" }}>{dateMark}</span>
          </div>
          <div className="login-cover-meta-row">
            <span>set in</span><span>·</span><span style={{ color: "var(--ink)" }}>Fraunces · Plex · Mincho</span>
          </div>
          <div className="login-cover-meta-row">
            <span>—</span><span style={{ color: "var(--vermillion)" }}>JLPT N4 · N5</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
