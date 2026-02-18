import React, { useState, useRef, useEffect } from "react";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeChatProps {
  theme?: "dark" | "amber";
}

const ClaudeChat: React.FC<ClaudeChatProps> = ({ theme = "dark" }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isAmber = theme === "amber";

  const accent = isAmber ? "#f59e0b" : "#a5b4fc";
  const accentBg = isAmber ? "rgba(245,158,11,0.1)" : "rgba(102,126,234,0.1)";
  const accentBorder = isAmber
    ? "rgba(245,158,11,0.25)"
    : "rgba(102,126,234,0.25)";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: updatedMessages,
      });
      const assistantMsg: Message = {
        role: "assistant",
        content: res.content[0].type === "text" ? res.content[0].text : "",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠ Error reaching Claude. Please try again.",
        },
      ]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 400,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${accentBorder}`,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid rgba(255,255,255,0.06)`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: accentBg,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: accentBg,
            border: `1px solid ${accentBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
          }}
        >
          ✦
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f0e6d3" }}>
            Claude AI Assistant
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            Ask anything about your tasks or workspace
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: `1px solid rgba(255,255,255,0.08)`,
              borderRadius: 6,
              color: "rgba(255,255,255,0.3)",
              fontSize: 11,
              padding: "4px 10px",
              cursor: "pointer",
              letterSpacing: "0.06em",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "32px 16px",
              color: "rgba(255,255,255,0.2)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>
              ✦
            </div>
            <div style={{ fontSize: 13 }}>
              Ask Claude to help with your work
            </div>
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {[
                "Summarize my pending tasks",
                "Help me write a task update",
                "How do I prioritize my work?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  style={{
                    background: accentBg,
                    border: `1px solid ${accentBorder}`,
                    borderRadius: 8,
                    color: accent,
                    fontSize: 12,
                    padding: "8px 14px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "82%",
                padding: "10px 14px",
                borderRadius:
                  msg.role === "user"
                    ? "12px 12px 4px 12px"
                    : "12px 12px 12px 4px",
                background:
                  msg.role === "user"
                    ? `linear-gradient(135deg, ${accentBg}, rgba(255,255,255,0.05))`
                    : "rgba(255,255,255,0.04)",
                border: `1px solid ${
                  msg.role === "user" ? accentBorder : "rgba(255,255,255,0.07)"
                }`,
                fontSize: 13,
                color:
                  msg.role === "user" ? "#f0e6d3" : "rgba(255,255,255,0.75)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: "12px 12px 12px 4px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: accent,
                fontSize: 18,
                letterSpacing: 4,
              }}
            >
              ···
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          gap: 10,
        }}
      >
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Claude… (Enter to send)"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "10px 14px",
            color: "#f0e6d3",
            fontSize: 13,
            fontFamily: "DM Sans, sans-serif",
            resize: "none",
            outline: "none",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            padding: "10px 16px",
            background:
              loading || !input.trim()
                ? "rgba(255,255,255,0.05)"
                : `linear-gradient(135deg, ${accent}, ${
                    isAmber ? "#a07840" : "#764ba2"
                  })`,
            border: "none",
            borderRadius: 10,
            color:
              loading || !input.trim()
                ? "rgba(255,255,255,0.2)"
                : isAmber
                ? "#000"
                : "#fff",
            fontSize: 16,
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
};

export default ClaudeChat;
