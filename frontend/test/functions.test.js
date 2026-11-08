import assert from "node:assert/strict";
import { test } from "node:test";
import generateChecklist from "../netlify/functions/generate-checklist.js";
import generateSummary from "../netlify/functions/generate-summary.js";
import health from "../netlify/functions/health.js";

async function withGroqMock(content, callback) {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GROQ_API_KEY;
  const originalModel = process.env.GROQ_MODEL;
  let requestOptions;

  process.env.GROQ_API_KEY = "test-key";
  delete process.env.GROQ_MODEL;
  globalThis.fetch = async (_url, options) => {
    requestOptions = options;
    return Response.json({ choices: [{ message: { content } }] });
  };

  try {
    await callback(() => requestOptions);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = originalModel;
  }
}

test("health function returns an OK status", async () => {
  const response = await health();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("checklist function calls Groq and returns parsed symptoms", async () => {
  const symptoms = ["Pain", "Nausea", "Dizziness", "Low appetite"];
  await withGroqMock(JSON.stringify(symptoms), async (getOptions) => {
    const response = await generateChecklist(
      new Request("https://example.test/api/generate-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_text: "Stomach hurts" }),
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { symptoms });
    assert.equal(getOptions().headers.Authorization, "Bearer test-key");
    assert.equal(JSON.parse(getOptions().body).model, "qwen/qwen3.8-27b");
  });
});

test("checklist function rejects empty user input", async () => {
  const response = await generateChecklist(
    new Request("https://example.test/api/generate-checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_text: "  " }),
    }),
  );

  assert.equal(response.status, 422);
  assert.match((await response.json()).detail, /Describe how you are feeling/);
});

test("summary function returns generated summary text", async () => {
  const summary = "1. Chief Complaint\nStomach discomfort";
  await withGroqMock(summary, async (getOptions) => {
    const response = await generateSummary(
      new Request("https://example.test/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_symptoms: ["Pain"], additional_notes: "Since morning" }),
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { summary });
    assert.match(JSON.parse(getOptions().body).messages[0].content, /Since morning/);
  });
});

test("AI functions report when the Groq key is missing", async () => {
  const originalApiKey = process.env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;
  delete process.env.GROQ_API_KEY;

  try {
    const response = await generateSummary(
      new Request("https://example.test/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_symptoms: ["Pain"] }),
      }),
    );
    const data = await response.json();
    assert.equal(response.status, 503);
    assert.match(data.detail, /GROQ_API_KEY/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalApiKey;
  }
});
