import OpenAI from "openai";
import { ExtractionSchema, type Extraction } from "./schema";
import type { DownloadedMedia } from "./media";

const client = new OpenAI({
  apiKey: process.env.NEBIUS_API_KEY,
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1",
});

/**
 * Reading a photographed sales book.
 *
 * These are not receipts. They are ruled exercise books filled in by hand,
 * often in biro that has run, with the date written once at the top of a page
 * and every line below it understood to belong to that day. Columns drift.
 * Totals get written in the margin.
 *
 * So the model is told to read what is there and say when it cannot, rather
 * than tidying a smudged row into a plausible number. An unreadable line is a
 * question we ask the trader; an invented one is a lie in her books.
 */
const VISION_PROMPT = `This is a photo of a Nigerian trader's handwritten sales book.

Read every line you can and turn it into bookkeeping entries.

- Money is naira. Return money in kobo (minor units): 45000 naira is 4500000.
- Lines usually read as: item, quantity, price, sometimes a running total.
- A date written at the top of the page applies to the lines under it.
- If a line is smudged, cut off, or you are guessing at a digit, set confidence below 0.7 and put what you actually see in source_text. Never clean up a number you cannot read.
- source_text is the line as written, copied as closely as you can.
- Ignore ruled column headers, page numbers and anything that is not a transaction.

Return JSON only, matching the schema: { "entries": [...], "question": null }.`;

export async function extractFromPhoto(media: DownloadedMedia): Promise<Extraction> {
  const dataUri = `data:${media.mimeType};base64,${media.bytes.toString("base64")}`;

  const completion = await client.chat.completions.create({
    model: process.env.NEBIUS_VISION_MODEL ?? "Qwen/Qwen2.5-VL-72B-Instruct",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image_url", image_url: { url: dataUri } },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return ExtractionSchema.parse(JSON.parse(raw));
}
