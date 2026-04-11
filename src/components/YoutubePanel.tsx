import React, { useState } from "react";

interface Props { onShareToChat: (text: string) => void; }

// Extract YouTube video ID from any YouTube URL format
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
export const YoutubePanel: React.FC<Props> = ({ onShareToChat }) => {
  const [url,       setUrl]       = useState("");
  const [videoId,   setVideoId]   = useState<string | null>(null);
  const [error,     setError]     = useState("");

  const handleLoad = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const id = extractYouTubeId(trimmed);
    if (!id) {
      setError("Couldn't recognise that YouTube URL. Try a standard youtube.com or youtu.be link.");
      setVideoId(null);
      return;
    }
    setError("");
    setVideoId(id);
  };

  const handleShare = () => {
    if (!url.trim()) return;
    onShareToChat("🎵 " + url.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLoad();
  };

  return (
    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
        color: "#3a3f5c", textTransform: "uppercase", marginBottom: 2,
      }}>
        🎵 Music / YouTube
      </div>

      {/* URL input row */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={url}
          onChange={e => { setUrl(e.target.value); setError(""); }}
          onKeyDown={handleKeyDown}
          placeholder="Paste YouTube URL…"
          style={{
            flex: 1, background: "#1a1d2e", border: "1px solid #252840",
            borderRadius: 8, padding: "7px 10px", color: "#f0f0f6",
            fontSize: 12, outline: "none", fontFamily: "'DM Sans', sans-serif",
          }}
        />
        <button
          onClick={handleLoad}
          style={{
            background: "#7c6af7", border: "none", borderRadius: 8,
            color: "#fff", padding: "7px 12px", cursor: "pointer",
            fontSize: 12, fontWeight: 700, flexShrink: 0,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          ▶ Play
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: 11, color: "#f87171", lineHeight: 1.4 }}>{error}</div>
      )}

      {/* Inline YouTube embed */}
      {videoId && (
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #252840", background: "#000" }}>
          <iframe
            key={videoId}
            width="100%"
            height="190"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title="YouTube player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ display: "block", border: "none" }}
          />
        </div>
      )}

      {/* Share to chat button */}
      {videoId && (
        <button
          onClick={handleShare}
          style={{
            width: "100%", background: "rgba(124,106,247,0.12)",
            border: "1px solid rgba(124,106,247,0.3)", borderRadius: 8,
            color: "#a78bfa", padding: "7px", cursor: "pointer",
            fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,106,247,0.22)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(124,106,247,0.12)")}
        >
          📤 Share to Chat
        </button>
      )}
    </div>
  );
};

export default YoutubePanel;
