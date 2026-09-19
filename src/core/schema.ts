import { z } from "zod";

/**
 * What one spoken or photographed line of a sales book becomes.
 *
 * Kept deliberately small. A trader's book has an item, a count, a price and
 * a direction, and everything else is decoration we would have to explain.
 */
export const EntrySchema = z.object({
  direction: z.enum(["sale", "purchase", "expense"]),
  item: z.string().min(1),
  quantity: z.number().positive().nullable(),
  unit: z.string().nullable(),
  unit_price_minor: z.number().int().nonnegative().nullable(),
  total_minor: z.number().int().nonnegative(),
  currency: z.string().default("NGN"),
  /** Model's own read of how sure it is, 0 to 1. Drives whether we ask back. */
  confidence: z.number().min(0).max(1),
  /** The exact words this came from, so a trader can always see the source. */
  source_text: z.string(),
});

export type Entry = z.infer<typeof EntrySchema>;

export const ExtractionSchema = z.object({
  entries: z.array(EntrySchema),
  /** Set when the message is a question about the books, not a new record. */
  question: z.string().nullable(),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
