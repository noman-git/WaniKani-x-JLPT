"use client";

import { useEffect, useState } from "react";

export type NoteSaveState = "idle" | "saving" | "saved" | "error";

interface UseNoteSaverOpts {
  /** API endpoint to POST to, e.g. "/api/notes" or "/api/grammar/notes" */
  endpoint: string;
  /** Key name to include in the POST body, e.g. "itemId" or "grammarPointId" */
  idField: string;
  /** The id value to send with each save */
  id: number;
  /** Initial note content from the server */
  initialNote: string;
  /** Optional callback fired after a successful save */
  onSaveSuccess?: (content: string) => void;
}

interface UseNoteSaverResult {
  note: string;
  setNote: (n: string) => void;
  saveState: NoteSaveState;
  handleSave: () => Promise<void>;
  btnLabel: string;
}

/**
 * Shared state machine for the "personal note" widget — used by both the SRS
 * quiz/lesson note manager and the grammar-lesson note manager. The two
 * widgets render very different markup so only the state + save logic is
 * factored out; each component does its own JSX.
 */
export function useNoteSaver({
  endpoint,
  idField,
  id,
  initialNote,
  onSaveSuccess,
}: UseNoteSaverOpts): UseNoteSaverResult {
  const [note, setNoteRaw] = useState(initialNote);
  const [saveState, setSaveState] = useState<NoteSaveState>("idle");

  useEffect(() => {
    setNoteRaw(initialNote || "");
    setSaveState("idle");
  }, [id, initialNote]);

  const setNote = (n: string) => {
    setNoteRaw(n);
    setSaveState("idle");
  };

  const handleSave = async () => {
    setSaveState("saving");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [idField]: id, content: note }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveState("saved");
      onSaveSuccess?.(note);
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const btnLabel =
    saveState === "saving" ? "Saving…" :
    saveState === "saved" ? "Saved" :
    saveState === "error" ? "Retry" :
    "Save note";

  return { note, setNote, saveState, handleSave, btnLabel };
}
