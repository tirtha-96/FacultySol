import { describe, expect, it } from "vitest";
import { demoAssessment } from "@assessai/shared";
import {
  inputHash,
  normalizeEvidence,
  parseQuestions,
  validateAndApplyModel,
} from "./analysis";
describe("analysis safety boundary", () => {
  it("parses unknown marks without inventing them", () => {
    const q = parseQuestions(
      "1. Explain queues\n2(a) Analyze a trace (8 marks)",
      "src",
    );
    expect(q).toHaveLength(2);
    expect(q[0].marks).toBeNull();
    expect(q[1].marks).toBe(8);
  });
  it("normalizes whitespace for exact quote validation and rejects invented evidence", () => {
    expect(normalizeEvidence("a\n  b")).toBe("a b");
    const a = structuredClone(demoAssessment);
    a.questions[0].sourceRef = undefined;
    validateAndApplyModel(a, {
      questions: [
        {
          id: "q1",
          cloCode: "CLO-1",
          topic: "Arrays",
          bloom: "Understand",
          difficulty: "Moderate",
          confidence: 0.5,
          concerns: [],
          explanation: "x",
          evidence: [
            { sourceId: "sample-syllabus", excerpt: "invented quotation" },
          ],
        },
      ],
    });
    expect(a.questions[0].sourceRef).toBeUndefined();
  });
  it("hash changes for a faculty paper edit so stale responses cannot be saved", () => {
    const a = structuredClone(demoAssessment),
      before = inputHash(a);
    a.questions[0].text += " changed";
    expect(inputHash(a)).not.toBe(before);
  });
});
