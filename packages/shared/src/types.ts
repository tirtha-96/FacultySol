export type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
export type Difficulty = 'Easy' | 'Moderate' | 'Hard';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Clo { code: string; description: string; targetWeight: number }
export interface Topic { name: string; targetWeight: number }
export interface PreviousQuestion { id: string; year: number; text: string }
export interface Question {
  id: string; number: string; text: string; section: string; marks: number;
  cloCode: string; topic: string; bloom: BloomLevel; difficulty: Difficulty;
  confidence: number; concerns: string[]; similarity?: { score: number; previous: PreviousQuestion; reason: string };
}
export interface Assessment {
  id: string; title: string; year: number; totalMarks: number; duration: number;
  course: { id: string; code: string; name: string; university: string; clos: Clo[]; topics: Topic[] };
  questions: Question[];
}
export interface AnalysisSettings {
  weights: Record<ComponentKey, number>;
  desiredBloom: Record<BloomLevel, number>;
  desiredDifficulty: Record<Difficulty, number>;
  similarityModerate: number;
  similarityHigh: number;
}
export type ComponentKey = 'cloAlignment' | 'topicCoverage' | 'difficultyBalance' | 'bloomDistribution' | 'questionDiversity' | 'historicalSimilarity' | 'markDistribution';
export interface Recommendation {
  id: string; severity: Severity; title: string; reason: string; evidence: string;
  impact: string; action: string; targetQuestionId?: string; status: 'pending' | 'accepted' | 'dismissed';
}
export interface Analysis {
  version: number; overallScore: number; label: string; components: Record<ComponentKey, number>;
  weights: Record<ComponentKey, number>; cloDistribution: Record<string, number>; topicDistribution: Record<string, number>;
  bloomDistribution: Record<BloomLevel, number>; difficultyDistribution: Record<Difficulty, number>;
  totalMarks: number; questions: Question[]; recommendations: Recommendation[]; strengths: string[];
  summary: string; generatedBy: 'demo-fixture' | 'live-ai';
}
