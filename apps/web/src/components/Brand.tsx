import { Sparkles } from 'lucide-react';
export function Brand({light=false}:{light?:boolean}){return <div className={`brand ${light?'brand-light':''}`}><span className="brand-mark"><Sparkles size={17}/></span><span>Assess<span>AI</span></span></div>}
