import type { QueryClient } from "@tanstack/react-query";
import type { Channel } from "@/lib/channels";
import { currentIndex, epgQuery, type Program } from "@/lib/epg";

const t = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const LIVE_WORDS = /\b(now|live|on air|right now|currently|what'?s on|tonight|today|abhi|chal raha|kya aa raha|schedule|next|later|suggest|recommend|watch|aage|dekhu|dekhein)\b|अभी|चल रहा|क्या देखें|अगला/i;

async function load(qc: QueryClient, id: string): Promise<Program[]> {
  try {
    return await qc.fetchQuery(epgQuery(id));
  } catch {
    return [];
  }
}

function line(ch: Channel, list: Program[], now: number, upcoming: number) {
  const i = currentIndex(list, now);
  const cur = i >= 0 ? list[i] : undefined;
  const next = (i >= 0 ? list.slice(i + 1) : list.filter((p) => p.start > now)).slice(0, upcoming);
  if (!cur && !next.length) return "";
  const parts = [`${ch.name} [${ch.group}]`];
  if (cur) parts.push(`NOW: ${cur.title} (${t(cur.start)}–${t(cur.end)}${cur.genre ? `, ${cur.genre}` : ""})`);
  if (next.length) parts.push(`NEXT: ${next.map((p) => `${t(p.start)} ${p.title}`).join("; ")}`);
  return parts.join(" | ");
}

/**
 * Builds a live TV-guide snapshot for the AI: the channel being watched,
 * channels named in the message, and (for "what's on" style questions)
 * a sample of channels, preferring a category the user mentions.
 */
export async function buildGuideContext(
  qc: QueryClient,
  channels: Channel[],
  message: string,
  watchingId: string | null,
  recentUserMessages: string[] = [],
): Promise<string> {
  const now = Date.now();
  const msg = message.toLowerCase();
  const picked = new Map<string, number>(); // id -> upcoming count

  const guideQuestion = LIVE_WORDS.test(msg);
  const watching = watchingId ? channels.find((c) => c.id === watchingId) : undefined;

  for (const c of channels) {
    if (picked.size >= 10) break;
    const n = c.name.toLowerCase().replace(/\s+hd$/, "");
    if (n.length > 2 && msg.includes(n)) picked.set(c.id, 5);
  }

  // Ordinary banter must not replace a previous answer's guide with unrelated channels.
  if (!guideQuestion && picked.size === 0) return "";
  if (guideQuestion && picked.size === 0) {
    for (const previous of [...recentUserMessages].reverse()) {
      const named = channels.filter((c) => previous.toLowerCase().includes(c.name.toLowerCase().replace(/\s+hd$/, "")));
      if (named.length) {
        for (const c of named.slice(0, 10)) picked.set(c.id, 5);
        break;
      }
    }
  }
  if (watching && !picked.has(watching.id)) picked.set(watching.id, 6);

  if (guideQuestion && picked.size === 0) {
    const groups = Array.from(new Set(channels.map((c) => c.group)));
    const g = groups.find((x) => x && msg.includes(x.toLowerCase().replace(/s$/, "")));
    const pool = g ? channels.filter((c) => c.group === g) : channels;
    // spread across categories when no category was named
    const sample = g ? pool : groups.flatMap((gr) => pool.filter((c) => c.group === gr).slice(0, 3));
    for (const c of sample) {
      if (picked.size >= 30) break;
      if (!picked.has(c.id)) picked.set(c.id, 1);
    }
  }

  const ids = Array.from(picked.keys());
  const lists = await Promise.all(ids.map((id) => load(qc, id)));
  const lines = ids
    .map((id, i) => {
      const ch = channels.find((c) => c.id === id);
      return ch ? line(ch, lists[i] ?? [], now, picked.get(id) ?? 1) : "";
    })
    .filter(Boolean);

  const head = `Current time (IST): ${t(now)}, ${new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}.`;
  const w = watching ? `\nThe user is watching: ${watching.name}.` : "";
  return `${head}${w}\nLive TV guide:\n${lines.join("\n") || "(no guide data available)"}`;
}
