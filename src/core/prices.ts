/**
 * Live market prices, grounded in sources we can name.
 *
 * A trader asking what rice is going for is asking about today, and a model's
 * memory of rice prices is worth nothing here: Nigerian food prices move week
 * to week, and a confidently stale number is worse than no answer. So every
 * price we give back comes from a search made at the moment she asked, and it
 * arrives with where it came from.
 */

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

export type PriceAnswer = {
  /** A short written answer, or null when nothing usable came back. */
  answer: string | null;
  sources: Array<{ title: string; url: string }>;
};

export async function lookupMarketPrice(
  question: string,
  region = "Nigeria",
): Promise<PriceAnswer> {
  // Pin the query to the market, the currency and the month, so the search
  // engine is not free to hand back a 2019 blog post.
  const month = new Date().toLocaleString("en-NG", { month: "long", year: "numeric" });
  const query = `${question} current market price in ${region} in naira, ${month}`;

  const res = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      include_answer: true,
      max_results: 4,
      topic: "general",
      days: 30,
    }),
  });

  if (!res.ok) {
    console.error("tavily failed", res.status, await res.text());
    return { answer: null, sources: [] };
  }

  const data = (await res.json()) as {
    answer?: string;
    results?: Array<{ title: string; url: string }>;
  };

  return {
    answer: data.answer?.trim() || null,
    sources: (data.results ?? []).slice(0, 2).map((r) => ({ title: r.title, url: r.url })),
  };
}
