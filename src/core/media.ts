/**
 * WhatsApp media download.
 *
 * Media arrives as an id, not bytes. Two hops: ask Graph where the file lives,
 * then fetch it with the same token. Both hops need the access token, and the
 * URL Graph hands back expires in minutes, so nothing is cached.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export type DownloadedMedia = {
  bytes: Buffer;
  mimeType: string;
};

export async function downloadMedia(mediaId: string): Promise<DownloadedMedia> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  const lookup = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!lookup.ok) {
    throw new Error(`media lookup failed: ${lookup.status} ${await lookup.text()}`);
  }

  const { url, mime_type } = (await lookup.json()) as { url: string; mime_type: string };

  const file = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!file.ok) {
    throw new Error(`media download failed: ${file.status}`);
  }

  return {
    bytes: Buffer.from(await file.arrayBuffer()),
    mimeType: mime_type,
  };
}
