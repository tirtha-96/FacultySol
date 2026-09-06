export type BloomLevel =
  | "Remember"
  | "Understand"
  | "Apply"
  | "Analyze"
  | "Evaluate"
  | "Create"
  | "Unknown";
export type Difficulty = "Easy" | "Moderate" | "Hard" | "Unknown";
export type Severity = "low" | "medium" | "high" | "critical";
export type SourceKind = "syllabus" | "current-exam" | "historical-exam";
export interface Clo {
  code: string;
  description: string;
  targetWeight?: number;
}
export interface Topic {
  name: string;
  targetWeight?: number;
}
export interface SourceLocator {
  sourceId: string;
  page?: number;
  paragraph?: number;
  start: number;
  end: number;
  excerpt: string;
}
export interface SourceDocument {
  id: string;
  kind: SourceKind;
  title: string;
  year?: number;
  filename?: string;
  mimeType: string;
  text: string;
  locators: SourceLocator[];
  createdAt: string;
}
export interface PreviousQuestion {
  id: string;
  year: number;
  text: string;
  sourceId?: string;
  title?: string;
}
export interface Question {
  id: string;
  number: string;
  text: string;
  section: string;
  marks: number | null;
  cloCode: string;
  topic: string;
  bloom: BloomLevel;
  difficulty: Difficulty;
  confidence: number;
  concerns: string[];
  parentId?: string;
  isLeaf?: boolean;
  sourceRef?: SourceLocator;
  mappingProvenance?: "ai-estimate" | "faculty" | "fixture";
  analysisExplanation?: string;
  analysisEvidence?: SourceLocator[];
  similarity?: {
    score?: number;
    kind?: "near-identical" | "similar-task" | "shared-topic";
    previous: PreviousQuestion;
    reason: string;
    evidence?: SourceLocator[];
  };
}
export interface Assessment {
  id: string;
  title: string;
  year: number;
  totalMarks: number | null;
  duration: number;
  course: {
    id: string;
    code: string;
    name: string;
    university: string;
    synthetic?: boolean;
    clos: Clo[];
    topics: Topic[];
  };
  questions: Question[];
  sources?: SourceDocument[];
  scope?: { cloCodes: string[]; topics: string[] };
  choiceRule?: {
    answerAny: number;
    offered: number;
    marksPerQuestion?: number;
  };
}
export interface AnalysisSettings {
  weights: Record<ComponentKey, number>;
  desiredBloom?: Partial<Record<BloomLevel, number>>;
  desiredDifficulty?: Partial<Record<Difficulty, number>>;
  similarityModerate: number;
  similarityHigh: number;
}
export type ComponentKey =
  | "cloAlignment"
  | "topicCoverage"
  | "difficultyBalance"
  | "bloomDistribution"
  | "questionDiversity"
  | "historicalSimilarity"
  | "markDistribution";
export interface Recommendation {
  id: string;
  type?: string;
  severity: Severity;
  title: string;
  reason: string;
  evidence: string;
  evidenceRefs?: SourceLocator[];
  uncertainty?: string;
  impact: string;
  action: string;
  targetQuestionId?: string;
  status: "pending" | "accepted" | "dismissed";
  dismissedReason?: string;
}
export interface Analysis {
  id?: string;
  inputHash?: string;
  createdAt?: string;
  version: number;
  overallScore: number | null;
  label: string;
  components: Partial<Record<ComponentKey, number>>;
  weights: Record<ComponentKey, number>;
  cloDistribution: Record<string, number>;
  topicDistribution: Record<string, number>;
  bloomDistribution: Record<BloomLevel, number>;
  difficultyDistribution: Record<Difficulty, number>;
  totalMarks: number;
  unknownMarks: number;
  questions: Question[];
  recommendations: Recommendation[];
  strengths: string[];
  summary: string;
  generatedBy: "demo-fixture" | "live-ai" | "deterministic-only";
  historicalStatus?: "assessed" | "not-assessed";
  stale?: boolean;
  limitations?: string[];
}
export interface Revision {
  id: string;
  questionId: string;
  fromVersion: number;
  toVersion: number;
  original: Question;
  revised: Question;
  rationale: string;
  createdAt: string;
}
export interface ReviewRecord {
  assessment: Assessment;
  analyses: Analysis[];
  revisions: Revision[];
  status: "draft" | "ready" | "analyzing" | "analyzed" | "interrupted";
  saveState?: "saved" | "saving" | "error";
  updatedAt: string;
  sample: boolean;
}
