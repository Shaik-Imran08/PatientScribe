const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
  }
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function requestGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new ApiError(503, "GROQ_API_KEY is not configured in Netlify environment variables.");
  }

  let response;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (error) {
    console.error("Could not reach the Groq API:", error);
    throw new ApiError(502, "Could not reach the AI service. Please try again.");
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Groq API returned an error:", response.status, result?.error?.message);
    throw new ApiError(
      502,
      "The AI service request failed. Check the Groq API key and model configuration.",
    );
  }

  const content = result?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new ApiError(502, "The AI service returned an empty response. Please try again.");
  }
  return content.trim();
}

export function extractSymptoms(text) {
  const match = text.match(/\[[\s\S]*?\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (
        Array.isArray(parsed) &&
        parsed.length >= 4 &&
        parsed.length <= 6 &&
        parsed.every((item) => typeof item === "string" && item.trim())
      ) {
        return parsed.map((item) => item.trim());
      }
    } catch {
      // Continue to the list parser for replies that are not valid JSON.
    }
  }

  const items = text
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/)?.[1]?.trim())
    .filter((line) => line && line.length > 3);

  if (items.length >= 4) return items.slice(0, 6);
  throw new ApiError(502, "Could not parse symptoms from the AI response. Please try again.");
}

export async function handleApiError(error) {
  if (error instanceof ApiError) return jsonResponse({ detail: error.message }, error.status);
  console.error("Unexpected API function error:", error);
  return jsonResponse({ detail: "An unexpected server error occurred. Please try again." }, 500);
}
