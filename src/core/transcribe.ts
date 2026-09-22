import type { DownloadedMedia } from "./media";

/**
 * Voice notes are the whole point of this product, and they are also the
 * hardest input. A Lagos trader records in a market: generator noise, other
 * people talking, Pidgin with English numbers dropped in mid-sentence, and
 * Yoruba or Igbo words for the goods themselves.
 *
 * AssemblyAI does the listening. Three things earn their place here:
 *
 *   prompt          a plain description of what the audio IS, which is what
 *                   the model wants. Not instructions, not a keyword dump.
 *   keyterms_prompt the market vocabulary. "Derica" and "paint of garri" are
 *                   not in any general-purpose vocabulary, and a ledger that
 *                   mishears the unit gets the quantity wrong.
 *   word confidence the part that matters most. A bookkeeping app that
 *                   quietly writes down a number it half-heard is worse than
 *                   one that asks. Every money word comes back with a
 *                   confidence score, and anything under the floor is handed
 *                   to the ledger as "confirm this", never as fact.
 */

const BASE_URL = process.env.ASSEMBLYAI_BASE_URL ?? "https://api.assemblyai.com";

/** Scenario-level context: what the audio is, not how to transcribe it. */
const AUDIO_CONTEXT =
  "A Nigerian market trader recording a short voice note about the day's " +
  "buying and selling, speaking Nigerian Pidgin English with amounts in naira.";

/** Market vocabulary the model cannot be expected to know. Max 6 words each. */
const MARKET_TERMS = [
  "naira",
  "bag of rice",
  "carton of indomie",
  "crate of egg",
  "paint of garri",
  "tuber of yam",
  "derica",
  "congo",
  "sachet",
  "bundle",
  "e remain",
  "e don finish",
  "I carry",
  "market money",
];

/**
 * Below this, we do not trust the word. Chosen deliberately: AssemblyAI's own
 * confidences sit well above 0.9 on clean speech, so 0.6 catches the genuinely
 * doubtful without flagging every accented vowel. Tunable per deployment.
 */
const CONFIDENCE_FLOOR = Number(process.env.ASSEMBLYAI_CONFIDENCE_FLOOR ?? 0.6);

/** Words that mean money. A doubtful one of these is worth stopping for. */
const MONEY_PATTERN =
  /^(\d[\d,.]*|naira|thousand|hundred|k|million|k\d+|₦.*)$/i;

export type TranscriptWord = {
  text: string;
  confidence: number;
  start: number;
  end: number;
};

export type VoiceNoteTranscript = {
  /** What the trader said, as one line. */
  text: string;
  /** AssemblyAI's id. Logged for every request: needed to retry, fetch or delete. */
  transcriptId: string;
  /** Whole-utterance confidence, 0 to 1. */
  confidence: number;
  /** Seconds of audio, for cost tracking. */
  audioDuration: number;
  /**
   * Money words the model was unsure about. Non-empty means the ledger should
   * confirm before writing, not guess.
   */
  doubtfulAmounts: TranscriptWord[];
};

type AssemblyTranscript = {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  text: string | null;
  confidence: number | null;
  audio_duration: number | null;
  words: TranscriptWord[] | null;
  error?: string;
};

function authHeaders(): Record<string, string> {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    throw new Error("ASSEMBLYAI_API_KEY is not set");
  }
  // No Bearer prefix: AssemblyAI takes the raw key.
  return { authorization: key };
}

/**
 * WhatsApp hands us bytes, not a public URL, so the file goes up first.
 * It must be streamed as raw bytes. Wrapping it in JSON returns a perfectly
 * valid upload_url that then fails at transcoding, which is a miserable bug
 * to chase, so this stays a plain binary body.
 */
async function uploadAudio(media: DownloadedMedia): Promise<string> {
  const response = await fetch(`${BASE_URL}/v2/upload`, {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/octet-stream" },
    body: new Uint8Array(media.bytes),
  });

  if (!response.ok) {
    throw new Error(`assemblyai upload failed: ${response.status} ${await response.text()}`);
  }

  const { upload_url } = (await response.json()) as { upload_url: string };
  return upload_url;
}

async function submitTranscript(audioUrl: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/v2/transcript`, {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify({
      audio_url: audioUrl,
      speech_model: process.env.ASSEMBLYAI_SPEECH_MODEL ?? "universal",
      language_code: process.env.ASSEMBLYAI_LANGUAGE_CODE ?? "en",
      prompt: AUDIO_CONTEXT,
      keyterms_prompt: MARKET_TERMS,
      punctuate: true,
      format_text: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`assemblyai submit failed: ${response.status} ${await response.text()}`);
  }

  const { id } = (await response.json()) as { id: string };
  return id;
}

async function pollUntilDone(id: string): Promise<AssemblyTranscript> {
  const intervalMs = Number(process.env.ASSEMBLYAI_POLL_INTERVAL_MS ?? 3000);
  const timeoutMs = Number(process.env.ASSEMBLYAI_TIMEOUT_MS ?? 180000);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await fetch(`${BASE_URL}/v2/transcript/${id}`, {
      headers: authHeaders(),
    });

    if (!response.ok) {
      throw new Error(`assemblyai poll failed: ${response.status}`);
    }

    const transcript = (await response.json()) as AssemblyTranscript;

    if (transcript.status === "completed") return transcript;
    if (transcript.status === "error") {
      throw new Error(`assemblyai transcription failed (${id}): ${transcript.error}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`assemblyai transcription timed out (${id})`);
}

/** Money words the model was not confident about. */
export function findDoubtfulAmounts(
  words: TranscriptWord[],
  floor: number = CONFIDENCE_FLOOR,
): TranscriptWord[] {
  return words.filter(
    (word) => MONEY_PATTERN.test(word.text.replace(/[.,]$/, "")) && word.confidence < floor,
  );
}

export async function transcribeVoiceNote(
  media: DownloadedMedia,
): Promise<VoiceNoteTranscript> {
  const audioUrl = await uploadAudio(media);
  const id = await submitTranscript(audioUrl);
  const transcript = await pollUntilDone(id);

  const words = transcript.words ?? [];

  return {
    text: (transcript.text ?? "").trim(),
    transcriptId: transcript.id,
    confidence: transcript.confidence ?? 0,
    audioDuration: transcript.audio_duration ?? 0,
    doubtfulAmounts: findDoubtfulAmounts(words),
  };
}
