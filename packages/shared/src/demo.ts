import type { Assessment } from "./types.js";

const previous = {
  dijkstra: {
    id: "p24-q6",
    year: 2024,
    text: "Describe how Dijkstra's shortest-path algorithm works and trace it on a weighted graph.",
  },
  merge: {
    id: "p25-q4",
    year: 2025,
    text: "Discuss why merge sort may be preferred over other sorting techniques.",
  },
};

export const demoAssessment: Assessment = {
  id: "assessment-2026",
  title: "Final Examination",
  year: 2026,
  totalMarks: 100,
  duration: 180,
  course: {
    id: "cse203",
    code: "CSE 203",
    name: "Data Structures",
    university: "Synthetic demonstration university",
    synthetic: true,
    clos: [
      {
        code: "CLO-1",
        description: "Explain fundamental data structure concepts.",
        targetWeight: 0.25,
      },
      {
        code: "CLO-2",
        description:
          "Analyze algorithmic complexity and data structure performance.",
        targetWeight: 0.25,
      },
      {
        code: "CLO-3",
        description:
          "Design appropriate data structure solutions for computational problems.",
        targetWeight: 0.25,
      },
      {
        code: "CLO-4",
        description: "Implement and evaluate data structures and algorithms.",
        targetWeight: 0.25,
      },
    ],
    topics: [
      { name: "Arrays", targetWeight: 0.15 },
      { name: "Linked Lists", targetWeight: 0.15 },
      { name: "Stacks & Queues", targetWeight: 0.15 },
      { name: "Trees", targetWeight: 0.2 },
      { name: "Graphs", targetWeight: 0.2 },
      { name: "Sorting & Hashing", targetWeight: 0.15 },
    ],
  },
  questions: [
    {
      id: "q1",
      number: "1(a)",
      text: "Define an abstract data type and distinguish it from a concrete data structure.",
      section: "A",
      marks: 5,
      cloCode: "CLO-1",
      topic: "Arrays",
      bloom: "Remember",
      difficulty: "Easy",
      confidence: 0.94,
      concerns: [],
    },
    {
      id: "q2",
      number: "1(b)",
      text: "Explain how a dynamic array grows and state its amortized insertion cost.",
      section: "A",
      marks: 7,
      cloCode: "CLO-2",
      topic: "Arrays",
      bloom: "Understand",
      difficulty: "Easy",
      confidence: 0.91,
      concerns: [],
    },
    {
      id: "q3",
      number: "2(a)",
      text: "Illustrate insertion and deletion in a singly linked list.",
      section: "A",
      marks: 8,
      cloCode: "CLO-1",
      topic: "Linked Lists",
      bloom: "Understand",
      difficulty: "Easy",
      confidence: 0.9,
      concerns: [],
    },
    {
      id: "q4",
      number: "2(b)",
      text: "Write pseudocode to detect a cycle in a linked list and analyze its complexity.",
      section: "B",
      marks: 10,
      cloCode: "CLO-4",
      topic: "Linked Lists",
      bloom: "Apply",
      difficulty: "Moderate",
      confidence: 0.93,
      concerns: [],
    },
    {
      id: "q5",
      number: "3",
      text: "Convert the given infix expression to postfix using a stack and show each step.",
      section: "B",
      marks: 8,
      cloCode: "CLO-4",
      topic: "Stacks & Queues",
      bloom: "Apply",
      difficulty: "Moderate",
      confidence: 0.96,
      concerns: [],
    },
    {
      id: "q6",
      number: "4(a)",
      text: "State two properties of a binary search tree.",
      section: "A",
      marks: 8,
      cloCode: "CLO-1",
      topic: "Trees",
      bloom: "Remember",
      difficulty: "Easy",
      confidence: 0.97,
      concerns: ["Marks may be high for the expected recall response."],
    },
    {
      id: "q7",
      number: "4(b)",
      text: "Construct an AVL tree from the given sequence and show all rotations.",
      section: "B",
      marks: 12,
      cloCode: "CLO-4",
      topic: "Trees",
      bloom: "Apply",
      difficulty: "Moderate",
      confidence: 0.95,
      concerns: [],
    },
    {
      id: "q8",
      number: "5",
      text: "Explain the working principle of Dijkstra's algorithm with an example.",
      section: "B",
      marks: 10,
      cloCode: "CLO-2",
      topic: "Graphs",
      bloom: "Understand",
      difficulty: "Moderate",
      confidence: 0.88,
      concerns: ["High semantic similarity with a previous paper."],
      similarity: {
        score: 0.88,
        kind: "near-identical",
        previous: previous.dijkstra,
        reason:
          "Both prompts require explaining Dijkstra’s algorithm and demonstrating it on a graph.",
      },
    },
    {
      id: "q9",
      number: "6(a)",
      text: "Compare the advantages and disadvantages of merge sort.",
      section: "B",
      marks: 8,
      cloCode: "CLO-2",
      topic: "Sorting & Hashing",
      bloom: "Analyze",
      difficulty: "Moderate",
      confidence: 0.87,
      concerns: [],
      similarity: {
        score: 0.32,
        kind: "shared-topic",
        previous: previous.merge,
        reason:
          "Both concern merge sort, but the current paper asks for trade-off comparison while the prior asks about selection context.",
      },
    },
    {
      id: "q10",
      number: "6(b)",
      text: "Explain collision resolution by separate chaining in a hash table.",
      section: "A",
      marks: 7,
      cloCode: "CLO-1",
      topic: "Sorting & Hashing",
      bloom: "Understand",
      difficulty: "Easy",
      confidence: 0.92,
      concerns: [],
    },
    {
      id: "q11",
      number: "7",
      text: "Analyze the time complexity of breadth-first and depth-first traversal.",
      section: "C",
      marks: 10,
      cloCode: "CLO-2",
      topic: "Graphs",
      bloom: "Analyze",
      difficulty: "Moderate",
      confidence: 0.94,
      concerns: [],
    },
    {
      id: "q12",
      number: "8",
      text: "Choose a suitable queue implementation for the scenario and justify your choice.",
      section: "C",
      marks: 7,
      cloCode: "Unknown",
      topic: "Stacks & Queues",
      bloom: "Evaluate",
      difficulty: "Hard",
      confidence: 0.84,
      concerns: [
        "Missing assumption: the scenario and workload constraints are not provided.",
      ],
    },
  ],
  scope: {
    cloCodes: ["CLO-1", "CLO-2", "CLO-3", "CLO-4"],
    topics: [
      "Arrays",
      "Linked Lists",
      "Stacks & Queues",
      "Trees",
      "Graphs",
      "Sorting & Hashing",
    ],
  },
  sources: [
    {
      id: "sample-syllabus",
      kind: "syllabus",
      title: "Synthetic Data Structures syllabus",
      filename: "sample-syllabus.txt",
      mimeType: "text/plain",
      createdAt: "2026-09-06T00:00:00.000Z",
      text: "CLO-1 Explain fundamental data structure concepts.\nCLO-2 Analyze algorithmic complexity and performance.\nCLO-3 Design appropriate data structure solutions.\nCLO-4 Implement and evaluate data structures and algorithms.",
      locators: [],
    },
    {
      id: "sample-current",
      kind: "current-exam",
      title: "Synthetic final examination 2026",
      year: 2026,
      filename: "sample-current-exam.txt",
      mimeType: "text/plain",
      createdAt: "2026-09-06T00:00:00.000Z",
      text: "Synthetic sample paper. Question text is shown in the confirmed question list.",
      locators: [],
    },
    {
      id: "sample-history",
      kind: "historical-exam",
      title: "Synthetic final examination 2024–2025",
      year: 2025,
      filename: "sample-historical-exams.txt",
      mimeType: "text/plain",
      createdAt: "2026-09-06T00:00:00.000Z",
      text: `${previous.dijkstra.text}\n${previous.merge.text}`,
      locators: [],
    },
  ],
};

// Build exact, internally consistent downloadable sample sources and locators.
const currentSource = demoAssessment.sources!.find(
  (s) => s.id === "sample-current",
)!;
const syllabusSource = demoAssessment.sources!.find(
  (s) => s.id === "sample-syllabus",
)!;
let syllabusOffset = 0;
syllabusSource.locators = syllabusSource.text
  .split("\n")
  .map((excerpt, index) => {
    const start = syllabusSource.text.indexOf(excerpt, syllabusOffset);
    syllabusOffset = start + excerpt.length;
    return {
      sourceId: syllabusSource.id,
      paragraph: index + 1,
      start,
      end: syllabusOffset,
      excerpt,
    };
  });
currentSource.text = demoAssessment.questions
  .map((q) => `${q.number}. ${q.text} (${q.marks} marks)`)
  .join("\n");
let sampleOffset = 0;
currentSource.locators = demoAssessment.questions.map((q, index) => {
  const excerpt = `${q.number}. ${q.text} (${q.marks} marks)`;
  const start = currentSource.text.indexOf(excerpt, sampleOffset);
  sampleOffset = start + excerpt.length;
  const ref = {
    sourceId: currentSource.id,
    paragraph: index + 1,
    start,
    end: sampleOffset,
    excerpt,
  };
  q.sourceRef = ref;
  q.mappingProvenance = "fixture";
  return ref;
});
for (const q of demoAssessment.questions.filter((item) => item.similarity)) {
  q.similarity!.previous.sourceId = "sample-history";
  q.similarity!.previous.title =
    q.similarity!.previous.year === 2024
      ? "Synthetic final 2024"
      : "Synthetic final 2025";
}
const historySource = demoAssessment.sources!.find(
  (s) => s.id === "sample-history",
)!;
let historyOffset = 0;
historySource.locators = historySource.text
  .split("\n")
  .map((excerpt, index) => {
    const start = historySource.text.indexOf(excerpt, historyOffset);
    historyOffset = start + excerpt.length;
    return {
      sourceId: historySource.id,
      paragraph: index + 1,
      start,
      end: historyOffset,
      excerpt,
    };
  });
for (const q of demoAssessment.questions.filter((item) => item.similarity)) {
  const prior = historySource.locators.find(
    (ref) => ref.excerpt === q.similarity!.previous.text,
  );
  q.similarity!.evidence = [q.sourceRef!, ...(prior ? [prior] : [])];
}

export function improvedDemoAssessment(): Assessment {
  const copy = structuredClone(demoAssessment);
  copy.questions = copy.questions.map((q) =>
    q.id === "q8"
      ? {
          ...q,
          text: "Design a route-planning strategy for a campus shuttle network with non-negative edge weights. Justify the data structures and trace the shortest route for one source.",
          cloCode: "CLO-3",
          bloom: "Create",
          difficulty: "Hard",
          similarity: undefined,
          concerns: [],
        }
      : q.id === "q6"
        ? {
            ...q,
            text: "Given a search workload, evaluate whether a balanced BST or hash table is more appropriate and justify the trade-offs.",
            cloCode: "CLO-3",
            bloom: "Evaluate",
            difficulty: "Hard",
            concerns: [],
          }
        : q,
  );
  return copy;
}
