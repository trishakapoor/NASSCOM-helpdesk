from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from setfit import SetFitModel
import json
import os

app = FastAPI(title="Ticket Classifier ML API", version="1.0.0")

# Load Model
MODEL_DIR = "./setfit_model"

try:
    if os.path.exists(MODEL_DIR):
        print(f"Loading SetFit model from {MODEL_DIR}...")
        model = SetFitModel.from_pretrained(MODEL_DIR)
        with open(f"{MODEL_DIR}/categories.json", 'r') as f:
            id2cat = json.load(f)
    else:
        # Fallback if model hasn't been trained yet
        print("Warning: Custom model not found. API will return fallback values.")
        model = None
        id2cat = {}
except Exception as e:
    print(f"Error loading model: {e}")
    model = None
    id2cat = {}

class PredictRequest(BaseModel):
    text: str

class PredictResponse(BaseModel):
    category: str
    confidence_score: float

@app.get("/health")
def health():
    return {"status": "healthy", "model_loaded": model is not None}

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if model is None:
        return PredictResponse(category="Infrastructure", confidence_score=0.5)

    try:
        # Get probability distribution
        probas = model.predict_proba([req.text])[0]
        
        # Get top class
        max_idx = probas.argmax().item()
        max_prob = probas[max_idx].item()
        
        category_name = id2cat.get(str(max_idx)) or id2cat.get(max_idx) or "Unknown"

        return PredictResponse(
            category=category_name,
            confidence_score=round(max_prob, 4)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
