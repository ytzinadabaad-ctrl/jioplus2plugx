import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Heart, History, Radio, Search, Send, Tv, X } from "lucide-react";
import { channelsQuery, type Channel } from "@/lib/channels";
import { useFavorites, useRecent } from "@/lib/favorites";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import BootScreen from "@/components/BootScreen";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Premium PlugX TV — Live Channels" },
    { name: "description", content: "Browse live entertainment, sports, movies and news on Premium PlugX TV. Save favourites and watch with programme guides and Plugo." },
    { property: "og:title", content: "Premium PlugX TV — Live Channels" },
    { property: "og:description", content: "Your live channels, favourites and programme guides — all on Premium PlugX TV." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(channelsQuery),
  pendingMs: 0,
  pendingComponent: () => <BootScreen loading />,
  component: Index,
});

const TELEGRAM_URL = "https://t.me/+27i16q_PeVRmNzFl";

function ChannelCard({ channel, favourite, onFavourite }: { channel: Channel; favourite: boolean; onFavourite: () => void }) {
  const [failedLogo, setFailedLogo] = useState(false);
  return (
    <article className="group relative min-w-0 overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/60">
      <Link to="/watch/$id" params={{ id: channel.id }} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label={`Watch ${channel.name}`}>
        <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-background p-5">
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-sm bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground"><span className="size-1 rounded-full bg-primary-foreground" /> LIVE</span>
          {!failedLogo && channel.logo ? <img src={channel.logo} alt="" loading="lazy" onError={() => setFailedLogo(true)} className="max-h-full max-w-[75%] object-contain transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none" /> : <Tv className="size-10 text-muted-foreground" />}
          <span className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"><span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></span></span>
        </div>
        <div className="flex h-[64px] flex-col items-center justify-center gap-1 px-2.5 text-center">
          <h3 className="line-clamp-1 w-full text-xs font-semibold sm:text-[13px]">{channel.name}</h3>
          <span className="line-clamp-1 text-[10px] text-muted-foreground">{channel.group || "Other"}</span>
        </div>
      </Link>
      <Button size="icon-sm" variant="ghost" onClick={onFavourite} title={favourite ? "Remove favourite" : "Add favourite"} aria-label={`${favourite ? "Remove" : "Add"} ${channel.name} ${favourite ? "from" : "to"} favourites`} aria-pressed={favourite} className={`absolute right-1.5 top-1.5 size-7 bg-card/80 hover:bg-card ${favourite ? "text-primary" : "text-muted-foreground"}`}><Heart className={favourite ? "fill-current" : ""} /></Button>
    </article>
  );
}

function Tray({ title, items, recent = false }: { title: string; items: Channel[]; recent?: boolean }) {
  if (!items.length) return null;
  return (
    <section className="mb-7">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">{recent ? <History className="size-4 text-muted-foreground" /> : <Heart className="size-4 text-primary" />}{title}</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        {items.map(channel => <Link key={channel.id} to="/watch/$id" params={{ id: channel.id }} className="flex w-44 shrink-0 items-center gap-3 rounded-md border border-border bg-card px-3 py-3 transition-colors hover:border-primary/60"><img src={channel.logo} alt="" loading="lazy" className="h-9 w-12 shrink-0 object-contain" /><span className="min-w-0"><span className="block truncate text-xs font-semibold">{channel.name}</span><span className="mt-1 block text-[10px] text-muted-foreground">Watch live</span></span></Link>)}
      </div>
    </section>
  );
}

function Index() {
  const { data } = useSuspenseQuery(channelsQuery);
  const { favs, isFav, toggle } = useFavorites();
  const recent = useRecent();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("All");
  const [booting, setBooting] = useState(true);
  const [showJoin, setShowJoin] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (booting) return;
    try { setShowJoin(!localStorage.getItem("plugx_tg_seen")); } catch { /* Optional prompt must not block browsing. */ }
  }, [booting]);
  const dismissJoin = () => {
    setShowJoin(false);
    try { localStorage.setItem("plugx_tg_seen", "1"); } catch { /* Browsing still works without storage. */ }
  };
  const byId = useMemo(() => new Map(data.map(c => [c.id, c])), [data]);
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    data.forEach(c => counts.set(c.group || "Other", (counts.get(c.group || "Other") ?? 0) + 1));
    return Array.from(counts.entries());
  }, [data]);
  const favourites = favs.map(id => byId.get(id)).filter((c): c is Channel => Boolean(c));
  const recentlyWatched = recent.map(id => byId.get(id)).filter((c): c is Channel => Boolean(c));
  const list = data.filter(c => (group === "All" || (group === "Favourites" ? favs.includes(c.id) : (c.group || "Other") === group)) && c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const tabs: [string, number][] = [["All", data.length], ["Favourites", favourites.length], ...groups];

  return (
    <main className="catalog-theme min-h-screen bg-background text-foreground">
      {booting && <BootScreen />}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-4 py-5 pr-20 sm:px-6 sm:pr-24 lg:px-8 lg:pr-24">
          <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="Premium PlugX TV home">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><Tv className="size-5" /></span>
            <span className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Premium</span><span className="block font-display text-2xl font-bold leading-6">Plug<span className="text-primary">X</span> TV</span></span>
          </Link>
          <span className="ml-2 hidden items-center gap-1.5 text-[10px] font-semibold text-muted-foreground lg:flex"><Radio className="size-3.5 text-primary" />{data.length} LIVE CHANNELS</span>
          <div className="relative w-full sm:ml-auto sm:w-[300px] lg:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input type="search" aria-label="Search channels" value={q} onChange={e => setQ(e.target.value)} placeholder="Search channels…" className="h-10 w-full rounded-md border border-input bg-card pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary [&::-webkit-search-cancel-button]:appearance-none" />
            {q && <Button size="icon-sm" variant="ghost" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-1 top-1 size-8 text-muted-foreground"><X /></Button>}
          </div>
        </div>
        <div className="mx-auto flex max-w-[1440px] items-center gap-1 px-3 pb-3 sm:px-5 lg:px-7">
          <Button variant="ghost" size="icon-sm" aria-label="Scroll categories left" className="hidden shrink-0 text-muted-foreground sm:flex" onClick={() => document.getElementById("channel-categories")?.scrollBy({ left: -300, behavior: "smooth" })}><ChevronLeft /></Button>
          <nav id="channel-categories" aria-label="Channel categories" className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {tabs.map(([name, count]) => <Button key={name} size="sm" variant={group === name ? "default" : "ghost"} onClick={() => setGroup(name)} aria-pressed={group === name} className={`h-9 shrink-0 rounded-md px-3.5 ${group !== name ? "border border-border bg-card text-muted-foreground" : ""}`}>{name === "Favourites" && <Heart className="size-3.5" />}{name}<span className="text-[10px] opacity-65">{count}</span></Button>)}
          </nav>
          <Button variant="ghost" size="icon-sm" aria-label="Scroll categories right" className="hidden shrink-0 text-muted-foreground sm:flex" onClick={() => document.getElementById("channel-categories")?.scrollBy({ left: 300, behavior: "smooth" })}><ChevronRight /></Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
        {!q && group === "All" && <><Tray title="Continue watching" items={recentlyWatched} recent /><Tray title="Your favourites" items={favourites} /></>}
        <section aria-labelledby="channel-heading">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5"><span className="h-5 w-0.5 shrink-0 bg-primary" /><h1 id="channel-heading" className="truncate font-display text-lg font-bold">{q ? "Search results" : group === "All" ? "Live channels" : group}</h1><span className="shrink-0 rounded-sm bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{list.length}</span></div>
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground"><span className="size-1.5 rounded-full bg-chart-2" />On air</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-6">
            {list.map(channel => <ChannelCard key={channel.id} channel={channel} favourite={isFav(channel.id)} onFavourite={() => toggle(channel.id)} />)}
          </div>
          {list.length === 0 && <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center"><Search className="size-8 text-muted-foreground" /><h2 className="text-lg font-semibold">{group === "Favourites" && !q ? "No favourites yet" : "No channels found"}</h2><Button variant="outline" onClick={() => { setQ(""); setGroup("All"); }}>All channels <ArrowRight /></Button></div>}
        </section>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pb-20 pt-5 text-[11px] text-muted-foreground"><span>© {new Date().getFullYear()} Premium PlugX TV</span><a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 transition-colors hover:text-foreground"><Send className="size-3" />Telegram updates <ArrowRight className="size-3" /></a></footer>
      </div>
      <Dialog open={showJoin && !booting} onOpenChange={open => { if (!open) dismissJoin(); }}>
        <DialogContent className="catalog-theme max-w-sm rounded-lg bg-card p-7 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary"><Send className="size-6" /></div>
          <DialogTitle className="font-display text-xl">Join our Telegram</DialogTitle>
          <DialogDescription>New channels, fixes and updates from Premium PlugX TV.</DialogDescription>
          <Button asChild className="mt-2"><a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" onClick={dismissJoin}><Send />Join channel</a></Button>
          <Button variant="ghost" onClick={dismissJoin} className="text-muted-foreground">Maybe later</Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
