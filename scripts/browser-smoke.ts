import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

async function main() {
  const output = path.resolve("test-results/browser");
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Review a new paper/i }).click();
  await page.getByLabel("Course code").fill("CSE 299");
  await page.getByLabel("Course name").fill("Synthetic Verification");
  await page.getByLabel(/Or upload current paper/i).setInputFiles(
    path.resolve("fixtures/documents/mixed-native-scan.pdf"),
  );
  await page.getByRole("button", { name: /Extract questions/i }).click();
  await page.getByRole("heading", { name: "Document Check" }).waitFor();
  await page.locator('canvas[data-rendered="true"]').waitFor();
  await page.screenshot({ path: path.join(output, "document-check-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: /Confirm page/i }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByLabel("Extracted text for page 2").fill("2. Compare BFS and DFS (10 marks)");
  await page.getByRole("button", { name: /Confirm page/i }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, "document-check-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: /Confirm extraction and continue/i }).click();
  await page.getByRole("heading", { name: /Check the parser/i }).waitFor();
  await page.getByRole("button", { name: /Confirm and open workspace/i }).click();
  const sourcePopup = page.context().waitForEvent("page");
  await page.getByRole("button", { name: /Open original page/i }).click();
  const openedSource = await sourcePopup;
  await openedSource.waitForLoadState("domcontentloaded");
  await openedSource.close();
  await page.getByRole("button", { name: /Run analysis/i }).click();
  await page.getByRole("alert").waitFor();
  const error = await page.getByRole("alert").textContent();
  if (!error?.includes("not configured"))
    throw new Error(`Expected honest unconfigured-provider state, received: ${error}`);

  const sample = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await sample.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await sample.getByRole("button", { name: /Try sample/i }).click();
  await sample.getByText(/Sample mode/i).waitFor();
  await sample.getByRole("button", { name: "Suggest revision" }).first().click();
  await sample.getByRole("button", { name: /Accept edited proposal/i }).click();
  await sample.getByRole("button", { name: /Rerun checks/i }).waitFor();
  await sample.getByRole("button", { name: /Report/, exact: true }).click();
  await sample.emulateMedia({ media: "print" });
  await sample.screenshot({ path: path.join(output, "report-print.png"), fullPage: true });
  await browser.close();
  console.log("Browser smoke passed: upload, mixed-page verification, correction, confirmation, evidence navigation, provider failure state, revision/reanalysis, mobile layout, and print rendering.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
