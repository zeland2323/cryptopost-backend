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

app.get("/", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ status: "ok", service: "CryptoPost Backend" });
});

app.post("/tweet", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { text, api_key, api_secret, access_token, token_secret } = req.body;

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

    const tweet = await client.readWrite.v2.tweet(text);
    console.log(`Tweet published: ${tweet.data.id}`);
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`CryptoPost backend running on port ${PORT}`);
});
