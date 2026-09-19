import { checkEntry, formatNaira } from "./ledger";
import type { Entry } from "./schema";

function entry(partial: Partial<Entry>): Entry {
  return {
    direction: "sale",
    item: "rice",
    quantity: 20,
    unit: "bag",
    unit_price_minor: null,
    total_minor: 4_500_000,
    currency: "NGN",
    confidence: 0.9,
    source_text: "I sell twenty bag of rice for forty-five thousand",
    ...partial,
  };
}

const cases: Array<[string, Entry, boolean]> = [
  ["clean sale is accepted", entry({}), true],
  [
    "model dropping a zero is caught",
    entry({ total_minor: 450_000 }),
    false,
  ],
  [
    "unit price that does not multiply out is caught",
    entry({ unit_price_minor: 200_000, total_minor: 4_500_000 }),
    false,
  ],
  [
    "unit price that does multiply out is accepted",
    entry({ unit_price_minor: 225_000, total_minor: 4_500_000 }),
    true,
  ],
  ["low confidence is asked back", entry({ confidence: 0.4 }), false],
];

let failed = 0;
for (const [name, e, expected] of cases) {
  const result = checkEntry(e);
  const ok = result.accepted === expected;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${result.question ? ` -> "${result.question}"` : ""}`);
}
console.log(`\n${formatNaira(4_500_000)} formats`);
console.log(failed === 0 ? "all passed" : `${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
