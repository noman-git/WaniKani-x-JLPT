import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const inviteCodes = sqliteTable("invite_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  usedBy: integer("used_by").references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  usedAt: text("used_at"),
});

export const jlptItems = sqliteTable("jlpt_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expression: text("expression").notNull(),
  reading: text("reading").notNull(),
  meaning: text("meaning").notNull(),
  type: text("type", { enum: ["kanji", "vocab"] }).notNull(),
  jlptLevel: text("jlpt_level", { enum: ["N4", "N5"] }).notNull(),
  sources: text("sources").notNull().default("[]"),
});

export const wanikaniSubjects = sqliteTable("wanikani_subjects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  wkSubjectId: integer("wk_subject_id").notNull(),
  characters: text("characters"),
  meanings: text("meanings").notNull(),
  readings: text("readings").notNull(),
  wkLevel: integer("wk_level").notNull(),
  objectType: text("object_type").notNull(),
  matchedJlptItemId: integer("matched_jlpt_item_id").references(() => jlptItems.id),
  matchType: text("match_type"),
  componentSubjectIds: text("component_subject_ids"),
  amalgamationSubjectIds: text("amalgamation_subject_ids"),
  meaningMnemonic: text("meaning_mnemonic"),
  readingMnemonic: text("reading_mnemonic"),
  meaningHint: text("meaning_hint"),
  readingHint: text("reading_hint"),
  contextSentences: text("context_sentences"),     // JSON: [{en, ja}]
  patternsOfUse: text("patterns_of_use"),           // JSON: [{en, ja}]
  partsOfSpeech: text("parts_of_speech"),           // JSON: ["noun", "verb"]
});

export const wanikaniRadicals = sqliteTable("wanikani_radicals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  wkSubjectId: integer("wk_subject_id").notNull().unique(),
  characters: text("characters"),
  meanings: text("meanings").notNull(),
  wkLevel: integer("wk_level").notNull(),
  characterImageUrl: text("character_image_url"),
  meaningMnemonic: text("meaning_mnemonic"),
  meaningHint: text("meaning_hint"),
  amalgamationSubjectIds: text("amalgamation_subject_ids"),
});

export const kanjiCache = sqliteTable("kanji_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  queryKey: text("query_key").notNull().unique(),
  responseJson: text("response_json").notNull(),
  cachedAt: text("cached_at").notNull(),
});

export const userProgress = sqliteTable("user_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  jlptItemId: integer("jlpt_item_id")
    .notNull()
    .references(() => jlptItems.id),
  status: text("status", { enum: ["known", "learning", "unknown"] })
    .notNull()
    .default("unknown"),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const userNotes = sqliteTable("user_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  jlptItemId: integer("jlpt_item_id")
    .notNull()
    .references(() => jlptItems.id),
  content: text("content").notNull().default(""),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  unq: unique().on(t.userId, t.jlptItemId),
}));

// Grammar tables
export const grammarPoints = sqliteTable("grammar_points", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  titleRomaji: text("title_romaji").notNull(),
  meaning: text("meaning").notNull(),
  structure: text("structure").notNull(),
  explanation: text("explanation").notNull(),
  jlptLevel: text("jlpt_level").notNull(),
  lessonNumber: integer("lesson_number").notNull().default(0),
  lessonTitle: text("lesson_title").notNull().default(""),
  examples: text("examples").notNull().default("[]"),
  relatedGrammarSlugs: text("related_grammar_slugs").notNull().default("[]"),
  tags: text("tags").notNull().default("[]"),
  order: integer("order").notNull().default(0),
});

export const grammarProgress = sqliteTable("grammar_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  grammarPointId: integer("grammar_point_id")
    .notNull()
    .references(() => grammarPoints.id),
  status: text("status", { enum: ["known", "learning", "unknown"] })
    .notNull()
    .default("unknown"),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  unq: unique().on(t.userId, t.grammarPointId),
}));

export const grammarNotes = sqliteTable("grammar_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  grammarPointId: integer("grammar_point_id")
    .notNull()
    .references(() => grammarPoints.id),
  content: text("content").notNull().default(""),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  unq: unique().on(t.userId, t.grammarPointId),
}));

// Types
export type User = typeof users.$inferSelect;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type JlptItem = typeof jlptItems.$inferSelect;
export type WanikaniSubject = typeof wanikaniSubjects.$inferSelect;
export type WanikaniRadical = typeof wanikaniRadicals.$inferSelect;
export type UserProgressRecord = typeof userProgress.$inferSelect;
export type UserNote = typeof userNotes.$inferSelect;
export type GrammarPoint = typeof grammarPoints.$inferSelect;
export type GrammarProgressRecord = typeof grammarProgress.$inferSelect;
export type GrammarNote = typeof grammarNotes.$inferSelect;
export type ItemStatus = "known" | "learning" | "unknown";
export type JlptLevel = "N4" | "N5";
export type ItemType = "kanji" | "vocab";
