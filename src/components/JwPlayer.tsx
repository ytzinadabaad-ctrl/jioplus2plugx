import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { parseClearKeys, streamUrl, type Channel } from "@/lib/channels";
import { emitPlayer } from "@/lib/player-events";

const JW_SCRIPT_URL = "https://content.jwplatform.com/libraries/IDzF9Zmk.js";
const JW_LICENSE_KEY = "Khpp2dHxlBJHC8MCmLnBuV2jK/DwDnJMniwF6EO9HC/riJ712ZmbHg==";

declare global {
  interface Window {
    jwplayer?: any;
  }
}

let jwLoader: Promise<any> | null = null;
function loadJw(): Promise<any> {
  if (window.jwplayer) return Promise.resolve(window.jwplayer);
  if (!jwLoader) {
    jwLoader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = JW_SCRIPT_URL;
      s.async = true;
      s.onload = () => (window.jwplayer ? resolve(window.jwplayer) : reject(new Error("JW Player unavailable")));
      s.onerror = () => reject(new Error("JW Player failed to load"));
      document.head.appendChild(s);
    });
    jwLoader.catch(() => {
      jwLoader = null;
    });
  }
  return jwLoader;
}

function tokenOf(ch: Channel): string | null {
  const cookie = ch.headers?.cookie ?? ch.headers?.Cookie ?? "";
  return cookie.match(/__hdnea__=([^;]+)/)?.[1] ?? null;
}

export default function JwPlayer({ channel }: { channel: Channel }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let player: any = null;
    let poll: number | null = null;
    let restoreXhr: (() => void) | null = null;
    setError(null);
    setLoading(true);
    emitPlayer(attempt ? `JW reconnecting (attempt ${attempt + 1})` : "JW Player connecting", {
      state: "Connecting",
      recoveries: attempt,
    });

    const url = streamUrl(channel);
    const token = tokenOf(channel);
    const keys = parseClearKeys(channel.clearkey);
    const keyId = Object.keys(keys)[0];
    const key = keyId ? keys[keyId] : undefined;
    const isHls = /\.m3u8(\?|$)/i.test(url);

    (async () => {
      try {
        const jwplayer = await loadJw();
        if (cancelled || !hostRef.current) return;
        jwplayer.key = JW_LICENSE_KEY;

        // JW has no request-filter API, so while it is mounted we add the access token
        // to Jio CDN requests through XHR — restored on teardown.
        if (token) {
          const origOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function (method: string, reqUrl: any, ...rest: any[]) {
            if (
              typeof reqUrl === "string" &&
              !reqUrl.includes("__hdnea__=") &&
              /jio\.com|akamaized\.net|cloudfront\.net/.test(reqUrl)
            ) {
              reqUrl += (reqUrl.includes("?") ? "&" : "?") + "__hdnea__=" + token;
            }
            return (origOpen as any).call(this, method, reqUrl, ...rest);
          };
          restoreXhr = () => {
            XMLHttpRequest.prototype.open = origOpen;
          };
        }

        const host = hostRef.current;
        host.innerHTML = "";
        const mount = document.createElement("div");
        mount.id = "plugx-jw-mount";
        host.appendChild(mount);

        player = jwplayer(mount.id);
        const playlist = [
          {
            file: url,
            type: isHls ? "hls" : "dash",
            ...(keyId && key ? { drm: { clearkey: { keyId, key } } } : {}),
          },
        ];
        player.setup({
          playlist,
          width: "100%",
          height: "100%",
          aspectratio: "16:9",
          autostart: true,
          stretching: "uniform",
          controls: true,
          title: channel.name,
          description: "Premium PlugX TV · LIVE",
        });

        // Freeze watchdog (from the reference player): if position stops advancing
        // or the player keeps buffering, silently reload and resume where we were.
        let lastPos = 0;
        let stallCount = 0;
        let restarting = false;
        const silentRestart = () => {
          if (restarting || cancelled || !player) return;
          restarting = true;
          emitPlayer("JW freeze detected — restarting stream", { state: "Connecting" });
          try {
            player.load(playlist);
            player.play();
            window.setTimeout(() => {
              try {
                if (lastPos > 1) player.seek(lastPos);
              } catch {}
              restarting = false;
            }, 400);
          } catch {
            restarting = false;
          }
        };
        player.on("buffer", () => {
          if (cancelled) return;
          setLoading(true);
          stallCount++;
          emitPlayer("JW buffering…", { state: "Buffering" });
          if (stallCount > 3) {
            stallCount = 0;
            silentRestart();
          }
        });
        player.on("play", () => {
          if (cancelled) return;
          stallCount = 0;
          setLoading(false);
          emitPlayer("Playing", { state: "Playing" });
        });
        player.on("error", (e: any) => {
          if (cancelled) return;
          emitPlayer(`JW error: ${e?.message ?? "playback failed"}`, { state: "Error" });
          window.setTimeout(() => {
            if (cancelled) return;
            silentRestart();
            // If the silent restart also fails, the error event fires again; after a few
            // rounds surface a manual retry instead of looping forever.
            stallCount++;
            if (stallCount > 4) {
              setError("Stream JW Player me load nahi ho paya. Retry karein ya Shaka engine try karein.");
              setLoading(false);
            }
          }, 2000);
        });
        poll = window.setInterval(() => {
          if (cancelled || !player) return;
          try {
            const pos = player.getPosition();
            if (player.getState() === "playing" && pos === lastPos) {
              stallCount++;
              if (stallCount > 3) {
                stallCount = 0;
                silentRestart();
              }
            } else {
              lastPos = pos;
              stallCount = 0;
            }
          } catch {}
        }, 3000);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "JW Player start nahi ho paya.");
        setLoading(false);
        emitPlayer("JW Player failed to start", { state: "Error" });
      }
    })();

    return () => {
      cancelled = true;
      if (poll !== null) window.clearInterval(poll);
      restoreXhr?.();
      try {
        player?.remove();
      } catch {}
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [channel, attempt]);

  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-background shadow-[0_32px_90px_rgba(0,0,0,.45)] sm:rounded-[26px]">
      <div className="relative aspect-video w-full select-none overflow-hidden bg-background">
        <div ref={hostRef} className="absolute inset-0 [&_.jwplayer]:!h-full [&_.jwplayer]:!w-full" />
        {loading && !error && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-background/60">
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              JW Player loading…
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/80 p-6 text-center">
            <div className="max-w-sm">
              <p className="text-sm font-semibold text-destructive">{error}</p>
              <button
                onClick={() => setAttempt((a) => a + 1)}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold transition hover:border-primary/50 hover:text-primary"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
