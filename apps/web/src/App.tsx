import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileCheck2,
  FilePlus2,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
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
          <span className="eyebrow">
            <ShieldCheck /> EVIDENCE-BACKED · FACULTY APPROVED
          </span>
          <h1>Review your exam before your students take it.</h1>
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
            <button className="secondary" onClick={sample}>
              <FileCheck2 />
              Try sample
            </button>
          </div>
          <small>
            Sample material is synthetic and imported into your private browser
            session.
          </small>
        </section>
        <section className="recent-reviews">
          <div className="section-title">
            <div>
              <h2>Your saved reviews</h2>
              <p>Durable development storage · isolated by anonymous session</p>
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
                  <div>
                    <span>{r.course.code}</span>
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
                  <ArrowRight />
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
