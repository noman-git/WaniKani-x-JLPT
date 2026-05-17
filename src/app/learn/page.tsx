"use client";

import { useState, useEffect } from "react";
import SrsQuiz, { QuizItem } from "../components/SrsQuiz";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import ItemModal from "../components/ItemModal";
import { QuizNoteManager } from "../components/LessonModal";
import { dedupeByExpression } from "@/lib/dedupe";
import {
  LessonHero,
  LessonBottomNav,
  useKnownToggle,
  useLessonKeys,
} from "../components/LessonScaffold";
import { readStudyTrack, withTrack } from "../components/useStudyTrack";

type LessonPhase = "loading" | "lesson" | "quiz" | "done";

export default function LearnPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<LessonPhase>("loading");
  const [batch, setBatch] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const known = useKnownToggle({ endpoint: "/api/srs/submit", idField: "jlptItemId" });

  useEffect(() => {
    async function loadQueue() {
      try {
        const res = await fetch(withTrack("/api/srs/lessons?limit=5", readStudyTrack()));
        const data = await res.json();
        
        if (!data.lessons || data.lessons.length === 0) {
           setPhase("done");
           return;
        }

        const lessonIds = data.lessons.map((r: any) => r.item.id);
        const bulkRes = await fetch(`/api/items/bulk?ids=${lessonIds.join(",")}`);
        const bulkData = await bulkRes.json();
        
        const items: QuizItem[] = [];
        for (const id of lessonIds) {
           const detail = bulkData.items[id];
           if (!detail) continue;
           
           let parsedReadings = [];
           let parsedMeanings = [];
           let advancedReadings: Array<{reading: string; type: string; primary: boolean}> | undefined = undefined;
           let advancedMeanings: Array<{meaning: string; primary: boolean}> | undefined = undefined;
           try {
              const wkReadings = detail.wanikani?.readings || [];
              const wkMeanings = detail.wanikani?.meanings || [];
              parsedReadings = wkReadings.map((reading: any) => reading.reading);
              parsedMeanings = wkMeanings.map((m: any) => m.meaning);
              advancedReadings = wkReadings.map((r: any) => ({ reading: r.reading, type: r.type || "nanori", primary: !!r.primary }));
              advancedMeanings = wkMeanings.map((m: any) => ({ meaning: m.meaning, primary: !!m.primary }));
           } catch(e) {}

           if (parsedReadings.length === 0 && detail.item.reading) parsedReadings.push(detail.item.reading);
           if (parsedMeanings.length === 0 && detail.item.meaning) parsedMeanings.push(detail.item.meaning);

           items.push({
             id: detail.item.id,
             jlptItemId: detail.item.id,
             type: detail.item.type,
             jlptLevel: detail.item.jlptLevel,
             characters: detail.item.expression,
             readings: parsedReadings,
             advancedReadings,
             meanings: parsedMeanings,
             advancedMeanings,
             imageUrl: detail.wanikani?.imageUrl,
             note: detail.note,
             meaningMnemonic: detail.wanikani?.meaningMnemonic,
             readingMnemonic: detail.wanikani?.readingMnemonic,
             meaningHint: detail.wanikani?.meaningHint,
             readingHint: detail.wanikani?.readingHint,
             contextSentences: detail.wanikani?.contextSentences,
             partsOfSpeech: detail.wanikani?.partsOfSpeech,
             matchType: detail.wanikani?.matchType,
             wkLevel: detail.wanikani?.level,
             radicals: detail.wanikani?.radicals,
             componentKanji: detail.componentKanji,
             usedInKanji: detail.usedInKanji,
             relatedVocab: detail.relatedVocab
           });
        }

        setBatch(items);
        setPhase("lesson");
      } catch (e) {
        setPhase("done");
      }
    }
    loadQueue();
  }, []);

  const nextSlide = () => {
    if (currentIndex + 1 >= batch.length) {
       setPhase("quiz");
    } else {
       setCurrentIndex(curr => curr + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
       setCurrentIndex(curr => curr - 1);
    }
  };

  const handleToggleKnown = () => {
    const item = batch[currentIndex];
    if (item) known.toggle(item.jlptItemId);
  };

  useLessonKeys({
    enabled: phase === "lesson",
    onPrev: prevSlide,
    onNext: nextSlide,
    onToggleKnown: handleToggleKnown,
  });

  useEffect(() => {
    if (phase === "lesson") {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentIndex, phase]);

  if (phase === "loading") return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Constructing your Queue...</div>;
  if (phase === "done") return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
          <div style={{ fontSize: '30px', color: 'var(--text-primary)', fontWeight: 'bold' }}>You are totally caught up!</div>
          <button onClick={() => router.push('/')} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-medium)', padding: '12px 24px', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer' }}>
            Return to Dashboard
          </button>
      </div>
  );

  if (phase === "lesson") {
    const item = batch[currentIndex];

    return (
      <div className="cs-lesson-page">


        {/* ── Scrollable Card Stack ── */}
        <div className="cs-card-stack">

          <LessonHero
            typeBadge={item.type}
            typeColor={`var(--accent-${item.type})`}
            extraBadges={[
              ...(item.jlptLevel ? [item.jlptLevel.toUpperCase()] : []),
              ...(item.wkLevel ? [`WK Lv ${item.wkLevel}`] : []),
            ]}
            isKnown={known.isKnown(item.jlptItemId)}
            onToggleKnown={handleToggleKnown}
            knownPending={known.pending}
          >
            {item.imageUrl ? (
              <div className="cs-hero-char" style={{ color: `var(--accent-${item.type})` }}>
                <img
                  src={item.imageUrl}
                  alt={item.meanings?.[0] || 'radical'}
                  className="radical-svg-tint"
                  style={{ height: '120px' }}
                />
              </div>
            ) : (
              <div className="cs-hero-char" style={{ color: `var(--accent-${item.type})` }}>{item.characters}</div>
            )}
          </LessonHero>

          {/* Card 2: Meanings & Mnemonics */}
          {(item.meaningMnemonic || item.advancedMeanings) && (
            <div className="cs-card">
              <h3 className="cs-card-title">
                <span className="cs-card-dot" style={{ backgroundColor: '#6366f1' }} />
                Meaning
              </h3>
              {item.advancedMeanings && (
                <div className="cs-meanings-row">
                  {item.advancedMeanings.map((m, i) => (
                    <span key={i} className={`cs-meaning-tag ${m.primary ? 'cs-primary' : ''}`}>
                      {m.meaning}
                    </span>
                  ))}
                </div>
              )}
              {item.partsOfSpeech && item.partsOfSpeech.length > 0 && (
                <div className="cs-word-type">
                  <span className="cs-word-type-label">Word Type</span>
                  <span className="cs-word-type-value">{item.partsOfSpeech.join(", ")}</span>
                </div>
              )}
              {item.meaningMnemonic && (
                <div className="cs-mnemonic" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.meaningMnemonic) }} />
              )}
              {item.meaningHint && (
                <div className="cs-hint">
                  <strong>Hint:</strong> <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.meaningHint) }} />
                </div>
              )}
            </div>
          )}

          {/* Card 3: Reading & Mnemonic */}
          {item.type !== "radical" && (item.readingMnemonic || (item.advancedReadings && item.advancedReadings.length > 0) || (item.readings && item.readings.length > 0)) && (
            <div className="cs-card">
              <h3 className="cs-card-title">
                <span className="cs-card-dot" style={{ backgroundColor: '#10b981' }} />
                Reading
              </h3>
              {item.advancedReadings && item.type === "kanji" ? (
                <div className="cs-readings-grid">
                  {Object.entries(
                    item.advancedReadings.reduce((acc, r) => {
                      const t = r.type || "nanori";
                      if (!acc[t]) acc[t] = [];
                      acc[t].push(r);
                      return acc;
                    }, {} as Record<string, typeof item.advancedReadings[0][]>)
                  ).map(([type, rArr]) => (
                    <div key={type} className="cs-reading-group">
                      <span className="cs-reading-type">{type === 'onyomi' ? "On'yomi" : type === 'kunyomi' ? "Kun'yomi" : "Nanori"}</span>
                      <div className="cs-reading-values">
                        {rArr.map((r, i) => (
                          <span key={i} className={r.primary ? 'cs-reading-primary' : ''}>{r.reading}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : item.advancedReadings && item.advancedReadings.length > 0 ? (
                <div className="cs-readings-grid">
                  <div className="cs-reading-group cs-reading-group--single">
                    <div className="cs-reading-values">
                      {item.advancedReadings.map((r, i) => (
                        <span key={i} className={r.primary ? 'cs-reading-primary' : ''}>{r.reading}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : item.readings && item.readings.length > 0 ? (
                <div className="cs-readings-grid">
                  <div className="cs-reading-group cs-reading-group--single">
                    <div className="cs-reading-values">
                      {item.readings.map((r, i) => (
                        <span key={i} className={i === 0 ? 'cs-reading-primary' : ''}>{r}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {item.readingMnemonic && (
                <div className="cs-mnemonic" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.readingMnemonic) }} />
              )}
              {item.readingHint && (
                <div className="cs-hint">
                  <strong>Hint:</strong> <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.readingHint) }} />
                </div>
              )}
            </div>
          )}

          {/* Card 4: Composition (Radicals / Kanji / Used In) */}
          <CompositionCards item={item} />

          {/* Card: Context Sentences */}
          {item.contextSentences && item.contextSentences.length > 0 && (
            <div className="cs-card">
              <h3 className="cs-card-title">
                <span className="cs-card-dot" style={{ backgroundColor: '#f59e0b' }} />
                Context Sentences
              </h3>
              <div className="cs-sentences">
                {item.contextSentences.slice(0, 3).map((s, i) => (
                  <div key={i} className="cs-sentence">
                    <p className="cs-sentence-ja">{s.ja}</p>
                    <p className="cs-sentence-en">{s.en}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card: Notes */}
          <div className="cs-card">
            <h3 className="cs-card-title">
              <span className="cs-card-dot" style={{ backgroundColor: '#eab308' }} />
              Personal Notes
            </h3>
            <QuizNoteManager 
              key={item.jlptItemId}
              itemId={item.jlptItemId} 
              initialNote={item.note || ""} 
              onSaveSuccess={(newNote) => {
                 const newBatch = [...batch];
                 newBatch[currentIndex] = { ...item, note: newNote };
                 setBatch(newBatch);
              }}
            />
          </div>
        </div>

        <LessonBottomNav
          currentIndex={currentIndex}
          total={batch.length}
          onPrev={prevSlide}
          onNext={nextSlide}
        />
      </div>
    );
  }

  // Quiz Phase
  return (
    <SrsQuiz items={batch} mode="lesson-quiz" onComplete={() => location.reload()} />
  );
}

// ── Composition Cards (extracted to avoid LessonModal duplication) ──

function CompositionCards({ item }: { item: QuizItem }) {
  const [modalTarget, setModalTarget] = useState<{ type: "item"; id: number } | { type: "radical"; wkSubjectId: number } | null>(null);

  const hasRadicals = (item.radicals?.length || 0) > 0;
  const hasKanjiComp = (item.componentKanji?.length || 0) > 0;
  const hasRelatedVocab = (item.relatedVocab?.length || 0) > 0;
  const hasUsedInKanji = (item.usedInKanji?.length || 0) > 0;

  if (!hasRadicals && !hasKanjiComp && !hasRelatedVocab && !hasUsedInKanji) return null;

  return (
    <>
      {modalTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
          <div style={{ position: 'relative', zIndex: 10000 }}>
            <ItemModal
              target={modalTarget}
              onClose={() => setModalTarget(null)}
              onNavigateItem={(id: number) => setModalTarget({ type: "item", id })}
              onNavigateRadical={(wkSubjectId: number) => setModalTarget({ type: "radical", wkSubjectId })}
            />
          </div>
        </div>
      )}

      {hasRadicals && (
        <div className="cs-card">
          <h3 className="cs-card-title">
            <span className="cs-card-dot" style={{ backgroundColor: 'var(--accent-radical)' }} />
            Radicals
          </h3>
          <div className="srs-chip-grid">
            {item.radicals!.map((rad, idx) => (
              <div 
                key={idx} 
                className="srs-feature-chip radical-composition-chip"
                onClick={() => setModalTarget({ type: "radical", wkSubjectId: rad.id })}
                style={{ cursor: 'pointer' }}
              >
                <span className="srs-chip-kanji" style={{ color: 'var(--accent-radical)' }}>
                  {rad.characters || (rad.imageUrl ? <img src={rad.imageUrl} alt={rad.meaning} /> : "?")}
                </span>
                <span className="srs-chip-desc">{rad.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasKanjiComp && (
        <div className="cs-card">
          <h3 className="cs-card-title">
            <span className="cs-card-dot" style={{ backgroundColor: 'var(--accent-kanji)' }} />
            Kanji Composition
          </h3>
          <div className="srs-chip-grid">
            {dedupeByExpression(item.componentKanji!).map((k, idx) => (
              <div
                key={idx}
                className="srs-feature-chip kanji-composition-chip"
                onClick={() => k.id && setModalTarget({ type: "item", id: k.id })}
                style={{ cursor: k.id ? 'pointer' : 'default' }}
              >
                <div className="srs-chip-main">{k.expression}</div>
                <div className="srs-chip-sub">{k.meaning}</div>
                <div className="srs-chip-meta">{k.jlptLevel || `WK Lv ${k.wkLevel}`}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasRelatedVocab && (
        <div className="cs-card">
          <h3 className="cs-card-title">
            <span className="cs-card-dot" style={{ backgroundColor: 'var(--accent-vocab)' }} />
            Found In Vocabulary
          </h3>
          <div className="srs-chip-grid grammar-grid">
            {dedupeByExpression(item.relatedVocab!.filter((v) => v.type === "vocab")).map((v, idx) => (
              <div
                key={idx}
                className="srs-feature-chip vocab-composition-chip"
                onClick={() => setModalTarget({ type: "item", id: v.id })}
                style={{ cursor: 'pointer' }}
              >
                <div className="vocab-chip-head">
                  <span className="vocab-chip-expr">{v.expression}</span>
                  {v.reading && v.reading !== v.expression && (
                    <span className="vocab-chip-reading">{v.reading}</span>
                  )}
                </div>
                <div className="srs-chip-sub">{v.meaning}</div>
                <div className="srs-chip-meta">{v.jlptLevel?.toUpperCase() || ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasUsedInKanji && (
        <div className="cs-card">
          <h3 className="cs-card-title">
            <span className="cs-card-dot" style={{ backgroundColor: 'var(--accent-kanji)' }} />
            Found In Kanji
          </h3>
          <div className="srs-chip-grid">
            {dedupeByExpression(item.usedInKanji!.filter((k) => k.type === "kanji")).map((k, idx) => (
              <div
                key={idx}
                className="srs-feature-chip kanji-composition-chip"
                onClick={() => setModalTarget({ type: "item", id: k.id })}
                style={{ cursor: 'pointer' }}
              >
                <div className="srs-chip-main">{k.expression}</div>
                <div className="srs-chip-sub">{k.meaning}</div>
                <div className="srs-chip-meta">{k.jlptLevel?.toUpperCase() || ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

