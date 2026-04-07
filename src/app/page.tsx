"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SrsStats {
  upcomingLessons: number;
  dueReviews: number;
  levels: Record<string, {
     apprentice: number;
     guru: number;
     master: number;
     enlightened: number;
     burned: number;
  }>;
  grammarLessons?: number;
  grammarReviews?: number;
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
      .catch(() => {
         if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">JLPT Study Dashboard</h1>
        <p className="page-subtitle">Track your N4 & N5 grammar, kanji, and vocabulary mastery</p>
      </div>

      {/* Overview Stats */}
      <div className="srs-dashboard-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
         <button 
           onClick={() => router.push('/learn')}
           className="srs-action-btn srs-lesson-btn"
         >
           <h3 className="srs-action-title">LESSONS</h3>
           <div className="srs-action-count">{srsStats?.upcomingLessons || 0}</div>
           <div className="srs-action-icon">
              <svg width="140" height="140" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 22h20L12 2zm0 3.8l7.2 14.2H4.8L12 5.8z" />
              </svg>
           </div>
         </button>

         <button 
           onClick={() => srsStats?.dueReviews ? router.push('/review') : null}
           disabled={!srsStats?.dueReviews}
           className="srs-action-btn srs-review-btn"
         >
           <h3 className="srs-action-title">REVIEWS</h3>
           <div className="srs-action-count">{srsStats?.dueReviews || 0}</div>
           
           {srsStats?.dueReviews ? (
             <div className="srs-action-icon">
                <svg width="140" height="140" viewBox="0 0 24 24" fill="currentColor">
                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
             </div>
           ) : null}
         </button>

         {/* Grammar Lesssons */}
         <button 
           onClick={() => router.push('/grammar-learn')}
           className="srs-action-btn srs-lesson-btn"
           style={{ background: 'linear-gradient(to bottom right, var(--bg-glass), rgba(99, 102, 241, 0.1))', borderColor: 'rgba(99, 102, 241, 0.2)' }}
         >
           <h3 className="srs-action-title">GRAMMAR LESSONS</h3>
           <div className="srs-action-count">{srsStats?.grammarLessons || 0}</div>
           <div className="srs-action-icon">
              <svg width="140" height="140" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 22h20L12 2zm0 3.8l7.2 14.2H4.8L12 5.8z" />
              </svg>
           </div>
         </button>

         {/* Grammar Reviews */}
         <button 
           onClick={() => srsStats?.grammarReviews ? router.push('/grammar-review') : null}
           disabled={!srsStats?.grammarReviews}
           className="srs-action-btn srs-review-btn"
           style={{ background: 'linear-gradient(to bottom right, var(--bg-glass), rgba(236, 72, 153, 0.1))', borderColor: 'rgba(236, 72, 153, 0.2)' }}
         >
           <h3 className="srs-action-title">GRAMMAR REVIEWS</h3>
           <div className="srs-action-count">{srsStats?.grammarReviews || 0}</div>
           
           {srsStats?.grammarReviews ? (
             <div className="srs-action-icon">
                <svg width="140" height="140" viewBox="0 0 24 24" fill="currentColor">
                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
             </div>
           ) : null}
         </button>
      </div>

      {srsStats?.levels && ["N5", "N4"].map(level => (
         <div key={level} style={{ marginTop: '32px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.5px" }}>{level} Mastery</h2>
            <div className="srs-stages-container">
               {[
                 { label: "Apprentice", val: srsStats.levels[level]?.apprentice || 0, color: "#f472b6" }, 
                 { label: "Guru", val: srsStats.levels[level]?.guru || 0, color: "#a78bfa" }, 
                 { label: "Master", val: srsStats.levels[level]?.master || 0, color: "#60a5fa" }, 
                 { label: "Enlightened", val: srsStats.levels[level]?.enlightened || 0, color: "#34d399" }, 
                 { label: "Burned", val: srsStats.levels[level]?.burned || 0, color: "#fbbf24" } 
               ].map((stage, idx) => (
                 <div key={idx} className="srs-stage-block">
                    <span className="srs-stage-label">{stage.label}</span>
                    <span className="srs-stage-val" style={{ color: stage.color }}>{stage.val}</span>
                 </div>
               ))}
            </div>
         </div>
      ))}

   
    </>
  );
}
