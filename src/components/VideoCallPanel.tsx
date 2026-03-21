import React from "react";
import { ChatUser } from "../types/chat";
interface Props { channel:string; currentUser:ChatUser; participants:ChatUser[]; onEnd:()=>void; }
export const VideoCallPanel: React.FC<Props> = ({ channel, participants, onEnd }) => (
  <div style={{ width:320, background:"#111319", borderLeft:"1px solid #1a1d2e", display:"flex", flexDirection:"column", alignItems:"center", padding:24, gap:16 }}>
    <div style={{ fontFamily:"Syne,sans-serif", fontWeight:700, color:"#f0f0f6", fontSize:15 }}>📹 #{channel}</div>
    <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
      {participants.map(u=>(
        <div key={u.id} style={{ textAlign:"center" }}>
          <img src={u.avatar} alt={u.name} style={{ width:64, height:64, borderRadius:12, objectFit:"cover", border:"2px solid #7c6af7" }} />
          <div style={{ fontSize:10, color:"#6b7280", marginTop:4 }}>{u.name.split(" ")[0]}</div>
        </div>
      ))}
    </div>
    <button onClick={onEnd} style={{ background:"#ef4444", border:"none", borderRadius:10, color:"#fff", padding:"10px 24px", cursor:"pointer", fontSize:13, fontWeight:700, marginTop:"auto" }}>End Call</button>
  </div>
);
export default VideoCallPanel;
