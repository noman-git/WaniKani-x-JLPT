"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ItemModal from "@/app/components/ItemModal";
import { RANKS, rankForStage } from "@/lib/srs/ranks";

interface Item {
  id: number;
  expression: string;
  reading: string;
  meaning: string;
  type: string;
  jlptLevel: string;
  status: string;
  srsStage: number | null;
  wkSubjectId: number | null;
  wkLevel: number | null;
  wkCharacters: string | null;
  matchType: string | null;
}

function MasteryView() {
  const sp = useSearchParams();
  const router = useRouter();
  const level = sp.get("level") || "N5";
  const stageParam = sp.get("stage") || "5";
  const stage = /^[1-9]$/.test(stageParam) ? parseInt(stageParam, 10) : 5;
  const rank = rankForStage(stage) || "B";

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalId, setModalId] = useState<number | null>(null);

  const apiLevel = level === "Other" ? "other" : level;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/items?level=${encodeURIComponent(apiLevel)}&stage=${stage}&limit=500`);
      const data = await res.json();
      setItems(data.items || []);
    } catch { /* */ }
    setLoading(false);
  }, [apiLevel, stage]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <section className="intro-row">
        <div>
          <div className="intro-eyebrow">
            <span style={{ color: "var(--vermillion)" }}>{level}</span> · STAGE {stage} · RANK {rank}
          </div>
          <h1 className="intro-title">
            Rank <em style={{ color: "var(--vermillion)" }}>{rank}.</em>
          </h1>
          <p style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 18,
            color: "var(--ink-soft)",
            marginTop: 22,
            lineHeight: 1.5,
            maxWidth: 560,
          }}>
            {loading
              ? "Gathering folio…"
              : items.length === 0
                ? "Nothing in this rank yet."
                : <>{items.length} {items.length === 1 ? "item rests" : "items rest"} at rank {rank} of {level}.</>}
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => router.push("/")} className="btn btn-outline btn-sm">← Dashboard</button>
            {RANKS.map(r => (
              <button
                key={r.stage}
                onClick={() => router.push(`/mastery?level=${level}&stage=${r.stage}`)}
                className={`filter-btn ${r.stage === stage ? "active" : ""}`}
                title={`Stage ${r.stage}`}
              >
                {r.rank}
              </button>
            ))}
          </div>
        </div>
        <aside className="intro-aside">
          <div className="intro-aside-vert">{rank}段</div>
          <div className="intro-aside-meta">
            <div><span>level</span> · <span style={{ color: "var(--ink)" }}>{level}</span></div>
            <div><span>rank</span> · <span style={{ color: "var(--ink)" }}>{rank}</span></div>
            <div><span>stage</span> · <span style={{ color: "var(--ink)" }}>{stage}</span></div>
            <div><span>—</span> <span style={{ color: "var(--vermillion)" }}>{items.length} items</span></div>
          </div>
        </aside>
      </section>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
          <span>Loading…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">○</div>
          <div className="empty-state-text">No items at this rank yet.</div>
          <p style={{ color: "var(--ink-faded)", fontFamily: "var(--font-display)", fontStyle: "italic", marginTop: 6 }}>
            Keep reviewing — they&apos;ll arrive in their own time.
          </p>
        </div>
      ) : (
        <div className="items-grid" style={{ marginTop: 32 }}>
          {items.map((item) => (
            <div key={item.id} className="item-card" data-type={item.type} onClick={() => setModalId(item.id)}>
              <div className="item-card-header">
                <div className="item-expression-col">
                  <div className="item-expression" style={{ color: `var(--accent-${item.type})` }}>{item.expression}</div>
                </div>
                {item.srsStage !== null && (
                  <span className="badge" style={{ color: "var(--vermillion)" }}>
                    {rankForStage(item.srsStage) ?? `St.${item.srsStage}`}
                  </span>
                )}
              </div>
              {item.reading && <div className="item-reading">{item.reading}</div>}
              <div className="item-meaning">{item.meaning}</div>
              <div className="item-meta">
                <span className={`badge badge-${item.jlptLevel.toLowerCase()}`}>{item.jlptLevel}</span>
                <span className={`badge badge-${item.type}`}>
                  {item.type === "kanji" ? "漢字" : item.type === "radical" ? "部首" : "語彙"}
                </span>
                {item.wkSubjectId && item.matchType !== "pseudo" && (
                  <span className="badge badge-wk">WK Lv.{item.wkLevel}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalId !== null && (
        <ItemModal
          target={{ type: "item", id: modalId }}
          onClose={() => { setModalId(null); load(); }}
          onNavigateItem={(id: number) => setModalId(id)}
          onNavigateRadical={() => {}}
        />
      )}
    </>
  );
}

export default function MasteryPage() {
  return (
    <Suspense fallback={
      <div className="loading-container"><div className="loading-spinner" /><span>Loading…</span></div>
    }>
      <MasteryView />
    </Suspense>
  );
}
