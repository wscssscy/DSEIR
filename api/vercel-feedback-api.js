/**
 * Individual Response Bank — AI feedback proxy (Vercel serverless function)
 * ============================================================================
 * Alternative to the Cloudflare Worker, if you'd rather use Vercel.
 * Keeps your Anthropic API key on the server; the published site only
 * sends the built prompt.
 *
 * SETUP:
 * 1. Create a free account at https://vercel.com (sign in with GitHub
 *    is easiest).
 * 2. Create a new GitHub repo containing just this one file, kept at
 *    the path:  api/feedback.js
 *    (Vercel auto-detects anything under /api as a serverless function
 *    — no other files or build config are required.)
 * 3. In Vercel: Add New -> Project -> import that GitHub repo -> Deploy.
 * 4. In the Vercel project: Settings -> Environment Variables -> add
 *      ANTHROPIC_API_KEY = your key from
 *      https://console.anthropic.com/settings/keys
 *    then redeploy (Deployments tab -> ... -> Redeploy) so the
 *    function picks up the new variable.
 * 5. Optional: also add ALLOWED_ORIGIN = https://YOUR-USERNAME.github.io
 *    to restrict which site can call this function.
 * 6. Your endpoint URL will be:
 *      https://YOUR-PROJECT-NAME.vercel.app/api/feedback
 *    Paste that into the site's HTML, in the line near the top of the
 *    embedded script:
 *      var DEFAULT_FEEDBACK_ENDPOINT = "";
 *    Save and re-publish to GitHub Pages.
 *
 * Note: Vercel's free "Hobby" plan doesn't include built-in persistent
 * rate limiting the way Cloudflare KV does here — if you want a per-IP
 * daily cap on Vercel, the simplest option is Vercel KV (a paid add-on)
 * or an external store. For a single class, the Cloudflare Worker
 * version (with its free KV-based limiter) is the simpler free option.
 */

const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1000;

export default async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Server misconfigured: ANTHROPIC_API_KEY is not set." });
    return;
  }

  const body = req.body;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    res.status(400).json({ error: "Missing 'messages' array" });
    return;
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: body.messages,
      }),
    });

    const text = await anthropicRes.text();
    res.status(anthropicRes.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: "Could not reach Anthropic API", detail: String(err) });
  }
}
