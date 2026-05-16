"use client";

import { useStudyTrack, writeStudyTrack, type StudyTrack } from "@/app/components/useStudyTrack";

const TRACK_OPTIONS: Array<{ value: StudyTrack; label: string; desc: string }> = [
  { value: null, label: "Auto",   desc: "Mixed track — every JLPT item the system has ever known. Default behaviour." },
  { value: "N5", label: "N5",     desc: "Only N5 kanji & vocabulary. Radicals from any level still appear as prerequisites." },
  { value: "N4", label: "N4",     desc: "Only N4 kanji & vocabulary. Radicals from any level still appear as prerequisites." },
];

export default function StudyPlanPage() {
  const track = useStudyTrack();

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Study Plan</h1>
        <p className="page-subtitle">Choose which JLPT track your lesson and review queues follow</p>
      </div>

      <div className="settings-card" style={{ marginBottom: 24 }}>
        <p style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontSize: 16,
          color: "var(--ink-soft)",
          marginBottom: 22,
          lineHeight: 1.5,
        }}>
          Pick a focus. Radicals are always pulled in as needed regardless of track, since they
          sit underneath every kanji as building blocks.
        </p>

        <div role="radiogroup" aria-label="Study track" style={{ display: "grid", gap: 8 }}>
          {TRACK_OPTIONS.map(opt => {
            const isActive = track === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => writeStudyTrack(opt.value)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 14,
                  alignItems: "baseline",
                  padding: "16px 20px",
                  background: isActive ? "var(--paper)" : "transparent",
                  border: `1px solid ${isActive ? "var(--ink)" : "var(--rule)"}`,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  color: "var(--ink)",
                  transition: "border-color var(--t-fast), background var(--t-fast)",
                  position: "relative",
                }}
              >
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: isActive ? "var(--vermillion)" : "var(--ink-faded)",
                  minWidth: 40,
                }}>
                  {opt.label}
                </span>
                <span style={{
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  fontSize: 15,
                  color: "var(--ink-soft)",
                  lineHeight: 1.4,
                }}>
                  {opt.desc}
                </span>
                {isActive && (
                  <span style={{
                    position: "absolute",
                    top: 0, left: 0, bottom: 0,
                    width: 3,
                    background: "var(--vermillion)",
                  }} />
                )}
              </button>
            );
          })}
        </div>

        <p style={{
          marginTop: 16,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--ink-ghost)",
        }}>
          Stored locally · changes take effect on the next lesson or review queue load.
        </p>
      </div>
    </>
  );
}
