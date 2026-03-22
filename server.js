import express from "express";
import cors from "cors";
import { TwitterApi } from "twitter-api-v2";

const app = express();
app.use(express.json());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options("*", cors());

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ status: "ok", service: "CryptoPost Backend" });
});

// ── POST /tweet — single tweet or reply ──────────────────────────────────────
// Body: { text, api_key, api_secret, access_token, token_secret, reply_to_id? }
app.post("/tweet", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { text, api_key, api_secret, access_token, token_secret, reply_to_id } = req.body;

  if (!text || !api_key || !api_secret || !access_token || !token_secret) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  if (text.length > 280) {
    return res.status(400).json({ error: "Tweet exceeds 280 characters." });
  }

  try {
    const client = new TwitterApi({
      appKey:       api_key,
      appSecret:    api_secret,
      accessToken:  access_token,
      accessSecret: token_secret,
    });

    // Build tweet payload — add reply if reply_to_id is provided
    const payload = { text };
    if (reply_to_id) {
      payload.reply = { in_reply_to_tweet_id: reply_to_id };
    }

    const tweet = await client.readWrite.v2.tweet(payload);
    console.log(`[${new Date().toISOString()}] Tweet published: ${tweet.data.id}${reply_to_id ? ' (reply to ' + reply_to_id + ')' : ''}`);

    return res.json({
      success:  true,
      tweet_id: tweet.data.id,
      text:     tweet.data.text,
    });

  } catch (err) {
    console.error("Twitter API error:", err?.data ?? err.message);
    return res.status(500).json({
      error:   "Failed to publish tweet.",
      details: err?.data?.detail ?? err.message,
    });
  }
});

// ── POST /thread — publish a full thread ─────────────────────────────────────
// Body: { parts: string[], api_key, api_secret, access_token, token_secret }
app.post("/thread", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { parts, api_key, api_secret, access_token, token_secret } = req.body;

  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: "Missing or empty parts array." });
  }

  if (!api_key || !api_secret || !access_token || !token_secret) {
    return res.status(400).json({ error: "Missing API credentials." });
  }

  try {
    const client = new TwitterApi({
      appKey:       api_key,
      appSecret:    api_secret,
      accessToken:  access_token,
      accessSecret: token_secret,
    });

    const tweetIds = [];
    let lastId = null;

    for (const part of parts) {
      const payload = { text: part };
      if (lastId) {
        payload.reply = { in_reply_to_tweet_id: lastId };
      }

      const tweet = await client.readWrite.v2.tweet(payload);
      lastId = tweet.data.id;
      tweetIds.push(tweet.data.id);

      console.log(`[${new Date().toISOString()}] Thread part published: ${tweet.data.id}`);

      // Small delay between tweets to avoid rate limits
      if (parts.indexOf(part) < parts.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return res.json({
      success:   true,
      thread_ids: tweetIds,
      first_id:  tweetIds[0],
      count:     tweetIds.length,
    });

  } catch (err) {
    console.error("Thread error:", err?.data ?? err.message);
    return res.status(500).json({
      error:   "Failed to publish thread.",
      details: err?.data?.detail ?? err.message,
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`CryptoPost backend running on port ${PORT}`);
});
