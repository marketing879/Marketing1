import { useState } from "react";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

export default function Chat() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const askClaude = async () => {
    if (!input) return;
    setLoading(true);
    setResponse("");
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: input }],
    });
    setResponse(res.content[0].text);
    setLoading(false);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h2>Ask Claude</h2>
      <textarea
        rows={4}
        style={{ width: "100%", padding: "10px" }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask Claude anything..."
      />
      <br />
      <button
        onClick={askClaude}
        disabled={loading}
        style={{ marginTop: "10px", padding: "10px 20px" }}
      >
        {loading ? "Thinking..." : "Send"}
      </button>
      {response && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: "#f0f0f0",
            borderRadius: "8px",
          }}
        >
          <strong>Claude:</strong>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}
