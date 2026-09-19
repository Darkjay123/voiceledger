import { parseSpokenNumber } from "./amount";

const cases: Array<[string, number | null]> = [
  ["45k", 45000],
  ["45,000", 45000],
  ["N45,000", 45000],
  ["₦45k", 45000],
  ["forty five thousand", 45000],
  ["forty-five thousand", 45000],
  ["fourty five thousand", 45000],
  ["45 thousand", 45000],
  ["two hundred and fifty naira", 250],
  ["two hundred fifty", 250],
  ["one million two hundred thousand", 1200000],
  ["1.5m", 1500000],
  ["twenty", 20],
  ["I sell twenty bag of rice", 20],
  ["nothing here", null],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = parseSpokenNumber(input);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${JSON.stringify(input)} -> ${got} (expected ${expected})`);
}
console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
