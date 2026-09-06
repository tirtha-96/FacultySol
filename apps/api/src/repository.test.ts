import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DurableRepository } from "./repository";
import { analyzeAssessment } from "@assessai/shared";
import { inputHash } from "./analysis";
describe("durable review versions", () => {
  it("survives a repository restart and rejects another session", () => {
    const file = join(
        mkdtempSync(join(tmpdir(), "facultysol-")),
        "reviews.json",
      ),
      first = new DurableRepository(file),
      created = first.create("owner", {
        title: "Quiz",
        year: 2026,
        totalMarks: 10,
        duration: 30,
        courseCode: "CSE",
        courseName: "Course",
      }),
      id = created.assessment.id,
      second = new DurableRepository(file);
    expect(second.get(id, "owner")?.assessment.title).toBe("Quiz");
    expect(second.get(id, "other")).toBeUndefined();
  });
  it("accept and undo create versions and make prior analysis stale", () => {
    const file = join(
        mkdtempSync(join(tmpdir(), "facultysol-")),
        "reviews.json",
      ),
      repo = new DurableRepository(file),
      r = repo.cloneSample("owner"),
      id = r.assessment.id,
      hash = inputHash(r.assessment);
    repo.addAnalysis(
      id,
      "owner",
      analyzeAssessment(r.assessment, undefined, 2),
      hash,
    );
    const original = r.assessment.questions[0].text;
    repo.revise(
      id,
      "owner",
      "q1",
      { text: "A faculty-edited prompt." },
      "manual",
    );
    expect(repo.get(id, "owner")?.analyses.at(-1)?.stale).toBe(true);
    repo.undo(id, "owner");
    expect(repo.get(id, "owner")?.assessment.questions[0].text).toBe(original);
    expect(repo.get(id, "owner")?.revisions).toHaveLength(2);
  });
  it("rejects a late analysis after its input version changes", () => {
    const file = join(
        mkdtempSync(join(tmpdir(), "facultysol-")),
        "reviews.json",
      ),
      repo = new DurableRepository(file),
      r = repo.cloneSample("owner"),
      id = r.assessment.id,
      oldHash = inputHash(r.assessment);
    repo.revise(id, "owner", "q1", { text: "Newer paper text" }, "edit");
    expect(
      repo.addAnalysis(id, "owner", analyzeAssessment(r.assessment), oldHash),
    ).toBeUndefined();
  });
});
