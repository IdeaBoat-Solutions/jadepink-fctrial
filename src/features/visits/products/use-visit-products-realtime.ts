"use client";

/* JadePink F.C. Trial — Stage 3 realtime (§32–33).
   Subscribes this client to changes for ONE visit (salesperson on the floor).

   Coalesces bursts (a drop writes a visit_product update + a visit_event) into
   a single refresh. RLS scopes the stream: the client only ever receives rows
   it could already read through the API. No-ops when Supabase is unconfigured
   (demo mode), so the board still works on manual refresh. */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function useVisitProductsRealtime(
  visitId: string | null | undefined,
  onChange: () => void,
): boolean {
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!visitId || !isSupabaseConfigured()) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onChange, 200);
    };

    const channel = supabase
      .channel(`visit-products:${visitId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_products", filter: `visit_id=eq.${visitId}` },
        fire,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "visit_events", filter: `visit_id=eq.${visitId}` },
        fire,
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [visitId, onChange]);

  return live;
}
