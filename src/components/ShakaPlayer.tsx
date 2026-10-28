import { useEffect, useRef } from "react";
import { type Channel } from "@/lib/channels";
import { emitPlayer } from "@/lib/player-events";

// ═══════════════════════════════════════════════════════════════
//  CONFIG — same as your working standalone player
// ═══════════════════════════════════════════════════════════════
const COOKIE_NAME = "__hdnea__";
const REFERER = "https://www.jiotv.co/";
const USER_AGENT = "plaYtv/7.1.5 (Linux; Android 13) ExoPlayerLib/2.11.6";
const CDN_HOSTS = [
  "jiotvpllive.cdn.jio.com",
  "jiotvmblive.cdn.jio.com",
  "jiotv.media.jio.com",
  "jiocinema.com",
  "media.jio.com",
];

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

// XHR + fetch monkey-patching
let xhrPatched = false;
function patchNetworkLayer(token: string | null) {
  if (xhrPatched || !token) return;
  xhrPatched = true;

  function inject(url: string) {
    if (!isCdn(url) || url.includes(COOKIE_NAME + "=")) return url;
    return url + (url.includes("?") ? "&" : "?") + COOKIE_NAME + "=" + token;
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
    if (h.toLowerCase() === "user-agent") v = USER_AGENT;
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
    } catch {}
    return origFetch.call(window, input, init);
  };
}

// ═══════════════════════════════════════════════════════════════
//  REACT COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ShakaPlayer({ channel }: { channel: Channel }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const destroyedRef = useRef(false);

  useEffect(() => {
    ensureShakaCss();
    destroyedRef.current = false;
    let player: any = null;

    const hdneaToken = extractToken(channel);
    const clearKeys = parseClearKeysRaw(channel.clearkey);

    let url = channel.mpd_url.replace("bpk-tv//", "bpk-tv/");
    if (hdneaToken && !url.includes(COOKIE_NAME + "=")) {
      url += (url.includes("?") ? "&" : "?") + COOKIE_NAME + "=" + hdneaToken;
    }

    patchNetworkLayer(hdneaToken);

    (async () => {
      try {
        const shaka = await loadShaka();
        if (destroyedRef.current || !containerRef.current) return;

        shaka.polyfill.installAll();
        if (!shaka.Player.isBrowserSupported()) {
          emitPlayer("Browser not supported", { state: "Error" });
          return;
        }

        // Build DOM
        const container = containerRef.current;
        container.innerHTML = "";

        const videoEl = document.createElement("video");
        videoEl.autoplay = true;
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.style.cssText = "width:100%;height:100%;object-fit:fill;background:#000;";
        container.appendChild(videoEl);

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

        // Request filter — inject token + headers
        player.getNetworkingEngine().registerRequestFilter((_type: number, request: any) => {
          const reqUrl = request.uris[0] || "";
          if (hdneaToken && isCdn(reqUrl) && !reqUrl.includes(COOKIE_NAME + "=")) {
            request.uris[0] = reqUrl + (reqUrl.includes("?") ? "&" : "?") + COOKIE_NAME + "=" + hdneaToken;
          }
          request.headers["Referer"] = REFERER;
          request.headers["User-Agent"] = USER_AGENT;
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
            emitPlayer("Playback error: " + d.code, { state: "Error" });
          }
        });

        player.addEventListener("buffering", (e: any) => {
          if (e.buffering) emitPlayer("Buffering…", { state: "Buffering" });
        });

        // Load stream
        emitPlayer("Connecting…", { state: "Connecting" });
        await player.load(url);

        if (destroyedRef.current) return;

        emitPlayer("Playing", { state: "Playing" });

        // Apply stretch
        const shakaContainer = container.querySelector(".shaka-video-container") as HTMLElement;
        if (shakaContainer) {
          shakaContainer.style.setProperty("width", "100%", "important");
          shakaContainer.style.setProperty("height", "100%", "important");
        }
        videoEl.style.setProperty("object-fit", "fill", "important");
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

        // Quality info
        const updateQuality = () => {
          if (!player || destroyedRef.current) return;
          try {
            const active = player.getVariantTracks().find((t: any) => t.active);
            if (active?.height) {
              emitPlayer("Stream quality updated", { quality: `${active.height}p`, state: "Playing" });
            }
          } catch {}
        };
        player.addEventListener("adaptation", updateQuality);
        updateQuality();

        document.title = (channel.name || "Live") + " — PlugX TV";
      } catch (e: any) {
        emitPlayer("Failed: " + (e?.message ?? "unknown error"), { state: "Error" });
      }
    })();

    return () => {
      destroyedRef.current = true;
      if (player) {
        player.destroy().catch(() => {});
      }
      playerRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [channel.id, channel.mpd_url, channel.clearkey]);

  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-black shadow-[0_32px_90px_rgba(0,0,0,.45)] sm:rounded-[26px]">
      <div
        ref={containerRef}
        className="aspect-video w-full bg-black"
        style={{ position: "relative" }}
      />
    </div>
  );
}
