import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Live count of people watching this channel right now (realtime presence). */
export default function LiveViewers({ channelId }: { channelId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const me = crypto.randomUUID();
    const ch = supabase.channel(`watch:${channelId}`, { config: { presence: { key: me } } });
    ch.on("presence", { event: "sync" }, () => setCount(Object.keys(ch.presenceState()).length))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") ch.track({ at: Date.now() });
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [channelId]);

  return (
    <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-secondary-foreground">
      <Eye className="h-3.5 w-3.5" />
      {count === null ? "…" : count.toLocaleString()} watching
    </span>
  );
}
