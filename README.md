# AssessAI

> Don’t just create an exam. Know what it measures.

AssessAI is an AI-assisted assessment quality and course-alignment workspace for university faculty. It audits an exam against its CLOs, syllabus topics, cognitive demand, difficulty targets, mark structure, and historical papers. It explains the evidence behind every concern and leaves every academic decision with the faculty member.

## Problem and solution

Faculty frequently review assessment quality by manually cross-referencing several documents. A general chatbot can comment on text, but it lacks durable structure for course outcomes, topic weights, constraints, historical comparisons, score provenance, and faculty overrides. AssessAI creates that structured context and a repeatable review workflow.

The architecture deliberately splits responsibilities:

- AI/semantic layer: meaning, approximate CLO/topic/Bloom/difficulty classification, semantic similarity, explanations, suggestions.
- Deterministic layer: marks, percentages, distributions, thresholds, data validation, recommendation triggers, and weighted score aggregation.
- Faculty layer: validates mappings, reviews evidence, edits or rejects suggestions, and approves revisions.

The health score is an analytical indicator, not an accreditation standard.

## MVP features

- Course, CLO, syllabus-topic, constraint, and assessment context
- PDF/text upload validation with extraction-quality errors
- Structured question review with confidence and faculty-editable classifications
- Mark-weighted CLO, topic, Bloom, and difficulty distributions
- Configurable semantic-similarity thresholds with side-by-side evidence
- Transparent weighted score components
- Prioritized issue → evidence → impact → action explanations
- Review-required question improvements
- Calculated before/after comparison and immutable analysis versions
- Report view and realistic AUST CSE 203 demo data
- Safe offline demo mode that identifies itself as a fixture

## Technology

- Frontend: React 19, Vite, TypeScript, Lucide icons, custom responsive CSS
- API: Node.js, Express 5, TypeScript, Zod, Multer, Helmet
- Data: PostgreSQL, Prisma
- AI boundary: server-side Gemini configuration with schema-validated classification contract; deterministic demo fixture when `DEMO_MODE=true`
- Tests: Vitest, Testing Library, Supertest

## Architecture and folders

```text
apps/web/              React faculty workspace
apps/api/              REST API, upload boundary, demo repository
packages/shared/       Domain types, scoring and recommendation engine, fixtures
database/              Prisma schema and idempotent demo seed
docs/architecture.md   Pipeline, UI information architecture, API contract
```

See [docs/architecture.md](docs/architecture.md) for the API table and processing pipeline.

## Setup

Requirements: Node.js 20+, npm 10+, and PostgreSQL 15+ for persistent mode.

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:4000`.

For the infrastructure-free hackathon demo, leave `DEMO_MODE=true`; database migration and seed can be skipped. The application uses the same scoring engine and UI contracts, but clearly labels saved semantic classifications as demo data.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL Prisma connection |
| `GEMINI_API_KEY` | Server-only AI credential; blank in demo mode |
| `GEMINI_MODEL` | Gemini model name |
| `JWT_SECRET` | Authentication signing secret for production |
| `MAX_UPLOAD_SIZE` | Bytes allowed per document (default 10 MB) |
| `DEMO_MODE` | Uses transparent saved semantic fixtures when true |
| `PORT` / `WEB_ORIGIN` | API port and allowed browser origin |

Secrets never enter the browser bundle.

## API overview

The implemented contract covers courses, assessment creation and retrieval, document ingestion, analysis, questions, similarities within analysis, recommendations, faculty decisions, improvements, and report payloads. Success uses `{ data, meta? }`; errors use `{ error: { code, message, details? } }` without stack traces. Full routes are listed in the architecture document.

## Scoring

Seven normalized components are combined with weights in `DEFAULT_SETTINGS`: CLO alignment 20%, topic coverage 17%, difficulty 13%, Bloom distribution 15%, question diversity 10%, historical similarity 15%, and mark distribution 10%. Target-fit scores are based on absolute divergence from faculty-configured distributions. All raw components and weights are returned with the final score.

## Testing

```bash
npm test
npm run build
```

Tests cover score calculation, CLO coverage, Bloom/difficulty aggregation, total marks, similarity thresholds, before/after improvement, API creation/retrieval/errors, dashboard score rendering, recommendations, and question detail rendering.

## Three-minute demo

1. Choose **Explore live demo** and show the focused faculty dashboard.
2. Select **Analyze new assessment**, point out the four evidence sources, then run analysis.
3. On Overview, explain the computed health score and open **Why this matters**.
4. Open Similarity to compare current and historical questions side by side.
5. Open Questions to show editable classifications and confidence.
6. In Recommendations, review the priority action and apply the two demo improvements.
7. The Compare tab displays the calculated score change and exact faculty-approved revisions.
8. End on Report and reinforce: “AI analyzes and recommends; faculty decides.”

## Manual demo checklist

- Landing CTAs enter the workspace.
- Upload screen handles keyboard focus and responsive layout.
- Processing timeline completes without an infinite spinner.
- Score components add up using displayed weights.
- Why drawer includes issue, evidence, impact, and action.
- Similarity copy never claims plagiarism.
- Improvement produces a higher calculated version and an audit log.
- Invalid/missing/oversized uploads return friendly API errors.
- Demo mode is visibly identified.

## Known limitations

- DOCX extraction is acknowledged at the boundary but requires a production parser worker for full text extraction.
- OCR for scanned PDFs is not bundled; low-quality extraction asks for a text PDF or pasted content.
- The included demo repository is in-memory. Prisma models and seed support persistence, but production route adapters still need to replace the repository implementation.
- PDF report download is represented by a report-ready view/API; browser PDF rendering is not bundled.
- Authentication tables and security boundaries exist, while demo mode intentionally omits sign-in.

## Roadmap

After stabilizing the MVP: durable faculty overrides, asynchronous OCR workers, department review workflows, rubric analysis, longitudinal assessment history, curriculum overlap, SSO/RBAC, encrypted object storage, and institution-level analytics. These remain outside the core assessment-intelligence workflow.
