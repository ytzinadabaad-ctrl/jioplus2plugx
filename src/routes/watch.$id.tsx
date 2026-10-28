import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Grid2x2, Info, Keyboard, Moon,
  Plug, RefreshCcw, RotateCcw, ShieldCheck, Share2, Zap,
} from "lucide-react";
import { channelsQuery, type Channel } from "@/lib/channels";
import { addRecent, useFavorites } from "@/lib/favorites";
import { setSleepTimer, usePlayerInfo } from "@/lib/player-events";
import StreamHealth from "@/components/player/StreamHealth";
import ActivityLog from "@/components/player/ActivityLog";

const ShakaPlayer = lazy(() => import("@/components/ShakaPlayer"));
const LiveViewers = lazy(() => import("@/components/LiveViewers"));
const ProgramGuide = lazy(() => import("@/components/ProgramGuide"));

export const Route = createFileRoute("/watch/$id")({
  loader: async ({ context, params }) => {
    const list = await context.queryClient.ensureQueryData(channelsQuery);
    const ch = list.find((c) => c.id === params.id);
    if (!ch) throw notFound();
    return { name: ch.name };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Channel"} — Premium PlugX TV` },
      { name: "description", content: `Watch ${loaderData?.name ?? "this channel"} live.` },
      { property: "og:title", content: `${loaderData?.name ?? "Channel"} — Premium PlugX TV` },
      { property: "og:description", content: `Watch ${loaderData?.name ?? "this channel"} live.` },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Watch,
});

const iconBtn =
  "flex h-[43px] w-[43px] shrink-0 items-center justify-center rounded-[14px] border border-border bg-secondary/40 text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/10 hover:text-foreground";

function SignalPanel({ ch }: { ch: Channel }) {
  const info = usePlayerInfo();
  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-card/60 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <h3 className="flex items-center gap-2 font-display text-[13px] font-bold">
          <Info className="h-4 w-4 text-primary" /> Channel signal
        </h3>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Details</span>
      </div>
      <div className="grid gap-0.5 p-2">
        {[
          ["Type", "Live broadcast"],
          ["Category", ch.group || "Channel"],
          ["Quality", info.quality],
          ["Playback", "Protected"],
        ].map(([k, v]) => (
          <div key={k} className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-xs text-muted-foreground">
            <span>{k}</span>
            <b className="ml-auto max-w-[170px] truncate text-right font-semibold text-foreground">{v}</b>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
        <label htmlFor="sleepTimer" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Moon className="h-3.5 w-3.5" /> Sleep timer
        </label>
        <select
          id="sleepTimer"
          defaultValue="0"
          onChange={(e) => setSleepTimer(Number(e.target.value))}
          className="ml-auto h-9 rounded-[10px] border border-border bg-secondary px-2.5 text-xs font-bold outline-none"
        >
          <option value="0">Off</option>
          <option value="15">15 min</option>
          <option value="30">30 min</option>
          <option value="60">1 hour</option>
          <option value="90">90 min</option>
        </select>
      </div>
    </section>
  );
}

function ShortcutsPanel() {
  const keys: [string, string][] = [
    ["Space", "Play / pause"],
    ["M", "Mute"],
    ["F", "Fullscreen"],
    ["P", "PiP"],
    ["T", "Theater"],
    ["L", "Go live"],
    ["N", "Next channel"],
    ["← →", "Seek 10s"],
  ];
  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-card/60 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <h3 className="flex items-center gap-2 font-display text-[13px] font-bold">
          <Keyboard className="h-4 w-4 text-primary" /> Power keys
        </h3>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Shortcuts</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 p-3">
        {keys.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <kbd className="min-w-[26px] rounded-md border border-border bg-secondary px-1.5 py-1 text-center text-[10px] font-extrabold text-foreground">{k}</kbd>
            {v}
          </div>
        ))}
      </div>
    </section>
  );
}

function Watch() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(channelsQuery);
  const { isFav, toggle } = useFavorites();
  const [theater, setTheater] = useState(false);

  const ch = data.find((c) => c.id === id)!;
  const sameGroup = data.filter((c) => c.group === ch.group);
  const idx = sameGroup.findIndex((c) => c.id === ch.id);
  const prev = sameGroup[(idx - 1 + sameGroup.length) % sameGroup.length]!;
  const next = sameGroup[(idx + 1) % sameGroup.length]!;
  const related = sameGroup.filter((c) => c.id !== ch.id).slice(0, 18);

  useEffect(() => addRecent(ch.id), [ch.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "n" || e.key === "N") navigate({ to: "/watch/$id", params: { id: next.id } });
      if (e.key === "b" && e.shiftKey) navigate({ to: "/watch/$id", params: { id: prev.id } });
      if (e.key === "t" || e.key === "T") setTheater((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, next.id, prev.id]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${ch.name} — Premium PlugX TV`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {}
  };

  return (
    <main className="mx-auto w-full max-w-[1540px] px-3 pb-12 sm:px-7">
      {/* top bar */}
      <header className="flex min-h-[76px] items-center gap-2.5 sm:min-h-[88px] sm:gap-4">
        <Link to="/" title="Back" aria-label="Back to channels" className={iconBtn}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Link to="/" className="flex items-center gap-2.5 font-display text-base font-bold tracking-tight">
          <span className="grid h-9 w-9 -skew-x-6 place-items-center rounded-[11px] bg-primary text-primary-foreground">
            <Plug className="h-4 w-4 skew-x-6" />
          </span>
          <span className="hidden sm:inline">
            PREMIUM <b className="text-primary">PLUGX</b>
          </span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-2.5">
          <span className="grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-[15px] border border-border bg-gradient-to-br from-secondary to-background p-1 shadow-lg sm:h-[60px] sm:w-[60px]">
            <img src={ch.logo} alt="" className="max-h-full max-w-full object-contain" />
          </span>
          <div className="hidden min-w-0 sm:block">
            <div className="max-w-[260px] truncate text-sm font-extrabold">{ch.name}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Live now
            </div>
          </div>
        </div>
        <button onClick={share} title="Share channel" aria-label="Share channel" className={iconBtn}>
          <Share2 className="h-4 w-4" />
        </button>
        <Link to="/" title="Browse channels" aria-label="Browse channels" className={iconBtn}>
          <Grid2x2 className="h-4 w-4" />
        </Link>
      </header>

      {/* prev / next */}
      <div className="mb-3 flex items-center gap-2">
        <Link to="/watch/$id" params={{ id: prev.id }} title={`Previous: ${prev.name}`} className="flex items-center gap-1 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </Link>
        <Link to="/watch/$id" params={{ id: next.id }} title={`Next: ${next.name} (N)`} className="flex items-center gap-1 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* stage */}
      <div className={`grid items-start gap-4 ${theater ? "" : "lg:grid-cols-[minmax(0,1fr)_320px]"}`}>
        <ClientOnly fallback={<div className="aspect-video w-full rounded-[26px] border border-border bg-card" />}>
          <Suspense fallback={<div className="aspect-video w-full rounded-[26px] border border-border bg-card" />}>
            <ShakaPlayer channel={ch} />
          </Suspense>
        </ClientOnly>
        {!theater && (
          <aside className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <StreamHealth />
            <SignalPanel ch={ch} />
            <div className="sm:col-span-2 lg:col-span-1">
              <ShortcutsPanel />
            </div>
          </aside>
        )}
      </div>

      {/* programme guide (EPG) */}
      <ClientOnly>
        <Suspense fallback={null}>
          <ProgramGuide channelId={ch.id} fallbackLogo={ch.logo} />
        </Suspense>
      </ClientOnly>

      {/* more channels */}
      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-lg font-semibold">More in {ch.group}</h2>
          <div className="no-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 pb-2 sm:-mx-7 sm:px-7">
            {related.map((c) => (
              <Link
                key={c.id}
                to="/watch/$id"
                params={{ id: c.id }}
                className="group flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border border-border bg-card/60 p-3 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_12px_30px_-12px_var(--primary)]"
              >
                <img src={c.logo} alt={c.name} loading="lazy" className="h-12 object-contain transition-transform duration-300 group-hover:scale-110" />
                <span className="line-clamp-1 text-center text-[11px] font-medium">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* lower panels */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-[20px] border border-border bg-card/60 p-5 backdrop-blur">
          <h2 className="font-display text-base font-bold">Built for uninterrupted live viewing</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            The player watches its own signal and recovers automatically if playback stalls. Quality adapts to your network, and the guide keeps you posted on what's on.
          </p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {[
              { icon: RotateCcw, t: "Auto recovery", d: "Detects stalled playback and reconnects safely." },
              { icon: Zap, t: "Instant start", d: "Tuned buffering so the picture appears fast." },
              { icon: ShieldCheck, t: "Protected playback", d: "ClearKey and Widevine streams handled." },
            ].map((f) => (
              <div key={f.t} className="rounded-[13px] border border-border p-3.5">
                <f.icon className="h-4 w-4 text-primary" />
                <b className="mt-2 block text-xs">{f.t}</b>
                <span className="mt-1 block text-[10px] leading-snug text-muted-foreground">{f.d}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-[20px] border border-border bg-card/60 p-5 backdrop-blur">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <RefreshCcw className="h-4 w-4 text-primary" /> Live activity
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">Playback events from this viewing session.</p>
          <ClientOnly>
            <ActivityLog />
          </ClientOnly>
        </section>
      </div>
    </main>
  );
}
