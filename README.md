# FacultySol

> Review your exam before your students take it.

FacultySol is an evidence-backed assessment review assistant for university faculty. It keeps the existing React/Express monorepo and now supports a coherent saved journey: create a review, paste or upload sources, confirm extracted questions, run analysis, inspect evidence, request and accept a revision, rerun checks, and export the result.

## What works

- Pasted text and text-based PDF/TXT ingestion with source identity, full stored text, paragraph/offset locators, file-size and extracted-text limits.
- Faculty confirmation of parsed question text, marks, outcomes, and topics. Unknown values remain visible.
- Server-only Gemini adapter using structured JSON output and Zod validation. Custom content never falls back to sample semantic results.
- Exact evidence validation after documented whitespace normalization (`/\s+/g` becomes one space). Invented/unresolvable quotes are withheld.
- Deterministic leaf-part totals, Unknown buckets, distributions, source-aware findings, and a secondary experimental indicator that excludes unavailable components.
- Historical status is **Not assessed** when no historical paper exists. Similarity distinguishes near-identical, similar-task, and shared-topic comparisons.
- Faculty-controlled suggestion, editable proposal, manual edit, accept, dismissal, undo/restore, immutable analysis snapshots, stale-state handling, and input-hash protection against late responses.
- Durable JSON development storage with atomic writes, isolated anonymous browser sessions, ownership checks, delete API, interrupted-run recovery, print styling, a clean question-paper view, and JSON export.
- A persistent **Sample mode** badge. The sample course, syllabus, papers, and findings are explicitly synthetic.

## Start

Requirements: Node.js 20+ and npm 10+.

```bash
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173>. The API runs at <http://localhost:4000>.

The sample works without infrastructure. To run semantic analysis on a custom paper, put a Gemini API key in the server environment:

```env
GEMINI_API_KEY=your-server-only-key
GEMINI_MODEL=gemini-2.5-flash
```

The integration follows Google's documented `generateContent` endpoint and structured-output configuration. Raw source text is sent only from the API process and is not logged. FacultySol makes no provider-retention claim; consult the provider terms applicable to your account.

## Persistence

Development uses `DEV_DATA_FILE` (default `./data/reviews.json`). Writes use a temporary file plus atomic rename; the file is durable across API restarts and is deliberately gitignored. This adapter is for a single server instance, not horizontally scaled deployment.

The existing PostgreSQL Prisma schema remains a relational production design and seed reference. **The active API does not yet select a Prisma adapter.** No `DATABASE_URL` was configured in this repository, so PostgreSQL persistence was not claimed or tested. A production deployment must add the repository implementation backed by host-supported PostgreSQL; do not deploy the JSON adapter on ephemeral or multi-instance hosting.

## Commands

```bash
npm test
npm run build
npm run dev
```

Tests cover deterministic arithmetic, leaf subparts, unknown mappings, choice-rule limitations, model routing, evidence validation, malformed boundaries, session ownership, revision/undo/stale behavior, stale-response rejection, and durable restart recovery.

## Analysis contract

The model maps confirmed question IDs to primary CLO/topic, estimated Bloom level, editable difficulty estimate, concerns, and source excerpts. Uploaded text is explicitly treated as untrusted data and embedded instructions are ignored. Server code validates IDs, allowed mappings, structured shape, and evidence quotes. Deterministic code then calculates marks and distributions.

The aggregate indicator is experimental. It is not an accreditation judgment, does not come from the model, and does not label a paper “Excellent” or “high risk.” Component values and weights are included in API/JSON output. Dimensions without a faculty target or historical baseline are omitted and the remaining weights are normalized.

## Formats and limits

- Supported: pasted text, TXT, text-based PDF.
- Unsupported: DOCX extraction, OCR/scanned PDFs.
- Defaults: one file per upload, 10 MB per file, 120,000 extracted characters per source, 45-second provider timeout, one bounded retry for transient provider errors.
- Questions should begin on separate lines, for example `2(a) Analyze… (8 marks)`. Faculty confirms the extraction before analysis.

## Current limitations

- PostgreSQL/Prisma route persistence is not wired; JSON is the explicit durable development adapter.
- Authentication is anonymous-session ownership, not institutional SSO. Clearing browser storage loses the session identifier, though records remain on disk.
- PDF page numbers from `pdf-parse` are not reliably preserved; paragraph and character locators are retained. Pasted text uses paragraph/character locators.
- Custom live-provider behavior was implemented and test-doubled, but not exercised against Gemini because no credential was present.
- Similarity is produced by the bounded model comparison; no vector database is used. Scores are indicators, not copying probabilities.
- Choice coverage is offered-question coverage. Guaranteed CLO coverage across answer-any-N combinations is explicitly not calculated.
- Per-question rubrics and contextual follow-up chat were deferred to protect the P0/P1 workflow.

See [docs/architecture.md](docs/architecture.md) and [DEMO.md](DEMO.md).
