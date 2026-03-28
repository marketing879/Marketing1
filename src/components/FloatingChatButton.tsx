import React, { useState, useEffect, useRef } from "react";
import { ChatProvider, useChatContext } from "../contexts/ChatContext";
import { useUser } from "../contexts/UserContext";
import { ChatRoom } from "./ChatRoom";

// ── Unread badge: counts messages in "general" channel received after mount ──
const UnreadBadge: React.FC<{ onCount: (n: number) => void }> = ({ onCount }) => {
  const { messages } = useChatContext();
  const mountRef     = useRef(Date.now());
  useEffect(() => {
    const general = messages["general"] || [];
    const fresh   = general.filter(m => new Date(m.createdAt).getTime() > mountRef.current).length;
    onCount(fresh);
  }, [messages]);
  return null;
};

// ── Main floating button + modal ─────────────────────────────────────────────
const FloatingChatButtonInner: React.FC = () => {
  const { user }          = useUser();
  const [open, setOpen]   = useState(false);
  const [unread, setUnread] = useState(0);

  // Reset unread when chat opens
  const handleOpen = () => { setOpen(true); setUnread(0); };

  if (!user) return null;

  return (
    <>
      <style>{`
        @keyframes fcbPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(0,212,255,0.5), 0 4px 24px rgba(0,0,0,0.5); }
          50%      { box-shadow: 0 0 0 10px rgba(0,212,255,0), 0 4px 24px rgba(0,0,0,0.5); }
        }
        @keyframes fcbSlideIn {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes fcbBadgePop {
          0%   { transform: scale(0); }
          60%  { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .fcb-btn {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 8000;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7b2fff, #00d4ff);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 24px rgba(0,0,0,0.5);
          transition: transform 0.18s, opacity 0.18s;
          animation: fcbPulse 3s ease-in-out infinite;
        }
        .fcb-btn:hover { transform: scale(1.08); }
        .fcb-btn:active { transform: scale(0.96); }
        .fcb-badge {
          position: absolute;
          top: -3px; right: -3px;
          min-width: 18px; height: 18px;
          background: #ff3366;
          border: 2px solid #060a15;
          border-radius: 9px;
          font-size: 9px; font-weight: 900;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px;
          animation: fcbBadgePop 0.3s cubic-bezier(0.34,1.56,0.64,1);
          box-shadow: 0 0 8px rgba(255,51,102,0.7);
          font-family: 'Inter', sans-serif;
        }
        .fcb-tooltip {
          position: absolute;
          right: calc(100% + 10px);
          top: 50%;
          transform: translateY(-50%);
          background: rgba(8,11,26,0.95);
          border: 1px solid rgba(0,212,255,0.2);
          border-radius: 8px;
          padding: 6px 11px;
          font-size: 11px; font-weight: 600;
          color: #eef0ff;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.18s;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        .fcb-btn:hover .fcb-tooltip { opacity: 1; }
        .fcb-overlay {
          position: fixed;
          inset: 0;
          z-index: 7999;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fcb-modal {
          width: min(1100px, 96vw);
          height: min(780px, 92vh);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 40px 100px rgba(0,0,0,0.9), 0 0 80px rgba(0,212,255,0.08);
          animation: fcbSlideIn 0.28s cubic-bezier(0.34,1.56,0.64,1);
          position: relative;
        }
        .fcb-close {
          position: absolute;
          top: 12px; right: 12px;
          z-index: 10;
          width: 30px; height: 30px;
          background: rgba(8,11,26,0.85);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          color: #7e84a3;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px;
          transition: all 0.15s;
        }
        .fcb-close:hover { background: rgba(255,51,102,0.15); color: #ff3366; border-color: rgba(255,51,102,0.35); }
      `}</style>

      {/* Hidden component to track unread messages */}
      {!open && <UnreadBadge onCount={setUnread} />}

      {/* Floating button */}
      <button className="fcb-btn" onClick={handleOpen} title="Open Team Chat">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        {unread > 0 && (
          <span className="fcb-badge">{unread > 99 ? "99+" : unread}</span>
        )}
        <span className="fcb-tooltip">Team Chat</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fcb-overlay" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="fcb-modal">
            <button className="fcb-close" onClick={() => setOpen(false)}>✕</button>
            <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 18 }}>
              <ChatRoom />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Wrap with ChatProvider so it's self-contained
export const FloatingChatButton: React.FC = () => (
  <ChatProvider>
    <FloatingChatButtonInner />
  </ChatProvider>
);

export default FloatingChatButton;