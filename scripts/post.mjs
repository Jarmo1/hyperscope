#!/usr/bin/env node
/**
 * Publishes the current most postable fact from Hyperscope.
 *
 * Run on a schedule by .github/workflows/post.yml. The site stays stateless:
 * it answers "what is worth saying right now" and this script decides whether
 * that has already been said, using a file committed back to the repo. That
 * keeps the whole loop free — no database, no paid cron.
 *
 * Channels are opt-in by environment variable. Telegram is the reliable one
 * (free and unlimited); X is included but its free API tier is heavily capped,
 * so it stays optional rather than assumed.
 *
 * Nothing is posted unless DRY_RUN is unset — inspect output first.
 */

import { createHmac, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const SITE = process.env.SITE_URL?.replace(/\/$/, "");
const STATE_FILE = process.env.STATE_FILE ?? "data/posted.json";
const HISTORY_LIMIT = 200;
const DRY_RUN = process.env.DRY_RUN === "1";

if (!SITE) {
  console.error("SITE_URL is required (e.g. https://hyperscope.vercel.app)");
  process.exit(1);
}

/** Keys already published, newest last. */
async function readHistory() {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.keys) ? parsed.keys : [];
  } catch {
    return [];
  }
}

async function writeHistory(keys) {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(
    STATE_FILE,
    `${JSON.stringify({ keys: keys.slice(-HISTORY_LIMIT) }, null, 2)}\n`,
    "utf8",
  );
}

async function fetchStory() {
  const res = await fetch(`${SITE}/api/story`, {
    headers: { "User-Agent": "hyperscope-poster" },
  });
  if (!res.ok) throw new Error(`/api/story returned ${res.status}`);
  const body = await res.json();
  return body.story ?? null;
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

async function postTelegram(story) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { channel: "telegram", skipped: "not configured" };

  const caption = `${story.text}\n\n${story.url}`;

  // sendPhoto takes a URL directly, so the card never has to be downloaded here.
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, photo: story.image, caption }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(`Telegram failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return { channel: "telegram", ok: true };
}

const encodeRfc3986 = (value) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * OAuth 1.0a signature for X. The JSON request body is deliberately excluded
 * from the base string — only oauth_* parameters are signed for JSON posts.
 */
function oauthHeader(method, url, credentials) {
  const params = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
  };

  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(params[k])}`)
    .join("&");

  const base = [method.toUpperCase(), encodeRfc3986(url), encodeRfc3986(paramString)].join(
    "&",
  );
  const signingKey = `${encodeRfc3986(credentials.apiSecret)}&${encodeRfc3986(
    credentials.accessSecret,
  )}`;
  const signature = createHmac("sha1", signingKey).update(base).digest("base64");

  const header = { ...params, oauth_signature: signature };
  return `OAuth ${Object.keys(header)
    .sort()
    .map((k) => `${encodeRfc3986(k)}="${encodeRfc3986(header[k])}"`)
    .join(", ")}`;
}

async function postX(story) {
  const credentials = {
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  };
  if (Object.values(credentials).some((v) => !v)) {
    return { channel: "x", skipped: "not configured" };
  }

  // The link renders as the share card via og: tags, so no media upload needed.
  const text = `${story.text}\n\n${story.url}`;
  const url = "https://api.x.com/2/tweets";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: oauthHeader("POST", url, credentials),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`X failed: ${res.status} ${JSON.stringify(body)}`);
  return { channel: "x", ok: true };
}

async function postDiscord(story) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return { channel: "discord", skipped: "not configured" };

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `${story.text}\n${story.url}`,
      embeds: [{ image: { url: story.image } }],
    }),
  });
  if (!res.ok) throw new Error(`Discord failed: ${res.status}`);
  return { channel: "discord", ok: true };
}

// ---------------------------------------------------------------------------

async function main() {
  const story = await fetchStory();
  if (!story) {
    console.log("No story above threshold. Nothing to post.");
    return;
  }

  const history = await readHistory();
  if (history.includes(story.key)) {
    console.log(`Already posted: ${story.key}`);
    return;
  }

  console.log(`Story: ${story.key}`);
  console.log(story.text);
  console.log(story.url);

  if (DRY_RUN) {
    console.log("\nDRY_RUN=1 — not publishing.");
    return;
  }

  const results = await Promise.allSettled([
    postTelegram(story),
    postX(story),
    postDiscord(story),
  ]);

  let delivered = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      const { channel, ok, skipped } = result.value;
      console.log(ok ? `posted to ${channel}` : `skipped ${channel}: ${skipped}`);
      if (ok) delivered++;
    } else {
      console.error(`error: ${result.reason?.message ?? result.reason}`);
    }
  }

  if (delivered === 0) {
    // Recording a key nothing actually received would silently suppress the
    // story forever once a channel is finally configured.
    console.log("No channel accepted the post — not recording it as published.");
    return;
  }

  await writeHistory([...history, story.key]);
  console.log(`Recorded ${story.key} (${delivered} channel(s)).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
