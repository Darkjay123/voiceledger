import { parseSpokenNumbers } from "./amount";
import type { Entry } from "./schema";

export type Check = {
  entry: Entry;
  /** True when we are confident enough to write it without asking. */
  accepted: boolean;
  /** What to ask the trader when we are not. One question, never a form. */
  question: string | null;
};

const CONFIDENCE_FLOOR = 0.7;

/**
 * Check the model's arithmetic against the trader's own words before anything
 * is written down.
 *
 * The failure that matters is not a wrong word, it is a wrong number: a model
 * that hears "forty-five thousand" and writes 4,500 has quietly cost someone
 * their month. So we re-read the numbers ourselves and only accept a total the
 * trader's own words can account for, either directly or as a product of two
 * of them ("20 bags at 2,250").
 */
export function checkEntry(entry: Entry): Check {
  const spoken = parseSpokenNumbers(entry.source_text);

  if (spoken.length > 0 && !totalIsAccountedFor(entry.total_minor, spoken)) {
    return {
      entry,
      accepted: false,
      question: `I heard "${entry.source_text}". Is that ${formatNaira(entry.total_minor)}?`,
    };
  }

  // If both a unit price and a quantity were given, the product has to hold.
  if (entry.quantity !== null && entry.unit_price_minor !== null) {
    const implied = entry.quantity * entry.unit_price_minor;
    if (Math.abs(implied - entry.total_minor) > 1) {
      return {
        entry,
        accepted: false,
        question: `${entry.quantity} ${entry.unit ?? "units"} at ${formatNaira(entry.unit_price_minor)} comes to ${formatNaira(implied)}, not ${formatNaira(entry.total_minor)}. Which one is right?`,
      };
    }
  }

  if (entry.confidence < CONFIDENCE_FLOOR) {
    return {
      entry,
      accepted: false,
      question: `Just to be sure: ${entry.direction === "sale" ? "you sold" : "you bought"} ${entry.quantity ?? ""} ${entry.unit ?? ""} ${entry.item} for ${formatNaira(entry.total_minor)}?`.replace(/\s+/g, " "),
    };
  }

  return { entry, accepted: true, question: null };
}

/** Can the trader's own numbers produce this total, directly or as a product? */
function totalIsAccountedFor(totalMinor: number, spoken: number[]): boolean {
  const target = totalMinor / 100;
  if (spoken.some((n) => Math.abs(n - target) < 0.005)) return true;

  for (let i = 0; i < spoken.length; i++) {
    for (let j = i + 1; j < spoken.length; j++) {
      if (Math.abs(spoken[i] * spoken[j] - target) < 0.005) return true;
    }
  }
  return false;
}

export function formatNaira(minor: number): string {
  return `₦${(minor / 100).toLocaleString("en-NG")}`;
}
