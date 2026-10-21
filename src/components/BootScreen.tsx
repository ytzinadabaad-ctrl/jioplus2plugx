import { Tv } from "lucide-react";

export default function BootScreen({ loading = false }: { loading?: boolean }) {
  return (
    <div className="catalog-theme fixed inset-0 z-[80] flex items-center justify-center bg-background" role="status" aria-live="polite" aria-label="Starting Premium PlugX TV">
      <div className="flex w-full max-w-sm flex-col items-center px-8 text-center">
        <div className="boot-mark mb-6 flex size-16 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Tv className="size-8" /></div>
        <span className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Premium</span>
        <h1 className="font-display text-4xl font-bold">Plug<span className="text-primary">X</span> TV</h1>
        <div className="boot-track mt-8 h-0.5 w-40 overflow-hidden bg-secondary"><div className="boot-scan h-full w-1/2 bg-primary" /></div>
        <p className="mt-4 text-xs text-muted-foreground">{loading ? "Connecting to live channels…" : "Your live TV is ready"}</p>
      </div>
    </div>
  );
}