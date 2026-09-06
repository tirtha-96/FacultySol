# AssessAI architecture

AssessAI separates semantic interpretation from verifiable calculations.

1. Documents enter through a validated multipart endpoint (PDF, DOCX, or text; size-limited).
2. Parsers normalize text and preserve page boundaries when available. Low-quality extraction is reported for faculty correction.
3. The AI adapter returns schema-validated classifications: topic, CLO, Bloom level, difficulty, confidence, reasoning, and candidate similarities. Demo mode uses transparent seeded classifications.
4. The deterministic engine calculates mark totals, distributions, target variance, thresholds, recommendations, and the weighted health indicator.
5. Faculty edits create an approved revision; recalculation produces an immutable analysis version for before/after comparison.

The browser never receives AI credentials. Production persistence is PostgreSQL through Prisma; demo mode can run from the in-memory repository without infrastructure.

## UI information architecture

- Public: landing and product explanation.
- Workspace: dashboard, courses, assessments, reports, settings.
- Assessment workspace: Overview, Alignment, Questions, Similarity, Recommendations, Compare, Report.
- Evidence drawers keep issue → evidence → reasoning → impact → action in context.

## REST contract

All responses use `{ data, meta? }`; failures use `{ error: { code, message, details? } }`.

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/courses` | List or create courses |
| GET | `/api/courses/:id` | Course, CLO, topic, and assessment detail |
| POST | `/api/assessments` | Create an assessment |
| GET | `/api/assessments/:id` | Assessment setup |
| POST | `/api/assessments/:id/documents` | Validate, upload, and extract a document |
| POST | `/api/assessments/:id/analyze` | Run semantic then deterministic analysis |
| GET | `/api/assessments/:id/analysis` | Latest or versioned result |
| GET | `/api/assessments/:id/questions` | Structured editable questions |
| PATCH | `/api/questions/:id` | Record a faculty-approved override |
| POST | `/api/questions/:id/improve` | Produce a review-required alternative |
| GET | `/api/assessments/:id/recommendations` | Prioritized recommendations |
| POST | `/api/recommendations/:id/:decision` | Accept or dismiss a recommendation |
| GET | `/api/assessments/:id/report` | Report-ready analysis payload |
