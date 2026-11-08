import { useState } from 'react';

async function postJson(path, body, fallbackMessage) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `${fallbackMessage} (server returned ${response.status}).`,
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error("The server returned an invalid response. Check the deployed API setup.");
  }

  return data;
}

export default function App() {
  const [step, setStep] = useState(1);
  const [initialText, setInitialText] = useState("");
  const [checklist, setChecklist] = useState([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [finalSummary, setFinalSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerateChecklist = async () => {
    if (!initialText.trim()) {
      setError("Describe how you are feeling before continuing.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await postJson(
        "/api/generate-checklist",
        { user_text: initialText.trim() },
        "Unable to generate a symptom checklist",
      );
      if (!Array.isArray(data.symptoms)) {
        throw new Error("The server returned an invalid symptom checklist.");
      }

      setChecklist(data.symptoms);
      setSelectedSymptoms([]);
      setStep(2);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSymptom = (symptom) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleGenerateSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await postJson(
        "/api/generate-summary",
        {
          selected_symptoms: selectedSymptoms,
          additional_notes: initialText,
        },
        "Unable to generate the doctor summary",
      );
      if (typeof data.summary !== "string") {
        throw new Error("The server returned an invalid doctor summary.");
      }

      setFinalSummary(data.summary);
      setStep(3);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '30px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <h1 style={{ color: '#2563eb', margin: '0 0 5px 0' }}>🩺 PatientScribe</h1>
      <p style={{ color: '#6b7280', margin: '0 0 30px 0' }}>Organize your symptoms before your doctor's visit.</p>

      {error && (
        <p role="alert" style={{ color: '#b91c1c', backgroundColor: '#fef2f2', padding: '12px', borderRadius: '8px' }}>
          {error}
        </p>
      )}

      {step === 1 && (
        <div>
          <h3 style={{ marginBottom: '10px' }}>How are you feeling today?</h3>
          <textarea 
            value={initialText}
            onChange={(e) => setInitialText(e.target.value)}
            placeholder="e.g. My stomach hurts and I feel dizzy..."
            style={{ width: '100%', height: '120px', padding: '15px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', fontSize: '16px' }}
          />
          <button 
            onClick={handleGenerateChecklist} 
            disabled={loading || !initialText.trim()}
            style={{ padding: '12px 24px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', width: '100%' }}>
            {loading ? "Analyzing..." : "Next"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 style={{ marginBottom: '15px' }}>Do you have any of these specific symptoms?</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '25px' }}>
            {checklist.map((symptom, idx) => (
              <label key={idx} style={{ padding: '15px', border: '1px solid #e5e7eb', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', backgroundColor: selectedSymptoms.includes(symptom) ? '#eff6ff' : 'white' }}>
                <input 
                  type="checkbox" 
                  checked={selectedSymptoms.includes(symptom)}
                  onChange={() => handleToggleSymptom(symptom)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '16px' }}>{symptom}</span>
              </label>
            ))}
          </div>
          <button 
            onClick={handleGenerateSummary} 
            disabled={loading || selectedSymptoms.length === 0}
            style={{ padding: '12px 24px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', width: '100%' }}>
            {loading ? "Creating Summary..." : "Generate Doctor Summary"}
          </button>
        </div>
      )}

      {step === 3 && (
        <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ marginTop: 0, color: '#111827' }}>📋 Pre-Consultation Summary</h3>
          <hr style={{ borderColor: '#e5e7eb', margin: '15px 0' }} />
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: '1.6', fontSize: '15px', color: '#374151' }}>
            {finalSummary}
          </pre>
          <div style={{ marginTop: '25px', padding: '15px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <p style={{ fontSize: '13px', color: '#dc2626', margin: 0, lineHeight: '1.4' }}>
              <strong>Disclaimer:</strong> PatientScribe is an AI tool to help organize your thoughts. It does not provide medical advice, triage, or diagnosis. Always hand this summary to a qualified doctor.
            </p>
          </div>
          <button 
            onClick={() => {
              setStep(1);
              setInitialText("");
              setSelectedSymptoms([]);
              setChecklist([]);
              setFinalSummary("");
              setError("");
            }}
            style={{ marginTop: '20px', padding: '12px 24px', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', width: '100%' }}>
            Start New Session
          </button>
        </div>
      )}
    </div>
  );
}
