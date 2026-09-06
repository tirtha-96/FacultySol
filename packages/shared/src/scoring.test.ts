import { describe, expect, it } from "vitest";
import {
  analyzeAssessment,
  DEFAULT_SETTINGS,
  marksDistribution,
  marksSummary,
  similarityBand,
  weightedScore,
} from "./scoring";
import { demoAssessment, improvedDemoAssessment } from "./demo";

describe("deterministic assessment engine", () => {
  it("aggregates marks into CLO coverage", () =>
    expect(
      marksDistribution(demoAssessment.questions, (q) => q.cloCode, [
        "CLO-1",
        "CLO-2",
        "CLO-3",
        "CLO-4",
      ])["CLO-3"],
    ).toBe(0));
  it("aggregates Bloom and difficulty by marks", () => {
    const a = analyzeAssessment(demoAssessment);
    expect(a.bloomDistribution.Remember).toBe(13);
    expect(a.difficultyDistribution.Hard).toBe(7);
  });
  it("uses configurable similarity thresholds", () => {
    expect(similarityBand(0.76)).toBe("High");
    expect(similarityBand(0.6)).toBe("Moderate");
    expect(similarityBand(0.3)).toBe("Low");
  });
  it("reconciles total marks", () =>
    expect(analyzeAssessment(demoAssessment).totalMarks).toBe(100));
  it("calculates the score from components and weights", () => {
    const a = analyzeAssessment(demoAssessment);
    expect(a.overallScore).toBe(
      weightedScore(a.components, DEFAULT_SETTINGS.weights),
    );
  });
  it("improves after faculty-approved revisions", () =>
    expect(
      analyzeAssessment(improvedDemoAssessment(), DEFAULT_SETTINGS, 2)
        .overallScore ?? 0,
    ).toBeGreaterThan(analyzeAssessment(demoAssessment).overallScore ?? 0));
  it("counts leaf subparts without double-counting a parent subtotal", () => {
    const qs = [
      {
        ...demoAssessment.questions[0],
        id: "parent",
        marks: 10,
        isLeaf: false,
      },
      {
        ...demoAssessment.questions[0],
        id: "child-a",
        parentId: "parent",
        marks: 4,
      },
      {
        ...demoAssessment.questions[0],
        id: "child-b",
        parentId: "parent",
        marks: 6,
      },
    ];
    expect(marksSummary(qs).total).toBe(10);
  });
  it("keeps unknown marks and mappings visible", () => {
    const a = structuredClone(demoAssessment);
    a.questions[0].marks = null;
    a.questions[0].cloCode = "Unknown";
    const result = analyzeAssessment(a);
    expect(result.unknownMarks).toBe(1);
    expect(result.cloDistribution.Unknown).toBeGreaterThan(0);
  });
  it("reports choice coverage as offered rather than guaranteed", () => {
    const a = { ...demoAssessment, choiceRule: { answerAny: 2, offered: 3 } };
    expect(analyzeAssessment(a).limitations?.join(" ")).toContain(
      "offered-question coverage",
    );
  });
});
