# VoiceLedger

Voice-first bookkeeping for cash traders.

A trader sends a WhatsApp voice note in the language they actually speak ("I sell twenty bag of rice for forty-five thousand") or snaps a photo of their handwritten sales book. VoiceLedger turns it into clean records, answers questions about the month, and checks live market prices.

## Why this

Roughly two billion people work in cash-based informal retail. Their books are exercise books and memory. Every bookkeeping tool built for them assumes typing, English, and a smartphone keyboard. Voice notes and photos are how this market already communicates.

Nigeria first, because that is the market we know. The shape fits Dhaka and Lima too.

## How it works

1. WhatsApp Business API receives a voice note, photo, or text.
2. AssemblyAI transcribes the voice note, primed with the market's own vocabulary: naira, derica, paint of garri, crate of egg, tuber of yam.
3. A reasoning model on Nebius Token Factory (NVIDIA Nemotron) extracts the transaction: item, quantity, unit price, total, direction.
4. Ambiguity is resolved in one short reply, never a form. A money word AssemblyAI was unsure of is queried, not booked.
5. Records land in Postgres. The trader can ask "how much I make this week?" in the same voice-note channel.
6. Live market price lookups run through Tavily.

## Stack

- AssemblyAI for speech-to-text, with contextual prompting, keyterms and per-word confidence
- Nebius Token Factory (NVIDIA Nemotron) for reasoning and extraction
- Tavily for live market price grounding
- WhatsApp Business API (Cloud API) as the interface
- Next.js + Supabase

## The number it did not hear

Most voice bookkeeping demos transcribe confidently and move on. In a real
market that is the failure mode: a generator kicks in over "forty-five
thousand", the model returns something plausible, and a wrong number lands in
somebody's books where nobody will ever catch it.

AssemblyAI returns a confidence score per word. VoiceLedger reads those scores,
picks out the ones that are money, and anything under the floor (0.6 by
default) never reaches the ledger. The trader gets asked instead:

    Heard: "I sell bag of rice for 45,000 naira"
    The line was noisy around "45,000". Type that amount so I book it right.

Everything else on the note still saves. One doubtful word costs one short
question, not the whole entry.

## Running it

    cp .env.example .env    # ASSEMBLYAI_API_KEY is the only one needed for voice
    npm install
    npm test                # no network, no key required
    npm run dev

## Status

Early. Voice pipeline on AssemblyAI, built for the AssemblyAI Voice Agent
Hackathon (Sep 1-30, 2026) and the Nebius x NVIDIA Global AI Hackathon,
Personal AI track.
