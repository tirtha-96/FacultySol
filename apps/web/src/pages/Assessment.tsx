import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  Eye,
  FileText,
  History,
  Info,
  PenLine,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type {
  Analysis,
  Assessment as AssessmentType,
  Question,
  Recommendation,
  Revision,
} from "@assessai/shared";
import { api } from "../api";
import { DistributionBars } from "../components/DistributionBars";
type Tab = "Findings" | "Coverage" | "Report";
export function AssessmentPage({
  assessment,
  analysis,
  meta,
  onBack,
  onReload,
  onImprove,
  onDelete,
}: {
  assessment: AssessmentType;
  analysis?: Analysis;
  meta?: {
    status?: string;
    sample?: boolean;
    updatedAt?: string;
    revisions?: Revision[];
    previousAnalysis?: Analysis;
  };
  onBack: () => void;
  onReload?: () => Promise<void> | void;
  onImprove?: () => void;
  onDelete?: () => void;
}) {
  const [tab, setTab] = useState<Tab>(() => {
    const requested = new URLSearchParams(location.search).get("tab");
    return requested === "Coverage" || requested === "Report"
      ? requested
      : "Findings";
  });
  const [selected, setSelected] = useState(assessment.questions[0]?.id);
  const [filter, setFilter] = useState("");
  const [finding, setFinding] = useState<Recommendation>();
  const [suggest, setSuggest] = useState<any>();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paperPrint, setPaperPrint] = useState(false);
  const q = assessment.questions.find((x) => x.id === selected);
  const findings = analysis?.recommendations ?? [];
  const visible = useMemo(
    () =>
      assessment.questions.filter(
        (x) =>
          !filter ||
          x.cloCode === filter ||
          x.bloom === filter ||
          x.topic === filter,
      ),
    [assessment.questions, filter],
  );
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await api.analyze(assessment.id);
      await onReload?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  };
  const requestRevision = async (question = q) => {
    if (!question) return;
    setBusy(true);
    setError("");
    try {
      setSuggest(
        await api.suggest(assessment.id, question.id, {
          preserveMarks: true,
          cloCode: question.cloCode,
          bloom: question.bloom,
        }),
      );
      setSelected(question.id);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suggestion failed");
    } finally {
      setBusy(false);
    }
  };
  const accept = async () => {
    if (!q || !suggest) return;
    setBusy(true);
    setError("");
    try {
      await api.accept(assessment.id, q.id, {
        text: suggest.question,
        marks: q.marks,
        cloCode: suggest.cloCode ?? q.cloCode,
        bloom: suggest.bloom ?? q.bloom,
        rationale: suggest.explanation || "Faculty-approved revision",
      });
      setSuggest(undefined);
      try {
        await api.analyze(assessment.id);
      } catch (e) {
        setError(
          `${e instanceof Error ? e.message : "Reanalysis failed"} The accepted edit is saved and the prior analysis remains stale.`,
        );
      }
      await onReload?.();
    } finally {
      setBusy(false);
    }
  };
  const manual = async (
    text: string,
    marks: number | null,
    cloCode: string,
    bloom: Question["bloom"],
  ) => {
    if (!q) return;
    setBusy(true);
    try {
      await api.accept(assessment.id, q.id, {
        text,
        marks,
        cloCode,
        bloom,
        rationale: "Faculty manual edit",
      });
      setEditing(false);
      await onReload?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };
  const exportJson = async () => {
    const data = await api.report(assessment.id),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download =
      `${assessment.course.code}-${assessment.title}-review.json`.replace(
        /\s+/g,
        "-",
      );
    a.click();
    URL.revokeObjectURL(url);
  };
  const openSource = async (ref: { sourceId: string; page?: number }) => {
    try {
      const url = await api.original(assessment.id, ref.sourceId);
      window.open(
        `${url}${ref.page ? `#page=${ref.page}` : ""}`,
        "_blank",
        "noopener,noreferrer",
      );
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Original source is unavailable",
      );
    }
  };
  return (
    <div className={`assessment-page ${paperPrint ? "paper-print" : ""}`}>
      <header className="assessment-head">
        <div>
          <button
            className="icon-button"
            aria-label="Back to reviews"
            onClick={onBack}
          >
            <ArrowLeft />
          </button>
          <div>
            <span>
              {assessment.course.code} · {assessment.course.name}
            </span>
            <h1>
              {assessment.title} {assessment.year}
            </h1>
          </div>
        </div>
        <div className="review-status">
          <span className={`mode ${meta?.sample ? "sample" : ""}`}>
            <span />
            {meta?.sample
              ? "Sample mode · synthetic material"
              : analysis?.generatedBy === "live-ai"
                ? "Live AI"
                : "Custom review"}
          </span>
          <span className="save-chip">
            {meta?.status === "interrupted"
              ? "Run interrupted"
              : analysis?.stale
                ? "Saved · analysis stale"
                : "Saved"}
          </span>
          <button className="secondary" onClick={run} disabled={busy}>
            <RefreshCw />
            {busy ? "Working…" : analysis ? "Rerun checks" : "Run analysis"}
          </button>
          <button
            className="icon-button"
            aria-label="Export JSON"
            onClick={exportJson}
          >
            <Download />
          </button>
          <button
            className="icon-button"
            aria-label="Delete review"
            onClick={onDelete}
          >
            <Trash2 />
          </button>
        </div>
      </header>
      <nav className="assessment-tabs" aria-label="Review views">
        {(["Findings", "Coverage", "Report"] as Tab[]).map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
          >
            {x}
            {x === "Findings" && (
              <b>{findings.filter((f) => f.status === "pending").length}</b>
            )}
          </button>
        ))}
      </nav>
      {error && (
        <div className="workspace-alert" role="alert">
          <AlertTriangle />
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss message">
            <X />
          </button>
        </div>
      )}
      {tab === "Findings" && (
        <main className="review-workspace">
          <aside className="question-rail">
            <label className="rail-search">
              <Search />
              <input
                aria-label="Search questions"
                placeholder="Search questions"
                onChange={(e) => {
                  const term = e.target.value.toLowerCase();
                  setFilter(
                    term
                      ? (assessment.questions.find((x) =>
                          x.text.toLowerCase().includes(term),
                        )?.cloCode ?? term)
                      : "",
                  );
                }}
              />
            </label>
            {filter && (
              <button className="clear-filter" onClick={() => setFilter("")}>
                Clear filter: {filter} <X />
              </button>
            )}
            <div className="finding-list">
              <h2>Findings</h2>
              {findings.length ? (
                findings.map((f) => (
                  <button
                    key={f.id}
                    className={finding?.id === f.id ? "selected" : ""}
                    onClick={() => {
                      setFinding(f);
                      if (f.targetQuestionId) setSelected(f.targetQuestionId);
                    }}
                  >
                    <span className={`severity-dot ${f.severity}`} />
                    <div>
                      <strong>{f.title}</strong>
                      <small>
                        {f.status === "dismissed"
                          ? "Dismissed"
                          : f.severity + " priority"}
                      </small>
                    </div>
                  </button>
                ))
              ) : (
                <div className="empty-mini">
                  Run analysis to create source-checked findings.
                </div>
              )}
            </div>
            <div className="question-list">
              <h2>
                Questions <span>{visible.length}</span>
              </h2>
              {visible.map((item) => (
                <button
                  className={selected === item.id ? "selected" : ""}
                  onClick={() => {
                    setSelected(item.id);
                    setFinding(undefined);
                    setSuggest(undefined);
                  }}
                  key={item.id}
                >
                  <b>{item.number}</b>
                  <div>
                    <strong>{item.text}</strong>
                    <small>
                      {item.cloCode} · {item.bloom} estimate ·{" "}
                      {item.marks ?? "Unknown"} marks
                    </small>
                  </div>
                  {item.concerns.length > 0 && (
                    <AlertTriangle aria-label="Has concern" />
                  )}
                </button>
              ))}
            </div>
          </aside>
          <section className="question-detail">
            {finding ? (
              <FindingDetail
                item={finding}
                assessment={assessment}
                onClose={() => setFinding(undefined)}
                onSuggest={() =>
                  requestRevision(
                    assessment.questions.find(
                      (x) => x.id === finding.targetQuestionId,
                    ),
                  )
                }
                onEdit={() => {
                  setFinding(undefined);
                  setEditing(true);
                }}
                onDismiss={async () => {
                  await api.dismiss(assessment.id, finding.id);
                  setFinding(undefined);
                  await onReload?.();
                }}
              />
            ) : q ? (
              <>
                <div className="detail-head">
                  <div>
                    <span>QUESTION {q.number}</span>
                    <h2>{q.text}</h2>
                    <p>
                      {q.cloCode} · {q.topic} · Bloom estimate: {q.bloom} ·
                      Difficulty estimate: {q.difficulty}
                    </p>
                  </div>
                  <span className="marks-box">
                    {q.marks ?? "?"}
                    <small>marks</small>
                  </span>
                </div>
                <div className="question-actions">
                  <button
                    className="secondary"
                    onClick={() => requestRevision()}
                    disabled={busy}
                  >
                    <Sparkles />
                    Suggest revision
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setEditing(true)}
                  >
                    <PenLine />
                    Edit manually
                  </button>
                  {meta?.revisions?.length ? (
                    <button
                      className="secondary"
                      onClick={async () => {
                        await api.undo(assessment.id);
                        await onReload?.();
                      }}
                    >
                      <RotateCcw />
                      Restore prior version
                    </button>
                  ) : null}
                </div>
                {q.sourceRef && (
                  <section className="evidence-block">
                    <label>
                      <Eye />
                      Source evidence
                    </label>
                    <blockquote>{q.sourceRef.excerpt}</blockquote>
                    {assessment.sources?.find(
                      (source) => source.id === q.sourceRef?.sourceId,
                    )?.originalAvailable && (
                      <button
                        className="secondary"
                        onClick={() => openSource(q.sourceRef!)}
                      >
                        <Eye /> Open original page {q.sourceRef.page ?? ""}
                      </button>
                    )}
                    <small>
                      Paragraph {q.sourceRef.paragraph ?? "—"} ·{" "}
                      {assessment.sources?.find(
                        (s) => s.id === q.sourceRef?.sourceId,
                      )?.title ?? "Current paper"}
                    </small>
                  </section>
                )}
                {q.analysisExplanation && (
                  <section className="evidence-block">
                    <label>Why this mapping?</label>
                    <p>{q.analysisExplanation}</p>
                    {q.analysisEvidence?.length ? (
                      q.analysisEvidence.map((ref) => (
                        <blockquote key={`${ref.sourceId}-${ref.start}`}>
                          {ref.excerpt}
                          <small>
                            {assessment.sources?.find(
                              (s) => s.id === ref.sourceId,
                            )?.title ?? ref.sourceId}
                          </small>
                          {assessment.sources?.find(
                            (source) => source.id === ref.sourceId,
                          )?.originalAvailable && (
                            <button
                              className="secondary"
                              onClick={() => openSource(ref)}
                            >
                              <Eye /> Open page {ref.page ?? ""}
                            </button>
                          )}
                        </blockquote>
                      ))
                    ) : (
                      <p className="unavailable">
                        The model explanation had no verified source quote.
                      </p>
                    )}
                  </section>
                )}
                {q.similarity && (
                  <section className="side-by-side">
                    <div>
                      <label>Current · {q.number}</label>
                      <p>{q.text}</p>
                    </div>
                    <div>
                      <label>
                        Historical ·{" "}
                        {q.similarity.previous.title ??
                          q.similarity.previous.year}
                      </label>
                      <p>{q.similarity.previous.text}</p>
                    </div>
                    <footer>
                      <strong>
                        {q.similarity.kind?.replace("-", " ") ?? "Similarity"}
                      </strong>
                      <span>{q.similarity.reason}</span>
                      {q.similarity.kind === "shared-topic" && (
                        <em>Shared topic only — not a repetition warning.</em>
                      )}
                    </footer>
                  </section>
                )}
                {q.concerns.length > 0 && (
                  <section className="concern-box">
                    <AlertTriangle />
                    <div>
                      <strong>Needs faculty review</strong>
                      {q.concerns.map((c) => (
                        <p key={c}>{c}</p>
                      ))}
                    </div>
                  </section>
                )}
                {!q.sourceRef && (
                  <p className="unavailable">
                    <Info />
                    Verified excerpt unavailable for this mapping.
                  </p>
                )}
              </>
            ) : (
              <div className="empty-state">No questions match this filter.</div>
            )}
          </section>
        </main>
      )}
      {tab === "Coverage" && analysis && (
        <Coverage
          analysis={analysis}
          onFilter={(x) => {
            setFilter(x);
            setTab("Findings");
          }}
        />
      )}
      {tab === "Report" && analysis && (
        <Report
          assessment={assessment}
          analysis={analysis}
          revisions={meta?.revisions ?? []}
          previous={meta?.previousAnalysis}
          onPrint={() => window.print()}
          onPaper={() => {
            setPaperPrint(true);
            setTimeout(() => {
              window.print();
              setPaperPrint(false);
            }, 50);
          }}
        />
      )}
      {suggest && q && (
        <RevisionDialog
          q={q}
          value={suggest}
          busy={busy}
          onChange={setSuggest}
          onAccept={accept}
          onRegenerate={() => requestRevision()}
          onCancel={() => setSuggest(undefined)}
        />
      )}{" "}
      {editing && q && (
        <EditDialog
          q={q}
          busy={busy}
          onSave={manual}
          onCancel={() => setEditing(false)}
        />
      )}{" "}
      {paperPrint && (
        <div className="clean-paper">
          <h1>
            {assessment.course.code} · {assessment.course.name}
          </h1>
          <p>
            {assessment.title} · {assessment.year} ·{" "}
            {assessment.totalMarks ?? "Unconfirmed"} marks ·{" "}
            {assessment.duration} minutes
          </p>
          {assessment.questions.map((x) => (
            <article key={x.id}>
              <strong>{x.number}.</strong>
              <span>{x.text}</span>
              <b>[{x.marks ?? "?"}]</b>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FindingDetail({
  item,
  assessment,
  onClose,
  onSuggest,
  onEdit,
  onDismiss,
}: {
  item: Recommendation;
  assessment: AssessmentType;
  onClose: () => void;
  onSuggest: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="finding-detail">
      <button
        className="icon-button close"
        aria-label="Close evidence"
        onClick={onClose}
      >
        <X />
      </button>
      <span className={`pill ${item.severity}`}>{item.severity} priority</span>
      <h2>{item.title}</h2>
      <section>
        <label>What was found</label>
        <p>{item.reason}</p>
      </section>
      <section>
        <label>Verified evidence</label>
        <blockquote>{item.evidence}</blockquote>
        {item.evidenceRefs?.length ? (
          <small>
            {item.evidenceRefs
              .map(
                (r) =>
                  assessment.sources?.find((s) => s.id === r.sourceId)?.title ??
                  r.sourceId,
              )
              .join(", ")}
          </small>
        ) : (
          <small>
            Direct source locator unavailable; treat this explanation as
            unsupported context.
          </small>
        )}
      </section>
      {item.uncertainty && (
        <section>
          <label>Uncertainty</label>
          <p>{item.uncertainty}</p>
        </section>
      )}
      <section>
        <label>Recommended action</label>
        <p>{item.action}</p>
      </section>
      <div className="action-stack">
        <button
          className="primary"
          disabled={!item.targetQuestionId}
          onClick={onSuggest}
        >
          <Sparkles />
          Suggest revision
        </button>
        <button
          className="secondary"
          disabled={!item.targetQuestionId}
          onClick={onEdit}
        >
          <PenLine />
          Edit manually
        </button>
        <button className="secondary" onClick={onDismiss}>
          Dismiss finding
        </button>
      </div>
    </div>
  );
}
function Coverage({
  analysis,
  onFilter,
}: {
  analysis: Analysis;
  onFilter: (x: string) => void;
}) {
  return (
    <main className="coverage-grid">
      <section className="panel">
        <h2>Outcome allocation</h2>
        <p>Share of known leaf-part marks. Select a row to filter questions.</p>
        <DistributionBars data={analysis.cloDistribution} />
        {Object.keys(analysis.cloDistribution).map((k) => (
          <button className="data-link" key={k} onClick={() => onFilter(k)}>
            Show {k} questions
          </button>
        ))}
      </section>
      <section className="panel">
        <h2>Bloom estimates</h2>
        <p>
          Classification reflects demanded work and remains faculty-editable.
        </p>
        <DistributionBars data={analysis.bloomDistribution} />
        {Object.keys(analysis.bloomDistribution).map((k) => (
          <button className="data-link" key={k} onClick={() => onFilter(k)}>
            Show {k}
          </button>
        ))}
      </section>
      <section className="panel">
        <h2>Topics</h2>
        <DistributionBars data={analysis.topicDistribution} />
      </section>
      <section className="panel">
        <h2>Difficulty estimates</h2>
        <p>
          Assumptions depend on prerequisites and expected work; this is not
          student-performance evidence.
        </p>
        <DistributionBars data={analysis.difficultyDistribution} />
      </section>
      <section className="panel arithmetic">
        <h2>Arithmetic</h2>
        <strong>{analysis.totalMarks} known marks</strong>
        <span>{analysis.unknownMarks} question parts with unknown marks</span>
        <p>Parent subtotals are excluded when child parts exist.</p>
      </section>
      <section className="panel">
        <h2>Historical comparison</h2>
        <strong>
          {analysis.historicalStatus === "not-assessed"
            ? "Not assessed"
            : "Assessed"}
        </strong>
        <p>
          {analysis.historicalStatus === "not-assessed"
            ? "No historical source was supplied. This is not a “no repeats” result."
            : "Near-identical and similar-task findings are warnings; shared topic alone is not."}
        </p>
      </section>
    </main>
  );
}
function Report({
  assessment,
  analysis,
  revisions,
  previous,
  onPrint,
  onPaper,
}: {
  assessment: AssessmentType;
  analysis: Analysis;
  revisions: Revision[];
  previous?: Analysis;
  onPrint: () => void;
  onPaper: () => void;
}) {
  const downloadSource = (
    source: NonNullable<AssessmentType["sources"]>[number],
  ) => {
    const url = URL.createObjectURL(
        new Blob([source.text], { type: "text/plain" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = source.filename ?? `${source.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="report panel">
      <div className="report-toolbar">
        <button className="secondary" onClick={onPrint}>
          <Printer />
          Print / Save as PDF
        </button>
        <button className="secondary" onClick={onPaper}>
          <FileText />
          Clean question paper
        </button>
      </div>
      <div className="report-brand">
        FACULTY<span>SOL</span>
        <small>Evidence-backed assessment review</small>
      </div>
      <h1>
        {assessment.course.code} · {assessment.course.name}
      </h1>
      <p>
        {assessment.title} · version {analysis.version} ·{" "}
        {analysis.createdAt
          ? new Date(analysis.createdAt).toLocaleString()
          : "fixture date"}{" "}
        · {analysis.generatedBy}
      </p>
      <section>
        <h2>Review summary</h2>
        <p>{analysis.summary}</p>
        <p>
          <strong>Experimental indicator:</strong>{" "}
          {analysis.overallScore ?? "Unavailable"}. Available components are
          reweighted; unavailable dimensions are excluded.
        </p>
      </section>
      <section>
        <h2>Sources</h2>
        {assessment.sources?.map((s) => (
          <p key={s.id}>
            {s.title} · {s.kind} · {s.filename ?? "pasted text"}{" "}
            <button className="data-link" onClick={() => downloadSource(s)}>
              Download source
            </button>
          </p>
        ))}
      </section>
      <section>
        <h2>Scope</h2>
        <p>
          Outcomes: {assessment.scope?.cloCodes.join(", ") || "Not confirmed"}
        </p>
        <p>Topics: {assessment.scope?.topics.join(", ") || "Not confirmed"}</p>
      </section>
      <section>
        <h2>Unresolved findings</h2>
        {analysis.recommendations
          .filter((x) => x.status === "pending")
          .map((x) => (
            <p key={x.id}>
              <strong>{x.title}:</strong> {x.reason}
            </p>
          ))}
      </section>
      <section>
        <h2>Accepted edits</h2>
        {revisions.length ? (
          revisions.map((r) => (
            <p key={r.id}>
              <strong>{r.original.number}:</strong> “{r.original.text}” → “
              {r.revised.text}”
            </p>
          ))
        ) : (
          <p>No accepted edits.</p>
        )}
      </section>
      {previous && (
        <section>
          <h2>Before / after snapshot</h2>
          <p>
            Version {previous.version}: {previous.summary}
          </p>
          <p>
            Version {analysis.version}: {analysis.summary}
          </p>
          <p>
            {previous.inputHash === analysis.inputHash
              ? "Directly comparable under the same paper/settings."
              : "Paper inputs changed; concrete findings are comparable, but the aggregate is not a like-for-like settings claim."}
          </p>
          {previous.recommendations
            .filter(
              (old) =>
                old.type === "coverage" &&
                !analysis.recommendations.some((now) => now.id === old.id),
            )
            .map((old) => (
              <p key={old.id}>
                <Check /> Previously uncovered outcome now assessed:{" "}
                {old.title.replace(" is uncovered in the selected scope", "")}.
              </p>
            ))}
          <p>
            {
              analysis.recommendations.filter(
                (item) => item.type === "similarity",
              ).length
            }{" "}
            historical overlap finding(s) remain.
          </p>
        </section>
      )}
      <section>
        <h2>Limitations</h2>
        {analysis.limitations?.map((x) => (
          <p key={x}>{x}</p>
        ))}
      </section>
    </main>
  );
}
function RevisionDialog({
  q,
  value,
  busy,
  onChange,
  onAccept,
  onRegenerate,
  onCancel,
}: {
  q: Question;
  value: any;
  busy: boolean;
  onChange: (x: any) => void;
  onAccept: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        className="revision-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="revision-title"
      >
        <button
          className="icon-button close"
          aria-label="Close"
          onClick={onCancel}
        >
          <X />
        </button>
        <span>
          {value.mode === "sample-fixture"
            ? "PRE-AUTHORED SAMPLE REVISION"
            : "LIVE AI SUGGESTION"}
        </span>
        <h2 id="revision-title">Review proposed change</h2>
        <div className="diff">
          <div>
            <label>Original</label>
            <p>{q.text}</p>
          </div>
          <div>
            <label>Proposed · editable</label>
            <textarea
              value={value.question}
              onChange={(e) => onChange({ ...value, question: e.target.value })}
            />
          </div>
        </div>
        <p>{value.explanation}</p>
        {value.cloCode && value.cloCode !== q.cloCode && (
          <div className="workspace-alert">
            <AlertTriangle />
            Outcome mapping changes from {q.cloCode} to {value.cloCode}.
            Accepting explicitly approves that change.
          </div>
        )}
        <details>
          <summary>Assumptions and trade-offs</summary>
          <ul>
            {[...(value.assumptions ?? []), ...(value.tradeoffs ?? [])].map(
              (x: string) => (
                <li key={x}>{x}</li>
              ),
            )}
          </ul>
        </details>
        <div className="dialog-actions">
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="secondary" onClick={onRegenerate}>
            Regenerate
          </button>
          <button className="primary" disabled={busy} onClick={onAccept}>
            <Check />
            {busy ? "Saving…" : "Accept edited proposal"}
          </button>
        </div>
      </div>
    </div>
  );
}
function EditDialog({
  q,
  busy,
  onSave,
  onCancel,
}: {
  q: Question;
  busy: boolean;
  onSave: (
    text: string,
    marks: number | null,
    clo: string,
    bloom: Question["bloom"],
  ) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(q.text),
    [marks, setMarks] = useState<number | null>(q.marks),
    [clo, setClo] = useState(q.cloCode),
    [bloom, setBloom] = useState(q.bloom);
  return (
    <div className="dialog-backdrop">
      <div className="revision-dialog" role="dialog" aria-modal="true">
        <h2>Edit question {q.number}</h2>
        <label>
          Question
          <textarea value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="form-grid">
          <label>
            Marks
            <input
              type="number"
              value={marks ?? ""}
              onChange={(e) =>
                setMarks(e.target.value ? Number(e.target.value) : null)
              }
            />
          </label>
          <label>
            Outcome
            <input value={clo} onChange={(e) => setClo(e.target.value)} />
          </label>
          <label>
            Bloom estimate
            <select
              value={bloom}
              onChange={(e) => setBloom(e.target.value as Question["bloom"])}
            >
              {[
                "Unknown",
                "Remember",
                "Understand",
                "Apply",
                "Analyze",
                "Evaluate",
                "Create",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="dialog-actions">
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={busy || text.length < 5}
            onClick={() => onSave(text, marks, clo, bloom)}
          >
            Save new version
          </button>
        </div>
      </div>
    </div>
  );
}
