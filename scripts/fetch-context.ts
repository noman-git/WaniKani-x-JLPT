/**
 * Fetch context sentences, patterns of use, and parts of speech
 * from the WaniKani API for all vocabulary subjects in the DB.
 *
 * Usage: WANIKANI_API_TOKEN=your-token npx tsx scripts/fetch-context.ts
 */
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "jlpt.db");
const API_TOKEN = process.env.WANIKANI_API_TOKEN;

if (!API_TOKEN) {
  console.error("❌ Set WANIKANI_API_TOKEN env var");
  process.exit(1);
}

const db = new Database(DB_PATH);

// Get all vocab subject IDs that we have
const vocabSubjects = db
  .prepare(
    `SELECT id, wk_subject_id FROM wanikani_subjects 
     WHERE object_type = 'vocabulary'
     ORDER BY wk_subject_id`
  )
  .all() as { id: number; wk_subject_id: number }[];

console.log(`Found ${vocabSubjects.length} vocab subjects to enrich`);

// Also get kanji subjects (they can have patterns too, but mainly for parts_of_speech)
const kanjiSubjects = db
  .prepare(
    `SELECT id, wk_subject_id FROM wanikani_subjects 
     WHERE object_type = 'kanji'
     ORDER BY wk_subject_id`
  )
  .all() as { id: number; wk_subject_id: number }[];

console.log(`Found ${kanjiSubjects.length} kanji subjects`);

const allSubjects = [...vocabSubjects, ...kanjiSubjects];

// Fetch in batches using the subjects endpoint
const BATCH_SIZE = 1000;
const updateStmt = db.prepare(`
  UPDATE wanikani_subjects 
  SET context_sentences = ?, patterns_of_use = ?, parts_of_speech = ?
  WHERE wk_subject_id = ?
`);

let updated = 0;
let contextCount = 0;
let patternCount = 0;

async function fetchPage(url: string): Promise<{ data: any[]; nextUrl: string | null }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(`WK API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return {
    data: json.data || [],
    nextUrl: json.pages?.next_url || null,
  };
}

// Fetch all subjects from the API (paginated)
async function fetchAllSubjects() {
  const subjectIds = allSubjects.map((s) => s.wk_subject_id);
  
  // Process in batches of subject IDs
  for (let i = 0; i < subjectIds.length; i += BATCH_SIZE) {
    const batch = subjectIds.slice(i, i + BATCH_SIZE);
    const idsParam = batch.join(",");
    
    let url: string | null = `https://api.wanikani.com/v2/subjects?ids=${idsParam}`;
    
    while (url) {
      const { data, nextUrl } = await fetchPage(url);
      
      for (const item of data) {
        const d = item.data;
        const wkId = item.id;
        
        const contextSentences = d.context_sentences
          ? JSON.stringify(d.context_sentences)
          : null;
        const patternsOfUse = d.patterns_of_use
          ? JSON.stringify(d.patterns_of_use)
          : null;
        const partsOfSpeech = d.parts_of_speech
          ? JSON.stringify(d.parts_of_speech)
          : null;

        if (contextSentences || patternsOfUse || partsOfSpeech) {
          updateStmt.run(contextSentences, patternsOfUse, partsOfSpeech, wkId);
          updated++;
          if (contextSentences) contextCount++;
          if (patternsOfUse) patternCount++;
        }
      }
      
      url = nextUrl;
    }
    
    console.log(`  Processed ${Math.min(i + BATCH_SIZE, subjectIds.length)}/${subjectIds.length} subjects...`);
    
    // Rate limiting: WK allows 60 req/min
    if (i + BATCH_SIZE < subjectIds.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

console.log("Fetching from WaniKani API...");
fetchAllSubjects()
  .then(() => {
    db.close();
    console.log(`\n✅ Done!`);
    console.log(`   Updated: ${updated} subjects`);
    console.log(`   With context sentences: ${contextCount}`);
    console.log(`   With patterns of use: ${patternCount}`);
  })
  .catch((err) => {
    console.error("❌ Error:", err.message);
    db.close();
    process.exit(1);
  });
