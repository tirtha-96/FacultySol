import { createHash, randomUUID } from "node:crypto";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type {
  SourceBlock,
  SourceDocument,
  SourceKind,
  SourceLocator,
  SourcePage,
} from "@assessai/shared";

const maxPages = Number(process.env.MAX_DOCUMENT_PAGES ?? 80);
const maxPixels = Number(process.env.MAX_IMAGE_PIXELS ?? 40_000_000);
const ocrTimeout = Number(process.env.OCR_TIMEOUT_MS ?? 60_000);

export type CapabilityState =
  | "configured"
  | "unconfigured"
  | "checking"
  | "verified"
  | "failed";
export const providerStatus: {
  ocr: CapabilityState;
  gemini: CapabilityState;
  ocrMessage?: string;
} = {
  ocr:
    process.env.DOCUMENT_AI_PROJECT_ID &&
    process.env.DOCUMENT_AI_LOCATION &&
    process.env.DOCUMENT_AI_PROCESSOR_ID
      ? "configured"
      : "unconfigured",
  gemini: process.env.GEMINI_API_KEY ? "configured" : "unconfigured",
};

const textFromAnchor = (text: string, anchor: any) =>
  (anchor?.textSegments ?? [])
    .map((segment: any) => {
      const start = Number(segment.startIndex ?? 0);
      const end = Number(segment.endIndex ?? 0);
      return text.slice(start, end);
    })
    .join("")
    .trim();

const normalizedRegion = (layout: any) => {
  const vertices = layout?.boundingPoly?.normalizedVertices;
  if (!Array.isArray(vertices) || !vertices.length) return undefined;
  const xs = vertices.map((v: any) => Number(v.x ?? 0));
  const ys = vertices.map((v: any) => Number(v.y ?? 0));
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
};

export interface OcrPageResult {
  text: string;
  blocks: SourceBlock[];
  providerConfidence?: number;
  providerVersion: string;
}

export class DocumentAiOcrAdapter {
  configured() {
    return providerStatus.ocr !== "unconfigured";
  }
  async process(content: Buffer, mimeType: string): Promise<OcrPageResult[]> {
    const project = process.env.DOCUMENT_AI_PROJECT_ID;
    const location = process.env.DOCUMENT_AI_LOCATION;
    const processor = process.env.DOCUMENT_AI_PROCESSOR_ID;
    if (!project || !location || !processor) throw new Error("OCR_NOT_CONFIGURED");
    providerStatus.ocr = "checking";
    const client = new DocumentProcessorServiceClient({
      apiEndpoint: `${location}-documentai.googleapis.com`,
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ocrTimeout);
    try {
      const name = `projects/${project}/locations/${location}/processors/${processor}`;
      const [result] = await client.processDocument(
        {
          name,
          rawDocument: { content: content.toString("base64"), mimeType },
          processOptions: {
            ocrConfig: {
              enableNativePdfParsing: false,
              enableImageQualityScores: true,
            },
          },
        },
        { signal: controller.signal } as any,
      );
      const documentText = result.document?.text ?? "";
      const pages = (result.document?.pages ?? []).map((page: any) => {
        const blocks: SourceBlock[] = (page.blocks ?? []).map(
          (block: any, index: number) => ({
            id: `ocr-block-${index + 1}`,
            text: textFromAnchor(documentText, block.layout?.textAnchor),
            boundingRegion: normalizedRegion(block.layout),
            providerConfidence:
              typeof block.layout?.confidence === "number"
                ? block.layout.confidence
                : undefined,
          }),
        );
        const pageText =
          textFromAnchor(documentText, page.layout?.textAnchor) ||
          blocks.map((block) => block.text).filter(Boolean).join("\n");
        const confidences = blocks
          .map((block) => block.providerConfidence)
          .filter((value): value is number => typeof value === "number");
        return {
          text: pageText,
          blocks,
          providerConfidence: confidences.length
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : undefined,
          providerVersion: "enterprise-document-ocr",
        };
      });
      providerStatus.ocr = "verified";
      providerStatus.ocrMessage = undefined;
      return pages;
    } catch (error) {
      providerStatus.ocr = "failed";
      providerStatus.ocrMessage = "Document AI request failed; credentials, processor, region, limits, and billing may need attention.";
      if (controller.signal.aborted) throw new Error("OCR_TIMEOUT");
      throw new Error("OCR_PROVIDER_ERROR", { cause: error });
    } finally {
      clearTimeout(timer);
      await client.close().catch(() => undefined);
    }
  }
}

export const ocr = new DocumentAiOcrAdapter();

function qualityWarnings(text: string, hasImages: boolean) {
  const warnings: string[] = [];
  if (!text.trim() && hasImages) warnings.push("Image content has no native text layer.");
  const replacement = (text.match(/\uFFFD/g) ?? []).length;
  if (text.length && replacement / text.length > 0.01)
    warnings.push("Text contains many unreadable replacement characters.");
  const control = [...text].filter((char) => {
    const code = char.charCodeAt(0);
    return code < 32 && !"\n\r\t".includes(char);
  }).length;
  if (text.length && control / text.length > 0.01)
    warnings.push("Text order or encoding may be unreliable.");
  if (hasImages && text.trim().length > 0 && text.trim().length < 30)
    warnings.push("Very little native text was found beside page imagery.");
  return warnings;
}

export async function onePagePdf(bytes: Buffer, pageIndex: number) {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: false });
  if (source.isEncrypted) throw new Error("PDF_PASSWORD_PROTECTED");
  const target = await PDFDocument.create();
  const [page] = await target.copyPages(source, [pageIndex]);
  target.addPage(page);
  return Buffer.from(await target.save());
}

async function pdfPages(bytes: Buffer): Promise<SourcePage[]> {
  let loaded;
  try {
    loaded = await getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
    }).promise;
  } catch (error: any) {
    if (/password/i.test(String(error?.name) + String(error?.message)))
      throw new Error("PDF_PASSWORD_PROTECTED");
    throw new Error("PDF_EXTRACTION_FAILED");
  }
  if (loaded.numPages > maxPages) throw new Error("TOO_MANY_PAGES");
  const pages: SourcePage[] = [];
  for (let index = 0; index < loaded.numPages; index++) {
    const page = await loaded.getPage(index + 1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = (content.items as any[]).filter((item) => item.str);
    const blocks: SourceBlock[] = items.map((item, blockIndex) => ({
      id: `native-block-${blockIndex + 1}`,
      text: String(item.str),
      boundingRegion: {
        x: Math.max(0, Number(item.transform?.[4] ?? 0) / viewport.width),
        y: Math.max(
          0,
          1 - Number(item.transform?.[5] ?? 0) / viewport.height,
        ),
        width: Math.max(0, Number(item.width ?? 0) / viewport.width),
        height: Math.max(0, Number(item.height ?? 0) / viewport.height),
      },
    }));
    let text = "";
    let previousY: number | undefined;
    for (const [itemIndex, item] of items.entries()) {
      const y = Number(item.transform?.[5] ?? 0);
      const newline =
        itemIndex > 0 && previousY !== undefined && Math.abs(y - previousY) > 2;
      text += `${newline ? "\n" : text ? " " : ""}${String(item.str)}`;
      previousY = y;
    }
    const operators = await page.getOperatorList();
    const imageOps = new Set([
      OPS.paintImageXObject,
      OPS.paintInlineImageXObject,
      OPS.paintImageMaskXObject,
    ]);
    const hasImages = operators.fnArray.some((operator) => imageOps.has(operator));
    const warnings = qualityWarnings(text, hasImages);
    if (/\b(?:use|shown|following)\b.{0,40}\b(?:table|diagram|figure|graph)\b|\b(?:table|diagram|figure)\b/i.test(text))
      warnings.push("Visual content may be required; verify the original page before interpreting the question.");
    pages.push({
      id: randomUUID(),
      originalPageIndex: index,
      displayNumber: index + 1,
      sourceVersion: 1,
      extractionMethod: text.trim() ? "native" : "unavailable",
      provider: text.trim() ? "pdfjs" : undefined,
      providerVersion: text.trim() ? "6" : undefined,
      text,
      originalText: text,
      extractionRevisions: [{ version: 1, method: text.trim() ? "native" : "unavailable", text, provider: text.trim() ? "pdfjs" : undefined, createdAt: new Date().toISOString() }],
      blocks,
      qualityWarnings: warnings,
      status: !text.trim() ? "unavailable" : warnings.length ? "needs-review" : "extracted",
    });
  }
  await loaded.cleanup();
  return pages;
}

function pageLocators(sourceId: string, pages: SourcePage[]): SourceLocator[] {
  let documentOffset = 0;
  return pages.flatMap((page) => {
    const pageStart = documentOffset;
    documentOffset += page.text.length + 2;
    let localOffset = 0;
    return page.text
      .split(/\n+/)
      .filter(Boolean)
      .map((paragraph, index) => {
        const localStart = page.text.indexOf(paragraph, localOffset);
        localOffset = localStart + paragraph.length;
        return {
          sourceId,
          sourceVersion: page.sourceVersion,
          pageId: page.id,
          page: page.displayNumber,
          paragraph: index + 1,
          start: pageStart + localStart,
          end: pageStart + localOffset,
          excerpt: paragraph.trim(),
          provenance:
            page.extractionMethod === "unavailable"
              ? undefined
              : page.extractionMethod,
        };
      });
  });
}

export function rebuildSource(source: SourceDocument): SourceDocument {
  if (!source.pages) return source;
  source.text = source.pages
    .filter((page) => page.status !== "excluded")
    .map((page) => page.text)
    .join("\n\n");
  source.locators = pageLocators(source.id, source.pages);
  source.extractionStatus = source.pages.some(
    (page) => page.status === "unavailable" || page.status === "needs-review",
  )
    ? "partial"
    : "completed";
  return source;
}

export async function ingestDocument(input: {
  id: string;
  kind: SourceKind;
  title: string;
  year?: number;
  filename: string;
  mimeType: string;
  bytes: Buffer;
  autoOcr?: boolean;
}): Promise<SourceDocument> {
  let pages: SourcePage[];
  if (input.mimeType === "application/pdf") {
    pages = await pdfPages(input.bytes);
    if (input.autoOcr !== false && ocr.configured()) {
      for (const page of pages.filter((candidate) =>
        candidate.qualityWarnings.some((warning) => !warning.startsWith("Visual content")),
      )) {
        try {
          const [result] = await ocr.process(
            await onePagePdf(input.bytes, page.originalPageIndex),
            "application/pdf",
          );
          if (result?.text.trim()) {
            Object.assign(page, {
              text: result.text,
              extractionRevisions: [...(page.extractionRevisions ?? []), { version: page.sourceVersion + 1, method: "ocr", text: result.text, provider: "google-document-ai", createdAt: new Date().toISOString() }],
              blocks: result.blocks,
              extractionMethod: "ocr",
              provider: "google-document-ai",
              providerVersion: result.providerVersion,
              providerConfidence: result.providerConfidence,
              sourceVersion: page.sourceVersion + 1,
              qualityWarnings: [],
              status: "extracted",
            });
          }
        } catch {
          page.status = page.text.trim() ? "needs-review" : "unavailable";
          page.qualityWarnings.push("OCR could not be completed; native text was preserved.");
        }
      }
    }
  } else if (input.mimeType === "text/plain") {
    const text = input.bytes.toString("utf8");
    pages = [makeTextPage(text, "native")];
  } else {
    const metadata = await sharp(input.bytes).metadata().catch(() => null);
    if (!metadata?.width || !metadata.height) throw new Error("IMAGE_DECODE_FAILED");
    if (metadata.width * metadata.height > maxPixels) throw new Error("IMAGE_TOO_LARGE");
    const page = makeTextPage("", "unavailable");
    page.status = "unavailable";
    page.qualityWarnings = ["This image requires OCR or manual transcription."];
    if (ocr.configured()) {
      try {
        const [result] = await ocr.process(input.bytes, input.mimeType);
        if (result?.text.trim()) {
          Object.assign(page, {
            text: result.text,
            extractionRevisions: [...(page.extractionRevisions ?? []), { version: page.sourceVersion + 1, method: "ocr", text: result.text, provider: "google-document-ai", createdAt: new Date().toISOString() }],
            blocks: result.blocks,
            extractionMethod: "ocr",
            provider: "google-document-ai",
            providerVersion: result.providerVersion,
            providerConfidence: result.providerConfidence,
            sourceVersion: page.sourceVersion + 1,
            qualityWarnings: [],
            status: "extracted",
          });
        }
      } catch {
        page.qualityWarnings.push("Document AI OCR did not complete.");
      }
    }
    pages = [page];
  }
  const source: SourceDocument = {
    id: input.id,
    kind: input.kind,
    title: input.title,
    year: input.year,
    filename: input.filename,
    mimeType: input.mimeType,
    text: "",
    locators: [],
    pages,
    sourceVersion: 1,
    sourceHash: createHash("sha256").update(input.bytes).digest("hex"),
    createdAt: new Date().toISOString(),
  };
  return rebuildSource(source);
}

function makeTextPage(
  text: string,
  method: SourcePage["extractionMethod"],
): SourcePage {
  return {
    id: randomUUID(),
    originalPageIndex: 0,
    displayNumber: 1,
    sourceVersion: 1,
    extractionMethod: method,
    provider: method === "native" ? "utf8" : undefined,
    text,
    originalText: text,
    extractionRevisions: [{ version: 1, method, text, provider: method === "native" ? "utf8" : undefined, createdAt: new Date().toISOString() }],
    blocks: text
      ? text.split(/\n+/).filter(Boolean).map((line, index) => ({ id: `text-block-${index + 1}`, text: line }))
      : [],
    qualityWarnings: [],
    status: text.trim() ? "extracted" : "unavailable",
  };
}

export async function rerunOcrForPage(
  source: SourceDocument,
  bytes: Buffer,
  pageIndex: number,
) {
  const page = source.pages?.find((candidate) => candidate.originalPageIndex === pageIndex);
  if (!page) throw new Error("PAGE_NOT_FOUND");
  const content =
    source.mimeType === "application/pdf" ? await onePagePdf(bytes, pageIndex) : bytes;
  const [result] = await ocr.process(content, source.mimeType);
  if (!result?.text.trim()) throw new Error("OCR_EMPTY_RESULT");
  Object.assign(page, {
    text: result.text,
    extractionRevisions: [...(page.extractionRevisions ?? []), { version: page.sourceVersion + 1, method: "ocr", text: result.text, provider: "google-document-ai", createdAt: new Date().toISOString() }],
    blocks: result.blocks,
    extractionMethod: "ocr",
    provider: "google-document-ai",
    providerVersion: result.providerVersion,
    providerConfidence: result.providerConfidence,
    qualityWarnings: [],
    status: "needs-review",
    sourceVersion: page.sourceVersion + 1,
  });
  source.sourceVersion = (source.sourceVersion ?? 1) + 1;
  return rebuildSource(source);
}
