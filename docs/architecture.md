# FacultySol architecture

## Request path

```text
browser session → Express ownership check → durable repository
       source text/PDF → extraction + stable locators → faculty confirmation
       confirmed input hash → Gemini structured mapping → Zod/ID/quote validation
       validated mappings → deterministic arithmetic → immutable snapshot
       faculty edit → new question version → stale snapshot → reanalysis
```

Uploaded content is untrusted data. The provider system instruction rejects document-embedded directives, and output cannot create unknown question/source IDs or verified quotes that do not occur in stored source text. Whitespace matching collapses consecutive whitespace to one space and trims ends.

## Responsibilities

- **AI adapter:** primary topic/CLO mapping, Bloom and difficulty estimates, wording concerns, bounded historical comparison, targeted revisions.
- **Deterministic engine:** leaf marks, Unknown counts, allocations, target fit, available-component reweighting, finding triggers, snapshot comparisons.
- **Faculty:** confirms parsing and scope, overrides mappings, accepts/edits/dismisses, and owns the paper versions.
- **Repository:** ownership, atomic persistence, versions, decisions, stale flags, interrupted-run recovery, and delete cascade within each serialized review.

Demo semantics are accepted only for a private clone of the exact synthetic sample. Custom reviews require `GEMINI_API_KEY`; otherwise the API returns `AI_NOT_CONFIGURED`.

## State and concurrency

Every semantic run captures a SHA-256 hash of question identity/text/marks, faculty mappings, sources, scope, total, and choice rule. The repository compares that hash immediately before committing the result. A late response for an older paper receives `STALE_ANALYSIS` and cannot replace current work. Duplicate UI submissions are disabled while a request is active.

The development repository writes one JSON store through temp-file + rename. On API boot, any `analyzing` review becomes `interrupted`. The browser owns a random session ID in local storage and sends it on every request; the API never trusts an assessment ID alone.

## Key routes

| Method     | Route                                      | Purpose                                        |
| ---------- | ------------------------------------------ | ---------------------------------------------- |
| GET        | `/api/reviews`                             | Session-owned review list plus sample template |
| POST       | `/api/sample/import`                       | Private synthetic sample clone                 |
| POST/PATCH | `/api/assessments`, `/api/assessments/:id` | Create and confirm a review                    |
| POST       | `/api/assessments/:id/sources`             | Save pasted source text                        |
| POST       | `/api/assessments/:id/documents`           | Extract PDF/TXT source                         |
| POST       | `/api/assessments/:id/analyze`             | Semantic mapping then deterministic snapshot   |
| POST       | `.../questions/:questionId/suggest`        | Targeted, non-mutating proposal                |
| POST       | `.../questions/:questionId/accept`         | Faculty-approved saved version                 |
| POST       | `/api/assessments/:id/undo`                | Restore as another saved version               |
| POST       | `.../recommendations/:recId/dismiss`       | Persist faculty decision                       |
| GET        | `/api/assessments/:id/report`              | Reproducible report/JSON payload               |
| DELETE     | `/api/assessments/:id`                     | Delete owned review and serialized children    |

## Deployment boundary

The checked-in Prisma schema is not the active repository adapter. Use the JSON adapter only for local/single-instance durable development. Production still requires a Prisma repository implementation, migrations for the expanded snapshot/source/version contract, authentication, and host-supported PostgreSQL storage.
