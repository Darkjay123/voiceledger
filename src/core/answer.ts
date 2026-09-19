import { classifyQuestion } from "./question";
import { lookupMarketPrice } from "./prices";
import { summarize } from "./db";
import { formatNaira } from "./ledger";

/**
 * Answer a question the trader asked instead of recording something.
 *
 * Two kinds only: her own books, or what the market is doing. Anything we
 * cannot answer from one of those two, we say so plainly rather than
 * improvising, because a made-up number here lands in the same place as a
 * real one.
 */
export async function answerQuestion(
  traderId: string,
  question: string,
): Promise<string> {
  if (classifyQuestion(question) === "market") {
    const { answer, sources } = await lookupMarketPrice(question);
    if (!answer) {
      return "I couldn't find a current price for that. Ask me again later, or tell me what you saw in the market and I'll note it.";
    }
    const cite = sources[0] ? `\n(${sources[0].title})` : "";
    return `${answer}${cite}`;
  }

  const since = windowFor(question);
  const summary = await summarize(traderId, since.from);

  if (summary.entryCount === 0) {
    return `Nothing recorded ${since.label} yet.`;
  }

  const profit = summary.salesMinor - summary.purchasesMinor - summary.expensesMinor;
  const lines = [
    `${since.label}: sold ${formatNaira(summary.salesMinor)}`,
  ];

  if (summary.purchasesMinor > 0) lines.push(`stock bought ${formatNaira(summary.purchasesMinor)}`);
  if (summary.expensesMinor > 0) lines.push(`expenses ${formatNaira(summary.expensesMinor)}`);

  lines.push(`left over ${formatNaira(profit)}`);
  if (summary.topItem) lines.push(`best seller: ${summary.topItem}`);

  return lines.join("\n");
}

/** Read the time window out of the question itself; default to this week. */
function windowFor(question: string): { from: Date; label: string } {
  const q = question.toLowerCase();
  const now = new Date();

  if (q.includes("today")) {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from, label: "Today" };
  }

  if (q.includes("month")) {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), label: "This month" };
  }

  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  return { from, label: "Last 7 days" };
}
