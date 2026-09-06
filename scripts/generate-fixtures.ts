import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const output = path.resolve("fixtures/documents");
fs.mkdirSync(output, { recursive: true });

async function nativePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const lines of [
    ["SYNTHETIC FIXTURE - SELECTABLE TEXT", "1. Explain queue invariants (5 marks)", "Answer any ONE question."],
    ["2(a) Analyze a graph traversal (8 marks)", "2(b) State the complexity (2 marks)"],
  ]) {
    const page = pdf.addPage([612, 792]);
    lines.forEach((line, index) => page.drawText(line, { x: 55, y: 730 - index * 32, size: 14, font }));
  }
  fs.writeFileSync(path.join(output, "selectable-two-page.pdf"), await pdf.save());
}

const scannedSvg = (text: string, poor = false) => Buffer.from(`
  <svg width="1240" height="1754" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${poor ? "#999" : "white"}"/>
    <g fill="${poor ? "#aaa" : "#111"}" font-family="Arial" font-size="34" ${poor ? 'transform="rotate(-2 620 877)"' : ""}>
      <text x="90" y="150">SYNTHETIC RASTER-ONLY FIXTURE</text>
      <text x="90" y="240">${text}</text>
      <text x="90" y="310">Answer ALL questions. (10 marks)</text>
    </g>
  </svg>`);

async function rasterPdf() {
  const png = await sharp(scannedSvg("3. Compare BFS and DFS")).png().toBuffer();
  fs.writeFileSync(path.join(output, "document-page.png"), png);
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(png);
  const page = pdf.addPage([612, 792]);
  page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
  fs.writeFileSync(path.join(output, "raster-only-scan.pdf"), await pdf.save());
  const mixed = await PDFDocument.create();
  const font = await mixed.embedFont(StandardFonts.Helvetica);
  const native = mixed.addPage([612, 792]);
  native.drawText("1. Define a stack (4 marks)", { x: 55, y: 730, size: 15, font });
  const embedded = await mixed.embedPng(png);
  const scan = mixed.addPage([612, 792]);
  scan.drawImage(embedded, { x: 0, y: 0, width: 612, height: 792 });
  fs.writeFileSync(path.join(output, "mixed-native-scan.pdf"), await mixed.save());
}

async function visualPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText("SYNTHETIC VISUAL INSPECTION FIXTURE", { x: 50, y: 745, size: 15, font });
  page.drawText("4. Use the table and diagram to compute f(n) = n^2 + 1. (10 marks)", { x: 50, y: 705, size: 12, font });
  [["n", "1", "2"], ["f(n)", "2", "5"]].forEach((row, r) => row.forEach((cell, c) => {
    page.drawRectangle({ x: 70 + c * 80, y: 590 - r * 40, width: 80, height: 40, borderColor: rgb(0, 0, 0), borderWidth: 1 });
    page.drawText(cell, { x: 82 + c * 80, y: 605 - r * 40, size: 12, font });
  }));
  page.drawCircle({ x: 400, y: 620, size: 24, borderColor: rgb(0, 0, 0), borderWidth: 2 });
  page.drawCircle({ x: 500, y: 570, size: 24, borderColor: rgb(0, 0, 0), borderWidth: 2 });
  page.drawLine({ start: { x: 423, y: 608 }, end: { x: 477, y: 582 }, thickness: 2 });
  fs.writeFileSync(path.join(output, "visual-table-equation-diagram.pdf"), await pdf.save());
}

async function imageFixtures() {
  await sharp(scannedSvg("5. Identify the shortest path"), { density: 100 }).jpeg({ quality: 90 }).toFile(path.join(output, "document-page.jpg"));
  await sharp(scannedSvg("UNREADABLE CONTENT", true), { density: 65 }).blur(5).jpeg({ quality: 20 }).toFile(path.join(output, "poor-unreadable.jpg"));
  const bangla = Buffer.from(`<svg width="1240" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="60" y="160" font-size="50" font-family="Nirmala UI, sans-serif">সিনথেটিক নমুনা — প্রশ্ন ১: অ্যালগরিদম ব্যাখ্যা করুন।</text><text x="60" y="250" font-size="38" font-family="Arial">Mixed language: Analyze the algorithm. (5 marks)</text></svg>`);
  await sharp(bangla).png().toFile(path.join(output, "bangla-mixed.png"));
}

async function main() {
  await nativePdf();
  await rasterPdf();
  await visualPdf();
  await imageFixtures();
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Fixture generation failed");
  process.exitCode = 1;
});
