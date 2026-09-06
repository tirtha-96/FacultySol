import type {
  Analysis,
  AnalysisSettings,
  Assessment,
  BloomLevel,
  ComponentKey,
  Difficulty,
  Question,
  Recommendation,
} from "./types.js";
export const DEFAULT_SETTINGS: AnalysisSettings = {
  weights: {
    cloAlignment: 0.2,
    topicCoverage: 0.17,
    difficultyBalance: 0.13,
    bloomDistribution: 0.15,
    questionDiversity: 0.1,
    historicalSimilarity: 0.15,
    markDistribution: 0.1,
  },
  desiredBloom: {
    Remember: 0.1,
    Understand: 0.2,
    Apply: 0.25,
    Analyze: 0.25,
    Evaluate: 0.1,
    Create: 0.1,
    Unknown: 0,
  },
  desiredDifficulty: { Easy: 0.2, Moderate: 0.6, Hard: 0.2, Unknown: 0 },
  similarityModerate: 0.5,
  similarityHigh: 0.75,
};
const round = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.max(0, Math.min(100, n));
export const leafQuestions = (qs: Question[]) =>
  qs.filter((q) => q.isLeaf !== false && !qs.some((c) => c.parentId === q.id));
export function marksSummary(qs: Question[]) {
  const leaf = leafQuestions(qs);
  return {
    total: leaf.reduce((s, q) => s + (q.marks ?? 0), 0),
    unknown: leaf.filter((q) => q.marks == null).length,
  };
}
export function marksDistribution<T extends string>(
  qs: Question[],
  pick: (q: Question) => T,
  keys: readonly T[],
): Record<T, number> {
  const leaf = leafQuestions(qs),
    total = leaf.reduce((s, q) => s + (q.marks ?? 0), 0) || 1;
  return Object.fromEntries(
    keys.map((k) => [
      k,
      round(
        (leaf
          .filter((q) => pick(q) === k)
          .reduce((s, q) => s + (q.marks ?? 0), 0) /
          total) *
          100,
      ),
    ]),
  ) as Record<T, number>;
}
export function targetFit(
  actual: Record<string, number>,
  target: Record<string, number>,
): number {
  const d = Object.keys(target).reduce(
    (s, k) => s + Math.abs((actual[k] ?? 0) / 100 - target[k]),
    0,
  );
  return round(clamp(100 - d * 55));
}
export function similarityBand(score: number, s = DEFAULT_SETTINGS) {
  return score >= s.similarityHigh
    ? "High"
    : score >= s.similarityModerate
      ? "Moderate"
      : "Low";
}
export function weightedScore(
  c: Partial<Record<ComponentKey, number>>,
  w: Record<ComponentKey, number>,
) {
  const a = Object.entries(c).filter(
      (x): x is [ComponentKey, number] => typeof x[1] === "number",
    ),
    t = a.reduce((s, [k]) => s + w[k], 0);
  return t ? Math.round(a.reduce((s, [k, v]) => s + v * w[k], 0) / t) : 0;
}
function recommendations(
  a: Assessment,
  d: { clos: Record<string, number> },
  s: AnalysisSettings,
  historical: boolean,
): Recommendation[] {
  const out: Recommendation[] = [];
  for (const code of a.scope?.cloCodes ?? a.course.clos.map((c) => c.code)) {
    if ((d.clos[code] ?? 0) === 0) {
      const clo = a.course.clos.find((c) => c.code === code);
      const evidenceRef = a.sources
        ?.filter((source) => source.kind === "syllabus")
        .flatMap((source) => source.locators)
        .find((ref) =>
          ref.excerpt
            .replace(/\s+/g, " ")
            .includes(clo?.description.replace(/\s+/g, " ") ?? "__none__"),
        );
      out.push({
        id: `coverage-${code}`,
        type: "coverage",
        severity: "high",
        title: `${code} is uncovered in the selected scope`,
        reason: `No offered marks currently map to ${code}.`,
        evidence: clo?.description ?? "No syllabus description is available.",
        evidenceRefs: evidenceRef ? [evidenceRef] : [],
        uncertainty: "Coverage uses the confirmed primary outcome mapping.",
        impact:
          "This in-scope outcome is not sampled by the offered questions.",
        action: "Revise or add a question for this outcome.",
        targetQuestionId:
          a.questions.find((q) => q.similarity?.kind === "near-identical")
            ?.id ?? a.questions[0]?.id,
        status: "pending",
      });
    }
  }
  const sim = a.questions.find(
    (q) =>
      q.similarity?.kind !== "shared-topic" &&
      (q.similarity?.score ?? 0) >= s.similarityModerate,
  );
  if (historical && sim)
    out.push({
      id: `similarity-${sim.id}`,
      type: "similarity",
      severity:
        (sim.similarity?.score ?? 0) >= s.similarityHigh ? "high" : "medium",
      title: `Review historical overlap for ${sim.number}`,
      reason: sim.similarity!.reason,
      evidence: `Current: “${sim.text}” Previous: “${sim.similarity!.previous.text}”`,
      evidenceRefs: sim.similarity?.evidence,
      impact: "The task may be predictable even when wording differs.",
      action:
        "Compare both tasks and revise only if the overlap is unintended.",
      targetQuestionId: sim.id,
      status: "pending",
    });
  const ambiguous = a.questions.find((q) =>
    q.concerns.some((c) => /unclear|ambiguous|missing assumption/i.test(c)),
  );
  if (ambiguous)
    out.push({
      id: `wording-${ambiguous.id}`,
      type: "wording",
      severity: "medium",
      title: `Clarify ${ambiguous.number}`,
      reason: ambiguous.concerns[0],
      evidence: ambiguous.text,
      evidenceRefs: ambiguous.sourceRef ? [ambiguous.sourceRef] : [],
      impact: "Students may interpret the required work differently.",
      action: "Make the inputs and expected output explicit.",
      targetQuestionId: ambiguous.id,
      status: "pending",
    });
  const ms = marksSummary(a.questions);
  if (ms.unknown || (a.totalMarks != null && ms.total !== a.totalMarks))
    out.push({
      id: "marks-check",
      type: "marks",
      severity: "medium",
      title: "Reconcile question marks",
      reason: ms.unknown
        ? `${ms.unknown} leaf question(s) have unknown marks.`
        : `Leaf marks total ${ms.total}, but the paper states ${a.totalMarks}.`,
      evidence:
        "Totals use leaf question parts only; parent subtotals are excluded.",
      impact:
        "Required-attempt totals and allocation charts may be incomplete.",
      action: "Edit marks and confirm any choice rule.",
      status: "pending",
    });
  return out;
}
export function analyzeAssessment(
  a: Assessment,
  s = DEFAULT_SETTINGS,
  version = 1,
  mode: Analysis["generatedBy"] = "demo-fixture",
): Analysis {
  const qs = leafQuestions(a.questions),
    cloKeys = [...new Set([...a.course.clos.map((x) => x.code), "Unknown"])],
    topicKeys = [
      ...new Set([...a.course.topics.map((x) => x.name), "Unknown"]),
    ],
    bk: BloomLevel[] = [
      "Remember",
      "Understand",
      "Apply",
      "Analyze",
      "Evaluate",
      "Create",
      "Unknown",
    ],
    dk: Difficulty[] = ["Easy", "Moderate", "Hard", "Unknown"];
  const clos = marksDistribution(qs, (q) => q.cloCode || "Unknown", cloKeys),
    topics = marksDistribution(qs, (q) => q.topic || "Unknown", topicKeys),
    bloom = marksDistribution(qs, (q) => q.bloom, bk),
    difficulty = marksDistribution(qs, (q) => q.difficulty, dk),
    ms = marksSummary(qs),
    historical =
      !!a.sources?.some((x) => x.kind === "historical-exam") ||
      qs.some((q) => q.similarity);
  const c: Partial<Record<ComponentKey, number>> = {};
  if (a.totalMarks != null)
    c.markDistribution = round(
      clamp(100 - Math.abs(ms.total - a.totalMarks) * 5 - ms.unknown * 20),
    );
  const ct = Object.fromEntries(
    a.course.clos
      .filter((x) => x.targetWeight != null)
      .map((x) => [x.code, x.targetWeight!]),
  );
  if (Object.keys(ct).length) c.cloAlignment = targetFit(clos, ct);
  const tt = Object.fromEntries(
    a.course.topics
      .filter((x) => x.targetWeight != null)
      .map((x) => [x.name, x.targetWeight!]),
  );
  if (Object.keys(tt).length) c.topicCoverage = targetFit(topics, tt);
  if (s.desiredBloom)
    c.bloomDistribution = targetFit(
      bloom,
      s.desiredBloom as Record<string, number>,
    );
  if (s.desiredDifficulty)
    c.difficultyBalance = targetFit(
      difficulty,
      s.desiredDifficulty as Record<string, number>,
    );
  if (historical) {
    const warned = qs.filter(
      (q) =>
        q.similarity?.kind !== "shared-topic" &&
        (q.similarity?.score ?? 0) >= s.similarityModerate,
    );
    c.questionDiversity = round(
      clamp(100 - (warned.length / Math.max(qs.length, 1)) * 120),
    );
    const risk =
      qs.reduce(
        (sum, q) =>
          sum +
          (q.similarity?.kind === "shared-topic"
            ? 0
            : (q.similarity?.score ?? 0)) *
            (q.marks ?? 0),
        0,
      ) / (ms.total || 1);
    c.historicalSimilarity = round(clamp(100 - risk * 105));
  }
  const score = Object.keys(c).length ? weightedScore(c, s.weights) : null,
    r = recommendations(a, { clos }, s, historical);
  return {
    version,
    overallScore: score,
    label: "Experimental indicator",
    components: c,
    weights: s.weights,
    cloDistribution: clos,
    topicDistribution: topics,
    bloomDistribution: bloom,
    difficultyDistribution: difficulty,
    totalMarks: ms.total,
    unknownMarks: ms.unknown,
    questions: qs,
    recommendations: r,
    strengths: [
      ms.unknown === 0
        ? "All known leaf marks are included"
        : "Unknown marks remain visible",
      "Faculty mappings remain editable",
    ],
    summary: `${r.length} unresolved finding${r.length === 1 ? "" : "s"} across ${qs.length} confirmed question parts.`,
    generatedBy: mode,
    historicalStatus: historical ? "assessed" : "not-assessed",
    limitations: [
      !historical
        ? "Historical similarity: Not assessed because no historical paper was supplied."
        : "Similarity scores are review indicators, not copying probabilities.",
      a.choiceRule
        ? "Coverage is offered-question coverage; guaranteed coverage across choices is not calculated."
        : "No choice rule was supplied.",
    ],
  };
}
