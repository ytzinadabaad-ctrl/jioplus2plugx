import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { channelsQuery } from "@/lib/channels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Premium PlugX TV — Live Channels" },
      { name: "description", content: "Watch live TV channels by category." },
      { property: "og:title", content: "Premium PlugX TV — Live Channels" },
      { property: "og:description", content: "Watch live TV channels by category." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(channelsQuery),
  component: Index,
});

const TELEGRAM_URL = "https://t.me/+27i16q_PeVRmNzFl";

function Index() {
  const { data } = useSuspenseQuery(channelsQuery);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("All");
  const [showJoin, setShowJoin] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem("plugx_tg_seen")) setShowJoin(true);
    } catch {
      setShowJoin(true);
    }
  }, []);
  const dismissJoin = () => {
    setShowJoin(false);
    try {
      localStorage.setItem("plugx_tg_seen", "1");
    } catch {}
  };
  const groups = useMemo(() => ["All", ...Array.from(new Set(data.map((c) => c.group || "Other")))], [data]);
  const list = data.filter(
    (c) =>
      (group === "All" || (c.group || "Other") === group) &&
      c.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <main className="relative min-h-screen">
      {/* Ambient background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
        <div className="absolute left-1/2 top-[-180px] h-[380px] w-[720px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute right-[10%] top-[-100px] h-[220px] w-[320px] rounded-full bg-chart-4/15 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-16">
        {/* Hero */}
        <header className="flex flex-col items-center gap-5 py-12 text-center sm:py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {data.length} CHANNELS LIVE NOW
          </span>
          <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl">
            Plug<span className="bg-gradient-to-r from-primary to-chart-5 bg-clip-text text-transparent">X</span> TV
          </h1>
          <p className="max-w-md text-sm text-muted-foreground sm:text-base">
            Stream your favourite live TV channels in HD — entertainment, sports, movies, news and more.
          </p>

          {/* Search */}
          <div className="relative mt-2 w-full max-w-md">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search channels…"
              className="w-full rounded-full border border-input bg-card/70 py-3 pl-11 pr-4 text-sm shadow-lg outline-none backdrop-blur transition-shadow placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/20"
            />
          </div>
        </header>

        {/* Category pills — sticky */}
        <nav className="sticky top-0 z-20 -mx-4 mb-8 flex gap-2 overflow-x-auto bg-background/80 px-4 py-3 backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                g === group
                  ? "bg-primary text-primary-foreground shadow-[0_0_20px_-4px_var(--primary)]"
                  : "border border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </nav>

        {/* Channel grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {list.map((c) => (
            <Link
              key={c.id}
              to="/watch/$id"
              params={{ id: c.id }}
              className="group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card/60 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:bg-card hover:shadow-[0_20px_40px_-15px_var(--primary)]"
            >
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-b from-primary/0 to-primary/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
              <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-destructive">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
                LIVE
              </span>
              <div className="relative flex h-20 w-full items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <img src={c.logo} alt={c.name} loading="lazy" className="max-h-20 max-w-full object-contain drop-shadow-lg" />
              </div>
              <span className="relative line-clamp-2 text-center text-xs font-semibold">{c.name}</span>
            </Link>
          ))}
        </div>
        {list.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-24 text-center">
            <p className="text-lg font-semibold">No channels found</p>
            <p className="text-sm text-muted-foreground">Try a different search or category.</p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 border-t border-border pt-8 text-center text-xs text-muted-foreground">
          Premium PlugX TV — watch live, anywhere in India.
        </footer>
      </div>

      {/* Telegram join modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-md" onClick={dismissJoin}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-br from-primary/60 via-border to-chart-5/50 p-[1.5px] shadow-[0_30px_80px_-20px_var(--primary)]"
          >
            <div className="relative rounded-3xl bg-card p-8 text-center">
              <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
              <button
                onClick={dismissJoin}
                aria-label="Close"
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/70 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                ✕
              </button>
              <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-chart-5 text-primary-foreground shadow-[0_15px_40px_-8px_var(--primary)]">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10" aria-hidden="true">
                  <path d="M21.9 4.6 18.8 19c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9-8.1c.4-.3-.1-.5-.6-.2L6.5 12.6l-4.9-1.5c-1-.3-1-1 .2-1.5l19.2-7.4c.8-.3 1.5.2 1.2 2.4Z" />
                </svg>
                <span className="absolute -right-1 -top-1 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-card bg-primary" />
                </span>
              </div>
              <h2 className="relative font-display text-2xl font-bold tracking-tight">Join our Telegram</h2>
              <p className="relative mt-2 text-sm text-muted-foreground">
                New channels, instant fixes and exclusive updates — straight to your Telegram.
              </p>
              <div className="relative mt-6 flex flex-col gap-2.5">
                <a
                  href={TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={dismissJoin}
                  className="rounded-full bg-gradient-to-r from-primary to-chart-5 px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_10px_30px_-6px_var(--primary)] transition-transform hover:scale-[1.03] active:scale-95"
                >
                  🚀 Join Channel Now
                </a>
                <button
                  onClick={dismissJoin}
                  className="rounded-full border border-border bg-secondary/60 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
