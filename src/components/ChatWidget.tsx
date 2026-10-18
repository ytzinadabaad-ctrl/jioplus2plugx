import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { MessageCircle, Send, X, Tv, RotateCcw } from "lucide-react";
import { channelsQuery } from "@/lib/channels";

type Msg = { role: "user" | "assistant"; content: string };
const KEY = "plugx_chat_v1";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { data } = useQuery(channelsQuery);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setMsgs(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    if (!busy) try { localStorage.setItem(KEY, JSON.stringify(msgs)); } catch {}
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);
  useEffect(() => { if (open && !busy) inputRef.current?.focus(); }, [open, busy]);

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, channels: (data ?? []).map((c) => c.name) }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: (e as Error).message || "Something went wrong. Try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Chat with Plugo"}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_var(--primary)] transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><Tv className="h-5 w-5" /></div>
            <div className="flex-1">
              <p className="font-display text-sm font-bold">Plugo</p>
              <p className="text-[11px] text-muted-foreground">Your Premium PlugX TV buddy</p>
            </div>
            <button aria-label="New conversation" onClick={() => setMsgs([])} disabled={busy} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {msgs.length === 0 && (
              <div className="space-y-2 text-muted-foreground">
                <p>Hey! 👋 I'm Plugo. Ask me what to watch, how the site works, or just ask for a joke or a quiz.</p>
                {["What should I watch tonight?", "Tell me a cricket joke", "Give me a Bollywood quiz"].map((s) => (
                  <button key={s} onClick={() => setText(s)} className="block rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary">{s}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">{m.content}</div>
              ) : (
                <div key={i} className="prose prose-sm prose-invert max-w-[95%] text-foreground [&_p]:my-1">
                  {m.content ? <ReactMarkdown>{m.content}</ReactMarkdown> : <span className="animate-pulse text-muted-foreground">Plugo is typing…</span>}
                </div>
              ),
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2 border-t border-border p-3">
            <textarea
              ref={inputRef}
              value={text}
              rows={1}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message Plugo…"
              className="max-h-28 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
