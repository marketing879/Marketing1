import React from "react";
interface Props { role: string; userName: string; onFinish: () => void; }
export const OnboardingOverlay: React.FC<Props> = ({ userName, onFinish }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
    <div style={{ background:"#111319", border:"1px solid #252840", borderRadius:16, padding:40, textAlign:"center", color:"#f0f0f6" }}>
      <div style={{ fontSize:32, marginBottom:12 }}>👋</div>
      <h2 style={{ fontFamily:"Syne,sans-serif", marginBottom:8 }}>Welcome, {userName}!</h2>
      <button onClick={onFinish} style={{ marginTop:20, background:"#7c6af7", border:"none", borderRadius:10, color:"#fff", padding:"10px 28px", cursor:"pointer", fontSize:14 }}>Get Started</button>
    </div>
  </div>
);
export default OnboardingOverlay;
