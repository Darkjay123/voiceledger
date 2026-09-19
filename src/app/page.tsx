import { listTraders, recentEntries, summarize } from "@/core/db";
import { formatNaira } from "@/core/ledger";

export const dynamic = "force-dynamic";

const KIND_MARK: Record<string, string> = { voice: "\u266a", photo: "\u25a3", text: "\u2261" };

/**
 * The trader's week on one screen.
 *
 * Built for a phone on a market stall, so the number she actually cares about
 * (what is left) is the biggest thing on the page, every row shows the words
 * she said next to the figure we wrote down, and anything the arithmetic check
 * flagged stays visibly unsettled instead of quietly counting.
 */
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ trader?: string }>;
}) {
  const { trader: requested } = await searchParams;

  const traders = await listTraders();
  const trader = traders.find((t) => t.id === requested) ?? traders[0];

  if (!trader) {
    return (
      <main className="wrap">
        <div className="masthead">
          <h1>VoiceLedger</h1>
        </div>
        <p className="empty">
          No trader has messaged yet. Send a voice note to the WhatsApp number and this fills in.
        </p>
      </main>
    );
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [summary, entries] = await Promise.all([
    summarize(trader.id, weekAgo),
    recentEntries(trader.id, 12),
  ]);

  const leftOver = summary.salesMinor - summary.purchasesMinor - summary.expensesMinor;

  return (
    <main className="wrap">
      <div className="masthead">
        <h1>VoiceLedger</h1>
        <span className="who">{trader.display_name ?? trader.whatsapp_id}</span>
      </div>
      <p className="period">Last 7 days</p>

      <div className="headline">
        <div className="label">Left over</div>
        <div className={leftOver < 0 ? "value negative" : "value"}>{formatNaira(leftOver)}</div>
      </div>

      <div className="cards">
        <div className="card">
          <div className="label">Sold</div>
          <div className="value">{formatNaira(summary.salesMinor)}</div>
        </div>
        <div className="card">
          <div className="label">Stock bought</div>
          <div className="value">{formatNaira(summary.purchasesMinor)}</div>
        </div>
        <div className="card">
          <div className="label">Expenses</div>
          <div className="value">{formatNaira(summary.expensesMinor)}</div>
        </div>
      </div>

      {summary.topItem ? <p className="period">Best seller: {summary.topItem}</p> : null}

      <h2>Recent entries</h2>
      {entries.length === 0 ? (
        <p className="empty">Nothing recorded in the last few days.</p>
      ) : (
        <div className="rows">
          {entries.map((entry) => {
            const unsure = entry.confidence < 0.7;
            const verb =
              entry.direction === "sale" ? "Sold" : entry.direction === "purchase" ? "Bought" : "Spent";
            const qty = entry.quantity ? `${entry.quantity} ${entry.unit ?? ""} ` : "";

            return (
              <div className={unsure ? "row flagged" : "row"} key={entry.id}>
                <span className="kind" aria-hidden>
                  {KIND_MARK[entry.source_kind] ?? "\u2261"}
                </span>
                <div className="body">
                  <div className="what">{`${verb} ${qty}${entry.item}`.replace(/\s+/g, " ")}</div>
                  <div className="said">&ldquo;{entry.source_text}&rdquo;</div>
                  {unsure ? <div className="ask">Waiting on her to confirm this one</div> : null}
                </div>
                <div className={entry.direction === "sale" ? "amount" : "amount out"}>
                  {formatNaira(entry.total_minor)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
