import React, { useState } from "react";
interface Props { onShareToChat:(text:string)=>void; }
export const YoutubePanel: React.FC<Props> = ({ onShareToChat }) => {
  const [url, setUrl] = useState("");
  return (
    <div style={{ padding:12 }}>
      <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em", color:"#3a3f5c", marginBottom:8, textTransform:"uppercase" }}>Music / YouTube</div>
      <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste YouTube URL…"
        style={{ width:"100%", background:"#1a1d2e", border:"1px solid #252840", borderRadius:8, padding:"7px 10px", color:"#f0f0f6", fontSize:12, outline:"none", marginBottom:8 }} />
      <button onClick={()=>{ if(url){ onShareToChat("🎵 " + url); setUrl(""); }}}
        style={{ width:"100%", background:"#7c6af7", border:"none", borderRadius:8, color:"#fff", padding:"7px", cursor:"pointer", fontSize:12 }}>Share to Chat</button>
    </div>
  );
};
export default YoutubePanel;
