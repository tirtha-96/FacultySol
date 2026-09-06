import { useCallback, useEffect, useState } from "react";
import type { Analysis, Assessment } from "@assessai/shared";
import { getAnalysis, applyImprovements } from "./api";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { Upload } from "./pages/Upload";
import { Processing } from "./pages/Processing";
import { AssessmentPage } from "./pages/Assessment";
import { Sidebar } from "./components/Sidebar";
import { Bell, Menu, Search } from "lucide-react";

type Screen = "landing" | "dashboard" | "upload" | "processing" | "assessment";
export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [active, setActive] = useState("Dashboard");
  const [assessment, setAssessment] = useState<Assessment>();
  const [analysis, setAnalysis] = useState<Analysis>();
  const [before, setBefore] = useState<Analysis>();
  useEffect(() => {
    getAnalysis().then((x) => {
      setAssessment(x.assessment);
      setAnalysis(x.analysis);
    });
  }, []);
  const done = useCallback(() => setScreen("assessment"), []);
  const improve = async () => {
    const result = await applyImprovements();
    setBefore(result.before);
    setAnalysis(result.after);
    setScreen("assessment");
  };
  if (screen === "landing")
    return <Landing analysis={analysis} onEnter={() => setScreen("dashboard")} />;
  if (screen === "upload")
    return (
      <Upload
        onBack={() => setScreen("dashboard")}
        onAnalyze={() => setScreen("processing")}
      />
    );
  if (screen === "processing") return <Processing onDone={done} />;
  if (screen === "assessment" && assessment && analysis)
    return (
      <AssessmentPage
        assessment={{ ...assessment, questions: analysis.questions }}
        analysis={analysis}
        before={before}
        onBack={() => setScreen("dashboard")}
        onImprove={improve}
      />
    );
  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        onNavigate={(x) => {
          setActive(x);
          if (x === "Assessments" && assessment && analysis)
            setScreen("assessment");
        }}
      />
      <div className="workspace">
        <div className="topbar">
          <button className="mobile-menu">
            <Menu />
          </button>
          <label>
            <Search />
            <input
              aria-label="Search"
              placeholder="Search courses, assessments, reports…"
            />
          </label>
          <div>
            <span>Demo workspace</span>
            <button className="icon-button">
              <Bell />
              <b />
            </button>
          </div>
        </div>
        <main className="dashboard-main">
          {analysis ? (
            <Dashboard
              analysis={analysis}
              onOpen={() => setScreen("assessment")}
              onUpload={() => setScreen("upload")}
            />
          ) : (
            <div className="loading">Loading workspace…</div>
          )}
        </main>
      </div>
    </div>
  );
}
