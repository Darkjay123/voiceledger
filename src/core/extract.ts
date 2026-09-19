import OpenAI from "openai";
import { ExtractionSchema, type Extraction } from "./schema";

/**
 * Token Factory speaks the OpenAI wire format, so the client is the standard
 * one pointed at a different base URL.
 */
const client = new OpenAI({
  apiKey: process.env.NEBIUS_API_KEY,
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1",
});

const SYSTEM_PROMPT = `You read messages from small traders in Nigeria and turn them into bookkeeping entries.

The trader speaks naturally, usually in Nigerian Pidgin, sometimes mixing in Yoruba, Hausa or Igbo, sometimes plain English. They are not filling in a form. Examples of what arrives:

  "I sell twenty bag of rice for forty-five thousand"
  "buy carton of indomie 9,500 from market today"
  "how much I make this week?"

Rules:
- Amounts are in naira. Return money in kobo (minor units): 45000 naira is 4500000.
- quantity is how many units moved. unit is the word the trader used ("bag", "carton", "paint").
- unit_price_minor only when the trader actually said a per-unit price. Otherwise null.
- total_minor is the money that changed hands in total.
- direction is "sale" when goods left, "purchase" when stock came in, "expense" for costs like transport or rent.
- When the message is a question about their records rather than a new entry, return entries: [] and put the question in the question field.
- confidence is your own honest read. Below 0.7 we will ask the trader to confirm, so do not inflate it.
- source_text is the trader's exact words for that entry.

Return JSON only, matching the schema.`;

export async function extractEntries(text: string): Promise<Extraction> {
  const completion = await client.chat.completions.create({
    model: process.env.NEBIUS_TEXT_MODEL ?? "nvidia/NVIDIA-Nemotron-3-Nano-30B",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return ExtractionSchema.parse(JSON.parse(raw));
}
