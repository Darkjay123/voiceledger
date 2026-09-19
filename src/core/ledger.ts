import { parseSpokenNumber } from "./amount";
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
 * The failure that matters here is not a wrong word, it is a wrong number: a
 * model that hears "forty-five thousand" and writes 4,500 has quietly cost
 * someone their month. So we re-parse the numbers ourselves and only accept an
 * entry when the two readings agree.
 */
export function checkEntry(entry: Entry): Check {
  const spoken = parseSpokenNumber(entry.source_text);

  if (spoken !== null) {
    const spokenMinor = Math.round(spoken * 100);
    const matchesTotal = spokenMinor === entry.total_minor;
    const matchesQuantity = entry.quantity !== null && spoken === entry.quantity;

    if (!matchesTotal && !matchesQuantity) {
      return {
        entry,
        accepted: false,
        question: `I heard "${entry.source_text}". Is that ${formatNaira(entry.total_minor)}?`,
      };
    }
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

export function formatNaira(minor: number): string {
  return `₦${(minor / 100).toLocaleString("en-NG")}`;
}
