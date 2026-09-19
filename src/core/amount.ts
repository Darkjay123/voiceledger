/**
 * Spoken-number parsing for West African market speech.
 *
 * Traders say amounts the way they say them out loud: "forty-five thousand",
 * "45k", "N45,000", "two hundred and fifty naira". A model can usually read
 * these, but parsing them deterministically first means we can check the
 * model's arithmetic instead of trusting it.
 */

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1_000,
  k: 1_000,
  million: 1_000_000,
  m: 1_000_000,
  billion: 1_000_000_000,
};

/** Strip currency marks, punctuation and filler so the words can be walked. */
function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[₦]/g, " naira ")
    .replace(/\bn(?=\d)/g, " naira ")
    .replace(/[-–—]/g, " ")
    .replace(/,(?=\d{3}\b)/g, "")
    .replace(/[^a-z0-9. ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Parse every number expressed in a message, mixing digits and words freely.
 * "I sell twenty bag of rice for forty-five thousand" gives [20, 45000].
 *
 * We need all of them, not the first: checking the model's total against only
 * the leading number lets a dropped zero through whenever the total happens to
 * match the quantity instead.
 */
export function parseSpokenNumbers(input: string): number[] {
  const tokens = tokenize(input);
  const found: number[] = [];

  let total = 0;
  let current = 0;
  let seen = false;

  const flush = () => {
    if (seen) found.push(total + current);
    total = 0;
    current = 0;
    seen = false;
  };

  for (const raw of tokens) {
    // "45k" / "2m" arrive glued together.
    const glued = raw.match(/^(\d+(?:\.\d+)?)(k|m)$/);
    const token = glued ? glued[1] : raw;
    const gluedScale = glued ? SCALES[glued[2]] : null;

    if (/^\d+(\.\d+)?$/.test(token)) {
      current += parseFloat(token);
      seen = true;
      if (gluedScale) {
        current *= gluedScale;
        total += current;
        current = 0;
      }
      continue;
    }

    if (token in UNITS) {
      current += UNITS[token];
      seen = true;
      continue;
    }

    if (token in SCALES) {
      if (!seen) continue; // a bare "thousand" with nothing in front of it
      const scale = SCALES[token];
      if (scale === 100) {
        current = (current || 1) * scale;
      } else {
        total += (current || 1) * scale;
        current = 0;
      }
      continue;
    }

    if (token === "and" || token === "naira") continue;

    // Any other word closes the current number and starts looking for the next.
    flush();
  }

  flush();
  return found;
}

/** The first number in the message, or null when it holds none. */
export function parseSpokenNumber(input: string): number | null {
  const all = parseSpokenNumbers(input);
  return all.length ? all[0] : null;
}
