import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { channelsQuery } from "@/lib/channels";
import { addRecent, useFavorites } from "@/lib/favorites";
import { Button } from "@/components/ui/button";

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
  const fav = isFav(ch.id);

  useEffect(() => addRecent(ch.id), [ch.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
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

  const pill = "rounded-full bg-secondary px-3.5 text-xs font-semibold text-secondary-foreground hover:bg-accent";

  return (
    <main className={`mx-auto px-4 py-6 transition-all duration-500 ${theater ? "max-w-[1600px]" : "max-w-6xl"}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← All channels</Link>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className={pill} title="Previous channel">
            <Link to="/watch/$id" params={{ id: prev.id }}>◀ Prev</Link>
          </Button>
          <Button asChild size="sm" className={pill} title="Next channel (N)">
            <Link to="/watch/$id" params={{ id: next.id }}>Next ▶</Link>
          </Button>
          <Button size="sm" onClick={() => setTheater((v) => !v)} className={`hidden sm:inline-flex ${theater ? "rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground" : pill}`} title="Theater mode (T)">
            ⤢ Theater
          </Button>
        </div>
      </div>
      <ClientOnly fallback={<div className="aspect-video w-full rounded-xl bg-card" />}>
        <Suspense fallback={<div className="aspect-video w-full rounded-xl bg-card" />}>
          <ShakaPlayer channel={ch} />
        </Suspense>
      </ClientOnly>
      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
        <img src={ch.logo} alt="" className="h-14 w-14 rounded-xl bg-background object-contain p-1.5 shadow-md" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight">{ch.name}</h1>
          <p className="text-sm text-muted-foreground">{ch.group} · {idx + 1} of {sameGroup.length}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <ClientOnly><Suspense fallback={null}><LiveViewers channelId={ch.id} /></Suspense></ClientOnly>
          <Button size="sm" onClick={() => toggle(ch.id)} className={fav ? "rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground" : pill}>
            {fav ? "★ Favourited" : "☆ Favourite"}
          </Button>
          <Button size="sm" onClick={share} className={pill}>↗ Share</Button>
          <span className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-3.5 py-1.5 text-xs font-bold tracking-wider text-destructive">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
            LIVE
          </span>
        </div>
      </div>
      <ClientOnly><Suspense fallback={null}><ProgramGuide channelId={ch.id} fallbackLogo={ch.logo} /></Suspense></ClientOnly>
      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-lg font-semibold">More in {ch.group}</h2>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {related.map((c) => (
              <Link key={c.id} to="/watch/$id" params={{ id: c.id }}
                className="group flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border border-border bg-card/60 p-3 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_12px_30px_-12px_var(--primary)]">
                <img src={c.logo} alt={c.name} loading="lazy" className="h-12 object-contain transition-transform duration-300 group-hover:scale-110" />
                <span className="line-clamp-1 text-center text-[11px] font-medium">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
