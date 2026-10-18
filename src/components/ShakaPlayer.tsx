import { useEffect, useRef, useState } from "react";
import "shaka-player/dist/controls.css";
import { parseClearKeys, streamUrl, type Channel } from "@/lib/channels";
import { STARTUP_ABR, STARTUP_STREAMING, STEADY_STREAMING } from "@/lib/player-config";
import { Button } from "@/components/ui/button";

function tokenOf(ch: Channel): string | null {
  const cookie = ch.headers?.cookie ?? ch.headers?.Cookie ?? "";
  return cookie.match(/__hdnea__=([^;]+)/)?.[1] ?? null;
}

const MODES = [
  { label: "Fit", cls: "object-contain" },
  { label: "Stretch", cls: "object-fill" },
  { label: "Zoom", cls: "object-cover" },
  { label: "16:9", cls: "object-fill aspect-video !h-auto m-auto" },
  { label: "4:3", cls: "object-fill aspect-[4/3] !w-auto mx-auto" },
] as const;

const BOOSTS = [1, 1.5, 2, 3];

export default function ShakaPlayer({ channel }: { channel: Channel }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState(0);
  const [boost, setBoost] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teardownRef = useRef<Promise<void>>(Promise.resolve());
  const url = streamUrl(channel);
  const clearKey = channel.clearkey;
  const token = tokenOf(channel);

  const wake = () => {
    setIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) setIdle(true);
    }, 3000);
  };
  const gainRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const flash = (t: string) => {
    setToast(t);
    window.clearTimeout((flash as any)._t);
    (flash as any)._t = window.setTimeout(() => setToast(null), 1200);
  };

  useEffect(() => {
    const m = Number(localStorage.getItem("plugx_mode") ?? 0);
    if (m >= 0 && m < MODES.length) setMode(m);
  }, []);

  const cycleMode = () =>
    setMode((m) => {
      const n = (m + 1) % MODES.length;
      localStorage.setItem("plugx_mode", String(n));
      flash(`Screen: ${MODES[n]?.label ?? "Fit"}`);
      return n;
    });
  const pickMode = (n: number) => {
    setMode(n);
    localStorage.setItem("plugx_mode", String(n));
    flash(`Screen: ${MODES[n]?.label ?? "Fit"}`);
  };

  const cycleBoost = () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (!audioCtxRef.current) {
        const ctx = new AudioContext();
        const src = ctx.createMediaElementSource(v);
        const gain = ctx.createGain();
        src.connect(gain).connect(ctx.destination);
        audioCtxRef.current = ctx;
        gainRef.current = gain;
      }
      audioCtxRef.current.resume();
      setBoost((b) => {
        const n = (b + 1) % BOOSTS.length;
        const gain = BOOSTS[n] ?? 1;
        if (gainRef.current) gainRef.current.gain.value = gain;
        flash(n === 0 ? "Boost off" : `Volume boost ${gain * 100}%`);
        return n;
      });
    } catch {
      flash("Boost not supported");
    }
  };

  const toggleFullscreen = () => {
    const c = containerRef.current;
    if (!c) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else c.requestFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          v.paused ? v.play() : v.pause();
          break;
        case "f": toggleFullscreen(); break;
        case "m": v.muted = !v.muted; flash(v.muted ? "Muted" : "Unmuted"); break;
        case "z": cycleMode(); break;
        case "b": cycleBoost(); break;
        case "p": document.pictureInPictureElement ? document.exitPictureInPicture() : v.requestPictureInPicture?.().catch(() => {}); break;
        case "arrowup": e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); flash(`Volume ${Math.round(v.volume * 100)}%`); break;
        case "arrowdown": e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); flash(`Volume ${Math.round(v.volume * 100)}%`); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    let ui: any = null;
    let player: any = null;
    let cancelled = false;
    const playingController = new AbortController();
    let destroyPromise: Promise<void> | null = null;
    const destroy = () => {
      if (!destroyPromise) {
        destroyPromise = Promise.resolve().then(async () => {
          // Overlay.destroy also destroys its player; don't destroy it twice.
          if (ui) await ui.destroy();
          else if (player) await player.destroy();
        }).catch(() => {});
      }
      return destroyPromise;
    };
    setError(null);
    setLoading(true);

    (async () => {
      await teardownRef.current;
      if (cancelled) return;
      const mod: any = await import("shaka-player/dist/shaka-player.ui.js");
      const shaka = mod.default ?? mod;
      const video = videoRef.current;
      const container = containerRef.current;
      if (cancelled || !video || !container) return;

      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) {
        setError("This browser can't play this stream.");
        setLoading(false);
        return;
      }

      player = new shaka.Player();
      await player.attach(video);
      if (cancelled) {
        await destroy();
        return;
      }
      ui = new shaka.ui.Overlay(player, container, video);
      ui.configure({
        // Fewer buttons in the bar so nothing gets squeezed on phones; extras live in the ⋮ settings menu.
        controlPanelElements: ["play_pause", "mute", "volume", "spacer", "quality", "language", "overflow_menu", "fullscreen"],
        overflowMenuButtons: ["captions", "playback_rate", "picture_in_picture", "quality", "language"],
        addSeekBar: true,
        fadeDelay: 0,
      });

      player.configure({
        drm: { clearKeys: parseClearKeys(clearKey) },
        streaming: STARTUP_STREAMING,
        manifest: {
          // Stay a bit further behind the live edge — playing right at the edge causes constant stalls.
          defaultPresentationDelay: 20,
          retryParameters: { maxAttempts: 5, baseDelay: 400, timeout: 15000 },
        },
        abr: STARTUP_ABR,
      });

      // Add the access token to EVERY request (manifest + all segments), not just the first link.
      if (token) {
        player.getNetworkingEngine().registerRequestFilter((_type: number, req: { uris: string[] }) => {
          req.uris = req.uris.map((u) =>
            u.includes("__hdnea__=") || !/jio\.com|akamaized\.net|cloudfront\.net/.test(u)
              ? u
              : u + (u.includes("?") ? "&" : "?") + "__hdnea__=" + token,
          );
        });
      }

      player.addEventListener("buffering", (e: any) => {
        if (!cancelled) setLoading(!!e.buffering);
      });
      player.addEventListener("error", (e: any) => {
        if (cancelled) return;
        setError(`Playback error (code ${e?.detail?.code ?? "?"})`);
        setLoading(false);
      });

      video.addEventListener("playing", () => {
        if (cancelled) return;
        player.configure({ streaming: STEADY_STREAMING });
        setLoading(false);
      }, { once: true, signal: playingController.signal });

      try {
        await player.load(url);
        if (cancelled) return;
        setLoading(false);
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      } catch (e: any) {
        if (cancelled) return;
        const code = e?.code;
        setError(
          code === 1001
            ? "The stream server refused the request (it may be region-locked or the token expired)."
            : `Couldn't load stream (code ${code ?? "?"})`,
        );
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setError("Couldn't start the player. Please retry.");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      playingController.abort();
      teardownRef.current = destroy();
    };
  }, [url, clearKey, token, attempt]);

  return (
    <div>
    <div className="rounded-2xl bg-gradient-to-br from-primary/40 via-border to-chart-4/30 p-[1.5px] shadow-[0_0_80px_-20px_var(--primary)]">
    <div
      ref={containerRef}
      onMouseMove={wake}
      onTouchStart={wake}
      onClick={wake}
      className={`relative flex aspect-video w-full overflow-hidden rounded-2xl bg-background ${idle ? "plugx-idle" : ""}`}
    >
      <video ref={videoRef} className={`h-full w-full ${MODES[mode]?.cls ?? "object-contain"}`} autoPlay playsInline preload="auto" />
      <div aria-hidden className="plugx-overlay pointer-events-none absolute inset-x-0 top-0 z-[4] h-16 bg-gradient-to-b from-background/60 to-transparent transition-opacity duration-300" />
      <span className="plugx-overlay absolute left-3 top-3 z-[5] flex items-center gap-1.5 rounded-full bg-destructive/20 px-3 py-1 text-[10px] font-bold tracking-widest text-destructive backdrop-blur transition-opacity duration-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
        LIVE
      </span>
       <Button
        onClick={cycleMode}
        title="Screen size (Z)"
        className="plugx-overlay absolute right-3 top-3 z-[5] rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur transition-all duration-300 hover:bg-primary hover:text-primary-foreground"
      >
         ⤢ {MODES[mode]?.label ?? "Fit"}
       </Button>
      {toast && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[6] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background/80 px-5 py-2 text-sm font-semibold shadow-xl backdrop-blur">
          {toast}
        </div>
      )}
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/85 p-6 text-center backdrop-blur-sm">
          <p className="text-sm text-destructive">{error}</p>
           <Button
            onClick={() => setAttempt((a) => a + 1)}
            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-6px_var(--primary)] transition-transform hover:scale-105"
          >
            Retry
           </Button>
        </div>
      )}
    </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/60 p-2.5 backdrop-blur">
      <span className="pl-1 text-xs font-semibold text-muted-foreground">Screen:</span>
      {MODES.map((m, i) => (
        <Button size="sm" key={m.label} onClick={() => pickMode(i)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${i === mode ? "bg-primary text-primary-foreground shadow-[0_0_16px_-4px_var(--primary)]" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
          {m.label}
        </Button>
      ))}
      <Button size="sm" onClick={cycleBoost}
        className={`ml-auto rounded-full px-3 py-1 text-xs font-medium transition-all ${boost ? "bg-primary text-primary-foreground shadow-[0_0_16px_-4px_var(--primary)]" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
        🔊 Boost {boost ? `${(BOOSTS[boost] ?? 1) * 100}%` : "off"}
      </Button>
    </div>
    <p className="mt-2 hidden text-[11px] text-muted-foreground sm:block">
      Shortcuts: Space play · F fullscreen · M mute · Z screen size · B boost · P picture-in-picture · ↑↓ volume
    </p>
    </div>
  );
}
