"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import * as wanakana from "wanakana";
import GrammarDetailModal from "./GrammarDetailModal";
import ItemModal from "./ItemModal";

interface LinkedItem {
  id: number;
  expression: string;
  reading: string | null;
  meaning: string;
  type: string;
  jlptLevel: string;
  wkReadings?: string | null;
}

export type GrammarQuizItem = {
  id: number;
  slug: string;
  title: string;
  titleRomaji: string;
  meaning: string;
  examples: Array<{ja: string; romaji: string; en: string; jaPrompt?: string; clozeAnswer?: string}>;
  jlptLevel: string;
  linkedItems?: LinkedItem[];
};

type QuizMode = "cloze" | "meaning";

type Props = {
  items: GrammarQuizItem[];
  onComplete: () => void;
  mode: "lesson-quiz" | "review";
};

export default function GrammarClozeQuiz({ items, onComplete, mode }: Props) {
  const [queue, setQueue] = useState<Array<GrammarQuizItem & { quizMode: QuizMode }>>([]);
  const [currentItem, setCurrentItem] = useState<(GrammarQuizItem & { quizMode: QuizMode }) | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [linkedItemsCache, setLinkedItemsCache] = useState<Record<number, LinkedItem[]>>({});
  const startTime = useRef<number>(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedVocabId, setSelectedVocabId] = useState<number | null>(null);

  // Build a mixed queue with both cloze and meaning modes
  useEffect(() => {
    const freshQueue: Array<GrammarQuizItem & { quizMode: QuizMode }> = [];
    for (const item of items) {
      // Add a cloze question if cloze data exists
      if (item.examples?.[0]?.jaPrompt && item.examples[0].clozeAnswer) {
        freshQueue.push({ ...item, quizMode: "cloze" });
      }
      // Always add a meaning question
      freshQueue.push({ ...item, quizMode: "meaning" });
    }
    freshQueue.sort(() => Math.random() - 0.5);
    setQueue(freshQueue);
    setCurrentItem(freshQueue[0] || null);
    startTime.current = Date.now();
  }, [items]);

  // Fetch linkedItems for the current item
  useEffect(() => {
    if (!currentItem || linkedItemsCache[currentItem.id]) return;
    (async () => {
      try {
        const res = await fetch(`/api/grammar/${currentItem.slug}`);
        const data = await res.json();
        if (data.linkedItems) {
          setLinkedItemsCache(prev => ({ ...prev, [currentItem.id]: data.linkedItems }));
        }
      } catch {}
    })();
  }, [currentItem?.id]);



  const popNext = () => {
    const nextQueue = queue.slice(1);
    setQueue(nextQueue);
    setInputValue("");
    setFeedback(null);
    setShowInfo(false);
    setCurrentItem(nextQueue[0] || null);
    startTime.current = Date.now();
    if (nextQueue.length === 0) onComplete();
  };

  const reInsertAndPop = () => {
    const newQueue = queue.slice(1);
    const insertIdx = Math.floor(Math.random() * Math.min(newQueue.length, 5));
    newQueue.splice(insertIdx, 0, currentItem!);
    setQueue(newQueue);
    setInputValue("");
    setFeedback(null);
    setShowInfo(false);
    setCurrentItem(newQueue[0] || null);
    startTime.current = Date.now();
  };

  const checkAnswer = async () => {
    if (!currentItem || !inputValue.trim() || loading) return;
    setLoading(true);

    const timeToAnswerMs = Date.now() - startTime.current;
    const answerNorm = inputValue.trim();
    let isCorrect = false;

    if (currentItem.quizMode === "cloze") {
      const expected = currentItem.examples?.[0]?.clozeAnswer || currentItem.title.replace(/〜/g, '').trim();
      isCorrect = answerNorm === expected;
    } else {
      // Meaning mode: user types the grammar pattern in kana
      const cleanTitle = currentItem.title.replace(/〜/g, '').trim();
      // Accept exact match or match without non-kana chars
      isCorrect = answerNorm === cleanTitle || answerNorm === wanakana.toHiragana(currentItem.titleRomaji);
    }

    if (isCorrect) {
      setFeedback("correct");
      try {
        await fetch("/api/grammar/srs/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grammarPointId: currentItem.id, isCorrect: true, timeToAnswerMs, mistakeType: null, forceKnown: false })
        });
      } catch {}
    } else {
      setFeedback("incorrect");
      try {
        await fetch("/api/grammar/srs/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grammarPointId: currentItem.id, isCorrect: false, timeToAnswerMs, mistakeType: currentItem.quizMode === "cloze" ? "reading" : "meaning", forceKnown: false })
        });
      } catch {}
    }
    setLoading(false);
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      if (feedback === "incorrect") reInsertAndPop();
      else if (feedback === "correct") popNext();
      else checkAnswer();
    }
  };

  // --- Hover tooltip logic (same as GrammarDetailModal) ---
  const handleTooltipPosition = (e: React.MouseEvent<HTMLElement>) => {
    const parentRect = e.currentTarget.getBoundingClientRect();
    const tooltip = e.currentTarget.querySelector('.inline-tooltip') as HTMLElement;
    if (!tooltip) return;
    e.currentTarget.classList.remove('tooltip-left', 'tooltip-right');
    tooltip.style.left = '';
    tooltip.style.right = '';
    tooltip.style.transform = '';
    if (parentRect.left < 100) e.currentTarget.classList.add('tooltip-left');
    else if (window.innerWidth - parentRect.right < 100) e.currentTarget.classList.add('tooltip-right');
  };

  const parseSentence = (sentence: string, linkedItems: LinkedItem[]): ReactNode[] => {
    if (!linkedItems || linkedItems.length === 0) return [sentence];
    const sortedItems = [...linkedItems].sort((a, b) => b.expression.length - a.expression.length);
    const escapedExpressions = sortedItems.map(i => i.expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedExpressions.join('|')})`, 'g');
    const chunks = sentence.split(regex);
    
    return chunks.map((chunk, i) => {
      const match = sortedItems.find(item => item.expression === chunk);
      if (match) {
        let displayReading = match.reading;
        if (match.wkReadings) {
          try {
            const wkParsed = JSON.parse(match.wkReadings);
            if (Array.isArray(wkParsed) && wkParsed.length > 0) displayReading = wkParsed.map((r: any) => r.reading).join(', ');
          } catch {}
        }
        return (
          <span key={i} className="inline-vocab" tabIndex={0} onMouseEnter={handleTooltipPosition}>
            {chunk}
            <span className="inline-tooltip">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '6px' }}>
                <div style={{ paddingRight: '12px' }}>
                  {displayReading && displayReading !== match.expression && (
                    <span className="inline-tooltip-reading" style={{ display: 'block' }}>{displayReading}</span>
                  )}
                  <span className="inline-tooltip-meaning" style={{ display: 'block' }}>{match.meaning}</span>
                </div>
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedVocabId(match.id); }}
                  className="tooltip-open-btn"
                  title="Open Details"
                >
                  ↗
                </button>
              </div>
              <div className="inline-tooltip-meta">
                <span className={`badge badge-${match.jlptLevel.toLowerCase()}`} style={{fontSize: 9}}>{match.jlptLevel}</span>
                <span className={`badge badge-${match.type === 'kanji' ? 'kanji' : 'vocab'}`} style={{fontSize: 9}}>{match.type}</span>
              </div>
            </span>
          </span>
        );
      }
      return <span key={i}>{chunk}</span>;
    });
  };

  // --- Render ---
  if (!currentItem) return null;

  const example = currentItem.examples?.[0] || null;
  const linked = linkedItemsCache[currentItem.id] || [];
  const isCloze = currentItem.quizMode === "cloze";

  let preBlank = "";
  let postBlank = "";
  let hasCloze = false;

  if (isCloze && example?.jaPrompt && example?.clozeAnswer) {
    const parts = example.jaPrompt.split('___');
    if (parts.length === 2) {
      preBlank = parts[0];
      postBlank = parts[1];
      hasCloze = true;
    }
  }

  const quizModeLabel = isCloze ? "FILL IN THE BLANK" : "MEANING → PATTERN";
  const quizModeColor = isCloze ? '#6366f1' : '#f59e0b';

  return (
    <div className="srs-quiz-wrapper">
      <div className="srs-quiz-header" style={{ alignItems: 'center' }}>
         <span className="folio-mark">{queue.length} <span>remaining</span></span>
         <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className={`badge badge-${currentItem.jlptLevel.toLowerCase()}`}>
              {currentItem.jlptLevel.toUpperCase()}
            </span>
            <span className="srs-type-badge" style={{ color: 'var(--accent-grammar)', borderColor: 'var(--accent-grammar)' }}>
              {quizModeLabel}
            </span>
         </div>
      </div>

      <div
        className="srs-quiz-character"
        style={{
          fontSize: hasCloze ? '36px' : '48px',
          color: 'var(--accent-grammar)',
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        {isCloze && hasCloze ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', gap: '4px', fontFamily: 'var(--font-jp)' }}>
                <span style={{ color: 'var(--ink)' }}>{linked.length > 0 ? parseSentence(preBlank, linked) : preBlank}</span>
                <span style={{
                  display: 'inline-block',
                  minWidth: '90px',
                  borderBottom: '3px solid var(--vermillion)',
                  margin: '0 8px',
                  height: '1em',
                }} />
                <span style={{ color: 'var(--ink)' }}>{linked.length > 0 ? parseSentence(postBlank, linked) : postBlank}</span>
            </div>
        ) : !isCloze ? (
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--ink-faded)',
                marginBottom: '14px',
              }}>
                ── pattern that means
              </div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: '36px',
                fontWeight: 500,
                color: 'var(--ink)',
                lineHeight: 1.2,
              }}>
                {currentItem.meaning}
              </div>
            </div>
        ) : (
            <div style={{ color: 'var(--ink)' }}>{currentItem.meaning}</div>
        )}
      </div>

      {isCloze && hasCloze && example && (
          <div style={{
            textAlign: 'center',
            marginTop: '-12px',
            marginBottom: '24px',
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            color: 'var(--ink-soft)',
            fontSize: '15px',
          }}>
            {example.en}
          </div>
      )}

      <div className="srs-input-container">
        <label className="srs-input-label">
          {isCloze ? 'TYPE THE MISSING GRAMMAR (Hiragana)' : 'TYPE THE GRAMMAR PATTERN (Hiragana)'}
        </label>
        
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            lang="ja"
            autoFocus
            readOnly={loading || feedback !== null}
            disabled={loading}
            value={inputValue}
            onChange={(e) => {
               const val = wanakana.toKana(e.target.value, { IMEMode: true });
               setInputValue(val);
            }}
            onKeyDown={handleKeyDown}
            className={`srs-quiz-input ${feedback ? feedback : ''}`}
            style={{ paddingRight: '56px' }}
          />
          <button
             onClick={() => handleKeyDown({ key: 'Enter' })}
             className={`srs-quiz-submit-btn ${feedback ? feedback : ''}`}
             disabled={loading}
             tabIndex={-1}
          >
             ➔
          </button>
        </div>

        {feedback === "incorrect" && (
           <div className="srs-incorrect-hint">
             <strong>{isCloze ? (currentItem.examples?.[0]?.clozeAnswer || currentItem.title) : currentItem.title}</strong> • {currentItem.meaning}
             <br/><br/>
             Press Enter to continue. 
           </div>
        )}
      </div>

      {feedback !== null && (
        <div style={{ width: '100%', maxWidth: 720, margin: '32px auto 0', textAlign: 'center' }}>
          {!showInfo ? (
             <button
               onClick={() => setShowInfo(true)}
               className="srs-info-toggle-btn"
             >
               Show grammar info
             </button>
          ) : (
             <div style={{ marginTop: 16 }}>
                <div className="cs-card" style={{ padding: 0, textAlign: 'left' }}>
                   <div style={{ padding: '8px 24px 24px' }}>
                      <GrammarDetailModal slug={currentItem.slug} onClose={() => {}} inline={true} />
                   </div>
                </div>
             </div>
          )}
        </div>
      )}

      <div className="srs-quiz-progress-track">
        <div 
           className="srs-quiz-progress-bar"
           style={{ 
             width: `${Math.max(5, (1 - queue.length / (items.length * 2)) * 100)}%` 
           }}
        />
      </div>

      {selectedVocabId !== null && (() => {
        let onNext, onPrev;
        if (currentItem && currentItem.linkedItems) {
          const idx = currentItem.linkedItems.findIndex((v: LinkedItem) => v.id === selectedVocabId);
          if (idx !== -1) {
            if (idx > 0) onPrev = () => setSelectedVocabId(currentItem.linkedItems![idx - 1].id);
            if (idx < currentItem.linkedItems.length - 1) onNext = () => setSelectedVocabId(currentItem.linkedItems![idx + 1].id);
          }
        }
        return (
          <ItemModal
            target={{ type: "item", id: selectedVocabId }}
            onClose={() => setSelectedVocabId(null)}
            onNavigateItem={(id) => setSelectedVocabId(id)}
            onNext={onNext}
            onPrev={onPrev}
          />
        );
      })()}
    </div>
  );
}
