import { ApiError, handleApiError, jsonResponse, requestGroq } from "../lib/groq.js";

export default async function generateSummary(request) {
  try {
    const data = await request.json().catch(() => null);
    if (
      !Array.isArray(data?.selected_symptoms) ||
      data.selected_symptoms.length < 1 ||
      data.selected_symptoms.length > 20 ||
      !data.selected_symptoms.every((symptom) => typeof symptom === "string" && symptom.trim())
    ) {
      throw new ApiError(422, "Select at least one symptom before generating a summary.");
    }
    if (data.additional_notes !== undefined && typeof data.additional_notes !== "string") {
      throw new ApiError(422, "Additional notes must be text.");
    }
    if ((data.additional_notes?.length ?? 0) > 4000) {
      throw new ApiError(422, "Please keep your additional notes under 4,000 characters.");
    }

    const symptomString = data.selected_symptoms.map((symptom) => symptom.trim()).join(", ");
    const notes = data.additional_notes?.trim() ?? "";
    const prompt = `You are a clinical data-gathering assistant.
The patient has confirmed the following symptoms: ${symptomString}
Additional context: ${notes}

Generate a highly structured 'Pre-Consultation Summary' for a doctor.
Use professional medical terminology for the doctor, but DO NOT provide a diagnosis.

Structure the response with exactly these headers:
1. Chief Complaint (Brief summary)
2. Symptom Details (List what the patient confirmed)
3. Recommended Questions for the Doctor (2-3 questions the patient should ask the doctor)`;

    const summary = await requestGroq(prompt);
    return jsonResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
