"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RANKS } from "@/lib/srs/ranks";

type LevelStages = {
  stage1: number; stage2: number; stage3: number;
  stage4: number; stage5: number; stage6: number;
  stage7: number; stage8: number; stage9: number;
};

interface SrsStats {
  upcomingLessons: number;
  dueReviews: number;
  levels: Record<string, LevelStages>;
  grammarLessons?: number;
  grammarReviews?: number;
}

function ActionTile({
  eyebrow,
  count,
  caption,
  glyph,
  href,
  disabled,
  router,
  accent,
}: {
  eyebrow: string;
  count: number;
  caption: string;
  glyph: string;
  href: string;
  disabled?: boolean;
  router: ReturnType<typeof useRouter>;
  accent: "vermillion" | "indigo" | "moss" | "clay";
}) {
  const accentVar = `var(--${accent})`;
  return (
    <button
      onClick={() => !disabled && router.push(href)}
      disabled={disabled}
      className="srs-action-btn"
      style={{ ['--tile-accent' as string]: accentVar } as React.CSSProperties}
    >
      <span className="srs-action-title">{eyebrow}</span>
      <span className="srs-action-count">{count.toString().padStart(2, "0")}</span>
      <span style={{
        fontFamily: "var(--font-display)",
        fontStyle: "italic",
        fontSize: 14,
        color: "var(--ink-faded)",
        marginTop: 8,
      }}>
        {caption}
      </span>
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 18,
          bottom: 14,
          fontFamily: "var(--font-jp)",
          fontSize: 96,
          color: accentVar,
          opacity: 0.08,
          lineHeight: 1,
          pointerEvents: "none",
          fontWeight: 600,
        }}
      >
        {glyph}
      </span>
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [srsStats, setSrsStats] = useState<SrsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/srs/stats")
      .then(r => r.json())
      .then(data => {
         if (mounted) {
           setSrsStats(data);
           setLoading(false);
         }
      })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span>Loading folio…</span>
      </div>
    );
  }

  const now = new Date();
  const dateMark = now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }).toUpperCase();

  const lessonsTotal = (srsStats?.upcomingLessons || 0) + (srsStats?.grammarLessons || 0);
  const reviewsTotal = (srsStats?.dueReviews || 0) + (srsStats?.grammarReviews || 0);

  return (
    <>
      {/* Folio intro — editorial title row */}
      <section className="intro-row">
        <div>
          <div className="intro-eyebrow">
            Folio 第一 · the study desk
          </div>
          <h1 className="intro-title">
            Today&apos;s <em>desk.</em>
          </h1>
          <p style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 18,
            color: "var(--ink-soft)",
            maxWidth: 520,
            marginTop: 22,
            lineHeight: 1.5,
          }}>
            {lessonsTotal + reviewsTotal === 0
              ? "Nothing waits at the desk today — return tomorrow, or browse a folio of your choosing."
              : <>{lessonsTotal} fresh {lessonsTotal === 1 ? "lesson" : "lessons"} and {reviewsTotal} {reviewsTotal === 1 ? "review" : "reviews"} are set out, ready for ink.</>}
          </p>
        </div>
        <aside className="intro-aside">
          <div className="intro-aside-vert">勉強日記</div>
          <div className="intro-aside-meta">
            <div><span>—</span> {dateMark}</div>
            <div>folio <span>no.</span> 01</div>
            <div>edition <span>·</span> daily</div>
          </div>
        </aside>
      </section>

      {/* Action tiles — vermillion-stamped counts */}
      <div className="section-heading" style={{ marginTop: 48 }}>
        <div className="section-heading-title">
          <span>I.</span> <em>The Desk</em>
        </div>
        <div className="section-heading-meta">four queues</div>
      </div>

      <div className="srs-dashboard-cards">
        <ActionTile
          router={router}
          eyebrow="Lessons · Items"
          count={srsStats?.upcomingLessons || 0}
          caption="kanji, vocabulary, radicals awaiting first introduction"
          glyph="字"
          href="/learn"
          accent="vermillion"
        />
        <ActionTile
          router={router}
          eyebrow="Reviews · Items"
          count={srsStats?.dueReviews || 0}
          caption="ready for re-examination"
          glyph="復"
          href="/review"
          disabled={!srsStats?.dueReviews}
          accent="indigo"
        />
        <ActionTile
          router={router}
          eyebrow="Lessons · Grammar"
          count={srsStats?.grammarLessons || 0}
          caption="new grammatical patterns"
          glyph="文"
          href="/grammar-learn"
          accent="moss"
        />
        <ActionTile
          router={router}
          eyebrow="Reviews · Grammar"
          count={srsStats?.grammarReviews || 0}
          caption="patterns due for cloze quiz"
          glyph="法"
          href="/grammar-review"
          disabled={!srsStats?.grammarReviews}
          accent="clay"
        />
      </div>

      {/* Mastery breakdown — 9 ranks (F → SSS) per JLPT level */}
      {srsStats?.levels && ["N5", "N4", "Other"].map((level, idx) => {
        const lv = srsStats.levels[level];
        if (!lv) return null;
        const total = RANKS.reduce((a, r) => a + (lv[`stage${r.stage}` as keyof typeof lv] || 0), 0);
        if (total === 0) return null;

        return (
          <section key={level} style={{ marginTop: idx === 0 ? 0 : 8 }}>
            <div className="section-heading">
              <div className="section-heading-title">
                <span>{["II.", "III.", "IV."][idx] || `${idx + 2}.`}</span>
                <em>Mastery</em>
                <span style={{
                  fontFamily: "var(--font-jp)",
                  fontSize: 22,
                  color: "var(--vermillion)",
                  letterSpacing: 0,
                  marginLeft: 4,
                }}>
                  {level}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "var(--ink-faded)",
                  fontStyle: "normal",
                  marginLeft: 12,
                }}>
                  · by rank
                </span>
              </div>
              <div className="section-heading-meta">
                {total} {total === 1 ? "item" : "items"}
              </div>
            </div>

            <div className="rank-row">
              {RANKS.map(({ stage, rank }) => {
                const val = lv[`stage${stage}` as keyof typeof lv] || 0;
                const pct = total > 0 ? (val / total) * 100 : 0;
                const isClickable = val > 0;
                return (
                  <button
                    key={stage}
                    type="button"
                    data-rank={rank}
                    onClick={isClickable
                      ? () => router.push(`/mastery?level=${level}&stage=${stage}`)
                      : undefined}
                    disabled={!isClickable}
                    className={`rank-chip ${isClickable ? "rank-chip--filled" : ""}`}
                    style={{ ['--rank-fill' as string]: `${pct}%` } as React.CSSProperties}
                    title={isClickable ? `${val} items · stage ${stage}` : `No items at rank ${rank}`}
                  >
                    <span className="rank-chip-letter">{rank}</span>
                    <span className="rank-chip-count">{val}</span>
                    <span className="rank-chip-pct">{Math.round(pct)}%</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Footer colophon */}
      <footer style={{
        marginTop: 88,
        paddingTop: 24,
        borderTop: "1px solid var(--rule)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 16,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color: "var(--ink-faded)",
      }}>
        <div>
          <span style={{ color: "var(--vermillion)" }}>※</span>{" "}
          set in fraunces · ibm plex · shippori mincho
        </div>
        <div style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontSize: 14,
          letterSpacing: 0,
          textTransform: "none",
          color: "var(--ink-soft)",
        }}>
          一日一字 — one character a day.
        </div>
      </footer>
    </>
  );
}
