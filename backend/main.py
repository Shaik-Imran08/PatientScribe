import json
import logging
import os
import re
from functools import lru_cache

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import APIError as GroqAPIError
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from pydantic import BaseModel, Field, ValidationError, field_validator

load_dotenv()

logger = logging.getLogger(__name__)
app = FastAPI(title="PatientScribe API")

_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
if os.getenv("FRONTEND_URL"):
    _origins.append(os.getenv("FRONTEND_URL"))
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InitialInput(BaseModel):
    user_text: str = Field(min_length=1, max_length=4000)

    @field_validator("user_text", mode="before")
    @classmethod
    def strip_user_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SummaryInput(BaseModel):
    selected_symptoms: list[str] = Field(min_length=1, max_length=20)
    additional_notes: str = Field(default="", max_length=4000)


@lru_cache
def get_llm() -> ChatGroq:
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not configured in backend/.env.",
        )
    return ChatGroq(model=os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"), temperature=0)


def provider_error() -> HTTPException:
    logger.exception("The Groq request failed")
    return HTTPException(
        status_code=502,
        detail="The AI service request failed. Check the Groq API key and try again.",
    )


def extract_symptoms_from_text(text: str) -> list[str]:
    """Parse a JSON array of symptoms from the model's plain-text reply."""
    # Try to find a JSON array anywhere in the response
    match = re.search(r"\[.*?\]", text, re.DOTALL)
    if match:
        try:
            symptoms = json.loads(match.group())
            if isinstance(symptoms, list) and 4 <= len(symptoms) <= 6:
                return [str(s).strip() for s in symptoms]
        except json.JSONDecodeError:
            pass

    # Fallback: extract numbered or bulleted list items
    lines = [
        re.sub(r"^[\s\-\*\d\.]+", "", line).strip()
        for line in text.splitlines()
        if re.match(r"^[\s\-\*\d\.]", line) and len(line.strip()) > 3
    ]
    if len(lines) >= 4:
        return lines[:6]

    raise ValueError("Could not parse symptoms from model response")


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.post("/api/generate-checklist")
async def generate_checklist(data: InitialInput):
    template = """The user reported this vague medical issue: "{user_input}"

Generate a list of exactly 4 to 6 specific, related symptoms the user might be experiencing.
Use simple, patient-friendly language. DO NOT diagnose or list severe diseases.

Respond with ONLY a valid JSON array of strings, no explanation. Example:
["Stomach pain or cramping", "Nausea or feeling like vomiting", "Loss of appetite", "Dizziness or lightheadedness"]
"""
    prompt = PromptTemplate(input_variables=["user_input"], template=template)
    chain = prompt | get_llm()

    try:
        result = await chain.ainvoke({"user_input": data.user_text})
        symptoms = extract_symptoms_from_text(result.content)
    except (GroqAPIError, ValidationError) as exc:
        raise provider_error() from exc
    except ValueError as exc:
        logger.exception("Failed to parse symptom list from model output")
        raise HTTPException(status_code=502, detail="Could not parse symptoms. Please try again.") from exc

    return {"symptoms": symptoms}


@app.post("/api/generate-summary")
async def generate_summary(data: SummaryInput):
    template = """You are a clinical data-gathering assistant.
The patient has confirmed the following symptoms: {symptoms}
Additional context: {notes}

Generate a highly structured 'Pre-Consultation Summary' for a doctor.
Use professional medical terminology for the doctor, but DO NOT provide a diagnosis.

Structure the response with exactly these headers:
1. Chief Complaint (Brief summary)
2. Symptom Details (List what the patient confirmed)
3. Recommended Questions for the Doctor (2-3 questions the patient should ask the doctor)
"""
    prompt = PromptTemplate(input_variables=["symptoms", "notes"], template=template)
    chain = prompt | get_llm()

    symptom_string = ", ".join(data.selected_symptoms)
    try:
        result = await chain.ainvoke(
            {"symptoms": symptom_string, "notes": data.additional_notes}
        )
    except (GroqAPIError, ValidationError) as exc:
        raise provider_error() from exc

    return {"summary": result.content}