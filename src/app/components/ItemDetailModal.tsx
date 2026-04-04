"use client";

import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";

// ── Types ────────────────────────────────────────────────────

interface WKMeaning {
  meaning: string;
  primary: boolean;
  accepted_answer: boolean;
}

interface WKReading {
  reading: string;
  type: string | null; // "onyomi" | "kunyomi" | "nanori"
  primary: boolean;
  accepted_answer: boolean;
}

interface Radical {
  id: number;
  characters: string | null;
  meaning: string;
  imageUrl: string | null;
  level: number;
}

interface ItemDetail {
  item: {
    id: number;
    expression: string;
    reading: string;
    meaning: string;
    type: string;
    jlptLevel: string;
    status: string;
  };
  wanikani: {
    subjectId: number;
    level: number;
    objectType: string;
    meanings: WKMeaning[];
    readings: WKReading[];
    radicals: Radical[];
    meaningMnemonic: string | null;
    readingMnemonic: string | null;
    meaningHint: string | null;
    readingHint: string | null;
  } | null;
  relatedVocab: Array<{
    id: number;
    expression: string;
    reading: string;
    meaning: string;
    type: string;
    jlptLevel: string;
  }>;
  componentKanji: Array<{
    id: number;
    expression: string;
    reading: string;
    meaning: string;
    jlptLevel: string;
  }>;
}

interface RadicalDetail {
  radical: {
    wkSubjectId: number;
    characters: string | null;
    meanings: Array<{ meaning: string; primary: boolean }>;
    level: number;
    imageUrl: string | null;
  };
  meaningMnemonic: string | null;
  meaningHint: string | null;
  usedByKanji: Array<{
    id: number;
    expression: string;
    reading: string;
    meaning: string;
    jlptLevel: string;
  }>;
}

interface KanjiApiData {
  kanji: string;
  grade: number | null;
  stroke_count: number;
  meanings: string[];
  kun_readings: string[];
  on_readings: string[];
  name_readings: string[];
  jlpt: number | null;
  unicode: string;
}

interface JishoWord {
  slug: string;
  japanese: Array<{ word?: string; reading: string }>;
  senses: Array<{
    english_definitions: string[];
    parts_of_speech: string[];
    info: string[];
  }>;
}

// Target can be an item or a radical
type ModalTarget =
  | { type: "item"; id: number }
  | { type: "radical"; wkSubjectId: number };

interface Props {
  target: ModalTarget;
  onClose: () => void;
  onNavigateItem?: (itemId: number) => void;
  onNavigateRadical?: (wkSubjectId: number) => void;
}

// ── Component ────────────────────────────────────────────────

export default function ItemDetailModal({
  target,
  onClose,
  onNavigateItem,
  onNavigateRadical,
}: Props) {
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [radicalDetail, setRadicalDetail] = useState<RadicalDetail | null>(null);
  const [dictData, setDictData] = useState<KanjiApiData | null>(null);
  const [jishoData, setJishoData] = useState<JishoWord[] | null>(null);
  const [activeTab, setActiveTab] = useState<"wk" | "dict">("wk");
  const [loading, setLoading] = useState(true);
  const [dictLoading, setDictLoading] = useState(false);
  const [status, setStatus] = useState("unknown");

  // Fetch based on target type
  useEffect(() => {
    setLoading(true);
    setDetail(null);
    setRadicalDetail(null);
    setDictData(null);
    setJishoData(null);
    setActiveTab("wk");

    if (target.type === "item") {
      fetch(`/api/items/${target.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            console.error("Item detail error:", data.error);
            return;
          }
          setDetail(data);
          setStatus(data.item?.status || "unknown");
          setActiveTab(data.wanikani ? "wk" : "dict");
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      fetch(`/api/radicals/${target.wkSubjectId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            console.error("Radical detail error:", data.error);
            return;
          }
          setRadicalDetail(data);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [target]);

  // Fetch dictionary data when dict tab is selected (item mode only)
  useEffect(() => {
    if (activeTab !== "dict" || !detail) return;
    if (dictData || jishoData) return;

    setDictLoading(true);
    const { expression, type } = detail.item;

    if (type === "kanji" && expression.length === 1) {
      fetch(`/api/kanji-lookup?char=${encodeURIComponent(expression)}`)
        .then((res) => res.json())
        .then((res) => {
          if (res.data) setDictData(res.data);
        })
        .catch(console.error)
        .finally(() => setDictLoading(false));
    } else {
      fetch(`/api/kanji-lookup?word=${encodeURIComponent(expression)}`)
        .then((res) => res.json())
        .then((res) => {
          if (res.data?.data) setJishoData(res.data.data);
        })
        .catch(console.error)
        .finally(() => setDictLoading(false));
    }
  }, [activeTab, detail, dictData, jishoData]);

  // Handle status update
  const updateStatus = useCallback(
    async (newStatus: string) => {
      if (!detail) return;
      setStatus(newStatus);
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jlptItemId: detail.item.id, status: newStatus }),
      });
    },
    [detail]
  );

  // Navigation history for back button
  const [history, setHistory] = useState<ModalTarget[]>([]);

  const navigateToItem = (itemId: number) => {
    setHistory((prev) => [...prev, target]);
    onNavigateItem?.(itemId);
  };

  const navigateToRadical = (wkSubjectId: number) => {
    setHistory((prev) => [...prev, target]);
    onNavigateRadical?.(wkSubjectId);
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    if (prev.type === "item") {
      onNavigateItem?.(prev.id);
    } else {
      onNavigateRadical?.(prev.wkSubjectId);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Sanitize HTML for mnemonics
  const sanitize = (html: string) =>
    DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "b", "strong", "em", "i", "span", "br",
        "radical", "kanji", "vocabulary", "reading", "ja",
      ],
      ALLOWED_ATTR: ["class", "data-*"],
    });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="modal-loading">
            <div className="modal-spinner" />
          </div>
        ) : target.type === "item" && detail ? (
          <ItemView
            detail={detail}
            status={status}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            dictData={dictData}
            jishoData={jishoData}
            dictLoading={dictLoading}
            sanitize={sanitize}
            updateStatus={updateStatus}
            navigateToItem={navigateToItem}
            navigateToRadical={navigateToRadical}
            onClose={onClose}
            canGoBack={history.length > 0}
            goBack={goBack}
          />
        ) : target.type === "radical" && radicalDetail ? (
          <RadicalView
            detail={radicalDetail}
            sanitize={sanitize}
            navigateToItem={navigateToItem}
            onClose={onClose}
            canGoBack={history.length > 0}
            goBack={goBack}
          />
        ) : (
          <div className="modal-empty">
            <p>Could not load details.</p>
            <button className="modal-close" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Item View ─────────────────────────────────────────────────

function ItemView({
  detail,
  status,
  activeTab,
  setActiveTab,
  dictData,
  jishoData,
  dictLoading,
  sanitize,
  updateStatus,
  navigateToItem,
  navigateToRadical,
  onClose,
  canGoBack,
  goBack,
}: {
  detail: ItemDetail;
  status: string;
  activeTab: "wk" | "dict";
  setActiveTab: (t: "wk" | "dict") => void;
  dictData: KanjiApiData | null;
  jishoData: JishoWord[] | null;
  dictLoading: boolean;
  sanitize: (html: string) => string;
  updateStatus: (status: string) => void;
  navigateToItem: (id: number) => void;
  navigateToRadical: (id: number) => void;
  onClose: () => void;
  canGoBack: boolean;
  goBack: () => void;
}) {
  return (
    <>
      {/* ── Header ── */}
      <div className="modal-header">
        <div className="modal-header-left">
          {canGoBack && (
            <button className="modal-back" onClick={goBack} title="Go back">
              ←
            </button>
          )}
          <span className="modal-expression">{detail.item.expression}</span>
          <div className="modal-header-meta">
            <span className="modal-reading-label">{detail.item.reading}</span>
            <span className="modal-meaning-label">{detail.item.meaning}</span>
          </div>
        </div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>

      {/* ── Tabs ── */}
      <div className="modal-tabs">
        <button
          className={`modal-tab ${activeTab === "wk" ? "active" : ""}`}
          onClick={() => setActiveTab("wk")}
          disabled={!detail.wanikani}
          title={!detail.wanikani ? "No WaniKani data available" : ""}
        >
          🐊 WaniKani
        </button>
        <button
          className={`modal-tab ${activeTab === "dict" ? "active" : ""}`}
          onClick={() => setActiveTab("dict")}
        >
          📖 辞書
        </button>
      </div>

      {/* ── Tab Content ── */}
      <div className="modal-body">
        {activeTab === "wk" && detail.wanikani && (
          <WKTab
            wanikani={detail.wanikani}
            sanitize={sanitize}
            onRadicalClick={navigateToRadical}
          />
        )}
        {activeTab === "wk" && !detail.wanikani && (
          <div className="modal-empty">
            <p>This item is not available on WaniKani.</p>
          </div>
        )}
        {activeTab === "dict" && (
          <DictTab
            isKanji={detail.item.type === "kanji" && detail.item.expression.length === 1}
            kanjiData={dictData}
            jishoData={jishoData}
            loading={dictLoading}
          />
        )}

        {/* ── Component Kanji (for vocab items) ── */}
        {detail.componentKanji && detail.componentKanji.length > 0 && (
          <div className="modal-section">
            <h3 className="modal-section-title">Kanji Composition</h3>
            <div className="modal-related-vocab">
              {detail.componentKanji.map((k) => (
                <button
                  key={k.id}
                  className="related-vocab-chip kanji-chip"
                  onClick={() => navigateToItem(k.id)}
                  title={`${k.reading} — ${k.meaning}`}
                >
                  <span className="vocab-chip-expr">{k.expression}</span>
                  <span className="vocab-chip-meaning">{k.meaning}</span>
                  <span className="vocab-chip-level">{k.jlptLevel}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Related Vocab (for kanji items) ── */}
        {detail.relatedVocab.length > 0 && (
          <div className="modal-section">
            <h3 className="modal-section-title">Related JLPT Vocab</h3>
            <div className="modal-related-vocab">
              {detail.relatedVocab.map((v) => (
                <button
                  key={v.id}
                  className="related-vocab-chip"
                  onClick={() => navigateToItem(v.id)}
                  title={`${v.reading} — ${v.meaning}`}
                >
                  <span className="vocab-chip-expr">{v.expression}</span>
                  <span className="vocab-chip-level">{v.jlptLevel}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: Status + WK Level ── */}
      <div className="modal-footer">
        <div className="modal-status-buttons">
          {(["unknown", "learning", "known"] as const).map((s) => (
            <button
              key={s}
              className={`status-btn ${status === s ? "active" : ""} status-${s}`}
              onClick={() => updateStatus(s)}
            >
              {s === "unknown" ? "❓" : s === "learning" ? "📖" : "✅"}{" "}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {detail.wanikani && (
          <div className="modal-wk-badge">🐊 WK Level {detail.wanikani.level}</div>
        )}
      </div>
    </>
  );
}

// ── Radical View ─────────────────────────────────────────────

function RadicalView({
  detail,
  sanitize,
  navigateToItem,
  onClose,
  canGoBack,
  goBack,
}: {
  detail: RadicalDetail;
  sanitize: (html: string) => string;
  navigateToItem: (id: number) => void;
  onClose: () => void;
  canGoBack: boolean;
  goBack: () => void;
}) {
  const primaryMeaning =
    detail.radical.meanings.find((m) => m.primary)?.meaning ||
    detail.radical.meanings[0]?.meaning ||
    "Radical";

  return (
    <>
      {/* ── Header ── */}
      <div className="modal-header radical-header">
        <div className="modal-header-left">
          {canGoBack && (
            <button className="modal-back" onClick={goBack} title="Go back">
              ←
            </button>
          )}
          <span className="modal-expression radical-expression">
            {detail.radical.characters || (
              detail.radical.imageUrl ? (
                <img src={detail.radical.imageUrl} alt={primaryMeaning} className="radical-header-img" />
              ) : "?"
            )}
          </span>
          <div className="modal-header-meta">
            <span className="modal-reading-label radical-type-label">Radical</span>
            <span className="modal-meaning-label">{primaryMeaning}</span>
          </div>
        </div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>

      {/* ── Body ── */}
      <div className="modal-body">
        {/* Meanings */}
        <div className="modal-section">
          <h3 className="modal-section-title">Meanings</h3>
          <div className="modal-meanings">
            {detail.radical.meanings.map((m, i) => (
              <span
                key={i}
                className={`meaning-tag ${m.primary ? "primary" : ""}`}
              >
                {m.meaning}
                {m.primary && <span className="primary-star">★</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Meaning Mnemonic */}
        {detail.meaningMnemonic && (
          <div className="modal-section">
            <h3 className="modal-section-title">Meaning Mnemonic</h3>
            <div
              className="modal-mnemonic"
              dangerouslySetInnerHTML={{ __html: sanitize(detail.meaningMnemonic) }}
            />
            {detail.meaningHint && (
              <div className="modal-hint">
                <strong>Hint:</strong>{" "}
                <span dangerouslySetInnerHTML={{ __html: sanitize(detail.meaningHint) }} />
              </div>
            )}
          </div>
        )}

        {/* Used by Kanji */}
        {detail.usedByKanji.length > 0 && (
          <div className="modal-section">
            <h3 className="modal-section-title">
              Found in {detail.usedByKanji.length} JLPT Kanji
            </h3>
            <div className="modal-related-vocab">
              {detail.usedByKanji.map((k) => (
                <button
                  key={k.id}
                  className="related-vocab-chip kanji-chip"
                  onClick={() => navigateToItem(k.id)}
                  title={`${k.reading} — ${k.meaning}`}
                >
                  <span className="vocab-chip-expr">{k.expression}</span>
                  <span className="vocab-chip-meaning">{k.meaning}</span>
                  <span className="vocab-chip-level">{k.jlptLevel}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="modal-footer">
        <div className="modal-wk-badge radical-badge">
          🐊 WK Level {detail.radical.level} · Radical
        </div>
      </div>
    </>
  );
}

// ── WK Tab ────────────────────────────────────────────────────

function WKTab({
  wanikani,
  sanitize,
  onRadicalClick,
}: {
  wanikani: NonNullable<ItemDetail["wanikani"]>;
  sanitize: (html: string) => string;
  onRadicalClick: (wkSubjectId: number) => void;
}) {
  const { onyomi, kunyomi, nanori, other } = groupReadings(wanikani.readings);

  return (
    <>
      {/* Meanings */}
      <div className="modal-section">
        <h3 className="modal-section-title">Meanings</h3>
        <div className="modal-meanings">
          {wanikani.meanings.map((m, i) => (
            <span
              key={i}
              className={`meaning-tag ${m.primary ? "primary" : ""} ${
                !m.accepted_answer ? "rejected" : ""
              }`}
            >
              {m.meaning}
              {m.primary && <span className="primary-star">★</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Readings */}
      {wanikani.readings.length > 0 && (
        <div className="modal-section">
          <h3 className="modal-section-title">Readings</h3>
          {onyomi.length > 0 && (
            <ReadingGroup label="On'yomi" readings={onyomi} colorClass="onyomi" />
          )}
          {kunyomi.length > 0 && (
            <ReadingGroup label="Kun'yomi" readings={kunyomi} colorClass="kunyomi" />
          )}
          {nanori.length > 0 && (
            <ReadingGroup label="Nanori" readings={nanori} colorClass="nanori" />
          )}
          {other.length > 0 && (
            <ReadingGroup label="Reading" readings={other} colorClass="other" />
          )}
        </div>
      )}

      {/* Radicals — now clickable */}
      {wanikani.radicals.length > 0 && (
        <div className="modal-section">
          <h3 className="modal-section-title">Radicals</h3>
          <div className="modal-radicals">
            {wanikani.radicals.map((r, i) => (
              <button
                key={i}
                className="radical-chip clickable"
                onClick={() => onRadicalClick(r.id)}
                title={`Click to view radical: ${r.meaning}`}
              >
                <span className="radical-char">
                  {r.characters || (r.imageUrl ? (
                    <img src={r.imageUrl} alt={r.meaning} className="radical-img" />
                  ) : "?")}
                </span>
                <span className="radical-meaning">{r.meaning}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Meaning Mnemonic */}
      {wanikani.meaningMnemonic && (
        <div className="modal-section">
          <h3 className="modal-section-title">Meaning Mnemonic</h3>
          <div
            className="modal-mnemonic"
            dangerouslySetInnerHTML={{ __html: sanitize(wanikani.meaningMnemonic) }}
          />
          {wanikani.meaningHint && (
            <div className="modal-hint">
              <strong>Hint:</strong>{" "}
              <span dangerouslySetInnerHTML={{ __html: sanitize(wanikani.meaningHint) }} />
            </div>
          )}
        </div>
      )}

      {/* Reading Mnemonic */}
      {wanikani.readingMnemonic && (
        <div className="modal-section">
          <h3 className="modal-section-title">Reading Mnemonic</h3>
          <div
            className="modal-mnemonic"
            dangerouslySetInnerHTML={{ __html: sanitize(wanikani.readingMnemonic) }}
          />
          {wanikani.readingHint && (
            <div className="modal-hint">
              <strong>Hint:</strong>{" "}
              <span dangerouslySetInnerHTML={{ __html: sanitize(wanikani.readingHint) }} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Readings Group ────────────────────────────────────────────

function ReadingGroup({
  label,
  readings,
  colorClass,
}: {
  label: string;
  readings: WKReading[];
  colorClass: string;
}) {
  return (
    <div className="reading-group">
      <span className={`reading-label ${colorClass}`}>{label}</span>
      <div className="reading-tags">
        {readings.map((r, i) => (
          <span
            key={i}
            className={`reading-tag ${colorClass} ${r.primary ? "primary" : ""}`}
          >
            {r.reading}
            {r.primary && <span className="primary-star">★</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// Helper
function groupReadings(readings: WKReading[]) {
  return {
    onyomi: readings.filter((r) => r.type === "onyomi"),
    kunyomi: readings.filter((r) => r.type === "kunyomi"),
    nanori: readings.filter((r) => r.type === "nanori"),
    other: readings.filter((r) => !r.type),
  };
}

// ── Dict Tab ─────────────────────────────────────────────────

function DictTab({
  isKanji,
  kanjiData,
  jishoData,
  loading,
}: {
  isKanji: boolean;
  kanjiData: KanjiApiData | null;
  jishoData: JishoWord[] | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="modal-loading-inline">
        <div className="modal-spinner" />
        <span>Loading dictionary data...</span>
      </div>
    );
  }

  if (isKanji && kanjiData) {
    return (
      <>
        <div className="modal-section">
          <h3 className="modal-section-title">Kanji Info</h3>
          <div className="dict-meta-grid">
            {kanjiData.grade && (
              <div className="dict-meta-item">
                <span className="dict-meta-label">Grade</span>
                <span className="dict-meta-value">{kanjiData.grade}</span>
              </div>
            )}
            <div className="dict-meta-item">
              <span className="dict-meta-label">Strokes</span>
              <span className="dict-meta-value">{kanjiData.stroke_count}</span>
            </div>
            {kanjiData.jlpt && (
              <div className="dict-meta-item">
                <span className="dict-meta-label">JLPT</span>
                <span className="dict-meta-value">N{kanjiData.jlpt}</span>
              </div>
            )}
            <div className="dict-meta-item">
              <span className="dict-meta-label">Unicode</span>
              <span className="dict-meta-value">U+{kanjiData.unicode}</span>
            </div>
          </div>
        </div>

        <div className="modal-section">
          <h3 className="modal-section-title">Meanings</h3>
          <div className="modal-meanings">
            {kanjiData.meanings.map((m, i) => (
              <span key={i} className={`meaning-tag ${i === 0 ? "primary" : ""}`}>
                {m}
              </span>
            ))}
          </div>
        </div>

        {kanjiData.on_readings.length > 0 && (
          <div className="modal-section">
            <h3 className="modal-section-title">On&apos;yomi</h3>
            <div className="reading-tags">
              {kanjiData.on_readings.map((r, i) => (
                <span key={i} className="reading-tag onyomi">{r}</span>
              ))}
            </div>
          </div>
        )}
        {kanjiData.kun_readings.length > 0 && (
          <div className="modal-section">
            <h3 className="modal-section-title">Kun&apos;yomi</h3>
            <div className="reading-tags">
              {kanjiData.kun_readings.map((r, i) => (
                <span key={i} className="reading-tag kunyomi">{r}</span>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  if (!isKanji && jishoData && jishoData.length > 0) {
    return (
      <>
        {jishoData.map((word, wi) => (
          <div key={wi} className="modal-section jisho-entry">
            <div className="jisho-word-header">
              {word.japanese[0]?.word && (
                <span className="jisho-word">{word.japanese[0].word}</span>
              )}
              <span className="jisho-reading">{word.japanese[0]?.reading}</span>
            </div>
            {word.senses.map((sense, si) => (
              <div key={si} className="jisho-sense">
                <span className="jisho-pos">
                  {sense.parts_of_speech.join(", ")}
                </span>
                <span className="jisho-def">
                  {si + 1}. {sense.english_definitions.join("; ")}
                </span>
                {sense.info.length > 0 && (
                  <span className="jisho-info">{sense.info.join("; ")}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="modal-empty">
      <p>No dictionary data available for this item.</p>
    </div>
  );
}
