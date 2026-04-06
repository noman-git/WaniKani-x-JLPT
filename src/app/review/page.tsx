"use client";

import { useState, useEffect } from "react";
import SrsQuiz, { QuizItem } from "../components/SrsQuiz";
import { useRouter } from "next/navigation";

export default function ReviewPage() {
  const router = useRouter();
  const [batch, setBatch] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReviews() {
      try {
        const res = await fetch("/api/srs/reviews?limit=50");
        const data = await res.json();
        
        if (!data.reviews || data.reviews.length === 0) {
           setLoading(false);
           return;
        }

        const items: QuizItem[] = await Promise.all(data.reviews.map(async (r: any) => {
           // Deep Hydration directly from the legacy modal API!
           const detailRes = await fetch(`/api/items/${r.item.id}`);
           const detail = await detailRes.json();
           
           let parsedReadings = [];
           let parsedMeanings = [];
           let advancedReadings: Array<{reading: string; type: string; primary: boolean}> | undefined = undefined;
           try {
              const wkReadings = detail.wanikani?.readings || [];
              const wkMeanings = detail.wanikani?.meanings || [];
              parsedReadings = wkReadings.map((reading: any) => reading.reading);
              parsedMeanings = wkMeanings.map((m: any) => m.meaning);
              advancedReadings = wkReadings.map((r: any) => ({ reading: r.reading, type: r.type || "nanori", primary: !!r.primary }));
           } catch(e) {}

           if (parsedReadings.length === 0 && detail.item.reading) parsedReadings.push(detail.item.reading);
           if (parsedMeanings.length === 0 && detail.item.meaning) parsedMeanings.push(detail.item.meaning);

           return {
             id: detail.item.id,
             jlptItemId: detail.item.id,
             type: detail.item.type,
             jlptLevel: detail.item.jlptLevel,
             characters: detail.item.expression,
             readings: parsedReadings,
             advancedReadings,
             meanings: parsedMeanings,
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
             linkedGrammar: detail.linkedGrammar
           };
        }));

        setBatch(items);
        setLoading(false);
      } catch (e) {
        setLoading(false);
      }
    }
    loadReviews();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center text-text-muted">Loading your reviews...</div>;
  
  if (batch.length === 0) return (
      <div className="flex flex-col h-screen items-center justify-center space-y-6">
          <div className="text-3xl text-text-primary font-bold">You have nothing left to review!</div>
          <div className="text-text-muted">Take a break. The algorithm will bring things back when your memory starts to fade.</div>
          <button onClick={() => router.push('/')} className="mt-8 bg-[#10b981] text-bg-primary font-bold px-8 py-3 rounded-lg hover:bg-[#059669] transition-colors shadow-lg">
            Return to Dashboard
          </button>
      </div>
  );

  return (
    <div className="min-h-screen py-24 flex flex-col items-center">
      <SrsQuiz items={batch} mode="review" onComplete={() => router.push('/')} />
    </div>
  );
}
