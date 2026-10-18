import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

const EPG_API = "https://jiotvapi.cdn.jio.com/apis/v1.3/getepg/get";
const IMG = "https://jiotvimages.cdn.jio.com/dare_images/shows/";

export interface Program {
  title: string;
  start: number; // ms
  end: number; // ms
  description: string;
  genre: string;
  poster: string;
  cast: string;
  episode: number | null;
}

type RawEp = {
  showname?: string; startEpoch?: number; endEpoch?: number; description?: string; episode_desc?: string;
  showGenre?: string[] | string; showCategory?: string; episodePoster?: string; episodeThumbnail?: string;
  starCast?: string; episode_num?: number; channel_id?: number | string;
};

function img(p?: string) {
  if (!p) return "";
  return p.startsWith("http") ? p : IMG + p.replace(/^\//, "");
}

export const fetchEpg = createServerFn({ method: "GET" })
  .validator((id: string) => String(id).replace(/[^0-9]/g, "").slice(0, 10))
  .handler(async ({ data: id }): Promise<Program[]> => {
    if (!id) return [];
    const pages = await Promise.all(
      [0, 1].map(async (offset) => {
        try {
          const res = await fetch(`${EPG_API}?offset=${offset}&channel_id=${id}&langId=6`, {
            headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
          });
          if (!res.ok) { console.log("EPG status", res.status, id); return []; }
          const j = (await res.json()) as { epg?: RawEp[] };
          return Array.isArray(j.epg) ? j.epg : [];
        } catch (e) {
          console.log("EPG fail", id, e);
          return [];
        }
      }),
    );
    const seen = new Set<number>();
    const out: Program[] = [];
    for (const ep of pages.flat()) {
      const start = Number(ep.startEpoch), end = Number(ep.endEpoch);
      if (!start || !end || end <= start || seen.has(start)) continue;
      if (ep.channel_id != null && String(ep.channel_id) !== id) continue;
      seen.add(start);
      const genre = Array.isArray(ep.showGenre) ? ep.showGenre.join(", ") : ep.showGenre || ep.showCategory || "";
      out.push({
        title: (ep.showname || "Live Program").trim(),
        start, end,
        description: (ep.episode_desc || ep.description || "").trim(),
        genre,
        poster: img(ep.episodePoster || ep.episodeThumbnail),
        cast: (ep.starCast || "").trim(),
        episode: ep.episode_num || null,
      });
    }
    return out.sort((a, b) => a.start - b.start);
  });

export const epgQuery = (id: string) =>
  queryOptions({
    queryKey: ["epg", id],
    queryFn: () => fetchEpg({ data: id }),
    staleTime: 10 * 60 * 1000,
  });

/** Index of the programme airing at `now`, or -1. */
export function currentIndex(list: Program[], now: number) {
  return list.findIndex((p) => p.start <= now && now < p.end);
}
