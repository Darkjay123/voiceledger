import OpenAI from "openai";
import { toFile } from "openai/uploads";
import type { DownloadedMedia } from "./media";

const client = new OpenAI({
  apiKey: process.env.NEBIUS_API_KEY,
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1",
});

/**
 * Voice notes are the whole point of this product, and they are also the
 * hardest input. A Lagos trader records in a market: engine noise, other
 * people talking, Pidgin with English numbers dropped in mid-sentence, and
 * Yoruba or Igbo words for the goods themselves.
 *
 * The prompt is doing real work here. Seeding the decoder with the vocabulary
 * it should expect is what stops "forty-five thousand naira" coming back as
 * "forty five thousand nara" and the item names turning into nonsense.
 */
const DECODER_HINT = [
  "Nigerian market trading, spoken in Nigerian Pidgin English.",
  "Money is in naira: thousand, k, five thousand, forty-five thousand.",
  "Goods: bag of rice, carton of indomie, crate of egg, paint of garri,",
  "derica, congo, bundle, sachet, dozen, tuber of yam.",
  "Verbs: I sell, I buy, I carry, e remain, e don finish.",
].join(" ");

export async function transcribeVoiceNote(media: DownloadedMedia): Promise<string> {
  const extension = media.mimeType.includes("mpeg")
    ? "mp3"
    : media.mimeType.includes("mp4")
      ? "mp4"
      : "ogg";

  const result = await client.audio.transcriptions.create({
    model: process.env.NEBIUS_ASR_MODEL ?? "openai/whisper-large-v3",
    file: await toFile(media.bytes, `voice-note.${extension}`, { type: media.mimeType }),
    prompt: DECODER_HINT,
    temperature: 0,
  });

  return result.text.trim();
}
