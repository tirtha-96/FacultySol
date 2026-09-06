import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  analyzeAssessment,
  DEFAULT_SETTINGS,
  demoAssessment,
  type Analysis,
  type Assessment,
  type Question,
  type ReviewRecord,
  type Revision,
  type SourceDocument,
} from "@assessai/shared";
import { inputHash } from "./analysis.js";
type Store = {
  reviews: Record<string, ReviewRecord>;
  owners: Record<string, string>;
};
export class DurableRepository {
  private file: string;
  private store: Store;
  constructor(
    file = process.env.DEV_DATA_FILE ??
      (process.env.NODE_ENV === "test"
        ? path.join(os.tmpdir(), `facultysol-tests-${process.pid}.json`)
        : path.resolve(process.cwd(), "data", "reviews.json")),
  ) {
    this.file = file;
    this.store = this.load();
    this.ensureSample();
  }
  private load(): Store {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      return { reviews: {}, owners: {} };
    }
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.store, null, 2));
    fs.renameSync(tmp, this.file);
  }
  private ensureSample() {
    const a = structuredClone(demoAssessment),
      analysis = analyzeAssessment(a);
    analysis.id = "sample-analysis-1";
    analysis.inputHash = inputHash(a);
    analysis.createdAt = "2026-09-06T00:00:00.000Z";
    this.store.reviews[a.id] = {
      assessment: a,
      analyses: [analysis],
      revisions: [],
      status: "analyzed",
      updatedAt: new Date().toISOString(),
      sample: true,
    };
  }
  reset() {
    this.store = { reviews: {}, owners: {} };
    this.ensureSample();
    this.save();
  }
  canAccess(id: string, session: string) {
    return id === demoAssessment.id || this.store.owners[id] === session;
  }
  list(session: string) {
    return Object.values(this.store.reviews)
      .filter((r) => r.sample || this.store.owners[r.assessment.id] === session)
      .map((r) => ({
        id: r.assessment.id,
        title: r.assessment.title,
        year: r.assessment.year,
        course: r.assessment.course,
        status: r.status,
        updatedAt: r.updatedAt,
        sample: r.sample,
        analysis: r.analyses.at(-1),
      }));
  }
  get(id: string, session: string) {
    return this.canAccess(id, session) ? this.store.reviews[id] : undefined;
  }
  create(
    session: string,
    input: {
      title: string;
      year: number;
      totalMarks: number | null;
      duration: number;
      courseCode: string;
      courseName: string;
      university?: string;
      clos?: Assessment["course"]["clos"];
      topics?: Assessment["course"]["topics"];
    },
  ) {
    const id = randomUUID();
    const a: Assessment = {
      id,
      title: input.title,
      year: input.year,
      totalMarks: input.totalMarks,
      duration: input.duration,
      course: {
        id: randomUUID(),
        code: input.courseCode,
        name: input.courseName,
        university: input.university || "Faculty-provided course",
        clos: input.clos ?? [],
        topics: input.topics ?? [],
      },
      questions: [],
      sources: [],
      scope: {
        cloCodes: (input.clos ?? []).map((x) => x.code),
        topics: (input.topics ?? []).map((x) => x.name),
      },
    };
    this.store.reviews[id] = {
      assessment: a,
      analyses: [],
      revisions: [],
      status: "draft",
      updatedAt: new Date().toISOString(),
      sample: false,
    };
    this.store.owners[id] = session;
    this.save();
    return this.store.reviews[id];
  }
  cloneSample(session: string) {
    const a = structuredClone(demoAssessment);
    a.id = randomUUID();
    const analysis = analyzeAssessment(a, DEFAULT_SETTINGS, 1, "demo-fixture");
    analysis.id = randomUUID();
    analysis.inputHash = inputHash(a);
    analysis.createdAt = new Date().toISOString();
    const r: ReviewRecord = {
      assessment: a,
      analyses: [analysis],
      revisions: [],
      status: "analyzed",
      updatedAt: new Date().toISOString(),
      sample: true,
    };
    this.store.reviews[a.id] = r;
    this.store.owners[a.id] = session;
    this.save();
    return r;
  }
  updateAssessment(id: string, session: string, patch: Partial<Assessment>) {
    const r = this.get(id, session);
    if (!r || r.sample) return;
    Object.assign(r.assessment, patch, { id });
    r.analyses.forEach((a) => (a.stale = true));
    r.status = "ready";
    r.updatedAt = new Date().toISOString();
    this.save();
    return r;
  }
  addSource(
    id: string,
    session: string,
    source: SourceDocument,
    questions?: Question[],
  ) {
    const r = this.get(id, session);
    if (!r || r.sample) return;
    r.assessment.sources = [
      ...(r.assessment.sources ?? []).filter((s) => s.id !== source.id),
      source,
    ];
    if (source.kind === "current-exam" && questions?.length)
      r.assessment.questions = questions;
    r.analyses.forEach((a) => (a.stale = true));
    r.status = "ready";
    r.updatedAt = new Date().toISOString();
    this.save();
    return source;
  }
  addAnalysis(
    id: string,
    session: string,
    analysis: Analysis,
    expectedHash: string,
  ) {
    const r = this.get(id, session);
    if (!r || inputHash(r.assessment) !== expectedHash) return;
    analysis.id = randomUUID();
    analysis.inputHash = expectedHash;
    analysis.createdAt = new Date().toISOString();
    r.analyses.push(analysis);
    r.status = "analyzed";
    r.updatedAt = new Date().toISOString();
    this.save();
    return analysis;
  }
  markAnalyzing(id: string, session: string) {
    const r = this.get(id, session);
    if (!r) return;
    r.status = "analyzing";
    this.save();
  }
  markInterrupted(id: string, session: string) {
    const r = this.get(id, session);
    if (!r) return;
    r.status = "interrupted";
    this.save();
  }
  recoverInterrupted() {
    let changed = false;
    for (const r of Object.values(this.store.reviews))
      if (r.status === "analyzing") {
        r.status = "interrupted";
        changed = true;
      }
    if (changed) this.save();
  }
  decision(
    id: string,
    session: string,
    recId: string,
    decision: "dismissed" | "pending",
    reason?: string,
  ) {
    const r = this.get(id, session),
      rec = r?.analyses.at(-1)?.recommendations.find((x) => x.id === recId);
    if (!r || !rec) return;
    rec.status = decision;
    rec.dismissedReason = reason;
    this.save();
    return rec;
  }
  revise(
    id: string,
    session: string,
    questionId: string,
    changes: Partial<Question>,
    rationale: string,
  ) {
    const r = this.get(id, session);
    if (!r) return;
    const index = r.assessment.questions.findIndex((q) => q.id === questionId);
    if (index < 0) return;
    const original = structuredClone(r.assessment.questions[index]),
      revised = {
        ...original,
        ...changes,
        id: original.id,
        mappingProvenance: "faculty" as const,
      };
    r.assessment.questions[index] = revised;
    r.analyses.forEach((a) => (a.stale = true));
    const revision: Revision = {
      id: randomUUID(),
      questionId,
      fromVersion: r.revisions.length,
      toVersion: r.revisions.length + 1,
      original,
      revised: structuredClone(revised),
      rationale,
      createdAt: new Date().toISOString(),
    };
    r.revisions.push(revision);
    r.status = "ready";
    r.updatedAt = new Date().toISOString();
    this.save();
    return revision;
  }
  undo(id: string, session: string) {
    const r = this.get(id, session),
      last = r?.revisions.at(-1);
    if (!r || !last) return;
    const current = r.assessment.questions.find(
      (q) => q.id === last.questionId,
    );
    if (!current) return;
    return this.revise(
      id,
      session,
      last.questionId,
      last.original,
      `Restored version ${last.fromVersion}`,
    );
  }
  delete(id: string, session: string) {
    if (!this.canAccess(id, session) || id === demoAssessment.id) return false;
    delete this.store.reviews[id];
    delete this.store.owners[id];
    this.save();
    return true;
  }
}
export const repository = new DurableRepository();
repository.recoverInterrupted();
