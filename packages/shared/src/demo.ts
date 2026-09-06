import type { Assessment } from './types.js';

const previous = {
  dijkstra: { id:'p24-q6', year:2024, text:"Describe how Dijkstra's shortest-path algorithm works and trace it on a weighted graph." },
  merge: { id:'p25-q4', year:2025, text:'Discuss why merge sort may be preferred over other sorting techniques.' },
};

export const demoAssessment: Assessment = {
  id:'assessment-2026', title:'Final Examination', year:2026, totalMarks:100, duration:180,
  course:{ id:'cse203', code:'CSE 203', name:'Data Structures', university:'Ahsanullah University of Science and Technology',
    clos:[
      {code:'CLO-1',description:'Explain fundamental data structure concepts.',targetWeight:.25},
      {code:'CLO-2',description:'Analyze algorithmic complexity and data structure performance.',targetWeight:.25},
      {code:'CLO-3',description:'Design appropriate data structure solutions for computational problems.',targetWeight:.25},
      {code:'CLO-4',description:'Implement and evaluate data structures and algorithms.',targetWeight:.25},
    ],
    topics:[
      {name:'Arrays',targetWeight:.15},{name:'Linked Lists',targetWeight:.15},{name:'Stacks & Queues',targetWeight:.15},
      {name:'Trees',targetWeight:.2},{name:'Graphs',targetWeight:.2},{name:'Sorting & Hashing',targetWeight:.15},
    ]
  },
  questions:[
    {id:'q1',number:'1(a)',text:'Define an abstract data type and distinguish it from a concrete data structure.',section:'A',marks:5,cloCode:'CLO-1',topic:'Arrays',bloom:'Remember',difficulty:'Easy',confidence:.94,concerns:[]},
    {id:'q2',number:'1(b)',text:'Explain how a dynamic array grows and state its amortized insertion cost.',section:'A',marks:7,cloCode:'CLO-2',topic:'Arrays',bloom:'Understand',difficulty:'Easy',confidence:.91,concerns:[]},
    {id:'q3',number:'2(a)',text:'Illustrate insertion and deletion in a singly linked list.',section:'A',marks:8,cloCode:'CLO-1',topic:'Linked Lists',bloom:'Understand',difficulty:'Easy',confidence:.9,concerns:[]},
    {id:'q4',number:'2(b)',text:'Write pseudocode to detect a cycle in a linked list and analyze its complexity.',section:'B',marks:10,cloCode:'CLO-4',topic:'Linked Lists',bloom:'Apply',difficulty:'Moderate',confidence:.93,concerns:[]},
    {id:'q5',number:'3',text:'Convert the given infix expression to postfix using a stack and show each step.',section:'B',marks:8,cloCode:'CLO-4',topic:'Stacks & Queues',bloom:'Apply',difficulty:'Moderate',confidence:.96,concerns:[]},
    {id:'q6',number:'4(a)',text:'State two properties of a binary search tree.',section:'A',marks:8,cloCode:'CLO-1',topic:'Trees',bloom:'Remember',difficulty:'Easy',confidence:.97,concerns:['Marks may be high for the expected recall response.']},
    {id:'q7',number:'4(b)',text:'Construct an AVL tree from the given sequence and show all rotations.',section:'B',marks:12,cloCode:'CLO-4',topic:'Trees',bloom:'Apply',difficulty:'Moderate',confidence:.95,concerns:[]},
    {id:'q8',number:'5',text:"Explain the working principle of Dijkstra's algorithm with an example.",section:'B',marks:10,cloCode:'CLO-2',topic:'Graphs',bloom:'Understand',difficulty:'Moderate',confidence:.88,concerns:['High semantic similarity with a previous paper.'],similarity:{score:.88,previous:previous.dijkstra,reason:'Both prompts assess explanation and tracing of the same shortest-path algorithm.'}},
    {id:'q9',number:'6(a)',text:'Compare the advantages and disadvantages of merge sort.',section:'B',marks:8,cloCode:'CLO-2',topic:'Sorting & Hashing',bloom:'Analyze',difficulty:'Moderate',confidence:.87,concerns:['High semantic similarity with a previous paper.'],similarity:{score:.82,previous:previous.merge,reason:'Both ask students to compare the suitability and trade-offs of merge sort.'}},
    {id:'q10',number:'6(b)',text:'Explain collision resolution by separate chaining in a hash table.',section:'A',marks:7,cloCode:'CLO-1',topic:'Sorting & Hashing',bloom:'Understand',difficulty:'Easy',confidence:.92,concerns:[]},
    {id:'q11',number:'7',text:'Analyze the time complexity of breadth-first and depth-first traversal.',section:'C',marks:10,cloCode:'CLO-2',topic:'Graphs',bloom:'Analyze',difficulty:'Moderate',confidence:.94,concerns:[]},
    {id:'q12',number:'8',text:'Choose a suitable queue implementation for a printer scheduler and justify your choice.',section:'C',marks:7,cloCode:'CLO-3',topic:'Stacks & Queues',bloom:'Evaluate',difficulty:'Hard',confidence:.84,concerns:[]},
  ]
};

export function improvedDemoAssessment(): Assessment {
  const copy = structuredClone(demoAssessment);
  copy.questions = copy.questions.map(q => q.id === 'q8' ? {...q, text:'Design a route-planning strategy for a campus shuttle network with non-negative edge weights. Justify the data structures and trace the shortest route for one source.', cloCode:'CLO-3', bloom:'Create', difficulty:'Hard', similarity:undefined, concerns:[]} : q.id === 'q6' ? {...q, text:'Given a search workload, evaluate whether a balanced BST or hash table is more appropriate and justify the trade-offs.', cloCode:'CLO-3', bloom:'Evaluate', difficulty:'Hard', concerns:[]} : q);
  return copy;
}
