import pandas as pd
import numpy as np
import json
import os
from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA

def generate_viz():
    print("Loading dataset...")
    file_path = '../data/synthetic_tickets_llm.csv'
    if not os.path.exists(file_path):
        file_path = '../data/synthetic_tickets.csv'
    df = pd.read_csv(file_path)

    # Take a sample for performance in the browser (e.g. 500 tickets)
    if len(df) > 500:
        df = df.sample(n=500, random_state=42).reset_index(drop=True)

    df['text'] = df['title'] + " " + df['description']
    
    print("Loading embedding model (BAAI/bge-small-en-v1.5)...")
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    
    print("Generating embeddings...")
    X = model.encode(df['text'].tolist(), normalize_embeddings=True)

    print("Running PCA to reduce 384D to 3D...")
    pca = PCA(n_components=3, random_state=42)
    X_3d = pca.fit_transform(X)

    print("Exporting Viz Data to JSON...")
    
    # Group by category for easier plotting
    export_data = {}
    categories = df['category'].unique()
    
    for cat in categories:
        idx = df['category'] == cat
        cat_points = X_3d[idx]
        cat_titles = df.loc[idx, 'title'].tolist()
        
        export_data[cat] = {
            "x": cat_points[:, 0].tolist(),
            "y": cat_points[:, 1].tolist(),
            "z": cat_points[:, 2].tolist(),
            "titles": cat_titles
        }

    output_path = '../data/viz_data.json'
    with open(output_path, 'w') as f:
        json.dump(export_data, f)
        
    print(f"✅ Viz data exported successfully to {output_path}")

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    generate_viz()
