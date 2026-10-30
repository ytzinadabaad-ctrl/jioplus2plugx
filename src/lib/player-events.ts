import { useEffect, useState } from "react";

export interface PlayerInfo {
  state: string;
  recoveries: number;
  quality: string;
  ua?: string;
}

const EVENT = "plugx:player";
const SLEEP_EVENT = "plugx:sleep-timer";

/** Broadcast a player status line; the health panel and activity log listen for these. */
export function emitPlayer(text: string, patch?: Partial<PlayerInfo>) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, ...patch } }));
}

export function usePlayerInfo(): PlayerInfo {
  const [info, setInfo] = useState<PlayerInfo>({ state: "Starting", recoveries: 0, quality: "Auto", ua: "Auto" });
  useEffect(() => {
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      setInfo((i) => ({
        state: typeof d.state === "string" ? d.state : i.state,
        recoveries: typeof d.recoveries === "number" ? d.recoveries : i.recoveries,
        quality: typeof d.quality === "string" ? d.quality : i.quality,
        ua: typeof d.ua === "string" ? d.ua : i.ua,
      }));
    };
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  }, []);
  return info;
}

export function usePlayerLog(limit = 7) {
  const [lines, setLines] = useState<{ text: string; at: Date }[]>([
    { text: "Player initialized", at: new Date() },
  ]);
  useEffect(() => {
    const onEvent = (e: Event) => {
      const text = (e as CustomEvent).detail?.text;
      if (typeof text !== "string" || !text) return;
      setLines((l) => [{ text, at: new Date() }, ...l].slice(0, limit));
    };
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  }, [limit]);
  return lines;
}

/** Ask the player to pause after `minutes` (0 = off). */
export function setSleepTimer(minutes: number) {
  window.dispatchEvent(new CustomEvent(SLEEP_EVENT, { detail: minutes }));
}

export function onSleepTimer(cb: (minutes: number) => void) {
  const h = (e: Event) => cb(Number((e as CustomEvent).detail) || 0);
  window.addEventListener(SLEEP_EVENT, h);
  return () => window.removeEventListener(SLEEP_EVENT, h);
}
