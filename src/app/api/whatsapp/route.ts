import { NextRequest } from "next/server";
import { extractEntries } from "@/core/extract";
import { extractFromPhoto } from "@/core/vision";
import { transcribeVoiceNote } from "@/core/transcribe";
import { downloadMedia } from "@/core/media";
import { checkEntry, formatNaira, type Check } from "@/core/ledger";
import type { Extraction } from "@/core/schema";

/**
 * WhatsApp Cloud API webhook.
 *
 * Two things matter here beyond the obvious. Meta retries anything it does not
 * get a fast 200 for, so we acknowledge first and do the thinking after. And
 * every reply costs money once the free service window closes, so a message
 * gets exactly one answer, never a running commentary.
 */

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Acknowledge immediately; Meta retries anything slow.
  queueMicrotask(() => handle(body).catch((err) => console.error("handle failed", err)));

  return new Response(null, { status: 200 });
}

type WhatsAppMessage = {
  from: string;
  type: string;
  text?: { body: string };
  audio?: { id: string };
  image?: { id: string };
};

async function handle(body: any) {
  const messages: WhatsAppMessage[] =
    body?.entry?.[0]?.changes?.[0]?.value?.messages ?? [];

  for (const message of messages) {
    try {
      const read = await readMessage(message);
      if (!read) continue;

      const checks = read.extraction.entries.map(checkEntry);
      await sendReply(message.from, composeReply(checks, read.heard));
    } catch (err) {
      console.error("message failed", err);
      await sendReply(
        message.from,
        "Sorry, I couldn't read that one. Send it again and I'll try once more.",
      );
    }
  }
}

type ReadMessage = {
  extraction: Extraction;
  /** What we understood the trader to have said, echoed back on voice notes. */
  heard: string | null;
};

async function readMessage(message: WhatsAppMessage): Promise<ReadMessage | null> {
  if (message.type === "text" && message.text?.body) {
    return { extraction: await extractEntries(message.text.body), heard: null };
  }

  if (message.type === "audio" && message.audio?.id) {
    const media = await downloadMedia(message.audio.id);
    const transcript = await transcribeVoiceNote(media);
    if (!transcript) return null;
    // Echo the transcript back. A trader who can hear what we heard can catch
    // a misread before it becomes a wrong number in her books.
    return { extraction: await extractEntries(transcript), heard: transcript };
  }

  if (message.type === "image" && message.image?.id) {
    const media = await downloadMedia(message.image.id);
    return { extraction: await extractFromPhoto(media), heard: null };
  }

  return null;
}

function composeReply(checks: Check[], heard: string | null): string {
  const accepted = checks.filter((c) => c.accepted);
  const questions = checks.filter((c) => !c.accepted).map((c) => c.question!);

  const lines: string[] = [];
  if (heard) lines.push(`Heard: "${heard}"`);

  for (const { entry } of accepted) {
    const verb =
      entry.direction === "sale" ? "Sold" : entry.direction === "purchase" ? "Bought" : "Spent";
    const qty = entry.quantity ? `${entry.quantity} ${entry.unit ?? ""} ` : "";
    lines.push(`${verb} ${qty}${entry.item}: ${formatNaira(entry.total_minor)}`.replace(/\s+/g, " "));
  }

  if (accepted.length > 0) {
    lines.push(accepted.length === 1 ? "Saved." : `Saved ${accepted.length} entries.`);
  }

  lines.push(...questions);

  return (
    lines.join("\n") ||
    "I didn't catch a sale in that. Tell me what you sold and for how much, or send a photo of your book."
  );
}

async function sendReply(to: string, text: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    },
  );

  if (!res.ok) {
    console.error("whatsapp send failed", res.status, await res.text());
  }
}
