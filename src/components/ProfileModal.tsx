import React, { useState } from "react";
import { ChatUser } from "../types/chat";
interface Props { user:ChatUser; onSave:(u:Partial<ChatUser>)=>void; onClose:()=>void; }
export const ProfileModal: React.FC<Props> = ({ user, onSave, onClose }) => {
  const [name, setName]     = useState(user.name);
  const [status, setStatus] = useState(user.status || "");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#111319", border:"1px solid #252840", borderRadius:16, padding:32, width:340, color:"#f0f0f6" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
          <span style={{ fontFamily:"Syne,sans-serif", fontWeight:700, fontSize:16 }}>Edit Profile</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#5a5f7a", cursor:"pointer", fontSize:18 }}>✕</button>
        </div>
        <img src={user.avatar} alt={user.name} style={{ width:72, height:72, borderRadius:"50%", objectFit:"cover", border:"2px solid #7c6af7", display:"block", margin:"0 auto 16px" }} />
        <label style={{ fontSize:11, color:"#5a5f7a", fontWeight:700 }}>NAME</label>
        <input value={name} onChange={e=>setName(e.target.value)}
          style={{ width:"100%", background:"#1a1d2e", border:"1px solid #252840", borderRadius:8, padding:"8px 12px", color:"#f0f0f6", fontSize:13, outline:"none", marginBottom:12, marginTop:4, display:"block" }} />
        <label style={{ fontSize:11, color:"#5a5f7a", fontWeight:700 }}>STATUS</label>
        <input value={status} onChange={e=>setStatus(e.target.value)} placeholder="What's on your mind?"
          style={{ width:"100%", background:"#1a1d2e", border:"1px solid #252840", borderRadius:8, padding:"8px 12px", color:"#f0f0f6", fontSize:13, outline:"none", marginBottom:20, marginTop:4, display:"block" }} />
        <button onClick={()=>{ onSave({ name, status }); onClose(); }}
          style={{ width:"100%", background:"#7c6af7", border:"none", borderRadius:10, color:"#fff", padding:"10px", cursor:"pointer", fontSize:14, fontWeight:700 }}>Save Changes</button>
      </div>
    </div>
  );
};
export default ProfileModal;
