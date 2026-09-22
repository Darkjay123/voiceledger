/**
 * Transcription tests. No network: fetch is stubbed, so these run in CI and
 * on a laptop with no API key and no credit.
 *
 * What is worth testing here is not "does AssemblyAI work" (it does) but the
 * three things WE get wrong: sending the audio in a shape that uploads fine
 * and dies at transcoding, giving up while a transcript is still queued, and
 * writing a half-heard number into a trader's books.
 */

import assert from "node:assert/strict";
import { findDoubtfulAmounts, transcribeVoiceNote, type TranscriptWord } from "./transcribe";

type Call = { url: string; init: RequestInit | undefined };

const realFetch = globalThis.fetch;
let calls: Call[] = [];

function stubFetch(responses: Array<() => unknown>) {
  let i = 0;
  calls = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const body = responses[Math.min(i, responses.length - 1)]();
    i += 1;
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }) as typeof fetch;
}

function word(text: string, confidence: number): TranscriptWord {
  return { text, confidence, start: 0, end: 100 };
}

const media = { bytes: Buffer.from([1, 2, 3, 4]), mimeType: "audio/ogg" };

process.env.ASSEMBLYAI_API_KEY = "test-key";
process.env.ASSEMBLYAI_POLL_INTERVAL_MS = "1";

let passed = 0;
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(
    () => {
      passed += 1;
      console.log(`  ok  ${name}`);
    },
    (error) => {
      console.error(`  FAIL  ${name}`);
      throw error;
    },
  );
}

async function run() {
  console.log("transcribe.test.ts");

  await test("uploads raw bytes, not JSON", async () => {
    stubFetch([
      () => ({ upload_url: "https://cdn.assemblyai.com/upload/abc" }),
      () => ({ id: "t1" }),
      () => ({ id: "t1", status: "completed", text: "I sell one bag of rice", confidence: 0.97, audio_duration: 4, words: [] }),
    ]);

    await transcribeVoiceNote(media);

    const upload = calls[0];
    assert.ok(upload.url.endsWith("/v2/upload"));
    assert.ok(upload.init?.body instanceof Uint8Array, "audio must go up as raw bytes");
    // The header AssemblyAI wants is a bare key, no Bearer.
    const headers = upload.init?.headers as Record<string, string>;
    assert.equal(headers.authorization, "test-key");
  });

  await test("sends the market vocabulary and audio context", async () => {
    stubFetch([
      () => ({ upload_url: "https://cdn.assemblyai.com/upload/abc" }),
      () => ({ id: "t2" }),
      () => ({ id: "t2", status: "completed", text: "ok", confidence: 0.9, audio_duration: 2, words: [] }),
    ]);

    await transcribeVoiceNote(media);

    const submitted = JSON.parse(String((calls[1].init as RequestInit).body));
    assert.equal(submitted.audio_url, "https://cdn.assemblyai.com/upload/abc");
    assert.ok(submitted.keyterms_prompt.includes("paint of garri"));
    assert.ok(submitted.keyterms_prompt.includes("derica"));
    assert.ok(/Pidgin/.test(submitted.prompt));
    // Keyterms are capped at six words per phrase.
    for (const term of submitted.keyterms_prompt) {
      assert.ok(String(term).split(" ").length <= 6, `too long: ${term}`);
    }
  });

  await test("keeps polling while the transcript is queued", async () => {
    let poll = 0;
    stubFetch([
      () => ({ upload_url: "https://cdn.assemblyai.com/upload/abc" }),
      () => ({ id: "t3" }),
      () => {
        poll += 1;
        if (poll < 3) return { id: "t3", status: "queued", text: null, confidence: null, audio_duration: null, words: null };
        return { id: "t3", status: "completed", text: "I sell rice", confidence: 0.94, audio_duration: 5, words: [] };
      },
    ]);

    const result = await transcribeVoiceNote(media);
    assert.equal(result.text, "I sell rice");
    assert.equal(result.transcriptId, "t3");
    assert.equal(poll, 3, "should have waited through two queued polls");
  });

  await test("surfaces a failed transcript instead of returning empty text", async () => {
    stubFetch([
      () => ({ upload_url: "https://cdn.assemblyai.com/upload/abc" }),
      () => ({ id: "t4" }),
      () => ({ id: "t4", status: "error", text: null, confidence: null, audio_duration: null, words: null, error: "audio too short" }),
    ]);

    await assert.rejects(() => transcribeVoiceNote(media), /audio too short/);
  });

  await test("flags a money word the model half-heard", () => {
    const doubtful = findDoubtfulAmounts(
      [
        word("I", 0.99),
        word("sell", 0.98),
        word("rice", 0.97),
        word("45,000", 0.41),
        word("naira", 0.95),
      ],
      0.6,
    );

    assert.equal(doubtful.length, 1);
    assert.equal(doubtful[0].text, "45,000");
  });

  await test("does not flag a confident amount or a doubtful ordinary word", () => {
    const doubtful = findDoubtfulAmounts(
      [word("15,200", 0.93), word("customer", 0.22), word("naira", 0.91)],
      0.6,
    );

    assert.equal(doubtful.length, 0);
  });

  await test("carries doubtful amounts out to the caller", async () => {
    stubFetch([
      () => ({ upload_url: "https://cdn.assemblyai.com/upload/abc" }),
      () => ({ id: "t5" }),
      () => ({
        id: "t5",
        status: "completed",
        text: "I sell bag of rice 45,000 naira",
        confidence: 0.71,
        audio_duration: 6,
        words: [word("rice", 0.96), word("45,000", 0.37), word("naira", 0.9)],
      }),
    ]);

    const result = await transcribeVoiceNote(media);
    assert.deepEqual(result.doubtfulAmounts.map((w) => w.text), ["45,000"]);
    assert.equal(result.audioDuration, 6);
    assert.equal(result.confidence, 0.71);
  });

  globalThis.fetch = realFetch;
  console.log(`transcribe: ${passed}/7 passed`);
}

run().catch((error) => {
  globalThis.fetch = realFetch;
  console.error(error);
  process.exit(1);
});
