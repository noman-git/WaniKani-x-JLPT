import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const jlptItems = sqliteTable("jlpt_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expression: text("expression").notNull(),
  reading: text("reading").notNull(),
  meaning: text("meaning").notNull(),
  type: text("type", { enum: ["kanji", "vocab"] }).notNull(),
  jlptLevel: text("jlpt_level", { enum: ["N4", "N5"] }).notNull(),
  sources: text("sources").notNull().default("[]"), // JSON array of source names
});

export const wanikaniSubjects = sqliteTable("wanikani_subjects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  wkSubjectId: integer("wk_subject_id").notNull(),
  characters: text("characters"),
  meanings: text("meanings").notNull(), // JSON: [{meaning, primary, accepted_answer}]
  readings: text("readings").notNull(), // JSON: [{reading, type, primary}]
  wkLevel: integer("wk_level").notNull(),
  objectType: text("object_type").notNull(), // "radical", "kanji", "vocabulary", "kana_vocabulary"
  matchedJlptItemId: integer("matched_jlpt_item_id").references(() => jlptItems.id),
  // Rich data fields
  componentSubjectIds: text("component_subject_ids"), // JSON array of radical IDs (for kanji)
  amalgamationSubjectIds: text("amalgamation_subject_ids"), // JSON array of vocab IDs (for kanji)
  meaningMnemonic: text("meaning_mnemonic"), // HTML mnemonic for meanings
  readingMnemonic: text("reading_mnemonic"), // HTML mnemonic for readings
  meaningHint: text("meaning_hint"), // Hint text
  readingHint: text("reading_hint"), // Hint text
});

export const wanikaniRadicals = sqliteTable("wanikani_radicals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  wkSubjectId: integer("wk_subject_id").notNull().unique(),
  characters: text("characters"), // null for image-only radicals
  meanings: text("meanings").notNull(), // JSON array
  wkLevel: integer("wk_level").notNull(),
  characterImageUrl: text("character_image_url"), // SVG URL for image-only radicals
});

export const kanjiCache = sqliteTable("kanji_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  queryKey: text("query_key").notNull().unique(), // "kanjiapi:日" or "jisho:食べる"
  responseJson: text("response_json").notNull(),
  cachedAt: text("cached_at").notNull(),
});

export const userProgress = sqliteTable("user_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jlptItemId: integer("jlpt_item_id")
    .notNull()
    .references(() => jlptItems.id)
    .unique(),
  status: text("status", { enum: ["known", "learning", "unknown"] })
    .notNull()
    .default("unknown"),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Types
export type JlptItem = typeof jlptItems.$inferSelect;
export type WanikaniSubject = typeof wanikaniSubjects.$inferSelect;
export type WanikaniRadical = typeof wanikaniRadicals.$inferSelect;
export type UserProgressRecord = typeof userProgress.$inferSelect;
export type ItemStatus = "known" | "learning" | "unknown";
export type JlptLevel = "N4" | "N5";
export type ItemType = "kanji" | "vocab";
