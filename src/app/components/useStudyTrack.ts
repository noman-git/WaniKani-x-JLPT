"use client";

import { useEffect, useState } from "react";

/**
 * Persistent "Study Track" preference. The user picks which JLPT level
 * their lesson / review queues should focus on. `null` = the default
 * mixed track (everything).
 *
 * Stored in localStorage so it survives reloads.
 */
export type StudyTrack = "N5" | "N4" | null;

const KEY = "folio.study-track";

export function readStudyTrack(): StudyTrack {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "N5" || v === "N4" ? v : null;
}

export function writeStudyTrack(track: StudyTrack) {
  if (typeof window === "undefined") return;
  if (track === null) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, track);
  // Tell any same-tab listeners
  window.dispatchEvent(new CustomEvent("folio:study-track-change", { detail: track }));
}

/**
 * Reactive hook — re-renders if the user changes their track preference
 * in another tab (storage event) or the current tab (custom event).
 */
export function useStudyTrack(): StudyTrack {
  const [track, setTrack] = useState<StudyTrack>(null);

  useEffect(() => {
    setTrack(readStudyTrack());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setTrack(readStudyTrack());
    };
    const onChange = () => setTrack(readStudyTrack());
    window.addEventListener("storage", onStorage);
    window.addEventListener("folio:study-track-change", onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("folio:study-track-change", onChange);
    };
  }, []);

  return track;
}

/** Append the level= query param to a URL when a track is selected. */
export function withTrack(url: string, track: StudyTrack): string {
  if (!track) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}level=${track}`;
}
