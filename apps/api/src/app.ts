import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import { createHash, randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import {
  analyzeAssessment,
  DEFAULT_SETTINGS,
  improvedDemoAssessment,
} from "@assessai/shared";
import { repository } from "./repository.js";
import {
  GeminiAdapter,
  inputHash,
  parseQuestions,
  ModelResultSchema,
  validateAndApplyModel,
  inspectVisualPage,
  type AiAdapter,
} from "./analysis.js";
import {
  ingestDocument,
  ocr,
  providerStatus,
  rebuildSource,
  rerunOcrForPage,
  onePagePdf,
} from "./ingestion.js";
let ai: AiAdapter = new GeminiAdapter();
export const setAiAdapter = (adapter: AiAdapter) => {
  ai = adapter;
};
const maxSize = Number(process.env.MAX_UPLOAD_SIZE ?? 10 * 1024 * 1024),
  maxChars = Number(process.env.MAX_ANALYSIS_CHARS ?? 120000);
const allowed = new Set([
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg",
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSize, files: 1 },
  fileFilter: (_r, f, cb) =>
    allowed.has(f.mimetype)
      ? cb(null, true)
      : cb(new Error("UNSUPPORTED_FILE")),
});
export const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
const session = (req: Request) =>
  String(req.header("x-facultysol-session") || "local-development-session");
const param = (req: Request, key: string) => String(req.params[key]);
const missing = (res: Response) =>
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "This review was not found or does not belong to this session.",
    },
  });
const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
app.get("/api/health", (_q, res) =>
  res.json({
    data: {
      status: "ok",
      mode: process.env.GEMINI_API_KEY ? "live-capable" : "offline",
      persistence: "durable-json",
    },
  }),
);
app.get("/api/reviews", (req, res) =>
  res.json({ data: repository.list(session(req)) }),
);
app.post("/api/sample/import", (req, res) =>
  res.status(201).json({ data: repository.cloneSample(session(req)) }),
);
const createSchema = z.object({
  title: z.string().min(2),
  year: z.number().int().min(2000).max(2100),
  totalMarks: z.number().positive().nullable(),
  duration: z.number().int().positive(),
  courseCode: z.string().min(1),
  courseName: z.string().min(2),
  university: z.string().optional(),
  clos: z
    .array(
      z.object({
        code: z.string(),
        description: z.string(),
        targetWeight: z.number().min(0).max(1).optional(),
      }),
    )
    .default([]),
  topics: z
    .array(
      z.object({
        name: z.string(),
        targetWeight: z.number().min(0).max(1).optional(),
      }),
    )
    .default([]),
});
app.post("/api/assessments", (req, res, next) => {
  try {
    const legacy = req.body.courseId
      ? {
          ...req.body,
          courseCode: req.body.courseId,
          courseName:
            req.body.courseId === "cse203" ? "Data Structures" : "Course",
        }
      : req.body;
    const created = repository.create(session(req), createSchema.parse(legacy));
    res.status(201).json({ data: { ...created, ...created.assessment } });
  } catch (e) {
    next(e);
  }
});
app.get("/api/assessments/:id", (req, res) => {
  const r = repository.get(param(req, "id"), session(req));
  return r
    ? res.json({
        data: r.assessment,
        meta: {
          status: r.status,
          sample: r.sample,
          updatedAt: r.updatedAt,
          revisions: r.revisions,
          previousAnalysis:
            r.analyses.length > 1 ? r.analyses.at(-2) : undefined,
        },
      })
    : missing(res);
});
app.patch("/api/assessments/:id", (req, res) => {
  const schema = z.object({
    title: z.string().optional(),
    totalMarks: z.number().positive().nullable().optional(),
    duration: z.number().positive().optional(),
    questions: z.array(z.any()).optional(),
    scope: z
      .object({ cloCodes: z.array(z.string()), topics: z.array(z.string()) })
      .optional(),
    choiceRule: z
      .object({
        answerAny: z.number().int().positive(),
        offered: z.number().int().positive(),
        marksPerQuestion: z.number().positive().optional(),
      })
      .optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Review fields are invalid.",
        details: parsed.error.flatten(),
      },
    });
  const r = repository.updateAssessment(
    param(req, "id"),
    session(req),
    parsed.data,
  );
  return r ? res.json({ data: r }) : missing(res);
});
app.get("/api/assessments/:id/questions", (req, res) => {
  const r = repository.get(param(req, "id"), session(req));
  return r ? res.json({ data: r.assessment.questions }) : missing(res);
});
app.get("/api/assessments/:id/analysis", (req, res) => {
  const r = repository.get(param(req, "id"), session(req));
  if (!r) return missing(res);
  const version = req.query.version ? Number(req.query.version) : undefined;
  const a = version
    ? r.analyses.find((x) => x.version === version)
    : r.analyses.at(-1);
  return a
    ? res.json({ data: a, meta: { status: r.status } })
    : res.status(404).json({
        error: {
          code: "NO_ANALYSIS",
          message: "This review has not been analyzed yet.",
        },
      });
});
app.get("/api/assessments/:id/recommendations", (req, res) => {
  const r = repository.get(param(req, "id"), session(req));
  return r?.analyses.at(-1)
    ? res.json({ data: r.analyses.at(-1)!.recommendations })
    : missing(res);
});
const sourceFields = z.object({
  kind: z.enum(["syllabus", "current-exam", "historical-exam"]),
  title: z.string().min(1).max(160),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
});
app.post(
  "/api/assessments/:id/documents",
  upload.single("document"),
  wrap(async (req, res) => {
    if (!repository.get(param(req, "id"), session(req))) return missing(res);
    if (!req.file)
      return res.status(400).json({
        error: {
          code: "MISSING_FILE",
          message: "Choose a text-based PDF or TXT file.",
        },
      });
    const fields = sourceFields.parse(req.body);
    const cacheKey = createHash("sha256")
      .update(req.file.buffer)
      .update(`pdfjs-6:${process.env.DOCUMENT_AI_LOCATION ?? ""}:${process.env.DOCUMENT_AI_PROCESSOR_ID ?? ""}:enterprise-document-ocr`)
      .digest("hex");
    const cached = repository
      .get(param(req, "id"), session(req))
      ?.assessment.sources?.find(
        (candidate) =>
          candidate.kind === fields.kind && candidate.extractionCacheKey === cacheKey,
      );
    if (cached)
      return res.status(200).json({
        data: {
          ...cached,
          text: undefined,
          storageKey: undefined,
          preview: cached.text.slice(0, 300),
          questions:
            cached.kind === "current-exam"
              ? parseQuestions(cached.text, cached.id, cached)
              : undefined,
          cached: true,
        },
      });
    const id = randomUUID();
    const source = await ingestDocument({
      id,
      ...fields,
      filename: req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_"),
      mimeType: req.file.mimetype,
      bytes: req.file.buffer,
    });
    source.extractionCacheKey = cacheKey;
    if (source.text.length > maxChars)
      return res.status(413).json({
        error: {
          code: "CONTENT_TOO_LONG",
          message: `Extracted text exceeds the ${maxChars.toLocaleString()} character analysis limit. Split the document before continuing.`,
        },
      });
    source.storageKey = repository.storeOriginal(
      param(req, "id"),
      session(req),
      id,
      req.file.buffer,
    );
    source.originalAvailable = true;
    const questions =
      fields.kind === "current-exam"
        ? parseQuestions(source.text, id, source)
        : undefined;
    repository.addSource(
      param(req, "id"),
      session(req),
      source,
      questions,
    );
    res.status(201).json({
      data: {
        ...source,
        text: undefined,
        storageKey: undefined,
        preview: source.text.slice(0, 300),
        questions,
      },
    });
  }),
);
app.post("/api/assessments/:id/sources", wrap(async (req, res) => {
  const body = z
    .object({
      kind: z.enum(["syllabus", "current-exam", "historical-exam"]),
      title: z.string().min(1),
      year: z.number().optional(),
      text: z.string().min(1).max(maxChars),
    })
    .parse(req.body);
  const id = randomUUID();
  const source = await ingestDocument({
    id,
    ...body,
    filename: `${body.title}.txt`,
    mimeType: "text/plain",
    bytes: Buffer.from(body.text),
    autoOcr: false,
  });
  source.pages?.forEach((page) => {
    page.extractionMethod = "pasted";
    page.provider = "faculty-pasted-text";
  });
  rebuildSource(source);
  const questions =
    body.kind === "current-exam"
      ? parseQuestions(body.text, id, source)
      : undefined;
  const saved = repository.addSource(
    param(req, "id"),
    session(req),
    source,
    questions,
  );
  return saved
    ? res.status(201).json({
        data: {
          ...source,
          questions,
        },
      })
    : missing(res);
}));

app.get("/api/assessments/:id/capabilities", (req, res) => {
  if (!repository.get(param(req, "id"), session(req))) return missing(res);
  return res.json({
    data: {
      nativeExtraction: "configured",
      ocr: providerStatus.ocr,
      gemini: providerStatus.gemini,
      visualInterpretation: process.env.GEMINI_API_KEY ? "configured" : "unconfigured",
      ocrMessage: providerStatus.ocrMessage,
    },
  });
});

app.get("/api/assessments/:id/documents/:sourceId/original", (req, res) => {
  const review = repository.get(param(req, "id"), session(req));
  const source = review?.assessment.sources?.find(
    (candidate) => candidate.id === param(req, "sourceId"),
  );
  if (!source) return missing(res);
  const bytes = repository.readOriginal(
    param(req, "id"),
    session(req),
    source.id,
  );
  if (!bytes) return missing(res);
  res.type(source.mimeType);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Disposition", `inline; filename="${source.filename ?? "source"}"`);
  return res.send(bytes);
});

const pageReviewSchema = z.object({
  text: z.string().max(maxChars).optional(),
  action: z.enum(["save", "confirm", "exclude"]).default("save"),
  exclusionReason: z.string().min(3).max(500).optional(),
});
app.patch("/api/assessments/:id/documents/:sourceId/pages/:pageId", (req, res) => {
  const review = repository.get(param(req, "id"), session(req));
  const source = review?.assessment.sources?.find(
    (candidate) => candidate.id === param(req, "sourceId"),
  );
  const page = source?.pages?.find((candidate) => candidate.id === param(req, "pageId"));
  if (!review || !source || !page) return missing(res);
  const body = pageReviewSchema.parse(req.body);
  if (body.action === "exclude" && !body.exclusionReason)
    return res.status(400).json({ error: { code: "EXCLUSION_REASON_REQUIRED", message: "Explain why this page is excluded." } });
  if (body.text !== undefined && body.text !== page.text) {
    page.text = body.text;
    page.extractionMethod = "faculty-correction";
    page.correctedAt = new Date().toISOString();
    page.sourceVersion += 1;
    page.extractionRevisions = [
      ...(page.extractionRevisions ?? []),
      {
        version: page.sourceVersion,
        method: "faculty-correction",
        text: body.text,
        provider: "faculty",
        createdAt: new Date().toISOString(),
      },
    ];
    page.blocks = [{ id: `faculty-${page.sourceVersion}`, text: body.text }];
  }
  if (body.action === "confirm") {
    page.status = "confirmed";
    page.confirmedAt = new Date().toISOString();
    page.exclusionReason = undefined;
  } else if (body.action === "exclude") {
    page.status = "excluded";
    page.exclusionReason = body.exclusionReason;
  } else if (body.text !== undefined) page.status = "needs-review";
  source.sourceVersion = (source.sourceVersion ?? 1) + 1;
  rebuildSource(source);
  const questions = source.kind === "current-exam"
    ? parseQuestions(source.text, source.id, source)
    : undefined;
  repository.updateSource(param(req, "id"), session(req), source, questions);
  return res.json({ data: { source, questions } });
});

app.post("/api/assessments/:id/documents/:sourceId/confirm", (req, res) => {
  const review = repository.get(param(req, "id"), session(req));
  const source = review?.assessment.sources?.find(
    (candidate) => candidate.id === param(req, "sourceId"),
  );
  if (!review || !source?.pages) return missing(res);
  const unavailable = source.pages.filter((page) => page.status === "unavailable");
  if (unavailable.length)
    return res.status(409).json({
      error: {
        code: "UNREADABLE_PAGES",
        message: `${unavailable.length} page(s) still require transcription, OCR, replacement, or explicit exclusion.`,
      },
    });
  const now = new Date().toISOString();
  source.pages.forEach((page) => {
    if (page.status !== "excluded") {
      page.status = "confirmed";
      page.confirmedAt = now;
    }
  });
  source.sourceVersion = (source.sourceVersion ?? 1) + 1;
  rebuildSource(source);
  const questions = source.kind === "current-exam"
    ? parseQuestions(source.text, source.id, source)
    : undefined;
  repository.updateSource(param(req, "id"), session(req), source, questions);
  return res.json({ data: { source, questions } });
});

app.post(
  "/api/assessments/:id/documents/:sourceId/pages/:pageId/ocr",
  wrap(async (req, res) => {
    const review = repository.get(param(req, "id"), session(req));
    const source = review?.assessment.sources?.find(
      (candidate) => candidate.id === param(req, "sourceId"),
    );
    const page = source?.pages?.find((candidate) => candidate.id === param(req, "pageId"));
    if (!review || !source || !page) return missing(res);
    const bytes = repository.readOriginal(param(req, "id"), session(req), source.id);
    if (!bytes) return missing(res);
    await rerunOcrForPage(source, bytes, page.originalPageIndex);
    const questions = source.kind === "current-exam"
      ? parseQuestions(source.text, source.id, source)
      : undefined;
    repository.updateSource(param(req, "id"), session(req), source, questions);
    return res.json({ data: { source, questions } });
  }),
);

app.post(
  "/api/assessments/:id/documents/:sourceId/pages/:pageId/visual-inspection",
  wrap(async (req, res) => {
    const review = repository.get(param(req, "id"), session(req));
    const source = review?.assessment.sources?.find(
      (candidate) => candidate.id === param(req, "sourceId"),
    );
    const page = source?.pages?.find((candidate) => candidate.id === param(req, "pageId"));
    if (!review || !source || !page) return missing(res);
    if (!process.env.GEMINI_API_KEY)
      return res.status(503).json({ error: { code: "AI_NOT_CONFIGURED", message: "Gemini visual inspection is not configured. Verify the original manually or add a faculty correction." } });
    const original = repository.readOriginal(param(req, "id"), session(req), source.id);
    if (!original) return missing(res);
    const content = source.mimeType === "application/pdf"
      ? await onePagePdf(original, page.originalPageIndex)
      : original;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(process.env.AI_TIMEOUT_MS ?? 45000));
    try {
      providerStatus.gemini = "checking";
      const result = await inspectVisualPage(
        content,
        source.mimeType,
        { sourceId: source.id, pageId: page.id, page: page.displayNumber, confirmedText: page.text },
        controller.signal,
      );
      providerStatus.gemini = "verified";
      return res.json({ data: { ...result, sourceRef: { sourceId: source.id, sourceVersion: page.sourceVersion, pageId: page.id, page: page.displayNumber }, provenance: "gemini-visual-interpretation" } });
    } catch (error) {
      providerStatus.gemini = "failed";
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }),
);
app.post(
  "/api/assessments/:id/analyze",
  wrap(async (req, res) => {
    const r = repository.get(param(req, "id"), session(req));
    if (!r) return missing(res);
    const blockedPages = (r.assessment.sources ?? [])
      .filter((source) => source.kind === "current-exam")
      .flatMap((source) => source.pages ?? [])
      .filter((page) => page.status === "unavailable");
    if (blockedPages.length)
      return res.status(409).json({
        error: {
          code: "DOCUMENT_REVIEW_REQUIRED",
          message: `${blockedPages.length} current-paper page(s) have no usable text. Correct, OCR, or explicitly exclude them before analysis.`,
        },
      });
    if (r.assessment.questions.some((question) => question.visualReviewRequired))
      return res.status(409).json({
        error: {
          code: "VISUAL_REVIEW_REQUIRED",
          message: "At least one question depends on unverified visual content. Confirm its original page or explicitly exclude it before analysis.",
        },
      });
    const hash = inputHash(r.assessment);
    const totalCharacters = (r.assessment.sources ?? []).reduce(
      (sum, source) => sum + source.text.length,
      0,
    );
    if (totalCharacters > maxChars)
      return res
        .status(413)
        .json({
          error: {
            code: "ANALYSIS_TOO_LONG",
            message: `Combined source text is ${totalCharacters.toLocaleString()} characters; the configured limit is ${maxChars.toLocaleString()}. Nothing was truncated. Narrow the assessed syllabus scope or split the review.`,
          },
        });
    if (r.sample) {
      const analysis = analyzeAssessment(
        r.assessment,
        DEFAULT_SETTINGS,
        r.analyses.length + 1,
        "demo-fixture",
      );
      const saved = repository.addAnalysis(
        param(req, "id"),
        session(req),
        analysis,
        hash,
      );
      return res.json({ data: saved });
    }
    if (!process.env.GEMINI_API_KEY)
      return res.status(503).json({
        error: {
          code: "AI_NOT_CONFIGURED",
          message:
            "Live AI is not configured. Add GEMINI_API_KEY on the server. Your confirmed inputs are saved; no sample findings were substituted.",
        },
      });
    repository.markAnalyzing(param(req, "id"), session(req));
    const controller = new AbortController(),
      timer = setTimeout(
        () => controller.abort(),
        Number(process.env.AI_TIMEOUT_MS ?? 45000),
      );
    try {
      const analyzedAssessment = structuredClone(r.assessment);
      let model;
      try {
        providerStatus.gemini = "checking";
        model = ModelResultSchema.parse(
          await ai.analyze(analyzedAssessment, controller.signal),
        );
        providerStatus.gemini = "verified";
      } catch (error) {
        providerStatus.gemini = "failed";
        if (error instanceof ZodError) throw new Error("INVALID_MODEL_OUTPUT");
        throw error;
      }
      validateAndApplyModel(analyzedAssessment, model);
      const analysis = analyzeAssessment(
        analyzedAssessment,
        DEFAULT_SETTINGS,
        r.analyses.length + 1,
        "live-ai",
      );
      const saved = repository.addAnalysis(
        param(req, "id"),
        session(req),
        analysis,
        hash,
      );
      if (!saved)
        return res.status(409).json({
          error: {
            code: "STALE_ANALYSIS",
            message:
              "The paper changed while analysis was running. The outdated response was not saved.",
          },
        });
      return res.json({ data: saved });
    } catch (error) {
      repository.markInterrupted(param(req, "id"), session(req));
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }),
);
app.post(
  "/api/assessments/:id/questions/:questionId/suggest",
  wrap(async (req, res) => {
    const r = repository.get(param(req, "id"), session(req)),
      q = r?.assessment.questions.find(
        (x) => x.id === param(req, "questionId"),
      );
    if (!r || !q) return missing(res);
    if (r.sample) {
      const improved = improvedDemoAssessment().questions.find(
        (x) => x.id === q.id,
      );
      return res.json({
        data: {
          question:
            improved?.text ??
            `Clarify the required inputs and output for: ${q.text}`,
          cloCode: improved?.cloCode ?? q.cloCode,
          bloom: improved?.bloom ?? q.bloom,
          explanation:
            "Pre-authored sample revision tied to this exact synthetic paper version.",
          assumptions: ["The question retains its existing marks."],
          tradeoffs: [
            "A more specific task may require additional reading time.",
          ],
          mode: "sample-fixture",
        },
      });
    }
    if (!process.env.GEMINI_API_KEY)
      return res.status(503).json({
        error: {
          code: "AI_NOT_CONFIGURED",
          message:
            "Live revision requires GEMINI_API_KEY. No fixture was used for this custom paper.",
        },
      });
    const controller = new AbortController(),
      timer = setTimeout(
        () => controller.abort(),
        Number(process.env.AI_TIMEOUT_MS ?? 45000),
      );
    try {
      return res.json({
        data: {
          ...(await ai.revise(
            { question: q, assessment: r.assessment, ...req.body },
            controller.signal,
          )),
          mode: "live-ai",
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }),
);
app.post("/api/assessments/:id/questions/:questionId/accept", (req, res) => {
  const body = z
    .object({
      text: z.string().min(5),
      marks: z.number().positive().nullable().optional(),
      cloCode: z.string().optional(),
      bloom: z
        .enum([
          "Remember",
          "Understand",
          "Apply",
          "Analyze",
          "Evaluate",
          "Create",
          "Unknown",
        ])
        .optional(),
      rationale: z.string().default("Faculty-approved revision"),
    })
    .parse(req.body);
  const revision = repository.revise(
    param(req, "id"),
    session(req),
    param(req, "questionId"),
    Object.fromEntries(
      Object.entries({
        text: body.text,
        marks: body.marks,
        cloCode: body.cloCode,
        bloom: body.bloom,
      }).filter(([, value]) => value !== undefined),
    ),
    body.rationale,
  );
  return revision ? res.json({ data: revision }) : missing(res);
});
app.post("/api/assessments/:id/undo", (req, res) => {
  const x = repository.undo(param(req, "id"), session(req));
  return x ? res.json({ data: x }) : missing(res);
});
app.post("/api/assessments/:id/recommendations/:recId/dismiss", (req, res) => {
  const x = repository.decision(
    param(req, "id"),
    session(req),
    param(req, "recId"),
    "dismissed",
    z.object({ reason: z.string().max(500).optional() }).parse(req.body).reason,
  );
  return x ? res.json({ data: x }) : missing(res);
});
app.get("/api/assessments/:id/report", (req, res) => {
  const r = repository.get(param(req, "id"), session(req));
  return r?.analyses.at(-1)
    ? res.json({
        data: {
          assessment: r.assessment,
          analysis: r.analyses.at(-1),
          sources: r.assessment.sources?.map(({ text, ...s }) => s),
          documentCoverage: r.assessment.sources?.map((source) => ({
            sourceId: source.id,
            sourceVersion: source.sourceVersion,
            title: source.title,
            totalPages: source.pages?.length ?? 1,
            extractionMethods: [...new Set(source.pages?.map((page) => page.extractionMethod) ?? ["pasted"])],
            confirmedPages: source.pages?.filter((page) => page.status === "confirmed").map((page) => page.displayNumber) ?? [],
            excludedPages: source.pages?.filter((page) => page.status === "excluded").map((page) => ({ page: page.displayNumber, reason: page.exclusionReason })) ?? [],
            pagesNeedingReview: source.pages?.filter((page) => ["needs-review", "unavailable"].includes(page.status)).map((page) => page.displayNumber) ?? [],
          })),
          analysisMode: r.analyses.at(-1)?.generatedBy,
          analysisVersion: r.analyses.at(-1)?.version,
          remainingLimitations: [
            "OCR and quote matching do not prove educational interpretation is correct.",
            "Gemini visual descriptions are interpretations, not verified source transcription.",
            ...(r.analyses.at(-1)?.limitations ?? []),
          ],
          revisions: r.revisions,
          generatedAt: new Date().toISOString(),
        },
      })
    : missing(res);
});
app.delete("/api/assessments/:id", (req, res) =>
  repository.delete(param(req, "id"), session(req))
    ? res.status(204).end()
    : missing(res),
);
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Some submitted fields are invalid.",
        details: err.flatten().fieldErrors,
      },
    });
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE")
    return res.status(413).json({
      error: {
        code: "FILE_TOO_LARGE",
        message: `File must be smaller than ${Math.round(maxSize / 1048576)} MB.`,
      },
    });
  const msg = err instanceof Error ? err.message : "";
  if (msg === "UNSUPPORTED_FILE")
    return res.status(415).json({
      error: {
        code: "UNSUPPORTED_FILE",
        message: "Supported formats are PDF, TXT, PNG, and JPEG. DOCX is not supported.",
      },
    });
  if (msg === "OCR_NOT_CONFIGURED")
    return res.status(503).json({
      error: {
        code: "OCR_NOT_CONFIGURED",
        message: "Document AI OCR is not configured. The original remains available for manual transcription or replacement upload.",
      },
    });
  if (msg.startsWith("OCR_"))
    return res.status(502).json({
      error: {
        code: msg,
        message: "Document AI OCR did not complete. Existing extraction and the original are preserved.",
      },
    });
  if (msg === "PDF_PASSWORD_PROTECTED")
    return res.status(422).json({
      error: { code: msg, message: "Password-protected PDFs cannot be processed. Upload an unlocked copy." },
    });
  if (msg === "TOO_MANY_PAGES" || msg === "IMAGE_TOO_LARGE")
    return res.status(413).json({
      error: { code: msg, message: "This document exceeds the configured page or pixel limit. Split or resize it without removing required content." },
    });
  if (msg === "PDF_EXTRACTION_FAILED")
    return res.status(422).json({
      error: {
        code: "PDF_EXTRACTION_FAILED",
        message:
          "This PDF could not be read. Try a text-based PDF or paste its text.",
      },
    });
  if (msg.includes("PROVIDER_") || msg === "AbortError")
    return res.status(502).json({
      error: {
        code: "AI_PROVIDER_ERROR",
        message:
          "The AI provider did not complete the analysis. Inputs remain saved; retry when the service is available.",
      },
    });
  if (
    msg === "INVALID_MODEL_OUTPUT" ||
    msg.includes("parse") ||
    err instanceof SyntaxError
  )
    return res.status(502).json({
      error: {
        code: "INVALID_MODEL_OUTPUT",
        message:
          "The AI provider returned an invalid structured response. Nothing was saved.",
      },
    });
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message:
        "FacultySol could not complete the request. Your saved inputs were preserved.",
    },
  });
});
