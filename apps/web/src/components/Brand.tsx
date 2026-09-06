import { Sparkles } from "lucide-react";
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark">
        <Sparkles size={17} />
      </span>
      <span>
        Faculty<span>Sol</span>
      </span>
    </div>
  );
}
