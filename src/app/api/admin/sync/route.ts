import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireAuth(req);
    const url = new URL(req.url);
    if (url.searchParams.get("secret") !== "reset-all") {
       return NextResponse.json({ error: "Missing or invalid sync secret key" }, { status: 403 });
    }
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }

  try {
    const PROD_DB_PATH = path.join(process.cwd(), "data", "jlpt.db");
    const SEED_DB_PATH = path.join("/app", "seed", "jlpt-seed.db");
    const LOCAL_SEED_PATH = path.join(process.cwd(), "data", "jlpt-seed.db");
    
    const targetSeed = fs.existsSync(SEED_DB_PATH) ? SEED_DB_PATH : LOCAL_SEED_PATH;

    if (!fs.existsSync(targetSeed)) {
       return NextResponse.json({ error: "No seed database found to sync from!" }, { status: 500 });
    }

    const prodDb = new Database(PROD_DB_PATH);
    const tempWritableSeed = "/tmp/temp-seed.db";
    fs.copyFileSync(targetSeed, tempWritableSeed);
    
    // Disable FK constraints for mass deletion
    prodDb.pragma("foreign_keys = OFF");

    // Safety: Run entirely inside a transaction
    prodDb.exec("BEGIN TRANSACTION;");

    try {
        // Attach the completely writable temporary seed database as 'seed'
        prodDb.exec(`ATTACH DATABASE '${tempWritableSeed}' AS seed;`);

        // 1. Wipe everyone's progression matrices so they restart at queue 0
        // Doing this first eliminates foreign key locks on the master tables
        prodDb.exec(`
            DELETE FROM user_progress;
            DELETE FROM user_notes;
            DELETE FROM grammar_progress;
        `);

        // 2. Nuke existing master tables
        prodDb.exec(`
            DELETE FROM jlpt_items;
            DELETE FROM wanikani_subjects;
            DELETE FROM wanikani_radicals;
            DELETE FROM grammar_points;
            DELETE FROM sqlite_sequence WHERE name IN ('jlpt_items', 'wanikani_subjects', 'wanikani_radicals', 'grammar_points');
        `);

        // 3. Clone completely from seed
        prodDb.exec(`
            INSERT INTO jlpt_items SELECT * FROM seed.jlpt_items;
            INSERT INTO wanikani_subjects SELECT * FROM seed.wanikani_subjects;
            INSERT INTO wanikani_radicals SELECT * FROM seed.wanikani_radicals;
            INSERT INTO grammar_points SELECT * FROM seed.grammar_points;
        `);

        prodDb.exec("COMMIT;");
        prodDb.exec("DETACH DATABASE seed;");
        prodDb.close();
        if (fs.existsSync(tempWritableSeed)) fs.unlinkSync(tempWritableSeed);

        return NextResponse.json({ success: true, message: "Database synchronized and user progress reset successfully!" });
    } catch (dbErr) {
        prodDb.exec("ROLLBACK;");
        // We try pulling it loose gently if we can
        try { prodDb.exec("DETACH DATABASE seed;"); } catch (e) {}
        prodDb.close();
        if (fs.existsSync(tempWritableSeed)) fs.unlinkSync(tempWritableSeed);
        throw dbErr;
    }

  } catch (error) {
    console.error("Admin Sync Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
  }
}
