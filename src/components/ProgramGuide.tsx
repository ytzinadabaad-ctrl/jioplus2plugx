import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Clock } from "lucide-react";
import { currentIndex, epgQuery, type Program } from "@/lib/epg";

const fmt = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const day = (ms: number) =>
  new Date(ms).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function ProgramGuide({ channelId, fallbackLogo }: { channelId: string; fallbackLogo: string }) {
  const { data, isLoading } = useQuery(epgQuery(channelId));
  const now = useNow();
  const list = data ?? [];
  const idx = currentIndex(list, now);
  const upcoming = useMemo(() => (idx >= 0 ? list.slice(idx + 1) : list.filter((p) => p.start > now)).slice(0, 24), [list, idx, now]);
  const [sel, setSel] = useState<Program | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  if (isLoading) return <div className="mt-5 h-40 animate-pulse rounded-2xl bg-card" />;
  if (!list.length)
    return <p className="mt-5 rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">No TV guide available for this channel.</p>;

  const cur = idx >= 0 ? list[idx] : null;
  const shown = sel ?? cur;
  const pct = cur ? Math.min(100, ((now - cur.start) / (cur.end - cur.start)) * 100) : 0;
  const left = cur ? Math.max(0, Math.round((cur.end - now) / 60000)) : 0;

  return (
    <section className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      {shown && (
        <article className="overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur">
          <div className="flex flex-col sm:flex-row">
            <img src={shown.poster || fallbackLogo} alt="" loading="lazy" className="aspect-video w-full object-cover sm:w-64" />
            <div className="flex-1 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                {shown === cur ? "Now playing" : shown.start > now ? "Coming up" : "Earlier"}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold leading-tight">{shown.title}</h2>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(shown.start)} – {fmt(shown.end)}</span>
                {shown.genre && <span>{shown.genre}</span>}
                {shown.episode && <span>Ep {shown.episode}</span>}
              </p>
              {shown === cur && (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-1000" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{left} min left</p>
                </div>
              )}
              {shown.description && <p className="mt-3 line-clamp-4 text-sm text-foreground/85">{shown.description}</p>}
              {shown.cast && <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">Cast: {shown.cast}</p>}
              {sel && cur && sel !== cur && (
                <button onClick={() => setSel(null)} className="mt-3 text-xs font-semibold text-primary hover:underline">← Back to now playing</button>
              )}
            </div>
          </div>
        </article>
      )}
      <div className="rounded-2xl border border-border bg-card/60 p-3 backdrop-blur">
        <h3 className="flex items-center gap-2 px-1 pb-2 font-display text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" /> Up next
        </h3>
        <div ref={listRef} className="max-h-80 space-y-1 overflow-y-auto pr-1">
          {upcoming.map((p, i) => {
            const newDay = i === 0 || day(p.start) !== day(upcoming[i - 1]!.start);
            return (
              <div key={p.start}>
                {newDay && day(p.start) !== day(now) && (
                  <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{day(p.start)}</p>
                )}
                <button
                  onClick={() => setSel(p)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary ${sel === p ? "bg-secondary" : ""}`}
                >
                  <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-primary">{fmt(p.start)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-sm font-medium">{p.title}</span>
                    {p.genre && <span className="line-clamp-1 text-[11px] text-muted-foreground">{p.genre}</span>}
                  </span>
                </button>
              </div>
            );
          })}
          {!upcoming.length && <p className="px-2 py-3 text-sm text-muted-foreground">Nothing scheduled after this.</p>}
        </div>
      </div>
    </section>
  );
}
