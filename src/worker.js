const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_INPUT_CHARS = 600;
const MAX_OUTPUT_TOKENS = 180;

const SYSTEM_PROMPT = `You rewrite a single short resume bullet point for a teenager applying for their first job.

Rules:
- Return ONE polished bullet, 1-2 sentences max, in plain text. No markdown, no quotes, no preamble, no list markers.
- Start with a strong past-tense action verb (e.g. Organized, Built, Helped, Tutored, Coached, Sold, Designed, Maintained).
- Stay honest. Do NOT invent skills, numbers, titles, employers, or accomplishments not present in the user's text.
- Keep their voice — sound like a real teen, not a corporate executive. No jargon.
- If the input is not describing work, school, an activity, a volunteer effort, a project, a skill, or an achievement, refuse by replying exactly: REFUSE_OFFTOPIC
- If the input is empty, just whitespace, or under 3 words, reply exactly: REFUSE_TOOSHORT`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/polish" && request.method === "POST") {
      return handlePolish(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handlePolish(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  if (env.POLISH_RATE_LIMITER) {
    const { success } = await env.POLISH_RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return json(
        { error: "Too many requests. Take a breath and try again in a minute." },
        429,
      );
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return json({ error: "Write something first, then click Help me word this." }, 400);
  }
  if (text.length > MAX_INPUT_CHARS) {
    return json(
      { error: `That's a lot. Trim it under ${MAX_INPUT_CHARS} characters and try again.` },
      400,
    );
  }

  let response;
  try {
    response = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4,
    });
  } catch (err) {
    return json({ error: "The AI is unavailable right now. Try again in a minute." }, 502);
  }

  const raw = (response?.response || "").trim();

  if (raw === "REFUSE_OFFTOPIC" || raw.startsWith("REFUSE_OFFTOPIC")) {
    return json(
      {
        error:
          "That doesn't look like a resume bullet. Try describing a job, activity, project, or skill.",
      },
      422,
    );
  }
  if (raw === "REFUSE_TOOSHORT" || raw.startsWith("REFUSE_TOOSHORT")) {
    return json(
      { error: "Add a little more detail first — what did you do, and where?" },
      422,
    );
  }
  if (!raw) {
    return json({ error: "The AI didn't return anything. Try again." }, 502);
  }

  const polished = stripWrapping(raw);
  return json({ polished });
}

function stripWrapping(text) {
  let out = text.replace(/^[\s•\-*\d.)]+/, "").trim();
  if (
    (out.startsWith('"') && out.endsWith('"')) ||
    (out.startsWith("'") && out.endsWith("'"))
  ) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
