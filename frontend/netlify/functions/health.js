import { jsonResponse } from "../lib/groq.js";

export default async function health() {
  return jsonResponse({ status: "ok" });
}
