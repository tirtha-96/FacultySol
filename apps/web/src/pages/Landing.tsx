import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  FileSearch,
  ShieldCheck,
} from "lucide-react";
import type { Analysis } from "@assessai/shared";
import { Brand } from "../components/Brand";
export function Landing({ onEnter, analysis }: { onEnter: () => void; analysis?: Analysis }) {
  const components = analysis?.components;
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <div>
          <button className="nav-link">How it works</button>
          <button className="secondary" onClick={onEnter}>
            Faculty sign in
          </button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span /> AI-powered assessment intelligence
            </span>
            <h1>
              Don’t just create an exam.
              <br />
              <em>Know what it measures.</em>
            </h1>
            <p>
              AssessAI helps faculty evaluate course alignment, cognitive
              demand, coverage, balance, and historical similarity—before an
              assessment reaches students.
            </p>
            <div className="hero-actions">
              <button className="primary" onClick={onEnter}>
                Analyze an assessment <ArrowRight size={18} />
              </button>
              <button className="secondary" onClick={onEnter}>
                Explore live demo
              </button>
            </div>
            <small>
              <ShieldCheck size={15} /> AI recommends. Faculty decides.
            </small>
          </div>
          <div className="hero-visual" aria-label="Assessment preview">
            <div className="preview-head">
              <div>
                <span>CSE 203 · Final Examination</span>
                <strong>Assessment quality overview</strong>
              </div>
              <span className="pill high">{analysis?.recommendations.length ?? "-"} issues</span>
            </div>
            <div className="preview-grid">
              <div className="mini-score">
                <div>
                  <strong>{analysis?.overallScore ?? "-"}</strong>
                  <span>/100</span>
                </div>
                <p>{analysis?.label ?? "Calculating..."}</p>
              </div>
              <div className="mini-metrics">
                <p>
                  <span>CLO alignment</span>
                  <b>{components?.cloAlignment ?? "-"}%</b>
                </p>
                <i>
                  <span style={{ width: `${components?.cloAlignment ?? 0}%` }} />
                </i>
                <p>
                  <span>Topic coverage</span>
                  <b>{components?.topicCoverage ?? "-"}%</b>
                </p>
                <i>
                  <span style={{ width: `${components?.topicCoverage ?? 0}%` }} />
                </i>
                <p>
                  <span>Question diversity</span>
                  <b>{components?.questionDiversity ?? "-"}%</b>
                </p>
                <i>
                  <span style={{ width: `${components?.questionDiversity ?? 0}%` }} />
                </i>
              </div>
            </div>
            <div className="preview-alert">
              <BrainCircuit />
              <div>
                <strong>CLO-3 is likely under-assessed</strong>
                <span>7% of marks map to design-oriented outcomes.</span>
              </div>
              <button>Review</button>
            </div>
          </div>
        </section>
        <section className="trust-row">
          <span>Built for evidence-led academic review</span>
          <div>
            <span>
              <FileSearch /> Structured document analysis
            </span>
            <span>
              <BrainCircuit /> Explainable AI reasoning
            </span>
            <span>
              <BarChart3 /> Deterministic metrics
            </span>
          </div>
        </section>
        <section className="workflow">
          <div className="section-heading">
            <span>ONE FOCUSED WORKFLOW</span>
            <h2>From question paper to confident decision</h2>
            <p>
              Structured context makes the analysis useful beyond a
              general-purpose chatbot.
            </p>
          </div>
          <div className="steps">
            {[
              [
                "01",
                "Upload context",
                "Syllabus, CLOs, current paper, and historical assessments.",
              ],
              [
                "02",
                "Analyze with evidence",
                "Semantic reasoning paired with transparent calculations.",
              ],
              [
                "03",
                "Review & improve",
                "Accept, edit, or dismiss every recommendation.",
              ],
            ].map(([n, h, p]) => (
              <article key={n}>
                <b>{n}</b>
                <h3>{h}</h3>
                <p>{p}</p>
                <span>
                  <Check /> Human review built in
                </span>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
