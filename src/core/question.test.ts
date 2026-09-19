import { classifyQuestion } from "./question";

const cases: Array<[string, string]> = [
  ["how much I make this week?", "books"],
  ["how much I sell today?", "books"],
  ["wetin be the price of rice for market now", "market"],
  ["price of bag of rice today", "market"],
  ["what is my total for this month", "books"],
  ["how much is a carton of indomie going for", "market"],
  ["my profit this week", "books"],
  ["how much be garri for market", "market"],
  ["how much I get left for rice", "books"],
];

let failed = 0;
for (const [q, expected] of cases) {
  const got = classifyQuestion(q);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${JSON.stringify(q)} -> ${got} (expected ${expected})`);
}
console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
