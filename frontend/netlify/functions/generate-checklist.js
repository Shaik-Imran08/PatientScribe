import {
  ApiError,
  extractSymptoms,
  handleApiError,
  jsonResponse,
  requestGroq,
} from "../lib/groq.js";

export default async function generateChecklist(request) {
  try {
    const data = await request.json().catch(() => null);
    if (typeof data?.user_text !== "string" || !data.user_text.trim()) {
      throw new ApiError(422, "Describe how you are feeling before continuing.");
    }
    if (data.user_text.length > 4000) {
      throw new ApiError(422, "Please keep your description under 4,000 characters.");
    }

    const prompt = `The user reported this vague medical issue: "${data.user_text.trim()}"

Generate a list of exactly 4 to 6 specific, related symptoms the user might be experiencing.
Use simple, patient-friendly language. DO NOT diagnose or list severe diseases.

Respond with ONLY a valid JSON array of strings, no explanation. Example:
["Stomach pain or cramping", "Nausea or feeling like vomiting", "Loss of appetite", "Dizziness or lightheadedness"]`;

    const content = await requestGroq(prompt);
    return jsonResponse({ symptoms: extractSymptoms(content) });
  } catch (error) {
    return handleApiError(error);
  }
}
