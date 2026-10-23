import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Captions, Heart, LayoutGrid, Maximize, Pause, PictureInPicture2,
  Play, RefreshCw, RotateCcw, RotateCw, Settings, Tv, Volume2, VolumeX, X,
} from "lucide-react";
import { parseClearKeys, streamUrl, type Channel } from "@/lib/channels";
import { LIVE_EDGE_OFFSET, RESYNC_BEHIND_SECONDS, STARTUP_ABR, STARTUP_STREAMING, STEADY_STREAMING } from "@/lib/player-config";
import { emitPlayer, onSleepTimer } from "@/lib/player-events";
import { currentIndex, epgQuery } from "@/lib/epg";

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
const SPEEDS = [0.5, 0.75, 1, 1.25];

interface Track {
  id: number;
  height: number;
  active: boolean;
}

function fmtBehind(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `-${h ? h + ":" : ""}${mm}:${String(r).padStart(2, "0")}`;
}

export default function ShakaPlayer({
  channel,
  fav,
  onToggleFav,
  theater,
  onToggleTheater,
  metaExtra,
}: {
  channel: Channel;
  fav: boolean;
  onToggleFav: () => void;
  theater: boolean;
  onToggleTheater: () => void;
  metaExtra?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState(0);
  const [boost, setBoost] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [autoQuality, setAutoQuality] = useState(true);
  const [quality, setQuality] = useState("Auto");
  const [captionsOn, setCaptionsOn] = useState(false);
  const [now, setNow] = useState(0);
  const [seekStart, setSeekStart] = useState(0);
  const [seekEnd, setSeekEnd] = useState(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teardownRef = useRef<Promise<void>>(Promise.resolve());
  const gainRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const url = streamUrl(channel);
  const clearKey = channel.clearkey;
  const token = tokenOf(channel);

  const { data: epg } = useQuery(epgQuery(channel.id));
  const nowProg = epg?.[currentIndex(epg, Date.now())];

  const wake = () => {
    setIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused && !settingsOpen) setIdle(true);
    }, 3000);
  };

  const flash = (t: string) => {
    setToast(t);
    window.clearTimeout((flash as any)._t);
    (flash as any)._t = window.setTimeout(() => setToast(null), 1400);
  };

  useEffect(() => {
    const m = Number(localStorage.getItem("plugx_mode") ?? 0);
    if (m >= 0 && m < MODES.length) setMode(m);
  }, []);

  const pickMode = (n: number) => {
    setMode(n);
    localStorage.setItem("plugx_mode", String(n));
    flash(`Screen: ${MODES[n]?.label ?? "Fit"}`);
  };

  const applyBoost = (n: number) => {
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
      const gain = BOOSTS[n] ?? 1;
      if (gainRef.current) gainRef.current.gain.value = gain;
      setBoost(n);
      flash(n === 0 ? "Boost off" : `Volume boost ${gain * 100}%`);
    } catch {
      flash("Boost not supported");
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const seekBy = (d: number) => {
    const v = videoRef.current;
    if (!v || !v.seekable.length) return;
    const start = v.seekable.start(0);
    const end = v.seekable.end(v.seekable.length - 1);
    v.currentTime = Math.min(Math.max(v.currentTime + d, start), end);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  };

  const togglePip = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else v.requestPictureInPicture?.().catch(() => flash("PiP not supported"));
  };

  const toggleFullscreen = () => {
    const c = containerRef.current;
    if (!c) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else c.requestFullscreen?.().catch(() => {});
  };

  const snapToLive = (v: HTMLVideoElement, offset = LIVE_EDGE_OFFSET) => {
    if (!v.seekable.length) return false;
    const end = v.seekable.end(v.seekable.length - 1);
    const target = Math.max(v.seekable.start(0), end - offset);
    if (!Number.isFinite(target)) return false;
    v.currentTime = target;
    return true;
  };

  const goLive = () => {
    const v = videoRef.current;
    if (!v || !snapToLive(v, 2)) return;
    v.play().catch(() => {});
    flash("Back to live");
  };

  const pickSpeed = (s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    flash(s === 1 ? "Normal speed" : `Speed ${s}×`);
  };

  const pickQuality = (t: Track | null) => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (!t) {
        p.configure({ abr: { enabled: true } });
        setAutoQuality(true);
        setQuality("Auto");
        emitPlayer("Quality set to Auto", { quality: "Auto" });
      } else {
        p.configure({ abr: { enabled: false } });
        p.selectVariantTrack(t, true);
        setAutoQuality(false);
        setQuality(`${t.height}p`);
        emitPlayer(`Quality set to ${t.height}p`, { quality: `${t.height}p` });
      }
    } catch {
      flash("Quality switch failed");
    }
  };

  const toggleCaptions = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      const nextOn = !captionsOn;
      p.setTextTrackVisibility(nextOn);
      setCaptionsOn(nextOn);
      flash(nextOn ? "Subtitles on" : "Subtitles off");
    } catch {
      flash("Subtitles unavailable");
    }
  };

  // Sleep timer (set from the side panel select)
  const [sleepAt, setSleepAt] = useState<number | null>(null);
  useEffect(
    () =>
      onSleepTimer((minutes) => {
        setSleepAt(minutes ? Date.now() + minutes * 60000 : null);
        flash(minutes ? `Sleep in ${minutes} min` : "Sleep timer off");
      }),
    [],
  );
  useEffect(() => {
    if (!sleepAt) return;
    const t = setInterval(() => {
      if (Date.now() >= sleepAt) {
        videoRef.current?.pause();
        setSleepAt(null);
        flash("Sleep timer — paused");
        emitPlayer("Sleep timer paused playback", { state: "Paused" });
      }
    }, 10000);
    return () => clearInterval(t);
  }, [sleepAt]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "f": toggleFullscreen(); break;
        case "m": toggleMute(); break;
        case "z": pickMode((mode + 1) % MODES.length); break;
        case "b": applyBoost((boost + 1) % BOOSTS.length); break;
        case "p": togglePip(); break;
        case "l": goLive(); break;
        case "arrowleft": seekBy(-10); break;
        case "arrowright": seekBy(10); break;
        case "arrowup": e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); break;
        case "arrowdown": e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Video element state listeners
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => { setPaused(false); emitPlayer("Playing", { state: "Playing" }); };
    const onPause = () => { setPaused(true); emitPlayer("Paused", { state: "Paused" }); };
    const onVolume = () => { setMuted(v.muted); setVolume(v.volume); };
    const onTime = () => {
      setNow(v.currentTime);
      if (v.seekable.length) {
        setSeekStart(v.seekable.start(0));
        setSeekEnd(v.seekable.end(v.seekable.length - 1));
      }
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("volumechange", onVolume);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("progress", onTime);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("volumechange", onVolume);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("progress", onTime);
    };
  }, []);

  // Shaka setup
  useEffect(() => {
    let player: any = null;
    let cancelled = false;
    let autoRetried = false;
    const playingController = new AbortController();
    let destroyPromise: Promise<void> | null = null;
    const destroy = () => {
      if (!destroyPromise) {
        destroyPromise = Promise.resolve()
          .then(async () => {
            if (player) await player.destroy();
          })
          .catch(() => {});
      }
      return destroyPromise;
    };
    setError(null);
    setLoading(true);
    emitPlayer(attempt ? `Reconnecting (attempt ${attempt + 1})` : "Connecting to stream", {
      state: "Connecting",
      recoveries: attempt,
    });

    (async () => {
      await teardownRef.current;
      if (cancelled) return;
      const mod: any = await import("shaka-player/dist/shaka-player.compiled.js");
      const shaka = mod.default ?? mod;
      const video = videoRef.current;
      if (cancelled || !video) return;

      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) {
        setError("This browser can't play this stream.");
        setLoading(false);
        emitPlayer("Browser not supported", { state: "Error" });
        return;
      }

      player = new shaka.Player();
      playerRef.current = player;
      await player.attach(video);
      if (cancelled) {
        await destroy();
        return;
      }

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
        if (cancelled) return;
        setLoading(!!e.buffering);
        if (e.buffering) emitPlayer("Buffering…", { state: "Buffering" });
      });
      player.addEventListener("error", (e: any) => {
        if (cancelled) return;
        // One silent automatic reconnect before showing an error — transient manifest/segment failures recover this way.
        if (!autoRetried) {
          autoRetried = true;
          emitPlayer("Stream hiccup — auto-reconnecting", { state: "Connecting", recoveries: attempt + 1 });
          window.setTimeout(() => {
            if (!cancelled) setAttempt((a) => a + 1);
          }, 2500);
          return;
        }
        setError(`Playback error (code ${e?.detail?.code ?? "?"})`);
        setLoading(false);
        emitPlayer("Playback error", { state: "Error" });
      });
      const syncQuality = () => {
        if (cancelled) return;
        try {
          const active = player.getVariantTracks().find((t: any) => t.active);
          const label = autoQuality ? (active?.height ? `Auto (${active.height}p)` : "Auto") : active?.height ? `${active.height}p` : "Auto";
          setQuality(label);
          emitPlayer("Stream quality updated", { quality: label, state: "Playing" });
        } catch {}
      };
      player.addEventListener("adaptation", syncQuality);

      video.addEventListener(
        "playing",
        () => {
          if (cancelled) return;
          player.configure({ streaming: STEADY_STREAMING });
          setLoading(false);
          emitPlayer("Playing", { state: "Playing" });
          syncQuality();
        },
        { once: true, signal: playingController.signal },
      );

      try {
        await player.load(url);
        if (cancelled) return;
        const seen = new Set<number>();
        setTracks(
          player
            .getVariantTracks()
            .filter((t: any) => t.height && !seen.has(t.height) && seen.add(t.height))
            .map((t: any) => ({ id: t.id, height: t.height, active: !!t.active }))
            .sort((a: Track, b: Track) => b.height - a.height),
        );
        setLoading(false);
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      } catch (e: any) {
        if (cancelled) return;
        const code = e?.code;
        const msg =
          code === 1001
            ? "The stream server refused the request (it may be region-locked or the token expired)."
            : `Couldn't load stream (code ${code ?? "?"})`;
        setError(msg);
        setLoading(false);
        emitPlayer(msg, { state: "Error" });
      }
    })().catch(() => {
      if (!cancelled) {
        setError("Couldn't start the player. Please retry.");
        setLoading(false);
        emitPlayer("Player failed to start", { state: "Error" });
      }
    });

    return () => {
      cancelled = true;
      playingController.abort();
      playerRef.current = null;
      teardownRef.current = destroy();
    };
  }, [url, clearKey, token, attempt]);

  const behind = seekEnd - now;
  const isLive = !seekEnd || behind < 12;
  const pct = seekEnd > seekStart ? Math.min(100, Math.max(0, ((now - seekStart) / (seekEnd - seekStart)) * 100)) : 100;

  const nfBtn =
    "relative grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-foreground transition hover:scale-110 hover:bg-foreground/10 active:scale-95 sm:h-11 sm:w-11";

  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-background shadow-[0_32px_90px_rgba(0,0,0,.45)] sm:rounded-[26px]">
      <div
        ref={containerRef}
        onMouseMove={wake}
        onTouchStart={wake}
        className={`plugx-player relative aspect-video w-full select-none overflow-hidden bg-background ${idle && !settingsOpen ? "plugx-idle" : ""}`}
      >
        <video ref={videoRef} className={`h-full w-full ${MODES[mode]?.cls ?? "object-contain"}`} autoPlay playsInline preload="auto" />

        {/* click surface toggles playback */}
        <button aria-label={paused ? "Play" : "Pause"} onClick={togglePlay} className="absolute inset-0 z-[1] h-full w-full cursor-pointer" />

        {/* gradient shades */}
        <div aria-hidden className="plugx-overlay pointer-events-none absolute inset-x-0 top-0 z-[2] h-1/3 bg-gradient-to-b from-background/80 via-background/15 to-transparent transition-opacity duration-200" />
        <div aria-hidden className="plugx-overlay pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-1/2 bg-gradient-to-t from-background/95 via-background/30 to-transparent transition-opacity duration-200" />

        {/* top bar */}
        <div className="plugx-overlay absolute inset-x-0 top-0 z-[5] flex items-center gap-3 p-3 transition-opacity duration-200 sm:p-6">
          <Link to="/" aria-label="Back to channels" className={nfBtn}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {paused && (
            <span className="hidden h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-card p-1 sm:grid">
              <img src={channel.logo} alt="" className="max-h-full max-w-full object-contain" />
            </span>
          )}
          <div className="min-w-0 [text-shadow:0_2px_8px_var(--background)]">
            <span className="block text-[10px] text-foreground/70 sm:text-xs">You're watching</span>
            <strong className="block max-w-[55vw] truncate text-sm sm:text-lg">{channel.name}</strong>
          </div>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded bg-background/60 px-2.5 py-1.5 text-[9px] font-extrabold tracking-[0.1em] text-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_0_4px_var(--primary)]" />
            LIVE
          </span>
        </div>

        {/* center controls */}
        <div className="plugx-overlay absolute left-1/2 top-1/2 z-[5] flex -translate-x-1/2 -translate-y-1/2 items-center gap-6 transition-opacity duration-200 sm:gap-14">
          <button onClick={() => seekBy(-10)} aria-label="Back 10 seconds" className={`${nfBtn} hidden sm:grid`}>
            <RotateCcw className="h-6 w-6" />
            <span className="absolute text-[7px] font-black">10</span>
          </button>
          <button
            onClick={togglePlay}
            aria-label={paused ? "Play" : "Pause"}
            className="grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-foreground/90 bg-background/50 text-foreground transition hover:scale-110 active:scale-95 sm:h-20 sm:w-20"
          >
            {paused ? <Play className="ml-1 h-7 w-7 fill-current sm:h-9 sm:w-9" /> : <Pause className="h-7 w-7 fill-current sm:h-9 sm:w-9" />}
          </button>
          <button onClick={() => seekBy(10)} aria-label="Forward 10 seconds" className={`${nfBtn} hidden sm:grid`}>
            <RotateCw className="h-6 w-6" />
            <span className="absolute text-[7px] font-black">10</span>
          </button>
        </div>

        {/* bottom bar */}
        <div className="plugx-overlay absolute inset-x-0 bottom-0 z-[5] px-3 pb-2.5 transition-opacity duration-200 sm:px-6 sm:pb-4">
          <label className="nf-timeline flex h-4 cursor-pointer items-center" aria-label="Seek">
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(pct * 10)}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v || seekEnd <= seekStart) return;
                v.currentTime = seekStart + (Number(e.target.value) / 1000) * (seekEnd - seekStart);
              }}
              className="nf-progress w-full"
              style={{ "--nf-pct": `${pct}%` } as React.CSSProperties}
            />
          </label>
          <div className="flex h-11 items-center gap-0.5 sm:h-12">
            <button onClick={togglePlay} aria-label={paused ? "Play" : "Pause"} className={nfBtn}>
              {paused ? <Play className="h-5 w-5 fill-current" /> : <Pause className="h-5 w-5 fill-current" />}
            </button>
            <button onClick={() => seekBy(-10)} aria-label="Back 10 seconds" className={`${nfBtn} hidden sm:grid`}>
              <RotateCcw className="h-5 w-5" />
            </button>
            <button onClick={() => seekBy(10)} aria-label="Forward 10 seconds" className={`${nfBtn} hidden sm:grid`}>
              <RotateCw className="h-5 w-5" />
            </button>
            <div className="group/vol flex items-center">
              <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className={nfBtn}>
                {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((muted ? 0 : volume) * 100)}
                onChange={(e) => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = false;
                  v.volume = Number(e.target.value) / 100;
                }}
                aria-label="Volume"
                className="nf-volume-range hidden w-0 opacity-0 transition-all duration-200 group-hover/vol:w-[72px] group-hover/vol:opacity-100 sm:block"
              />
            </div>
            <button
              onClick={goLive}
              title={isLive ? "You're at the live edge" : "Jump back to live"}
              className={`ml-1 shrink-0 text-[10px] font-bold tabular-nums sm:text-xs ${isLive ? "cursor-default text-foreground" : "cursor-pointer text-primary hover:underline"}`}
            >
              {isLive ? "LIVE" : fmtBehind(behind)}
            </button>
            <div className="ml-3 hidden min-w-0 text-[10px] sm:block sm:text-xs">
              <b className="font-semibold">{nowProg?.title ?? channel.name}</b>
              <span className="ml-1 text-foreground/60">Live</span>
            </div>
            <div className="ml-auto flex items-center">
              <Link to="/" aria-label="Browse channels" title="Browse channels" className={`${nfBtn} hidden sm:grid`}>
                <LayoutGrid className="h-5 w-5" />
              </Link>
              <button onClick={toggleCaptions} aria-label="Subtitles" title="Subtitles" className={`${nfBtn} hidden md:grid ${captionsOn ? "text-primary" : ""}`}>
                <Captions className="h-5 w-5" />
              </button>
              <button onClick={togglePip} aria-label="Picture in Picture" title="Picture in Picture" className={`${nfBtn} hidden sm:grid`}>
                <PictureInPicture2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                aria-label="Playback settings"
                title="Playback settings"
                className={`${nfBtn} ${settingsOpen ? "text-primary" : ""}`}
              >
                <Settings className="h-5 w-5" />
              </button>
              <button onClick={toggleFullscreen} aria-label="Full screen" title="Full screen" className={nfBtn}>
                <Maximize className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* settings panel */}
        {settingsOpen && (
          <div className="absolute bottom-[70px] right-3 z-[9] max-h-[65%] w-[min(270px,calc(100%-24px))] overflow-auto rounded-lg border border-border bg-popover/95 p-3.5 shadow-2xl backdrop-blur sm:bottom-[92px] sm:right-6">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <span className="text-[13px] font-bold">Playback settings</span>
              <button onClick={() => setSettingsOpen(false)} aria-label="Close settings" className="grid h-7 w-7 place-items-center rounded-full hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <span className="mb-1.5 mt-3 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">Playback speed</span>
            <div className="grid grid-cols-4 gap-1.5">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => pickSpeed(s)}
                  className={`min-h-8 rounded border text-[10px] font-bold transition ${
                    speed === s ? "border-foreground bg-foreground text-background" : "border-border bg-secondary/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {s === 1 ? "Normal" : `${s}×`}
                </button>
              ))}
            </div>
            <span className="mb-1.5 mt-3 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">Video quality</span>
            <div className="grid gap-1">
              <button
                onClick={() => pickQuality(null)}
                className={`flex min-h-8 items-center justify-between rounded border px-2.5 text-left text-[10px] font-bold transition ${
                  autoQuality ? "border-foreground bg-foreground text-background" : "border-border bg-secondary/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                Auto {autoQuality && quality.startsWith("Auto (") ? `· ${quality.slice(5, -1)}` : ""}
                {autoQuality && <span>✓</span>}
              </button>
              {tracks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickQuality(t)}
                  className={`flex min-h-8 items-center justify-between rounded border px-2.5 text-left text-[10px] font-bold transition ${
                    !autoQuality && quality === `${t.height}p`
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-secondary/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {t.height}p{!autoQuality && quality === `${t.height}p` && <span>✓</span>}
                </button>
              ))}
            </div>
            <span className="mb-1.5 mt-3 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">Screen size</span>
            <div className="grid grid-cols-5 gap-1.5">
              {MODES.map((m, i) => (
                <button
                  key={m.label}
                  onClick={() => pickMode(i)}
                  className={`min-h-8 rounded border text-[10px] font-bold transition ${
                    mode === i ? "border-foreground bg-foreground text-background" : "border-border bg-secondary/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <span className="mb-1.5 mt-3 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">Volume boost</span>
            <div className="grid grid-cols-4 gap-1.5">
              {BOOSTS.map((g, i) => (
                <button
                  key={g}
                  onClick={() => applyBoost(i)}
                  className={`min-h-8 rounded border text-[10px] font-bold transition ${
                    boost === i ? "border-foreground bg-foreground text-background" : "border-border bg-secondary/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {i === 0 ? "Off" : `${g * 100}%`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* spinner */}
        {loading && !error && (
          <div className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary sm:h-16 sm:w-16" />
          </div>
        )}

        {/* error */}
        {error && (
          <div className="absolute inset-0 z-[30] grid place-items-center bg-background p-7 text-center">
            <div>
              <p className="text-2xl text-primary">⚠</p>
              <h2 className="mt-3 font-display text-base font-bold">Playback problem</h2>
              <p className="mx-auto mt-1.5 max-w-[420px] text-xs leading-relaxed text-muted-foreground">{error}</p>
              <button
                onClick={() => setAttempt((a) => a + 1)}
                className="mt-4 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* toast */}
        {toast && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[20] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-popover/90 px-5 py-2 text-sm font-semibold shadow-xl backdrop-blur">
            {toast}
          </div>
        )}
      </div>

      {/* channel strip */}
      <div className="flex flex-wrap items-center gap-3.5 border-t border-border bg-card px-4 py-4">
        <span className="grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-[15px] border border-border bg-secondary p-1.5">
          <img src={channel.logo} alt="" className="max-h-full max-w-full object-contain" />
        </span>
        <div className="min-w-0">
          <div className="truncate font-display text-base font-bold sm:text-xl">{channel.name}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Live
            </span>
            <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              {channel.group || "Channel"}
            </span>
            <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              {quality}
            </span>
            {metaExtra}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            onClick={onToggleFav}
            title="Favourite"
            className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-extrabold transition hover:-translate-y-0.5 ${
              fav ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${fav ? "fill-current" : ""}`} />
            <span className="hidden sm:inline">{fav ? "Saved" : "Save"}</span>
          </button>
          <button onClick={() => setAttempt((a) => a + 1)} title="Reconnect" className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 text-[11px] font-extrabold text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reload</span>
          </button>
          <button onClick={toggleMute} title="Mute" className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 text-[11px] font-extrabold text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground">
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Mute</span>
          </button>
          <button onClick={togglePip} title="Picture in Picture" className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 text-[11px] font-extrabold text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground">
            <PictureInPicture2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PiP</span>
          </button>
          <button onClick={onToggleTheater} title="Theater mode" className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-extrabold transition hover:-translate-y-0.5 ${theater ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
            <Tv className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Theater</span>
          </button>
          <button onClick={toggleFullscreen} title="Fullscreen" className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 text-[11px] font-extrabold text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground">
            <Maximize className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Full</span>
          </button>
        </div>
      </div>
    </section>
  );
}
