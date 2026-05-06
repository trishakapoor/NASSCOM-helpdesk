export function regexRedact(text: string): string {
  let out = text;
  out = out.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED_IP]');
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');
  out = out.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
  out = out.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
  // Credit card patterns
  out = out.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_CARD]');
  // Aadhaar number (Indian 12-digit)
  out = out.replace(/\b\d{4}\s\d{4}\s\d{4}\b/g, '[REDACTED_AADHAAR]');
  return out;
}

export function rerank(docs: any[], query: string): any[] {
  // Score boosting based on keyword overlap + original similarity
  const queryTokens = new Set(query.toLowerCase().split(/\s+/).filter(t => t.length > 3));

  return docs
    .map(doc => {
      const docTokens = new Set((doc.sanitized_query || '').toLowerCase().split(/\s+/));
      let overlapCount = 0;
      for (const token of queryTokens) {
        if (docTokens.has(token)) overlapCount++;
      }
      const keywordBoost = queryTokens.size > 0 ? overlapCount / queryTokens.size : 0;
      const rerankScore = (doc.similarity || 0) * 0.7 + keywordBoost * 0.3;
      return { ...doc, rerankScore };
    })
    .sort((a, b) => b.rerankScore - a.rerankScore);
}

export function checkGrounding(resolution: string, context: string): { isGrounded: boolean; groundingScore: number } {
  if (!context || context.length < 20) {
    return { isGrounded: false, groundingScore: 0 };
  }

  const resTokens = new Set(resolution.toLowerCase().split(/\s+/).filter(t => t.length > 3));
  const ctxTokens = new Set(context.toLowerCase().split(/\s+/).filter(t => t.length > 3));

  let overlap = 0;
  for (const token of resTokens) {
    if (ctxTokens.has(token)) overlap++;
  }

  const groundingScore = resTokens.size > 0 ? overlap / resTokens.size : 0;
  return {
    isGrounded: groundingScore > 0.2,
    groundingScore: parseFloat(groundingScore.toFixed(3))
  };
}
