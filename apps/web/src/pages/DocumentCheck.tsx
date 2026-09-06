import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  ScanText,
  Save,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Question, SourceDocument } from "@assessai/shared";
import { api } from "../api";

export function DocumentCheck({
  assessmentId,
  initialSource,
  onQuestions,
  onComplete,
  onBack,
}: {
  assessmentId: string;
  initialSource: SourceDocument;
  onQuestions: (questions: Question[]) => void;
  onComplete: () => void;
  onBack: () => void;
}) {
  const [source, setSource] = useState(initialSource);
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(initialSource.pages?.[0]?.text ?? "");
  const [originalUrl, setOriginalUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const [visual, setVisual] = useState<any>();
  const [capabilities, setCapabilities] = useState<any>();
  const [issuesOnly, setIssuesOnly] = useState(false);
  const pages = source.pages ?? [];
  const visiblePages = useMemo(
    () =>
      issuesOnly
        ? pages.filter((page) =>
            ["needs-review", "unavailable"].includes(page.status),
          )
        : pages,
    [issuesOnly, pages],
  );
  const page = visiblePages[index] ?? visiblePages[0];

  useEffect(() => {
    setIndex(0);
  }, [issuesOnly]);
  useEffect(() => {
    api.capabilities(assessmentId).then(setCapabilities).catch(() => undefined);
  }, [assessmentId]);
  useEffect(() => {
    setText(page?.text ?? "");
  }, [page?.id, page?.text]);
  useEffect(() => {
    let active = true;
    if (!source.storageKey && !source.originalAvailable) return;
    api.original(assessmentId, source.id).then((url) => {
      if (active) setOriginalUrl(url);
      else URL.revokeObjectURL(url);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [assessmentId, source.id, source.storageKey, source.originalAvailable]);
  useEffect(() => () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
  }, [originalUrl]);

  const apply = async (
    action: "save" | "confirm" | "exclude",
    exclusionReason?: string,
  ) => {
    if (!page) return;
    setBusy(true);
    setSaveState("saving");
    setError("");
    try {
      const result = await api.reviewPage(assessmentId, source.id, page.id, {
        text,
        action,
        exclusionReason,
      });
      setSource(result.source);
      onQuestions(result.questions ?? []);
      setSaveState("saved");
    } catch (cause) {
      setSaveState("error");
      setError(cause instanceof Error ? cause.message : "Could not save page");
    } finally {
      setBusy(false);
    }
  };
  const runOcr = async () => {
    if (!page) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.ocrPage(assessmentId, source.id, page.id);
      setSource(result.source);
      onQuestions(result.questions ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "OCR did not complete");
    } finally {
      setBusy(false);
    }
  };
  const confirmAll = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api.confirmDocument(assessmentId, source.id);
      setSource(result.source);
      onQuestions(result.questions ?? []);
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Document still needs review");
    } finally {
      setBusy(false);
    }
  };
  const inspectVisual = async () => {
    if (!page) return;
    setBusy(true);
    setError("");
    try {
      setVisual(await api.inspectVisual(assessmentId, source.id, page.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Visual inspection did not complete");
    } finally {
      setBusy(false);
    }
  };
  const issueCount = pages.filter((candidate) =>
    ["needs-review", "unavailable"].includes(candidate.status),
  ).length;
  if (!page)
    return <div className="error-box">No source pages were created.</div>;
  const badge =
    page.status === "confirmed"
      ? "Faculty confirmed"
      : page.status === "excluded"
        ? "Excluded"
        : page.status === "unavailable"
          ? "Unavailable"
          : page.extractionMethod === "ocr"
            ? "OCR used"
            : page.status === "needs-review"
              ? "Needs review"
              : "Text extracted";
  return (
    <section className="document-check">
      <div className="document-check-head">
        <div>
          <span className={`document-badge ${page.status}`}>{badge}</span>
          <h2>Document Check</h2>
          <p>Compare the physical page with the extracted text. OCR can misread formulas, tables, diagrams, and multilingual text.</p>
        </div>
        <label className="issues-toggle">
          <input type="checkbox" checked={issuesOnly} onChange={(event) => setIssuesOnly(event.target.checked)} />
          Issues only ({issueCount})
        </label>
      </div>
      <div className="page-toolbar">
        <button className="icon-button" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Previous page"><ChevronLeft /></button>
        <strong>Page {page.displayNumber} of {pages.length}</strong>
        <button className="icon-button" disabled={index >= visiblePages.length - 1} onClick={() => setIndex(index + 1)} aria-label="Next page"><ChevronRight /></button>
        <button className="icon-button" onClick={() => setZoom(Math.max(.6, zoom - .2))} aria-label="Zoom out"><ZoomOut /></button>
        <button className="icon-button" onClick={() => setZoom(Math.min(2, zoom + .2))} aria-label="Zoom in"><ZoomIn /></button>
        <span className={`save-chip ${saveState}`}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Save error" : "Saved"}</span>
      </div>
      <div className="document-split">
        <div className="original-pane">
          <h3><Eye /> Original page</h3>
          {originalUrl ? (
            source.mimeType === "application/pdf" ? (
              <PdfPage
                url={originalUrl}
                pageNumber={page.displayNumber}
                zoom={zoom}
              />
            ) : (
              <img src={originalUrl} alt={`Original uploaded page ${page.displayNumber}`} style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }} />
            )
          ) : (
            <pre className="pasted-original">{page.originalText || "Original preview unavailable. Use the retained upload or provide a manual transcription."}</pre>
          )}
        </div>
        <div className="extraction-pane">
          <h3><ScanText /> Extracted text</h3>
          {page.qualityWarnings.map((warning) => <div className="quality-warning" key={warning}><AlertTriangle /> {warning}</div>)}
          <textarea aria-label={`Extracted text for page ${page.displayNumber}`} value={text} onChange={(event) => setText(event.target.value)} />
          {page.extractionMethod === "faculty-correction" && (
            <details className="extraction-history">
              <summary>Compare original extraction and faculty correction</summary>
              <pre>{page.originalText || "No original text was available."}</pre>
            </details>
          )}
          {typeof page.providerConfidence === "number" && <small>Provider OCR confidence: {Math.round(page.providerConfidence * 100)}%. Faculty verification is still required.</small>}
          <div className="document-actions">
            <button className="secondary" disabled={busy || (!source.storageKey && !source.originalAvailable)} onClick={runOcr}><ScanText /> Request OCR for this page</button>
            <button className="secondary" disabled={busy || (!source.storageKey && !source.originalAvailable)} onClick={inspectVisual}><Eye /> Inspect visual content with Gemini</button>
            <button className="secondary" disabled={busy} onClick={() => apply("save")}><Save /> Save correction</button>
            <button className="primary" disabled={busy || !text.trim()} onClick={() => apply("confirm")}><CheckCircle2 /> Confirm page</button>
            <button className="danger-link" disabled={busy} onClick={() => {
              const reason = window.prompt("Why is this page excluded from analysis?");
              if (reason) apply("exclude", reason);
            }}>Exclude page</button>
          </div>
          {visual && <div className="visual-interpretation"><strong>Gemini visual interpretation — not verified source text</strong><p>{visual.description}</p><ul>{visual.observedElements.map((item: string) => <li key={item}>{item}</li>)}</ul>{visual.limitations.length > 0 && <small>Limitations: {visual.limitations.join(" ")}</small>}</div>}
        </div>
      </div>
      {error && <div className="error-box" role="alert">{error}</div>}
      <details className="provider-setup">
        <summary>Developer provider status</summary>
        <p>Native extraction: {capabilities?.nativeExtraction ?? "checking"} · Document AI OCR: {capabilities?.ocr ?? "checking"} · Gemini analysis/visual: {capabilities?.gemini ?? "checking"}</p>
        <small>Configured means settings are present. Verified means a real request succeeded in this API process.</small>
      </details>
      <div className="setup-actions">
        <button className="secondary" onClick={onBack}>Back</button>
        <button className="primary" disabled={busy} onClick={confirmAll}>Confirm extraction and continue</button>
      </div>
    </section>
  );
}

function PdfPage({
  url,
  pageNumber,
  zoom,
}: {
  url: string;
  pageNumber: number;
  zoom: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let task: any;
    let render: { cancel: () => void; promise: Promise<unknown> } | undefined;
    import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      task = pdfjs.getDocument({ url });
      return task.promise;
    })
      .then(async (document) => {
        const page = await document.getPage(pageNumber);
        if (cancelled || !canvas.current) return;
        const viewport = page.getViewport({ scale: 0.62 * zoom });
        const ratio = window.devicePixelRatio || 1;
        canvas.current.width = Math.floor(viewport.width * ratio);
        canvas.current.height = Math.floor(viewport.height * ratio);
        canvas.current.style.width = `${viewport.width}px`;
        canvas.current.style.height = `${viewport.height}px`;
        const context = canvas.current.getContext("2d");
        if (!context) return;
        const currentRender = page.render({
          canvas: canvas.current,
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        render = currentRender;
        await currentRender.promise;
        if (canvas.current) canvas.current.dataset.rendered = "true";
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "PDF page unavailable");
      });
    return () => {
      cancelled = true;
      render?.cancel();
      task?.destroy();
    };
  }, [url, pageNumber, zoom]);
  return error ? <div className="error-box">{error}</div> : <canvas ref={canvas} aria-label={`Original PDF page ${pageNumber}`} />;
}
