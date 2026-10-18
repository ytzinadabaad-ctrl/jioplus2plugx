import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { buildGuideContext } from "@/lib/guide-context";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { chatLanguages, discardLegacyChat } from "@/lib/chat-preferences";
import { MessageCircle, Send, X, Tv, RotateCcw } from "lucide-react";
import { channelsQuery } from "@/lib/channels";

type Msg = { role: "user" | "assistant"; parts: { type: "text"; text: string }[] };
const message = (role: Msg["role"], text: string): Msg => ({
  role,
  parts: [{ type: "text", text }],
});

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [language, setLanguage] = useState("auto");
  const { data } = useQuery(channelsQuery);
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    try {
      discardLegacyChat(localStorage);
    } catch {
      // Storage may be unavailable; the transcript still stays in memory only.
    }
  }, []);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, busy]);

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, message("user", content)];
    setMsgs([...next, message("assistant", "")]);
    setText("");
    setBusy(true);
    inputRef.current?.focus();
    try {
      const watchingId = path.match(/^\/watch\/([^/]+)/)?.[1] ?? null;
      const guide = await buildGuideContext(
        qc, data ?? [], content, watchingId,
        msgs.filter((m) => m.role === "user").map((m) => m.parts.map((p) => p.text).join("")),
      ).catch(() => "");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({
            role: m.role,
            content: m.parts.map((p) => p.text).join(""),
          })),
          language,
          channels: (data ?? []).map((c) => c.name),
          guide,
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...next, message("assistant", acc)]);
      }
    } catch (e) {
      setMsgs([
        ...next,
        message("assistant", e instanceof Error ? e.message : "Something went wrong. Try again."),
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Chat with Plugo"}
        size="icon"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_var(--primary)] transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Chat with Plugo"
          className="fixed bottom-24 right-4 z-50 flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Tv className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-display text-sm font-bold">Plugo</p>
              <p className="text-[11px] text-muted-foreground">Your Premium PlugX TV buddy</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              title="New conversation"
              aria-label="New conversation"
              onClick={() => setMsgs([])}
              disabled={busy}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <div className="border-b border-border px-4 py-2">
            <Select value={language} onValueChange={setLanguage} disabled={busy}>
              <SelectTrigger aria-label="Reply language" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chatLanguages.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Conversation className="chat-transcript min-h-0 flex-1">
            <ConversationContent className="gap-3 p-4 text-sm">
              {msgs.length === 0 && (
                <div className="space-y-2 text-muted-foreground">
                  <p>Hey! 👋 I'm Plugo. Aaj kya dekhein?</p>
                  {[
                    "What should I watch tonight?",
                    "Tell me a cricket joke",
                    "Give me a Bollywood quiz",
                  ].map((s) => (
                    <Button
                      variant="outline"
                      size="sm"
                      key={s}
                      onClick={() => {
                        setText(s);
                        inputRef.current?.focus();
                      }}
                      className="block h-auto whitespace-normal text-left text-xs"
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              )}
              {msgs.map((m, i) => (
                <Message key={i} from={m.role}>
                  <MessageContent
                    className={
                      m.role === "user"
                        ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
                        : ""
                    }
                  >
                    {m.parts.map((part, j) =>
                      m.role === "user" ? (
                        <span key={j} className="whitespace-pre-wrap break-words">
                          {part.text}
                        </span>
                      ) : part.text ? (
                        <MessageResponse key={j}>{part.text}</MessageResponse>
                      ) : (
                        <Shimmer key={j}>Plugo is typing…</Shimmer>
                      ),
                    )}
                  </MessageContent>
                </Message>
              ))}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          <div className="border-t border-border p-3">
            <PromptInput
              onSubmit={() => {
                void send();
              }}
            >
              <PromptInputTextarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Message Plugo…"
                aria-label="Message Plugo"
                className="min-h-12 max-h-28 text-sm"
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit
                  status={busy ? "submitted" : "ready"}
                  disabled={busy || !text.trim()}
                  aria-label="Send"
                  className="h-8 w-8 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </PromptInputSubmit>
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      )}
    </>
  );
}
