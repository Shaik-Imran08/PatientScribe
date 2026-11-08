# PatientScribe deployment

PatientScribe uses FastAPI during local development and Netlify Functions after deployment. The root `netlify.toml` builds the frontend and routes `/api/health`, `/api/generate-checklist`, and `/api/generate-summary` to functions included in the same deploy.

## Configure Netlify

In the Netlify site settings, add `GROQ_API_KEY` as an environment variable available to Functions, then trigger a new deploy. You can optionally set `GROQ_MODEL` to override the default model. Keep the key server-side; do not use a `VITE_` prefix because Vite variables are exposed to the browser.

After deployment, open `/api/health` on the site URL. A working function returns `{"status":"ok"}`. If an AI request reports that `GROQ_API_KEY` is missing, set it in Netlify and redeploy.

## Local development

Create `backend/.env` with `GROQ_API_KEY`, start the API from the `backend` directory with `uvicorn main:app --reload --port 8000`, and start the frontend from `frontend` with `npm run dev`. Vite proxies `/api` requests to the local FastAPI server.

## Checks

- `npm run build` builds the frontend.
- `npm run lint` checks the frontend and function source.
- `npm test` runs the API function checks without making real Groq requests.
