# Synthetic document fixtures

Every file in `fixtures/documents` is generated synthetic material. Run
`npx tsx scripts/generate-fixtures.ts` to reproduce it.

- `selectable-two-page.pdf`: two physical pages with known question numbers,
  marks, and an “answer any one” instruction.
- `raster-only-scan.pdf`: actual image-only PDF with no text layer.
- `mixed-native-scan.pdf`: native page 1 and image-only page 2.
- `visual-table-equation-diagram.pdf`: a table, formula, and simple graph that
  require original-page inspection; plain extraction is not sufficient proof.
- `document-page.png` / `.jpg`: one-page document image uploads.
- `poor-unreadable.jpg`: deliberately degraded; expected recovery is OCR review,
  manual transcription, exclusion, or replacement—not silent success.
- `bangla-mixed.png`: small Bangla/English raster sample. It is an evaluation
  input, not a claim of processor accuracy.
