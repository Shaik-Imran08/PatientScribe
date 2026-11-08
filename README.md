# PatientScribe

PatientScribe helps people organize symptoms before a doctor's visit. It creates a symptom checklist and an AI-generated pre-consultation summary to share with a healthcare professional.

**Live demo:** [patientscribe.netlify.app](https://patientscribe.netlify.app)

## Features

- Turn a symptom description into a related checklist.
- Select symptoms and generate a structured doctor summary.
- Use the app locally with FastAPI or deploy the API through Netlify Functions.
- Keep the Groq API key on the server, outside the browser.

## Tech stack

- **Frontend:** React, Vite
- **Backend:** FastAPI, Python
- **AI:** Groq API
- **Deployment:** Netlify

## Run locally

### 1. Configure the backend

Create `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key
# Optional: overrides the default model
GROQ_MODEL=qwen/qwen3.8-27b
```

Keep this file private; do not commit API keys.

### 2. Install and run the backend

From the project root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Install and run the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Vite proxies local `/api` requests to the FastAPI server on port 8000.

## Deploy to Netlify

The root `netlify.toml` configures the frontend build and routes the API endpoints to Netlify Functions.

Add `GROQ_API_KEY` in the Netlify site's **Project configuration → Environment variables**. Mark it as a secret and make sure it is available to Functions. Trigger a new deploy after changing the variable.

## API endpoints

- `GET /api/health`
- `POST /api/generate-checklist`
- `POST /api/generate-summary`

## Checks

Run these commands from the `frontend` directory:

```bash
npm test
npm run lint
npm run build
```

## Disclaimer

PatientScribe is a preparation aid, not a medical professional. It does not provide diagnoses or medical advice. AI-generated content may be incomplete or incorrect; discuss symptoms with a qualified healthcare professional.
