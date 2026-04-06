import { QuizItem } from "./SrsQuiz";
import DOMPurify from "dompurify";

export default function QuizItemInfo({ item }: { item: QuizItem }) {
  return (
    <div className="srs-info-payload">
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
           <div className="srs-info-value">{item.meanings.join(", ")}</div>
           
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
             <span className="srs-info-color-tick" style={{backgroundColor: '#a855f7'}}></span> Radicals
          </h4>
          <div className="srs-chip-grid">
            {item.radicals!.map((rad, idx) => (
              <div key={idx} className="srs-feature-chip">
                <span className="srs-chip-kanji">
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
             <span className="srs-info-color-tick" style={{backgroundColor: '#ec4899'}}></span> Kanji Composition
          </h4>
          <div className="srs-chip-grid">
            {item.componentKanji!.map((k, idx) => (
              <div key={idx} className="srs-feature-chip kanji-composition-chip">
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
      
      {/* Grammar Links */}
      {(item.linkedGrammar?.length || 0) > 0 && (
        <div className="srs-breakdown-section">
          <h4 className="srs-info-label">
             <span className="srs-info-color-tick" style={{backgroundColor: '#10b981'}}></span> Appears in Grammar
          </h4>
          <div className="srs-chip-grid grammar-grid">
            {item.linkedGrammar!.map((g, idx) => (
              <div key={idx} className="srs-grammar-chip">
                <span className="srs-grammar-title">{g.title}</span>
                <span className="srs-grammar-meaning">{g.meaning}</span>
                <span className="srs-grammar-level">{g.jlptLevel}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
