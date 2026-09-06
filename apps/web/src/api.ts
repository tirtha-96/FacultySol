import { analyzeAssessment, demoAssessment, improvedDemoAssessment, type Analysis, type Assessment } from '@assessai/shared';
const API='/api';
export async function getAnalysis():Promise<{assessment:Assessment;analysis:Analysis}>{
  try{const [a,b]=await Promise.all([fetch(`${API}/assessments/assessment-2026`),fetch(`${API}/assessments/assessment-2026/analysis`)]);if(!a.ok||!b.ok)throw new Error();return {assessment:(await a.json()).data,analysis:(await b.json()).data}}catch{return {assessment:demoAssessment,analysis:analyzeAssessment(demoAssessment)}}
}
export async function applyImprovements(){try{const r=await fetch(`${API}/assessments/assessment-2026/apply-demo-improvements`,{method:'POST'});if(!r.ok)throw new Error();return (await r.json()).data}catch{return {before:analyzeAssessment(demoAssessment),after:analyzeAssessment(improvedDemoAssessment(),undefined,2)}}}
