import { useEffect, useState } from "react";
import { Signal } from "lucide-react";
import { usePlayerInfo } from "@/lib/player-events";

function fmtSession(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const METER: Record<string, number> = {
  Playing: 100,
  Buffering: 55,
  Connecting: 25,
  Paused: 70,
  Error: 8,
  Starting: 12,
};

const HINT: Record<string, string> = {
  Playing: "Signal is stable",
  Buffering: "Catching up with the live edge",
  Connecting: "Automatic recovery is standing by",
  Paused: "Playback is paused",
  Error: "Trying to recover the stream",
  Starting: "Preparing the player",
};

export default function StreamHealth() {
  const info = usePlayerInfo();
  const [secs, setSecs] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const isErr = info.state === "Error";
  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-card/60 backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <h3 className="flex items-center gap-2 font-display text-[13px] font-bold">
          <Signal className="h-4 w-4 text-primary" /> Stream health
        </h3>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{info.state}</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${isErr ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            <Signal className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[13px] font-extrabold">{isErr ? "Signal interrupted" : info.state === "Playing" ? "Signal locked" : info.state}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{HINT[info.state] ?? HINT.Starting}</div>
          </div>
        </div>
        <div className="mt-3.5 h-[5px] overflow-hidden rounded-full bg-secondary">
          <span
            className={`block h-full rounded-full transition-all duration-500 ${isErr ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${METER[info.state] ?? 15}%` }}
          />
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          {[
            ["Session", fmtSession(secs)],
            ["Recovery", String(info.recoveries)],
            ["Network", online ? "Online" : "Offline"],
            ["State", info.state],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-background/40 p-2.5">
              <small className="block text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">{k}</small>
              <b className="mt-1 block font-display text-[13px] font-bold">{v}</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
