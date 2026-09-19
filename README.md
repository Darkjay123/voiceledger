# VoiceLedger

Voice-first bookkeeping for cash traders.

A trader sends a WhatsApp voice note in the language they actually speak ("I sell twenty bag of rice for forty-five thousand") or snaps a photo of their handwritten sales book. VoiceLedger turns it into clean records, answers questions about the month, and checks live market prices.

## Why this

Roughly two billion people work in cash-based informal retail. Their books are exercise books and memory. Every bookkeeping tool built for them assumes typing, English, and a smartphone keyboard. Voice notes and photos are how this market already communicates.

Nigeria first, because that is the market we know. The shape fits Dhaka and Lima too.

## How it works

1. WhatsApp Business API receives a voice note, photo, or text.
2. Speech is transcribed, including code-switched Nigerian Pidgin, Yoruba, Hausa and Igbo.
3. A reasoning model on Nebius Token Factory (NVIDIA Nemotron) extracts the transaction: item, quantity, unit price, total, direction.
4. Ambiguity is resolved in one short reply, never a form.
5. Records land in Postgres. The trader can ask "how much I make this week?" in the same voice-note channel.
6. Live market price lookups run through Tavily.

## Stack

- Nebius Token Factory (NVIDIA Nemotron) for reasoning and extraction
- Speech-to-text tuned for code-switched West African speech
- Tavily for live market price grounding
- WhatsApp Business API (Cloud API) as the interface
- Next.js + Supabase

## Status

Early. Building toward the Nebius x NVIDIA Global AI Hackathon, Personal AI track.
