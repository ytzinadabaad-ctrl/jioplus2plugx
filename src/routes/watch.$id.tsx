import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { channelsQuery } from "@/lib/channels";

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
  const { data } = useSuspenseQuery(channelsQuery);
  const ch = data.find((c) => c.id === id)!;
  const related = data.filter((c) => c.group === ch.group && c.id !== ch.id).slice(0, 18);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/" className="mb-4 inline-block text-sm text-muted-foreground hover:text-primary">
        ← All channels
      </Link>
      <ClientOnly fallback={<div className="aspect-video w-full rounded-xl bg-card" />}>
        <Suspense fallback={<div className="aspect-video w-full rounded-xl bg-card" />}>
          <ShakaPlayer channel={ch} />
        </Suspense>
      </ClientOnly>
      <div className="mt-5 flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
        <img src={ch.logo} alt="" className="h-14 w-14 rounded-xl bg-background object-contain p-1.5 shadow-md" />
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{ch.name}</h1>
          <p className="text-sm text-muted-foreground">{ch.group}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <ClientOnly><Suspense fallback={null}><LiveViewers channelId={ch.id} /></Suspense></ClientOnly>
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
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {related.map((c) => (
              <Link key={c.id} to="/watch/$id" params={{ id: c.id }}
                className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card/60 p-3 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_12px_30px_-12px_var(--primary)]">
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
