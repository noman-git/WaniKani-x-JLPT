import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

try {
    const PROD_DB_PATH = path.join(process.cwd(), "data", "jlpt.db");
    const LOCAL_SEED_PATH = path.join(process.cwd(), "data", "jlpt-seed.db");
    
    if (!fs.existsSync(LOCAL_SEED_PATH)) {
       throw new Error("No seed database found to sync from!");
    }

    const prodDb = new Database(PROD_DB_PATH);
    prodDb.pragma("foreign_keys = OFF");
    prodDb.exec("BEGIN TRANSACTION;");

    try {
        prodDb.exec(`ATTACH DATABASE '${LOCAL_SEED_PATH}' AS seed;`);

        prodDb.exec(`
            DELETE FROM user_progress;
            DELETE FROM user_notes;
            DELETE FROM grammar_progress;
        `);

        prodDb.exec(`
            DELETE FROM jlpt_items;
            DELETE FROM wanikani_subjects;
            DELETE FROM wanikani_radicals;
            DELETE FROM grammar_points;
            DELETE FROM sqlite_sequence WHERE name IN ('jlpt_items', 'wanikani_subjects', 'wanikani_radicals', 'grammar_points');
        `);

        prodDb.exec(`
            INSERT INTO jlpt_items SELECT * FROM seed.jlpt_items;
            INSERT INTO wanikani_subjects SELECT * FROM seed.wanikani_subjects;
            INSERT INTO wanikani_radicals SELECT * FROM seed.wanikani_radicals;
            INSERT INTO grammar_points SELECT * FROM seed.grammar_points;
        `);

        prodDb.exec("COMMIT;");
        console.log("SUCCESS");
        prodDb.close();
    } catch (dbErr) {
        prodDb.exec("ROLLBACK;");
        prodDb.close();
        console.error("DB ERR:", dbErr);
    }
} catch (e) {
    console.error("FATAL ERR:", e);
}
