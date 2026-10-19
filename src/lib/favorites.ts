import { useSyncExternalStore } from "react";

const FAV_KEY = "plugx_favs";
const RECENT_KEY = "plugx_recent";
const MAX_RECENT = 12;
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
const cache = new Map<string, string[]>();

function read(key: string): string[] {
  if (cache.has(key)) return cache.get(key)!;
  let v: string[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (Array.isArray(parsed)) v = parsed.filter((x) => typeof x === "string");
  } catch {}
  cache.set(key, v);
  return v;
}

function write(key: string, v: string[]) {
  cache.set(key, v);
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Pure helpers (tested). */
export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [id, ...list];
}
export function pushRecent(list: string[], id: string, max = MAX_RECENT): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

export function useFavorites() {
  const favs = useSyncExternalStore(subscribe, () => read(FAV_KEY), () => EMPTY);
  return {
    favs,
    isFav: (id: string) => favs.includes(id),
    toggle: (id: string) => write(FAV_KEY, toggleId(read(FAV_KEY), id)),
  };
}

export function useRecent() {
  return useSyncExternalStore(subscribe, () => read(RECENT_KEY), () => EMPTY);
}

export function addRecent(id: string) {
  write(RECENT_KEY, pushRecent(read(RECENT_KEY), id));
}
