import { useEffect, useRef, useState } from "react";
import { type Channel } from "@/lib/channels";
import { emitPlayer } from "@/lib/player-events";

// ═══════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════
const COOKIE_NAME = "__hdnea__";
const REFERER = "https://www.jiotv.co/";
const CDN_HOSTS = [
  "jiotvpllive.cdn.jio.com",
  "jiotvmblive.cdn.jio.com",
  "jiotv.media.jio.com",
  "jiocinema.com",
  "media.jio.com",
];

// ═══════════════════════════════════════════════════════════════
//  USER AGENT POOL
// ═══════════════════════════════════════════════════════════════
export const UA_POOL = {
  android: "plaYtv/7.1.5 (Linux; Android 13) ExoPlayerLib/2.11.6",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  ios_app: "Hotstar/25.02.24.8.11169 (iPhone; iOS 17.5.1; Scale/3.00)",
} as const;

export type UaKey = keyof typeof UA_POOL | "auto";

export function selectUserAgent(forced?: string | null): string {
  if (forced && forced !== "auto" && forced in UA_POOL) {
    return UA_POOL[forced as keyof typeof UA_POOL];
  }
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("ua");
    if (q && q in UA_POOL) {
      return UA_POOL[q as keyof typeof UA_POOL];
    }
    const ua = (navigator.userAgent || "").toLowerCase();
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return UA_POOL.ios;
    if (ua.includes("windows")) return UA_POOL.windows;
  }
  return UA_POOL.android;
}

const SHAKA_JS = "https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.ui.min.js";
const SHAKA_CSS = "https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/controls.min.css";

function isCdn(url: string) {
  return CDN_HOSTS.some((h) => url.includes(h));
}

function extractToken(ch: Channel): string | null {
  const cookie = ch.headers?.cookie ?? ch.headers?.Cookie ?? "";
  const m = cookie.match(/__hdnea__=([^;]+)/);
  if (m) return m[1];
  const um = (ch.mpd_url || "").match(/__hdnea__=([^&\s]+)/);
  if (um) return um[1];
  return null;
}

function parseClearKeysRaw(raw?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "string") return out;
  raw.split(",").forEach((pair) => {
    pair = pair.trim();
    const i = pair.indexOf(":");
    if (i <= 0) return;
    const kid = pair.slice(0, i).trim().toLowerCase().replace(/-/g, "");
    const key = pair.slice(i + 1).trim().toLowerCase().replace(/-/g, "");
    if (
      /^[0-9a-f]{32}$/.test(kid) &&
      /^[0-9a-f]{32}$/.test(key) &&
      kid !== "00000000000000000000000000000000"
    ) {
      out[kid] = key;
    }
  });
  return out;
}

// Load Shaka CSS once
let cssLoaded = false;
function ensureShakaCss() {
  if (cssLoaded) return;
  cssLoaded = true;
  if (!document.querySelector(`link[href="${SHAKA_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = SHAKA_CSS;
    document.head.appendChild(link);
  }
}

// Load Shaka JS once
let shakaPromise: Promise<any> | null = null;
function loadShaka(): Promise<any> {
  if ((window as any).shaka) return Promise.resolve((window as any).shaka);
  if (!shakaPromise) {
    shakaPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SHAKA_JS;
      s.async = true;
      s.onload = () =>
        (window as any).shaka ? resolve((window as any).shaka) : reject(new Error("Shaka not available"));
      s.onerror = () => reject(new Error("Failed to load Shaka"));
      document.head.appendChild(s);
    });
    shakaPromise.catch(() => {
      shakaPromise = null;
    });
  }
  return shakaPromise;
}

// XHR + fetch monkey-patching with dynamic User-Agent and Token
let networkPatched = false;
let activeToken: string | null = null;
let activeUserAgent: string = UA_POOL.android;

function patchNetworkLayer(token: string | null, userAgent: string) {
  activeToken = token;
  activeUserAgent = userAgent;

  if (networkPatched) return;
  networkPatched = true;

  function inject(url: string) {
    if (!isCdn(url) || !activeToken || url.includes(COOKIE_NAME + "=")) return url;
    return url + (url.includes("?") ? "&" : "?") + COOKIE_NAME + "=" + activeToken;
  }

  const origOpen = XMLHttpRequest.prototype.open;
  (XMLHttpRequest.prototype as any).open = function (method: string, url: any, ...rest: any[]) {
    if (typeof url === "string" && !url.includes("ping.gif")) {
      url = inject(url);
    }
    return (origOpen as any).apply(this, [method, url, ...rest]);
  };

  const origSet = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (h: string, v: string) {
    if (h.toLowerCase() === "referer") v = REFERER;
    if (h.toLowerCase() === "user-agent") v = activeUserAgent;
    return origSet.call(this, h, v);
  };

  const origFetch = window.fetch;
  (window as any).fetch = function (input: any, init?: any) {
    try {
      const url = typeof input === "string" ? input : input?.url || "";
      const patched = inject(url);
      if (patched !== url) {
        input = typeof input === "string" ? patched : new Request(patched, input);
      }
      if (init && init.headers) {
        const hdrs = init.headers;
        if (typeof Headers !== "undefined" && hdrs instanceof Headers) {
          if (!hdrs.has("User-Agent")) hdrs.set("User-Agent", activeUserAgent);
        } else if (Array.isArray(hdrs)) {
          if (!hdrs.some(([k]) => k.toLowerCase() === "user-agent")) {
            hdrs.push(["User-Agent", activeUserAgent]);
          }
        } else {
          if (!Object.keys(hdrs).some((k) => k.toLowerCase() === "user-agent")) {
            hdrs["User-Agent"] = activeUserAgent;
          }
        }
      }
    } catch {}
    return origFetch.call(window, input, init);
  };
}

// ═══════════════════════════════════════════════════════════════
//  REACT COMPONENT
//  Key architectural guarantee: wrapperRef is completely empty
//  from React's perspective. The inner player container is
//  created via DOM API inside useEffect to completely prevent
//  React "removeChild" hydration / reconciliation crashes.
// ═══════════════════════════════════════════════════════════════
export default function ShakaPlayer({ channel }: { channel: Channel }) {
  const [uaKey, setUaKey] = useState<UaKey>(() => {
    if (typeof window === "undefined") return "auto";
    const params = new URLSearchParams(window.location.search);
    const q = params.get("ua") as UaKey;
    if (q && (q === "auto" || q in UA_POOL)) return q;
    const saved = localStorage.getItem("plugx_ua") as UaKey;
    if (saved && (saved === "auto" || saved in UA_POOL)) return saved;
    return "auto";
  });
  const [stretchMode, setStretchMode] = useState<string>("stretch");
  const [qualityTracks, setQualityTracks] = useState<Array<{ height: number; bandwidth: number }>>([]);
  const [selectedQuality, setSelectedQuality] = useState<string>("auto");
  const [retryCount, setRetryCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const destroyedRef = useRef(false);

  const handleUaChange = (newKey: UaKey) => {
    setUaKey(newKey);
    if (typeof window !== "undefined") {
      localStorage.setItem("plugx_ua", newKey);
      const url = new URL(window.location.href);
      if (newKey === "auto") {
        url.searchParams.delete("ua");
      } else {
        url.searchParams.set("ua", newKey);
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleStretchChange = (mode: string) => {
    setStretchMode(mode);
    const v = videoElRef.current;
    if (v) {
      const fit = mode === "stretch" ? "fill" : mode;
      v.style.setProperty("object-fit", fit, "important");
    }
  };

  const handleQualityChange = (val: string) => {
    setSelectedQuality(val);
    const p = playerRef.current;
    if (!p) return;
    try {
      if (val === "auto") {
        p.configure({ abr: { enabled: true } });
      } else {
        const height = Number(val);
        p.configure({ abr: { enabled: false } });
        const tracks = p.getVariantTracks();
        const pick = tracks.find((t: any) => t.height === height);
        if (pick) {
          p.selectVariantTrack(pick, true);
        }
      }
    } catch {}
  };

  useEffect(() => {
    ensureShakaCss();
    destroyedRef.current = false;
    setErrorMessage(null);
    let player: any = null;

    const chosenUa = selectUserAgent(uaKey);
    const hdneaToken = extractToken(channel);
    const clearKeys = parseClearKeysRaw(channel.clearkey);

    patchNetworkLayer(hdneaToken, chosenUa);

    // Create a standalone container div that React does NOT manage
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%;position:relative;background:#000;";
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.appendChild(container);

    let url = channel.mpd_url.replace("bpk-tv//", "bpk-tv/");
    if (hdneaToken && !url.includes(COOKIE_NAME + "=")) {
      url += (url.includes("?") ? "&" : "?") + COOKIE_NAME + "=" + hdneaToken;
    }

    (async () => {
      try {
        const shaka = await loadShaka();
        if (destroyedRef.current) return;

        shaka.polyfill.installAll();
        if (!shaka.Player.isBrowserSupported()) {
          setErrorMessage("Browser not supported");
          emitPlayer("Browser not supported", { state: "Error", ua: uaKey });
          return;
        }

        const videoEl = document.createElement("video");
        videoEl.autoplay = true;
        videoEl.muted = true;
        videoEl.playsInline = true;
        const initialFit = stretchMode === "stretch" ? "fill" : stretchMode;
        videoEl.style.cssText = `width:100%;height:100%;object-fit:${initialFit};background:#000;`;
        container.appendChild(videoEl);
        videoElRef.current = videoEl;

        player = new shaka.Player();
        playerRef.current = player;
        await player.attach(videoEl);

        if (destroyedRef.current) {
          player.destroy();
          return;
        }

        // Shaka UI overlay
        try {
          new shaka.ui.Overlay(player, container, videoEl);
        } catch {}

        // ClearKey DRM
        const keyCount = Object.keys(clearKeys).length;
        if (keyCount > 0) {
          player.configure({ drm: { clearKeys } });
        }

        // Request filter — inject token + headers with active User-Agent
        player.getNetworkingEngine().registerRequestFilter((_type: number, request: any) => {
          const reqUrl = request.uris[0] || "";
          if (hdneaToken && isCdn(reqUrl) && !reqUrl.includes(COOKIE_NAME + "=")) {
            request.uris[0] = reqUrl + (reqUrl.includes("?") ? "&" : "?") + COOKIE_NAME + "=" + hdneaToken;
          }
          request.headers["Referer"] = REFERER;
          request.headers["User-Agent"] = chosenUa;
          request.allowCrossSiteCredentials = false;
        });

        // Streaming config
        player.configure({
          streaming: {
            bufferingGoal: 30,
            rebufferingGoal: 2,
            retryParameters: { maxAttempts: 5, baseDelay: 1000, backoffFactor: 2, timeout: 30000 },
            lowLatencyMode: false,
          },
          manifest: {
            retryParameters: { maxAttempts: 5, baseDelay: 1000, backoffFactor: 2, timeout: 30000 },
          },
        });

        // Error handling with DRM retry
        let drmRetried = false;
        player.addEventListener("error", (e: any) => {
          const d = e.detail;
          if (d.severity === shaka.util.Error.Severity.CRITICAL) {
            if ((d.code === 6001 || d.code === 6002) && !drmRetried) {
              drmRetried = true;
              player.configure({ drm: { clearKeys: {} } });
              player.retryStreaming();
              return;
            }
            if (d.code === 1001 || d.code === 1002) {
              player.retryStreaming();
              return;
            }
            setErrorMessage("Playback error: " + d.code);
            emitPlayer("Playback error: " + d.code, { state: "Error", ua: uaKey });
          }
        });

        player.addEventListener("buffering", (e: any) => {
          if (e.buffering) emitPlayer("Buffering…", { state: "Buffering" });
        });

        // Load stream
        emitPlayer("Connecting…", { state: "Connecting", ua: uaKey });
        await player.load(url);

        if (destroyedRef.current) return;

        emitPlayer("Playing", { state: "Playing", ua: uaKey });

        // Apply stretch
        const shakaContainer = container.querySelector(".shaka-video-container") as HTMLElement;
        if (shakaContainer) {
          shakaContainer.style.setProperty("width", "100%", "important");
          shakaContainer.style.setProperty("height", "100%", "important");
        }
        videoEl.style.setProperty("object-fit", initialFit, "important");
        videoEl.style.setProperty("width", "100%", "important");
        videoEl.style.setProperty("height", "100%", "important");

        // Autoplay: start muted, then unmute
        try {
          await videoEl.play();
          videoEl.muted = false;
        } catch {
          videoEl.muted = true;
          videoEl.play().catch(() => {});
        }

        // Quality info & tracks
        const updateQuality = () => {
          if (!player || destroyedRef.current) return;
          try {
            const tracks = player.getVariantTracks();
            const seen = new Set<number>();
            const opts: Array<{ height: number; bandwidth: number }> = [];
            tracks
              .filter((t: any) => t.height)
              .sort((a: any, b: any) => (b.height || 0) - (a.height || 0))
              .forEach((t: any) => {
                if (!seen.has(t.height)) {
                  seen.add(t.height);
                  opts.push({
                    height: t.height,
                    bandwidth: Math.round((t.bandwidth || 0) / 1000),
                  });
                }
              });
            setQualityTracks(opts);

            const active = tracks.find((t: any) => t.active);
            if (active?.height) {
              emitPlayer("Stream quality updated", { quality: `${active.height}p`, state: "Playing", ua: uaKey });
            }
          } catch {}
        };
        player.addEventListener("adaptation", updateQuality);
        player.addEventListener("trackschanged", updateQuality);
        updateQuality();

        document.title = (channel.name || "Live") + " — PlugX TV";
      } catch (e: any) {
        setErrorMessage(e?.message ?? "Failed to load channel");
        emitPlayer("Failed: " + (e?.message ?? "unknown error"), { state: "Error", ua: uaKey });
      }
    })();

    return () => {
      destroyedRef.current = true;
      if (player) {
        player.destroy().catch(() => {});
      }
      playerRef.current = null;
      videoElRef.current = null;
      if (wrapper && container.parentNode === wrapper) {
        wrapper.removeChild(container);
      }
    };
  }, [channel.id, channel.mpd_url, channel.clearkey, uaKey, retryCount]);

  const isDash = channel.mpd_url?.includes(".mpd");
  const uaLabel = uaKey === "auto" ? "auto" : uaKey;
  const infoText = `Shaka • ${isDash ? "DASH" : "HLS"} • UA: ${uaLabel}`;

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-border bg-black shadow-[0_32px_90px_rgba(0,0,0,.45)] sm:rounded-[26px]">
      {/* wrapperRef is completely empty — React never tracks any children inside */}
      <div ref={wrapperRef} className="aspect-video w-full bg-black relative" />

      {/* Error overlay (sibling to wrapperRef, NOT inside it) */}
      {errorMessage && (
        <div className="absolute inset-x-0 top-0 aspect-video z-20 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 text-center">
          <p className="text-sm font-medium text-destructive">{errorMessage}</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Controls toolbar matching reference player */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-card/90 px-3 py-2 text-xs backdrop-blur">
        {/* Quality select */}
        <select
          value={selectedQuality}
          onChange={(e) => handleQualityChange(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground outline-none transition hover:border-primary/50 cursor-pointer"
          title="Video Quality"
        >
          <option value="auto">Auto Quality</option>
          {qualityTracks.map((q) => (
            <option key={q.height} value={String(q.height)}>
              {q.height}p ({q.bandwidth} kbps)
            </option>
          ))}
        </select>

        {/* Stretch select */}
        <select
          value={stretchMode}
          onChange={(e) => handleStretchChange(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground outline-none transition hover:border-primary/50 cursor-pointer"
          title="Screen Mode"
        >
          <option value="contain">🖥 Fit</option>
          <option value="fill">📐 Fill</option>
          <option value="cover">🔲 Cover</option>
          <option value="stretch">↔ Stretch</option>
        </select>

        {/* User Agent select */}
        <select
          value={uaKey}
          onChange={(e) => handleUaChange(e.target.value as UaKey)}
          className="h-8 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground outline-none transition hover:border-primary/50 cursor-pointer"
          title="User Agent (device spoof)"
        >
          <option value="auto">🎭 Auto UA</option>
          <option value="android">🤖 Android (ExoPlayer)</option>
          <option value="windows">🪟 Windows (Chrome)</option>
          <option value="ios">🍎 iOS (Safari)</option>
          <option value="ios_app">🍎 iOS (Hotstar App)</option>
        </select>

        {/* Info text */}
        <div className="ml-auto text-[11px] font-medium text-muted-foreground truncate">
          {infoText}
        </div>
      </div>
    </div>
  );
}
