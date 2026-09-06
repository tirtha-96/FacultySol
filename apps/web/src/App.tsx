import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileCheck2,
  FilePlus2,
  FolderOpen,
  GitCompareArrows,
  ListChecks,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Analysis, Assessment, Revision } from "@assessai/shared";
import { Brand } from "./components/Brand";
import { api, type ReviewSummary } from "./api";
import { SetupReview } from "./pages/SetupReview";
import { AssessmentPage } from "./pages/Assessment";
type View = "home" | "setup" | "review";
export default function App() {
  const [view, setView] = useState<View>("home"),
    [reviews, setReviews] = useState<ReviewSummary[]>([]),
    [reviewId, setReviewId] = useState(""),
    [record, setRecord] = useState<{
      assessment: Assessment;
      analysis?: Analysis;
      meta?: {
        status?: string;
        sample?: boolean;
        updatedAt?: string;
        revisions?: Revision[];
        previousAnalysis?: Analysis;
      };
    }>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refreshList = async () => {
    setLoading(true);
    try {
      setReviews(await api.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "API unavailable");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refreshList();
  }, []);
  const open = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      setReviewId(id);
      setRecord(await api.get(id));
      setView("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open review");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const deepLink = new URLSearchParams(location.search).get("review");
    if (deepLink) open(deepLink);
  }, []);
  const reload = async () => setRecord(await api.get(reviewId));
  const sample = async () => {
    setLoading(true);
    try {
      const r = await api.importSample();
      await open(r.assessment.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sample");
    } finally {
      setLoading(false);
    }
  };
  if (view === "setup")
    return (
      <SetupReview
        onBack={() => {
          setView("home");
          refreshList();
        }}
        onOpen={open}
      />
    );
  if (view === "review" && record)
    return (
      <AssessmentPage
        {...record}
        onBack={() => {
          setView("home");
          refreshList();
        }}
        onReload={reload}
        onDelete={async () => {
          if (
            confirm(
              "Delete this review and its saved sources, decisions, and revisions?",
            )
          ) {
            await api.delete(reviewId);
            setRecord(undefined);
            setView("home");
            await refreshList();
          }
        }}
      />
    );
  const custom = reviews.filter((x) => !x.sample),
    latest = custom[0];
  return (
    <div className="faculty-home">
      <header className="home-nav">
        <Brand />
        <span>Faculty assessment review</span>
      </header>
      <main className="home-main">
        <section className="home-hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <ShieldCheck /> EVIDENCE-BACKED · FACULTY APPROVED
            </span>
            <h1>
              Review your exam with <em>clarity.</em>
            </h1>
            <p>
              FacultySol checks confirmed questions against the syllabus and
              historical papers, explains its evidence, and keeps every revision
              under your control.
            </p>
            <div className="entry-actions">
              <button className="primary" onClick={() => setView("setup")}>
                <FilePlus2 />
                Review a new paper <ArrowRight />
              </button>
              <button
                className="secondary"
                disabled={!latest}
                onClick={() => latest && open(latest.id)}
              >
                <FolderOpen />
                Continue a review
              </button>
              <button className="secondary sample-button" onClick={sample}>
                <FileCheck2 />
                Try sample
              </button>
            </div>
            <small>
              Sample material is synthetic and imported into your private browser
              session.
            </small>
          </div>
          <div className="home-preview" aria-label="FacultySol workflow preview">
            <div className="preview-glow" />
            <article className="preview-document">
              <header>
                <span className="preview-icon"><FileCheck2 /></span>
                <div>
                  <small>DATABASE SYSTEMS</small>
                  <strong>Midterm review</strong>
                </div>
                <span className="preview-ready"><span /> Ready</span>
              </header>
              <div className="preview-progress">
                <span className="done"><CheckCircle2 /> Prepare</span>
                <i />
                <span className="current">2</span>
                <i />
                <span>3</span>
              </div>
              <div className="preview-finding">
                <span><Route /></span>
                <div>
                  <small>CHOICE COVERAGE</small>
                  <strong>CLO-3 can be skipped</strong>
                  <p>A valid 30-mark route avoids this outcome.</p>
                </div>
                <ArrowRight />
              </div>
              <div className="preview-metrics">
                <div><span>Questions</span><strong>6</strong><small>confirmed</small></div>
                <div><span>Outcomes</span><strong>4</strong><small>in scope</small></div>
                <div><span>Routes</span><strong>20</strong><small>checked</small></div>
              </div>
            </article>
            <article className="preview-note">
              <Sparkles />
              <div><strong>Revision sandbox</strong><span>Preview impact before applying</span></div>
              <CheckCircle2 />
            </article>
          </div>
        </section>
        <section className="capability-grid" aria-label="FacultySol capabilities">
          <article className="capability-card coral">
            <span className="capability-icon"><Route /></span>
            <div><small>01 · CHECK</small><h2>Choice coverage</h2></div>
            <p>See whether a valid question selection can avoid an intended outcome.</p>
            <span className="capability-foot"><BarChart3 /> Exact route calculations</span>
          </article>
          <article className="capability-card violet">
            <span className="capability-icon"><GitCompareArrows /></span>
            <div><small>02 · COMPARE</small><h2>Revision sandbox</h2></div>
            <p>Preview the consequences of a change before updating the saved draft.</p>
            <span className="capability-foot"><Sparkles /> Current vs proposed</span>
          </article>
          <article className="capability-card teal">
            <span className="capability-icon"><ListChecks /></span>
            <div><small>03 · DECIDE</small><h2>Preflight review</h2></div>
            <p>Work through the most important remaining findings before finalizing.</p>
            <span className="capability-foot"><ShieldCheck /> Faculty stays in control</span>
          </article>
        </section>
        <section className="recent-reviews">
          <div className="section-title">
            <div>
              <h2>Your saved reviews</h2>
              <p>Pick up where you left off, with sources and decisions intact.</p>
            </div>
            <button
              className="icon-button"
              aria-label="Refresh reviews"
              onClick={refreshList}
            >
              <RefreshCw />
            </button>
          </div>
          {loading ? (
            <div className="loading">Loading saved work…</div>
          ) : error ? (
            <div className="error-box" role="alert">
              {error}
            </div>
          ) : custom.length === 0 ? (
            <div className="empty-state">
              <FilePlus2 />
              <h2>No faculty papers yet</h2>
              <p>
                Start a review, or use the synthetic sample without adding it to
                your real records.
              </p>
            </div>
          ) : (
            <div className="review-cards">
              {custom.map((r) => (
                <button key={r.id} onClick={() => open(r.id)}>
                  <span className="review-card-icon">
                    {r.course.code.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <span>{r.course.code} · FACULTY REVIEW</span>
                    <strong>
                      {r.title} · {r.year}
                    </strong>
                    <small>
                      {r.status === "ready"
                        ? "Saved · analysis required"
                        : r.analysis?.stale
                          ? "Saved · analysis stale"
                          : "Saved"}{" "}
                      · Updated {new Date(r.updatedAt).toLocaleDateString()}
                    </small>
                  </div>
                  <div>
                    <b>{r.analysis?.overallScore ?? "—"}</b>
                    <small>experimental</small>
                  </div>
                  <span className="review-card-arrow"><ArrowRight /></span>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
