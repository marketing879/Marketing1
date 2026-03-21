import React, { useState } from "react";
import { ChatUser } from "../types/chat";
interface Props { currentUser:ChatUser; allUsers:ChatUser[]; onSend:(title:string,link:string,recipients:string[])=>void; onClose:()=>void; }
export const MeetingModal: React.FC<Props> = ({ onSend, onClose }) => {
  const [title, setTitle] = useState("");
  const [link,  setLink]  = useState("");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#111319", border:"1px solid #252840", borderRadius:16, padding:32, width:360, color:"#f0f0f6" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
          <span style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:16 }}>📹 Share Meeting</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#5a5f7a", cursor:"pointer", fontSize:18 }}>✕</button>
        </div>
        <label style={{ fontSize:11, color:"#5a5f7a", fontWeight:700 }}>MEETING TITLE</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Weekly Standup"
          style={{ width:"100%", background:"#1a1d2e", border:"1px solid #252840", borderRadius:8, padding:"8px 12px", color:"#f0f0f6", fontSize:13, outline:"none", marginBottom:12, marginTop:4, display:"block" }} />
        <label style={{ fontSize:11, color:"#5a5f7a", fontWeight:700 }}>MEETING LINK</label>
        <input value={link} onChange={e=>setLink(e.target.value)} placeholder="https://meet.google.com/…"
          style={{ width:"100%", background:"#1a1d2e", border:"1px solid #252840", borderRadius:8, padding:"8px 12px", color:"#f0f0f6", fontSize:13, outline:"none", marginBottom:20, marginTop:4, display:"block" }} />
        <button onClick={()=>{ if(title&&link){ onSend(title,link,[]); onClose(); }}}
          style={{ width:"100%", background:"#7c6af7", border:"none", borderRadius:10, color:"#fff", padding:"10px", cursor:"pointer", fontSize:14, fontWeight:700 }}>Send to Channel</button>
      </div>
    </div>
  );
};
export default MeetingModal;
