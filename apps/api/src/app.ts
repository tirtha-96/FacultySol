import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import pdf from "pdf-parse";
import { z, ZodError } from "zod";
import { repository } from "./repository.js";

const maxSize = Number(process.env.MAX_UPLOAD_SIZE ?? 10 * 1024 * 1024);
const allowed = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSize },
  fileFilter: (_req, file, cb) =>
    allowed.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error("UNSUPPORTED_FILE")),
});
export const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
const missing = (res: Response) =>
  res
    .status(404)
    .json({
      error: {
        code: "NOT_FOUND",
        message: "The requested assessment resource was not found.",
      },
    });

app.get("/api/health", (_req, res) =>
  res.json({
    data: {
      status: "ok",
      mode: process.env.DEMO_MODE === "false" ? "live" : "demo",
    },
  }),
);
app.get("/api/courses", (_req, res) =>
  res.json({ data: repository.getCourses() }),
);
app.get("/api/courses/:id", (req, res) => {
  const x = repository.getCourse(req.params.id);
  return x ? res.json({ data: x }) : missing(res);
});
app.post("/api/courses", (req, res, next) => {
  try {
    const x = z
      .object({
        code: z.string().min(2).max(20),
        name: z.string().min(2).max(120),
        description: z.string().max(1000).optional(),
      })
      .parse(req.body);
    res.status(201).json({ data: { id: `course-${Date.now()}`, ...x } });
  } catch (e) {
    next(e);
  }
});
app.post("/api/assessments", (req, res, next) => {
  try {
    const x = z
      .object({
        courseId: z.string(),
        title: z.string().min(2),
        year: z.number().int().min(2000).max(2100),
        totalMarks: z.number().positive(),
        duration: z.number().int().positive(),
      })
      .parse(req.body);
    res.status(201).json({ data: repository.createAssessment(x) });
  } catch (e) {
    next(e);
  }
});
app.get("/api/assessments/:id", (req, res) => {
  const x = repository.getAssessment(req.params.id);
  return x ? res.json({ data: x }) : missing(res);
});
app.get("/api/assessments/:id/questions", (req, res) => {
  const x = repository.getAssessment(req.params.id);
  return x ? res.json({ data: x.questions }) : missing(res);
});
app.get("/api/assessments/:id/analysis", (req, res) => {
  const version = req.query.version ? Number(req.query.version) : undefined;
  const x = repository.getAnalysis(req.params.id, version);
  return x
    ? res.json({
        data: x,
        meta: {
          indicatorNotice:
            "AI-assisted indicator; faculty judgment remains final.",
        },
      })
    : missing(res);
});
app.get("/api/assessments/:id/recommendations", (req, res) => {
  const x = repository.getAnalysis(req.params.id);
  return x ? res.json({ data: x.recommendations }) : missing(res);
});
app.get("/api/assessments/:id/report", (req, res) => {
  const a = repository.getAssessment(req.params.id),
    x = repository.getAnalysis(req.params.id);
  return a && x
    ? res.json({
        data: {
          assessment: a,
          analysis: x,
          generatedAt: new Date().toISOString(),
        },
      })
    : missing(res);
});
app.post("/api/assessments/:id/analyze", (req, res) => {
  const x = repository.analyze(req.params.id);
  return x ? res.json({ data: x }) : missing(res);
});
app.post("/api/assessments/:id/apply-demo-improvements", (req, res) => {
  if (!repository.getAssessment(req.params.id)) return missing(res);
  res.json({ data: repository.improve() });
});
app.post("/api/recommendations/:id/:decision", (req, res) => {
  const decision = z
    .enum(["accepted", "dismissed"])
    .safeParse(req.params.decision);
  if (!decision.success)
    return res
      .status(400)
      .json({
        error: {
          code: "INVALID_DECISION",
          message: "Decision must be accepted or dismissed.",
        },
      });
  const x = repository.review(req.params.id, decision.data);
  return x ? res.json({ data: x }) : missing(res);
});
app.post("/api/questions/:id/improve", (req, res) => {
  const q = repository
    .getAssessment("assessment-2026")
    ?.questions.find((x) => x.id === req.params.id);
  if (!q) return missing(res);
  res.json({
    data: {
      questionId: q.id,
      original: q.text,
      suggestion:
        q.id === "q8"
          ? "Design a route-planning strategy for a campus shuttle network. Justify the selected data structures and trace the shortest route from one source."
          : `Revise this prompt to require students to apply, justify, and evaluate: ${q.text}`,
      notice: "AI-generated suggestion — faculty review required.",
    },
  });
});
app.post(
  "/api/assessments/:id/documents",
  upload.single("document"),
  wrap(async (req, res) => {
    if (!repository.getAssessment(String(req.params.id))) return missing(res);
    if (!req.file)
      return res
        .status(400)
        .json({
          error: {
            code: "MISSING_FILE",
            message: "Choose a PDF, DOCX, or text document to upload.",
          },
        });
    let text = "";
    if (req.file.mimetype === "text/plain")
      text = req.file.buffer.toString("utf8");
    if (req.file.mimetype === "application/pdf") {
      try {
        text = (await pdf(req.file.buffer)).text;
      } catch {
        throw new Error("PDF_EXTRACTION_FAILED");
      }
    }
    if (req.file.mimetype.includes("wordprocessing"))
      text =
        "DOCX received. Structured extraction is available in live persistence mode.";
    if (!text.trim())
      return res
        .status(422)
        .json({
          error: {
            code: "LOW_EXTRACTION_QUALITY",
            message:
              "Could not reliably extract text from this document. Upload a text-based PDF or paste the content manually.",
          },
        });
    res
      .status(201)
      .json({
        data: {
          id: `doc-${Date.now()}`,
          filename: req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_"),
          size: req.file.size,
          characters: text.length,
          preview: text.slice(0, 240),
        },
      });
  }),
);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError)
    return res
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Some submitted fields are invalid.",
          details: err.flatten().fieldErrors,
        },
      });
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE")
    return res
      .status(413)
      .json({
        error: {
          code: "FILE_TOO_LARGE",
          message: `Upload must be smaller than ${Math.round(maxSize / 1024 / 1024)} MB.`,
        },
      });
  const message = err instanceof Error ? err.message : "";
  if (message === "UNSUPPORTED_FILE")
    return res
      .status(415)
      .json({
        error: {
          code: "UNSUPPORTED_FILE",
          message: "Only PDF, DOCX, and plain-text files are supported.",
        },
      });
  if (message === "PDF_EXTRACTION_FAILED")
    return res
      .status(422)
      .json({
        error: {
          code: "PDF_EXTRACTION_FAILED",
          message:
            "Could not reliably extract text from this PDF. Upload a text-based PDF or paste the content manually.",
        },
      });
  res
    .status(500)
    .json({
      error: {
        code: "INTERNAL_ERROR",
        message: "AssessAI could not complete the request. Please try again.",
      },
    });
});
