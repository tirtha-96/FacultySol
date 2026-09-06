import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  UploadCloud,
} from "lucide-react";
import type { Assessment, Question } from "@assessai/shared";
import { api } from "../api";
import { DocumentCheck } from "./DocumentCheck";
const parseClos = (value: string) =>
  value
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [code, ...rest] = line.split(/[:–-]\s*/);
      return {
        code: code || `CLO-${i + 1}`,
        description: rest.join(" ") || line,
      };
    });
export function SetupReview({
  onBack,
  onOpen,
}: {
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [id, setId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentSource, setCurrentSource] = useState<any>();
  const [sourcesToVerify, setSourcesToVerify] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<
    Partial<Record<"syllabus" | "current-exam" | "historical-exam", File>>
  >({});
  const [form, setForm] = useState({
    courseCode: "",
    courseName: "",
    title: "Midterm examination",
    year: new Date().getFullYear(),
    totalMarks: "",
    duration: 90,
    clos: "CLO-1: ",
    topics: "",
    syllabus: "",
    paper: "",
    history: "",
    historyTitle: "Previous examination",
    historyYear: new Date().getFullYear() - 1,
  });
  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const review = await api.create({
        title: form.title,
        year: Number(form.year),
        totalMarks: form.totalMarks ? Number(form.totalMarks) : null,
        duration: Number(form.duration),
        courseCode: form.courseCode,
        courseName: form.courseName,
        clos: parseClos(form.clos),
        topics: form.topics
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
      });
      setId(review.assessment.id);
      const verificationQueue: any[] = [];
      const uploadFile = async (
        kind: "syllabus" | "current-exam" | "historical-exam",
        title: string,
        year?: number,
      ) => {
        const data = new FormData();
        data.append("kind", kind);
        data.append("title", title);
        if (year) data.append("year", String(year));
        data.append("document", files[kind]!);
        return api.upload(review.assessment.id, data);
      };
      if (files.syllabus) {
        verificationQueue.push(
          await uploadFile("syllabus", `${form.courseCode} syllabus`),
        );
      } else if (form.syllabus.trim()) {
        verificationQueue.push(await api.source(review.assessment.id, {
          kind: "syllabus",
          title: `${form.courseCode} syllabus`,
          text: form.syllabus,
        }));
      }
      const source = files["current-exam"]
        ? await uploadFile("current-exam", form.title, Number(form.year))
        : await api.source(review.assessment.id, {
            kind: "current-exam",
            title: form.title,
            year: Number(form.year),
            text: form.paper,
          });
      setQuestions(source.questions ?? []);
      verificationQueue.push(source);
      if (files["historical-exam"]) {
        verificationQueue.push(await uploadFile(
          "historical-exam",
          form.historyTitle,
          Number(form.historyYear),
        ));
      } else if (form.history.trim()) {
        verificationQueue.push(await api.source(review.assessment.id, {
          kind: "historical-exam",
          title: form.historyTitle,
          year: Number(form.historyYear),
          text: form.history,
        }));
      }
      verificationQueue.sort((a, b) =>
        a.kind === "current-exam" ? -1 : b.kind === "current-exam" ? 1 : 0,
      );
      setSourcesToVerify(verificationQueue);
      setCurrentSource(verificationQueue[0]);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save review");
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await api.patch(id, { questions });
      onOpen(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save questions");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="setup-page">
      <header className="setup-head">
        <button className="icon-button" aria-label="Back" onClick={onBack}>
          <ArrowLeft />
        </button>
        <div>
          <span>FACULTYSOL · NEW REVIEW</span>
          <h1>
            {step === 1
              ? "Add and confirm sources"
              : step === 2
                ? "Verify the original document"
                : "Confirm extracted questions"}
          </h1>
        </div>
        <span className="save-chip">Step {step} of 3</span>
      </header>
      <main className="setup-form">
        <div className="privacy-note">
          <UploadCloud />
          <p>
            <strong>Before live analysis</strong>
            <span>
              Relevant document content is sent to configured Google Document
              AI for OCR and confirmed content to Gemini for analysis. Raw exam
              text is not written to application logs.
            </span>
          </p>
        </div>
        {step === 1 ? (
          <>
            <section className="panel form-grid">
              <h2>Paper identity</h2>
              <label>
                Course code
                <input
                  value={form.courseCode}
                  onChange={(e) =>
                    setForm({ ...form, courseCode: e.target.value })
                  }
                  placeholder="e.g. CSE 203"
                />
              </label>
              <label>
                Course name
                <input
                  value={form.courseName}
                  onChange={(e) =>
                    setForm({ ...form, courseName: e.target.value })
                  }
                  placeholder="Data Structures"
                />
              </label>
              <label>
                Paper title
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label>
                Year
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) =>
                    setForm({ ...form, year: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Total marks (optional)
                <input
                  type="number"
                  value={form.totalMarks}
                  onChange={(e) =>
                    setForm({ ...form, totalMarks: e.target.value })
                  }
                />
              </label>
              <label>
                Duration, minutes
                <input
                  type="number"
                  value={form.duration}
                  onChange={(e) =>
                    setForm({ ...form, duration: Number(e.target.value) })
                  }
                />
              </label>
            </section>
            <section className="panel source-fields">
              <h2>Syllabus and outcomes</h2>
              <p>
                One outcome per line, for example{" "}
                <code>CLO-1: Analyze algorithm complexity</code>. The listed
                outcomes form this paper’s initial assessed scope and can be
                changed later.
              </p>
              <label>
                Course learning outcomes
                <textarea
                  value={form.clos}
                  onChange={(e) => setForm({ ...form, clos: e.target.value })}
                />
              </label>
              <label>
                In-scope topics (comma-separated)
                <input
                  value={form.topics}
                  onChange={(e) => setForm({ ...form, topics: e.target.value })}
                />
              </label>
              <label>
                Syllabus excerpts
                <textarea
                  value={form.syllabus}
                  onChange={(e) =>
                    setForm({ ...form, syllabus: e.target.value })
                  }
                  placeholder="Paste the relevant assessed portion, including CLO descriptions and topics."
                />
              </label>
              <label>
                Or upload syllabus PDF/TXT
                <input
                  type="file"
                  accept=".pdf,.txt,.png,.jpg,.jpeg,application/pdf,text/plain,image/png,image/jpeg"
                  onChange={(e) =>
                    setFiles({ ...files, syllabus: e.target.files?.[0] })
                  }
                />
              </label>
            </section>
            <section className="panel source-fields">
              <h2>Current paper</h2>
              <p>
                Paste text with one question part per line, such as{" "}
                <code>1(a) Explain… (5 marks)</code>. Unknown marks remain
                unknown.
              </p>
              <label>
                Question paper text
                <textarea
                  required
                  value={form.paper}
                  onChange={(e) => setForm({ ...form, paper: e.target.value })}
                  placeholder={"1. Define… (5 marks)\n2(a) Analyze… (10 marks)"}
                />
              </label>
              <label>
                Or upload current paper PDF/TXT
                <input
                  type="file"
                  accept=".pdf,.txt,.png,.jpg,.jpeg,application/pdf,text/plain,image/png,image/jpeg"
                  onChange={(e) =>
                    setFiles({ ...files, "current-exam": e.target.files?.[0] })
                  }
                />
              </label>
            </section>
            <section className="panel source-fields">
              <h2>
                Historical paper <small>optional</small>
              </h2>
              <div className="form-grid">
                <label>
                  Title
                  <input
                    value={form.historyTitle}
                    onChange={(e) =>
                      setForm({ ...form, historyTitle: e.target.value })
                    }
                  />
                </label>
                <label>
                  Year
                  <input
                    type="number"
                    value={form.historyYear}
                    onChange={(e) =>
                      setForm({ ...form, historyYear: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <label>
                Historical questions
                <textarea
                  value={form.history}
                  onChange={(e) =>
                    setForm({ ...form, history: e.target.value })
                  }
                />
              </label>
              <label>
                Or upload historical PDF/TXT
                <input
                  type="file"
                  accept=".pdf,.txt,.png,.jpg,.jpeg,application/pdf,text/plain,image/png,image/jpeg"
                  onChange={(e) =>
                    setFiles({
                      ...files,
                      "historical-exam": e.target.files?.[0],
                    })
                  }
                />
              </label>
            </section>
            <div className="setup-actions">
              <button className="secondary" onClick={onBack}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={
                  busy ||
                  !form.courseCode ||
                  !form.courseName ||
                  (!form.paper.trim() && !files["current-exam"])
                }
                onClick={create}
              >
                {busy ? "Saving…" : "Extract questions"} <ArrowRight />
              </button>
            </div>
          </>
        ) : step === 2 && currentSource ? (
          <DocumentCheck
            key={currentSource.id}
            assessmentId={id}
            initialSource={currentSource}
            onQuestions={(next) => {
              if (currentSource.kind === "current-exam") setQuestions(next);
            }}
            onBack={() => setStep(1)}
            onComplete={() => {
              const next = sourcesToVerify.indexOf(currentSource) + 1;
              if (next < sourcesToVerify.length)
                setCurrentSource(sourcesToVerify[next]);
              else setStep(3);
            }}
          />
        ) : (
          <>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Check the parser’s work</h2>
                  <p>
                    Edit question text, marks, outcome, topic, and estimates
                    before analysis. “Unknown” is valid.
                  </p>
                </div>
                <span>{questions.length} parts</span>
              </div>
              {questions.length === 0 ? (
                <div className="error-box">
                  No question lines were recognized. Go back and use one
                  question per line beginning with a number.
                </div>
              ) : (
                <div className="confirm-list">
                  {questions.map((q, i) => (
                    <article key={q.id}>
                      <strong>{q.number}</strong>
                      <label>
                        Question
                        <textarea
                          value={q.text}
                          onChange={(e) =>
                            setQuestions(
                              questions.map((x, n) =>
                                n === i ? { ...x, text: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Marks
                        <input
                          aria-label={`Marks for ${q.number}`}
                          type="number"
                          value={q.marks ?? ""}
                          onChange={(e) =>
                            setQuestions(
                              questions.map((x, n) =>
                                n === i
                                  ? {
                                      ...x,
                                      marks:
                                        e.target.value === ""
                                          ? null
                                          : Number(e.target.value),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Outcome
                        <input
                          value={q.cloCode}
                          onChange={(e) =>
                            setQuestions(
                              questions.map((x, n) =>
                                n === i ? { ...x, cloCode: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Topic
                        <input
                          value={q.topic}
                          onChange={(e) =>
                            setQuestions(
                              questions.map((x, n) =>
                                n === i ? { ...x, topic: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </label>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <div className="setup-actions">
              <button className="secondary" onClick={() => setStep(2)}>
                <ArrowLeft /> Back
              </button>
              <button
                className="primary"
                disabled={busy || !questions.length}
                onClick={confirm}
              >
                <CheckCircle2 />{" "}
                {busy ? "Saving…" : "Confirm and open workspace"}
              </button>
            </div>
          </>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
