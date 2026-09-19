export type QuestionKind = "books" | "market";

/** Phrases that point at what something costs out there in the market. */
const MARKET_HINTS = [
  "market price", "current price", "going for", "how much be", "how much is",
  "price of", "price for", "selling for", "wetin be the price", "cost of",
];

/** Phrases that point at the trader's own records. */
const BOOKS_HINTS = [
  "i make", "i made", "my sales", "my profit", "my book", "i sell",
  "this week", "this month", "today", "yesterday", "balance", "total",
];

const FIRST_PERSON = /\b(i|my|me|we|our)\b/;

/**
 * Books or market?
 *
 * The deciding signal is ownership, not keywords. "How much I make today" and
 * "price of rice today" share the word today and mean nothing alike; the first
 * one is about her, the second is about the market. So a price question with
 * no I or my in it is asking about the world outside her book.
 */
export function classifyQuestion(question: string): QuestionKind {
  const q = question.toLowerCase();
  const market = MARKET_HINTS.filter((h) => q.includes(h)).length;
  const books = BOOKS_HINTS.filter((h) => q.includes(h)).length;

  if (market > 0 && !FIRST_PERSON.test(q)) return "market";
  if (market > books) return "market";
  return "books";
}
