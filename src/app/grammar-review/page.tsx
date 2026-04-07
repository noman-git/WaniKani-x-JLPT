"use client";

import { useState, useEffect } from "react";
import GrammarClozeQuiz, { GrammarQuizItem } from "../components/GrammarClozeQuiz";
import { useRouter } from "next/navigation";

export default function GrammarReviewPage() {
  const router = useRouter();
  const [batch, setBatch] = useState<GrammarQuizItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReviews() {
      try {
        const res = await fetch("/api/grammar/reviews?limit=50");
        const data = await res.json();
        
        if (!data.reviews || data.reviews.length === 0) {
           setLoading(false);
           return;
        }

        const items = data.reviews.map((r: any) => r.item);
        setBatch(items);
        setLoading(false);
      } catch (e) {
        setLoading(false);
      }
    }
    loadReviews();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center text-text-muted">Loading your grammar reviews...</div>;
  
  if (batch.length === 0) return (
      <div className="flex flex-col h-screen items-center justify-center space-y-6">
          <div className="text-3xl text-text-primary font-bold">No grammar to review right now!</div>
          <div className="text-text-muted">You are all caught up on your Japanese grammar. Check back later.</div>
          <button onClick={() => router.push('/')} className="mt-8 bg-[#10b981] text-bg-primary font-bold px-8 py-3 rounded-lg hover:bg-[#059669] transition-colors shadow-lg">
            Return to Dashboard
          </button>
      </div>
  );

  return (
    <div className="min-h-screen py-24 flex flex-col items-center">
      <GrammarClozeQuiz items={batch} mode="review" onComplete={() => router.push('/')} />
    </div>
  );
}
