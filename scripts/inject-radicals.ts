import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'data', 'jlpt.db');

const db = new Database(dbPath);

console.log("Starting Radical Injection...");

const radicals = db.prepare("SELECT * FROM wanikani_radicals").all() as any[];

let added = 0;

db.transaction(() => {
    for (const r of radicals) {
        // If it already has a matched item, skip it
        if (r.matched_jlpt_item_id) continue;

        // Extract primary meaning
        let meanings = [];
        try { meanings = JSON.parse(r.meanings); } catch (e) {}
        const primaryMeaningObj = meanings.find((m: any) => m.primary) || meanings[0];
        const primaryMeaning = primaryMeaningObj ? primaryMeaningObj.meaning : '';

        // Expression
        // Fallback: If characters is null, use the primaryMeaning text inside brackets!
        const expression = r.characters ? r.characters : `[${primaryMeaning}]`;

        // Insert into jlpt_items
        // For jlptLevel, we officially don't have N4/N5 mapping for radicals easily.
        // But the user said "use wanikani levels (within our n4 and n5 paradigm)".
        // Wait, jlptLevel in schema is 'N4' | 'N5' | 'other'.
        // So we just assign 'other' to radicals, since their wk_level is what actually sorts them!
        const stmt = db.prepare(`
            INSERT INTO jlpt_items (type, jlpt_level, expression, reading, meaning)
            VALUES (?, ?, ?, ?, ?)
        `);
        // Note: radicals have no reading
        const info = stmt.run('radical', 'other', expression, '', primaryMeaning);
        const newId = info.lastInsertRowid;

        // Update WK row
        db.prepare(`
            UPDATE wanikani_radicals 
            SET matched_jlpt_item_id = ? 
            WHERE id = ?
        `).run(newId, r.id);

        added++;
    }
})();

console.log(`Successfully injected ${added} Radicals into the jlpt database!`);
