import { analyzeAssessment, DEFAULT_SETTINGS, demoAssessment, improvedDemoAssessment, type Analysis, type Assessment, type Recommendation } from '@assessai/shared';

class DemoRepository {
  private assessment: Assessment = structuredClone(demoAssessment);
  private analyses: Analysis[] = [analyzeAssessment(this.assessment)];

  reset() { this.assessment = structuredClone(demoAssessment); this.analyses = [analyzeAssessment(this.assessment)]; }
  getCourses() { return [{ ...this.assessment.course, assessments: [{ id:this.assessment.id,title:this.assessment.title,year:this.assessment.year,score:this.latest().overallScore,status:this.latest().label }] }]; }
  getCourse(id: string) { return this.assessment.course.id === id ? { ...this.assessment.course, assessments: this.getCourses()[0].assessments } : undefined; }
  getAssessment(id: string) { return id === this.assessment.id ? this.assessment : undefined; }
  latest() { return this.analyses.at(-1)!; }
  getAnalysis(id: string, version?: number) { if (id !== this.assessment.id) return; return version ? this.analyses.find(a => a.version === version) : this.latest(); }
  analyze(id: string) { if (id !== this.assessment.id) return; const next=analyzeAssessment(this.assessment, DEFAULT_SETTINGS, this.analyses.length+1); this.analyses.push(next); return next; }
  improve() { this.assessment=improvedDemoAssessment(); const next=analyzeAssessment(this.assessment, DEFAULT_SETTINGS, this.analyses.length+1); next.recommendations = next.recommendations.map(r => ({...r,status:'accepted'})); this.analyses.push(next); return { before:this.analyses[0], after:next }; }
  review(id: string, decision: 'accepted'|'dismissed') { const item=this.latest().recommendations.find(r=>r.id===id); if(!item) return; item.status=decision; return item; }
  createAssessment(input: Partial<Assessment>) { return { id:`assessment-${Date.now()}`, status:'draft', ...input }; }
}
export const repository = new DemoRepository();
