import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AssessmentPage } from "./pages/Assessment";
import { analyzeAssessment, demoAssessment } from "@assessai/shared";
const analysis = analyzeAssessment(demoAssessment);
const noop = () => {};
afterEach(cleanup);
describe("faculty interface", () => {
  it("renders the consolidated question workspace and honest mode", () => {
    render(
      <AssessmentPage
        assessment={demoAssessment}
        analysis={analysis}
        meta={{ sample: true }}
        onBack={noop}
      />,
    );
    expect(screen.getByText(/Sample mode/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Findings" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Bloom estimate/)).toBeInTheDocument();
  });
  it("shows source-safe historical status", () => {
    render(
      <AssessmentPage
        assessment={{ ...demoAssessment, sources: [] }}
        analysis={{ ...analysis, historicalStatus: "not-assessed" }}
        onBack={noop}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Coverage" }));
    expect(screen.getByText("Not assessed")).toBeInTheDocument();
  });
});
