import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { queryOptions } from "@tanstack/react-query";

export const API_URL = "https://premiumplugx.com/gibt/shoebpl.php";

export interface Channel {
  id: string;
  name: string;
  group: string;
  logo: string;
  user_agent?: string;
  type: string;
  mpd_url: string;
  headers?: { cookie?: string; Cookie?: string };
  expires_in?: number | null;
  clearkey?: string;
}

// Only our own site's pages may call this endpoint (Origin/Referer check).
const ALLOWED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "jiotvplusplugx.lovable.app",
  "id-preview--a9c03669-5259-4ff9-9faf-827b36d9b6a5.lovable.app",
];

function assertSameSite(request: Request) {
  const ref = request.headers.get("origin") ?? request.headers.get("referer") ?? "";
  // No Origin/Referer = the app's own server-side call (SSR); let it through.
  if (!ref) return;
  let host = "";
  try {
    host = new URL(ref).hostname;
  } catch {
    throw new Error("Forbidden");
  }
  const ok = ALLOWED_HOSTS.some((h) => host === h || host.endsWith(".lovable.app"));
  if (!ok) throw new Error("Forbidden");
}

export const fetchChannels = createServerFn({ method: "GET" }).handler(async () => {
  assertSameSite(getRequest());
  const res = await fetch(API_URL, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: "https://premiumplugx.com/" },
  });
  if (!res.ok) throw new Error(`Channel feed failed (${res.status})`);
  const data = (await res.json()) as Channel[];
  return Array.isArray(data) ? data.filter((c) => c && c.id && c.mpd_url) : [];
});

export const channelsQuery = queryOptions({
  queryKey: ["channels"],
  queryFn: () => fetchChannels(),
  staleTime: 5 * 60 * 1000,
});

/** Append the __hdnea__ token from the cookie as a query param (browsers can't set Cookie). */
export function streamUrl(ch: Channel): string {
  const cookie = ch.headers?.cookie ?? ch.headers?.Cookie ?? "";
  const m = cookie.match(/__hdnea__=([^;]+)/);
  if (!m || ch.mpd_url.includes("__hdnea__=")) return ch.mpd_url;
  return ch.mpd_url + (ch.mpd_url.includes("?") ? "&" : "?") + "__hdnea__=" + m[1];
}

const ZERO_KID = "00000000000000000000000000000000";

/** Parses "kid:key,kid:key,..." (any number of pairs) or a legacy array of {keyId,key}/{kid,k}. */
export function parseClearKeys(
  raw?: string | Array<{ keyId?: string; key?: string; kid?: string; k?: string }> | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  const clean = (h?: string) => (h ?? "").trim().toLowerCase().replace(/-/g, "");
  const add = (kid?: string, key?: string) => {
    const k1 = clean(kid), k2 = clean(key);
    if (/^[0-9a-f]{32}$/.test(k1) && /^[0-9a-f]{32}$/.test(k2) && k1 !== ZERO_KID) out[k1] = k2;
  };
  if (Array.isArray(raw)) raw.forEach((p) => add(p.keyId ?? p.kid, p.key ?? p.k));
  else
    (raw ?? "").split(/[,;\s]+/).forEach((pair) => {
      const i = pair.indexOf(":");
      if (i > 0) add(pair.slice(0, i), pair.slice(i + 1));
    });
  return out;
}
