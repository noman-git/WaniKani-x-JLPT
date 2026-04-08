"use client";

import { useState, useRef, useEffect } from "react";
import * as wanakana from "wanakana";
import DOMPurify from "dompurify";
import LessonModal, { QuizNoteManager } from "./LessonModal";

export type QuizItem = {
  id: number;
  type: "kanji" | "vocab" | "radical";
  characters: string;
  meanings: string[];
  readings: string[];
  advancedReadings?: Array<{ reading: string; type: string; primary: boolean }> | null;
  advancedMeanings?: Array<{ meaning: string; primary: boolean }> | null;
  note?: string | null;
  meaningMnemonic?: string | null;
  readingMnemonic?: string | null;
  meaningHint?: string | null;
  readingHint?: string | null;
  contextSentences?: Array<{en: string; ja: string}> | null;
  partsOfSpeech?: string[] | null;
  matchType?: string | null;
  wkLevel?: number | null;
  radicals?: Array<{ id: number; characters: string | null; meaning: string; imageUrl: string | null; level: number; }> | null;
  componentKanji?: Array<{ id: number | null; expression: string; reading: string; meaning: string; jlptLevel: string | null; wkLevel: number | null; }> | null;
  relatedVocab?: Array<{ id: number; expression: string; reading: string; meaning: string; jlptLevel: string; }> | null;
  jlptItemId: number;
  jlptLevel?: string | null;
};

type QuizTask = {
  item: QuizItem;
  questionType: "reading" | "meaning";
};

type Props = {
  items: QuizItem[];
  onComplete: () => void;
  mode: "lesson-quiz" | "review";
};

export default function SrsQuiz({ items, onComplete, mode }: Props) {
  const [queue, setQueue] = useState<QuizTask[]>([]);
  const [currentTask, setCurrentTask] = useState<QuizTask | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | "typo" | "warning" | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [hasMultipleMeanings, setHasMultipleMeanings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const startTime = useRef<number>(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  // Track errors so if you miss reading, meaning also counts as bad for the item interval
  const itemMistakeState = useRef<Record<number, "reading" | "meaning" | "both" | "none">>({});

  const [queueLoaded, setQueueLoaded] = useState(false);

  // Initialize Queue Randomly (with localStorage caching for reviews)
  useEffect(() => {
    if (queueLoaded) return;
    
    let initialQueue: QuizTask[] | null = null;
    
    if (mode === "review") {
      try {
        const cached = localStorage.getItem("srs-active-queue");
        if (cached) {
          const parsedCache: Array<{id: number, type: "reading" | "meaning"}> = JSON.parse(cached);
          
          // Re-hydrate the queue from the passed items prop!
          const restoredQueue: QuizTask[] = [];
          for (const cachedTask of parsedCache) {
             const matchingItem = items.find(i => i.id === cachedTask.id);
             if (matchingItem) {
               restoredQueue.push({ item: matchingItem, questionType: cachedTask.type });
             }
          }
          
          // Only use cache if it actually restored tasks AND isn't completely empty
          if (restoredQueue.length > 0) {
            initialQueue = restoredQueue;
            // Also we need to restore mistake states safely!
            const cachedMistakes = localStorage.getItem("srs-mistake-state");
            if (cachedMistakes) {
               itemMistakeState.current = JSON.parse(cachedMistakes);
            }
          }
        }
      } catch (e) {
        console.error("Failed to restore SRS queue cache", e);
      }
    }

    if (!initialQueue) {
      const freshQueue: QuizTask[] = [];
      items.forEach(item => {
        itemMistakeState.current[item.id] = "none";
        freshQueue.push({ item, questionType: "meaning" });
        if (item.type !== "radical") {
          freshQueue.push({ item, questionType: "reading" });
        }
      });
      // Shuffle
      freshQueue.sort(() => Math.random() - 0.5);
      initialQueue = freshQueue;
    }
    
    setQueue(initialQueue);
    setCurrentTask(initialQueue[0] || null);
    startTime.current = Date.now();
    setQueueLoaded(true);
  }, [items, mode, queueLoaded]);
  
  // Persist Queue Changes
  const persistQueueState = (newQueue: QuizTask[]) => {
    if (mode === "review") {
      try {
        const serialized = newQueue.map(t => ({ id: t.item.id, type: t.questionType }));
        localStorage.setItem("srs-active-queue", JSON.stringify(serialized));
        localStorage.setItem("srs-mistake-state", JSON.stringify(itemMistakeState.current));
      } catch (e) {}
    }
  };



  const popNext = async () => {
    const nextQueue = queue.slice(1);
    
    // Check if the item is FULLY completed (no other tasks for this ID in the nextQueue)
    if (currentTask && mode === "review") {
        const isFullyCompleted = !nextQueue.some(t => t.item.id === currentTask.item.id);
        if (isFullyCompleted) {
            const itemStatus = itemMistakeState.current[currentTask.item.id];
            const hasPreviousMistake = itemStatus === "both" || itemStatus === "reading" || itemStatus === "meaning";
            
            try {
              await fetch("/api/srs/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jlptItemId: currentTask.item.jlptItemId,
                  isCorrect: !hasPreviousMistake,
                  timeToAnswerMs: 2000, // Aggregate simplified
                  mistakeType: hasPreviousMistake ? itemStatus : null,
                  forceKnown: false
                })
              });
            } catch(e) {}
        }
    }
    
    setQueue(nextQueue);
    persistQueueState(nextQueue);
    setInputValue("");
    setFeedback(null);
    setWarningMsg(null);
    setHasMultipleMeanings(false);
    setShowInfo(false);
    setCurrentTask(nextQueue[0] || null);
    startTime.current = Date.now();

    if (nextQueue.length === 0) {
      if (mode === "review") {
        localStorage.removeItem("srs-active-queue");
        localStorage.removeItem("srs-mistake-state");
      }
      onComplete(); // All done!
    }
  };

  const reInsertAndPop = () => {
    // Put current task somewhere in the first 5 slots randomly
    const newQueue = queue.slice(1);
    const insertIdx = Math.floor(Math.random() * Math.min(newQueue.length, 5));
    newQueue.splice(insertIdx, 0, currentTask!);
    setQueue(newQueue);
    persistQueueState(newQueue);
    setInputValue("");
    setFeedback(null);
    setWarningMsg(null);
    setHasMultipleMeanings(false);
    setShowInfo(false);
    setCurrentTask(newQueue[0] || null);
    startTime.current = Date.now();
  };

  const checkAnswer = async () => {
    if (!currentTask || !inputValue.trim() || loading) return;
    setLoading(true);

    const timeToAnswerMs = Date.now() - startTime.current;
    let isCorrect = false;
    let isTypo = false;
    let isWarning = false;
    let warnMessage = "";

    const answerNorm = inputValue.trim().toLowerCase();
    
    setHasMultipleMeanings(false);
    setWarningMsg(null);

    // --- READING CHECK ---
    if (currentTask.questionType === "reading") {
       const advancedReadings = currentTask.item.advancedReadings || [];
       const targetType = currentTask.item.matchType?.toLowerCase();
       
       if (currentTask.item.type === "kanji" && targetType) {
          const expectedReadingsForType = advancedReadings
                .filter(r => r.type.toLowerCase() === targetType)
                .map(r => r.reading.replace(/\..*/, '').replace(/[^ぁ-んァ-ンー]/g, ''));
                
          const allOtherValidReadings = advancedReadings
                .map(r => r.reading.replace(/\..*/, '').replace(/[^ぁ-んァ-ンー]/g, ''));
                
          const fallbackReadings = currentTask.item.readings.map(r => r.replace(/[^ぁ-んァ-ンー]/g, ''));
          
          const primaryExpected = expectedReadingsForType.length > 0 ? expectedReadingsForType : fallbackReadings;
          
          if (primaryExpected.includes(answerNorm)) {
             isCorrect = true;
             if (primaryExpected.length > 1 || allOtherValidReadings.length > 0) {
                 setHasMultipleMeanings(true);
             }
          } else if (allOtherValidReadings.includes(answerNorm) || fallbackReadings.includes(answerNorm)) {
             isWarning = true;
             warnMessage = `We are looking for the ${targetType} reading.`;
          }
       } else {
          // Normal vocab, just match any reading
          const cleanExpected = currentTask.item.readings.map(r => r.replace(/[^ぁ-んァ-ンー]/g, ''));
          // Include advanced reading equivalents if any
          const cleanAdvanced = advancedReadings.map(r => r.reading.replace(/[^ぁ-んァ-ンー]/g, ''));
          
          if (cleanExpected.includes(answerNorm) || cleanAdvanced.includes(answerNorm)) {
             isCorrect = true;
             if (cleanExpected.length > 1 || cleanAdvanced.length > 1) {
                 setHasMultipleMeanings(true);
             }
          }
       }

    // --- MEANING CHECK ---
    } else {
       const expectedMeanings = [
         ...currentTask.item.meanings,
         ...(currentTask.item.advancedMeanings || []).map(m => m.meaning)
       ].map(m => m.toLowerCase().trim());
       
       if (expectedMeanings.includes(answerNorm)) {
         isCorrect = true;
         if (expectedMeanings.length > 1) {
            setHasMultipleMeanings(true);
         }
       } else {
         for(const ex of expectedMeanings) {
            if (ex.length > 3 && levenshteinDistanceLocal(answerNorm, ex) === 1) {
              isCorrect = true;
              isTypo = true;
              if (expectedMeanings.length > 1) {
                 setHasMultipleMeanings(true);
              }
              break;
            }
         }
       }
    }

    if (isWarning) {
       setFeedback("warning");
       setWarningMsg(warnMessage);
       setLoading(false);
       return; // Break out, no grading yet!
    }

    if (isCorrect) {
      setFeedback(isTypo ? "typo" : "correct");
      // We no longer instantly submit here. It is handled in popNext!

      
      setLoading(false); // Let handleKeyDown pop it strictly on Enter
    } else {
      setFeedback("incorrect");
      const currentErr = itemMistakeState.current[currentTask.item.id];
      itemMistakeState.current[currentTask.item.id] = currentErr === "none" ? currentTask.questionType : "both";
      
      setLoading(false); // Let handleKeyDown queue it on Enter
    }
  };

  // Allow enter key
  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter') {
       if (feedback === "incorrect") {
          reInsertAndPop();
       } else if (feedback === "correct" || feedback === "typo") {
          popNext();
       } else if (feedback === "warning") {
          setFeedback(null);
          setWarningMsg(null);
          setInputValue("");
       } else {
          checkAnswer();
       }
    }
  };

  if (!currentTask) return null;

  return (
    <div className="srs-quiz-wrapper">
      <div className="srs-quiz-header" style={{ alignItems: 'center' }}>
         <span>{queue.length} items remaining</span>
         <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {currentTask.item.jlptLevel && (
               <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px' }}>
                 {currentTask.item.jlptLevel.toUpperCase()}
               </span>
            )}
            {currentTask.item.wkLevel && (
               <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', padding: '4px 8px', borderRadius: '4px' }}>
                 WK Lv {currentTask.item.wkLevel}
               </span>
            )}
            <span style={{ textTransform: 'uppercase', letterSpacing: '2px', color: '#6366f1' }}>{currentTask.item.type}</span>
         </div>
      </div>

      <div 
         className="srs-quiz-character"
         style={{
            backgroundColor: `var(--accent-${currentTask.item.type})`,
            padding: '40px 80px',
            borderRadius: '16px',
            boxShadow: `0 10px 30px var(--accent-${currentTask.item.type}-soft)`,
            width: '100%',
            maxWidth: '600px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: '0 auto 48px auto'
         }}
      >
        {currentTask.item.characters}
      </div>

      <div className="srs-input-container">
        
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            lang={currentTask.questionType === "reading" ? "ja" : "en"}
            placeholder={currentTask.questionType === "reading" ? "ひらがな" : "Meaning"}
            autoFocus
            readOnly={loading || (feedback !== null && feedback !== "warning")}
            disabled={loading}
            value={inputValue}
            onChange={(e) => {
               let val = e.target.value;
               if (currentTask.questionType === "reading") {
                  val = wanakana.toKana(val, { IMEMode: true });
               }
               setInputValue(val);
               if (feedback === "warning") {
                 setFeedback(null);
                 setWarningMsg(null);
               }
            }}
            onKeyDown={handleKeyDown}
            className={`srs-quiz-input ${feedback ? feedback : ''}`}
            style={{ paddingRight: '56px', textAlign: 'center' }}
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

        {feedback === "warning" && warningMsg && (
           <div className="srs-typo-warning" style={{ backgroundColor: '#f59e0b', color: '#fff' }}>
             {warningMsg}
           </div>
        )}

        {feedback === "typo" && (
           <div className="srs-typo-warning">
             Almost! (Typo allowed)
           </div>
        )}
        
        {feedback === "correct" && hasMultipleMeanings && (
           <div className="srs-typo-warning" style={{ backgroundColor: '#10b981', color: '#fff' }}>
             Correct! (This word has multiple valid {currentTask.questionType === "reading" ? "readings" : "meanings"})
           </div>
        )}
        
        {feedback === "incorrect" && (
           <div className="srs-incorrect-hint">
             Press Enter to continue. 
           </div>
        )}
      </div>

      {feedback !== null && (
        <div style={{ width: '100%', marginTop: '32px', textAlign: 'center' }}>
          {!showInfo ? (
             <button 
               onClick={() => setShowInfo(true)}
               className="srs-info-toggle-btn"
             >
               <span>👁️</span> Show Item Info
             </button>
          ) : (
             <div className="srs-item-details-box" style={{ padding: '0', backgroundColor: 'transparent', boxShadow: 'none', border: 'none', display: 'flex', justifyContent: 'center', height: 'calc(100vh - 200px)', minHeight: '0', boxSizing: 'border-box' }}>
                
                {/* Responsive Grid Layout */}
                <div className="srs-learn-grid" style={{ width: '100%', maxWidth: '1152px' }}>
                  
                   <div className="srs-learn-main" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)', textAlign: 'left', margin: 0, overflow: 'hidden' }}>
                      <div style={{ flex: '1', overflowY: 'auto', padding: '24px', WebkitOverflowScrolling: 'touch' }}>
                         <LessonModal item={currentTask.item} />
                      </div>
                   </div>
                   
                   {/* Sidecar */}
                   <div className="srs-learn-sidecar" style={{ height: '100%' }}>
                      <div style={{ backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'left', height: '100%' }}>
                         <div style={{ padding: '24px' }}>
                            <QuizNoteManager itemId={currentTask.item.jlptItemId} initialNote={currentTask.item.note || ""} />
                         </div>
                      </div>
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
    </div>
  );
}

// Quick local levenshtein for the UI
function levenshteinDistanceLocal(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
