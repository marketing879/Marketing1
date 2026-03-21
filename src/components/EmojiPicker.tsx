import React from "react";
interface Props { onEmoji:(e:string)=>void; onSticker:(s:string)=>void; onGif:(url:string)=>void; onClose:()=>void; }
const EMOJIS = ["😀","😂","😍","🔥","👍","❤️","🎉","😎","🙏","💯","😭","🤔","👀","✨","🚀"];
const STICKERS = ["🌟","🎊","🎁","🏆","💎","🌈","⚡","🎯","🦄","🍕"];
export const EmojiPicker: React.FC<Props> = ({ onEmoji, onSticker, onClose }) => (
  <div style={{ position:"absolute", bottom:"100%", left:0, background:"#181b27", border:"1px solid #252840", borderRadius:14, padding:12, marginBottom:6, zIndex:100, width:280 }}>
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
      <span style={{ fontSize:11, color:"#5a5f7a", fontWeight:700 }}>EMOJI</span>
      <button onClick={onClose} style={{ background:"none", border:"none", color:"#5a5f7a", cursor:"pointer" }}>✕</button>
    </div>
    <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
      {EMOJIS.map(e => <button key={e} onClick={()=>onEmoji(e)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, padding:2 }}>{e}</button>)}
    </div>
    <div style={{ fontSize:11, color:"#5a5f7a", fontWeight:700, marginBottom:6 }}>STICKERS</div>
    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
      {STICKERS.map(s => <button key={s} onClick={()=>onSticker(s)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:28, padding:2 }}>{s}</button>)}
    </div>
  </div>
);
export default EmojiPicker;
