# FacultySol three-minute demo

## Document verification journey

1. Create a custom review and upload `fixtures/documents/mixed-native-scan.pdf`.
2. In **Document Check**, verify native page 1 and that scanned page 2 remains
   visible instead of being silently omitted.
3. With Document AI configured, request OCR for page 2. Without it, enter the
   known synthetic transcription or exclude the page with a reason.
4. Save a correction, compare it with original extraction, confirm pages, and
   confirm extraction. Then confirm question boundaries, marks, choice wording,
   CLOs/topics, and assessed syllabus scope.
5. Run Gemini analysis, open page evidence, accept an edited proposal, reanalyze,
   export JSON, and print the report/student paper.

Use `visual-table-equation-diagram.pdf`, `poor-unreadable.jpg`, and
`bangla-mixed.png` to show honest visual/recovery warnings. These fixtures do
not establish universal OCR, multilingual, equation, or academic accuracy.

## Existing sample journey

1. Start with `npm run dev`, open <http://localhost:5173>, and choose **Try sample**. Point out the persistent “Sample mode · synthetic material” badge.
2. In **Findings**, open the historical overlap for Question 5. Show the current and actual synthetic historical question side by side, then contrast it with Question 6(a), which is labeled “shared topic only.”
3. Open the ambiguous Question 8 and its source evidence. Select **Suggest revision**. The dialog identifies itself as a pre-authored revision tied to this exact sample; it has not changed the paper yet.
4. Edit the proposal if desired, then choose **Accept edited proposal**. The accepted text becomes a saved question version, the previous analysis becomes stale, and FacultySol reruns checks from the changed paper.
5. Open **Coverage**. Show known marks, Unknown counts, CLO/Bloom data tables, and the historical assessment status. Note that charts count leaf parts and do not claim guaranteed coverage across choices.
6. Use **Restore prior version** to demonstrate that undo is another durable version, not destructive history erasure. Rerun checks if prompted.
7. Open **Report**. Show sources, selected scope, unresolved findings, accepted edits, analysis mode/date, and limitations. Use **Print / Save as PDF**, then **Clean question paper** to verify that internal findings are absent.
8. Finish with the header’s **Export JSON** action. The export includes the exact source metadata, paper version, analysis snapshot, and revision history needed to reproduce the review.

For a custom demo, choose **Review a new paper**, paste syllabus/current/historical text, correct the extracted rows, and run analysis. Without `GEMINI_API_KEY`, FacultySol saves the inputs and honestly reports that live AI is unconfigured; it never substitutes sample findings.
