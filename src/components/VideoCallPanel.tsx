import React, { useEffect, useRef, useState } from "react";
import { ChatUser } from "../types/chat";

interface Props {
  channel: string;
  currentUser: ChatUser;
  participants: ChatUser[];
  roomUrl?: string;   // optional pre-built Jitsi URL
  onEnd: () => void;
}

export const VideoCallPanel: React.FC<Props> = ({ channel, currentUser, roomUrl, onEnd }) => {
  const iframeRef   = useRef<HTMLIFrameElement>(null);
  const [loaded,  setLoaded]  = useState(false);
  const [muted,   setMuted]   = useState(false);
  const [camOff,  setCamOff]  = useState(false);

  // Build Jitsi room name from channel — stable, no timestamp so same channel = same room
  const jitsiRoom = roomUrl
    ? roomUrl.replace(/https?:\/\/meet\.jit\.si\//, "")   // strip base if full URL passed
    : `roswalt-smartcue-${channel.replace(/[^a-zA-Z0-9]/g, "-")}`;

  const jitsiSrc = `https://meet.jit.si/${jitsiRoom}#userInfo.displayName="${encodeURIComponent(currentUser.name)}"&config.startWithAudioMuted=${muted}&config.startWithVideoMuted=${camOff}&config.prejoinPageEnabled=false&config.toolbarButtons=["microphone","camera","hangup","chat","tileview","fullscreen"]&interfaceConfig.SHOW_JITSI_WATERMARK=false&interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false&interfaceConfig.TOOLBAR_ALWAYS_VISIBLE=true`;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.92)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      {/* Header bar */}
      <div style={{
        width: "100%", maxWidth: 960,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", background: "#111319",
        borderRadius: "14px 14px 0 0", borderBottom: "1px solid #1a1d2e",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>📹</span>
          <div>
            <div style={{ fontFamily: "Impact, sans-serif", fontSize: 15, color: "#c9a96e", letterSpacing: "0.05em" }}>
              SmartCue ChatRoom — Live Call
            </div>
            <div style={{ fontSize: 10, color: "#3a3f5c", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              #{channel}
            </div>
          </div>
        </div>
        <button
          onClick={onEnd}
          style={{
            background: "#ef4444", border: "none", borderRadius: 9,
            color: "#fff", padding: "8px 20px",
            cursor: "pointer", fontSize: 13, fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          ✕ End Call
        </button>
      </div>

      {/* Jitsi iframe — full in-app, no new tab */}
      <div style={{ width: "100%", maxWidth: 960, flex: 1, maxHeight: "80vh", position: "relative", background: "#0a0b0f" }}>
        {!loaded && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 14, color: "#3a3f5c",
          }}>
            <div style={{ width: 36, height: 36, border: "3px solid #1a1d2e", borderTop: "3px solid #7c6af7", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
            <div style={{ fontSize: 13 }}>Connecting to call…</div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={jitsiSrc}
          allow="camera; microphone; display-capture; autoplay; clipboard-write"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          style={{
            width: "100%", height: "100%", minHeight: 480,
            border: "none", display: "block",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
          title="SmartCue Video Call"
        />
      </div>

      {/* Bottom bar */}
      <div style={{
        width: "100%", maxWidth: 960,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        padding: "10px 16px", background: "#111319",
        borderRadius: "0 0 14px 14px", borderTop: "1px solid #1a1d2e",
      }}>
        <button
          onClick={() => setMuted(m => !m)}
          style={{
            background: muted ? "rgba(239,68,68,0.15)" : "rgba(124,106,247,0.1)",
            border: `1px solid ${muted ? "#ef4444" : "#7c6af7"}`,
            borderRadius: 9, color: muted ? "#ef4444" : "#a78bfa",
            padding: "7px 16px", cursor: "pointer", fontSize: 13,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
          }}
        >
          {muted ? "🔇 Unmute" : "🎙 Mute"}
        </button>
        <button
          onClick={() => setCamOff(c => !c)}
          style={{
            background: camOff ? "rgba(239,68,68,0.15)" : "rgba(124,106,247,0.1)",
            border: `1px solid ${camOff ? "#ef4444" : "#7c6af7"}`,
            borderRadius: 9, color: camOff ? "#ef4444" : "#a78bfa",
            padding: "7px 16px", cursor: "pointer", fontSize: 13,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
          }}
        >
          {camOff ? "📷 Start Cam" : "📹 Stop Cam"}
        </button>
        <button
          onClick={onEnd}
          style={{
            background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444",
            borderRadius: 9, color: "#ef4444",
            padding: "7px 20px", cursor: "pointer", fontSize: 13,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 700,
          }}
        >
          ✕ Leave
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default VideoCallPanel;