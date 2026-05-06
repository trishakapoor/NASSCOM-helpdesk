import pandas as pd
import numpy as np
import json
import os
from sentence_transformers import SentenceTransformer
from sklearn.linear_model import LogisticRegression

def train():
    print("Loading dataset...")
    file_path = '../data/synthetic_tickets_llm.csv'
    if not os.path.exists(file_path):
        file_path = '../data/synthetic_tickets.csv'
    df = pd.read_csv(file_path)

    df['text'] = df['title'] + " " + df['description']
    
    # Map categories to integer labels
    categories = df['category'].unique().tolist()
    cat2id = {c: i for i, c in enumerate(categories)}
    id2cat = {i: c for c, i in cat2id.items()}
    y = df['category'].map(cat2id).values

    print("Loading embedding model (BAAI/bge-small-en-v1.5)...")
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    
    print("Generating embeddings for training data (this may take a minute)...")
    X = model.encode(df['text'].tolist(), normalize_embeddings=True)

    print("Training Advanced Logistic Regression Classifier (C=100.0)...")
    # C=100.0 reduces regularization, resulting in sharper/higher confidence probabilities
    clf = LogisticRegression(C=100.0, class_weight='balanced', max_iter=2000, multi_class='multinomial')
    clf.fit(X, y)

    score = clf.score(X, y)
    print(f"Training Accuracy: {score:.4f}")

    # ═══════════════════════════════════════════════════════════
    # Export 1: JSON Weights (Legacy fallback for Vercel)
    # ═══════════════════════════════════════════════════════════
    print("Exporting Weights and Intercepts to JSON...")
    weights = clf.coef_.tolist()
    intercepts = clf.intercept_.tolist()

    export_data = {
        "classes": categories,
        "weights": weights,
        "intercepts": intercepts
    }

    output_path = '../data/lr_model.json'
    with open(output_path, 'w') as f:
        json.dump(export_data, f)
        
    print(f"[OK] JSON weights exported to {output_path}")

    # ═══════════════════════════════════════════════════════════
    # Export 2: ONNX Model (C++ accelerated inference)
    # ═══════════════════════════════════════════════════════════
    try:
        from skl2onnx import convert_sklearn
        from skl2onnx.common.data_types import FloatTensorType

        print("Exporting Model to ONNX...")
        # Define the input shape: 1 sample, 384 dimensions (from bge-small)
        initial_type = [('float_input', FloatTensorType([None, 384]))]
        onnx_model = convert_sklearn(clf, initial_types=initial_type, target_opset=12)

        onnx_output = '../public/models/classifier.onnx'
        os.makedirs(os.path.dirname(onnx_output), exist_ok=True)
        with open(onnx_output, "wb") as f:
            f.write(onnx_model.SerializeToString())

        print(f"[OK] ONNX model exported to {onnx_output}")

        # Also export the class mapping for the ONNX session
        class_map_path = '../public/models/class_map.json'
        with open(class_map_path, 'w') as f:
            json.dump({"classes": categories, "id2cat": id2cat}, f)
        print(f"[OK] Class mapping exported to {class_map_path}")

    except ImportError:
        print("[WARN] skl2onnx not installed. Skipping ONNX export.")
        print("  Install with: pip install skl2onnx onnxruntime")

if __name__ == "__main__":
    # Ensure run from the scripts dir
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    train()
