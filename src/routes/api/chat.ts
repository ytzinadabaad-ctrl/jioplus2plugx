import { createFileRoute } from "@tanstack/react-router";
import { streamResponse, GatewayError } from "@lovable.dev/ai-gateway";

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM = `You are "Plugo", the friendly, fun AI host of Premium PlugX TV — a free live TV website for India with channels sorted by category (news, sports, movies, kids, music, regional and more).
Help visitors: suggest channels to watch, explain how to use the site (pick a category, search, tap a channel to play; if a stream stalls, refresh or try another channel), and keep them entertained with jokes, trivia, quizzes, movie/cricket chat and light banter.
Keep replies short, warm and lively; use emojis sparingly. Reply in the user's language (Hindi/Hinglish welcome). Never invent channels that aren't in the list. Join the Telegram group for updates: https://t.me/+27i16q_PeVRmNzFl`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          messages?: Msg[];
          channels?: string[];
        } | null;
        const messages = (body?.messages ?? [])
          .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-30)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
        if (!messages.length) return new Response("No messages", { status: 400 });
        const channels = (body?.channels ?? []).slice(0, 300).map((c) => String(c).slice(0, 60));

        try {
          const stream = await streamResponse({
            model: "openai/gpt-6-astra",
            instructions: `${SYSTEM}\n\nChannels on the site right now: ${channels.join(", ") || "unknown"}`,
            input: messages,
          });
          const enc = new TextEncoder();
          const out = new ReadableStream<Uint8Array>({
            async start(controller) {
              try {
                for await (const ev of stream) {
                  const e = ev as { type?: string; delta?: string };
                  if (e.type === "response.output_text.delta" && e.delta) controller.enqueue(enc.encode(e.delta));
                }
              } catch (err) {
                console.error(err);
                controller.enqueue(enc.encode("\n\n_Sorry, I lost my signal. Please try again._"));
              }
              controller.close();
            },
          });
          return new Response(out, { headers: { "content-type": "text/plain; charset=utf-8" } });
        } catch (err) {
          console.error(err);
          const status = err instanceof GatewayError && err.httpStatus ? err.httpStatus : 500;
          const msg = status === 429 ? "Too many messages right now, try again in a moment." : status === 402 ? "The AI is out of credits right now." : "The AI couldn't reply. Please try again.";
          return new Response(msg, { status });
        }
      },
    },
  },
});
