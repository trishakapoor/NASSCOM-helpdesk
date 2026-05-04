import pandas as pd
from setfit import SetFitModel, SetFitTrainer, sample_dataset
from sentence_transformers.losses import CosineSimilarityLoss
from datasets import Dataset

# Load synthetic dataset
print("Loading dataset...")
df = pd.read_csv('../data/synthetic_tickets_llm.csv')
if df.empty:
    df = pd.read_csv('../data/synthetic_tickets.csv')

# Map categories to integer labels
categories = df['category'].unique().tolist()
cat2id = {c: i for i, c in enumerate(categories)}
id2cat = {i: c for c, i in cat2id.items()}

df['label'] = df['category'].map(cat2id)
df['text'] = df['title'] + " " + df['description']

# Convert to Hugging Face Dataset
dataset = Dataset.from_pandas(df[['text', 'label']])

# Load SetFit model (using bge-small)
print("Loading SetFit model (BAAI/bge-small-en-v1.5)...")
model = SetFitModel.from_pretrained("BAAI/bge-small-en-v1.5")

# Trainer setup
trainer = SetFitTrainer(
    model=model,
    train_dataset=dataset,
    loss_class=CosineSimilarityLoss,
    metric="accuracy",
    batch_size=16,
    num_iterations=20, # The number of text pairs to generate for contrastive learning
    num_epochs=1,
)

# Train and save
print("Training model via Contrastive Learning...")
trainer.train()

print("Saving custom weights...")
model.save_pretrained("./setfit_model")
import json
with open('./setfit_model/categories.json', 'w') as f:
    json.dump(id2cat, f)

print("Done! Model saved to ./setfit_model")
