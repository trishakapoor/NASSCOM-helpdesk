import { cosineSimilarity, calculateF1 } from "../lib/eval-utils";

describe("eval-utils", () => {
  describe("cosineSimilarity", () => {
    it("should calculate similarity between two identical vectors as 1", () => {
      expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    });

    it("should calculate similarity between orthogonal vectors as 0", () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    });

    it("should calculate similarity between opposite vectors as -1", () => {
      expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1);
    });

    it("should correctly calculate for non-trivial vectors", () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    });
  });

  describe("calculateF1", () => {
    it("should correctly classify perfectly matching predictions", () => {
      const preds = ["A", "B", "C"];
      const labels = ["A", "B", "C"];
      const cats = ["A", "B", "C"];

      const result = calculateF1(preds, labels, cats);
      expect(result.macroF1).toBe("1.0000");
      expect(result.microF1).toBe("1.0000");
    });

    it("should calculate F1 correctly with some mismatches", () => {
      const preds = ["A", "A", "B"];
      const labels = ["A", "B", "B"];
      const cats = ["A", "B"];
      
      const result = calculateF1(preds, labels, cats);
      
      // Cat A: TP=1 (idx 0), FP=1 (idx 1), FN=0
      // Cat B: TP=1 (idx 2), FP=0, FN=1 (idx 1 predicted A, should be B)

      // Prec A = 1/2 = 0.5, Rec A = 1/1 = 1.0 -> F1 A = 2 * 0.5 * 1.0 / 1.5 = 0.6667
      // Prec B = 1/1 = 1.0, Rec B = 1/2 = 0.5 -> F1 B = 2 * 1.0 * 0.5 / 1.5 = 0.6667
      
      expect(result.perCategory["A"].f1).toBe("0.6667");
      expect(result.perCategory["B"].f1).toBe("0.6667");
      expect(result.macroF1).toBe("0.6667");
    });
  });
});
