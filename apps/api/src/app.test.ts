import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, setAiAdapter } from "./app";
import { repository } from "./repository";
beforeEach(() => repository.reset());
describe("assessment API", () => {
  it("creates an assessment with validation", async () => {
    const r = await request(app).post("/api/assessments").send({
      courseId: "cse203",
      title: "Midterm",
      year: 2026,
      totalMarks: 50,
      duration: 90,
    });
    expect(r.status).toBe(201);
    expect(r.body.data.title).toBe("Midterm");
  });
  it("retrieves calculated sample analysis", async () => {
    const r = await request(app).get(
      "/api/assessments/assessment-2026/analysis",
    );
    expect(r.status).toBe(200);
    expect(r.body.data.components.cloAlignment).toBeTypeOf("number");
  });
  it("retrieves evidence-bearing recommendations", async () => {
    const r = await request(app).get(
      "/api/assessments/assessment-2026/recommendations",
    );
    expect(r.status).toBe(200);
    expect(r.body.data[0]).toHaveProperty("evidence");
  });
  it("returns a safe missing-resource error", async () => {
    const r = await request(app).get("/api/assessments/nope");
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe("NOT_FOUND");
  });
  it("isolates custom reviews by anonymous session", async () => {
    const created = await request(app)
      .post("/api/assessments")
      .set("x-facultysol-session", "owner-a")
      .send({
        courseCode: "CSE 1",
        courseName: "Testing",
        title: "Midterm",
        year: 2026,
        totalMarks: 10,
        duration: 60,
        clos: [],
        topics: [],
      });
    const id = created.body.data.id;
    expect(
      (
        await request(app)
          .get(`/api/assessments/${id}`)
          .set("x-facultysol-session", "owner-a")
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get(`/api/assessments/${id}`)
          .set("x-facultysol-session", "owner-b")
      ).status,
    ).toBe(404);
  });
  it("sends custom confirmed content to the AI adapter without sample substitution", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    let received = "";
    setAiAdapter({
      analyze: async (a) => {
        received = a.questions[0].text;
        return {
          questions: [
            {
              id: a.questions[0].id,
              cloCode: "CLO-1",
              topic: "Graphs",
              bloom: "Analyze",
              difficulty: "Moderate",
              confidence: 0.8,
              concerns: [],
              explanation: "Mapping",
              evidence: [],
            },
          ],
        };
      },
      revise: async () => ({
        question: "Revised question",
        explanation: "x",
        assumptions: [],
        tradeoffs: [],
      }),
    });
    const created = await request(app)
      .post("/api/assessments")
      .set("x-facultysol-session", "ai-test")
      .send({
        courseCode: "CSE 1",
        courseName: "Testing",
        title: "Midterm",
        year: 2026,
        totalMarks: 10,
        duration: 60,
        clos: [{ code: "CLO-1", description: "Analyze" }],
        topics: [{ name: "Graphs" }],
      });
    const id = created.body.data.id;
    await request(app)
      .post(`/api/assessments/${id}/sources`)
      .set("x-facultysol-session", "ai-test")
      .send({
        kind: "current-exam",
        title: "Paper",
        text: "1. Analyze this graph (10 marks)",
      });
    const result = await request(app)
      .post(`/api/assessments/${id}/analyze`)
      .set("x-facultysol-session", "ai-test");
    expect(result.status).toBe(200);
    expect(received).toContain("Analyze this graph");
    expect(result.body.data.generatedBy).toBe("live-ai");
    expect(result.body.data.historicalStatus).toBe("not-assessed");
    delete process.env.GEMINI_API_KEY;
  });
  it("rejects malformed model output without saving a snapshot", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    setAiAdapter({
      analyze: async () => ({ questions: "not-an-array" }) as any,
      revise: async () => ({
        question: "x",
        explanation: "x",
        assumptions: [],
        tradeoffs: [],
      }),
    });
    const created = await request(app)
      .post("/api/assessments")
      .set("x-facultysol-session", "bad-model")
      .send({
        courseCode: "CSE",
        courseName: "Course",
        title: "Quiz",
        year: 2026,
        totalMarks: 5,
        duration: 30,
      });
    const id = created.body.data.id;
    await request(app)
      .post(`/api/assessments/${id}/sources`)
      .set("x-facultysol-session", "bad-model")
      .send({
        kind: "current-exam",
        title: "Paper",
        text: "1. Explain a stack (5 marks)",
      });
    const result = await request(app)
      .post(`/api/assessments/${id}/analyze`)
      .set("x-facultysol-session", "bad-model");
    expect(result.status).toBe(502);
    expect(result.body.error.code).toBe("INVALID_MODEL_OUTPUT");
    expect(
      (
        await request(app)
          .get(`/api/assessments/${id}/analysis`)
          .set("x-facultysol-session", "bad-model")
      ).status,
    ).toBe(404);
    delete process.env.GEMINI_API_KEY;
  });
});
