import { describe, expect, it } from 'vitest';
import { analyzeAssessment, DEFAULT_SETTINGS, marksDistribution, similarityBand, weightedScore } from './scoring';
import { demoAssessment, improvedDemoAssessment } from './demo';

describe('deterministic assessment engine', () => {
  it('aggregates marks into CLO coverage', () => expect(marksDistribution(demoAssessment.questions, q => q.cloCode, ['CLO-1','CLO-2','CLO-3','CLO-4'])['CLO-3']).toBe(7));
  it('aggregates Bloom and difficulty by marks', () => { const a=analyzeAssessment(demoAssessment); expect(a.bloomDistribution.Remember).toBe(13); expect(a.difficultyDistribution.Hard).toBe(7); });
  it('uses configurable similarity thresholds', () => { expect(similarityBand(.76)).toBe('High'); expect(similarityBand(.6)).toBe('Moderate'); expect(similarityBand(.3)).toBe('Low'); });
  it('reconciles total marks', () => expect(analyzeAssessment(demoAssessment).totalMarks).toBe(100));
  it('calculates the score from components and weights', () => { const a=analyzeAssessment(demoAssessment); expect(a.overallScore).toBe(weightedScore(a.components, DEFAULT_SETTINGS.weights)); });
  it('improves after faculty-approved revisions', () => expect(analyzeAssessment(improvedDemoAssessment(), DEFAULT_SETTINGS, 2).overallScore).toBeGreaterThan(analyzeAssessment(demoAssessment).overallScore));
});
