import { useEffect, useMemo, useState } from "react";
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

  if (isLoading) return <div className="mt-5 h-40 animate-pulse rounded-2xl bg-card" />;
  if (!list.length)
    return <p className="mt-5 rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">No TV guide available for this channel.</p>;

  const cur = idx >= 0 ? list[idx] : null;
  const shown = sel ?? cur;
  const pct = cur ? Math.min(100, ((now - cur.start) / (cur.end - cur.start)) * 100) : 0;
  const left = cur ? Math.max(0, Math.round((cur.end - now) / 60000)) : 0;

  const mins = (p: Program) => Math.round((p.end - p.start) / 60000);
  const label = (p: Program) => (p === cur ? "Now playing" : p.start > now ? `Coming up · ${day(p.start)}` : "Earlier");

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur">
      {shown && (
        <article className="relative isolate overflow-hidden">
          {shown.poster && (
            <img src={shown.poster} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-25 blur-2xl" />
          )}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-card via-card/85 to-card/40" />
          <div className="grid gap-4 p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6 sm:p-5">
            <img src={shown.poster || fallbackLogo} alt="" loading="lazy" className="aspect-video w-full rounded-xl object-cover shadow-lg ring-1 ring-border" />
            <div className="flex min-w-0 flex-col justify-center">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                {shown === cur && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
                {label(shown)}
              </p>
              <h2 className="mt-1 truncate font-display text-xl font-bold sm:text-2xl">{shown.title}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(shown.start)} – {fmt(shown.end)}</span>
                <span>{mins(shown)} min</span>
                {shown.genre && <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">{shown.genre}</span>}
                {shown.episode && <span>Ep {shown.episode}</span>}
              </p>
              {shown === cur && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-1000" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{left} min left</span>
                </div>
              )}
              {shown.description && <p className="mt-3 line-clamp-2 text-sm text-foreground/85">{shown.description}</p>}
              {shown.cast && <p className="mt-1 truncate text-xs text-muted-foreground">Cast: {shown.cast}</p>}
              {sel && cur && sel !== cur && (
                <button onClick={() => setSel(null)} className="mt-2 w-fit text-xs font-semibold text-primary hover:underline">← Back to now playing</button>
              )}
            </div>
          </div>
        </article>
      )}
      <div className="border-t border-border p-4 sm:px-5">
        <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" /> Up next
        </h3>
        {upcoming.length ? (
          <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
            {upcoming.map((p) => (
              <button
                key={p.start}
                onClick={() => setSel(sel === p ? null : p)}
                className={`group w-44 shrink-0 snap-start overflow-hidden rounded-xl border text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 ${sel === p ? "border-primary bg-secondary" : "border-border bg-background/40"}`}
              >
                <div className="relative aspect-video w-full overflow-hidden bg-secondary">
                  {p.poster && <img src={p.poster} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
                  <span className="absolute left-2 top-2 rounded-md bg-background/85 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-primary">{fmt(p.start)}</span>
                  {day(p.start) !== day(now) && (
                    <span className="absolute right-2 top-2 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{day(p.start)}</span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{[p.genre, `${mins(p)} min`].filter(Boolean).join(" · ")}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing scheduled after this.</p>
        )}
      </div>
    </section>
  );
}
