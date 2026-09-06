import type { Analysis, Assessment, ReviewRecord } from "@assessai/shared";
const API = "/api";
const session = () => {
  let id = localStorage.getItem("facultysol-session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("facultysol-session", id);
  }
  return id;
};
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-facultysol-session": session(),
      ...(init?.body instanceof FormData
        ? {}
        : { "content-type": "application/json" }),
      ...init?.headers,
    },
  });
  const body = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? "Request failed");
  return body?.data as T;
}
export type ReviewSummary = {
  id: string;
  title: string;
  year: number;
  course: Assessment["course"];
  status: string;
  updatedAt: string;
  sample: boolean;
  analysis?: Analysis;
};
export const api = {
  list: () => call<ReviewSummary[]>("/reviews"),
  importSample: () => call<ReviewRecord>("/sample/import", { method: "POST" }),
  create: (body: unknown) =>
    call<ReviewRecord>("/assessments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  get: async (id: string) => {
    const raw = await fetch(`${API}/assessments/${id}`, {
        headers: { "x-facultysol-session": session() },
      }),
      body = await raw.json();
    if (!raw.ok) throw new Error(body.error?.message);
    let assessment = body.data as Assessment,
      analysis: Analysis | undefined;
    try {
      const latest = await call<Analysis>(`/assessments/${id}/analysis`);
      analysis = latest;
      assessment = { ...assessment, questions: latest.questions };
    } catch {}
    return { assessment, analysis, meta: body.meta };
  },
  patch: (id: string, body: unknown) =>
    call<ReviewRecord>(`/assessments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  source: (id: string, body: unknown) =>
    call<any>(`/assessments/${id}/sources`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  upload: (id: string, data: FormData) =>
    call<any>(`/assessments/${id}/documents`, { method: "POST", body: data }),
  capabilities: (id: string) => call<any>(`/assessments/${id}/capabilities`),
  original: async (id: string, sourceId: string) => {
    const response = await fetch(
      `${API}/assessments/${id}/documents/${sourceId}/original`,
      { headers: { "x-facultysol-session": session() } },
    );
    if (!response.ok) throw new Error("Original source is unavailable");
    return URL.createObjectURL(await response.blob());
  },
  reviewPage: (id: string, sourceId: string, pageId: string, body: unknown) =>
    call<any>(`/assessments/${id}/documents/${sourceId}/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  ocrPage: (id: string, sourceId: string, pageId: string) =>
    call<any>(`/assessments/${id}/documents/${sourceId}/pages/${pageId}/ocr`, {
      method: "POST",
    }),
  inspectVisual: (id: string, sourceId: string, pageId: string) =>
    call<any>(`/assessments/${id}/documents/${sourceId}/pages/${pageId}/visual-inspection`, {
      method: "POST",
    }),
  confirmDocument: (id: string, sourceId: string) =>
    call<any>(`/assessments/${id}/documents/${sourceId}/confirm`, {
      method: "POST",
    }),
  analyze: (id: string) =>
    call<Analysis>(`/assessments/${id}/analyze`, { method: "POST" }),
  suggest: (id: string, qid: string, body: unknown) =>
    call<any>(`/assessments/${id}/questions/${qid}/suggest`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  accept: (id: string, qid: string, body: unknown) =>
    call<any>(`/assessments/${id}/questions/${qid}/accept`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  dismiss: (id: string, rid: string, reason = "") =>
    call<any>(`/assessments/${id}/recommendations/${rid}/dismiss`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  undo: (id: string) =>
    call<any>(`/assessments/${id}/undo`, { method: "POST" }),
  report: (id: string) => call<any>(`/assessments/${id}/report`),
  delete: (id: string) =>
    call<void>(`/assessments/${id}`, { method: "DELETE" }),
};
