import { usePlayerLog } from "@/lib/player-events";

export default function ActivityLog() {
  const lines = usePlayerLog(7);
  return (
    <div className="mt-3 grid gap-2">
      {lines.map((l, i) => (
        <div key={`${l.at.getTime()}-${i}`} className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="truncate">{l.text}</span>
          <time className="ml-auto shrink-0 text-[10px] text-muted-foreground/60">
            {l.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </time>
        </div>
      ))}
    </div>
  );
}
