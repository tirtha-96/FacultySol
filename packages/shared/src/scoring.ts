import type { Analysis, AnalysisSettings, Assessment, BloomLevel, ComponentKey, Difficulty, Question, Recommendation } from './types.js';

export const DEFAULT_SETTINGS: AnalysisSettings = {
  weights: { cloAlignment: .2, topicCoverage: .17, difficultyBalance: .13, bloomDistribution: .15, questionDiversity: .1, historicalSimilarity: .15, markDistribution: .1 },
  desiredBloom: { Remember: .1, Understand: .2, Apply: .25, Analyze: .25, Evaluate: .1, Create: .1 },
  desiredDifficulty: { Easy: .2, Moderate: .6, Hard: .2 },
  similarityModerate: .5,
  similarityHigh: .75,
};

const round = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function marksDistribution<T extends string>(questions: Question[], pick: (q: Question) => T, keys: readonly T[]): Record<T, number> {
  const total = questions.reduce((sum, q) => sum + q.marks, 0) || 1;
  return Object.fromEntries(keys.map(key => [key, round(questions.filter(q => pick(q) === key).reduce((s, q) => s + q.marks, 0) / total * 100)])) as Record<T, number>;
}

export function targetFit(actual: Record<string, number>, target: Record<string, number>): number {
  const deviation = Object.keys(target).reduce((sum, key) => sum + Math.abs((actual[key] ?? 0) / 100 - target[key]), 0);
  return round(clamp(100 - deviation * 55));
}

export function similarityBand(score: number, settings = DEFAULT_SETTINGS) {
  return score >= settings.similarityHigh ? 'High' : score >= settings.similarityModerate ? 'Moderate' : 'Low';
}

export function weightedScore(components: Record<ComponentKey, number>, weights: Record<ComponentKey, number>) {
  const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0);
  return Math.round(Object.entries(components).reduce((sum, [key, value]) => sum + value * weights[key as ComponentKey], 0) / weightTotal);
}

function recommendations(assessment: Assessment, distributions: { clos: Record<string, number>; topics: Record<string, number>; bloom: Record<BloomLevel, number>; difficulty: Record<Difficulty, number> }, settings: AnalysisSettings): Recommendation[] {
  const items: Recommendation[] = [];
  const underClo = assessment.course.clos.find(c => (distributions.clos[c.code] ?? 0) < c.targetWeight * 100 - 8);
  if (underClo) items.push({ id: 'rec-clo', severity: 'high', title: `Strengthen ${underClo.code} assessment`, reason: 'The mark share is materially below the faculty-configured target.', evidence: `${underClo.code} receives ${distributions.clos[underClo.code] ?? 0}% of marks against a ${underClo.targetWeight * 100}% target.`, impact: 'Students may pass without demonstrating this intended learning outcome.', action: 'Add or revise a design-oriented question worth 8–12 marks.', status: 'pending' });
  const similar = assessment.questions.filter(q => q.similarity && q.similarity.score >= settings.similarityHigh);
  if (similar.length) items.push({ id: 'rec-similarity', severity: 'high', title: `Review ${similar.length} historically similar question${similar.length > 1 ? 's' : ''}`, reason: 'Semantic overlap is above the configured review threshold.', evidence: similar.map(q => `${q.number}: ${Math.round(q.similarity!.score * 100)}% similar to ${q.similarity!.previous.year}`).join(' · '), impact: 'Repeated constructs may reduce question diversity and predictability safeguards.', action: 'Compare the matched questions and replace one while preserving its intended CLO.', targetQuestionId: similar[0].id, status: 'pending' });
  const higherOrder = distributions.bloom.Analyze + distributions.bloom.Evaluate + distributions.bloom.Create;
  if (higherOrder < 35) items.push({ id: 'rec-bloom', severity: 'medium', title: 'Increase higher-order cognitive demand', reason: 'Analyze, Evaluate, and Create questions occupy a limited share of marks.', evidence: `Higher-order levels account for ${round(higherOrder)}% of assessment marks.`, impact: 'The paper may emphasize recall and explanation over judgment and design.', action: 'Reframe one recall question around a scenario requiring analysis or design.', status: 'pending' });
  const weakTopic = assessment.course.topics.find(t => (distributions.topics[t.name] ?? 0) < t.targetWeight * 100 - 8);
  if (weakTopic) items.push({ id: 'rec-topic', severity: 'medium', title: `Review ${weakTopic.name} coverage`, reason: 'Coverage differs from the syllabus weighting configured for this course.', evidence: `${weakTopic.name} receives ${distributions.topics[weakTopic.name] ?? 0}% of marks against a ${weakTopic.targetWeight * 100}% target.`, impact: 'Important course content may be sampled too lightly.', action: 'Rebalance marks or document the intentional weighting choice.', status: 'pending' });
  const markConcern = assessment.questions.find(q => q.concerns.some(c => c.toLowerCase().includes('marks')));
  if (markConcern) items.push({ id: 'rec-marks', severity: 'low', title: `Validate marks for Question ${markConcern.number}`, reason: 'The assigned marks may not match the apparent task depth.', evidence: `${markConcern.marks} marks are allocated to a ${markConcern.bloom.toLowerCase()}-level prompt.`, impact: 'Students may receive disproportionate time or credit for the demonstrated skill.', action: 'Confirm the expected response depth or adjust the allocation.', targetQuestionId: markConcern.id, status: 'pending' });
  return items;
}

export function analyzeAssessment(assessment: Assessment, settings = DEFAULT_SETTINGS, version = 1): Analysis {
  const q = assessment.questions;
  const clos = marksDistribution(q, x => x.cloCode, assessment.course.clos.map(x => x.code));
  const topics = marksDistribution(q, x => x.topic, assessment.course.topics.map(x => x.name));
  const bloomKeys: BloomLevel[] = ['Remember','Understand','Apply','Analyze','Evaluate','Create'];
  const difficultyKeys: Difficulty[] = ['Easy','Moderate','Hard'];
  const bloom = marksDistribution(q, x => x.bloom, bloomKeys);
  const difficulty = marksDistribution(q, x => x.difficulty, difficultyKeys);
  const similarityRisk = q.reduce((sum, x) => sum + (x.similarity?.score ?? 0) * x.marks, 0) / (q.reduce((s, x) => s + x.marks, 0) || 1);
  const totalMarks = q.reduce((s, x) => s + x.marks, 0);
  const targetClo = Object.fromEntries(assessment.course.clos.map(x => [x.code, x.targetWeight]));
  const targetTopics = Object.fromEntries(assessment.course.topics.map(x => [x.name, x.targetWeight]));
  const components: Record<ComponentKey, number> = {
    cloAlignment: targetFit(clos, targetClo), topicCoverage: targetFit(topics, targetTopics),
    difficultyBalance: targetFit(difficulty, settings.desiredDifficulty), bloomDistribution: targetFit(bloom, settings.desiredBloom),
    questionDiversity: round(clamp(100 - q.filter(x => (x.similarity?.score ?? 0) >= settings.similarityModerate).length / Math.max(q.length, 1) * 120)),
    historicalSimilarity: round(clamp(100 - similarityRisk * 105)),
    markDistribution: round(clamp(100 - Math.abs(totalMarks - assessment.totalMarks) * 5 - q.filter(x => x.marks <= 0).length * 20)),
  };
  const overallScore = weightedScore(components, settings.weights);
  const recs = recommendations(assessment, { clos, topics, bloom, difficulty }, settings);
  return { version, overallScore, label: overallScore >= 90 ? 'Excellent' : overallScore >= 75 ? 'Good' : overallScore >= 60 ? 'Needs attention' : 'Needs revision', components, weights: settings.weights, cloDistribution: clos, topicDistribution: topics, bloomDistribution: bloom, difficultyDistribution: difficulty, totalMarks, questions: q, recommendations: recs, strengths: ['All questions have an explicit CLO mapping', totalMarks === assessment.totalMarks ? `Marks reconcile to ${totalMarks}` : 'Question structure was extracted successfully', 'Faculty can override every AI-assisted classification'], summary: `This assessment shows ${overallScore >= 75 ? 'a sound foundation' : 'several review opportunities'}. The most useful next step is ${recs[0]?.title.toLowerCase() ?? 'faculty validation of the mappings'}.`, generatedBy: 'demo-fixture' };
}
