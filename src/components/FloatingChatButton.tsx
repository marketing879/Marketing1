import React, { useState, useEffect, useRef } from "react";
import { ChatProvider, useChatContext } from "../contexts/ChatContext";
import { useUser } from "../contexts/UserContext";
import { ChatRoom } from "./ChatRoom";

// ── Unread badge tracker ──────────────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────────
const FloatingChatButtonInner: React.FC = () => {
  const { user }            = useUser();
  const [open, setOpen]     = useState(false);
  const [unread, setUnread] = useState(0);

  const handleOpen = () => { setOpen(true); setUnread(0); };

  if (!user) return null;

  return (
    <>
      <style>{`
        @keyframes fcbPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(0,212,255,0.45), 0 4px 20px rgba(0,0,0,0.5); }
          50%      { box-shadow: 0 0 0 8px rgba(0,212,255,0),  0 4px 20px rgba(0,0,0,0.5); }
        }
        @keyframes fcbBadgePop {
          0%   { transform: scale(0); }
          60%  { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        @keyframes fcbSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }

        .fcb-btn {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 8000;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7b2fff, #00d4ff);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          transition: transform 0.18s, right 0.28s cubic-bezier(0.22,1,0.36,1), background 0.18s;
          animation: fcbPulse 3s ease-in-out infinite;
        }
        .fcb-btn.is-open {
          right: calc(420px + 16px);
          background: rgba(20,22,36,0.95);
          border: 1px solid rgba(255,255,255,0.1);
          animation: none;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .fcb-btn:hover  { transform: scale(1.1); }
        .fcb-btn:active { transform: scale(0.95); }

        .fcb-badge {
          position: absolute;
          top: -2px; right: -2px;
          min-width: 18px; height: 18px;
          background: #ff3366;
          border: 2px solid #060a15;
          border-radius: 9px;
          font-size: 9px; font-weight: 900; color: #fff;
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
          padding: 5px 10px;
          font-size: 11px; font-weight: 600; color: #eef0ff;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .fcb-btn:hover .fcb-tooltip { opacity: 1; }

        /* ── Side panel ── */
        .fcb-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: 420px;
          height: 100vh;
          z-index: 7999;
          box-shadow: -8px 0 48px rgba(0,0,0,0.65);
          border-left: 1px solid rgba(255,255,255,0.07);
          animation: fcbSlideIn 0.28s cubic-bezier(0.22,1,0.36,1) forwards;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* Transparent click-away strip — doesn't cover the dashboard */
        .fcb-clickaway {
          position: fixed;
          top: 0; left: 0;
          right: 420px;
          bottom: 0;
          z-index: 7998;
          background: transparent;
          cursor: default;
        }

        @media (max-width: 520px) {
          .fcb-panel  { width: 100vw; }
          .fcb-btn.is-open { right: calc(100vw - 64px); }
          .fcb-clickaway { display: none; }
        }
      `}</style>

      {/* Unread tracker */}
      {!open && <UnreadBadge onCount={setUnread} />}

      {/* Floating button — toggles panel, moves left when open */}
      <button
        className={`fcb-btn${open ? " is-open" : ""}`}
        onClick={open ? () => setOpen(false) : handleOpen}
        title={open ? "Close Chat" : "Team Chat"}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#a0a8c0" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6"  x2="6"  y2="18"/>
            <line x1="6"  y1="6"  x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
        {!open && unread > 0 && (
          <span className="fcb-badge">{unread > 99 ? "99+" : unread}</span>
        )}
        <span className="fcb-tooltip">{open ? "Close Chat" : "Team Chat"}</span>
      </button>

      {open && (
        <>
          {/* Click-away area — clicking outside closes the panel */}
          <div className="fcb-clickaway" onClick={() => setOpen(false)} />

          {/* Side panel */}
          <div className="fcb-panel">
            <ChatRoom />
          </div>
        </>
      )}
    </>
  );
};

export const FloatingChatButton: React.FC = () => (
  <ChatProvider>
    <FloatingChatButtonInner />
  </ChatProvider>
);

export default FloatingChatButton;