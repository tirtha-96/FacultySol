import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ingestDocument, rebuildSource } from "./ingestion";

const fixture = (name: string) =>
  fs.readFileSync(path.resolve("../../fixtures/documents", name));

describe("page-aware document ingestion", () => {
  it("preserves physical page numbers and critical native text", async () => {
    const source = await ingestDocument({
      id: "native",
      kind: "current-exam",
      title: "Native fixture",
      filename: "selectable-two-page.pdf",
      mimeType: "application/pdf",
      bytes: fixture("selectable-two-page.pdf"),
      autoOcr: false,
    });
    expect(source.pages).toHaveLength(2);
    expect(source.pages?.map((page) => page.originalPageIndex)).toEqual([0, 1]);
    expect(source.pages?.[1].text).toContain("2(a)");
    expect(source.locators.find((locator) => locator.excerpt.includes("2(a)"))?.page).toBe(2);
  });

  it("keeps a native mixed page and exposes the scanned page as unavailable", async () => {
    const source = await ingestDocument({
      id: "mixed",
      kind: "current-exam",
      title: "Mixed fixture",
      filename: "mixed-native-scan.pdf",
      mimeType: "application/pdf",
      bytes: fixture("mixed-native-scan.pdf"),
      autoOcr: false,
    });
    expect(source.pages?.[0].extractionMethod).toBe("native");
    expect(source.pages?.[0].text).toContain("Define a stack");
    expect(source.pages?.[1].status).toBe("unavailable");
    expect(source.extractionStatus).toBe("partial");
  });

  it("retains original OCR/native text when a faculty correction is saved", async () => {
    const source = await ingestDocument({
      id: "correction",
      kind: "current-exam",
      title: "Correction fixture",
      filename: "selectable-two-page.pdf",
      mimeType: "application/pdf",
      bytes: fixture("selectable-two-page.pdf"),
      autoOcr: false,
    });
    const page = source.pages![0];
    const original = page.originalText;
    page.text = "1. Faculty corrected queue question (5 marks)";
    page.extractionMethod = "faculty-correction";
    page.sourceVersion += 1;
    rebuildSource(source);
    expect(page.originalText).toBe(original);
    expect(source.locators[0].provenance).toBe("faculty-correction");
  });

  it("flags source-dependent visual material for human inspection", async () => {
    const source = await ingestDocument({
      id: "visual",
      kind: "current-exam",
      title: "Visual fixture",
      filename: "visual.pdf",
      mimeType: "application/pdf",
      bytes: fixture("visual-table-equation-diagram.pdf"),
      autoOcr: false,
    });
    expect(source.pages?.[0].qualityWarnings.join(" ")).toMatch(/Visual content/);
    expect(source.pages?.[0].status).toBe("needs-review");
  });
});
