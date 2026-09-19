import { createClient } from "@supabase/supabase-js";
import type { Entry } from "./schema";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

/** Find the trader behind a WhatsApp number, creating the row on first contact. */
export async function resolveTrader(whatsappId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("traders")
    .select("id")
    .eq("whatsapp_id", whatsappId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("traders")
    .insert({ whatsapp_id: whatsappId })
    .select("id")
    .single();

  if (error) throw new Error(`could not create trader: ${error.message}`);
  return data.id;
}

export async function saveEntries(
  traderId: string,
  entries: Entry[],
  sourceKind: "text" | "voice" | "photo",
): Promise<void> {
  if (entries.length === 0) return;

  const { error } = await supabase.from("entries").insert(
    entries.map((e) => ({
      trader_id: traderId,
      direction: e.direction,
      item: e.item,
      quantity: e.quantity,
      unit: e.unit,
      unit_price_minor: e.unit_price_minor,
      total_minor: e.total_minor,
      currency: e.currency,
      confidence: e.confidence,
      source_text: e.source_text,
      source_kind: sourceKind,
    })),
  );

  if (error) throw new Error(`could not save entries: ${error.message}`);
}

export type Summary = {
  since: Date;
  salesMinor: number;
  purchasesMinor: number;
  expensesMinor: number;
  entryCount: number;
  topItem: string | null;
};

/** Everything the trader has recorded since a given moment, added up. */
export async function summarize(traderId: string, since: Date): Promise<Summary> {
  const { data, error } = await supabase
    .from("entries")
    .select("direction, item, total_minor")
    .eq("trader_id", traderId)
    .gte("occurred_at", since.toISOString());

  if (error) throw new Error(`could not read entries: ${error.message}`);

  const rows = data ?? [];
  const byItem = new Map<string, number>();
  let salesMinor = 0;
  let purchasesMinor = 0;
  let expensesMinor = 0;

  for (const row of rows) {
    if (row.direction === "sale") {
      salesMinor += row.total_minor;
      byItem.set(row.item, (byItem.get(row.item) ?? 0) + row.total_minor);
    } else if (row.direction === "purchase") {
      purchasesMinor += row.total_minor;
    } else {
      expensesMinor += row.total_minor;
    }
  }

  const topItem =
    [...byItem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    since,
    salesMinor,
    purchasesMinor,
    expensesMinor,
    entryCount: rows.length,
    topItem,
  };
}
