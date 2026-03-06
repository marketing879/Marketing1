import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, Task } from "../contexts/UserContext";
import { Eye, Upload, CheckCircle, AlertCircle, Loader, Shield, User, X, Camera, Clock, BarChart2, AlertTriangle, TrendingUp, Zap } from "lucide-react";
import ClaudeChat from "./ClaudeChat";
import { greetUser, setElevenLabsVoice, speakText } from "../services/VoiceModule";
import roswaltLogo from "../assets/ROSWALT-LOGO-GOLDEN-8K.png";

// ── Role badge helpers ───────────────────────────────────────────────────────
const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin",
  supremo:    "Supremo",
  admin:      "Admin",
  staff:      "Staff",
};

const ROLE_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  superadmin: { bg: "rgba(0,212,255,0.1)",  border: "rgba(0,212,255,0.3)",  text: "#00d4ff" },
  supremo:    { bg: "rgba(0,212,255,0.1)",  border: "rgba(0,212,255,0.3)",  text: "#00d4ff" },
  admin:      { bg: "rgba(0,212,255,0.1)",  border: "rgba(0,212,255,0.3)",  text: "#00d4ff" },
  staff:      { bg: "rgba(0,212,255,0.1)",  border: "rgba(0,212,255,0.3)",  text: "#00d4ff" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const isDelayed = (task: Task): boolean => {
  // Only fully approved tasks are never delayed
  if (task.approvalStatus === "superadmin-approved") return false;
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate);
  if (isNaN(due.getTime())) return false;
  const now = new Date();
  // Compare date only — a task is delayed if its due date is strictly before today
  return due.getFullYear() < now.getFullYear() ||
    (due.getFullYear() === now.getFullYear() && due.getMonth() < now.getMonth()) ||
    (due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth() && due.getDate() < now.getDate());
};


// ── AI Content Quality Scoring ────────────────────────────────────────────────
interface AIScoreCategory {
  id: string;
  name: string;
  score: number;
  max: number;
  color: string;
  subcriteria: { label: string; score: number; max: number; note: string }[];
}

interface AIScoreResult {
  categories: AIScoreCategory[];
  percentScore: number;
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  grammarErrors: string[];
  grammarClean: boolean;
  strengths: string[];
  improvements: string[];
  extractedText: string;
  verdict: string;
}

const GRADE_COLOR: Record<string, string> = {
  S: "#00d4ff", A: "#00ff88", B: "#b06af3", C: "#f5c518", D: "#ff6b35", F: "#ff3366",
};

const CATEGORY_COLOR: Record<string, string> = {
  A: "#00d4ff", B: "#00ff88", C: "#f5c518", D: "#b06af3", E: "#ff6b35",
};

function gradeFromPercent(p: number): "S" | "A" | "B" | "C" | "D" | "F" {
  if (p >= 90) return "S";
  if (p >= 80) return "A";
  if (p >= 70) return "B";
  if (p >= 55) return "C";
  if (p >= 40) return "D";
  return "F";
}

// ── Extract N evenly-spaced frames from a video data-URL via canvas ───────────
async function extractVideoFrames(videoDataUrl: string, frameCount = 6): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.src        = videoDataUrl;
    video.muted      = true;
    video.playsInline = true;
    video.preload    = "metadata";

    video.addEventListener("loadedmetadata", () => {
      const duration = video.duration;
      // sample points: 5%, 20%, 35%, 50%, 65%, 85% through the video
      const fractions = frameCount === 6
        ? [0.05, 0.20, 0.35, 0.50, 0.65, 0.85]
        : Array.from({ length: frameCount }, (_, i) => (i + 0.5) / frameCount);

      const frames: string[] = [];
      let idx = 0;

      const canvas  = document.createElement("canvas");
      const ctx     = canvas.getContext("2d")!;

      const seekNext = () => {
        if (idx >= fractions.length) { resolve(frames); return; }
        video.currentTime = fractions[idx] * duration;
      };

      video.addEventListener("seeked", () => {
        canvas.width  = video.videoWidth  || 1280;
        canvas.height = video.videoHeight || 720;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.80));
        idx++;
        seekNext();
      });

      seekNext();
    });

    // fallback — if metadata never fires (bad format), resolve empty
    setTimeout(() => resolve([]), 8000);
  });
}

async function scoreWithAI(notes: string, files: string[]): Promise<AIScoreResult> {
  const hasFiles  = files.length > 0;
  const isVideo   = hasFiles && files[0].startsWith("data:video/");

  // For videos: extract 6 frames to send as images
  let scoringImages: string[] = [];
  if (isVideo) {
    try {
      scoringImages = await extractVideoFrames(files[0], 6);
    } catch {
      scoringImages = [];
    }
  } else {
    scoringImages = files.filter(f => !f.startsWith("data:video/"));
  }

  const hasImages = scoringImages.length > 0;

  const systemPrompt = isVideo
    ? `You are a professional marketing video quality scorer for Roswalt Realty. You are analysing ${scoringImages.length} sequential frames extracted from a marketing video. Score the video across 5 categories (A–E), each worth 20 marks (total 100). Return ONLY valid JSON, no markdown fences.

Categories and subcriteria (each subcriterion is worth 4 marks):

A) Aesthetics: A1=Visual hierarchy across frames, A2=Color harmony & grading, A3=Typography & text overlays, A4=Production quality, A5=Overall professionalism
B) Compliance: B1=RERA disclaimer visible, B2=No unsubstantiated claims, B3=Consent language, B4=IP rights (music/footage), B5=Platform policy adherence
C) Grammar & Punctuation: C1=Spelling errors in text overlays, C2=Punctuation/structure, C3=Caption/subtitle grammar, C4=CTA clarity, C5=Language consistency
D) Creativity: D1=Hook strength (opening frame), D2=Storytelling arc across frames, D3=Editing rhythm & pacing, D4=Sound/score fit (infer from visual energy), D5=Format originality
E) Audience Engagement: E1=Retention pattern (does each frame maintain interest?), E2=Value clarity, E3=Emotional pull, E4=CTA strength, E5=Shareability

Rules:
- You are scoring a VIDEO — D4 and E1 should be scored fully (not defaulted to 2/4).
- Analyse every frame for visible text, overlays, logos, RERA numbers, and CTAs.
- Extract ALL visible on-screen text across all frames and list any grammar/spelling mistakes.
- Judge storytelling arc and editing rhythm from the sequence of frames.
- CRITICAL: Every subcriteria score MUST be 0–4 inclusive. Never exceed the max. Every category score MUST equal the sum of its 5 subcriteria (max 20). Never inflate scores.
- The "note" field for each subcriteria MUST explain the exact reason for the score — especially if below 4. Be specific and actionable.

Return this exact JSON:
{
  "categories": [
    { "id": "A", "name": "Aesthetics", "score": 0, "subcriteria": [{ "label": "A1: Visual hierarchy", "score": 0, "max": 4, "note": "..." }, ...5 items] },
    { "id": "B", "name": "Compliance", "score": 0, "subcriteria": [...5] },
    { "id": "C", "name": "Grammar & Punctuation", "score": 0, "subcriteria": [...5] },
    { "id": "D", "name": "Creativity", "score": 0, "subcriteria": [...5] },
    { "id": "E", "name": "Audience Engagement", "score": 0, "subcriteria": [...5] }
  ],
  "grammarErrors": [],
  "grammarClean": true,
  "strengths": [],
  "improvements": [],
  "extractedText": "",
  "verdict": ""
}`
    : `You are a professional marketing content quality scorer for Roswalt Realty. Score the submitted content across 5 categories (A–E), each worth 20 marks (total 100). Return ONLY valid JSON, no markdown fences.

Categories and subcriteria (each subcriterion is worth 4 marks):

A) Aesthetics: A1=Visual hierarchy, A2=Color harmony, A3=Typography, A4=Image polish, A5=Overall professionalism
B) Compliance: B1=RERA disclaimer, B2=No unsubstantiated claims, B3=Consent language, B4=IP rights, B5=Platform policy
C) Grammar & Punctuation: C1=Spelling errors, C2=Punctuation/structure, C3=Caption grammar, C4=CTA clarity, C5=Language consistency
D) Creativity: D1=Hook strength, D2=Storytelling arc, D3=Editing rhythm, D4=Sound/score fit (default 2/4 for static), D5=Format originality
E) Audience Engagement: E1=Retention pattern (default 2/4 for static), E2=Value clarity, E3=Emotional pull, E4=CTA strength, E5=Shareability

Rules:
- No image provided: A subcriteria all score 0.
- Static graphic (not video): D4 and E1 default to 2/4.
- Extract ALL visible on-screen text and list any grammar/spelling mistakes.
- CRITICAL: Every subcriteria score MUST be 0–4 inclusive. Never exceed the max. Every category score MUST equal the sum of its 5 subcriteria (max 20). Never inflate scores.
- The "note" field for each subcriteria MUST explain the exact reason for the score — especially if below 4. Be specific and actionable.

Return this exact JSON:
{
  "categories": [
    { "id": "A", "name": "Aesthetics", "score": 0, "subcriteria": [{ "label": "A1: Visual hierarchy", "score": 0, "max": 4, "note": "..." }, ...5 items] },
    { "id": "B", "name": "Compliance", "score": 0, "subcriteria": [...5] },
    { "id": "C", "name": "Grammar & Punctuation", "score": 0, "subcriteria": [...5] },
    { "id": "D", "name": "Creativity", "score": 0, "subcriteria": [...5] },
    { "id": "E", "name": "Audience Engagement", "score": 0, "subcriteria": [...5] }
  ],
  "grammarErrors": [],
  "grammarClean": true,
  "strengths": [],
  "improvements": [],
  "extractedText": "",
  "verdict": ""
}`;

  const userContent: any[] = [];

  if (hasImages) {
    for (const img of scoringImages) {
      let base64 = img, mtype = "image/jpeg";
      if (img.startsWith("data:")) {
        const m = img.match(/data:([^;]+);base64,(.+)/);
        if (m) { mtype = m[1]; base64 = m[2]; }
      }
      userContent.push({ type: "image", source: { type: "base64", media_type: mtype, data: base64 } });
    }
  }

  const contextNote = isVideo
    ? `This is a VIDEO submission. The ${scoringImages.length} images above are evenly-spaced frames extracted from the video to give you a complete visual timeline. Staff completion notes:\n${notes || "(no notes provided)"}\n\nScore this marketing video submission across all 5 categories.`
    : `Staff completion notes:\n${notes || "(no notes provided)"}\n\nScore this marketing content submission.`;

  userContent.push({ type: "text", text: contextNote });

  const response = await fetch("http://localhost:5000/api/score-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, userContent }),
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const parsed = data.result;

  const categories: AIScoreCategory[] = (parsed.categories || []).map((cat: any) => ({
    ...cat,
    max: 20,
    color: CATEGORY_COLOR[cat.id] || "#00d4ff",
    // Clamp each subcriterion to its max, then recompute category total
    subcriteria: (cat.subcriteria || []).map((sub: any) => ({
      ...sub,
      score: Math.min(Math.max(0, sub.score ?? 0), sub.max ?? 4),
      max: sub.max ?? 4,
    })),
  })).map((cat: AIScoreCategory) => ({
    ...cat,
    score: Math.min(cat.subcriteria.reduce((s, sub) => s + sub.score, 0), 20),
  }));

  const totalRaw = categories.reduce((s: number, c: AIScoreCategory) => s + c.score, 0);
  const percentScore = Math.round((totalRaw / 100) * 100);
  const grade = gradeFromPercent(percentScore);

  return {
    categories, percentScore, grade,
    grammarErrors: parsed.grammarErrors || [],
    grammarClean: parsed.grammarClean ?? true,
    strengths: parsed.strengths || [],
    improvements: parsed.improvements || [],
    extractedText: parsed.extractedText || "",
    verdict: parsed.verdict || "",
  };
}

// ── Scoreboard Panel ─────────────────────────────────────────────────────────
interface ScoreboardProps {
  user: { name?: string; email?: string; role?: string } | null;
  profilePic: string | null;
  tasks: Task[];
}

const ScoreboardPanel: React.FC<ScoreboardProps> = ({ user, profilePic, tasks }) => {
  const now   = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const weekTasks  = tasks.filter(t => t.createdAt && new Date(t.createdAt) >= weekStart);
  const monthTasks = tasks.filter(t => t.createdAt && new Date(t.createdAt) >= monthStart);

  const completed = tasks.filter(t => t.approvalStatus === "superadmin-approved");
  const delayed   = tasks.filter(t => isDelayed(t));
  const pending   = tasks.filter(t => t.approvalStatus !== "superadmin-approved" && t.approvalStatus !== "in-review" && t.approvalStatus !== "admin-approved");
  const inReview  = tasks.filter(t => t.approvalStatus === "in-review" || t.approvalStatus === "admin-approved");

  // TAT calculation — tasks completed within due date vs overdue
  const withinTAT = completed.filter(t => {
    if (!t.dueDate || !t.createdAt) return false;
    return new Date(t.dueDate) >= now;
  }).length;
  const outOfTAT  = completed.length - withinTAT;

  const totalScore = tasks.length > 0
    ? Math.round(((completed.length * 3 + inReview.length * 1 - delayed.length * 2) / (tasks.length * 3)) * 100)
    : 0;
  const performanceScore = Math.max(0, Math.min(100, totalScore));

  const scoreColor = performanceScore >= 75 ? "#00ff88" : performanceScore >= 50 ? "#f5c518" : "#ff3366";
  const name = user?.name || "Staff";
  const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const stats = [
    { label: "This Week",   value: weekTasks.length,  sub: "assigned",   color: "#00d4ff", icon: "📅" },
    { label: "This Month",  value: monthTasks.length, sub: "assigned",   color: "#b06af3", icon: "🗓" },
    { label: "Completed",   value: completed.length,  sub: "total",      color: "#00ff88", icon: "✓"  },
    { label: "In Review",   value: inReview.length,   sub: "awaiting",   color: "#b06af3", icon: "⏳" },
    { label: "Pending",     value: pending.length,    sub: "active",     color: "#f5c518", icon: "⚡" },
    { label: "Delayed",     value: delayed.length,    sub: "overdue",    color: "#ff3366", icon: "⚠"  },
  ];

  return (
    <div className="sd-scoreboard">
      {/* Profile card */}
      <div style={{
        background: "rgba(6,10,21,0.7)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16, padding: "20px 16px",
        backdropFilter: "blur(24px)",
        textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* Glow bg */}
        <div style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${scoreColor}18, transparent 70%)`, pointerEvents: "none" }} />

        {/* Photo */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 14 }}>
          {profilePic ? (
            <img src={profilePic} alt="Profile" style={{
              width: 90, height: 90, borderRadius: "50%", objectFit: "cover",
              border: `3px solid ${scoreColor}`,
              boxShadow: `0 0 24px ${scoreColor}55, 0 0 48px ${scoreColor}22`,
            }} />
          ) : (
            <div style={{
              width: 90, height: 90, borderRadius: "50%",
              background: `linear-gradient(135deg, rgba(0,212,255,0.2), rgba(123,47,255,0.2))`,
              border: `3px solid ${scoreColor}`,
              boxShadow: `0 0 24px ${scoreColor}55`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 900, color: scoreColor,
              fontFamily: "'Space Grotesk', sans-serif",
            }}>{initials}</div>
          )}
          {/* Score ring label */}
          <div style={{
            position: "absolute", bottom: -4, right: -4,
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(6,10,21,0.95)",
            border: `2px solid ${scoreColor}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 900, color: scoreColor,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>{performanceScore}</div>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: "#eef0ff", fontFamily: "'Space Grotesk', sans-serif", marginBottom: 2, letterSpacing: "-0.2px" }}>{name.split(" ")[0]}</div>
        <div style={{ fontSize: 9, color: "#7e84a3", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600 }}>Staff Member</div>

        {/* Score bar */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: "#7e84a3", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" }}>Performance Score</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: scoreColor }}>{performanceScore}%</span>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${performanceScore}%`, background: `linear-gradient(90deg, ${scoreColor}aa, ${scoreColor})`, borderRadius: 3, boxShadow: `0 0 8px ${scoreColor}`, transition: "width 1.2s ease" }} />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        background: "rgba(6,10,21,0.7)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16, padding: "16px",
        backdropFilter: "blur(24px)",
      }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <span>◈</span> Task Scorecard
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stats.map(s => (
            <div key={s.label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "7px 10px", borderRadius: 8,
              background: `${s.color}08`,
              border: `1px solid ${s.color}18`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 11 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#c8ccdd" }}>{s.label}</div>
                  <div style={{ fontSize: 8, color: "#434763", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.sub}</div>
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TAT card */}
      <div style={{
        background: "rgba(6,10,21,0.7)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16, padding: "16px",
        backdropFilter: "blur(24px)",
      }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#f5c518", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={10} color="#f5c518" /> Turnaround Time
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, padding: "10px 8px", background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#00ff88", fontFamily: "'Space Grotesk', sans-serif" }}>{withinTAT}</div>
            <div style={{ fontSize: 8, color: "#00ff88", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2 }}>Within TAT</div>
          </div>
          <div style={{ flex: 1, padding: "10px 8px", background: "rgba(255,51,102,0.06)", border: "1px solid rgba(255,51,102,0.15)", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#ff3366", fontFamily: "'Space Grotesk', sans-serif" }}>{outOfTAT}</div>
            <div style={{ fontSize: 8, color: "#ff3366", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2 }}>Out of TAT</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const avgCompletionTime = (tasks: Task[]): string => {
  const done = tasks.filter(t => t.approvalStatus === "superadmin-approved" && t.createdAt);
  if (!done.length) return "—";
  const avg = done.reduce((acc, t) => {
    const diff = new Date(t.dueDate).getTime() - new Date(t.createdAt!).getTime();
    return acc + Math.abs(diff);
  }, 0) / done.length;
  const days = Math.round(avg / (1000 * 60 * 60 * 24));
  return `${days}d`;
};

// ── Assistance Ticket Types ─────────────────────────────────────────────────
interface AssistanceTicket {
  id: string;
  taskId: string;
  taskTitle: string;
  taskDueDate: string;
  raisedAt: string;
  status: "open" | "pending-admin" | "admin-approved" | "resolved";
  reason: string;
  staffNote: string;
  adminComment?: string;
}

const generateTicketId = (): string =>
  "TKT-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 5).toUpperCase();

// ── Flash Notification Panel ─────────────────────────────────────────────────
interface FlashPanelProps {
  tasks: Task[];
  tickets: AssistanceTicket[];
  onClose: () => void;
  onSelectDelayedTask: (task: Task) => void;
  userName: string;
}

const FlashPanel: React.FC<FlashPanelProps> = ({ tasks, tickets, onClose, onSelectDelayedTask, userName }) => {
  const [visible, setVisible] = useState(false);
  const [selectedDelayed, setSelectedDelayed] = useState<string | null>(null);
  const [newDeadlines, setNewDeadlines] = useState<{ [id: string]: string }>({});
  const [savedDeadlines, setSavedDeadlines] = useState<{ [id: string]: string }>({});

  const pendingTasks   = tasks.filter(t => t.approvalStatus !== "superadmin-approved" && t.approvalStatus !== "in-review" && t.approvalStatus !== "admin-approved");
  const inReviewTasks  = tasks.filter(t => t.approvalStatus === "in-review" || t.approvalStatus === "admin-approved");
  const completedTasks = tasks.filter(t => t.approvalStatus === "superadmin-approved");
  const delayedTasks   = tasks.filter(t => {
    if (t.approvalStatus === "superadmin-approved") return false;
    return isDelayed(t);
  });

  useEffect(() => {
    setTimeout(() => setVisible(true), 80);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 320);
  };

  const handleSaveDeadline = (taskId: string) => {
    if (!newDeadlines[taskId]) return;
    setSavedDeadlines(prev => ({ ...prev, [taskId]: newDeadlines[taskId] }));
    onSelectDelayedTask({ ...tasks.find(t => t.id === taskId)!, dueDate: newDeadlines[taskId] });
    setSelectedDelayed(null);
  };

  const stats = [
    { label: "All Tasks",  value: tasks.length,                                          color: "#00d4ff", icon: "◈" },
    { label: "Pending",    value: pendingTasks.length,                                   color: "#f5c518", icon: "⚡" },
    { label: "In Review",  value: inReviewTasks.length,                                  color: "#b06af3", icon: "⏳" },
    { label: "Completed",  value: completedTasks.length,                                 color: "#00ff88", icon: "✓" },
    { label: "Delayed",    value: delayedTasks.length,                                   color: "#ff3366", icon: "⚠" },
    { label: "Tickets",    value: tickets.filter(t => t.status !== "resolved").length,   color: "#ff9500", icon: "🎫" },
  ];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.32s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        background: "rgba(8,11,26,0.97)",
        border: "1px solid rgba(0,212,255,0.2)",
        borderRadius: "20px",
        padding: "0",
        maxWidth: "620px",
        width: "100%",
        maxHeight: "88vh",
        overflowY: "auto",
        boxShadow: "0 40px 100px rgba(0,0,0,0.9), 0 0 80px rgba(0,212,255,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
        transform: visible ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
        transition: "transform 0.32s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        {/* Header */}
        <div style={{
          padding: "22px 26px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(135deg, rgba(0,212,255,0.05), rgba(123,47,255,0.05))",
          borderRadius: "20px 20px 0 0",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -30, right: -30, width: 120, height: 120,
            borderRadius: "50%", background: "rgba(0,212,255,0.06)", filter: "blur(30px)",
            pointerEvents: "none",
          }} />
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "3px 10px", borderRadius: 6,
                background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
                fontSize: 9, fontWeight: 800, color: "#00d4ff",
                textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 10,
              }}>
                <Zap size={8} /> Live Briefing
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#eef0ff", letterSpacing: "-0.5px", fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.1 }}>
                Welcome back, <span style={{ color: "#00d4ff" }}>{userName}</span>
              </div>
              <div style={{ fontSize: 12, color: "#7e84a3", marginTop: 6 }}>
                Here's your workload snapshot — review delayed items first.
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 9, width: 32, height: 32, color: "#7e84a3",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.18s", flexShrink: 0, fontSize: 12,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ff3366"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,51,102,0.3)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#7e84a3"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
            >✕</button>
          </div>

          {/* Stat pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
            {stats.map(s => (
              <div key={s.label} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "7px 12px", borderRadius: 9,
                background: `${s.color}0d`,
                border: `1px solid ${s.color}33`,
                transition: "all 0.2s",
              }}>
                <span style={{ fontSize: 11, color: s.color }}>{s.icon}</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: s.color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{s.value}</span>
                <span style={{ fontSize: 9, color: "#7e84a3", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Delayed Tasks Section */}
        {delayedTasks.length > 0 && (
          <div style={{ padding: "18px 26px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
              paddingBottom: 10, borderBottom: "1px solid rgba(255,51,102,0.12)",
            }}>
              <AlertTriangle size={13} color="#ff3366" />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#ff3366", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                Delayed Tasks — Action Required
              </span>
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9,
                background: "rgba(255,51,102,0.15)", border: "1px solid rgba(255,51,102,0.35)",
                fontSize: 9, color: "#ff3366", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, padding: "0 4px",
              }}>{delayedTasks.length}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {delayedTasks.map(task => (
                <div key={task.id} style={{
                  background: "rgba(255,51,102,0.04)",
                  border: "1px solid rgba(255,51,102,0.18)",
                  borderRadius: 12, overflow: "hidden",
                  transition: "border-color 0.18s",
                }}>
                  <div
                    style={{ padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}
                    onClick={() => setSelectedDelayed(selectedDelayed === task.id ? null : task.id)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                        <span style={{ fontSize: 8, padding: "2px 5px", borderRadius: 3, background: "rgba(255,51,102,0.12)", color: "#ff3366", fontWeight: 700, textTransform: "uppercase", border: "1px solid rgba(255,51,102,0.25)" }}>OVERDUE</span>
                        {savedDeadlines[task.id] && <span style={{ fontSize: 8, padding: "2px 5px", borderRadius: 3, background: "rgba(0,255,136,0.1)", color: "#00ff88", fontWeight: 700, textTransform: "uppercase", border: "1px solid rgba(0,255,136,0.25)" }}>RESCHEDULED</span>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#eef0ff", marginBottom: 3 }}>{task.title}</div>
                      <div style={{ fontSize: 11, color: "#7e84a3" }}>
                        Original deadline: <span style={{ color: "#ff3366", fontWeight: 600 }}>{new Date(task.dueDate).toLocaleDateString()}</span>
                        {savedDeadlines[task.id] && <> → <span style={{ color: "#00ff88", fontWeight: 600 }}>{new Date(savedDeadlines[task.id]).toLocaleDateString()}</span></>}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: "#ff3366", transition: "transform 0.2s", transform: selectedDelayed === task.id ? "rotate(180deg)" : "none", flexShrink: 0 }}>▼</div>
                  </div>

                  {selectedDelayed === task.id && (
                    <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(255,51,102,0.1)" }}>
                      <div style={{ paddingTop: 12 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#7e84a3", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                          Set Revised Deadline
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            type="date"
                            value={newDeadlines[task.id] || ""}
                            min={new Date().toISOString().split("T")[0]}
                            onChange={e => setNewDeadlines(prev => ({ ...prev, [task.id]: e.target.value }))}
                            style={{
                              flex: 1, padding: "8px 10px",
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 8, color: "#eef0ff", fontSize: 12,
                              outline: "none", fontFamily: "inherit",
                            }}
                          />
                          <button
                            onClick={() => handleSaveDeadline(task.id)}
                            disabled={!newDeadlines[task.id]}
                            style={{
                              padding: "8px 14px",
                              background: newDeadlines[task.id] ? "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.1))" : "rgba(255,255,255,0.03)",
                              border: `1px solid ${newDeadlines[task.id] ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.07)"}`,
                              borderRadius: 8, color: newDeadlines[task.id] ? "#00d4ff" : "#434763",
                              fontSize: 11, fontWeight: 700, cursor: newDeadlines[task.id] ? "pointer" : "not-allowed",
                              fontFamily: "inherit", transition: "all 0.18s",
                              textTransform: "uppercase", letterSpacing: "0.5px",
                            }}
                          >Save</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assistance Tickets Section in Flash Panel */}
        {tickets.filter(t => t.status !== "resolved").length > 0 && (
          <div style={{ padding: "0 26px 18px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
              paddingTop: 14, borderTop: "1px solid rgba(255,149,0,0.15)",
            }}>
              <span style={{ fontSize: 13 }}>🎫</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#ff9500", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                Assistance Tickets
              </span>
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9,
                background: "rgba(255,149,0,0.15)", border: "1px solid rgba(255,149,0,0.35)",
                fontSize: 9, color: "#ff9500", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, padding: "0 4px",
              }}>{tickets.filter(t => t.status !== "resolved").length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {tickets.filter(t => t.status !== "resolved").map(ticket => (
                <div key={ticket.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "10px 12px", borderRadius: 9,
                  background: "rgba(255,149,0,0.04)",
                  border: "1px solid rgba(255,149,0,0.16)",
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "rgba(255,149,0,0.12)", color: "#ff9500", fontWeight: 700, textTransform: "uppercase", border: "1px solid rgba(255,149,0,0.25)" }}>{ticket.id}</span>
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3,
                        background: ticket.status === "admin-approved" ? "rgba(0,255,136,0.1)" : ticket.status === "pending-admin" ? "rgba(176,106,243,0.1)" : "rgba(255,149,0,0.1)",
                        color: ticket.status === "admin-approved" ? "#00ff88" : ticket.status === "pending-admin" ? "#b06af3" : "#ff9500",
                        fontWeight: 700, textTransform: "uppercase",
                        border: `1px solid ${ticket.status === "admin-approved" ? "rgba(0,255,136,0.25)" : ticket.status === "pending-admin" ? "rgba(176,106,243,0.25)" : "rgba(255,149,0,0.25)"}`,
                      }}>{ticket.status === "pending-admin" ? "Awaiting Admin" : ticket.status === "admin-approved" ? "Approved" : "Open"}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#c8ccdd", fontWeight: 500, marginBottom: 2 }}>{ticket.taskTitle}</div>
                    <div style={{ fontSize: 10, color: "#7e84a3" }}>Raised: {new Date(ticket.raisedAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Pending Tasks List */}
        <div style={{ padding: "0 26px 18px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
            paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)",
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              All Pending Tasks
            </span>
          </div>
          {tasks.filter(t => t.approvalStatus !== "superadmin-approved").length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", fontSize: 13, color: "#434763" }}>
              🎉 You're all caught up!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {tasks.filter(t => t.approvalStatus !== "superadmin-approved").map(task => {
                const delayed = isDelayed(task);
                return (
                  <div key={task.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 9,
                    background: delayed ? "rgba(255,51,102,0.04)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${delayed ? "rgba(255,51,102,0.16)" : "rgba(255,255,255,0.05)"}`,
                  }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: delayed ? "#ff3366" : task.approvalStatus === "in-review" ? "#b06af3" : "#f5c518",
                      boxShadow: `0 0 8px ${delayed ? "#ff3366" : task.approvalStatus === "in-review" ? "#b06af3" : "#f5c518"}`,
                    }} />
                    <div style={{ flex: 1, fontSize: 12, color: "#c8ccdd", fontWeight: 500 }}>{task.title}</div>
                    {delayed && <span style={{ fontSize: 8, padding: "2px 5px", borderRadius: 3, background: "rgba(255,51,102,0.12)", color: "#ff3366", fontWeight: 700, textTransform: "uppercase", border: "1px solid rgba(255,51,102,0.2)", flexShrink: 0 }}>LATE</span>}
                    <span style={{ fontSize: 10, color: "#434763", flexShrink: 0 }}>{new Date(task.dueDate).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 26px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", justifyContent: "flex-end",
        }}>
          <button
            onClick={handleClose}
            style={{
              padding: "10px 22px",
              background: "linear-gradient(135deg, #7b2fff, #00d4ff)",
              border: "none", borderRadius: 9, color: "white",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.6px",
              boxShadow: "0 0 24px rgba(0,212,255,0.2)",
              transition: "all 0.18s",
            }}
          >
            Got it — Let's go →
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Right-Side Analytics Panel ───────────────────────────────────────────────
interface AnalyticsPanelProps {
  tasks: Task[];
  tickets: AssistanceTicket[];
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ tasks, tickets }) => {
  const pending   = tasks.filter(t => t.approvalStatus !== "superadmin-approved" && t.approvalStatus !== "in-review" && t.approvalStatus !== "admin-approved");
  const completed = tasks.filter(t => t.approvalStatus === "superadmin-approved");
  const delayed   = tasks.filter(t => isDelayed(t));
  const overdue   = tasks.filter(t => {
    if (t.approvalStatus === "superadmin-approved") return false;
    const due = new Date(t.dueDate);
    due.setHours(23, 59, 59, 999);
    return due < new Date();
  });

  const today = new Date().toDateString();
  const completedToday = completed.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === today);
  const delayRate = tasks.length > 0 ? Math.round((delayed.length / tasks.length) * 100) : 0;

  const bars = [
    { label: "Pending",   value: pending.length,   max: tasks.length || 1, color: "#f5c518" },
    { label: "Completed", value: completed.length,  max: tasks.length || 1, color: "#00ff88" },
    { label: "Delayed",   value: delayed.length,    max: tasks.length || 1, color: "#ff3366" },
    { label: "Overdue",   value: overdue.length,    max: tasks.length || 1, color: "#ff6b35" },
    { label: "Tickets",   value: tickets.filter(t => t.status !== "resolved").length, max: Math.max(tasks.length || 1, tickets.length || 1), color: "#ff9500" },
  ];

  return (
    <div style={{
      width: "260px",
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    }}>
      {/* Analytics header */}
      <div style={{
        background: "rgba(6,10,21,0.55)",
        border: "1px solid rgba(255,255,255,0.055)",
        borderRadius: "14px",
        padding: "18px",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
          <BarChart2 size={13} color="#00d4ff" />
          <span style={{ fontSize: 10, fontWeight: 800, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "1px" }}>Task Analytics</span>
        </div>

        {/* Bar chart */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bars.map(bar => (
            <div key={bar.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: "#7e84a3", fontWeight: 600 }}>{bar.label}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: bar.color, fontFamily: "'Space Grotesk', sans-serif" }}>{bar.value}</span>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${(bar.value / bar.max) * 100}%`,
                  background: bar.color,
                  borderRadius: 3,
                  boxShadow: `0 0 8px ${bar.color}`,
                  transition: "width 1s ease",
                  minWidth: bar.value > 0 ? "4px" : "0",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Absolute metrics */}
      <div style={{
        background: "rgba(6,10,21,0.55)",
        border: "1px solid rgba(255,255,255,0.055)",
        borderRadius: "14px",
        padding: "18px",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
          <TrendingUp size={13} color="#b06af3" />
          <span style={{ fontSize: 10, fontWeight: 800, color: "#b06af3", textTransform: "uppercase", letterSpacing: "1px" }}>Performance</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { label: "Total Assigned",    value: tasks.length.toString(),      color: "#00d4ff" },
            { label: "Completed Today",   value: completedToday.length.toString(), color: "#00ff88" },
            { label: "Avg. Completion",   value: avgCompletionTime(tasks),     color: "#f5c518" },
            { label: "Delay Rate",        value: `${delayRate}%`,              color: delayRate > 30 ? "#ff3366" : "#00ff88" },
          ].map(m => (
            <div key={m.label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 10px", borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}>
              <span style={{ fontSize: 10, color: "#7e84a3", fontWeight: 500 }}>{m.label}</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: m.color, fontFamily: "'Space Grotesk', sans-serif" }}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Assistance Tickets mini summary */}
      {tickets.filter(t => t.status !== "resolved").length > 0 && (
        <div style={{
          background: "rgba(6,10,21,0.55)",
          border: "1px solid rgba(255,149,0,0.15)",
          borderRadius: "14px",
          padding: "16px 18px",
          backdropFilter: "blur(20px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
            <span style={{ fontSize: 12 }}>🎫</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#ff9500", textTransform: "uppercase", letterSpacing: "1px" }}>Tickets</span>
            <span style={{
              minWidth: 16, height: 16, borderRadius: 8,
              background: "rgba(255,149,0,0.15)", border: "1px solid rgba(255,149,0,0.3)",
              fontSize: 8, color: "#ff9500", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, padding: "0 3px",
            }}>{tickets.filter(t => t.status !== "resolved").length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tickets.filter(t => t.status !== "resolved").map(ticket => (
              <div key={ticket.id} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "6px 8px", borderRadius: 7,
                background: "rgba(255,149,0,0.04)",
                border: "1px solid rgba(255,149,0,0.12)",
              }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                  background: ticket.status === "admin-approved" ? "#00ff88" : ticket.status === "pending-admin" ? "#b06af3" : "#ff9500",
                  boxShadow: `0 0 6px ${ticket.status === "admin-approved" ? "#00ff88" : ticket.status === "pending-admin" ? "#b06af3" : "#ff9500"}`,
                }} />
                <span style={{ fontSize: 9, color: "#c8ccdd", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket.taskTitle}</span>
                <span style={{ fontSize: 8, color: ticket.status === "pending-admin" ? "#b06af3" : "#ff9500", fontWeight: 700, flexShrink: 0 }}>
                  {ticket.status === "pending-admin" ? "REVIEW" : ticket.status === "admin-approved" ? "✓" : "OPEN"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All tasks list */}
      <div style={{
        background: "rgba(6,10,21,0.55)",
        border: "1px solid rgba(255,255,255,0.055)",
        borderRadius: "14px",
        padding: "18px",
        backdropFilter: "blur(20px)",
        maxHeight: "320px",
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#eef0ff", textTransform: "uppercase", letterSpacing: "1px" }}>All Tasks</span>
          <span style={{
            minWidth: 16, height: 16, borderRadius: 8,
            background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
            fontSize: 8, color: "#00d4ff", display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, padding: "0 3px",
          }}>{tasks.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tasks.map(task => {
            const d = isDelayed(task);
            const statusColor = task.approvalStatus === "superadmin-approved" ? "#00ff88"
              : d ? "#ff3366"
              : task.approvalStatus === "in-review" ? "#b06af3"
              : "#f5c518";
            return (
              <div key={task.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 9px", borderRadius: 7,
                background: d ? "rgba(255,51,102,0.04)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${d ? "rgba(255,51,102,0.12)" : "rgba(255,255,255,0.04)"}`,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
                <span style={{ fontSize: 10, color: "#c8ccdd", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
                {d && <AlertTriangle size={8} color="#ff3366" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


// ── Assistance Tickets Tab ───────────────────────────────────────────────────
interface AssistanceTicketsTabProps {
  tickets: AssistanceTicket[];
  onUpdateTicket: (id: string, updates: Partial<AssistanceTicket>) => void;
  onSubmitToAdmin: (id: string) => void;
}

const AssistanceTicketsTab: React.FC<AssistanceTicketsTabProps> = ({ tickets, onUpdateTicket, onSubmitToAdmin }) => {
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [staffNotes, setStaffNotes] = useState<{ [id: string]: string }>({});

  if (tickets.length === 0) {
    return (
      <div style={{
        textAlign: "center", padding: "64px 24px",
        background: "rgba(6,10,21,0.55)",
        border: "1px dashed rgba(255,149,0,0.1)",
        borderRadius: "16px",
      }}>
        <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.25 }}>🎫</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#7e84a3", marginBottom: 5, fontFamily: "'Space Grotesk', sans-serif" }}>No Assistance Tickets</div>
        <div style={{ fontSize: 12, color: "#434763" }}>Tickets are auto-raised when tasks are overdue.</div>
      </div>
    );
  }

  const statusMeta: Record<string, { label: string; color: string; bg: string; border: string }> = {
    "open":           { label: "Open",           color: "#ff9500", bg: "rgba(255,149,0,0.1)",   border: "rgba(255,149,0,0.3)"   },
    "pending-admin":  { label: "Awaiting Admin",  color: "#b06af3", bg: "rgba(176,106,243,0.1)", border: "rgba(176,106,243,0.3)" },
    "admin-approved": { label: "Admin Approved",  color: "#00ff88", bg: "rgba(0,255,136,0.1)",   border: "rgba(0,255,136,0.3)"   },
    "resolved":       { label: "Resolved",        color: "#00d4ff", bg: "rgba(0,212,255,0.1)",   border: "rgba(0,212,255,0.3)"   },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header info */}
      <div style={{
        padding: "14px 18px",
        background: "rgba(255,149,0,0.04)",
        border: "1px solid rgba(255,149,0,0.15)",
        borderRadius: 12,
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🎫</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#ff9500", marginBottom: 3 }}>Auto-Raised Assistance Tickets</div>
          <div style={{ fontSize: 11, color: "#7e84a3", lineHeight: 1.6 }}>
            The system automatically raises an assistance ticket for every delayed task and assigns it to you.
            Add your notes, then submit to your admin for review and approval.
          </div>
        </div>
      </div>

      {tickets.map(ticket => {
        const sm = statusMeta[ticket.status] ?? statusMeta["open"];
        const isOpen = expanded === ticket.id;

        return (
          <div key={ticket.id} style={{
            background: "rgba(6,10,21,0.55)",
            border: `1px solid ${ticket.status === "open" ? "rgba(255,149,0,0.2)" : ticket.status === "pending-admin" ? "rgba(176,106,243,0.2)" : ticket.status === "admin-approved" ? "rgba(0,255,136,0.2)" : "rgba(0,212,255,0.15)"}`,
            borderRadius: 14, overflow: "hidden",
            backdropFilter: "blur(20px)",
          }}>
            {/* Ticket header */}
            <div
              style={{ padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14 }}
              onClick={() => setExpanded(isOpen ? null : ticket.id)}
            >
              <div style={{ flex: 1 }}>
                {/* Ticket ID + Status row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 9, padding: "2px 7px", borderRadius: 4,
                    background: "rgba(255,149,0,0.1)", color: "#ff9500",
                    fontWeight: 800, textTransform: "uppercase",
                    border: "1px solid rgba(255,149,0,0.25)", letterSpacing: "0.5px",
                  }}>{ticket.id}</span>
                  <span style={{
                    fontSize: 9, padding: "2px 7px", borderRadius: 4,
                    background: sm.bg, color: sm.color,
                    fontWeight: 800, textTransform: "uppercase",
                    border: `1px solid ${sm.border}`,
                  }}>{sm.label}</span>
                  <span style={{
                    fontSize: 9, padding: "2px 7px", borderRadius: 4,
                    background: "rgba(255,51,102,0.08)", color: "#ff3366",
                    fontWeight: 700, textTransform: "uppercase",
                    border: "1px solid rgba(255,51,102,0.2)",
                  }}>Delayed Task</span>
                </div>

                {/* Task title */}
                <div style={{ fontSize: 14, fontWeight: 700, color: "#eef0ff", marginBottom: 4 }}>
                  {ticket.taskTitle}
                </div>

                {/* Reason */}
                <div style={{ fontSize: 11, color: "#7e84a3", lineHeight: 1.5, marginBottom: 6 }}>
                  {ticket.reason}
                </div>

                {/* Meta row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 10, color: "#434763" }}>
                  <span>📅 Task Due: <span style={{ color: "#ff3366", fontWeight: 600 }}>{new Date(ticket.taskDueDate).toLocaleDateString()}</span></span>
                  <span>🕐 Raised: <span style={{ color: "#7e84a3", fontWeight: 500 }}>{new Date(ticket.raisedAt).toLocaleString()}</span></span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#7e84a3", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none", flexShrink: 0, marginTop: 4 }}>▼</div>
            </div>

            {/* Admin comment (if any) */}
            {ticket.adminComment && (
              <div style={{
                margin: "0 18px 14px",
                padding: "10px 12px",
                background: "rgba(0,255,136,0.05)",
                border: "1px solid rgba(0,255,136,0.18)",
                borderRadius: 9,
                fontSize: 11, color: "#c8f5dc", lineHeight: 1.5,
              }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#00ff88", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>
                  ✓ Admin Response
                </div>
                {ticket.adminComment}
              </div>
            )}

            {/* Your existing note */}
            {ticket.staffNote && !isOpen && (
              <div style={{
                margin: "0 18px 14px",
                padding: "9px 12px",
                background: "rgba(0,212,255,0.05)",
                border: "1px solid rgba(0,212,255,0.14)",
                borderRadius: 9,
                fontSize: 11, color: "#7e84a3", lineHeight: 1.5,
              }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Your Note</div>
                {ticket.staffNote}
              </div>
            )}

            {/* Expanded panel */}
            {isOpen && (
              <div style={{ padding: "0 18px 18px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ paddingTop: 14 }}>

                  {/* Staff explanation note */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#7e84a3", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                      Your Explanation / Notes
                    </div>
                    <textarea
                      value={staffNotes[ticket.id] !== undefined ? staffNotes[ticket.id] : ticket.staffNote}
                      onChange={e => setStaffNotes(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                      placeholder="Explain why this task was delayed and your plan to resolve it…"
                      disabled={ticket.status === "pending-admin" || ticket.status === "admin-approved" || ticket.status === "resolved"}
                      style={{
                        width: "100%", padding: "10px 12px",
                        background: ticket.status === "open" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 9, color: "#eef0ff", fontSize: 12,
                        fontFamily: "inherit", resize: "vertical", outline: "none",
                        minHeight: 80, lineHeight: 1.5,
                        opacity: ticket.status !== "open" ? 0.6 : 1,
                        cursor: ticket.status !== "open" ? "not-allowed" : "text",
                      }}
                    />
                  </div>

                  {/* Action buttons */}
                  {ticket.status === "open" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      {/* Save note */}
                      <button
                        onClick={() => {
                          const note = staffNotes[ticket.id] ?? ticket.staffNote;
                          if (note.trim()) onUpdateTicket(ticket.id, { staffNote: note });
                        }}
                        style={{
                          flex: 1, padding: "9px",
                          background: "rgba(0,212,255,0.08)",
                          border: "1px solid rgba(0,212,255,0.25)",
                          borderRadius: 9, color: "#00d4ff",
                          fontSize: 11, fontWeight: 700, cursor: "pointer",
                          fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.5px",
                          transition: "all 0.18s",
                        }}
                      >
                        💾 Save Note
                      </button>

                      {/* Submit to admin */}
                      <button
                        onClick={() => onSubmitToAdmin(ticket.id)}
                        style={{
                          flex: 2, padding: "9px",
                          background: "linear-gradient(135deg, rgba(255,149,0,0.2), rgba(255,107,53,0.15))",
                          border: "1px solid rgba(255,149,0,0.4)",
                          borderRadius: 9, color: "#ff9500",
                          fontSize: 11, fontWeight: 700, cursor: "pointer",
                          fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.5px",
                          transition: "all 0.18s",
                          boxShadow: "0 0 16px rgba(255,149,0,0.15)",
                        }}
                      >
                        📤 Submit to Admin for Approval
                      </button>
                    </div>
                  )}

                  {ticket.status === "pending-admin" && (
                    <div style={{
                      padding: "10px 14px",
                      background: "rgba(176,106,243,0.08)",
                      border: "1px solid rgba(176,106,243,0.22)",
                      borderRadius: 9, fontSize: 11, color: "#b06af3",
                      fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ animation: "dotGlow 1.5s ease-in-out infinite" }}>⏳</span>
                      Submitted — awaiting admin review and approval
                    </div>
                  )}

                  {ticket.status === "admin-approved" && (
                    <div style={{
                      padding: "10px 14px",
                      background: "rgba(0,255,136,0.07)",
                      border: "1px solid rgba(0,255,136,0.22)",
                      borderRadius: 9, fontSize: 11, color: "#00ff88",
                      fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
                    }}>
                      ✓ Admin has reviewed and approved this ticket
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Delayed Tasks Tab ────────────────────────────────────────────────────────
interface DelayedTabProps {
  tasks: Task[];
  rescheduledTasks: { [id: string]: string };
  onReschedule: (taskId: string, newDate: string) => void;
  onComplete: (task: Task) => void;
  getProjectName: (id: string) => string;
}

const DelayedTab: React.FC<DelayedTabProps> = ({ tasks, rescheduledTasks, onReschedule, onComplete, getProjectName }) => {
  const [newDates,   setNewDates]   = useState<{ [id: string]: string }>({});
  const [notesInput, setNotesInput] = useState<{ [id: string]: string }>({});
  const [savedNotes, setSavedNotes] = useState<{ [id: string]: string }>({});
  const [expanded,   setExpanded]   = useState<string | null>(null);

  // Show tasks that are: (1) genuinely past due, OR (2) have been manually rescheduled
  // Exclude only fully superadmin-approved tasks
  const delayedTasks = tasks.filter(t => {
    if (t.approvalStatus === "superadmin-approved") return false;
    return isDelayed(t) || !!rescheduledTasks[t.id];
  });

  if (delayedTasks.length === 0) {
    return (
      <div style={{
        textAlign: "center", padding: "64px 24px",
        background: "rgba(6,10,21,0.55)",
        border: "1px dashed rgba(0,212,255,0.1)",
        borderRadius: "16px",
      }}>
        <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.2 }}>⏰</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#7e84a3", marginBottom: 5, fontFamily: "'Space Grotesk', sans-serif" }}>No Delayed Tasks</div>
        <div style={{ fontSize: 12, color: "#434763" }}>You're on schedule — great work!</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {delayedTasks.map(task => {
        const revised = rescheduledTasks[task.id];
        const isOpen = expanded === task.id;

        return (
          <div key={task.id} style={{
            background: "rgba(6,10,21,0.55)",
            border: "1px solid rgba(255,51,102,0.2)",
            borderRadius: 14,
            overflow: "hidden",
            backdropFilter: "blur(20px)",
          }}>
            {/* Task header */}
            <div
              style={{ padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14 }}
              onClick={() => setExpanded(isOpen ? null : task.id)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: "rgba(255,51,102,0.1)", color: "#ff3366", fontWeight: 700, textTransform: "uppercase", border: "1px solid rgba(255,51,102,0.25)" }}>DELAYED</span>
                  {revised && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: "rgba(0,212,255,0.1)", color: "#00d4ff", fontWeight: 700, textTransform: "uppercase", border: "1px solid rgba(0,212,255,0.25)" }}>RESCHEDULED</span>}
                  {task.approvalStatus === "superadmin-approved" && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: "rgba(0,255,136,0.1)", color: "#00ff88", fontWeight: 700, textTransform: "uppercase", border: "1px solid rgba(0,255,136,0.25)" }}>COMPLETED</span>}
                  <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: task.priority === "high" ? "rgba(255,51,102,0.08)" : "rgba(245,197,24,0.08)", color: task.priority === "high" ? "#ff3366" : "#f5c518", fontWeight: 700, textTransform: "uppercase", border: `1px solid ${task.priority === "high" ? "rgba(255,51,102,0.22)" : "rgba(245,197,24,0.22)"}` }}>{task.priority} priority</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#eef0ff", marginBottom: 4 }}>{task.title}</div>
                <div style={{ fontSize: 11, color: "#7e84a3", lineHeight: 1.5 }}>{task.description}</div>
              </div>
              <div style={{ fontSize: 10, color: "#ff3366", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none", flexShrink: 0, marginTop: 4 }}>▼</div>
            </div>

            {/* Deadline info */}
            <div style={{ padding: "0 18px 14px", display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 11, color: "#7e84a3" }}>
                <span style={{ fontWeight: 600, color: "#434763", textTransform: "uppercase", fontSize: 9, letterSpacing: "0.5px" }}>Original: </span>
                <span style={{ color: "#ff3366", fontWeight: 600 }}>{new Date(task.dueDate).toLocaleDateString()}</span>
              </div>
              {revised && (
                <div style={{ fontSize: 11, color: "#7e84a3" }}>
                  <span style={{ fontWeight: 600, color: "#434763", textTransform: "uppercase", fontSize: 9, letterSpacing: "0.5px" }}>Revised: </span>
                  <span style={{ color: "#00d4ff", fontWeight: 600 }}>{new Date(revised).toLocaleDateString()}</span>
                </div>
              )}
              {task.projectId && (
                <div style={{ fontSize: 11, color: "#7e84a3" }}>
                  <span style={{ fontWeight: 600, color: "#434763", textTransform: "uppercase", fontSize: 9, letterSpacing: "0.5px" }}>Project: </span>
                  <span style={{ color: "#b06af3", fontWeight: 600 }}>{getProjectName(task.projectId)}</span>
                </div>
              )}
            </div>

            {/* Expanded actions */}
            {isOpen && (
              <div style={{ padding: "14px 18px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                {/* Update deadline */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#7e84a3", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                    Update Deadline
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="date"
                      value={newDates[task.id] || ""}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={e => setNewDates(prev => ({ ...prev, [task.id]: e.target.value }))}
                      style={{
                        flex: 1, padding: "9px 11px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8, color: "#eef0ff", fontSize: 12,
                        outline: "none", fontFamily: "inherit",
                      }}
                    />
                    <button
                      onClick={() => { if (newDates[task.id]) { onReschedule(task.id, newDates[task.id]); setNewDates(prev => ({ ...prev, [task.id]: "" })); }}}
                      disabled={!newDates[task.id]}
                      style={{
                        padding: "9px 14px",
                        background: newDates[task.id] ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${newDates[task.id] ? "rgba(0,212,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                        borderRadius: 8, color: newDates[task.id] ? "#00d4ff" : "#434763",
                        fontSize: 11, fontWeight: 700, cursor: newDates[task.id] ? "pointer" : "not-allowed",
                        fontFamily: "inherit", transition: "all 0.18s", textTransform: "uppercase", letterSpacing: "0.5px",
                      }}
                    >
                      <Clock size={10} style={{ display: "inline", marginRight: 5 }} />
                      Reschedule
                    </button>
                  </div>
                </div>

                {/* Delay notes */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#7e84a3", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                    Delay Explanation (optional)
                  </div>
                  <textarea
                    value={notesInput[task.id] || ""}
                    onChange={e => setNotesInput(prev => ({ ...prev, [task.id]: e.target.value }))}
                    placeholder="Explain the reason for delay…"
                    style={{
                      width: "100%", padding: "9px 11px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8, color: "#eef0ff", fontSize: 12,
                      fontFamily: "inherit", resize: "vertical", outline: "none",
                      minHeight: 70, lineHeight: 1.5,
                    }}
                  />
                  {notesInput[task.id] && (
                    <button
                      onClick={() => { setSavedNotes(prev => ({ ...prev, [task.id]: notesInput[task.id] })); }}
                      style={{
                        marginTop: 6, padding: "6px 12px",
                        background: "rgba(176,106,243,0.1)", border: "1px solid rgba(176,106,243,0.25)",
                        borderRadius: 7, color: "#b06af3", fontSize: 10, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.5px",
                      }}
                    >
                      ✓ Save Note
                    </button>
                  )}
                  {savedNotes[task.id] && (
                    <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(176,106,243,0.06)", border: "1px solid rgba(176,106,243,0.18)", borderRadius: 7, fontSize: 11, color: "#c8a4f5", lineHeight: 1.5 }}>
                      <span style={{ fontSize: 8, fontWeight: 800, color: "#b06af3", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Saved Note</span>
                      {savedNotes[task.id]}
                    </div>
                  )}
                </div>

                {/* Mark complete */}
                {task.approvalStatus !== "superadmin-approved" && (
                  <button
                    onClick={() => onComplete(task)}
                    style={{
                      width: "100%", padding: "10px",
                      background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(123,47,255,0.15))",
                      border: "1px solid rgba(0,212,255,0.3)",
                      borderRadius: 9, color: "#00d4ff",
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.5px",
                      transition: "all 0.18s",
                    }}
                  >
                    <CheckCircle size={11} style={{ display: "inline", marginRight: 7 }} />
                    Mark as Completed
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Main StaffDashboard ──────────────────────────────────────────────────────
const StaffDashboard: React.FC = () => {
  const {
    getAssignedTasks,
    submitTaskCompletion,
    logout,
    user,
    getProjectById,
    teamMembers,
    updateTask,
  } = useUser();
  const navigate = useNavigate();

  const [selectedTask,        setSelectedTask]        = useState<Task | null>(null);
  const [completionNotes,     setCompletionNotes]     = useState("");
  const [showCompletionForm,  setShowCompletionForm]  = useState(false);
  const [mounted,             setMounted]             = useState(false);
  const [activeTab,           setActiveTab]           = useState<"pending" | "history" | "ai" | "delayed" | "tickets">("pending");
  const [activeFilter,        setActiveFilter]        = useState<string | null>(null);
  const [uploadedPhotos,      setUploadedPhotos]      = useState<{ [taskId: string]: string[] }>({});
  const [dragOver,            setDragOver]            = useState(false);
  const [successMsg,          setSuccessMsg]          = useState("");
  const [reviewingTask,       setReviewingTask]       = useState<string | null>(null);
  const [reviewResults,       setReviewResults]       = useState<{ [taskId: string]: ReviewResult }>({});
  const [expandedReviewPanel, setExpandedReviewPanel] = useState<string | null>(null);
  const [draftingTask,        setDraftingTask]        = useState<string | null>(null);
  const [draftedNotes,        setDraftedNotes]        = useState<{ [taskId: string]: string }>({});

  // New state
  const [showFlashPanel,    setShowFlashPanel]    = useState(false);
  const [rescheduledTasks,  setRescheduledTasks]  = useState<{ [id: string]: string }>({});
  const [tickets,           setTickets]           = useState<AssistanceTicket[]>([]);
  const ticketInitRef = useRef(false);

  // AI Score modal state
  const [aiScoreResult,     setAiScoreResult]     = useState<AIScoreResult | null>(null);
  const [analyzingImage,    setAnalyzingImage]    = useState(false);
  const [pendingSubmitTask, setPendingSubmitTask] = useState<string | null>(null);
  // Stage-based evaluation state
  const [evalStage,         setEvalStage]         = useState<number>(0); // 0=idle, 1-7=stages
  const [fileTypeBadge,     setFileTypeBadge]     = useState<{ type: string; fmt: string } | null>(null);
  const [mcbPhase,          setMcbPhase]          = useState<string>("Authority");
  // Deduction voice prompt state
  const [deductionPrompt,   setDeductionPrompt]   = useState<{ items: { label: string; note: string }[] } | null>(null);
  const [readingDeductions, setReadingDeductions] = useState(false);

  // Profile pic
  const [profilePic, setProfilePic] = useState<string | null>(() => {
    try { return localStorage.getItem("sd_profile_pic"); } catch { return null; }
  });
  const profileInputRef = useRef<HTMLInputElement>(null);
  const greetedRef = useRef(false);

  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    setElevenLabsVoice("ThT5KcBeYPX3keUQqHPh");
    const name = user?.name || localStorage.getItem("fullName") || "there";

    // Build a task-aware greeting message
    const allTasks      = getAssignedTasks();
    const pendingCount  = allTasks.filter(t =>
      t.approvalStatus !== "superadmin-approved" &&
      t.approvalStatus !== "in-review" &&
      t.approvalStatus !== "admin-approved"
    ).length;
    const delayedCount  = allTasks.filter(t => {
      if (t.approvalStatus === "superadmin-approved") return false;
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      if (isNaN(due.getTime())) return false;
      const now = new Date();
      return due.getFullYear() < now.getFullYear() ||
        (due.getFullYear() === now.getFullYear() && due.getMonth() < now.getMonth()) ||
        (due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth() && due.getDate() < now.getDate());
    }).length;

    // Cancel any accidental system speech — ElevenLabs only
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    setTimeout(async () => {
      // 1. ElevenLabs login greeting (time-of-day + name)
      await greetUser(name);

      // 2. Task summary — concise, tickets announced separately once generated
      const taskParts: string[] = [];
      if (pendingCount > 0)
        taskParts.push(`You have ${pendingCount} pending task${pendingCount !== 1 ? "s" : ""}.`);
      if (delayedCount > 0)
        taskParts.push(`${delayedCount} task${delayedCount !== 1 ? "s are" : " is"} overdue.`);
      if (pendingCount === 0 && delayedCount === 0)
        taskParts.push("You are all caught up. Great work!");

      if (taskParts.length > 0) {
        await speakText(taskParts.join(" "));
      }
    }, 800);

    // Show flash panel after brief delay
    setTimeout(() => setShowFlashPanel(true), 1200);
  }, [user]);

  // ── Voice: flash panel opens — speak ticket guidance (ticketVoiceRef removed, one effect only) ──
  const flashVoiceRef = useRef(false);
  useEffect(() => {
    if (!showFlashPanel) return;
    if (flashVoiceRef.current) return;
    if (tickets.length === 0) return;

    const openTickets = tickets.filter(t => t.status === "open");
    if (openTickets.length === 0) return;

    flashVoiceRef.current = true;

    const ticketNames = openTickets.map(t => t.taskTitle);
    let script = "";

    if (openTickets.length === 1) {
      script =
        `Attention. An assistance ticket has been automatically raised for your delayed task: ${ticketNames[0]}. ` +
        `This ticket is now visible on your flash briefing screen. ` +
        `Please navigate to the Assistance tab, add your explanation for the delay, and submit it to your admin for approval. ` +
        `Once your admin reviews and approves the ticket, it will be marked as closed.`;
    } else {
      const listed = ticketNames.slice(0, -1).join(", ") + ", and " + ticketNames[ticketNames.length - 1];
      script =
        `Attention. ${openTickets.length} assistance tickets have been automatically raised for your overdue tasks: ${listed}. ` +
        `These tickets are now visible on your flash briefing screen. ` +
        `Please navigate to the Assistance tab, explain the reason for each delay, and submit each ticket to your admin for approval. ` +
        `Tickets will be closed once your admin reviews and approves them.`;
    }

    setTimeout(async () => {
      await speakText(script);
    }, 3500);
  }, [showFlashPanel, tickets]);

  // Lightbox state
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex,  setLightboxIndex]  = useState(0);
  const [showLightbox,   setShowLightbox]   = useState(false);

  const assignedTasks  = getAssignedTasks();
  const pendingTasks   = assignedTasks.filter(
    (t) =>
      t.approvalStatus !== "superadmin-approved" &&
      t.approvalStatus !== "in-review" &&
      t.approvalStatus !== "admin-approved"
  );
  const inReviewTasks  = assignedTasks.filter(
    (t) => t.approvalStatus === "in-review" || t.approvalStatus === "admin-approved"
  );
  const completedTasks  = assignedTasks.filter((t) => t.approvalStatus === "superadmin-approved");
  const submittedTasks  = [...inReviewTasks, ...completedTasks];
  const delayedTasks    = assignedTasks.filter(t => isDelayed(t));

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLightbox(false);
      if (e.key === "ArrowRight") setLightboxIndex((i) => Math.min(i + 1, lightboxPhotos.length - 1));
      if (e.key === "ArrowLeft")  setLightboxIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxPhotos.length]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setProfilePic(url);
      try { localStorage.setItem("sd_profile_pic", url); } catch {}
      showSuccess("Profile photo updated ✓");
    };
    reader.readAsDataURL(file);
  };

  const getAssignerInfo = (assignedBy?: string) => {
    if (!assignedBy) return null;
    const member = teamMembers?.find((m) => m.email === assignedBy);
    return member ?? { name: assignedBy, role: "admin", email: assignedBy };
  };

  const openLightbox = (photos: string[], index = 0) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setShowLightbox(true);
  };

  const draftCompletionNotes = async (taskId: string) => {
    if (!completionNotes.trim()) {
      showSuccess("⚠ Please write some notes first to draft from");
      return;
    }
    setDraftingTask(taskId);
    try {
      const response = await fetch("http://localhost:5000/api/draft-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, notes: completionNotes }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        showSuccess(`✕ Error: ${errorData.message || "Unknown error"}`);
        return;
      }
      const data = await response.json();
      const improved = data.improvedNotes || completionNotes;
      setDraftedNotes((prev) => ({ ...prev, [taskId]: improved }));
      setCompletionNotes(improved);
      showSuccess("✓ Notes improved by AI!");
    } catch {
      showSuccess("✕ Error improving notes. Please try again.");
    } finally {
      setDraftingTask(null);
    }
  };

  const reviewAttachments = async (taskId: string) => {
    const photos = uploadedPhotos[taskId] || [];
    if (photos.length === 0) { showSuccess("⚠ No attachments to review"); return; }
    setReviewingTask(taskId);
    try {
      const contentArray: any[] = [
        {
          type: "text",
          text: `You are a professional document reviewer and grammar expert. Analyse every image above for ANY visible text and check for: 1. Grammatical errors (spelling, punctuation, syntax) 2. Clarity issues 3. Professional presentation 4. Format consistency. For EACH image provide: status "CLEAN" (no errors), "MINOR" (minor issues), or "ERROR" (critical issues). Return ONLY valid JSON array — no markdown:\n[{"image":1,"status":"CLEAN","issues":[],"recommendations":""}]`,
        },
      ];
      for (const photo of photos) {
        let base64Data = photo, mediaType = "image/jpeg";
        if (photo.startsWith("data:")) {
          const matches = photo.match(/data:([^;]+);base64,(.+)/);
          if (matches) { mediaType = matches[1]; base64Data = matches[2]; }
        }
        contentArray.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } });
      }

      const response = await fetch("http://localhost:5000/api/review-attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, contentArray }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        showSuccess(`✕ Error: ${errorData.message || "Unknown error"}`);
        return;
      }
      const data = await response.json();
      setReviewResults((prev) => ({
        ...prev,
        [taskId]: { results: data.results || [], hasErrors: data.hasErrors || false, timestamp: new Date().toISOString() },
      }));
      showSuccess(data.hasErrors ? "⚠ Review complete: Critical errors found." : "✓ Review complete: All attachments clear!");
    } catch {
      showSuccess("✕ Error reviewing attachments. Please try again.");
    } finally {
      setReviewingTask(null);
    }
  };

  // ── File type detection ──────────────────────────────────────────────────
  const detectFileInfo = (file: File | null, dataUrl?: string): { type: string; fmt: string } => {
    const mime = file?.type || (dataUrl ? dataUrl.split(";")[0].replace("data:", "") : "image/jpeg");
    const lower = mime.toLowerCase();
    if (lower.startsWith("video/")) {
      const fmt = lower.replace("video/", "").toUpperCase();
      return { type: "VIDEO", fmt: fmt === "QUICKTIME" ? "MOV" : fmt };
    }
    if (lower === "application/pdf") return { type: "DOCUMENT", fmt: "PDF" };
    if (lower.includes("word") || lower.includes("document")) return { type: "DOCUMENT", fmt: "DOCX" };
    if (lower.includes("sheet") || lower.includes("excel")) return { type: "DOCUMENT", fmt: "XLSX" };
    if (lower.includes("presentation") || lower.includes("powerpoint")) return { type: "DOCUMENT", fmt: "PPTX" };
    const fmt = lower.replace("image/", "").toUpperCase();
    return { type: "IMAGE", fmt: fmt === "JPEG" ? "JPG" : fmt || "JPG" };
  };

  const SMARTCUE_STAGES = [
    { id: 1, label: "File Type Detection",          icon: "◈", color: "#00d4ff" },
    { id: 2, label: "Content Category ID",          icon: "◉", color: "#b06af3" },
    { id: 3, label: "Frame Extraction / Analysis",  icon: "◎", color: "#f5c518" },
    { id: 4, label: "Brand Compliance Check",       icon: "◆", color: "#ff9500" },
    { id: 5, label: "Text & Grammar Validation",    icon: "◇", color: "#00ff88" },
    { id: 6, label: "Scoring Calculation",          icon: "◈", color: "#00d4ff" },
    { id: 7, label: "Final Score Display",          icon: "★", color: "#f5c518" },
  ];

  const handleMarkComplete = async () => {
    if (!selectedTask) return;
    const review = reviewResults[selectedTask.id];
    if (review && review.hasErrors) { showSuccess("⚠ Cannot submit: Fix the critical errors in attachments."); return; }
    const photos = uploadedPhotos[selectedTask.id] || [];
    if (!completionNotes.trim() && photos.length === 0) {
      showSuccess("⚠ Please add completion notes or upload a marketing file.");
      return;
    }

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const isVid = photos.length > 0 && photos[0].startsWith("data:video/");

    setAnalyzingImage(true);
    setEvalStage(1); // File type detection
    await sleep(500);
    setEvalStage(2); // Content category
    await sleep(600);
    setEvalStage(3); // Frame extraction (video) or visual analysis (image)
    speakText(isVid
      ? "SmartCue is extracting video frames and analysing your submission across 5 quality categories. Please wait."
      : "SmartCue is Analysing your submission across 5 quality categories. Please wait."
    );

    try {
      const result = await scoreWithAI(completionNotes, photos);

      setEvalStage(4); await sleep(400); // Brand compliance
      setEvalStage(5); await sleep(400); // Grammar validation
      setEvalStage(6); await sleep(500); // Scoring
      setEvalStage(7);                   // Final score reveal

      setAiScoreResult(result);
      setPendingSubmitTask(selectedTask.id);

      // Collect all deducted subcriteria (scored below max)
      const deductions = result.categories.flatMap(cat =>
        cat.subcriteria
          .filter(sub => sub.score < sub.max && sub.note)
          .map(sub => ({ label: sub.label, note: sub.note }))
      );

      const weakCats = result.categories.filter(c => c.score < 10).map(c => c.name);
      const voiceMsg =
        `SmartCue scoring complete. ` +
        `Total score: ${result.percentScore} out of 100. Grade: ${result.grade}. ` +
        `${result.verdict} ` +
        (weakCats.length > 0 ? `Weak areas: ${weakCats.join(", ")}. ` : "") +
        (result.grammarClean ? "Grammar is clean. " : `${result.grammarErrors.length} grammar issue${result.grammarErrors.length !== 1 ? "s" : ""} found. `) +
        (result.percentScore >= 55 ? "You may proceed and submit for approval." : "Consider revising before submitting.");

      await speakText(voiceMsg);

      // If there are deductions, prompt user to hear reasons
      if (deductions.length > 0) {
        setDeductionPrompt({ items: deductions });
        await speakText(`${deductions.length} parameter${deductions.length !== 1 ? "s have" : " has"} received negative marks. Would you like me to read the reasons for the deductions?`);
      }
    } catch {
      showSuccess("✕ SmartCue scoring failed — please try again.");
      speakText("Scoring failed. Please try again.");
      setEvalStage(0);
    } finally {
      setAnalyzingImage(false);
    }
  };

  // ── Deduction voice handlers ─────────────────────────────────────────────
  const handleReadDeductions = async () => {
    if (!deductionPrompt) return;
    setReadingDeductions(true);
    setDeductionPrompt(null);

    const items = deductionPrompt.items;
    await speakText(`Reading ${items.length} deduction${items.length !== 1 ? "s" : ""} now.`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Extract just the criterion code e.g. "A4: Production quality" → "A 4"
      const labelClean = item.label.replace(/([A-E])(\d)/, "$1 $2");
      await speakText(`Deduction ${i + 1}: ${labelClean}. Reason: ${item.note}`);
    }

    await speakText("That's all the deduction reasons. Please review the score panel for details before submitting.");
    setReadingDeductions(false);
  };

  const handleDismissDeductions = () => {
    setDeductionPrompt(null);
    setReadingDeductions(false);
    speakText("Understood. You can review the reasons in the score panel below.");
  };

  const handleConfirmSubmit = () => {
    if (!selectedTask || !pendingSubmitTask) return;
    updateTask?.(selectedTask.id, {
      title:           selectedTask.title,
      description:     selectedTask.description,
      status:          selectedTask.status,
      priority:        selectedTask.priority,
      dueDate:         selectedTask.dueDate,
      assignedTo:      selectedTask.assignedTo,
      projectId:       selectedTask.projectId,
      completionNotes: completionNotes,
      attachments:     uploadedPhotos[selectedTask.id] || [],
    } as any);
    submitTaskCompletion(selectedTask.id, completionNotes);
    speakText("Successfully submitted for admin approval. Well done!");
    showSuccess("Task submitted for review ✓");
    setAiScoreResult(null);
    setPendingSubmitTask(null);
    setSelectedTask(null);
    setCompletionNotes("");
    setShowCompletionForm(false);
    setEvalStage(0);
    setFileTypeBadge(null);
    setDeductionPrompt(null);
    setReadingDeductions(false);
  };

  const getProjectName = (projectId: string) => {
    try { return getProjectById(projectId)?.name || "—"; }
    catch { return "—"; }
  };

  const handlePhotoUpload = (taskId: string, files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      // Accept images, videos, and documents (PDF, DOCX, PPTX)
      const isImage    = file.type.startsWith("image/");
      const isVideo    = file.type.startsWith("video/");
      const isDocument = file.type === "application/pdf" ||
                         file.type.includes("word") ||
                         file.type.includes("presentation") ||
                         file.type.includes("sheet");
      if (!isImage && !isVideo && !isDocument) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setUploadedPhotos((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), url] }));
      };
      reader.readAsDataURL(file);
    });
    showSuccess("File uploaded ✓");
  };

  const removePhoto = (taskId: string, index: number) => {
    setUploadedPhotos((prev) => ({ ...prev, [taskId]: (prev[taskId] || []).filter((_, i) => i !== index) }));
    setReviewResults((prev) => { const u = { ...prev }; delete u[taskId]; return u; });
  };

  const getDisplayedTasks = () => {
    if (activeTab === "history") return submittedTasks;
    if (activeFilter === "all") return assignedTasks;
    if (activeFilter === "active") return pendingTasks;
    if (activeFilter === "inreview") return inReviewTasks;
    if (activeFilter === "approved") return completedTasks;
    return pendingTasks;
  };

  const displayedTasks = getDisplayedTasks();

  const handleFlashDelayedTask = (task: Task) => {
    setRescheduledTasks(prev => ({ ...prev, [task.id]: task.dueDate }));
    showSuccess(`✓ Deadline updated for "${task.title}"`);
  };

  const handleReschedule = (taskId: string, newDate: string) => {
    setRescheduledTasks(prev => ({ ...prev, [taskId]: newDate }));
    showSuccess("✓ Deadline rescheduled");
  };

  const handleDelayedComplete = (task: Task) => {
    setSelectedTask(task);
    setShowCompletionForm(true);
  };

  // ── Auto-generate Assistance Tickets for delayed tasks ──────────────────────
  useEffect(() => {
    if (ticketInitRef.current) return;
    if (assignedTasks.length === 0) return;
    ticketInitRef.current = true;

    const delayed = assignedTasks.filter(t => isDelayed(t));
    if (delayed.length === 0) return;

    setTickets(prev => {
      const existingTaskIds = new Set(prev.map(t => t.taskId));
      const newTickets: AssistanceTicket[] = delayed
        .filter(t => !existingTaskIds.has(t.id))
        .map(t => ({
          id:          generateTicketId(),
          taskId:      t.id,
          taskTitle:   t.title,
          taskDueDate: t.dueDate,
          raisedAt:    new Date().toISOString(),
          status:      "open" as const,
          reason:      `This task was due on ${new Date(t.dueDate).toLocaleDateString()} and has not been completed. An assistance ticket has been automatically raised to notify your admin and track the delay.`,
          staffNote:   "",
        }));
      return [...prev, ...newTickets];
    });
  }, [assignedTasks]);

  const handleUpdateTicket = (id: string, updates: Partial<AssistanceTicket>) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    showSuccess("✓ Ticket note saved");
    if (updates.staffNote) {
      speakText("Note saved. When you are ready, submit the ticket to your admin for approval.");
    }
  };

  const handleSubmitTicketToAdmin = (id: string) => {
    const ticket = tickets.find(t => t.id === id);
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: "pending-admin" } : t));
    showSuccess("📤 Ticket submitted to admin for review");

    // Find the assigning admin name from the linked task
    const linkedTask = assignedTasks.find(t => t.id === ticket?.taskId);
    const assignerInfo = linkedTask ? getAssignerInfo((linkedTask as any).assignedBy) : null;
    const adminName = assignerInfo?.name || "your admin";
    const taskTitle = ticket?.taskTitle || "the delayed task";

    speakText(
      `Your assistance ticket for "${taskTitle}" has been submitted to ${adminName} for review. ` +
      `Please wait for ${adminName} to review your explanation and approve the ticket. ` +
      `Once approved, the ticket will be automatically closed.`
    );
  };

  const showAnalytics = activeTab === "pending" || activeTab === "delayed" || activeTab === "tickets";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --c:  #00d4ff;
          --c2: #7b2fff;
          --c3: #ff6b35;
          --cy: #f5c518;
          --cg: #00ff88;
          --cr: #ff3366;
          --cp: #b06af3;
          --bg:  transparent;
          --bg1: transparent;
          --bg2: rgba(6, 10, 21, 0.55);
          --bg3: rgba(24, 27, 44, 0.6);
          --border: rgba(255,255,255,0.055);
          --border2: rgba(255,255,255,0.1);
          --t1: #eef0ff;
          --t2: #7e84a3;
          --t3: #434763;
        }

        body { background: transparent; font-family: 'Inter', sans-serif; }
        html { background: transparent; }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: rgba(15,17,32,0.5); border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: rgba(126,132,163,0.4); border-radius: 10px; transition: background 0.2s; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(126,132,163,0.7); }
        * { scrollbar-color: rgba(126,132,163,0.5) rgba(15,17,32,0.3); scrollbar-width: thin; }

        .sd-root {
          height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', sans-serif;
          color: var(--t1);
          background: transparent;
          position: relative;
          z-index: 1;
          overflow: hidden;
        }

        .sd-sidebar {
          width: 100%;
          height: 60px;
          min-height: 60px;
          background: transparent;
          backdrop-filter: blur(28px);
          border-bottom: 1px solid var(--border2);
          display: flex;
          align-items: center;
          padding: 0 22px;
          gap: 0;
          position: sticky;
          top: 0;
          z-index: 50;
          flex-direction: row;
          overflow: visible;
        }

        .sd-logo { display: flex; align-items: center; gap: 10px; margin-right: 32px; flex-shrink: 0; }
        .sd-logo-img {
          width: 36px; height: 36px;
          object-fit: contain; flex-shrink: 0;
          filter: drop-shadow(0 0 8px rgba(201,169,110,0.5)) drop-shadow(0 2px 6px rgba(201,169,110,0.25));
        }
        .sd-logo-divider {
          width: 1px; height: 26px;
          background: linear-gradient(180deg, transparent, rgba(201,169,110,0.35), transparent);
          flex-shrink: 0;
        }
        .sd-logo-text-wrap { display: flex; flex-direction: column; gap: 2px; }
        .sd-logo-text {
          font-size: 14px; font-weight: 600; color: #c9a96e;
          font-family: 'Cormorant Garamond', 'Georgia', serif;
          white-space: nowrap; letter-spacing: 2.5px; text-transform: uppercase;
          line-height: 1;
        }
        .sd-logo-sub {
          font-size: 7px; font-weight: 600; color: rgba(201,169,110,0.5);
          text-transform: uppercase; letter-spacing: 2px; line-height: 1;
          font-family: 'Inter', sans-serif;
        }

        .sd-nav { display: flex; align-items: center; gap: 2px; }
        .sd-nav-section { display: none; }
        .sd-nav-item {
          display: flex; align-items: center; gap: 7px;
          padding: 7px 15px; border-radius: 8px;
          background: transparent; border: 1px solid transparent;
          cursor: pointer; color: var(--t2);
          font-size: 12px; font-weight: 500; transition: all 0.15s;
          font-family: 'Inter', sans-serif; white-space: nowrap; position: relative;
        }
        .sd-nav-item:hover { color: var(--t1); background: rgba(255,255,255,0.04); }
        .sd-nav-item.active { color: var(--c); background: rgba(0,212,255,0.07); border-color: rgba(0,212,255,0.18); }
        .sd-nav-icon { width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sd-nav-badge {
          min-width: 17px; height: 17px;
          background: linear-gradient(135deg, var(--cr), #ff6b35);
          border-radius: 9px; font-size: 9px; color: white;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; padding: 0 4px;
          box-shadow: 0 0 10px rgba(255,51,102,0.5);
          animation: badgePulse 2.5s ease-in-out infinite;
        }
        .sd-nav-badge-delayed {
          min-width: 17px; height: 17px;
          background: linear-gradient(135deg, #ff3366, #ff6b35);
          border-radius: 9px; font-size: 9px; color: white;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; padding: 0 4px;
          box-shadow: 0 0 10px rgba(255,51,102,0.7);
          animation: badgePulse 1.5s ease-in-out infinite;
        }
        @keyframes badgePulse { 0%,100%{box-shadow:0 0 8px rgba(255,51,102,0.5)} 50%{box-shadow:0 0 16px rgba(255,51,102,0.9)} }

        /* ── SmartCue scanning animations ── */
        @keyframes scanLine {
          0%   { top: 0%; opacity: 1; }
          90%  { top: 100%; opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes scanLineH {
          0%   { left: 0%;   opacity: 1; }
          90%  { left: 100%; opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes scanPulse {
          0%,100% { opacity: 0.3; }
          50%     { opacity: 1; }
        }
        @keyframes cornerBlink {
          0%,100% { opacity: 0.4; }
          50%     { opacity: 1; }
        }
        @keyframes stageReveal {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes spinSc {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .sc-spin { display: inline-block; animation: spinSc 1s linear infinite; }

        /* ── Score modal animations ── */
        @keyframes scoreRingFill {
          from { stroke-dashoffset: 565; }
        }
        @keyframes scoreCountUp {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes catSlideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pipPop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes deductPulse {
          0%,100% { opacity: 0.7; }
          50%     { opacity: 1; }
        }
        .score-cat-row { animation: catSlideIn 0.4s ease both; }
        .score-pip-filled { animation: pipPop 0.35s ease both; }
        .score-deduct { animation: deductPulse 2s ease-in-out infinite; }

        /* ── Deduction voice prompt ── */
        @keyframes deductPromptIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes micPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(0,212,255,0.4); }
          50%     { box-shadow: 0 0 0 10px rgba(0,212,255,0); }
        }
        .deduct-prompt-card {
          animation: deductPromptIn 0.4s cubic-bezier(0.22,1,0.36,1) both;
        }
        .mic-pulse { animation: micPulse 1.4s ease-in-out infinite; }

        .sd-avatar-wrap { margin-left: auto; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .sd-avatar-row { display: flex; align-items: center; gap: 9px; }
        .sd-avatar-ring { position: relative; width: 34px; height: 34px; cursor: pointer; flex-shrink: 0; }
        .sd-avatar {
          width: 100%; height: 100%; border-radius: 50%;
          background: linear-gradient(135deg, var(--c2), var(--c));
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; border: 2px solid rgba(0,212,255,0.4);
          box-shadow: 0 0 12px rgba(0,212,255,0.25);
        }
        .sd-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .sd-avatar-camera {
          position: absolute; inset: 0; border-radius: 50%;
          background: rgba(0,0,0,0.65);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s;
        }
        .sd-avatar-ring:hover .sd-avatar-camera { opacity: 1; }
        .sd-user-info { display: flex; flex-direction: column; }
        .sd-user-name { font-size: 12px; font-weight: 600; color: var(--t1); line-height: 1.2; }
        .sd-user-email { font-size: 10px; color: var(--t3); }
        .sd-role-pill {
          display: inline-flex; align-items: center; gap: 3px;
          padding: 1px 6px; border-radius: 3px;
          background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.22);
          font-size: 8px; font-weight: 800; color: var(--c);
          text-transform: uppercase; letter-spacing: 0.6px;
          margin-top: 2px; width: fit-content;
        }

        .sd-logout {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; background: transparent;
          border: 1px solid var(--border2); border-radius: 8px; color: var(--t3);
          cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif; flex-shrink: 0;
        }
        .sd-logout > span { display: none; }
        .sd-logout:hover { background: rgba(255,51,102,0.1); border-color: rgba(255,51,102,0.3); color: var(--cr); }

        /* ══ MAIN LAYOUT — side-by-side with analytics ══ */
        .sd-main {
          flex: 1;
          padding: 28px 28px 48px;
          background: transparent;
          height: calc(100vh - 60px);
          display: flex;
          gap: 20px;
          align-items: flex-start;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .sd-scoreboard {
          width: 230px;
          min-width: 230px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: sticky;
          top: 0;
          max-height: calc(100vh - 116px);
          overflow-y: auto;
          overflow-x: hidden;
          align-self: flex-start;
        }
        @media (max-width: 1350px) { .sd-scoreboard { display: none; } }

        .sd-content { flex: 1; min-width: 0; }

        /* MCB modal overlay */
        .mcb-overlay {
          position: fixed; inset: 0; z-index: 300;
          background: rgba(0,0,0,0.88);
          backdrop-filter: blur(18px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
          animation: fadeInOverlay 0.22s ease;
        }
        @keyframes fadeInOverlay { from{opacity:0} to{opacity:1} }
        .mcb-modal {
          background: rgba(8,11,26,0.98);
          border: 1px solid rgba(0,212,255,0.2);
          border-radius: 20px; padding: 28px;
          max-width: 540px; width: 100%;
          max-height: 88vh; overflow-y: auto;
          box-shadow: 0 40px 100px rgba(0,0,0,0.9), 0 0 80px rgba(0,212,255,0.07);
          animation: slideUpModal 0.28s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes slideUpModal { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }

        /* Page header */
        .sd-page-header { margin-bottom: 24px; }
        .sd-page-title {
          font-size: 30px; font-weight: 800; letter-spacing: -1px;
          font-family: 'Space Grotesk', sans-serif;
          color: var(--t1); margin-bottom: 4px; line-height: 1.1;
        }
        .sd-page-title em { color: var(--c); font-style: italic; }
        .sd-page-sub { font-size: 10px; color: var(--t3); text-transform: uppercase; letter-spacing: 1.8px; font-weight: 600; }

        .sd-stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
          gap: 14px;
          margin-bottom: 28px;
        }
        .sd-stat-card {
          background: var(--bg2); border-radius: 14px; padding: 20px 22px 18px;
          border: 1px solid var(--border); position: relative; overflow: hidden;
          transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s, background 0.18s;
          cursor: pointer;
        }
        .sd-stat-card::after {
          content: ''; position: absolute; top: -40px; right: -40px;
          width: 100px; height: 100px; border-radius: 50%;
          background: var(--glow, rgba(0,212,255,0.12)); filter: blur(25px); pointer-events: none;
        }
        .sd-stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.5); border-color: rgba(0,212,255,0.3); }
        .sd-stat-card.active { border-color: rgba(0,212,255,0.5); box-shadow: 0 0 30px rgba(0,212,255,0.2); background: rgba(0,212,255,0.04); }
        .sd-stat-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .sd-stat-label { font-size: 9px; font-weight: 700; color: var(--t3); text-transform: uppercase; letter-spacing: 1.2px; }
        .sd-stat-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dot, var(--c)); box-shadow: 0 0 10px var(--dot, var(--c)), 0 0 20px var(--dot, var(--c)); animation: dotGlow 2s ease-in-out infinite; }
        @keyframes dotGlow { 0%,100%{opacity:0.7} 50%{opacity:1} }
        .sd-stat-value { font-size: 44px; font-weight: 900; color: var(--val, var(--c)); line-height: 1; letter-spacing: -2px; font-family: 'Space Grotesk', sans-serif; margin-bottom: 8px; text-shadow: 0 0 30px var(--val, rgba(0,212,255,0.4)); }
        .sd-stat-sub { font-size: 11px; color: var(--t3); font-weight: 500; }
        .sd-stat-bar { margin-top: 14px; height: 2px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; }
        .sd-stat-bar-fill { height: 100%; background: linear-gradient(90deg, var(--val, var(--c)), var(--c2)); border-radius: 2px; box-shadow: 0 0 8px var(--val, var(--c)); transition: width 1s ease; }

        .sd-toast {
          position: fixed; top: 70px; right: 20px; z-index: 999;
          padding: 10px 16px; background: var(--bg2);
          border: 1px solid rgba(0,212,255,0.3); border-radius: 8px; color: var(--c);
          font-size: 12px; font-weight: 600;
          box-shadow: 0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0,212,255,0.1);
          transition: all 0.22s ease; pointer-events: none;
        }
        .sd-toast.visible { opacity: 1; transform: translateY(0); }
        .sd-toast.hidden  { opacity: 0; transform: translateY(-10px); }

        .sd-task-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }

        .sd-task {
          background: var(--bg2); border: 1px solid var(--border); border-radius: 14px;
          padding: 16px 18px; margin-bottom: 12px; transition: border-color 0.18s, box-shadow 0.18s;
          position: relative; overflow: hidden; max-height: 360px; overflow-y: auto;
        }
        .sd-task::before { content: ''; position: absolute; left: 0; top: 18px; bottom: 18px; width: 3px; background: transparent; border-radius: 0 2px 2px 0; transition: all 0.22s; }
        .sd-task:hover { border-color: rgba(0,212,255,0.18); box-shadow: 0 0 0 1px rgba(0,212,255,0.05), 0 8px 32px rgba(0,0,0,0.4); }
        .sd-task:hover::before { background: linear-gradient(180deg, var(--c), var(--c2)); box-shadow: 0 0 14px var(--c); }

        .sd-task-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 12px; min-height: auto; }
        .sd-task-title { font-size: 14px; font-weight: 600; color: var(--t1); margin-bottom: 5px; letter-spacing: -0.1px; word-break: break-word; }
        .sd-task-desc { font-size: 12px; color: var(--t2); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-wrap: break-word; }
        .sd-task-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }

        .badge { padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; text-transform: uppercase; border: 1px solid; letter-spacing: 0.3px; }
        .badge-blue   { background: rgba(0,212,255,0.08);  color: var(--c);  border-color: rgba(0,212,255,0.22); }
        .badge-amber  { background: rgba(245,197,24,0.08); color: var(--cy); border-color: rgba(245,197,24,0.22); }
        .badge-green  { background: rgba(0,255,136,0.08);  color: var(--cg); border-color: rgba(0,255,136,0.22); }
        .badge-red    { background: rgba(255,51,102,0.08); color: var(--cr); border-color: rgba(255,51,102,0.22); }
        .badge-purple { background: rgba(176,106,243,0.08);color: var(--cp); border-color: rgba(176,106,243,0.22); }

        .sd-assigner-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 500; margin-bottom: 8px; border: 1px solid; word-wrap: break-word; }
        .sd-task-footer { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
        .sd-task-dates { font-size: 10px; color: var(--t3); display: flex; gap: 10px; font-variant-numeric: tabular-nums; }
        .sd-status-msg { font-size: 10px; font-weight: 700; }

        .sd-btn-complete {
          display: flex; align-items: center; gap: 6px; padding: 8px 16px;
          background: linear-gradient(135deg, var(--c2), var(--c)); border: none; border-radius: 8px; color: white;
          font-size: 11px; font-weight: 700; text-transform: uppercase; cursor: pointer; transition: all 0.18s;
          letter-spacing: 0.5px; font-family: 'Inter', sans-serif; flex-shrink: 0;
          box-shadow: 0 0 20px rgba(0,212,255,0.22), 0 0 40px rgba(123,47,255,0.15);
        }
        .sd-btn-complete:hover { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 4px 24px rgba(0,212,255,0.4); }

        .sd-note { margin-top: 10px; padding: 11px 13px; border-radius: 8px; font-size: 12px; line-height: 1.4; border-left: 3px solid; word-wrap: break-word; word-break: break-word; max-height: 80px; overflow-y: auto; }
        .sd-note-purple { background: rgba(0,212,255,0.06); border-left-color: var(--c);  color: var(--t2); }
        .sd-note-cyan   { background: rgba(0,255,136,0.06); border-left-color: var(--cg); color: var(--t2); }
        .sd-note-red    { background: rgba(255,51,102,0.06);border-left-color: var(--cr); color: var(--t2); }
        .sd-note-label { font-weight: 700; margin-bottom: 4px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; }

        .sd-photos { margin-top: 10px; }
        .sd-photo-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
        .sd-photo-thumb { width: 64px; height: 64px; border-radius: 9px; overflow: hidden; border: 1px solid var(--border); position: relative; cursor: pointer; transition: all 0.18s; background: var(--bg3); }
        .sd-photo-thumb:hover { border-color: rgba(0,212,255,0.4); transform: scale(1.04); box-shadow: 0 0 14px rgba(0,212,255,0.25); }
        .sd-photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .sd-photo-remove { position: absolute; top: 4px; right: 4px; width: 16px; height: 16px; background: var(--cr); border: none; border-radius: 4px; color: white; font-size: 8px; cursor: pointer; opacity: 0; transition: opacity 0.18s; display: flex; align-items: center; justify-content: center; font-weight: 700; }
        .sd-photo-thumb:hover .sd-photo-remove { opacity: 1; }
        .sd-photo-expand { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.18s; font-size: 16px; }
        .sd-photo-thumb:hover .sd-photo-expand { opacity: 1; }

        .sd-att-strip { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
        .sd-att-thumb { width: 54px; height: 54px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); cursor: pointer; transition: all 0.18s; }
        .sd-att-thumb:hover { border-color: rgba(0,212,255,0.35); transform: scale(1.06); }
        .sd-att-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .sd-att-label { font-size: 10px; color: var(--t3); text-transform: uppercase; margin-bottom: 6px; font-weight: 700; letter-spacing: 0.5px; }

        .sd-drop-zone { border: 1px dashed rgba(0,212,255,0.2); border-radius: 9px; padding: 14px 16px; text-align: center; cursor: pointer; transition: all 0.18s; background: rgba(0,212,255,0.02); }
        .sd-drop-zone:hover { border-color: rgba(0,212,255,0.45); background: rgba(0,212,255,0.06); }
        .sd-drop-icon { font-size: 14px; margin-bottom: 5px; }
        .sd-drop-text { font-size: 11px; color: var(--t3); }
        .sd-drop-text span { color: var(--c); font-weight: 700; }

        .sd-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.87); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(12px); }
        .sd-modal { background: var(--bg2); border: 1px solid rgba(0,212,255,0.15); border-radius: 16px; padding: 24px; max-width: 560px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(0,212,255,0.06); }
        .sd-modal-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; gap: 14px; }
        .sd-modal-title { font-size: 17px; font-weight: 700; color: var(--t1); letter-spacing: -0.3px; font-family: 'Space Grotesk', sans-serif; }
        .sd-modal-close { background: var(--bg3); border: 1px solid var(--border2); border-radius: 7px; width: 28px; height: 28px; color: var(--t3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.18s; flex-shrink: 0; font-size: 11px; }
        .sd-modal-close:hover { background: rgba(255,51,102,0.1); color: var(--cr); border-color: rgba(255,51,102,0.3); }

        .sd-modal-info { padding: 12px 14px; background: var(--bg3); border: 1px solid var(--border); border-radius: 9px; margin-bottom: 16px; font-size: 12px; color: var(--t2); display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .sd-modal-info p { display: flex; align-items: baseline; gap: 4px; }
        .sd-modal-info strong { color: var(--t1); font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }

        .sd-field { margin-bottom: 16px; }
        .sd-field-label { display: block; font-size: 10px; text-transform: uppercase; color: var(--t3); margin-bottom: 7px; font-weight: 700; letter-spacing: 0.8px; }
        .sd-textarea { width: 100%; padding: 11px 13px; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; color: var(--t1); font-size: 13px; font-family: 'Inter', sans-serif; min-height: 110px; resize: vertical; outline: none; transition: all 0.18s; line-height: 1.6; }
        .sd-textarea:focus { border-color: rgba(0,212,255,0.35); background: rgba(0,212,255,0.03); box-shadow: 0 0 0 3px rgba(0,212,255,0.07); }
        .sd-textarea::placeholder { color: var(--t3); }

        .sd-modal-btns { display: flex; gap: 8px; margin-top: 16px; }
        .sd-btn-submit { flex: 1; padding: 11px; background: linear-gradient(135deg, var(--c2), var(--c)); border: none; border-radius: 8px; color: white; font-size: 12px; font-weight: 700; text-transform: uppercase; cursor: pointer; transition: all 0.18s; letter-spacing: 0.5px; font-family: 'Inter', sans-serif; box-shadow: 0 0 20px rgba(0,212,255,0.2); }
        .sd-btn-submit:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 4px 24px rgba(0,212,255,0.35); }
        .sd-btn-submit:disabled { opacity: 0.3; cursor: not-allowed; box-shadow: none; }
        .sd-btn-cancel { padding: 11px 16px; background: transparent; border: 1px solid var(--border2); border-radius: 8px; color: var(--t2); font-size: 12px; text-transform: uppercase; cursor: pointer; transition: all 0.18s; font-weight: 600; letter-spacing: 0.5px; font-family: 'Inter', sans-serif; }
        .sd-btn-cancel:hover { border-color: rgba(255,255,255,0.18); color: var(--t1); }

        .sd-btn-review { display: flex; align-items: center; gap: 5px; padding: 7px 12px; background: rgba(0,212,255,0.07); border: 1px solid rgba(0,212,255,0.2); border-radius: 7px; color: var(--c); font-size: 10px; font-weight: 700; text-transform: uppercase; cursor: pointer; transition: all 0.18s; letter-spacing: 0.4px; font-family: 'Inter', sans-serif; }
        .sd-btn-review:hover:not(:disabled) { background: rgba(0,212,255,0.14); }
        .sd-btn-review:disabled { opacity: 0.5; cursor: not-allowed; }

        .sd-btn-draft { display: flex; align-items: center; gap: 5px; padding: 7px 12px; background: rgba(176,106,243,0.07); border: 1px solid rgba(176,106,243,0.2); border-radius: 7px; color: var(--cp); font-size: 10px; font-weight: 700; text-transform: uppercase; cursor: pointer; transition: all 0.18s; letter-spacing: 0.4px; font-family: 'Inter', sans-serif; }
        .sd-btn-draft:hover:not(:disabled) { background: rgba(176,106,243,0.14); }
        .sd-btn-draft:disabled { opacity: 0.5; cursor: not-allowed; }

        .sd-review-progress { background: rgba(0,212,255,0.06); border: 1px solid rgba(0,212,255,0.18); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
        .sd-progress-title { font-size: 10px; font-weight: 700; color: var(--c); margin-bottom: 7px; letter-spacing: 0.4px; }
        .sd-progress-bar { width: 100%; height: 2px; background: rgba(0,212,255,0.1); border-radius: 2px; overflow: hidden; }
        .sd-progress-fill { height: 100%; background: linear-gradient(90deg, var(--c2), var(--c)); animation: sdProgress 2s ease-in-out infinite; box-shadow: 0 0 8px var(--c); }
        @keyframes sdProgress { 0%,100%{width:0%} 50%{width:100%} }

        .sd-error-panel-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 10px 12px; background: rgba(255,51,102,0.08); border: 1px solid rgba(255,51,102,0.2); border-radius: 8px; margin-top: 8px; transition: all 0.18s; }
        .sd-error-panel-header:hover { background: rgba(255,51,102,0.14); }
        .sd-error-panel-header.expanded { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
        .sd-error-count { color: var(--cr); font-weight: 700; font-size: 11px; }
        .sd-error-toggle { color: var(--cr); transition: transform 0.2s; font-size: 10px; }
        .sd-error-toggle.expanded { transform: rotate(180deg); }
        .sd-error-content { background: rgba(255,51,102,0.04); border: 1px solid rgba(255,51,102,0.2); border-top: none; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; padding: 12px; }
        .sd-error-item { padding: 5px 0; font-size: 11px; color: var(--t2); display: flex; gap: 8px; }
        .sd-error-item:before { content: "✕"; color: var(--cr); font-weight: 700; flex-shrink: 0; }

        .sd-success-panel { background: rgba(0,255,136,0.07); border: 1px solid rgba(0,255,136,0.2); border-radius: 8px; padding: 10px 12px; margin-top: 8px; color: var(--cg); font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 7px; }
        .sd-warning-panel { background: rgba(0,212,255,0.06); border: 1px solid rgba(0,212,255,0.18); border-radius: 7px; padding: 10px 12px; margin-top: 8px; display: flex; gap: 8px; font-size: 11px; color: var(--t2); }

        .sd-status-indicator { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
        .sd-status-processing { background: rgba(245,197,24,0.1); color: var(--cy); border: 1px solid rgba(245,197,24,0.25); }
        .sd-status-complete   { background: rgba(0,255,136,0.1); color: var(--cg); border: 1px solid rgba(0,255,136,0.25); }

        .sd-spinner { animation: sdSpin 0.9s linear infinite; display: inline-block; }
        @keyframes sdSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

        .sd-empty { text-align: center; padding: 64px 24px; background: var(--bg2); border: 1px dashed rgba(0,212,255,0.1); border-radius: 16px; }
        .sd-empty-icon { font-size: 36px; margin-bottom: 14px; opacity: 0.2; }
        .sd-empty-title { font-size: 15px; font-weight: 700; color: var(--t2); margin-bottom: 5px; font-family: 'Space Grotesk', sans-serif; }
        .sd-empty-sub { font-size: 12px; color: var(--t3); }

        .sd-lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(14px); }
        .sd-lightbox-img { max-width: 90vw; max-height: 85vh; border-radius: 10px; object-fit: contain; box-shadow: 0 30px 80px rgba(0,0,0,0.8), 0 0 60px rgba(0,212,255,0.08); }
        .sd-lightbox-close { position: absolute; top: 20px; right: 20px; width: 34px; height: 34px; background: var(--bg2); border: 1px solid var(--border2); border-radius: 7px; color: var(--t3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.18s; font-size: 13px; z-index: 10; }
        .sd-lightbox-close:hover { border-color: rgba(0,212,255,0.35); color: var(--c); }

        @media (max-width: 1100px) {
          .sd-analytics-panel { display: none; }
        }
        @media (max-width: 900px) {
          .sd-sidebar { overflow-x: auto; padding: 0 12px; }
          .sd-main { padding: 16px; }
          .sd-page-title { font-size: 22px; }
          .sd-stat-grid { grid-template-columns: repeat(2, 1fr); }
          .sd-task-grid { grid-template-columns: 1fr; }
          .sd-user-info { display: none; }
        }
      `}</style>

      {/* ── VIDEO BACKGROUND ── */}
      <video
        style={{
          position: "fixed", top: 0, left: 0,
          width: "100%", height: "100%",
          objectFit: "cover", zIndex: -1, opacity: 1,
        }}
        autoPlay muted loop playsInline preload="auto"
      >
        <source src="/videos/0_Circles_Gold_1280x720.mp4" type="video/mp4" />
      </video>

      {/* Flash Panel */}
      {showFlashPanel && (
        <FlashPanel
          tasks={assignedTasks}
          tickets={tickets}
          onClose={() => setShowFlashPanel(false)}
          onSelectDelayedTask={handleFlashDelayedTask}
          userName={user?.name || "there"}
        />
      )}

      <div className="sd-root">
        {/* ── TOP NAVBAR ── */}
        <aside className="sd-sidebar">
          <div className="sd-logo">
            <img
              src={roswaltLogo}
              alt="Roswalt Realty"
              className="sd-logo-img"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div className="sd-logo-divider" />
            <div className="sd-logo-text-wrap">
              <div className="sd-logo-text">SmartCue</div>
              <div className="sd-logo-sub">Roswalt Realty</div>
            </div>
          </div>

          <nav className="sd-nav">
            <button
              className={`sd-nav-item ${activeTab === "pending" ? "active" : ""}`}
              onClick={() => { setActiveTab("pending"); setActiveFilter(null); }}
            >
              <span className="sd-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </span>
              My Tasks
              {pendingTasks.length > 0 && <span className="sd-nav-badge">{pendingTasks.length}</span>}
            </button>
            <button
              className={`sd-nav-item ${activeTab === "history" ? "active" : ""}`}
              onClick={() => { setActiveTab("history"); setActiveFilter(null); }}
            >
              <span className="sd-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              </span>
              History
              {submittedTasks.length > 0 && <span className="sd-nav-badge">{submittedTasks.length}</span>}
            </button>
            <button
              className={`sd-nav-item ${activeTab === "delayed" ? "active" : ""}`}
              onClick={() => { setActiveTab("delayed"); setActiveFilter(null); }}
            >
              <span className="sd-nav-icon">
                <AlertTriangle size={14} />
              </span>
              Delayed Tasks
              {delayedTasks.length > 0 && <span className="sd-nav-badge-delayed">{delayedTasks.length}</span>}
            </button>
            <button
              className={`sd-nav-item ${activeTab === "tickets" ? "active" : ""}`}
              onClick={() => { setActiveTab("tickets"); setActiveFilter(null); }}
              style={tickets.filter(t => t.status === "open").length > 0 ? { color: "#ff9500" } : {}}
            >
              <span className="sd-nav-icon" style={{ fontSize: 12 }}>🎫</span>
              Assistance
              {tickets.filter(t => t.status !== "resolved").length > 0 && (
                <span style={{
                  minWidth: 17, height: 17,
                  background: "linear-gradient(135deg, #ff9500, #ff6b35)",
                  borderRadius: 9, fontSize: 9, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, padding: "0 4px",
                  boxShadow: "0 0 10px rgba(255,149,0,0.6)",
                  animation: "badgePulse 2s ease-in-out infinite",
                }}>{tickets.filter(t => t.status !== "resolved").length}</span>
              )}
            </button>
            <button
              className={`sd-nav-item ${activeTab === "ai" ? "active" : ""}`}
              onClick={() => setActiveTab("ai")}
            >
              <span className="sd-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              </span>
              Claude AI
            </button>
          </nav>

          {/* Right: user info + logout */}
          <div className="sd-avatar-wrap">
            <div className="sd-avatar-row">
              <div
                className="sd-avatar-ring"
                onClick={() => profileInputRef.current?.click()}
                title="Update profile photo"
              >
                <div className="sd-avatar">
                  {profilePic
                    ? <img src={profilePic} alt="profile" />
                    : user?.name
                    ? <span style={{ fontSize: "13px", color: "#fff", fontWeight: 800 }}>{user.name.charAt(0).toUpperCase()}</span>
                    : <User size={14} color="#fff" />}
                </div>
                <div className="sd-avatar-camera"><Camera size={10} color="#fff" /></div>
              </div>
              <div className="sd-user-info">
                <div className="sd-user-name">{user?.name || "Staff Member"}</div>
                <div className="sd-user-email">{user?.email || ""}</div>
                <div className="sd-role-pill">
                  <Shield size={7} /> Staff
                </div>
              </div>
            </div>
            <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleProfilePicChange} />
            <button className="sd-logout" onClick={handleLogout} title="Sign Out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </aside>

        <main className="sd-main">
          <div className={`sd-toast ${successMsg ? "visible" : "hidden"}`}>{successMsg}</div>

          {/* ── LEFT SCOREBOARD ── */}
          <ScoreboardPanel
            user={user}
            profilePic={profilePic}
            tasks={assignedTasks}
          />

          {/* ── MAIN CONTENT ── */}
          <div className="sd-content">
            {/* ── PAGE HEADER ── */}
            <div className="sd-page-header">
              <div className="sd-page-title">
                {activeTab === "pending"  ? <>Task <em>Analytics</em></>
                 : activeTab === "history" ? <>Work <em>History</em></>
                 : activeTab === "delayed" ? <><em>Delayed</em> Tasks</>
                 : activeTab === "tickets" ? <><em>Assistance</em> Tickets</>
                 : <><em>Claude</em> AI</>}
              </div>
              <div className="sd-page-sub">
                {activeTab === "pending"
                  ? "Click any stat card to filter tasks by status"
                  : activeTab === "history"
                  ? `${submittedTasks.length} task${submittedTasks.length !== 1 ? "s" : ""} in your history`
                  : activeTab === "delayed"
                  ? `${delayedTasks.length} task${delayedTasks.length !== 1 ? "s" : ""} require attention`
                  : activeTab === "tickets"
                  ? `${tickets.length} ticket${tickets.length !== 1 ? "s" : ""} auto-raised · ${tickets.filter(t => t.status === "pending-admin").length} awaiting admin`
                  : "Your AI assistant powered by Claude"}
              </div>
            </div>

            {/* ── NEON STAT CARDS (pending tab only) ── */}
            {activeTab === "pending" && (
              <div className="sd-stat-grid">
                <div className={`sd-stat-card ${activeFilter === "all" ? "active" : ""}`} onClick={() => setActiveFilter(activeFilter === "all" ? null : "all")} style={{ "--glow": "rgba(0,212,255,0.14)" } as any}>
                  <div className="sd-stat-card-top">
                    <div className="sd-stat-label">■ All Tasks</div>
                    <div className="sd-stat-dot" style={{ "--dot": "var(--c)" } as any} />
                  </div>
                  <div className="sd-stat-value" style={{ "--val": "var(--c)" } as any}>{assignedTasks.length}</div>
                  <div className="sd-stat-sub">Total assigned</div>
                  <div className="sd-stat-bar"><div className="sd-stat-bar-fill" style={{ width: "100%", "--val": "var(--c)" } as any} /></div>
                </div>
                <div className={`sd-stat-card ${activeFilter === "active" ? "active" : ""}`} onClick={() => setActiveFilter(activeFilter === "active" ? null : "active")} style={{ "--glow": "rgba(245,197,24,0.12)" } as any}>
                  <div className="sd-stat-card-top">
                    <div className="sd-stat-label">⚡ Active</div>
                    <div className="sd-stat-dot" style={{ "--dot": "var(--cy)" } as any} />
                  </div>
                  <div className="sd-stat-value" style={{ "--val": "var(--cy)" } as any}>{pendingTasks.length}</div>
                  <div className="sd-stat-sub">In progress</div>
                  <div className="sd-stat-bar"><div className="sd-stat-bar-fill" style={{ width: `${assignedTasks.length > 0 ? (pendingTasks.length / assignedTasks.length) * 100 : 0}%`, "--val": "var(--cy)" } as any} /></div>
                </div>
                <div className={`sd-stat-card ${activeFilter === "inreview" ? "active" : ""}`} onClick={() => setActiveFilter(activeFilter === "inreview" ? null : "inreview")} style={{ "--glow": "rgba(176,106,243,0.12)" } as any}>
                  <div className="sd-stat-card-top">
                    <div className="sd-stat-label">⏳ Pending</div>
                    <div className="sd-stat-dot" style={{ "--dot": "var(--cp)" } as any} />
                  </div>
                  <div className="sd-stat-value" style={{ "--val": "var(--cp)" } as any}>{inReviewTasks.length}</div>
                  <div className="sd-stat-sub">Awaiting approval</div>
                  <div className="sd-stat-bar"><div className="sd-stat-bar-fill" style={{ width: `${assignedTasks.length > 0 ? (inReviewTasks.length / assignedTasks.length) * 100 : 0}%`, "--val": "var(--cp)" } as any} /></div>
                </div>
                <div className={`sd-stat-card ${activeFilter === "approved" ? "active" : ""}`} onClick={() => setActiveFilter(activeFilter === "approved" ? null : "approved")} style={{ "--glow": "rgba(0,255,136,0.1)" } as any}>
                  <div className="sd-stat-card-top">
                    <div className="sd-stat-label">✓ Completed</div>
                    <div className="sd-stat-dot" style={{ "--dot": "var(--cg)" } as any} />
                  </div>
                  <div className="sd-stat-value" style={{ "--val": "var(--cg)" } as any}>{completedTasks.length}</div>
                  <div className="sd-stat-sub">Approved</div>
                  <div className="sd-stat-bar"><div className="sd-stat-bar-fill" style={{ width: `${assignedTasks.length > 0 ? (completedTasks.length / assignedTasks.length) * 100 : 0}%`, "--val": "var(--cg)" } as any} /></div>
                </div>
              </div>
            )}

            {/* ── TASK GRID ── */}
            {activeTab === "pending" && (
              displayedTasks.length === 0 ? (
                <div className="sd-empty">
                  <div className="sd-empty-icon">◈</div>
                  <div className="sd-empty-title">{activeFilter ? "No tasks found" : "All caught up!"}</div>
                  <div className="sd-empty-sub">{activeFilter ? "Try a different filter" : "No tasks assigned to you right now."}</div>
                </div>
              ) : (
                <div className="sd-task-grid">
                  {displayedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      photos={uploadedPhotos[task.id] || []}
                      getProjectName={getProjectName}
                      getAssignerInfo={getAssignerInfo}
                      onComplete={() => { setSelectedTask(task); setShowCompletionForm(true); }}
                      onUpload={(files) => handlePhotoUpload(task.id, files)}
                      onRemovePhoto={(i) => removePhoto(task.id, i)}
                      onOpenLightbox={(photos, idx) => openLightbox(photos, idx)}
                      dragOver={dragOver}
                      setDragOver={setDragOver}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === "history" && (
              submittedTasks.length === 0 ? (
                <div className="sd-empty">
                  <div className="sd-empty-icon">○</div>
                  <div className="sd-empty-title">Nothing submitted yet</div>
                  <div className="sd-empty-sub">Submit your first task to see it here.</div>
                </div>
              ) : (
                <div className="sd-task-grid">
                  {submittedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      photos={uploadedPhotos[task.id] || []}
                      getProjectName={getProjectName}
                      getAssignerInfo={getAssignerInfo}
                      onComplete={() => {}}
                      onUpload={(files) => handlePhotoUpload(task.id, files)}
                      onRemovePhoto={(i) => removePhoto(task.id, i)}
                      onOpenLightbox={(photos, idx) => openLightbox(photos, idx)}
                      dragOver={dragOver}
                      setDragOver={setDragOver}
                      isCompleted
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === "delayed" && (
              <DelayedTab
                tasks={assignedTasks}
                rescheduledTasks={rescheduledTasks}
                onReschedule={handleReschedule}
                onComplete={handleDelayedComplete}
                getProjectName={getProjectName}
              />
            )}

            {activeTab === "tickets" && (
              <AssistanceTicketsTab
                tickets={tickets}
                onUpdateTicket={handleUpdateTicket}
                onSubmitToAdmin={handleSubmitTicketToAdmin}
              />
            )}

            {activeTab === "ai" && (
              <div style={{ height: "calc(100vh - 200px)" }}>
                <ClaudeChat theme="dark" />
              </div>
            )}
          </div>

          {/* ── RIGHT ANALYTICS PANEL ── */}
          {showAnalytics && (
            <div className="sd-analytics-panel" style={{ position: "sticky", top: "28px" }}>
              <AnalyticsPanel tasks={assignedTasks} tickets={tickets} />
            </div>
          )}
        </main>
      </div>

      {/* Lightbox */}
      {showLightbox && lightboxPhotos.length > 0 && (
        <div className="sd-lightbox" onClick={() => setShowLightbox(false)}>
          <button className="sd-lightbox-close" onClick={() => setShowLightbox(false)}>✕</button>
          <img
            src={lightboxPhotos[lightboxIndex]}
            alt={`attachment-${lightboxIndex + 1}`}
            className="sd-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* AI Score Modal — shown before final submit */}
      {aiScoreResult && pendingSubmitTask && (
        <div className="mcb-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setAiScoreResult(null); setPendingSubmitTask(null); setDeductionPrompt(null); setReadingDeductions(false); } }}>
          <div className="mcb-modal">

            {/* ── TOP HEADER ── */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)", fontSize: 9, fontWeight: 800, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "1px" }}>
                    ◈ SmartCue AI — Quality Score
                  </div>
                  {fileTypeBadge && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6,
                      background: fileTypeBadge.type === "VIDEO" ? "rgba(245,197,24,0.1)" : "rgba(176,106,243,0.1)",
                      border: `1px solid ${fileTypeBadge.type === "VIDEO" ? "rgba(245,197,24,0.3)" : "rgba(176,106,243,0.3)"}`,
                      fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.7px",
                      color: fileTypeBadge.type === "VIDEO" ? "#f5c518" : "#b06af3",
                    }}>
                      {fileTypeBadge.type === "VIDEO" ? "▶" : "◼"} {fileTypeBadge.type} · {fileTypeBadge.fmt}
                      {fileTypeBadge.type === "VIDEO" && <span style={{ opacity: 0.6, marginLeft: 3 }}>· 6 frames</span>}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#eef0ff", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.3px" }}>Submission Review</div>
                <div style={{ fontSize: 10, color: "#7e84a3", marginTop: 3 }}>Review your AI score before confirming submission.</div>
              </div>
              <button onClick={() => { setAiScoreResult(null); setPendingSubmitTask(null); setDeductionPrompt(null); setReadingDeductions(false); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, width: 28, height: 28, color: "#7e84a3", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>✕</button>
            </div>

            {/* ── DEDUCTION VOICE PROMPT CARD ── */}
            {(deductionPrompt || readingDeductions) && (
              <div className="deduct-prompt-card" style={{
                marginBottom: 18, padding: "14px 16px",
                background: "linear-gradient(135deg, rgba(0,212,255,0.06), rgba(123,47,255,0.06))",
                border: "1px solid rgba(0,212,255,0.3)",
                borderRadius: 12,
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                {/* Mic icon */}
                <div className={readingDeductions ? "mic-pulse" : ""} style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  background: readingDeductions ? "rgba(0,212,255,0.15)" : "rgba(0,212,255,0.1)",
                  border: "1.5px solid rgba(0,212,255,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16,
                }}>
                  {readingDeductions ? "🔊" : "🎙️"}
                </div>

                <div style={{ flex: 1 }}>
                  {readingDeductions ? (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#00d4ff", marginBottom: 3 }}>
                        Reading deduction reasons…
                      </div>
                      <div style={{ fontSize: 10, color: "#7e84a3", lineHeight: 1.5 }}>
                        SmartCue is reading out why each parameter was marked below target. Please listen carefully.
                      </div>
                      <button
                        onClick={handleDismissDeductions}
                        style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#7e84a3", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Stop Reading
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#eef0ff", marginBottom: 4 }}>
                        {deductionPrompt!.items.length} parameter{deductionPrompt!.items.length !== 1 ? "s have" : " has"} received negative marks.
                      </div>
                      <div style={{ fontSize: 10, color: "#7e84a3", marginBottom: 10, lineHeight: 1.5 }}>
                        Would you like me to read the reasons for the deductions?
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={handleReadDeductions}
                          style={{
                            padding: "6px 16px", borderRadius: 7,
                            background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(123,47,255,0.2))",
                            border: "1px solid rgba(0,212,255,0.4)",
                            color: "#00d4ff", fontSize: 10, fontWeight: 800,
                            cursor: "pointer", fontFamily: "inherit",
                            textTransform: "uppercase", letterSpacing: "0.5px",
                            display: "flex", alignItems: "center", gap: 5,
                          }}
                        >
                          🔊 Yes, Read Them
                        </button>
                        <button
                          onClick={handleDismissDeductions}
                          style={{
                            padding: "6px 14px", borderRadius: 7,
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#7e84a3", fontSize: 10, fontWeight: 600,
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          No Thanks
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── SCORE RING + CATEGORY PENTAGON ── */}
            <div style={{ display: "flex", gap: 14, marginBottom: 20, alignItems: "center" }}>
              {/* SVG Arc Ring */}
              <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
                <svg width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
                  {/* Background circle */}
                  <circle cx="65" cy="65" r="56" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                  {/* Score arc */}
                  <circle cx="65" cy="65" r="56" fill="none"
                    stroke={GRADE_COLOR[aiScoreResult.grade]}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="351.9"
                    strokeDashoffset={351.9 - (351.9 * aiScoreResult.percentScore / 100)}
                    style={{
                      filter: `drop-shadow(0 0 8px ${GRADE_COLOR[aiScoreResult.grade]}88)`,
                      transition: "stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)",
                    }}
                  />
                  {/* Thin target ring at 100% */}
                  <circle cx="65" cy="65" r="56" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="2 4" />
                </svg>
                {/* Center text */}
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "scoreCountUp 0.6s ease 0.3s both" }}>
                  <span style={{ fontSize: 30, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", color: GRADE_COLOR[aiScoreResult.grade], lineHeight: 1, textShadow: `0 0 20px ${GRADE_COLOR[aiScoreResult.grade]}66` }}>
                    {aiScoreResult.percentScore}
                  </span>
                  <span style={{ fontSize: 9, color: "#7e84a3", fontWeight: 600, letterSpacing: "0.5px" }}>/100</span>
                  <span style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif", color: GRADE_COLOR[aiScoreResult.grade], letterSpacing: 3, marginTop: 1 }}>
                    {aiScoreResult.grade}
                  </span>
                </div>
              </div>

              {/* Right side — verdict + grammar + category mini-bars */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 10, color: GRADE_COLOR[aiScoreResult.grade], fontWeight: 600, lineHeight: 1.5, marginBottom: 4, opacity: 0.9 }}>
                  {aiScoreResult.verdict}
                </div>
                {/* Grammar pill */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, width: "fit-content",
                  background: aiScoreResult.grammarClean ? "rgba(0,255,136,0.08)" : "rgba(255,51,102,0.08)",
                  border: `1px solid ${aiScoreResult.grammarClean ? "rgba(0,255,136,0.25)" : "rgba(255,51,102,0.25)"}`,
                }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: aiScoreResult.grammarClean ? "#00ff88" : "#ff3366", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    {aiScoreResult.grammarClean ? "✓ Grammar Clean" : `✗ ${aiScoreResult.grammarErrors.length} Grammar Issue${aiScoreResult.grammarErrors.length !== 1 ? "s" : ""}`}
                  </span>
                </div>
                {/* Mini category score strips */}
                {aiScoreResult.categories.map((cat, ci) => (
                  <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 6, animation: `catSlideIn 0.3s ease ${ci * 0.06}s both` }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: cat.color, width: 16, flexShrink: 0 }}>{cat.id}</span>
                    <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(cat.score / cat.max) * 100}%`, background: `linear-gradient(90deg, ${cat.color}88, ${cat.color})`, borderRadius: 3, boxShadow: `0 0 6px ${cat.color}66`, transition: "width 1s ease" }} />
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 800, color: cat.color, width: 30, textAlign: "right", flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif" }}>{cat.score}/{cat.max}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CATEGORY DETAIL CARDS ── */}
            <div style={{ fontSize: 9, fontWeight: 800, color: "#7e84a3", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Score by Category</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {aiScoreResult.categories.map((cat, ci) => {
                const deductions = cat.subcriteria.filter(s => s.score < s.max);
                const perfect    = cat.score === cat.max;
                return (
                  <div key={cat.id} className="score-cat-row" style={{
                    borderRadius: 10, overflow: "hidden",
                    border: `1px solid ${perfect ? cat.color + "30" : cat.color + "20"}`,
                    background: `${cat.color}06`,
                    animationDelay: `${ci * 0.08}s`,
                  }}>
                    {/* Category header bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: `1px solid ${cat.color}12` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: cat.color }}>
                          {cat.id}) {cat.name}
                        </span>
                        {perfect && (
                          <span style={{ fontSize: 8, fontWeight: 800, color: cat.color, background: `${cat.color}18`, border: `1px solid ${cat.color}33`, padding: "1px 5px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Perfect</span>
                        )}
                      </div>
                      {/* Score fraction with visual fill */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(cat.score / cat.max) * 100}%`, background: `linear-gradient(90deg, ${cat.color}99, ${cat.color})`, borderRadius: 2, transition: "width 1.2s ease", boxShadow: `0 0 6px ${cat.color}66` }} />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 900, color: cat.color, fontFamily: "'Space Grotesk', sans-serif", minWidth: 36, textAlign: "right" }}>
                          {cat.score}<span style={{ fontSize: 9, opacity: 0.5 }}>/{cat.max}</span>
                        </span>
                      </div>
                    </div>

                    {/* Subcriteria rows with pip indicators */}
                    <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
                      {cat.subcriteria.map((sub, si) => {
                        const lost    = sub.max - sub.score;
                        const isLow   = sub.score < sub.max;
                        const subColor = sub.score === sub.max ? cat.color : sub.score >= sub.max * 0.75 ? "#f5c518" : sub.score >= sub.max * 0.5 ? "#ff9500" : "#ff3366";
                        return (
                          <div key={si} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {/* Pip dots — one per max point */}
                              <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                                {Array.from({ length: sub.max }).map((_, pi) => (
                                  <div key={pi} className={pi < sub.score ? "score-pip-filled" : ""}
                                    style={{
                                      width: 8, height: 8, borderRadius: "50%",
                                      background: pi < sub.score ? subColor : "rgba(255,255,255,0.07)",
                                      boxShadow: pi < sub.score ? `0 0 5px ${subColor}88` : "none",
                                      border: pi < sub.score ? "none" : "1px solid rgba(255,255,255,0.1)",
                                      transition: `background 0.3s ease ${pi * 0.06}s`,
                                      animationDelay: `${(ci * 0.08) + (si * 0.04) + (pi * 0.06)}s`,
                                    }}
                                  />
                                ))}
                              </div>
                              {/* Label */}
                              <span style={{ flex: 1, fontSize: 10, color: isLow ? "#c8ccdd" : "#8b909e", fontWeight: isLow ? 600 : 400 }}>{sub.label}</span>
                              {/* Score badge */}
                              <span style={{ fontSize: 10, fontWeight: 800, color: subColor, fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>
                                {sub.score}/{sub.max}
                              </span>
                              {/* Deduction badge */}
                              {lost > 0 && (
                                <span className="score-deduct" style={{
                                  fontSize: 8, fontWeight: 900, color: "#ff3366",
                                  background: "rgba(255,51,102,0.12)", border: "1px solid rgba(255,51,102,0.25)",
                                  padding: "1px 5px", borderRadius: 4, flexShrink: 0,
                                }}>−{lost}</span>
                              )}
                            </div>
                            {/* Reason — only shown when below max */}
                            {isLow && sub.note && (
                              <div style={{
                                display: "flex", gap: 5, padding: "4px 8px", borderRadius: 5, marginLeft: 23,
                                background: "rgba(255,51,102,0.05)", border: "1px solid rgba(255,51,102,0.12)",
                              }}>
                                <span style={{ color: "#ff6b35", fontSize: 9, flexShrink: 0, marginTop: 1 }}>↳</span>
                                <span style={{ fontSize: 9, color: "#a0a5be", lineHeight: 1.5 }}>{sub.note}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── GRAMMAR ERRORS ── */}
            {aiScoreResult.grammarErrors.length > 0 && (
              <div style={{ marginBottom: 14, padding: "10px 12px", background: "rgba(255,51,102,0.05)", border: "1px solid rgba(255,51,102,0.16)", borderRadius: 9 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#ff3366", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 7 }}>Grammar Issues Found</div>
                {aiScoreResult.grammarErrors.map((err, i) => (
                  <div key={i} style={{ fontSize: 10, color: "#c8ccdd", paddingLeft: 8, marginBottom: 3, display: "flex", gap: 6 }}>
                    <span style={{ color: "#ff3366", flexShrink: 0 }}>✗</span>{err}
                  </div>
                ))}
              </div>
            )}

            {/* ── STRENGTHS + IMPROVEMENTS ── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexDirection: "column" }}>
              {aiScoreResult.strengths.length > 0 && (
                <div style={{ padding: "10px 12px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.14)", borderRadius: 9 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#00ff88", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>✓ Strengths</div>
                  {aiScoreResult.strengths.map((s, i) => (
                    <div key={i} style={{ fontSize: 10, color: "#c8ccdd", marginBottom: 3, display: "flex", gap: 6 }}>
                      <span style={{ color: "#00ff88", flexShrink: 0 }}>✓</span>{s}
                    </div>
                  ))}
                </div>
              )}
              {aiScoreResult.improvements.length > 0 && (
                <div style={{ padding: "10px 12px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.14)", borderRadius: 9 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>→ Improvements</div>
                  {aiScoreResult.improvements.map((s, i) => (
                    <div key={i} style={{ fontSize: 10, color: "#c8ccdd", marginBottom: 3, display: "flex", gap: 6 }}>
                      <span style={{ color: "#00d4ff", flexShrink: 0 }}>→</span>{s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── ACTION BUTTONS ── */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setAiScoreResult(null); setPendingSubmitTask(null); }}
                style={{ flex: 1, padding: "12px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#7e84a3", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.5px", transition: "all 0.18s" }}
              >
                ← Revise
              </button>
              <button
                onClick={handleConfirmSubmit}
                style={{ flex: 2, padding: "12px",
                  background: aiScoreResult.percentScore >= 55
                    ? `linear-gradient(135deg, #7b2fff, ${GRADE_COLOR[aiScoreResult.grade]})`
                    : "rgba(255,51,102,0.15)",
                  border: `1px solid ${aiScoreResult.percentScore >= 55 ? GRADE_COLOR[aiScoreResult.grade] + "66" : "rgba(255,51,102,0.4)"}`,
                  borderRadius: 10,
                  color: aiScoreResult.percentScore >= 55 ? "white" : "#ff3366",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.5px", transition: "all 0.18s",
                  boxShadow: aiScoreResult.percentScore >= 55 ? `0 0 24px ${GRADE_COLOR[aiScoreResult.grade]}33` : "none",
                }}
              >
                {aiScoreResult.percentScore >= 55 ? `✓ Submit for Approval  ${aiScoreResult.percentScore}/100` : "⚠ Submit Anyway (Score Low)"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Completion Modal — all original logic preserved */}
      {showCompletionForm && selectedTask && (
        <div
          className="sd-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCompletionForm(false);
              setSelectedTask(null);
              setCompletionNotes("");
              setEvalStage(0);
              setFileTypeBadge(null);
            }
          }}
        >
          <div className="sd-modal">
            <div className="sd-modal-header">
              <div>
                {selectedTask.assignedBy && (() => {
                  const assigner = getAssignerInfo(selectedTask.assignedBy);
                  const role     = assigner?.role ?? "admin";
                  const rc       = ROLE_COLOR[role] ?? ROLE_COLOR.admin;
                  return (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 9px", borderRadius: 5, background: rc.bg, border: `1px solid ${rc.border}`, marginBottom: 10, fontFamily: "inherit", fontSize: 11, color: rc.text, fontWeight: 600 }}>
                      <Shield size={10} />
                      Assigned by <strong style={{ marginLeft: 3 }}>{assigner?.name ?? selectedTask.assignedBy}</strong>
                      <span style={{ opacity: 0.6 }}>· {ROLE_LABEL[role] ?? role}</span>
                    </div>
                  );
                })()}
                <div className="sd-modal-title">Submit: {selectedTask.title}</div>
              </div>
              <button
                className="sd-modal-close"
                onClick={() => { setShowCompletionForm(false); setSelectedTask(null); setCompletionNotes(""); setEvalStage(0); setFileTypeBadge(null); }}
              >✕</button>
            </div>

            <div className="sd-modal-info">
              <p><strong>Priority:</strong> {selectedTask.priority?.toUpperCase()}</p>
              <p><strong>Due:</strong> {new Date(selectedTask.dueDate).toLocaleDateString()}</p>
              <p style={{ gridColumn: "1 / -1" }}><strong>Description:</strong> {selectedTask.description}</p>
            </div>

            {/* Completion Notes */}
            <div className="sd-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
                <label className="sd-field-label" style={{ marginBottom: 0 }}>Completion Notes *</label>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {draftedNotes[selectedTask.id] && (
                    <span className="sd-status-indicator sd-status-complete">✓ Drafted</span>
                  )}
                  {draftingTask === selectedTask.id && (
                    <span className="sd-status-indicator sd-status-processing">
                      <span className="sd-spinner">⟳</span> Processing…
                    </span>
                  )}
                  <button
                    className="sd-btn-draft"
                    onClick={() => draftCompletionNotes(selectedTask.id)}
                    disabled={draftingTask === selectedTask.id || !completionNotes.trim()}
                  >
                    {draftingTask === selectedTask.id
                      ? <><Loader size={10} className="sd-spinner" /> Drafting…</>
                      : <>✨ Improve with AI</>}
                  </button>
                </div>
              </div>
              <textarea
                className="sd-textarea"
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Describe what you completed, any challenges, and current status…"
              />
            </div>

            {/* Attachments */}
            <div className="sd-field">
              <label className="sd-field-label">Attach Photos (optional)</label>
              {(uploadedPhotos[selectedTask.id] || []).length > 0 && (
                <>
                  {/* ── File Type Badge — white rectangle, shows instantly on upload ── */}
                  {fileTypeBadge && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        background: "#ffffff", borderRadius: 7, padding: "5px 14px",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 900, color: "#060a15", textTransform: "uppercase", letterSpacing: "1px" }}>
                          File Type:
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 900, color: "#060a15", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {fileTypeBadge.type}
                        </span>
                      </div>
                      <div style={{
                        padding: "5px 12px", borderRadius: 7,
                        background: "rgba(176,106,243,0.15)", border: "1px solid rgba(176,106,243,0.4)",
                        fontSize: 9, fontWeight: 800, color: "#b06af3", textTransform: "uppercase", letterSpacing: "0.7px",
                      }}>
                        {fileTypeBadge.fmt}
                      </div>
                    </div>
                  )}

                  <div className="sd-photo-grid" style={{ marginBottom: "8px" }}>
                    {(uploadedPhotos[selectedTask.id] || []).map((url, i) => {
                      const isVid = url.startsWith("data:video/");
                      return (
                        <div className="sd-photo-thumb" key={i} onClick={() => openLightbox(uploadedPhotos[selectedTask.id], i)}>
                          {isVid
                            ? <video src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                            : <img src={url} alt={`upload-${i}`} />}
                          <div className="sd-photo-expand">{isVid ? "▶" : "🔍"}</div>
                          <button
                            className="sd-photo-remove"
                            onClick={(e) => { e.stopPropagation(); removePhoto(selectedTask.id, i); setFileTypeBadge(null); setEvalStage(0); }}
                          >✕</button>
                        </div>
                      );
                    })}
                  </div>

                  {reviewingTask === selectedTask.id && (
                    <div className="sd-review-progress">
                      <div className="sd-progress-title">⟳ &nbsp;Reviewing attachments…</div>
                      <div className="sd-progress-bar"><div className="sd-progress-fill" /></div>
                    </div>
                  )}

                  <button
                    className="sd-btn-review"
                    onClick={() => reviewAttachments(selectedTask.id)}
                    disabled={reviewingTask === selectedTask.id}
                    style={{ marginBottom: 6, width: "100%" }}
                  >
                    {reviewingTask === selectedTask.id
                      ? <><Loader size={10} className="sd-spinner" /> Reviewing…</>
                      : reviewResults[selectedTask.id]
                      ? <><Eye size={10} /> Review Again</>
                      : <><Eye size={10} /> Review Attachments</>}
                  </button>

                  {reviewResults[selectedTask.id] && (
                    reviewResults[selectedTask.id].hasErrors ? (
                      <>
                        <div
                          className={`sd-error-panel-header ${expandedReviewPanel === selectedTask.id ? "expanded" : ""}`}
                          onClick={() => setExpandedReviewPanel(expandedReviewPanel === selectedTask.id ? null : selectedTask.id)}
                        >
                          <span className="sd-error-count">
                            ⚠ {reviewResults[selectedTask.id].results.filter((r: any) => r.status === "ERROR").length} Critical Error
                            {reviewResults[selectedTask.id].results.filter((r: any) => r.status === "ERROR").length !== 1 ? "s" : ""} Found
                          </span>
                          <span className={`sd-error-toggle ${expandedReviewPanel === selectedTask.id ? "expanded" : ""}`}>▼</span>
                        </div>
                        {expandedReviewPanel === selectedTask.id && (
                          <div className="sd-error-content">
                            {reviewResults[selectedTask.id].results.map((result: any, idx: number) => {
                              if (result.status !== "ERROR") return null;
                              return (
                                <div key={idx} style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                    📄 Image {result.image} — {result.status}
                                  </div>
                                  {result.issues?.length > 0 && (
                                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                                      {result.issues.map((issue: string, i: number) => (
                                        <li className="sd-error-item" key={i}>{issue}</li>
                                      ))}
                                    </ul>
                                  )}
                                  {result.recommendations && (
                                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "var(--c)" }}>
                                      <strong>💡 Fix:</strong> {result.recommendations}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <div className="sd-warning-panel">
                              <span style={{ color: "var(--c)", fontSize: 14, flexShrink: 0 }}>ℹ</span>
                              <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.5 }}>
                                Please fix the errors above and re-upload corrected images.
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="sd-success-panel">
                        <span style={{ fontSize: 14 }}>✓</span>
                        All attachments reviewed — No errors found. Ready to submit!
                      </div>
                    )
                  )}

                  {/* ── SmartCue Stage Visualizer — active during analysis ── */}
                  {evalStage > 0 && evalStage < 7 && (
                    <div style={{
                      marginTop: 10, background: "rgba(0,0,0,0.5)",
                      border: "1px solid rgba(0,212,255,0.2)", borderRadius: 12, overflow: "hidden",
                    }}>
                      {/* Scanning visualization */}
                      {(() => {
                        const firstUrl  = (uploadedPhotos[selectedTask.id] || [])[0];
                        const vidMode   = firstUrl?.startsWith("data:video/");
                        return (
                          <div style={{ position: "relative", width: "100%", height: vidMode ? 88 : 72, background: "#000", overflow: "hidden" }}>
                            {vidMode
                              ? <>
                                  {/* Video preview playing */}
                                  <video src={firstUrl} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.45 }} muted playsInline autoPlay loop />
                                  {/* Filmstrip overlay — 6 equally-spaced markers */}
                                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 12, display: "flex", gap: 2, padding: "0 4px" }}>
                                    {[...Array(6)].map((_, i) => (
                                      <div key={i} style={{ flex: 1, background: "rgba(0,212,255,0.25)", borderRadius: "0 0 2px 2px", animation: `scanPulse ${1.2 + i * 0.2}s ease-in-out infinite` }} />
                                    ))}
                                  </div>
                                  {/* Vertical scan line for video */}
                                  <div style={{
                                    position: "absolute", top: 12, bottom: 0, width: 2,
                                    background: "linear-gradient(180deg, transparent, #f5c518, transparent)",
                                    boxShadow: "0 0 12px #f5c518, 0 0 24px #f5c51888",
                                    animation: "scanLineH 1.8s ease-in-out infinite",
                                  }} />
                                  {/* Frame count badge */}
                                  <div style={{ position: "absolute", bottom: 5, left: 8, display: "flex", alignItems: "center", gap: 5 }}>
                                    <span style={{ fontSize: 8, fontWeight: 800, color: "#f5c518", textTransform: "uppercase", letterSpacing: "0.8px", textShadow: "0 0 8px rgba(245,197,24,0.9)" }}>
                                      {evalStage === 3 ? "▶ Extracting 6 frames…" : "▶ Analysing video frames"}
                                    </span>
                                  </div>
                                </>
                              : <>
                                  <img src={firstUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} />
                                  {/* Horizontal scan line */}
                                  <div style={{
                                    position: "absolute", left: 0, right: 0, height: 2,
                                    background: "linear-gradient(90deg, transparent, #00d4ff, transparent)",
                                    boxShadow: "0 0 12px #00d4ff, 0 0 24px #00d4ff88",
                                    animation: "scanLine 1.4s ease-in-out infinite",
                                  }} />
                                </>
                            }
                            {/* Detection grid overlay — both modes */}
                            <div style={{
                              position: "absolute", inset: 0,
                              backgroundImage: "linear-gradient(rgba(0,212,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.06) 1px, transparent 1px)",
                              backgroundSize: "18px 18px",
                              animation: "scanPulse 2s ease-in-out infinite",
                            }} />
                            {/* Corner detection markers */}
                            {([[0,0],[0,1],[1,0],[1,1]] as [0|1, 0|1][]).map(([y,x], i) => (
                              <div key={i} style={{
                                position: "absolute",
                                top: y === 0 ? 5 : "auto", bottom: y === 1 ? 5 : "auto",
                                left: x === 0 ? 5 : "auto", right: x === 1 ? 5 : "auto",
                                width: 12, height: 12,
                                borderTop: y === 0 ? `2px solid ${vidMode ? "#f5c518" : "#00d4ff"}` : "none",
                                borderBottom: y === 1 ? `2px solid ${vidMode ? "#f5c518" : "#00d4ff"}` : "none",
                                borderLeft: x === 0 ? `2px solid ${vidMode ? "#f5c518" : "#00d4ff"}` : "none",
                                borderRight: x === 1 ? `2px solid ${vidMode ? "#f5c518" : "#00d4ff"}` : "none",
                                animation: "cornerBlink 1.2s ease-in-out infinite",
                              }} />
                            ))}
                            {/* Stage label */}
                            {!vidMode && (
                              <div style={{ position: "absolute", bottom: 4, left: 8, fontSize: 8, fontWeight: 800, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "0.8px", textShadow: "0 0 8px rgba(0,212,255,0.9)" }}>
                                {SMARTCUE_STAGES[evalStage - 1]?.label}
                              </div>
                            )}
                            {/* Spinning icon */}
                            <div style={{ position: "absolute", top: 4, right: 8, fontSize: 13, color: vidMode ? "#f5c518" : "#00d4ff" }}>
                              <span className="sc-spin">◈</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Stage list */}
                      <div style={{ padding: "10px 14px" }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: "#00d4ff", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="sc-spin" style={{ fontSize: 10 }}>◈</span> SmartCue is Analysing
                        </div>
                        {SMARTCUE_STAGES.map(s => (
                          <div key={s.id} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "3px 0",
                            opacity: s.id <= evalStage ? 1 : 0.28,
                            animation: s.id === evalStage ? "stageReveal 0.3s ease" : "none",
                            transition: "opacity 0.4s",
                          }}>
                            <span style={{ fontSize: 10, minWidth: 14, color: s.id < evalStage ? "#00ff88" : s.id === evalStage ? s.color : "#434763", transition: "color 0.3s" }}>
                              {s.id < evalStage ? "✓" : s.id === evalStage ? s.icon : "○"}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: s.id === evalStage ? 700 : 400, color: s.id < evalStage ? "#00ff88" : s.id === evalStage ? s.color : "#434763", transition: "all 0.3s" }}>
                              {s.label}
                            </span>
                            {s.id === evalStage && (
                              <span style={{ fontSize: 8, color: s.color, marginLeft: "auto", opacity: 0.8 }}>running…</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div
                className="sd-drop-zone"
                onClick={() => document.getElementById(`modal-upload-${selectedTask.id}`)?.click()}
              >
                <div className="sd-drop-icon">📎</div>
                <div className="sd-drop-text">Click to upload · <span>Browse files</span></div>
              </div>
              <input
                id={`modal-upload-${selectedTask.id}`}
                type="file" accept="image/*,video/*,.pdf,.docx,.pptx" multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  handlePhotoUpload(selectedTask.id, e.target.files);
                  const firstFile = e.target.files?.[0];
                  if (firstFile) {
                    const badge = detectFileInfo(firstFile);
                    setFileTypeBadge(badge);
                    setEvalStage(0);
                  }
                }}
              />
            </div>

            {/* AI Scoring info banner */}
            <div style={{ marginBottom: 14, marginTop: 10, padding: "10px 14px", background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.18)", borderRadius: 9, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>✨</span>
              <div style={{ fontSize: 11, color: "#7e84a3", lineHeight: 1.6 }}>
                <span style={{ color: "#00d4ff", fontWeight: 700 }}>SmartCue AI Scoring</span> — Upload your marketing image and add your notes. SmartCue will score your submission across <span style={{ color: "#00d4ff" }}>5 categories</span> (Aesthetics, Compliance, Grammar, Creativity, Engagement) out of <span style={{ color: "#00d4ff" }}>100 points</span> before you submit.
              </div>
            </div>

            <div className="sd-modal-btns">
              <button
                className="sd-btn-submit"
                onClick={handleMarkComplete}
                disabled={!!(reviewResults[selectedTask.id] && reviewResults[selectedTask.id].hasErrors) || analyzingImage}
                title={
                  reviewResults[selectedTask.id]?.hasErrors
                    ? "Fix attachment errors before submitting"
                    : (!completionNotes.trim() && (uploadedPhotos[selectedTask.id] || []).length === 0) ? "Add notes or upload image first"
                    : "Score with Claude AI then submit"
                }
              >
                {analyzingImage
                  ? "SmartCue is Analysing…"
                  : (!completionNotes.trim() && (uploadedPhotos[selectedTask.id] || []).length === 0)
                  ? "⚠ Add Notes or Upload Image"
                  : "Score & Submit →"}
              </button>
              <button
                className="sd-btn-cancel"
                onClick={() => { setShowCompletionForm(false); setSelectedTask(null); setCompletionNotes(""); setEvalStage(0); setFileTypeBadge(null); }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ── Types ────────────────────────────────────────────────────────────────────
interface ReviewResult {
  results: Array<{ image: number; status: "CLEAN" | "MINOR" | "ERROR"; issues: string[]; recommendations: string }>;
  hasErrors: boolean;
  timestamp: string;
}

interface AssignerInfo {
  name: string;
  role: string;
  email: string;
}

interface TaskCardProps {
  task:           Task;
  photos:         string[];
  getProjectName: (id: string) => string;
  getAssignerInfo:(email?: string) => AssignerInfo | null;
  onComplete:     () => void;
  onUpload:       (files: FileList | null) => void;
  onRemovePhoto:  (i: number) => void;
  onOpenLightbox: (photos: string[], index: number) => void;
  dragOver:       boolean;
  setDragOver:    (v: boolean) => void;
  isCompleted?:   boolean;
}

// ── TaskCard — unchanged from original ──────────────────────────────────────
const TaskCard: React.FC<TaskCardProps> = ({
  task, photos, getProjectName, getAssignerInfo,
  onComplete, onUpload, onRemovePhoto, onOpenLightbox,
  dragOver, setDragOver, isCompleted,
}) => {
  const approvalMap: Record<string, { label: string; cls: string }> = {
    assigned:              { label: "Assigned",       cls: "badge-blue"   },
    "in-review":           { label: "Pending Review", cls: "badge-amber"  },
    "admin-approved":      { label: "Admin Approved", cls: "badge-blue"   },
    "superadmin-approved": { label: "Fully Approved", cls: "badge-green"  },
    rejected:              { label: "Rejected",       cls: "badge-red"    },
  };
  const approval    = approvalMap[task.approvalStatus] ?? approvalMap.assigned;
  const priorityCls = task.priority === "high" ? "badge-red" : task.priority === "low" ? "badge-green" : "badge-amber";

  const statusMessages: Record<string, { text: string; color: string }> = {
    assigned:              { text: "Ready to submit",                        color: "var(--accent-light)"  },
    "in-review":           { text: "Waiting for admin review…",             color: "var(--amber)"          },
    "admin-approved":      { text: "Admin approved · awaiting superadmin…", color: "var(--blue)"           },
    "superadmin-approved": { text: "✓ Fully Approved",                       color: "var(--green)"          },
    rejected:              { text: "Please resubmit with improvements",      color: "var(--red)"            },
  };
  const statusMsg = statusMessages[task.approvalStatus];

  const assigner = getAssignerInfo((task as any).assignedBy);
  const role     = assigner?.role ?? "admin";
  const rc       = ROLE_COLOR[role] ?? ROLE_COLOR.admin;
  const taskAttachments: string[] = (task as any).attachments ?? [];
  const delayed = isDelayed(task);

  return (
    <div className="sd-task" style={delayed ? { borderColor: "rgba(255,51,102,0.25)" } : {}}>
      {delayed && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          display: "flex", alignItems: "center", gap: 4,
          padding: "2px 7px", borderRadius: 4,
          background: "rgba(255,51,102,0.1)", border: "1px solid rgba(255,51,102,0.25)",
          fontSize: 8, color: "#ff3366", fontWeight: 800, textTransform: "uppercase",
        }}>
          <AlertTriangle size={7} /> Late
        </div>
      )}
      <div className="sd-task-top">
        <div style={{ flex: 1 }}>
          <div className="sd-task-title">{task.title}</div>
          <div className="sd-task-desc">{task.description}</div>
        </div>
        {!isCompleted && (task.approvalStatus === "assigned" || task.approvalStatus === "rejected") && (
          <button className="sd-btn-complete" onClick={onComplete}>
            <Eye size={11} /> Submit
          </button>
        )}
      </div>

      {assigner && (
        <div
          className="sd-assigner-chip"
          style={{ background: rc.bg, border: `1px solid ${rc.border}`, color: rc.text }}
        >
          {role === "superadmin" || role === "supremo"
            ? <Shield size={9} />
            : <User size={9} />}
          Assigned by <strong style={{ marginLeft: 3 }}>{assigner.name}</strong>
          <span style={{ opacity: 0.55, marginLeft: 3 }}>· {ROLE_LABEL[role] ?? role}</span>
        </div>
      )}

      <div className="sd-task-meta">
        <span className={`badge ${priorityCls}`}>{task.priority} priority</span>
        <span className={`badge ${approval.cls}`}>{approval.label}</span>
        {task.projectId && (
          <span className="badge badge-purple">{getProjectName(task.projectId)}</span>
        )}
      </div>

      {task.approvalStatus === "rejected" && task.adminComments && (
        <div className="sd-note sd-note-red">
          <div className="sd-note-label" style={{ color: "var(--cr)" }}>⚠ Rejection reason</div>
          {task.adminComments}
        </div>
      )}

      {task.completionNotes && (
        <div className="sd-note sd-note-purple">
          <div className="sd-note-label" style={{ color: "var(--c)" }}>Your notes</div>
          {task.completionNotes}
        </div>
      )}

      {task.adminReviewedBy && task.adminComments && task.approvalStatus !== "rejected" && (
        <div className="sd-note sd-note-cyan">
          <div className="sd-note-label" style={{ color: "var(--cg)" }}>Admin · {task.adminReviewedBy}</div>
          {task.adminComments}
        </div>
      )}

      {taskAttachments.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="sd-att-label">
            📎 {taskAttachments.length} Attachment{taskAttachments.length !== 1 ? "s" : ""} submitted
          </div>
          <div className="sd-att-strip">
            {taskAttachments.map((url, i) => (
              <div
                key={i}
                className="sd-att-thumb"
                title={`Open attachment ${i + 1}`}
                onClick={() => onOpenLightbox(taskAttachments, i)}
              >
                <img src={url} alt={`att-${i}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {!isCompleted && (task.approvalStatus === "assigned" || task.approvalStatus === "rejected") && (
        <div className="sd-photos" style={{ marginTop: "8px" }}>
          {photos.length > 0 && (
            <div className="sd-photo-grid">
              {photos.map((url, i) => {
                const isVid = url.startsWith("data:video/");
                return (
                  <div
                    className="sd-photo-thumb"
                    key={i}
                    onClick={() => onOpenLightbox(photos, i)}
                  >
                    {isVid
                      ? <video src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                      : <img src={url} alt={`photo-${i}`} />}
                    <div className="sd-photo-expand">{isVid ? "▶" : "🔍"}</div>
                    <button
                      className="sd-photo-remove"
                      onClick={(e) => { e.stopPropagation(); onRemovePhoto(i); }}
                    >✕</button>
                  </div>
                );
              })}
            </div>
          )}
          <div
            className={`sd-drop-zone ${dragOver ? "drag-over" : ""}`}
            onClick={() => document.getElementById(`upload-${task.id}`)?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onUpload(e.dataTransfer.files); }}
          >
            <div className="sd-drop-icon"><Upload size={14} /></div>
            <div className="sd-drop-text">Drop files here · <span>browse</span></div>
          </div>
          <input
            id={`upload-${task.id}`}
            type="file" accept="image/*,video/*,.pdf,.docx,.pptx" multiple
            style={{ display: "none" }}
            onChange={(e) => onUpload(e.target.files)}
          />
        </div>
      )}

      <div className="sd-task-footer">
        <div className="sd-task-dates">
          <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
          {task.createdAt && <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>}
        </div>
        {statusMsg && (
          <div className="sd-status-msg" style={{ color: statusMsg.color }}>{statusMsg.text}</div>
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;