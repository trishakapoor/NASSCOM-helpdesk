export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function calculateF1(predictions: string[], labels: string[], categories: string[]) {
  const metrics: Record<string, any> = {};
  let totalTP = 0, totalFP = 0, totalFN = 0;

  for (const cat of categories) {
    let tp = 0, fp = 0, fn = 0;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === cat && labels[i] === cat) tp++;
      if (predictions[i] === cat && labels[i] !== cat) fp++;
      if (predictions[i] !== cat && labels[i] === cat) fn++;
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    metrics[cat] = { precision: precision.toFixed(4), recall: recall.toFixed(4), f1: f1.toFixed(4), tp, fp, fn };
    totalTP += tp;
    totalFP += fp;
    totalFN += fn;
  }

  // Macro F1
  const macroF1 = Object.values(metrics).reduce((sum, m) => sum + parseFloat(m.f1), 0) / categories.length;
  
  // Micro F1
  const microPrecision = totalTP / (totalTP + totalFP) || 0;
  const microRecall = totalTP / (totalTP + totalFN) || 0;
  const microF1 = microPrecision + microRecall > 0 ? 2 * (microPrecision * microRecall) / (microPrecision + microRecall) : 0;

  return { perCategory: metrics, macroF1: macroF1.toFixed(4), microF1: microF1.toFixed(4) };
}
