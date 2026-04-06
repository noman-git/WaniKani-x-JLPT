"use client";

import { QuizItem } from "./SrsQuiz";
import DOMPurify from "dompurify";
import { useState } from "react";
import ItemModal from "@/app/components/ItemModal";

type NoteSaveState = "idle" | "saving" | "saved" | "error";

export function QuizNoteManager({ itemId, initialNote }: { itemId: number, initialNote: string }) {
  const [note, setNote] = useState(initialNote);
  const [saveState, setSaveState] = useState<NoteSaveState>("idle");

  const handleSave = async () => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, content: note }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const btnLabel =
    saveState === "saving" ? "Saving…" :
    saveState === "saved"  ? "Saved ✓" :
    saveState === "error"  ? "Error — retry" :
    "Save Note";

  return (
    <div className="srs-breakdown-section">
      <h4 className="srs-info-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="srs-info-color-tick" style={{backgroundColor: '#eab308'}}></span> 
            📝 Personal Note
         </span>
         <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            style={{ 
               backgroundColor: saveState === "saved" ? '#10b981' : saveState === "error" ? '#ef4444' : 'var(--bg-card)', 
               color: saveState === "saved" || saveState === "error" ? "white" : 'var(--text-primary)',
               border: saveState === "idle" || saveState === "saving" ? '1px solid var(--border-medium)' : 'none',
               padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
            }}
         >
           {btnLabel}
         </button>
      </h4>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaveState("idle");
        }}
        placeholder="Add your personal notes, custom hints, or reminders for this item..."
        style={{
           width: '100%', minHeight: '100px', backgroundColor: 'var(--bg-document)',
           border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px',
           color: 'var(--text-primary)', resize: 'vertical', fontSize: '14px', lineHeight: '1.5'
        }}
      />
    </div>
  );
}

export default function LessonModal({ item }: { item: QuizItem }) {
  const [modalTarget, setModalTarget] = useState<{ type: "item"; id: number } | { type: "radical"; wkSubjectId: number } | null>(null);

  return (
    <div className="srs-info-payload">
      {modalTarget && (
         <ItemModal 
           target={modalTarget} 
           onClose={() => setModalTarget(null)}
           onNavigateItem={(id) => setModalTarget({ type: "item", id })}
           onNavigateRadical={(wkSubjectId) => setModalTarget({ type: "radical", wkSubjectId })}
         />
      )}

      {/* Parts of Speech */}
      {item.partsOfSpeech && item.partsOfSpeech.length > 0 && (
         <div className="srs-pos-container">
           {item.partsOfSpeech.map((pos, idx) => (
              <span key={idx} className="srs-pos-badge">{pos}</span>
           ))}
         </div>
      )}

      {/* Meanings & Readings Grid */}
      <div className="srs-meaning-reading-container">
         <div className="srs-info-section">
           <h4 className="srs-info-label">
              <span className="srs-info-color-tick" style={{backgroundColor: '#6366f1'}}></span> Meaning
           </h4>
           <div className="srs-info-value">
             {item.advancedMeanings ? (
               <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                 {item.advancedMeanings.map((m, i) => (
                   <span key={i} style={m.primary ? { color: '#6366f1', borderBottom: '2px solid rgba(99, 102, 241, 0.3)' } : { color: 'var(--text-primary)' }}>
                     {m.meaning}{i < item.advancedMeanings!.length - 1 ? ',' : ''}
                   </span>
                 ))}
               </div>
             ) : (
               item.meanings.join(", ")
             )}
           </div>
           
           {item.meaningMnemonic && (
              <div className="srs-mnemonic-box">
                 <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.meaningMnemonic) }} />
                 {item.meaningHint && (
                   <div className="srs-hint-box">
                     <strong>Hint:</strong> <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.meaningHint) }} />
                   </div>
                 )}
              </div>
           )}
         </div>
         
         <div className="srs-info-section">
           <h4 className="srs-info-label">
              <span className="srs-info-color-tick" style={{backgroundColor: '#10b981'}}></span> Reading
           </h4>
           
           {item.type === "kanji" && item.advancedReadings ? (
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {Object.entries(
                  item.advancedReadings.reduce((acc, r) => {
                     const t = r.type || "nanori";
                     if (!acc[t]) acc[t] = [];
                     acc[t].push(r);
                     return acc;
                  }, {} as Record<string, typeof item.advancedReadings[0][]>)
                ).map(([type, rArr]) => (
                   <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                     <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', letterSpacing: '1px' }}>
                        {type}
                     </span>
                     <div className="srs-info-value jp" style={{ marginBottom: 0, display: 'flex', gap: '12px' }}>
                        {rArr.map((r, i) => (
                           <span key={i} style={r.primary ? { color: '#10b981', borderBottom: '2px solid rgba(16,185,129,0.3)' } : { color: 'var(--text-primary)' }}>
                             {r.reading}{i < rArr.length - 1 ? ',' : ''}
                           </span>
                        ))}
                     </div>
                   </div>
                ))}
              </div>
           ) : (
              <div className="srs-info-value jp">{item.readings.join(", ")}</div>
           )}
           
           {item.readingMnemonic && (
              <div className="srs-mnemonic-box">
                 <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.readingMnemonic) }} />
                 {item.readingHint && (
                   <div className="srs-hint-box">
                     <strong>Hint:</strong> <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.readingHint) }} />
                   </div>
                 )}
              </div>
           )}
         </div>
      </div>

      {/* Radicals */}
      {(item.radicals?.length || 0) > 0 && (
        <div className="srs-breakdown-section">
          <h4 className="srs-info-label">
             <span className="srs-info-color-tick" style={{backgroundColor: 'var(--accent-radical)'}}></span> Radicals
          </h4>
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

      {/* Kanji Composition */}
      {(item.componentKanji?.length || 0) > 0 && (
        <div className="srs-breakdown-section">
          <h4 className="srs-info-label">
             <span className="srs-info-color-tick" style={{backgroundColor: 'var(--accent-kanji)'}}></span> Kanji Composition
          </h4>
          <div className="srs-chip-grid">
            {item.componentKanji!.map((k, idx) => (
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

      {/* Context Sentences */}
      {item.contextSentences && item.contextSentences.length > 0 && (
        <div className="srs-breakdown-section">
          <h4 className="srs-info-label">
             <span className="srs-info-color-tick" style={{backgroundColor: '#f59e0b'}}></span> Context Sentences
          </h4>
          <div className="srs-sentence-list">
            {item.contextSentences.slice(0, 3).map((sentence, idx) => (
              <div key={idx} className="srs-sentence-block">
                <p className="srs-sentence-ja">{sentence.ja}</p>
                <p className="srs-sentence-en">{sentence.en}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Used in Vocab (Related Vocab) */}
      {(item.relatedVocab?.length || 0) > 0 && (
        <div className="srs-breakdown-section">
          <h4 className="srs-info-label">
             <span className="srs-info-color-tick" style={{backgroundColor: 'var(--accent-vocab)'}}></span> Found In Vocabulary
          </h4>
          <div className="srs-chip-grid grammar-grid">
            {item.relatedVocab!.map((v, idx) => (
              <div 
                key={idx} 
                className="srs-grammar-chip vocab-chip-override"
                onClick={() => setModalTarget({ type: "item", id: v.id })}
                style={{ cursor: 'pointer' }}
              >
                <span className="srs-grammar-title" style={{ fontSize: '18px', fontWeight: 'bold' }}>{v.expression} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 'normal' }}>{v.reading}</span></span>
                <span className="srs-grammar-meaning">{v.meaning}</span>
                <span className="srs-grammar-level">{v.jlptLevel?.toUpperCase() || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note Section is now handled separately by the parent container! */}
    </div>
  );
}
