import { NextRequest } from "next/server";
import { extractEntries } from "@/core/extract";
import { checkEntry, formatNaira } from "@/core/ledger";

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
  type: "text" | "audio" | "image" | string;
  text?: { body: string };
};

async function handle(body: any) {
  const messages: WhatsAppMessage[] =
    body?.entry?.[0]?.changes?.[0]?.value?.messages ?? [];

  for (const message of messages) {
    // Voice notes and sales-book photos land in the next commit; text first so
    // the ledger path is provable end to end without a media download.
    if (message.type !== "text" || !message.text?.body) continue;

    const extraction = await extractEntries(message.text.body);
    const checks = extraction.entries.map(checkEntry);

    const accepted = checks.filter((c) => c.accepted);
    const questions = checks.filter((c) => !c.accepted).map((c) => c.question!);

    await sendReply(message.from, composeReply(accepted.length, questions, accepted));
  }
}

function composeReply(
  savedCount: number,
  questions: string[],
  accepted: ReturnType<typeof checkEntry>[],
): string {
  const lines: string[] = [];

  for (const { entry } of accepted) {
    const verb = entry.direction === "sale" ? "Sold" : entry.direction === "purchase" ? "Bought" : "Spent";
    const qty = entry.quantity ? `${entry.quantity} ${entry.unit ?? ""} ` : "";
    lines.push(`${verb} ${qty}${entry.item} — ${formatNaira(entry.total_minor)}`.replace(/\s+/g, " "));
  }

  if (savedCount > 0) lines.push(savedCount === 1 ? "Saved." : `Saved ${savedCount} entries.`);
  lines.push(...questions);

  return lines.join("\n") || "I didn't catch a sale in that. Try telling me what you sold and for how much.";
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
