import React, { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "../contexts/UserContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
// ═══════════════════════════════════════════════════════════════════════════
// VOICE MODULE  (inline — no external import needed)
// ═══════════════════════════════════════════════════════════════════════════

const _API_BASE_VOICE = process.env.REACT_APP_API_URL || "https://adaptable-patience-production-45da.up.railway.app";

let _selectedVoice: string | null = null;
const _lastIndex: Record<string, number> = {};

export function setElevenLabsVoice(voiceId: string): void {
  _selectedVoice = voiceId;
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5  && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getGreetingWord(): string {
  const map: Record<string, string> = {
    morning:   "Good Morning",
    afternoon: "Good afternoon",
    evening:   "Good evening",
    night:     "Welcome back",
  };
  return map[getTimeOfDay()];
}

const VOICE_SCRIPTS = {
  task_assigned:          ["New task assigned. Your team member has been notified.", "Task successfully assigned and dispatched.", "Assignment confirmed. The task is now live on their dashboard."],
  task_approved:          ["Task approved and forwarded to the Superadmin for final sign off.", "Approval confirmed. This task is now escalated to Superadmin review.", "Well done. Task has been approved and sent up for Superadmin clearance."],
  task_sent_for_approval: ["Task submitted and sent for Superadmin approval.", "Submission complete. Awaiting Superadmin review and final approval.", "Your task has been forwarded to Superadmin for sign off."],
  task_rejected:          ["Task returned for rework. Please review the feedback provided.", "Rework requested. The assignee will be notified to revise and resubmit.", "Task sent back for revision. Comments have been logged."],
  task_submitted:         ["Task submitted for review. Your manager will be notified shortly.", "Submission received. The task is now under review.", "Task marked complete and submitted to your admin for approval."],
  task_forwarded:         ["Task forwarded successfully. The new assignee has been notified.", "Handover complete. Full context has been preserved for the new assignee.", "Task delegated. History and notes have been transferred."],
  task_deleted:           ["Task deleted.", "Task removed from the system.", "Done. That task has been permanently deleted."],
  system_ready:           ["All systems operational. SmartCue is ready for your command.", "System initialization complete. Awaiting your orders."],
  logout_confirmed:       ["Logout confirmed. Until next time, sir.", "Session terminated. Goodbye, sir.", "Systems powering down. Have a productive day."],
  Welcome_Login:          ["Welcome to Smart Cue. Enter your credentials to login."],
  Access_Granted:         ["Access granted. Welcome to your dashboard.", "Access granted. You are now authenticated.", "Access granted. Navigation commencing."],
  Access_Denied:          ["Access denied. Please check your credentials and try again.", "Invalid credentials. Access denied.", "Authentication failed. Access denied."],
};

type VoiceEventKey = keyof typeof VOICE_SCRIPTS;

// Audio singleton — only ONE voice can ever play at a time
let _currentAudio: HTMLAudioElement | null = null;
let _speakLock = false;

function cleanForTTS(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1").replace(/_([^_]+)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "").replace(/^>\s+/gm, "")
    .replace(/^[-•]\s+/gm, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, ". ").replace(/\n/g, " ")
    .replace(/▸/g, "").replace(/◈|◉|◎|◭/g, "").trim();
}

async function _speakWithBackend(text: string, onStart?: () => void, onEnd?: () => void): Promise<void> {
  if (_currentAudio) { _currentAudio.pause(); _currentAudio.src = ""; _currentAudio = null; }
  if (_speakLock) { onEnd?.(); return; }
  _speakLock = true;
  setTimeout(() => { _speakLock = false; }, 80);
  try {
    onStart?.();
    const response = await fetch(`${_API_BASE_VOICE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanForTTS(text), voiceId: _selectedVoice || "ThT5KcBeYPX3keUQqHPh" }),
    });
    if (!response.ok) throw new Error("TTS backend unavailable");
    const blob  = await response.blob();
    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);
    _currentAudio = audio;
    await new Promise<void>((resolve) => {
      audio.onended = () => { URL.revokeObjectURL(url); _currentAudio = null; onEnd?.(); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); _currentAudio = null; onEnd?.(); resolve(); };
      audio.play().catch(() => { _currentAudio = null; onEnd?.(); resolve(); });
    });
  } catch {
    // ElevenLabs only — no browser speech fallback
    _currentAudio = null; onEnd?.();
  }
}

async function _speak(text: string, onStart?: () => void, onEnd?: () => void): Promise<void> {
  await _speakWithBackend(text, onStart, onEnd);
}

function getScript(event: VoiceEventKey): string {
  const scripts = VOICE_SCRIPTS[event];
  const lastIdx = _lastIndex[event] ?? -1;
  let idx = Math.floor(Math.random() * scripts.length);
  if (scripts.length > 1 && idx === lastIdx) idx = (idx + 1) % scripts.length;
  _lastIndex[event] = idx;
  return scripts[idx];
}

function announceVoice(event: VoiceEventKey, onStart?: () => void, onEnd?: () => void): Promise<void> {
  return _speak(getScript(event), onStart, onEnd);
}

function speakText(text: string, onStart?: () => void, onEnd?: () => void): Promise<void> {
  return _speak(text, onStart, onEnd);
}

// greetUser — fires a welcome speech on mount
async function greetUser(name: string): Promise<void> {
  const msg = `${getGreetingWord()}, ${name}. SmartCue is online and ready.`;
  await speakText(msg);
}

// ── Web Speech helpers for JarvisAssistant ────────────────────────────────

interface ListenOnceResult { transcript: string; confidence: number; }

function listenOnce(timeoutMs = 8000): Promise<ListenOnceResult> {
  return new Promise((resolve, reject) => {
    const W  = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) { reject(new Error("Speech recognition not available")); return; }
    const rec = new SR();
    rec.continuous = false; rec.lang = "en-IN";
    const timer = setTimeout(() => { try { rec.abort(); } catch(_){} reject(new Error("Timeout")); }, timeoutMs);
    rec.onresult = (e: any) => {
      clearTimeout(timer);
      resolve({ transcript: e.results[0][0].transcript, confidence: e.results[0][0].confidence });
    };
    rec.onerror = (e: any) => { clearTimeout(timer); reject(new Error(e.error)); };
    try { rec.start(); } catch(e) { clearTimeout(timer); reject(e); }
  });
}

interface ContinuousListenerOpts {
  wakeWord?: string;
  onWake?: () => void;
  onTranscript: (transcript: string) => void;
  onError?: (err: Error) => void;
}

function startContinuousListener(opts: ContinuousListenerOpts): () => void {
  const W  = window as any;
  const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!SR) { opts.onError?.(new Error("Speech recognition not available")); return () => {}; }
  let active = true;
  let rec: any = null;
  function start() {
    if (!active) return;
    rec = new SR();
    rec.continuous = false; rec.lang = "en-IN";
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript.toLowerCase();
      if (opts.wakeWord && t.includes(opts.wakeWord)) {
        opts.onWake?.();
        return;
      }
      opts.onTranscript(e.results[0][0].transcript);
    };
    rec.onerror = (e: any) => opts.onError?.(new Error(e.error));
    rec.onend   = () => { if (active) setTimeout(start, 400); };
    try { rec.start(); } catch(_) {}
  }
  start();
  return () => { active = false; try { rec?.abort(); } catch(_) {} };
}

async function processJarvisCommand(transcript: string, ctx: any): Promise<string> {
  try {
    const res = await fetch(`${_API_BASE_VOICE}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 300,
        system: `You are J.A.R.V.I.S for SmartCue — a Roswalt Realty command AI. Context: ${JSON.stringify(ctx)}. Be concise, authoritative, max 80 words.`,
        messages: [{ role: "user", content: transcript }],
      }),
    });
    const d = await res.json();
    return d.content?.[0]?.text ?? "Unable to process that command, sir.";
  } catch { return "Network issue. Standing by."; }
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type JarvisState = "idle" | "listening" | "thinking" | "speaking" | "error";

// VoiceEvent is the same as VoiceEventKey (keys of VOICE_SCRIPTS)
type VoiceEvent = VoiceEventKey;

async function fireVoiceEvent(event: VoiceEvent, voiceEnabled: boolean) {
  if (!voiceEnabled) return;
  try { await announceVoice(event); } catch { /* swallow */ }
}

interface AiMessage  { id: number; role: "user" | "assistant"; text: string; timestamp: Date; }
interface JarvisMsg  { id: string; role: "user" | "jarvis"; text: string; timestamp: Date; }
interface MockUser   { id: string; name: string; email: string; role: string; isDoer: boolean; }
interface MockTask   {
  id: string; title: string; status: string; priority: string;
  progress: number; assignedTo: string; dueDate: string;
  tatBreached: boolean; project: string; description?: string;
}
interface ChartTipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}

// ── Live backend types ────────────────────────────────────────────────────────
interface LiveTask {
  _id: string; title: string; status: string; priority: string;
  progress: number; assignedTo: string; assignedToName?: string;
  dueDate: string; tatBreached: boolean; project: string;
  description?: string; createdAt?: string; updatedAt?: string;
  attachments?: { url: string; publicId: string; name?: string; type?: string }[];
}
interface Activity {
  _id: string; action: string; taskTitle: string; userName: string;
  userRole: string; timestamp: string; details?: string;
}
interface PulseTick { time: string; completed: number; inProgress: number; pending: number; breached: number; }

// ─────────────────────────────────────────────────────────────────────────────
// API BASE
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.REACT_APP_API_URL ||
  "https://adaptable-patience-production-45da.up.railway.app";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_USERS: MockUser[] = [
  { id:"1",  name:"Pushkaraj Gore",          email:"pushkaraj.gore@roswalt.com",     role:"superadmin", isDoer:false },
  { id:"2",  name:"Aziz Ashfaq Khan",         email:"aziz.khan@roswalt.com",          role:"admin",      isDoer:false },
  { id:"3",  name:"Vinay Dinkar Vanmali",     email:"vinay.vanmali@roswalt.com",      role:"admin",      isDoer:false },
  { id:"4",  name:"Jalal Chandmiya Shaikh",   email:"jalal.shaikh@roswalt.com",       role:"admin",      isDoer:false },
  { id:"5",  name:"Nidhi Mehta",              email:"nidhi.mehta@roswalt.com",        role:"admin",      isDoer:false },
  { id:"8",  name:"Prathamesh Chile",         email:"prathamesh.chile@roswalt.com",   role:"staff",      isDoer:true  },
  { id:"9",  name:"Samruddhi Shivgan",        email:"samruddhi.shivgan@roswalt.com",  role:"staff",      isDoer:true  },
  { id:"10", name:"Irfan S. Ansari",          email:"irfan.ansari@roswalt.com",       role:"staff",      isDoer:true  },
  { id:"11", name:"Vishal Chaudhary",         email:"vishal.chaudhary@roswalt.com",   role:"staff",      isDoer:true  },
  { id:"12", name:"Mithilesh Menge",          email:"mithilesh.menge@roswalt.com",    role:"staff",      isDoer:true  },
  { id:"13", name:"Jai Bhojwani",             email:"jai.bhojwani@roswalt.com",       role:"staff",      isDoer:true  },
  { id:"18", name:"Raj Sachin Vichare",       email:"raj.vichare@roswalt.com",        role:"staff",      isDoer:true  },
];

const INIT_TASKS: MockTask[] = [
  { id:"t1", title:"Q4 Financial Report",   status:"in_progress", priority:"high",   progress:72,  assignedTo:"prathamesh.chile@roswalt.com",  dueDate:"2025-01-20", tatBreached:false, project:"General"          },
  { id:"t2", title:"Website Redesign Ph.2", status:"in_progress", priority:"high",   progress:45,  assignedTo:"samruddhi.shivgan@roswalt.com", dueDate:"2025-01-18", tatBreached:true,  project:"Website Redesign" },
  { id:"t3", title:"Marketing Deck",        status:"pending",      priority:"medium", progress:10,  assignedTo:"irfan.ansari@roswalt.com",      dueDate:"2025-01-25", tatBreached:false, project:"Marketing"        },
  { id:"t4", title:"Product Spec Doc",      status:"completed",    priority:"low",    progress:100, assignedTo:"vishal.chaudhary@roswalt.com",  dueDate:"2025-01-15", tatBreached:false, project:"Product Launch"   },
  { id:"t5", title:"Client Onboarding",     status:"in_progress", priority:"high",   progress:60,  assignedTo:"mithilesh.menge@roswalt.com",   dueDate:"2025-01-17", tatBreached:true,  project:"General"          },
  { id:"t6", title:"Social Media Strategy", status:"rework",       priority:"medium", progress:30,  assignedTo:"jai.bhojwani@roswalt.com",      dueDate:"2025-01-22", tatBreached:false, project:"Marketing"        },
  { id:"t7", title:"Data Migration Script", status:"approved",     priority:"high",   progress:100, assignedTo:"raj.vichare@roswalt.com",       dueDate:"2025-01-14", tatBreached:false, project:"Website Redesign" },
];

const PERF_DATA = [
  { name:"Prathamesh", completed:12, pending:3, breached:1 },
  { name:"Samruddhi",  completed:8,  pending:5, breached:2 },
  { name:"Irfan",      completed:15, pending:2, breached:0 },
  { name:"Vishal",     completed:10, pending:4, breached:1 },
  { name:"Mithilesh",  completed:7,  pending:6, breached:3 },
  { name:"Jai",        completed:11, pending:3, breached:1 },
  { name:"Raj",        completed:14, pending:1, breached:0 },
];

const TASK_TREND = [
  { week:"W1", assigned:18, completed:14, breached:2 },
  { week:"W2", assigned:22, completed:19, breached:1 },
  { week:"W3", assigned:16, completed:12, breached:3 },
  { week:"W4", assigned:25, completed:22, breached:2 },
];

const STATUS_PIE = [
  { name:"Completed",   value:35, color:"#22c55e" },
  { name:"In Progress", value:28, color:"#6366f1" },
  { name:"Pending",     value:18, color:"#f59e0b" },
  { name:"Rework",      value:12, color:"#f97316" },
  { name:"Approved",    value:7,  color:"#0ea5e9" },
];

const RADAR_DATA = [
  { subject:"Speed",    A:85, B:72 }, { subject:"Quality",  A:78, B:88 },
  { subject:"TAT",      A:92, B:65 }, { subject:"Volume",   A:70, B:80 },
  { subject:"Accuracy", A:88, B:76 }, { subject:"Collab",   A:65, B:90 },
];

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL CSS — SADashboard palette: dark navy, violet accent, clean cards
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500;600&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

:root{
  --bg:       #080c14;
  --srf:      rgba(16,22,36,0.75);
  --srf2:     rgba(22,30,48,0.8);
  --srf3:     rgba(28,38,58,0.7);
  --bdr:      rgba(255,255,255,0.07);
  --bdr2:     rgba(255,255,255,0.12);
  --t1:       #eef2ff;
  --t2:       #8b9ab8;
  --t3:       #4a5568;
  --acc:      #6366f1;
  --acc2:     #818cf8;
  --grn:      #22c55e;
  --grn2:     #16a34a;
  --red:      #f43f5e;
  --amber:    #f59e0b;
  --sky:      #0ea5e9;
  --orange:   #f97316;
  --purple:   #a78bfa;
  --font:     'DM Sans', sans-serif;
  --mono:     'JetBrains Mono', monospace;
  --gold:     #d4a847;
  --gold2:    #f0c060;
  --gold3:    #b8860b;
  --gold-glow:rgba(212,168,71,.35);
}

html,body{height:100%;overflow:hidden;}
body{
  background:var(--bg);
  background-image:
    radial-gradient(ellipse 80% 50% at 20% 10%, rgba(99,102,241,0.12) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 80%, rgba(212,168,71,0.08) 0%, transparent 55%),
    radial-gradient(ellipse 50% 60% at 50% 50%, rgba(14,165,233,0.05) 0%, transparent 60%);
  color:var(--t1);font-family:var(--font);font-size:14px;line-height:1.5;
}

::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:rgba(99,102,241,.3);border-radius:3px;}
::-webkit-scrollbar-thumb:hover{background:rgba(99,102,241,.5);}

/* ── Glass Cards ── */
.card{
  background:rgba(14,20,36,0.6);
  backdrop-filter:blur(20px);
  -webkit-backdrop-filter:blur(20px);
  border:1px solid rgba(255,255,255,0.07);
  border-radius:16px;overflow:hidden;
  box-shadow:0 4px 24px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.05);
  transition:border-color .2s,box-shadow .2s;
}
.card:hover{border-color:rgba(212,168,71,.25);box-shadow:0 8px 32px rgba(0,0,0,.4),0 0 20px rgba(212,168,71,.06),inset 0 1px 0 rgba(255,255,255,.06);}
.card-sm{
  background:rgba(14,20,36,0.6);
  backdrop-filter:blur(16px);
  border:1px solid rgba(255,255,255,0.07);
  border-radius:12px;padding:16px;
  box-shadow:0 4px 16px rgba(0,0,0,.25);
}
.card-head{
  padding:16px 20px;
  border-bottom:1px solid rgba(255,255,255,0.06);
  display:flex;align-items:center;justify-content:space-between;
  background:linear-gradient(90deg,rgba(212,168,71,.04),transparent);
}
.card-body{padding:20px;}

/* ── Stat cards ── */
.stat-card{
  background:rgba(10,16,28,0.65);
  backdrop-filter:blur(20px);
  -webkit-backdrop-filter:blur(20px);
  border:1px solid rgba(255,255,255,0.08);
  border-radius:16px;padding:22px;
  transition:all .25s;
  position:relative;overflow:hidden;
  box-shadow:0 4px 24px rgba(0,0,0,.3);
}
.stat-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,var(--gold),transparent);
  opacity:.5;
}
.stat-card::after{
  content:'';position:absolute;top:-60px;right:-40px;
  width:140px;height:140px;border-radius:50%;
  background:radial-gradient(circle,rgba(99,102,241,.08) 0%,transparent 70%);
  pointer-events:none;
}
.stat-card:hover{
  border-color:rgba(212,168,71,.3);
  transform:translateY(-3px);
  box-shadow:0 12px 40px rgba(0,0,0,.4),0 0 24px rgba(212,168,71,.1);
}

/* ── Badges ── */
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.3px;}
.badge-green {background:rgba(34,197,94,.12);  color:#4ade80; border:1px solid rgba(34,197,94,.25);}
.badge-red   {background:rgba(244,63,94,.12);  color:#fb7185; border:1px solid rgba(244,63,94,.25);}
.badge-amber {background:rgba(245,158,11,.12); color:#fbbf24; border:1px solid rgba(245,158,11,.25);}
.badge-sky   {background:rgba(14,165,233,.12); color:#38bdf8; border:1px solid rgba(14,165,233,.25);}
.badge-acc   {background:rgba(99,102,241,.12); color:#a5b4fc; border:1px solid rgba(99,102,241,.25);}
.badge-orange{background:rgba(249,115,22,.12); color:#fb923c; border:1px solid rgba(249,115,22,.25);}
.badge-purple{background:rgba(167,139,250,.12);color:#c4b5fd; border:1px solid rgba(167,139,250,.25);}
.badge-gray  {background:rgba(139,148,158,.08);color:var(--t2);border:1px solid rgba(255,255,255,.08);}

/* ── Buttons ── */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .15s;font-family:var(--font);}
.btn-primary{background:linear-gradient(135deg,var(--gold3),var(--gold),var(--gold2));color:#1a1200;font-weight:700;box-shadow:0 4px 16px rgba(212,168,71,.3);}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(212,168,71,.45);}
.btn-ghost{background:rgba(255,255,255,.04);color:var(--t2);border:1px solid rgba(255,255,255,.08);}
.btn-ghost:hover{background:rgba(255,255,255,.08);color:var(--t1);border-color:rgba(255,255,255,.14);}
.btn-danger{background:rgba(244,63,94,.1);color:var(--red);border:1px solid rgba(244,63,94,.2);}
.btn-danger:hover{background:rgba(244,63,94,.18);}
.btn-success{background:rgba(34,197,94,.1);color:var(--grn);border:1px solid rgba(34,197,94,.2);}
.btn-success:hover{background:rgba(34,197,94,.18);}
.btn-sm{padding:5px 12px;font-size:12px;}
.btn-xs{padding:3px 8px;font-size:11px;border-radius:6px;}

/* ── Inputs ── */
.input{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;color:var(--t1);font-family:var(--font);font-size:13px;padding:8px 12px;outline:none;width:100%;transition:border-color .15s,background .15s;}
.input:focus{border-color:rgba(212,168,71,.5);background:rgba(255,255,255,.06);}
.input option{background:#0d1117;}
textarea.input{resize:vertical;}
select.input{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px;}

/* ── Progress bar ── */
.progress{height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;}
.progress-fill{height:100%;border-radius:2px;transition:width .8s ease;}

/* ── Nav item ── */
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;cursor:pointer;transition:all .15s;color:var(--t2);font-size:13px;font-weight:500;}
.nav-item:hover{background:rgba(212,168,71,.08);color:var(--gold2);}
.nav-item.active{background:linear-gradient(90deg,rgba(212,168,71,.15),rgba(99,102,241,.06));color:var(--gold);border-left:2px solid var(--gold);padding-left:10px;}
.nav-item .nav-icon{width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}

/* ── Table ── */
.table{width:100%;border-collapse:collapse;}
.table th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--gold3);text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid rgba(255,255,255,.06);}
.table td{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px;}
.table tr:last-child td{border-bottom:none;}
.table tr:hover td{background:rgba(255,255,255,.02);}

/* ── Avatar ── */
.avatar{border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;}
.av-sm {width:28px;height:28px;font-size:11px;}
.av-md {width:36px;height:36px;font-size:13px;}
.av-lg {width:44px;height:44px;font-size:16px;}
.av-acc{background:rgba(99,102,241,.25);color:var(--acc2);border:1px solid rgba(99,102,241,.3);}
.av-grn{background:rgba(34,197,94,.2);color:var(--grn);border:1px solid rgba(34,197,94,.25);}
.av-red{background:rgba(244,63,94,.2);color:var(--red);border:1px solid rgba(244,63,94,.25);}

/* ── Dot ── */
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;}
.dot-green{background:var(--grn);box-shadow:0 0 6px var(--grn);}
.dot-red{background:var(--red);animation:blink 1.5s infinite;box-shadow:0 0 6px var(--red);}
.dot-amber{background:var(--amber);}
.dot-acc{background:var(--acc);}

/* ── Modal ── */
.modal-overlay{position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;animation:fadeIn .15s ease;}
.modal{background:rgba(10,16,28,0.9);backdrop-filter:blur(24px);border:1px solid rgba(212,168,71,.25);border-radius:16px;padding:28px;width:420px;max-width:92vw;box-shadow:0 32px 80px rgba(0,0,0,.6),0 0 40px rgba(212,168,71,.06);}

/* ── Animations ── */
@keyframes fadeIn  {from{opacity:0;} to{opacity:1;}}
@keyframes slideUp {from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
@keyframes blink   {0%,100%{opacity:1;}50%{opacity:.3;}}
@keyframes spin    {to{transform:rotate(360deg);}}
@keyframes pulse   {0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}
@keyframes ringExp {0%{transform:scale(1);opacity:.8;}100%{transform:scale(2.2);opacity:0;}}
@keyframes shimmer {0%{background-position:-200% center;}100%{background-position:200% center;}}
@keyframes goldPulse{0%,100%{box-shadow:0 4px 24px rgba(212,168,71,.35);}50%{box-shadow:0 4px 32px rgba(212,168,71,.35),0 0 40px rgba(212,168,71,.25);}}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
.anim-in {animation:slideUp .3s ease both;}

/* ── Page layout ── */
.layout{display:grid;grid-template-columns:240px 1fr;grid-template-rows:56px 1fr;height:100vh;}
.topbar{
  grid-column:1/-1;
  background:rgba(8,12,20,0.8);
  backdrop-filter:blur(24px);
  -webkit-backdrop-filter:blur(24px);
  border-bottom:1px solid rgba(212,168,71,.12);
  display:flex;align-items:center;padding:0 20px;gap:16px;
  position:sticky;top:0;z-index:100;
  box-shadow:0 2px 32px rgba(0,0,0,.4);
}
.topbar::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.35;}
.sidebar{
  background:rgba(8,12,22,0.7);
  backdrop-filter:blur(24px);
  -webkit-backdrop-filter:blur(24px);
  border-right:1px solid rgba(212,168,71,.1);
  padding:16px 12px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;
}
.main{overflow-y:auto;padding:24px;background:transparent;}

/* ── Sidebar collapsed ── */
.layout.sidebar-collapsed{grid-template-columns:0 1fr;}
.layout.sidebar-collapsed .sidebar{display:none;}

/* ── Section header ── */
.section-title{font-size:20px;font-weight:700;background:linear-gradient(90deg,var(--gold2) 0%,#fff 60%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.section-sub{font-size:13px;color:var(--t2);margin-top:3px;}

/* ── Status chip row ── */
.status-row{display:flex;align-items:center;gap:6px;padding:5px 12px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.15);border-radius:20px;backdrop-filter:blur(8px);}

/* ─────── JARVIS ─────── */
.jarvis-fab{
  position:fixed;bottom:28px;right:28px;z-index:800;
  width:58px;height:58px;border-radius:50%;
  background:linear-gradient(135deg,var(--gold3),var(--gold),var(--gold2));
  border:2px solid rgba(240,192,96,.5);cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 24px var(--gold-glow);
  transition:all .2s;
  animation:goldPulse 3s ease-in-out infinite;
}
.jarvis-fab:hover{transform:scale(1.1);box-shadow:0 8px 36px var(--gold-glow),0 0 28px rgba(212,168,71,.3);}
.jarvis-fab svg{width:24px;height:24px;color:#1a1200;}
.jarvis-wake-dot{position:absolute;top:4px;right:4px;width:12px;height:12px;border-radius:50%;background:var(--grn);border:2px solid var(--bg);animation:blink 1.5s infinite;}
.jarvis-panel{
  position:fixed;bottom:100px;right:28px;z-index:800;
  width:400px;max-height:620px;
  background:rgba(8,14,26,0.9);
  backdrop-filter:blur(28px);
  border:1px solid rgba(212,168,71,.3);
  border-radius:18px;
  display:flex;flex-direction:column;overflow:hidden;
  box-shadow:0 32px 80px rgba(0,0,0,.7),0 0 40px rgba(212,168,71,.08);
  animation:slideUp .2s ease;
}
.jarvis-header{padding:14px 16px;border-bottom:1px solid rgba(212,168,71,.15);display:flex;align-items:center;justify-content:space-between;background:linear-gradient(90deg,rgba(212,168,71,.1),rgba(99,102,241,.05));}
.jarvis-title{font-size:13px;font-weight:700;background:linear-gradient(90deg,var(--gold2),var(--t1));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.jarvis-sub{font-size:11px;color:var(--t2);margin-top:1px;}
.jarvis-orb-wrap{padding:24px 0 16px;display:flex;flex-direction:column;align-items:center;gap:14px;background:linear-gradient(to bottom,rgba(212,168,71,.05),transparent);}
.jarvis-orb-outer{position:relative;width:90px;height:90px;display:flex;align-items:center;justify-content:center;}
.jarvis-ring{position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(212,168,71,.4);animation:pulse 2.5s ease-in-out infinite;}
.jarvis-ring-2{position:absolute;inset:-12px;border-radius:50%;border:1px solid rgba(212,168,71,.15);animation:pulse 2.5s ease-in-out infinite;animation-delay:.4s;}
.jarvis-ring-speaking{animation:ringExp 1s ease-out infinite;}
.jarvis-ring-2-speaking{animation:ringExp 1s ease-out infinite;animation-delay:.3s;}
.jarvis-ring-listen{border-color:rgba(34,197,94,.5);animation:pulse .8s ease-in-out infinite;}
.jarvis-orb{width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,rgba(28,38,60,.9),rgba(8,14,26,.9));border:2px solid rgba(212,168,71,.35);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;position:relative;z-index:2;}
.jarvis-orb:hover{border-color:var(--gold);box-shadow:0 0 0 8px rgba(212,168,71,.1),0 0 20px rgba(212,168,71,.2);}
.jarvis-orb.listening{border-color:var(--grn);box-shadow:0 0 0 6px rgba(34,197,94,.15);}
.jarvis-orb.speaking{border-color:var(--gold2);box-shadow:0 0 24px rgba(212,168,71,.4),0 0 0 10px rgba(212,168,71,.1);}
.jarvis-orb.thinking{border-color:var(--amber);}
.jarvis-status{font-size:11px;color:var(--t3);letter-spacing:.5px;text-transform:uppercase;font-family:var(--mono);}
.jarvis-transcript{font-size:12px;color:var(--t2);font-style:italic;padding:0 20px;text-align:center;}
.jarvis-log{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:8px;min-height:120px;max-height:220px;}
.jarvis-bubble{padding:9px 13px;border-radius:12px;font-size:13px;line-height:1.5;max-width:88%;}
.jarvis-bubble-user{align-self:flex-end;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.25);color:var(--t1);}
.jarvis-bubble-jarvis{align-self:flex-start;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:var(--t1);}
.jarvis-bubble-meta{font-size:10px;color:var(--t3);margin-top:3px;font-family:var(--mono);}
.jarvis-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;opacity:.3;}
.jarvis-footer{padding:12px 14px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:8px;}
.jarvis-clear{font-size:10px;color:var(--t3);background:none;border:none;cursor:pointer;padding:4px 8px;font-family:var(--font);}
.jarvis-clear:hover{color:var(--t2);}

/* ── Intel ── */
.intel-body{display:grid;grid-template-columns:200px 1fr 320px;gap:14px;height:calc(100vh - 260px);min-height:0;}
.intel-col{display:flex;flex-direction:column;overflow:hidden;border-radius:12px;border:1px solid rgba(212,168,71,.15);background:rgba(8,14,26,.7);backdrop-filter:blur(16px);}
.intel-col-head{padding:10px 14px;border-bottom:1px solid rgba(212,168,71,.12);font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:.6px;background:linear-gradient(90deg,rgba(212,168,71,.07),transparent);flex-shrink:0;}
.intel-col-scroll{flex:1;overflow-y:auto;padding:10px;}
.intel-log-line{font-size:10px;color:var(--t3);padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04);line-height:1.5;font-family:var(--mono);}
.intel-log-line::before{content:'> ';color:var(--gold);}
.intel-history-item{font-size:11px;color:var(--t2);padding:5px 6px;border-radius:5px;cursor:pointer;transition:.15s;line-height:1.4;word-break:break-word;font-family:var(--mono);}
.intel-history-item:hover{background:rgba(255,255,255,.05);color:var(--t1);}
.intel-card{border:1px solid rgba(212,168,71,.15);border-radius:12px;background:rgba(8,14,26,.7);backdrop-filter:blur(16px);overflow:hidden;margin-bottom:12px;animation:slideUp .3s ease;}
.intel-card-head{padding:10px 14px;border-bottom:1px solid rgba(212,168,71,.1);font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:.5px;background:linear-gradient(90deg,rgba(212,168,71,.07),transparent);display:flex;align-items:center;gap:6px;}
.intel-card-body{padding:16px;}
.intel-analysis{font-size:13px;line-height:1.8;color:var(--t1);}
.intel-sources{display:flex;flex-wrap:wrap;gap:5px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06);}
.intel-source-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid rgba(255,255,255,.08);border-radius:4px;font-size:10px;color:var(--t2);text-decoration:none;transition:.15s;font-family:var(--mono);}
.intel-source-chip:hover{border-color:var(--gold);color:var(--gold2);}
.intel-img-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.intel-img-tile{border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.07);cursor:pointer;transition:.2s;aspect-ratio:4/3;}
.intel-img-tile:hover{border-color:var(--gold);transform:scale(1.02);}
.intel-img-tile img{width:100%;height:100%;object-fit:cover;display:block;}
.intel-quickbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;}
.intel-quickbtn{padding:5px 12px;border-radius:8px;cursor:pointer;font-size:11px;font-family:var(--mono);background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:var(--t2);transition:.15s;white-space:nowrap;}
.intel-quickbtn:hover{border-color:var(--gold);color:var(--gold2);}

/* ── Chat ── */
.chat-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px;}
.chat-bubble{padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.6;max-width:72%;}
.chat-bubble-user{align-self:flex-end;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.25);color:var(--t1);}
.chat-bubble-ai{align-self:flex-start;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:var(--t1);}
.chat-meta{font-size:10px;color:var(--t3);margin-top:4px;font-family:var(--mono);}
.chat-input-row{padding:14px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:8px;background:rgba(8,14,26,.6);backdrop-filter:blur(12px);}

/* ── Sidebar labels ── */
.sidebar-label{font-size:10px;font-weight:700;color:var(--gold3);text-transform:uppercase;letter-spacing:1px;padding:12px 12px 4px;}
.topbar{position:relative;}

/* ── Thinking dots ── */
@keyframes thinkDot{0%,80%,100%{transform:scale(.6);opacity:.4;}40%{transform:scale(1);opacity:1;}}
.think-dot{width:6px;height:6px;border-radius:50%;background:var(--acc);display:inline-block;}
`;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function uid(): string { return Math.random().toString(36).slice(2); }

// getTimeOfDay is already defined above in the Voice Module (returns "morning"/"afternoon" etc.)
// This local helper returns a greeting-prefixed string for UI display
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

function initials(name: string): string {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

const STATUS_COLOR: Record<string, string> = {
  completed:   "badge-green",
  in_progress: "badge-acc",
  pending:     "badge-amber",
  rework:      "badge-orange",
  approved:    "badge-sky",
};

const PRIORITY_COLOR: Record<string, string> = {
  high:   "badge-red",
  medium: "badge-amber",
  low:    "badge-gray",
};

const ROLE_COLOR: Record<string, string> = {
  supremo:    "badge-purple",
  superadmin: "badge-acc",
  admin:      "badge-sky",
  staff:      "badge-green",
};

const AV_COLORS = ["av-acc","av-grn","av-red"];

// ─────────────────────────────────────────────────────────────────────────────
// CHART TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────

const ChartTip = ({ active, payload, label }: ChartTipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"var(--srf2)", border:"1px solid var(--bdr)", borderRadius:8, padding:"10px 14px", fontFamily:"var(--font)", fontSize:12 }}>
      {label && <div style={{ color:"var(--t2)", marginBottom:6, fontWeight:600 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color:p.color, display:"flex", justifyContent:"space-between", gap:16 }}>
          <span>{p.name}</span><strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CIRCULAR GAUGE
// ─────────────────────────────────────────────────────────────────────────────

interface GaugeProps { value: number; label: string; color?: string; size?: number; }

function CircularGauge({ value, label, color = "var(--acc)", size = 80 }: GaugeProps) {
  const r   = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--srf2)" strokeWidth={8} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition:"stroke-dasharray .8s ease" }}
        />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          style={{ fill:"var(--t1)", fontSize: size * 0.22, fontWeight:700, fontFamily:"var(--font)", transform:"rotate(90deg)", transformOrigin:`${size/2}px ${size/2}px` }}>
          {value}%
        </text>
      </svg>
      <span style={{ fontSize:11, color:"var(--t2)", textAlign:"center" }}>{label}</span>
    </div>
  );
}



interface StatCardProps {
  icon: string; label: string; value: string | number;
  sub?: string; accent?: string; trend?: "up"|"down"|"neutral"; onClick?: () => void;
}

function StatCard({ icon, label, value, sub, accent = "var(--acc)", trend, onClick }: StatCardProps) {
  return (
    <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
        <div style={{ width:42, height:42, borderRadius:10, background:`linear-gradient(135deg,${accent}28,${accent}10)`, border:`1px solid ${accent}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{icon}</div>
        {trend && (
          <span style={{ fontSize:11, color: trend==="up"?"var(--grn)":trend==="down"?"var(--red)":"var(--t3)", fontWeight:500 }}>
            {trend==="up"?"↑":trend==="down"?"↓":"—"}
          </span>
        )}
      </div>
      <div style={{ fontSize:28, fontWeight:700, color:"var(--gold2)", lineHeight:1, marginBottom:6, fontFamily:"var(--mono)" }}>{value}</div>
      <div style={{ fontSize:13, fontWeight:500, color:"var(--t1)" }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:"var(--t3)", marginTop:3 }}>{sub}</div>}
      {onClick && <div style={{ fontSize:10, color:"var(--gold3)", marginTop:6, letterSpacing:.5 }}>CLICK TO VIEW →</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK FORM
// ─────────────────────────────────────────────────────────────────────────────

interface TaskFormProps { users: any[]; onAssign: (t: any) => void; onCancel: () => void; }

function TaskForm({ users, onAssign, onCancel }: TaskFormProps) {
  const [form, setForm] = useState({ title:"", description:"", priority:"medium", dueDate:"", assignedTo:"", project:"General" });
  const staff = users.filter((u:any) => u.isDoer || u.role === "staff");
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function submit() {
    if (!form.title || !form.assignedTo || !form.dueDate) return;
    onAssign({ ...form, status:"pending" });
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div>
        <label style={{ fontSize:12, color:"var(--t2)", marginBottom:4, display:"block" }}>Task Title *</label>
        <input className="input" placeholder="Enter task title" value={form.title} onChange={e => set("title", e.target.value)} />
      </div>
      <div>
        <label style={{ fontSize:12, color:"var(--t2)", marginBottom:4, display:"block" }}>Description</label>
        <textarea className="input" rows={2} placeholder="Optional description" value={form.description} onChange={e => set("description", e.target.value)} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div>
          <label style={{ fontSize:12, color:"var(--t2)", marginBottom:4, display:"block" }}>Assign To *</label>
          <select className="input" value={form.assignedTo} onChange={e => set("assignedTo", e.target.value)}>
            <option value="">Select member</option>
            {staff.map(u => <option key={u.id} value={u.email}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:12, color:"var(--t2)", marginBottom:4, display:"block" }}>Priority</label>
          <select className="input" value={form.priority} onChange={e => set("priority", e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div>
          <label style={{ fontSize:12, color:"var(--t2)", marginBottom:4, display:"block" }}>Due Date *</label>
          <input className="input" type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize:12, color:"var(--t2)", marginBottom:4, display:"block" }}>Project</label>
          <input className="input" placeholder="Project name" value={form.project} onChange={e => set("project", e.target.value)} />
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:4 }}>
        <button className="btn btn-primary" style={{ flex:1 }} onClick={submit}>Assign Task</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JARVIS ASSISTANT (floating)
// ─────────────────────────────────────────────────────────────────────────────

interface JarvisProps {
  tasks: MockTask[];
  users: MockUser[];
  userName: string;
  userRole: string;
}

function JarvisAssistant({ tasks, users, userName, userRole }: JarvisProps) {
  const [open,          setOpen]          = useState(false);
  const [jarvisState,   setJarvisState]   = useState<JarvisState>("idle");
  const [messages,      setMessages]      = useState<JarvisMsg[]>([]);
  const [statusText,    setStatusText]    = useState('Say "Hey Cue" or press the orb');
  const [wakeActive,    setWakeActive]    = useState(false);
  const [transcript,    setTranscript]    = useState("");
  const [inputText,     setInputText]     = useState("");

  const stopListenerRef = useRef<(() => void) | null>(null);
  const scrollRef       = useRef<HTMLDivElement>(null);
  const isSpeakingRef   = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior:"smooth" });
  }, [messages]);

  useEffect(() => () => { stopListenerRef.current?.(); }, []);

  function buildCtx() {
    return {
      userName,
      userRole,
      tasks: tasks.map(t => ({ title:t.title, status:t.status, priority:t.priority, assignedTo:t.assignedTo, dueDate:t.dueDate })),
      projects: ["General","Website Redesign","Marketing","Product Launch"],
      teamMembers: users.map(u => ({ name:u.name, role:u.role, email:u.email })),
    };
  }

  async function handleTranscript(text: string) {
    setTranscript(text);
    setMessages(prev => [...prev, { id:uid(), role:"user", text, timestamp:new Date() }]);
    setJarvisState("thinking");
    setStatusText("Processing…");

    const reply = await processJarvisCommand(text, buildCtx());
    setMessages(prev => [...prev, { id:uid(), role:"jarvis", text:reply, timestamp:new Date() }]);

    setJarvisState("speaking");
    setStatusText("Speaking…");
    isSpeakingRef.current = true;
    await speakText(reply);
    isSpeakingRef.current = false;

    setJarvisState("idle");
    setStatusText(wakeActive ? 'Listening for "Hey Cue"…' : 'Say "Hey Cue" or press the orb');
    setTranscript("");
  }

  async function handleOrbPress() {
    if (jarvisState !== "idle") return;
    setJarvisState("listening");
    setStatusText("Listening…");
    try {
      const r = await listenOnce(8000);
      if (isSpeakingRef.current) return; // discard self-heard
      await handleTranscript(r.transcript);
    } catch {
      setStatusText("Couldn't hear you. Try again.");
      setJarvisState("error");
      setTimeout(() => { setJarvisState("idle"); setStatusText('Say "Hey Cue" or press the orb'); }, 2500);
    }
  }

  function toggleWake() {
    if (wakeActive) {
      stopListenerRef.current?.();
      stopListenerRef.current = null;
      setWakeActive(false);
      setStatusText('Say "Hey Cue" or press the orb');
    } else {
      setWakeActive(true);
      setStatusText('Listening for "Hey Cue"…');
      const stop = startContinuousListener({
        wakeWord: "hey cue",
        onWake: () => { setJarvisState("listening"); setStatusText("Speak your command…"); speakText("Yes?").catch(() => {}); },
        onTranscript: (t) => { if (!isSpeakingRef.current) handleTranscript(t); },
        onError: (e) => console.warn("[Jarvis]", e.message),
      });
      stopListenerRef.current = stop;
    }
  }

  async function handleTextSend() {
    const text = inputText.trim();
    if (!text || jarvisState !== "idle") return;
    setInputText("");
    await handleTranscript(text);
  }

  const orbClass = ["jarvis-orb", jarvisState === "listening" ? "listening" : jarvisState === "speaking" ? "speaking" : jarvisState === "thinking" ? "thinking" : ""].join(" ").trim();
  const ringSpeaking = jarvisState === "speaking";
  const ringListen   = jarvisState === "listening";

  const OrbIcon = () => {
    if (jarvisState === "listening") return (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--grn)" strokeWidth="1.8" width="24" height="24">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    );
    if (jarvisState === "thinking") return (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.8" width="24" height="24" style={{ animation:"spin 1.2s linear infinite" }}>
        <circle cx="12" cy="12" r="10" strokeDasharray="30 10"/>
      </svg>
    );
    if (jarvisState === "speaking") return (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc2)" strokeWidth="1.8" width="24" height="24">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      </svg>
    );
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc2)" strokeWidth="1.8" width="24" height="24">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
      </svg>
    );
  };

  return (
    <>
      {/* FAB */}
      <button className="jarvis-fab" onClick={() => setOpen(o => !o)} title="J.A.R.V.I.S">
        {open
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M18 6L6 18M6 6l12 12"/></svg>
          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        }
        {wakeActive && <span className="jarvis-wake-dot" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="jarvis-panel">
          {/* Header */}
          <div className="jarvis-header">
            <div>
              <div className="jarvis-title">J.A.R.V.I.S</div>
              <div className="jarvis-sub">SmartCue Voice Intelligence</div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button
                onClick={toggleWake}
                className={`btn btn-xs ${wakeActive ? "btn-success" : "btn-ghost"}`}
                title={wakeActive ? "Disable wake word" : "Enable 'Hey Cue'"}
              >
                {wakeActive ? "⬤ LIVE" : "WAKE"}
              </button>
              <button className="btn btn-ghost btn-xs" onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>

          {/* Orb area */}
          <div className="jarvis-orb-wrap">
            <div className="jarvis-orb-outer">
              <div className={`jarvis-ring ${ringSpeaking ? "jarvis-ring-speaking" : ringListen ? "jarvis-ring-listen" : ""}`} />
              <div className={`jarvis-ring-2 ${ringSpeaking ? "jarvis-ring-2-speaking" : ""}`} />
              <button className={orbClass} onClick={handleOrbPress} title="Press to speak">
                <OrbIcon />
              </button>
            </div>
            <div className="jarvis-status">{statusText}</div>
            {transcript && <div className="jarvis-transcript">"{transcript}"</div>}
          </div>

          {/* Message log */}
          <div ref={scrollRef} className="jarvis-log">
            {messages.length === 0 && (
              <div className="jarvis-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="36" height="36"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3"/></svg>
                <span style={{ fontSize:11, fontFamily:"var(--mono)" }}>No conversation yet</span>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} style={{ display:"flex", flexDirection:"column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ fontSize:9, color:"var(--t3)", marginBottom:3, fontFamily:"var(--mono)", textTransform:"uppercase", letterSpacing:.5 }}>
                  {msg.role === "user" ? userName.split(" ")[0] : "Jarvis"}
                </div>
                <div className={`jarvis-bubble jarvis-bubble-${msg.role}`}>{msg.text}</div>
                <div className="jarvis-bubble-meta">{msg.timestamp.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="jarvis-footer" style={{ flexDirection:"column", gap:6 }}>
            <div style={{ display:"flex", gap:6 }}>
              <input
                className="input"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleTextSend(); }}
                placeholder="Type a command…"
              />
              <button className="btn btn-primary btn-sm" onClick={handleTextSend} style={{ flexShrink:0, padding:"7px 12px" }}>
                →
              </button>
            </div>
            {messages.length > 0 && (
              <button className="jarvis-clear" onClick={() => setMessages([])}>Clear conversation</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export default function SupremoDashboard() {
  const { user: appUser, logout } = useUser();
  const [activeTab,       setActiveTab]       = useState("overview");
  const [sidebarOpen,     setSidebarOpen]     = useState(true);
  const [tasks,           setTasks]           = useState<MockTask[]>(INIT_TASKS);
  const [selectedUser,    setSelectedUser]    = useState<any>(null);
  const [showTaskForm,    setShowTaskForm]    = useState(false);
  const [showLogout,      setShowLogout]      = useState(false);
  const [voiceEnabled,    setVoiceEnabled]    = useState(true);
  const [ticker,          setTicker]          = useState(0);
  const [aiMessages,      setAiMessages]      = useState<AiMessage[]>([]);
  const [aiInput,         setAiInput]         = useState("");
  const [aiTyping,        setAiTyping]        = useState(false);
  const [isSpeaking,      setIsSpeaking]      = useState(false);
  const [isListening,     setIsListening]     = useState(false);
  const [continuousMode,  setContinuousMode]  = useState(false);
  const [stopRequested,   setStopRequested]   = useState(false);
  const [autoReport,      setAutoReport]      = useState(false);
  const [bgVideo,         setBgVideo]         = useState<string | null>(null);
  const bgVideoInputRef = useRef<HTMLInputElement>(null);
  const [taskFilter,      setTaskFilter]       = useState<string | null>(null);

  // Live MongoDB data
  const [liveTasks,       setLiveTasks]       = useState<LiveTask[]>([]);
  const [liveUsers,       setLiveUsers]       = useState<any[]>([]);
  const [liveLoading,     setLiveLoading]     = useState(true);
  const [activities,      setActivities]      = useState<Activity[]>([]);
  const [pulseTicks,      setPulseTicks]      = useState<PulseTick[]>([]);
  const [lastRefresh,     setLastRefresh]     = useState<Date>(new Date());
  const [selectedTask,    setSelectedTask]    = useState<LiveTask | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Intelligence
  const [intelQuery,      setIntelQuery]      = useState("");
  const [intelLoading,    setIntelLoading]    = useState(false);
  const [intelResults,    setIntelResults]    = useState<any[]>([]);
  const [intelLog,        setIntelLog]        = useState<string[]>([]);
  const [intelHistory,    setIntelHistory]    = useState<string[]>([]);
  const [intelMicActive,  setIntelMicActive]  = useState(false);

  const chatEndRef       = useRef<HTMLDivElement>(null);
  const recRef           = useRef<any>(null);
  const isSpeakRef       = useRef(false);
  const stopRef          = useRef(false);
  const autoReportRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const contStopRef      = useRef<(() => void) | null>(null);

  useEffect(() => { setElevenLabsVoice("ThT5KcBeYPX3keUQqHPh"); }, []);

  // ── Live data fetch ───────────────────────────────────────────────────────
  const fetchLiveData = useCallback(async () => {
    try {
      const [tasksRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/api/tasks`),
        fetch(`${API_BASE}/api/users`).catch(() => null),
      ]);
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        const arr: any[] = Array.isArray(data) ? data : (data as any).tasks || [];
        const now = new Date();
        const mapped = arr.map((t: any) => ({
          ...t,
          _id: t._id || t.id,
          tatBreached: t.tatBreached ?? (
            t.status !== "completed" && t.status !== "approved" &&
            t.exactDeadline && new Date(t.exactDeadline) < now
          ),
          progress: t.progress ?? (
            t.status === "approved" ? 100 :
            t.status === "completed" ? 100 :
            t.status === "in_progress" ? 60 :
            t.status === "rework" ? 30 : 10
          ),
          assignedToName: t.assignedToName ||
            (t.assignedTo ? t.assignedTo.split("@")[0].replace(/\./g," ").replace(/\b\w/g,(c:string)=>c.toUpperCase()) : ""),
        }));
        setLiveTasks(mapped);
        const tick: PulseTick = {
          time: new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
          completed: mapped.filter((t:any) => t.status==="completed"||t.status==="approved").length,
          inProgress: mapped.filter((t:any) => t.status==="in_progress").length,
          pending: mapped.filter((t:any) => t.status==="pending").length,
          breached: mapped.filter((t:any) => t.tatBreached).length,
        };
        setPulseTicks(prev => [...prev.slice(-19), tick]);
      }
      if (usersRes?.ok) {
        const ud = await usersRes.json();
        const ua: any[] = Array.isArray(ud) ? ud : ud.users || [];
        if (ua.length > 0) setLiveUsers(ua);
      }
    } catch(e) { console.warn("[SupremoDashboard] fetchLiveData error", e); }
    finally { setLiveLoading(false); setLastRefresh(new Date()); }
  }, []);

  useEffect(() => {
    fetchLiveData();
    pollRef.current = setInterval(fetchLiveData, 30_000); // poll every 30s
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Greeting on mount
  useEffect(() => {
    const name = currentUserName.split(" ")[0];
    const msg  = `${getGreeting()}, ${name}. SmartCue is online and ready.`;
    setAiMessages([{ id: Date.now(), role:"assistant", text:msg, timestamp:new Date() }]);
    setTimeout(() => { try { greetUser(name); } catch(_){} }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick for clock
  useEffect(() => {
    const t = setInterval(() => setTicker(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  void ticker;

  // Init speech rec
  useEffect(() => {
    const W  = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) return;
    const rec      = new SR();
    rec.continuous = false;
    rec.lang       = "en-IN";
    rec.onstart    = () => setIsListening(true);
    rec.onresult   = (e: any) => {
      const t = e.results[0][0].transcript;
      setIsListening(false);
      if (isSpeakRef.current) return;
      setAiInput(t);
      setTimeout(() => sendAiMessage(t), 80);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend   = () => setIsListening(false);
    recRef.current = rec;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-scroll chat ──────────────────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [aiMessages]);

  // ── Auto-report interval ──────────────────────────────────────────────────
  useEffect(() => {
    if (!autoReport || !voiceEnabled) { if (autoReportRef.current) { clearInterval(autoReportRef.current); autoReportRef.current = null; } return; }
    autoReportRef.current = setInterval(async () => {
      const b    = activeTasks.filter(t => t.tatBreached).length;
      const ip   = activeTasks.filter(t => t.status === "in_progress").length;
      const brief = `Auto-briefing: ${activeTasks.length} total tasks. ${ip} in progress. ${b} TAT ${b === 1 ? "breach" : "breaches"}.`;
      setAiMessages(prev => [...prev, { id:Date.now(), role:"assistant", text:`⏱ ${brief}`, timestamp:new Date() }]);
      if (!isSpeakRef.current) { isSpeakRef.current = true; await speakText(brief); isSpeakRef.current = false; }
    }, 4 * 60 * 60 * 1000); // every 4 hours
    return () => { if (autoReportRef.current) clearInterval(autoReportRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReport, voiceEnabled, tasks]);

  // ── Continuous JARVIS mode ────────────────────────────────────────────────
  useEffect(() => {
    if (!continuousMode) { contStopRef.current?.(); contStopRef.current = null; return; }
    const stop = startContinuousListener({
      wakeWord: "hey cue",
      onWake: () => { speakText("Listening.").catch(()=>{}); },
      onTranscript: (t: string) => {
        const lower = t.toLowerCase();
        if (["stop","be quiet","cancel","enough","silence"].some(w => lower.includes(w))) {
          stopRef.current = true; setStopRequested(true);
          setTimeout(() => { stopRef.current = false; setStopRequested(false); }, 3000);
          return;
        }
        if (!isSpeakRef.current) sendAiMessage(t);
      },
      onError: (e: Error) => console.warn("[ContinuousMode]", e.message),
    });
    contStopRef.current = stop;
    return () => { stop(); contStopRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuousMode]);

  // ── AI send ──────────────────────────────────────────────────────────────

  const sendAiMessage = useCallback(async (override?: string) => {
    const text = (override ?? aiInput).trim();
    if (!text) return;

    // STOP command — kill any active TTS
    const lower = text.toLowerCase();
    if (["stop","be quiet","cancel","silence","enough"].some(w => lower.includes(w))) {
      stopRef.current = true; setStopRequested(true);
      const silentMsg = "Understood. Standing by.";
      setAiMessages(prev => [...prev, { id:Date.now(), role:"assistant", text:silentMsg, timestamp:new Date() }]);
      setTimeout(() => { stopRef.current = false; setStopRequested(false); }, 2000);
      return;
    }

    // Intel routing — detect research/intelligence queries
    const intelTriggers = ["who is","what is","tell me about","research","find out","look up","search for","what are","history of","biography","explain"];
    const isIntelQuery  = intelTriggers.some(t => lower.startsWith(t)) && text.split(" ").length > 3;
    if (isIntelQuery) {
      setActiveTab("intel");
      const q = text.replace(/^(who is|what is|tell me about|research|find out|look up|search for|explain)\s+/i,"");
      setIntelQuery(q);
      setTimeout(() => handleIntelSearch(q), 200);
      setAiMessages(prev => [...prev, { id:Date.now(), role:"user", text, timestamp:new Date() }, { id:Date.now()+1, role:"assistant", text:`Routing to Intelligence Engine for: "${q}"`, timestamp:new Date() }]);
      return;
    }

    setAiInput("");
    setAiMessages(prev => [...prev, { id:Date.now(), role:"user", text, timestamp:new Date() }]);
    setAiTyping(true);

    const sys = `You are SmartCue, an elite AI assistant for Roswalt Realty's Supremo dashboard.
Current status: ${activeTasks.length} tasks | ${activeTasks.filter(t=>t.tatBreached).length} TAT breaches | ${activeTasks.filter(t=>t.status==="in_progress").length} in progress | Team: ${allUsers.length}
Be concise (max 120 words). Speak professionally like a command-center AI.`;

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:400, system:sys, messages:[{ role:"user", content:text }] })
      });
      const data  = await res.json();
      const reply = data.content?.[0]?.text ?? "Unable to process. Please retry.";
      setAiTyping(false);
      setAiMessages(prev => [...prev, { id:Date.now(), role:"assistant", text:reply, timestamp:new Date() }]);
      if (voiceEnabled && !isSpeakRef.current && !stopRef.current) {
        isSpeakRef.current = true; setIsSpeaking(true);
        await speakText(reply);
        isSpeakRef.current = false; setIsSpeaking(false);
      }
    } catch {
      setAiTyping(false);
      setAiMessages(prev => [...prev, { id:Date.now(), role:"assistant", text:"Network error. Please retry.", timestamp:new Date() }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiInput, tasks, voiceEnabled]);

  function toggleMic() {
    if (!recRef.current) return;
    if (isListening) recRef.current.stop();
    else { try { recRef.current.start(); } catch(_){} }
  }

  // ── Intelligence ─────────────────────────────────────────────────────────

  function extractJSON(text: string): any | null {
    try { return JSON.parse(text.replace(/```(?:json)?[\s\S]*?```/g,"").trim()); } catch {}
    const m1 = text.match(/\{[\s\S]*\}/); if (m1) { try { return JSON.parse(m1[0]); } catch {} }
    const m2 = text.match(/\[[\s\S]*\]/); if (m2) { try { return JSON.parse(m2[0]); } catch {} }
    return null;
  }

  async function callClaude(system: string, userMsg: string, maxTokens = 1200): Promise<string> {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:maxTokens, system, messages:[{role:"user",content:userMsg}] })
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const d = await res.json();
    return d.content?.[0]?.text ?? "";
  }

  async function handleIntelSearch(q: string = intelQuery) {
    const query = q.trim(); if (!query) return;
    setIntelQuery(query);
    setIntelLoading(true); setIntelResults([]); setIntelLog([]);
    setIntelHistory(h => [query, ...h.filter(x => x !== query)].slice(0, 10));
    const ts = () => new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    const log = (m: string) => setIntelLog(l => [...l, `[${ts()}] ${m}`]);

    try {
      log("Classifying query…");
      const lower = query.toLowerCase();
      const isPerson = /who is|biography|profile|founder|ceo|president|politician|actor/.test(lower);
      const isPlace  = /city|country|where is|mumbai|delhi|dubai|london/.test(lower) && !isPerson;
      const isMarket = /market|trend|price|real estate|investment|roi|analysis/.test(lower);

      const searchResults: { source:string; url:string; text:string }[] = [];

      // Wikipedia
      log("Searching Wikipedia…");
      const wikiTerms = [query];
      for (const term of wikiTerms) {
        try {
          const slug = encodeURIComponent(term.replace(/\s+/g,"_"));
          const res  = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`);
          if (res.ok) {
            const d = await res.json();
            if (d.extract?.length > 60) { searchResults.push({ source:`Wikipedia — ${d.title}`, url:d.content_urls?.desktop?.page||"#", text:d.extract }); log(`Wikipedia: "${d.title}"`); break; }
          }
        } catch {}
      }
      if (searchResults.length === 0) {
        try {
          const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`);
          const d   = await res.json();
          const hit = d.query?.search?.[0];
          if (hit) {
            const slug = encodeURIComponent(hit.title.replace(/\s+/g,"_"));
            const r2   = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`);
            if (r2.ok) { const d2 = await r2.json(); if (d2.extract) { searchResults.push({ source:`Wikipedia — ${d2.title}`, url:d2.content_urls?.desktop?.page||"#", text:d2.extract }); } }
          }
        } catch {}
      }

      // DuckDuckGo
      try {
        const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
        const d   = await res.json();
        if (d.AbstractText?.length > 60) searchResults.push({ source:d.AbstractSource||"DuckDuckGo", url:d.AbstractURL||"#", text:d.AbstractText });
      } catch {}

      if (searchResults.length < 2) {
        log("Supplementing with AI knowledge base…");
        const kb = await callClaude("Output 3-4 factual paragraphs about the topic. Plain text, no markdown.", `Research: ${query}`, 600);
        if (kb.length > 100) searchResults.push({ source:"AI Knowledge Base", url:"#", text:kb });
      }

      log(`${searchResults.length} sources acquired. Synthesising…`);
      const ctx = searchResults.map((r,i) => `[SOURCE ${i+1} — ${r.source}]\n${r.text}`).join("\n\n---\n\n");
      const sysPrompt = isPerson
        ? "Write a sharp biographical profile with sections: ▸ WHO THEY ARE, ▸ BACKGROUND & RISE, ▸ KEY ACHIEVEMENTS, ▸ CURRENT STATUS. Facts only. 300 words max."
        : isPlace
        ? "Write a location brief with sections: ▸ OVERVIEW, ▸ KEY FACTS, ▸ STRATEGIC SIGNIFICANCE. Facts only. 280 words max."
        : "Write an executive intelligence briefing with ▸ section headers. Be data-driven. End with KEY TAKEAWAYS. 320 words max.";

      const analysis = await callClaude(sysPrompt, `Query: "${query}"\n\nSources:\n${ctx}`, 1600);
      log("Briefing complete ✓");

      setIntelResults([{ kind:"analysis", text:analysis, sources:searchResults, queryType: isPerson?"person":isPlace?"place":isMarket?"market":"concept" }]);

      // Charts for market
      if (isMarket) {
        log("Building data visualisations…");
        try {
          const raw = await callClaude(
            'Output ONLY raw JSON for a line chart. No markdown. Start with {. Format: {"labels":["A","B","C","D","E"],"datasets":[{"label":"Series","data":[1,2,3,4,5],"color":"#6366f1"}]}',
            `Chart: yearly growth trend for "${query}" topic. Use realistic numbers. JSON only.`, 400
          );
          const chartData = extractJSON(raw);
          if (chartData) setIntelResults(prev => [...prev, { kind:"chart", type:"line", title:`${query} — Trend Analysis`, data:chartData }]);
        } catch {}
      }

      // Images
      log("Fetching images…");
      const imageUrls: {url:string;thumb:string;desc:string}[] = [];
      if (!isMarket) {
        for (const slug of [query, ...searchResults.map(s=>s.source.replace("Wikipedia — ",""))].slice(0,3)) {
          try {
            const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(slug)}&prop=pageimages&format=json&pithumbsize=800&pilimit=2&origin=*`);
            const d   = await res.json();
            Object.values(d.query?.pages||{}).forEach((pg:any) => { if (pg.thumbnail?.source) imageUrls.push({ url:pg.thumbnail.source.replace(/\/\d+px-/,"/800px-"), thumb:pg.thumbnail.source, desc:pg.title||slug }); });
          } catch {}
          if (imageUrls.length >= 2) break;
        }
        const seed = query.replace(/\s+/g,",").toLowerCase();
        for (let i = imageUrls.length; i < 4; i++) {
          imageUrls.push({ url:`https://loremflickr.com/800/500/${encodeURIComponent(seed)}?lock=${i*41+7}`, thumb:`https://loremflickr.com/400/260/${encodeURIComponent(seed)}?lock=${i*41+7}`, desc:`${query} visual ${i+1}` });
        }
        if (imageUrls.length) setIntelResults(prev => [...prev, { kind:"images", images:imageUrls.slice(0,4), label:query }]);
      }

      // YouTube
      const ytTerm = isPerson ? `${query} interview biography` : isPlace ? `${query} travel guide` : `${query} explained 2025`;
      setIntelResults(prev => [...prev, { kind:"youtube", query:ytTerm, variants:[
        { label:"Overview & Explainer",  suffix:" explained" },
        { label:"Analysis & Insights",   suffix:" analysis 2025" },
        { label:"Latest News",           suffix:" 2025 news" },
      ]}]);
      log("Research complete ✓");

    } catch(err:any) {
      log(`Error: ${err?.message||"Unknown"}`);
      setIntelResults(prev => prev.length ? prev : [{ kind:"analysis", text:`Research error: ${err?.message||"Unknown"}. Please check your connection.`, sources:[], queryType:"concept" }]);
    } finally { setIntelLoading(false); }
  }

  function toggleIntelMic() {
    const W  = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) return;
    if (intelMicActive) { setIntelMicActive(false); return; }
    const rec = new SR();
    rec.continuous = false; rec.lang = "en-US";
    setIntelMicActive(true); setIntelQuery("");
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r:any) => r[0].transcript).join("");
      setIntelQuery(t);
      if (e.results[e.results.length-1].isFinal) { setIntelMicActive(false); setTimeout(() => handleIntelSearch(t), 300); }
    };
    rec.onerror = rec.onend = () => setIntelMicActive(false);
    rec.start();
  }

  // ── Task Actions ─────────────────────────────────────────────────────────

  function updateTaskStatus(taskId: string, newStatus: string, event: VoiceEvent) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status:newStatus } : t));
    setLiveTasks(prev => prev.map(t => t._id === taskId ? { ...t, status:newStatus } : t));
    // Also push to backend
    fetch(`${API_BASE}/api/tasks/${taskId}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
    fireVoiceEvent(event, voiceEnabled);
  }

  function deleteTask(taskId: string) {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setLiveTasks(prev => prev.filter(t => t._id !== taskId));
    fetch(`${API_BASE}/api/tasks/${taskId}`, { method:"DELETE" }).catch(() => {});
    fireVoiceEvent("task_deleted", voiceEnabled);
  }

  // ── Use live tasks when available, fall back to mock ─────────────────────
  // ── Use live data when available ─────────────────────────────────────────
  const allUsers = liveUsers.length > 0
    ? liveUsers.map((u: any) => ({
        id: u._id || u.id || u.email,
        name: u.name || u.email?.split("@")[0] || "Unknown",
        email: u.email || "",
        role: u.role || "staff",
        isDoer: u.isDoer ?? (u.role === "staff"),
      }))
    : MOCK_USERS;

  const currentUserName = appUser?.name || appUser?.email?.split("@")[0] || "Pushkaraj";
  const currentUserInitials = initials(currentUserName);

  const activeTasks = liveTasks.length > 0
    ? liveTasks.map(t => ({
        id: t._id, title: t.title, status: t.status, priority: t.priority,
        progress: t.progress || 0, assignedTo: t.assignedTo,
        dueDate: t.dueDate, tatBreached: t.tatBreached,
        project: t.project, description: t.description,
      }))
    : tasks;

  // ── Derived stats ─────────────────────────────────────────────────────────
  const breached   = activeTasks.filter(t => t.tatBreached).length;
  const inProgress = activeTasks.filter(t => t.status === "in_progress").length;
  const completed  = activeTasks.filter(t => t.status === "completed" || t.status === "approved").length;
  const pending    = activeTasks.filter(t => t.status === "pending").length;
  const efficiency = activeTasks.length ? Math.round((completed / activeTasks.length) * 100) : 0;

  const now     = new Date();
  const timeStr = now.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { weekday:"short", day:"2-digit", month:"short", year:"numeric" });

  const NAV_ITEMS = [
    { id:"overview",   label:"Overview",          icon:"⊟" },
    { id:"tasks",      label:"Task Management",   icon:"☑" },
    { id:"analytics",  label:"Live Analytics",    icon:"📈" },
    { id:"activity",   label:"Activity Feed",     icon:"⚡" },
    { id:"team",       label:"Team Members",      icon:"◎" },
    { id:"reports",    label:"Reports",           icon:"◉" },
    { id:"ai",         label:"SmartCue AI",       icon:"⊗" },
    { id:"intel",      label:"Intelligence",      icon:"◭" },
  ];

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* ── Video Background ── */}
      {bgVideo && (
        <video
          key={bgVideo}
          autoPlay loop muted playsInline
          style={{ position:"fixed", inset:0, width:"100%", height:"100%", objectFit:"cover", zIndex:-1, opacity:0.18, filter:"brightness(0.5) saturate(0.8)" }}
        >
          <source src={bgVideo} />
        </video>
      )}
      <input ref={bgVideoInputRef} type="file" accept="video/*" style={{ display:"none" }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) setBgVideo(URL.createObjectURL(f));
        }}
      />

      {/* ────────────────── LAYOUT ────────────────── */}
      <div className={`layout${sidebarOpen ? "" : " sidebar-collapsed"}`}>

        {/* ══ TOPBAR ══ */}
        <header className="topbar">
          <button
            onClick={() => setSidebarOpen(p => !p)}
            style={{ background:"none", border:"none", color:"var(--t2)", cursor:"pointer", padding:"6px 8px", borderRadius:6, display:"flex", alignItems:"center" }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fillRule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" clipRule="evenodd"/></svg>
          </button>

          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,var(--gold3),var(--gold),var(--gold2))", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 0 12px var(--gold-glow)" }}>
              <span style={{ fontFamily:"var(--mono)", fontWeight:700, fontSize:12, color:"#1a1200" }}>SC</span>
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:"var(--gold2)", lineHeight:1 }}>SmartCue</div>
              <div style={{ fontSize:10, color:"var(--t2)" }}>Supremo Dashboard</div>
            </div>
          </div>

          {/* Status chips */}
          <div style={{ display:"flex", gap:8, marginLeft:16 }}>
            <div className="status-row">
              <span className="dot dot-green" />
              <span style={{ fontSize:11, color:"var(--t2)" }}>Systems Online</span>
            </div>
            {breached > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", background:"rgba(244,63,94,.08)", border:"1px solid rgba(244,63,94,.15)", borderRadius:20 }}>
                <span className="dot dot-red" />
                <span style={{ fontSize:11, color:"var(--red)" }}>{breached} TAT Breach{breached > 1 ? "es" : ""}</span>
              </div>
            )}
          </div>

          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:14 }}>
            {/* Clock */}
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"var(--mono)", fontSize:14, fontWeight:600, color:"var(--t1)" }}>{timeStr}</div>
              <div style={{ fontSize:10, color:"var(--t2)" }}>{dateStr}</div>
            </div>

            {/* Voice toggle */}
            <button
              onClick={() => setVoiceEnabled(v => !v)}
              className={`btn btn-sm ${voiceEnabled ? "btn-ghost" : "btn-ghost"}`}
              style={{ borderColor: voiceEnabled ? "var(--gold)" : "var(--bdr)", color: voiceEnabled ? "var(--gold2)" : "var(--t3)" }}
              title={voiceEnabled ? "Voice enabled" : "Voice disabled"}
            >
              {voiceEnabled ? "🔊" : "🔇"}
            </button>

            {/* Background video upload */}
            <button
              onClick={() => bgVideoInputRef.current?.click()}
              className="btn btn-sm btn-ghost"
              style={{ borderColor:"rgba(212,168,71,.3)", color:"var(--gold)", fontSize:12 }}
              title="Upload background video"
            >
              🎬 {bgVideo ? "BG ✓" : "BG"}
            </button>
            {bgVideo && (
              <button onClick={() => setBgVideo(null)} className="btn btn-sm btn-ghost" style={{ color:"var(--t3)", fontSize:11 }} title="Remove background">✕</button>
            )}

            {/* User */}
            <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} onClick={() => setShowLogout(true)}>
              <div className="avatar av-md av-acc" style={{ background:"rgba(99,102,241,.2)" }}>
                {initials(currentUserName)}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:500, color:"var(--t1)", lineHeight:1 }}>{currentUserName.split(" ")[0]}</div>
                <div style={{ fontSize:10, color:"var(--t2)" }}>Supremo</div>
              </div>
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style={{ color:"var(--t3)" }}><path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/></svg>
            </div>
          </div>
        </header>

        {/* ══ SIDEBAR ══ */}
        <aside className="sidebar">
          <div className="sidebar-label">Navigation</div>
          {NAV_ITEMS.map(item => (
            <div
              key={item.id}
              className={`nav-item${activeTab === item.id ? " active" : ""}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}

          <div style={{ flex:1 }} />

          {/* Jarvis mode in sidebar */}
          <div style={{ padding:"8px 6px", borderTop:"1px solid rgba(212,168,71,.15)", marginTop:8 }}>
            <button
              onClick={() => setContinuousMode(m => !m)}
              style={{
                width:"100%", display:"flex", alignItems:"center", gap:8,
                padding:"10px 12px", borderRadius:8, cursor:"pointer",
                background: continuousMode
                  ? "linear-gradient(90deg,rgba(212,168,71,.2),rgba(212,168,71,.08))"
                  : "rgba(212,168,71,.05)",
                border: continuousMode ? "1px solid rgba(212,168,71,.5)" : "1px solid rgba(212,168,71,.15)",
                color: continuousMode ? "var(--gold2)" : "var(--gold3)",
                fontFamily:"var(--font)", fontSize:12, fontWeight:600,
                transition:"all .2s",
              }}
            >
              <span style={{ fontSize:16 }}>{continuousMode ? "🟢" : "🎙"}</span>
              <span>{continuousMode ? "JARVIS ON" : "JARVIS MODE"}</span>
              {continuousMode && <span style={{ marginLeft:"auto", width:6, height:6, borderRadius:"50%", background:"var(--grn)", animation:"blink 1.5s infinite", display:"inline-block" }} />}
            </button>
          </div>

          <div style={{ borderTop:"1px solid rgba(212,168,71,.12)", paddingTop:12, marginTop:8 }}>
            <div className="sidebar-label" style={{ paddingTop:0 }}>System Alerts</div>
            {tasks.filter(t => t.tatBreached).map(t => (
              <div key={t.id} style={{ fontSize:11, color:"var(--red)", padding:"4px 6px", background:"rgba(244,63,94,.06)", borderRadius:5, marginBottom:4, border:"1px solid rgba(244,63,94,.12)" }}>
                ▲ {t.title}
              </div>
            ))}
            {breached === 0 && <div style={{ fontSize:11, color:"var(--gold)", padding:"4px 6px", opacity:.7 }}>✓ No alerts</div>}
          </div>
        </aside>

        {/* ══ MAIN ══ */}
        <main className="main">

          {/* ════ OVERVIEW ════ */}
          {activeTab === "overview" && (
            <div className="anim-in">
              {/* Page header */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:22, fontWeight:700, background:"linear-gradient(90deg,var(--gold2),var(--t1) 60%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
                  {getGreeting()}, {currentUserName.split(" ")[0]}
                </div>
                <div className="section-sub" style={{ display:"flex", alignItems:"center", gap:8 }}>
                  Here's your Supremo command overview.
                  <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", background:"rgba(34,197,94,.1)", border:"1px solid rgba(34,197,94,.2)", borderRadius:20, fontSize:10, color:"var(--grn)" }}>
                    <span style={{ width:6, height:6, background:"var(--grn)", borderRadius:"50%", animation:"blink 1.5s infinite", display:"inline-block" }} />
                    LIVE · {liveTasks.length > 0 ? "MongoDB" : "Local"} · Refreshed {lastRefresh.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
                    <button onClick={fetchLiveData} style={{ background:"none", border:"none", color:"var(--grn)", cursor:"pointer", fontSize:11, padding:0, marginLeft:4 }}>↺</button>
                  </span>
                </div>
              </div>

              {/* Stat cards */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
                <StatCard icon="📋" label="Total Tasks"   value={activeTasks.length} sub={liveTasks.length > 0 ? "● Live MongoDB" : "Mock data"} accent="var(--acc)"  trend="up"     onClick={() => { setTaskFilter(null); setActiveTab("tasks"); }} />
                <StatCard icon="⏳" label="In Progress"   value={inProgress}          sub="Currently active"          accent="var(--sky)"    trend="neutral" onClick={() => { setTaskFilter("in_progress"); setActiveTab("tasks"); }} />
                <StatCard icon="✅" label="Completed"     value={completed}           sub={`${efficiency}% efficiency`} accent="var(--grn)"  trend="up"     onClick={() => { setTaskFilter("completed"); setActiveTab("tasks"); }} />
                <StatCard icon="⚠️" label="TAT Breaches" value={breached}            sub="Require attention"         accent="var(--red)"    trend={breached>0?"down":"neutral"} onClick={() => { setTaskFilter("breached"); setActiveTab("tasks"); }} />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
                <StatCard icon="🕐" label="Pending"     value={pending}       sub="Not yet started"   accent="var(--amber)"  onClick={() => { setTaskFilter("pending"); setActiveTab("tasks"); }} />
                <StatCard icon="🔄" label="Rework"      value={activeTasks.filter(t=>t.status==="rework").length} sub="Needs revision" accent="var(--orange)" onClick={() => { setTaskFilter("rework"); setActiveTab("tasks"); }} />
                <StatCard icon="✔️" label="Approved"    value={activeTasks.filter(t=>t.status==="approved").length} sub="Fully signed off" accent="var(--sky)" onClick={() => { setTaskFilter("approved"); setActiveTab("tasks"); }} />
                <StatCard icon="👥" label="Team Members" value={allUsers.length} sub="Across all roles" accent="var(--purple)" />
              </div>

              {/* Charts row */}
              <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16, marginBottom:16 }}>
                <div className="card">
                  <div className="card-head">
                    <span style={{ fontWeight:600, fontSize:14 }}>Staff Performance</span>
                    <span className="badge badge-acc">Live</span>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={(() => {
                        const doers = allUsers.filter((u:any) => u.isDoer);
                        return doers.map(u => {
                          const ut = activeTasks.filter(t => t.assignedTo === u.email);
                          return {
                            name: u.name.split(" ")[0],
                            completed: ut.filter(t => t.status==="completed"||t.status==="approved").length,
                            pending:   ut.filter(t => t.status==="pending").length,
                            breached:  ut.filter(t => t.tatBreached).length,
                          };
                        });
                      })()} margin={{ top:0, right:0, left:-24, bottom:0 }}>
                        <defs>
                          <linearGradient id="gradGrn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80"/><stop offset="100%" stopColor="#16a34a"/></linearGradient>
                          <linearGradient id="gradAmb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fbbf24"/><stop offset="100%" stopColor="#d97706"/></linearGradient>
                          <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185"/><stop offset="100%" stopColor="#be123c"/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fill:"var(--t2)" as any, fontSize:11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill:"var(--t2)" as any, fontSize:11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={(p:any) => <ChartTip {...p}/>} />
                        <Legend wrapperStyle={{ fontSize:12 }} />
                        <Bar dataKey="completed" fill="url(#gradGrn)" radius={[4,4,0,0]} name="Completed" />
                        <Bar dataKey="pending"   fill="url(#gradAmb)" radius={[4,4,0,0]} name="Pending"   />
                        <Bar dataKey="breached"  fill="url(#gradRed)" radius={[4,4,0,0]} name="Breached"  />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-head">
                    <span style={{ fontWeight:600, fontSize:14 }}>Task Distribution</span>
                    {liveTasks.length > 0 && <span style={{ fontSize:10, color:"var(--grn)" }}>● Live</span>}
                  </div>
                  <div className="card-body" style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <defs>
                          {[["pieGrn","#4ade80","#16a34a"],["pieAcc","#818cf8","#4338ca"],["pieAmb","#fbbf24","#d97706"],["pieOrg","#fb923c","#c2410c"],["pieSky","#38bdf8","#0284c7"]].map(([id,c1,c2]) => (
                            <linearGradient key={id} id={id} x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor={c1}/><stop offset="100%" stopColor={c2}/>
                            </linearGradient>
                          ))}
                        </defs>
                        <Pie data={[
                          { name:"Completed",   value: activeTasks.filter(t=>t.status==="completed"||t.status==="approved").length, color:"url(#pieGrn)" },
                          { name:"In Progress", value: activeTasks.filter(t=>t.status==="in_progress").length, color:"url(#pieAcc)" },
                          { name:"Pending",     value: activeTasks.filter(t=>t.status==="pending").length, color:"url(#pieAmb)" },
                          { name:"Rework",      value: activeTasks.filter(t=>t.status==="rework").length, color:"url(#pieOrg)" },
                          { name:"Approved",    value: activeTasks.filter(t=>t.status==="approved").length, color:"url(#pieSky)" },
                        ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={44} outerRadius={68} dataKey="value" paddingAngle={3} strokeWidth={0}>
                          {["url(#pieGrn)","url(#pieAcc)","url(#pieAmb)","url(#pieOrg)","url(#pieSky)"].map((c,i) => <Cell key={i} fill={c} />)}
                        </Pie>
                        <Tooltip content={(p:any) => <ChartTip {...p}/>} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 16px", marginTop:8 }}>
                      {[["#4ade80","Completed"],["#818cf8","In Progress"],["#fbbf24","Pending"],["#fb923c","Rework"],["#38bdf8","Approved"]].map(([c,l],i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"var(--t2)", cursor:"pointer" }}
                          onClick={() => { setTaskFilter(l==="In Progress"?"in_progress":l.toLowerCase()); setActiveTab("tasks"); }}>
                          <span style={{ width:8, height:8, borderRadius:"50%", background:c, display:"inline-block", flexShrink:0 }} />
                          {l}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly trend + radar */}
              <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:16 }}>
                <div className="card">
                  <div className="card-head">
                    <span style={{ fontWeight:600, fontSize:14 }}>Weekly Trends</span>
                    <div style={{ display:"flex", gap:12 }}>
                      {[["#f59e0b","Assigned"],["#22c55e","Completed"],["#f43f5e","Breached"]].map(([c,l],i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:c, fontFamily:"var(--mono)" }}>
                          <span style={{ width:16, height:2, background:c, display:"inline-block" }} />{l}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={TASK_TREND} margin={{ top:0, right:16, left:-24, bottom:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--bdr)" />
                        <XAxis dataKey="week" tick={{ fill:"var(--t2)" as any, fontSize:11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill:"var(--t2)" as any, fontSize:11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={(p:any) => <ChartTip {...p}/>} />
                        <Line type="monotone" dataKey="assigned"  stroke="#f59e0b" strokeWidth={2} dot={{ fill:"#f59e0b", r:3 }} name="Assigned"  />
                        <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} dot={{ fill:"#22c55e", r:3 }} name="Completed" />
                        <Line type="monotone" dataKey="breached"  stroke="#f43f5e" strokeWidth={2} dot={{ fill:"#f43f5e", r:3 }} name="Breached"  />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-head">
                    <span style={{ fontWeight:600, fontSize:14 }}>Team Radar</span>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={198}>
                      <RadarChart data={RADAR_DATA} margin={{ top:0, right:16, left:16, bottom:0 }}>
                        <PolarGrid stroke="var(--bdr)" />
                        {React.createElement(PolarAngleAxis as any, { dataKey:"subject", tick:{ fill:"var(--t2)", fontSize:10 } })}
                        <Radar name="This Month" dataKey="A" stroke="var(--acc2)" fill="var(--acc)" fillOpacity={0.12} dot={false} />
                        <Radar name="Last Month" dataKey="B" stroke="var(--amber)" fill="var(--amber)" fillOpacity={0.08} dot={false} />
                        <Legend wrapperStyle={{ fontSize:11 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ TASKS ════ */}
          {activeTab === "tasks" && (
            <div className="anim-in">
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
                <div>
                  <div className="section-title">Task Management</div>
                  <div className="section-sub" style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {taskFilter ? (
                      <>
                        Showing: <span className={`badge ${taskFilter==="breached"?"badge-red":taskFilter==="completed"||taskFilter==="approved"?"badge-green":taskFilter==="in_progress"?"badge-sky":taskFilter==="rework"?"badge-orange":"badge-amber"}`}>
                          {taskFilter==="breached" ? "⚠ TAT Breached" : taskFilter.replace(/_/g," ")}
                        </span>
                        <button className="btn btn-xs btn-ghost" onClick={() => setTaskFilter(null)}>✕ Clear filter</button>
                      </>
                    ) : (
                      <>{activeTasks.length} tasks · {inProgress} in progress · {completed} completed {liveTasks.length > 0 && <span style={{ color:"var(--grn)", fontSize:11 }}>● Live</span>}</>
                    )}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={fetchLiveData} title="Refresh from MongoDB">↺ Sync</button>
                  <button className="btn btn-primary" onClick={() => setShowTaskForm(true)}>
                    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/></svg>
                    Assign Task
                  </button>
                </div>
              </div>

              {/* Task form modal */}
              {showTaskForm && (
                <div className="modal-overlay" onClick={() => setShowTaskForm(false)}>
                  <div className="modal" onClick={e => e.stopPropagation()}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                      <div style={{ fontWeight:600, fontSize:16 }}>Assign New Task</div>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowTaskForm(false)}>✕</button>
                    </div>
                    <TaskForm
                      users={allUsers}
                      onAssign={task => {
                        setTasks(prev => [...prev, { ...task, id:"t"+Date.now(), progress:0, tatBreached:false }]);
                        setShowTaskForm(false);
                        fireVoiceEvent("task_assigned", voiceEnabled);
                      }}
                      onCancel={() => setShowTaskForm(false)}
                    />
                  </div>
                </div>
              )}

              {/* Attachment viewer modal */}
              {showAttachments && selectedTask && (
                <div className="modal-overlay" onClick={() => setShowAttachments(false)}>
                  <div className="modal" style={{ width:560 }} onClick={e => e.stopPropagation()}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                      <div style={{ fontWeight:600, fontSize:15 }}>📎 Attachments — {selectedTask.title}</div>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowAttachments(false)}>✕</button>
                    </div>
                    {(liveTasks.find(t => t._id === selectedTask._id)?.attachments || []).length === 0 ? (
                      <div style={{ color:"var(--t3)", fontSize:13, textAlign:"center", padding:24 }}>No attachments for this task.</div>
                    ) : (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        {(liveTasks.find(t => t._id === selectedTask._id)?.attachments || []).map((att, i) => (
                          <a key={i} href={att.url} target="_blank" rel="noreferrer"
                            style={{ display:"flex", flexDirection:"column", borderRadius:8, overflow:"hidden", border:"1px solid var(--bdr)", textDecoration:"none", transition:".15s" }}>
                            {att.type?.startsWith("image") || att.url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                              <img src={att.url} alt={att.name||"attachment"} style={{ width:"100%", height:120, objectFit:"cover" }} />
                            ) : (
                              <div style={{ width:"100%", height:80, background:"var(--srf2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>
                                {att.type?.includes("pdf") ? "📄" : att.type?.includes("video") ? "🎬" : "📎"}
                              </div>
                            )}
                            <div style={{ padding:"6px 10px", fontSize:11, color:"var(--t2)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{att.name || att.publicId || "File"}</div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Task table — shows live MongoDB tasks */}
              <div className="card">
                {liveLoading && liveTasks.length === 0 && (
                  <div style={{ padding:20, textAlign:"center", color:"var(--t3)", fontSize:13 }}>
                    <span style={{ animation:"spin 1s linear infinite", display:"inline-block", marginRight:8 }}>⟳</span>Loading live tasks from MongoDB…
                  </div>
                )}
                <div style={{ overflowX:"auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Assigned To</th>
                        <th>Project</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th>Due Date</th>
                        <th>Files</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTasks.filter(task => {
                        if (!taskFilter) return true;
                        if (taskFilter === "breached") return task.tatBreached;
                        if (taskFilter === "completed") return task.status === "completed" || task.status === "approved";
                        return task.status === taskFilter;
                      }).map(task => {
                        const doer = allUsers.find((u:any) => u.email === task.assignedTo);
                        const liveTask = liveTasks.find(t => t._id === task.id);
                        const attCount = liveTask?.attachments?.length || 0;
                        return (
                          <tr key={task.id}>
                            <td>
                              <div style={{ fontWeight:500, color:"var(--t1)" }}>{task.title}</div>
                              {task.tatBreached && <div style={{ fontSize:10, color:"var(--red)", marginTop:2 }}>⚠ TAT Breached</div>}
                              {liveTask?.updatedAt && <div style={{ fontSize:9, color:"var(--t3)", marginTop:1 }}>Updated {new Date(liveTask.updatedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>}
                            </td>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <div className={`avatar av-sm ${AV_COLORS[parseInt(doer?.id||"0") % AV_COLORS.length]}`}>
                                  {doer ? initials(doer.name) : "?"}
                                </div>
                                <span style={{ color:"var(--t2)", fontSize:12 }}>{liveTask?.assignedToName || doer?.name.split(" ")[0] || "—"}</span>
                              </div>
                            </td>
                            <td><span style={{ fontSize:12, color:"var(--t2)" }}>{task.project}</span></td>
                            <td><span className={`badge ${PRIORITY_COLOR[task.priority]||"badge-gray"}`}>{task.priority}</span></td>
                            <td><span className={`badge ${STATUS_COLOR[task.status]||"badge-gray"}`}>{task.status.replace(/_/g," ")}</span></td>
                            <td style={{ minWidth:120 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <div className="progress" style={{ flex:1 }}>
                                  <div className="progress-fill" style={{ width:`${task.progress}%`, background:task.progress>=80?"var(--grn)":task.progress>=40?"var(--acc)":"var(--amber)" }} />
                                </div>
                                <span style={{ fontSize:11, color:"var(--t2)", fontFamily:"var(--mono)", flexShrink:0 }}>{task.progress}%</span>
                              </div>
                            </td>
                            <td><span style={{ fontSize:12, color:"var(--t2)", fontFamily:"var(--mono)" }}>{task.dueDate}</span></td>
                            <td>
                              {attCount > 0 ? (
                                <button className="btn btn-xs btn-ghost" style={{ color:"var(--gold)", borderColor:"rgba(212,168,71,.3)" }}
                                  onClick={() => { setSelectedTask(liveTask || null); setShowAttachments(true); }}>
                                  📎 {attCount}
                                </button>
                              ) : <span style={{ fontSize:11, color:"var(--t3)" }}>—</span>}
                            </td>
                            <td>
                              <div style={{ display:"flex", gap:4 }}>
                                {task.status !== "approved" && (
                                  <button className="btn btn-xs btn-success" onClick={() => updateTaskStatus(task.id,"approved","task_approved")} title="Approve">✓</button>
                                )}
                                {task.status !== "in_progress" && task.status !== "approved" && (
                                  <button className="btn btn-xs btn-ghost" onClick={() => updateTaskStatus(task.id,"in_progress","task_sent_for_approval")} title="Send for Approval" style={{ fontSize:10 }}>→</button>
                                )}
                                {task.status !== "rework" && (
                                  <button className="btn btn-xs btn-ghost" onClick={() => updateTaskStatus(task.id,"rework","task_rejected")} title="Rework" style={{ fontSize:10, color:"var(--orange)", borderColor:"rgba(249,115,22,.3)" }}>↺</button>
                                )}
                                <button className="btn btn-xs btn-danger" onClick={() => deleteTask(task.id)} title="Delete">✕</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════ LIVE ANALYTICS ════ */}
          {activeTab === "analytics" && (
            <div className="anim-in">
              <div style={{ marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div className="section-title">Live Analytics</div>
                  <div className="section-sub">Real-time task pulse · auto-refreshes every 30s</div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:11, color:"var(--grn)", display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:7, height:7, background:"var(--grn)", borderRadius:"50%", animation:"blink 1.5s infinite", display:"inline-block" }} />
                    LIVE
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={fetchLiveData}>↺ Refresh</button>
                </div>
              </div>

              {/* KPI row */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:20 }}>
                {[
                  { label:"Total Tasks",  value:activeTasks.length, color:"var(--acc)",    icon:"📋" },
                  { label:"In Progress",  value:inProgress,          color:"var(--sky)",    icon:"⚙" },
                  { label:"Completed",    value:completed,           color:"var(--grn)",    icon:"✅" },
                  { label:"Pending",      value:pending,             color:"var(--amber)",  icon:"⏳" },
                  { label:"TAT Breaches", value:breached,            color:"var(--red)",    icon:"⚠" },
                ].map((kpi, i) => (
                  <div key={i} style={{ background:`linear-gradient(145deg,#1c2340,#161b22)`, border:`1px solid ${kpi.color}30`, borderRadius:10, padding:16, position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${kpi.color},transparent)` }} />
                    <div style={{ fontSize:22 }}>{kpi.icon}</div>
                    <div style={{ fontSize:28, fontWeight:700, color:kpi.color, fontFamily:"var(--mono)", margin:"8px 0 4px" }}>{kpi.value}</div>
                    <div style={{ fontSize:11, color:"var(--t2)" }}>{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Pulse chart — live task flow */}
              <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:16, marginBottom:16 }}>
                <div className="card">
                  <div className="card-head">
                    <span style={{ fontWeight:600, fontSize:14 }}>Task Flow Pulse</span>
                    <span style={{ fontSize:11, color:"var(--grn)", display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ width:6, height:6, background:"var(--grn)", borderRadius:"50%", animation:"blink 1.5s infinite", display:"inline-block" }} />
                      Live ({pulseTicks.length} readings)
                    </span>
                  </div>
                  <div className="card-body">
                    {pulseTicks.length < 2 ? (
                      <div style={{ height:180, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--t3)", fontSize:12, flexDirection:"column", gap:8 }}>
                        <span style={{ fontSize:28 }}>📡</span>
                        Collecting live data… {pulseTicks.length}/2 readings
                        <div style={{ fontSize:11 }}>Auto-updates every 30 seconds</div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={pulseTicks} margin={{ top:0, right:16, left:-24, bottom:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--bdr)" />
                          <XAxis dataKey="time" tick={{ fill:"var(--t2)" as any, fontSize:10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill:"var(--t2)" as any, fontSize:10 }} axisLine={false} tickLine={false} />
                          <Tooltip content={(p:any) => <ChartTip {...p}/>} />
                          <Line type="monotone" dataKey="completed"  stroke="var(--grn)"   strokeWidth={2} dot={{ fill:"var(--grn)", r:3 }}   name="Completed"   isAnimationActive={true} />
                          <Line type="monotone" dataKey="inProgress" stroke="var(--sky)"   strokeWidth={2} dot={{ fill:"var(--sky)", r:3 }}   name="In Progress" isAnimationActive={true} />
                          <Line type="monotone" dataKey="pending"    stroke="var(--amber)" strokeWidth={2} dot={{ fill:"var(--amber)", r:3 }} name="Pending"     isAnimationActive={true} />
                          <Line type="monotone" dataKey="breached"   stroke="var(--red)"   strokeWidth={2} dot={{ fill:"var(--red)", r:3 }}   name="Breached"    isAnimationActive={true} />
                          <Legend wrapperStyle={{ fontSize:11 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-head"><span style={{ fontWeight:600, fontSize:14 }}>Status Distribution</span></div>
                  <div className="card-body" style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={[
                          { name:"Completed",   value:completed,            color:"#22c55e" },
                          { name:"In Progress", value:inProgress,           color:"#0ea5e9" },
                          { name:"Pending",     value:pending,              color:"#f59e0b" },
                          { name:"Rework",      value:activeTasks.filter(t=>t.status==="rework").length,  color:"#f97316" },
                          { name:"Breached",    value:breached,             color:"#f43f5e" },
                        ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={62} dataKey="value" paddingAngle={3} strokeWidth={0}>
                          {[{color:"#22c55e"},{color:"#0ea5e9"},{color:"#f59e0b"},{color:"#f97316"},{color:"#f43f5e"}].map((e,i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip content={(p:any) => <ChartTip {...p}/>} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 12px", marginTop:6, justifyContent:"center" }}>
                      {[["#22c55e","Completed"],["#0ea5e9","In Progress"],["#f59e0b","Pending"],["#f97316","Rework"],["#f43f5e","Breached"]].map(([c,l],i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:"var(--t2)" }}>
                          <span style={{ width:7, height:7, borderRadius:"50%", background:c, display:"inline-block", flexShrink:0 }} />{l}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-doer live progress */}
              <div className="card">
                <div className="card-head">
                  <span style={{ fontWeight:600, fontSize:14 }}>Doer Activity — Live Progress</span>
                  <span className="badge badge-acc">Live</span>
                </div>
                <div className="card-body">
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
                    {allUsers.filter((u:any) => u.isDoer).map(u => {
                      const ut = activeTasks.filter(t => t.assignedTo === u.email);
                      const uc = ut.filter(t => t.status==="completed"||t.status==="approved").length;
                      const uip = ut.filter(t => t.status==="in_progress").length;
                      const ub = ut.filter(t => t.tatBreached).length;
                      const pct = ut.length ? Math.round((uc/ut.length)*100) : 0;
                      return (
                        <div key={u.id} style={{ background:"var(--srf2)", border:"1px solid var(--bdr)", borderRadius:10, padding:14 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                            <div className={`avatar av-sm ${AV_COLORS[parseInt(u.id)%AV_COLORS.length]}`}>{initials(u.name)}</div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, fontWeight:500, color:"var(--t1)" }}>{u.name}</div>
                              <div style={{ fontSize:10, color:"var(--t2)" }}>{ut.length} tasks · {uip} active</div>
                            </div>
                            {ub > 0 && <span className="badge badge-red" style={{ fontSize:9 }}>⚠ {ub}</span>}
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                            <span style={{ fontSize:11, color:"var(--t2)" }}>Completion</span>
                            <span style={{ fontSize:11, fontWeight:600, color: pct>=80?"var(--grn)":pct>=50?"var(--amber)":"var(--red)", fontFamily:"var(--mono)" }}>{pct}%</span>
                          </div>
                          <div className="progress" style={{ height:6 }}>
                            <div className="progress-fill" style={{ width:`${pct}%`, background: pct>=80?"var(--grn)":pct>=50?"var(--amber)":"var(--red)" }} />
                          </div>
                          <div style={{ display:"flex", gap:8, marginTop:8 }}>
                            {[{v:uc,l:"Done",c:"var(--grn)"},{v:uip,l:"Active",c:"var(--sky)"},{v:ut.filter(t=>t.status==="pending").length,l:"Pending",c:"var(--amber)"}].map((s,i) => (
                              <div key={i} style={{ flex:1, textAlign:"center", padding:"4px 0", background:`${s.c}10`, borderRadius:5 }}>
                                <div style={{ fontSize:14, fontWeight:700, color:s.c, fontFamily:"var(--mono)" }}>{s.v}</div>
                                <div style={{ fontSize:9, color:"var(--t3)" }}>{s.l}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ ACTIVITY FEED ════ */}
          {activeTab === "activity" && (
            <div className="anim-in">
              <div style={{ marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div className="section-title">Activity Feed</div>
                  <div className="section-sub">Every action by every team member — live from MongoDB</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={fetchLiveData}>↺ Refresh</button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", gap:16 }}>
                {/* Feed */}
                <div className="card" style={{ maxHeight:"calc(100vh - 220px)", overflowY:"auto" }}>
                  <div className="card-head" style={{ position:"sticky", top:0, background:"linear-gradient(145deg,#1a2035,#161b22)", zIndex:10 }}>
                    <span style={{ fontWeight:600, fontSize:14 }}>Live Activity Stream</span>
                    <span style={{ fontSize:11, color:"var(--grn)", display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ width:6, height:6, background:"var(--grn)", borderRadius:"50%", animation:"blink 1.5s infinite", display:"inline-block" }} />
                      {activities.length} events
                    </span>
                  </div>
                  <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                    {activities.length === 0 ? (
                      activeTasks.map((task, i) => (
                        <div key={i} style={{ display:"flex", gap:12, padding:"10px 12px", background:"var(--srf2)", borderRadius:8, borderLeft:`3px solid ${STATUS_COLOR[task.status]?.includes("green")?"var(--grn)":STATUS_COLOR[task.status]?.includes("sky")?"var(--sky)":STATUS_COLOR[task.status]?.includes("amber")?"var(--amber)":"var(--acc)"}` }}>
                          <div className={`avatar av-sm ${AV_COLORS[i % AV_COLORS.length]}`} style={{ flexShrink:0 }}>
                            {allUsers.find((u:any) => u.email===task.assignedTo) ? initials(allUsers.find((u:any) => u.email===task.assignedTo)!.name) : "?"}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, color:"var(--t1)", fontWeight:500 }}>{task.title}</div>
                            <div style={{ fontSize:11, color:"var(--t2)", marginTop:2 }}>
                              {allUsers.find((u:any) => u.email===task.assignedTo)?.name || task.assignedTo}
                              <span style={{ margin:"0 6px", color:"var(--t3)" }}>·</span>
                              <span className={`badge ${STATUS_COLOR[task.status]||"badge-gray"}`} style={{ fontSize:9 }}>{task.status.replace(/_/g," ")}</span>
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6 }}>
                              <div className="progress" style={{ flex:1, height:3 }}>
                                <div className="progress-fill" style={{ width:`${task.progress}%`, background:task.progress>=80?"var(--grn)":task.progress>=40?"var(--acc)":"var(--amber)" }} />
                              </div>
                              <span style={{ fontSize:10, color:"var(--t3)", fontFamily:"var(--mono)" }}>{task.progress}%</span>
                            </div>
                          </div>
                          <div style={{ fontSize:10, color:"var(--t3)", flexShrink:0 }}>{task.dueDate}</div>
                        </div>
                      ))
                    ) : (
                      activities.map((act, i) => (
                        <div key={i} style={{ display:"flex", gap:12, padding:"10px 12px", background:"var(--srf2)", borderRadius:8, borderLeft:"3px solid var(--acc)" }}>
                          <div className={`avatar av-sm ${AV_COLORS[i%AV_COLORS.length]}`} style={{ flexShrink:0 }}>{act.userName?initials(act.userName):"?"}</div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, color:"var(--t1)", fontWeight:500 }}>{act.action}</div>
                            <div style={{ fontSize:11, color:"var(--t2)", marginTop:2 }}>{act.taskTitle}</div>
                            {act.details && <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>{act.details}</div>}
                          </div>
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            <div style={{ fontSize:10, color:"var(--t3)" }}>{new Date(act.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                            <div style={{ fontSize:10, color:"var(--t3)" }}>{act.userName}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* TAT breach & status summary */}
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <div className="card">
                    <div className="card-head"><span style={{ fontWeight:600, fontSize:13 }}>⚠ TAT Breach Watchlist</span></div>
                    <div style={{ padding:12, display:"flex", flexDirection:"column", gap:8 }}>
                      {activeTasks.filter(t => t.tatBreached).length === 0 ? (
                        <div style={{ fontSize:12, color:"var(--grn)", padding:8, textAlign:"center" }}>✓ No TAT breaches</div>
                      ) : activeTasks.filter(t => t.tatBreached).map((t,i) => (
                        <div key={i} style={{ padding:"8px 10px", background:"rgba(244,63,94,.06)", border:"1px solid rgba(244,63,94,.15)", borderRadius:6 }}>
                          <div style={{ fontSize:12, color:"var(--red)", fontWeight:500 }}>{t.title}</div>
                          <div style={{ fontSize:10, color:"var(--t3)", marginTop:2 }}>
                            {allUsers.find((u:any) => u.email===t.assignedTo)?.name || t.assignedTo} · Due {t.dueDate}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-head"><span style={{ fontWeight:600, fontSize:13 }}>Status Snapshot</span></div>
                    <div style={{ padding:12, display:"flex", flexDirection:"column", gap:6 }}>
                      {[
                        { label:"Completed / Approved", value:completed,  color:"var(--grn)" },
                        { label:"In Progress",           value:inProgress, color:"var(--sky)" },
                        { label:"Pending",               value:pending,    color:"var(--amber)" },
                        { label:"Rework",                value:activeTasks.filter(t=>t.status==="rework").length, color:"var(--orange)" },
                        { label:"TAT Breached",          value:breached,   color:"var(--red)" },
                      ].map((s, i) => (
                        <div key={i}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                            <span style={{ fontSize:12, color:"var(--t2)" }}>{s.label}</span>
                            <span style={{ fontSize:12, fontWeight:600, color:s.color, fontFamily:"var(--mono)" }}>{s.value}</span>
                          </div>
                          <div className="progress" style={{ height:4 }}>
                            <div className="progress-fill" style={{ width:`${activeTasks.length ? Math.round(s.value/activeTasks.length*100) : 0}%`, background:s.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ TEAM ════ */}
          {activeTab === "team" && (
            <div className="anim-in">
              <div style={{ marginBottom:24 }}>
                <div className="section-title">Team Members</div>
                <div className="section-sub">{allUsers.length} members across {Array.from(new Set(allUsers.map((u:any) => u.role))).length} roles</div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:20 }}>
                {/* Member list */}
                <div className="card" style={{ overflow:"hidden" }}>
                  <div className="card-head">
                    <span style={{ fontWeight:600, fontSize:13 }}>All Members</span>
                    <span className="badge badge-gray">{allUsers.length}</span>
                  </div>
                  <div style={{ overflowY:"auto", maxHeight:"calc(100vh - 320px)" }}>
                    {allUsers.map((u:any) => (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUser(u)}
                        style={{
                          display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
                          cursor:"pointer", transition:"background .15s",
                          background: selectedUser?.id === u.id ? "rgba(99,102,241,.08)" : "transparent",
                          borderLeft: selectedUser?.id === u.id ? "2px solid var(--acc)" : "2px solid transparent",
                        }}
                      >
                        <div className={`avatar av-sm ${AV_COLORS[parseInt(u.id) % AV_COLORS.length]}`}>{initials(u.name)}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500, color:"var(--t1)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{u.name}</div>
                          <div style={{ fontSize:10, color:"var(--t2)" }}>{u.role}</div>
                        </div>
                        <span className={`badge badge-xs ${ROLE_COLOR[u.role]||"badge-gray"}`} style={{ fontSize:9, padding:"1px 6px" }}>{u.role}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Member detail */}
                {selectedUser && (() => {
                  const ut = tasks.filter(t => t.assignedTo === selectedUser.email);
                  const uc = ut.filter(t => t.status === "completed" || t.status === "approved").length;
                  const ub = ut.filter(t => t.tatBreached).length;
                  return (
                    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                      <div className="card">
                        <div className="card-body" style={{ display:"flex", alignItems:"center", gap:16 }}>
                          <div className={`avatar av-lg ${AV_COLORS[parseInt(selectedUser.id) % AV_COLORS.length]}`} style={{ width:56, height:56, fontSize:20 }}>
                            {initials(selectedUser.name)}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:18, fontWeight:600, color:"var(--t1)" }}>{selectedUser.name}</div>
                            <div style={{ fontSize:13, color:"var(--t2)", marginTop:2 }}>{selectedUser.email}</div>
                            <div style={{ display:"flex", gap:6, marginTop:8 }}>
                              <span className={`badge ${ROLE_COLOR[selectedUser.role]||"badge-gray"}`}>{selectedUser.role}</span>
                              {selectedUser.isDoer && <span className="badge badge-green">Doer</span>}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                        {[
                          { label:"Total Tasks",  value:ut.length, color:"var(--acc)" },
                          { label:"Completed",    value:uc,        color:"var(--grn)" },
                          { label:"TAT Breaches", value:ub,        color:"var(--red)" },
                        ].map((s, i) => (
                          <div key={i} className="card-sm" style={{ textAlign:"center" }}>
                            <div style={{ fontSize:28, fontWeight:700, color:s.color, lineHeight:1 }}>{s.value}</div>
                            <div style={{ fontSize:12, color:"var(--t2)", marginTop:6 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {ut.length > 0 && (
                        <div className="card">
                          <div className="card-head"><span style={{ fontWeight:600, fontSize:13 }}>Assigned Tasks</span></div>
                          <div style={{ overflowY:"auto", maxHeight:280 }}>
                            <table className="table">
                              <thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Progress</th></tr></thead>
                              <tbody>
                                {ut.map(t => (
                                  <tr key={t.id}>
                                    <td>
                                      <div style={{ fontWeight:500, fontSize:13 }}>{t.title}</div>
                                      {t.tatBreached && <div style={{ fontSize:10, color:"var(--red)" }}>⚠ TAT Breach</div>}
                                    </td>
                                    <td><span className={`badge ${STATUS_COLOR[t.status]||"badge-gray"}`}>{t.status.replace(/_/g," ")}</span></td>
                                    <td><span className={`badge ${PRIORITY_COLOR[t.priority]||"badge-gray"}`}>{t.priority}</span></td>
                                    <td>
                                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                        <div className="progress" style={{ width:80 }}>
                                          <div className="progress-fill" style={{ width:`${t.progress}%`, background:t.progress>=80?"var(--grn)":"var(--acc)" }} />
                                        </div>
                                        <span style={{ fontSize:11, fontFamily:"var(--mono)", color:"var(--t2)" }}>{t.progress}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ════ REPORTS ════ */}
          {activeTab === "reports" && (
            <div className="anim-in">
              <div style={{ marginBottom:24 }}>
                <div className="section-title">Reports & Analytics</div>
                <div className="section-sub">System performance summary and team metrics</div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:20 }}>
                <div className="card-sm" style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>Approval Pipeline</div>
                  {["Assigned","In Review","Admin Approved","Fully Approved","Rejected / Rework"].map((s, i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, paddingBottom:6, borderBottom:"1px solid var(--bdr)" }}>
                      <span style={{ color:"var(--t2)" }}>{s}</span>
                      <span style={{ fontFamily:"var(--mono)", fontWeight:600 }}>0</span>
                    </div>
                  ))}
                </div>
                <div className="card-sm" style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>Team Breakdown</div>
                  {[{ role:"Supremo", count:1 },{ role:"Superadmin", count:1 },{ role:"Admin", count:6 },{ role:"Staff", count:6 }].map((r, i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, paddingBottom:6, borderBottom:"1px solid var(--bdr)" }}>
                      <span style={{ color:"var(--t2)" }}>{r.role}</span>
                      <span style={{ fontFamily:"var(--mono)", fontWeight:600 }}>{r.count}</span>
                    </div>
                  ))}
                </div>
                <div className="card-sm" style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>Risk Summary</div>
                  {[{ label:"TAT Breached", value:breached, color:"var(--red)" },{ label:"In Progress", value:inProgress, color:"var(--sky)" },{ label:"Pending", value:pending, color:"var(--amber)" },{ label:"Completed", value:completed, color:"var(--grn)" }].map((r, i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, paddingBottom:6, borderBottom:"1px solid var(--bdr)" }}>
                      <span style={{ color:"var(--t2)" }}>{r.label}</span>
                      <span style={{ fontFamily:"var(--mono)", fontWeight:600, color:r.color }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16 }}>
                <div className="card">
                  <div className="card-head"><span style={{ fontWeight:600, fontSize:13 }}>Performance by Staff</span></div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={(() => {
                        return allUsers.filter((u:any) => u.isDoer).map(u => {
                          const ut = activeTasks.filter(t => t.assignedTo === u.email);
                          return {
                            name: u.name.split(" ")[0],
                            completed: ut.filter(t => t.status==="completed"||t.status==="approved").length,
                            pending: ut.filter(t => t.status==="pending").length,
                            breached: ut.filter(t => t.tatBreached).length,
                          };
                        });
                      })()} margin={{ top:0, right:0, left:-24, bottom:0 }}>
                        <defs>
                          <linearGradient id="gradGrn2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80"/><stop offset="100%" stopColor="#16a34a"/></linearGradient>
                          <linearGradient id="gradAmb2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fbbf24"/><stop offset="100%" stopColor="#d97706"/></linearGradient>
                          <linearGradient id="gradRed2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185"/><stop offset="100%" stopColor="#be123c"/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fill:"var(--t2)" as any, fontSize:10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill:"var(--t2)" as any, fontSize:10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={(p:any) => <ChartTip {...p}/>} />
                        <Legend wrapperStyle={{ fontSize:11 }} />
                        <Bar dataKey="completed" fill="url(#gradGrn2)" radius={[4,4,0,0]} name="Completed" />
                        <Bar dataKey="pending"   fill="url(#gradAmb2)" radius={[4,4,0,0]} name="Pending"   />
                        <Bar dataKey="breached"  fill="url(#gradRed2)" radius={[4,4,0,0]} name="Breached"  />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="card-head"><span style={{ fontWeight:600, fontSize:13 }}>Efficiency Overview</span></div>
                  <div className="card-body">
                    {/* Circular gauges row */}
                    <div style={{ display:"flex", justifyContent:"space-around", marginBottom:20 }}>
                      <CircularGauge value={efficiency} label="Overall Efficiency" color="var(--acc)" size={88} />
                      <CircularGauge value={Math.round((completed/activeTasks.length)*100)} label="Completion Rate" color="var(--grn)" size={88} />
                      <CircularGauge value={Math.round(((activeTasks.length-breached)/activeTasks.length)*100)} label="On-Time Delivery" color="var(--sky)" size={88} />
                    </div>
                    {/* Progress bars below */}
                    {[
                      { label:"Overall Efficiency",   value:efficiency,   color:"var(--acc)" },
                      { label:"Completion Rate",       value:Math.round((completed/activeTasks.length)*100), color:"var(--grn)" },
                      { label:"On-Time Delivery",      value:Math.round(((activeTasks.length-breached)/activeTasks.length)*100), color:"var(--sky)" },
                    ].map((m, i) => (
                      <div key={i} style={{ marginBottom:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontSize:12, color:"var(--t2)" }}>{m.label}</span>
                          <span style={{ fontSize:12, fontWeight:600, color:m.color, fontFamily:"var(--mono)" }}>{m.value}%</span>
                        </div>
                        <div className="progress" style={{ height:6 }}>
                          <div className="progress-fill" style={{ width:`${m.value}%`, background:m.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ AI CHAT ════ */}
          {activeTab === "ai" && (
            <div className="anim-in">
              <div style={{ marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div className="section-title">SmartCue AI</div>
                  <div className="section-sub">Intelligent assistant for task management and analysis</div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  {/* Stop TTS */}
                  {(isSpeaking || stopRequested) && (
                    <button className="btn btn-xs btn-danger" onClick={() => { stopRef.current = true; setStopRequested(true); setTimeout(()=>{ stopRef.current=false; setStopRequested(false); },2500); }}>
                      ■ Stop
                    </button>
                  )}
                  {/* Continuous mode */}
                  <button
                    className={`btn btn-xs ${continuousMode ? "btn-success" : "btn-ghost"}`}
                    onClick={() => setContinuousMode(m => !m)}
                    title={continuousMode ? "Disable Jarvis Mode" : "Enable Jarvis Mode (always listening)"}
                  >
                    {continuousMode ? "⬤ JARVIS ON" : "JARVIS MODE"}
                  </button>
                  {/* Auto-report */}
                  <button
                    className={`btn btn-xs ${autoReport ? "btn-ghost" : "btn-ghost"}`}
                    style={{ borderColor: autoReport ? "var(--amber)" : "var(--bdr)", color: autoReport ? "var(--amber)" : "var(--t3)" }}
                    onClick={() => setAutoReport(a => !a)}
                    title="Auto-briefing every 2 minutes"
                  >
                    {autoReport ? "⏱ AUTO ON" : "AUTO BRIEF"}
                  </button>
                  <span className={`badge ${isListening ? "badge-green" : isSpeaking ? "badge-acc" : stopRequested ? "badge-red" : "badge-gray"}`}>
                    {isListening ? "🎙 Listening" : isSpeaking ? "🔊 Speaking" : stopRequested ? "■ Stopped" : "● Standby"}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setAiMessages([])} style={{ fontSize:11 }}>Clear</button>
                </div>
              </div>

              <div className="card" style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 260px)" }}>
                {/* Messages */}
                <div className="chat-messages">
                  {aiMessages.length === 0 && (
                    <div style={{ display:"flex", flex:1, alignItems:"center", justifyContent:"center", opacity:.35, flexDirection:"column", gap:8 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="40" height="40"><path d="M12 2a10 10 0 110 20A10 10 0 0112 2zM12 8v4l3 3"/></svg>
                      <span style={{ fontSize:12 }}>Start a conversation</span>
                    </div>
                  )}
                  {aiMessages.map(msg => (
                    <div key={msg.id} style={{ display:"flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap:8 }}>
                      {msg.role === "assistant" && (
                        <div className="avatar av-sm av-acc" style={{ flexShrink:0 }}>AI</div>
                      )}
                      <div style={{ display:"flex", flexDirection:"column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                        <div className={`chat-bubble chat-bubble-${msg.role === "user" ? "user" : "ai"}`}>{msg.text}</div>
                        <div className="chat-meta">{msg.timestamp.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                      </div>
                      {msg.role === "user" && (
                        <div className={`avatar av-sm ${AV_COLORS[0]}`} style={{ flexShrink:0 }}>{initials(currentUserName)}</div>
                      )}
                    </div>
                  ))}
                  {aiTyping && (
                    <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                      <div className="avatar av-sm av-acc" style={{ flexShrink:0 }}>AI</div>
                      <div className="chat-bubble chat-bubble-ai" style={{ display:"flex", gap:4, alignItems:"center", padding:"10px 14px" }}>
                        {[0,1,2].map(i => <span key={i} className="think-dot" style={{ animation:`thinkDot 1.2s ${i*0.25}s infinite` }} />)}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick suggestions */}
                <div style={{ padding:"8px 16px", borderTop:"1px solid var(--bdr)", display:"flex", gap:6, flexWrap:"wrap" }}>
                  {["Show TAT breaches","Team performance","Task summary","Efficiency report"].map((cmd, i) => (
                    <button key={i} className="btn btn-ghost btn-xs" onClick={() => sendAiMessage(cmd)} style={{ fontSize:11 }}>{cmd}</button>
                  ))}
                </div>

                {/* Input */}
                <div className="chat-input-row">
                  <input
                    className="input"
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") sendAiMessage(); }}
                    placeholder='Ask SmartCue anything… or say "Hey Cue" to Jarvis'
                    style={{ flex:1 }}
                  />
                  <button
                    className={`btn ${isListening ? "btn-success" : "btn-ghost"} btn-sm`}
                    onClick={toggleMic}
                    style={{ flexShrink:0 }}
                    title="Voice input"
                  >
                    🎙
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => sendAiMessage()} style={{ flexShrink:0, padding:"7px 14px" }}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════ INTELLIGENCE ════ */}
          {activeTab === "intel" && (
            <div className="anim-in">
              <div style={{ marginBottom:16 }}>
                <div className="section-title">Intelligence Engine</div>
                <div className="section-sub">Autonomous research · Live web data · Visualisations · Multimedia</div>
              </div>

              {/* Search bar */}
              <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
                <div style={{ flex:1, position:"relative" }}>
                  <input
                    className="input"
                    value={intelQuery}
                    onChange={e => setIntelQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !intelLoading) handleIntelSearch(); }}
                    placeholder={intelMicActive ? "🎙 Listening…" : "Research anything — people, places, markets, trends…"}
                    style={{ paddingLeft:40, height:42, fontSize:14 }}
                  />
                  <span style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", fontSize:16, color:"var(--t3)" }}>◭</span>
                </div>
                <button onClick={toggleIntelMic} className={`btn ${intelMicActive ? "btn-success" : "btn-ghost"} btn-sm`} style={{ height:42, padding:"0 14px" }}>🎙</button>
                {intelLoading
                  ? <button className="btn btn-ghost btn-sm" disabled style={{ height:42, padding:"0 18px" }}>Researching…</button>
                  : <button className="btn btn-primary btn-sm" onClick={() => handleIntelSearch()} style={{ height:42, padding:"0 18px" }}>Search</button>
                }
              </div>

              {/* Quick searches */}
              <div className="intel-quickbar">
                {["Real Estate Trends 2025","Mumbai Property Market","AI in Construction","Top Realty Competitors India","Roswalt Analysis"].map((s, i) => (
                  <button key={i} className="intel-quickbtn" onClick={() => { setIntelQuery(s); handleIntelSearch(s); }}>{s}</button>
                ))}
              </div>

              {/* 3-col body */}
              <div className="intel-body">

                {/* Col 1 — Log */}
                <div className="intel-col">
                  <div className="intel-col-head">Process Log</div>
                  <div className="intel-col-scroll">
                    {intelLoading && (
                      <div style={{ display:"flex", gap:5, alignItems:"center", padding:"8px 0", fontSize:11, color:"var(--t2)" }}>
                        {[0,1,2].map(i => <span key={i} className="think-dot" style={{ animation:`thinkDot 1.2s ${i*0.22}s infinite` }} />)}
                        <span>Researching…</span>
                      </div>
                    )}
                    {intelLog.map((l, i) => <div key={i} className="intel-log-line">{l}</div>)}
                    {!intelLoading && intelLog.length === 0 && (
                      <div style={{ fontSize:10, color:"var(--t3)", lineHeight:1.9, fontFamily:"var(--mono)" }}>
                        Awaiting query.<br/><br/>
                        SmartCue will:<br/>
                        {'>'} Search live web<br/>
                        {'>'} Synthesise research<br/>
                        {'>'} Build charts<br/>
                        {'>'} Source images<br/>
                        {'>'} Find videos
                      </div>
                    )}
                    {intelHistory.length > 0 && (
                      <>
                        <div style={{ fontWeight:600, fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:.5, marginTop:12, marginBottom:4, fontFamily:"var(--mono)" }}>Recent</div>
                        {intelHistory.map((h, i) => (
                          <div key={i} className="intel-history-item" onClick={() => { setIntelQuery(h); handleIntelSearch(h); }}>{h}</div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Col 2 — Analysis + Charts */}
                <div style={{ overflowY:"auto", display:"flex", flexDirection:"column", gap:0 }}>
                  {intelResults.length === 0 && !intelLoading && (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", opacity:.25, gap:8 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="48" height="48"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                      <span style={{ fontFamily:"var(--mono)", fontSize:12 }}>Enter a query to begin</span>
                    </div>
                  )}

                  {intelResults.filter(b => b.kind === "analysis").map((block, bi) => (
                    <div key={bi} className="intel-card">
                      <div className="intel-card-head">
                        <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12" style={{ color:"var(--acc2)" }}><path d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/></svg>
                        Intelligence Briefing
                      </div>
                      <div className="intel-card-body">
                        <div className="intel-analysis">
                          {block.text.split("\n").map((line: string, li: number) => {
                            if (!line.trim()) return <div key={li} style={{ height:6 }} />;
                            if (line.startsWith("▸") || line.startsWith("**")) return <div key={li} style={{ fontWeight:600, color:"var(--t1)", fontSize:13, marginTop:12, marginBottom:4 }}>{line.replace(/\*\*/g,"")}</div>;
                            if (line.startsWith("-") || line.startsWith("•")) return <div key={li} style={{ paddingLeft:12, color:"var(--t2)", fontSize:12.5, marginBottom:2 }}>· {line.replace(/^[-•]\s*/,"")}</div>;
                            return <p key={li} style={{ margin:"0 0 6px", fontSize:13, lineHeight:1.75 }}>{line.replace(/\*\*([^*]+)\*\*/g,"$1")}</p>;
                          })}
                        </div>
                        {block.sources?.length > 0 && (
                          <div className="intel-sources">
                            <span style={{ fontSize:10, color:"var(--t3)", fontFamily:"var(--mono)" }}>Sources</span>
                            {block.sources.map((s: any, si: number) => (
                              <a key={si} href={s.url} target="_blank" rel="noreferrer" className="intel-source-chip">↗ {s.source}</a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {intelResults.filter(b => b.kind === "chart").map((block, bi) => (
                    <div key={bi} className="intel-card">
                      <div className="intel-card-head">📈 {block.title?.toUpperCase()}</div>
                      <div className="intel-card-body">
                        {block.type === "line" && (
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={block.data?.labels?.map((l: string, i: number) => ({ name:l, ...Object.fromEntries((block.data.datasets||[]).map((d:any)=>[d.label,d.data[i]])) })) ?? []}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--bdr)" />
                              <XAxis dataKey="name" tick={{ fill:"var(--t2)" as any, fontSize:10 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill:"var(--t2)" as any, fontSize:10 }} axisLine={false} tickLine={false} />
                              <Tooltip content={(p:any) => <ChartTip {...p}/>} />
                              <Legend wrapperStyle={{ fontSize:11 }} />
                              {(block.data?.datasets||[]).map((d:any, di:number) => {
                                const c = d.color || ["#6366f1","#22c55e","#f59e0b","#f43f5e"][di%4];
                                return <Line key={di} type="monotone" dataKey={d.label} stroke={c} strokeWidth={2} dot={{ fill:c, r:3 }} />;
                              })}
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Col 3 — Media */}
                <div style={{ overflowY:"auto", display:"flex", flexDirection:"column", gap:0 }}>
                  {intelResults.filter(b => b.kind === "images" || b.kind === "youtube").length === 0 && !intelLoading && intelResults.length === 0 && (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", opacity:.25, gap:8 }}>
                      <span style={{ fontSize:32 }}>🖼</span>
                      <span style={{ fontFamily:"var(--mono)", fontSize:11 }}>Images & videos here</span>
                    </div>
                  )}

                  {intelResults.filter(b => b.kind === "images").map((block, bi) => (
                    <div key={bi} className="intel-card">
                      <div className="intel-card-head">🖼 Visual Intelligence</div>
                      <div className="intel-card-body" style={{ padding:10 }}>
                        <div className="intel-img-grid">
                          {block.images?.slice(0, 4).map((img: any, ii: number) => (
                            <div key={ii} className="intel-img-tile" onClick={() => window.open(img.url, "_blank")}>
                              <img src={img.thumb} alt={img.desc} loading="lazy"
                                onError={(e) => {
                                  const t = e.target as HTMLImageElement;
                                  const r = parseInt(t.dataset.retry || "0");
                                  if (r === 0) { t.dataset.retry = "1"; t.src = `https://picsum.photos/seed/${block.label||"img"}-${ii}/400/250`; }
                                  else t.style.display = "none";
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  {intelResults.filter(b => b.kind === "youtube").map((block, bi) => (
                    <div key={bi} className="intel-card">
                      <div className="intel-card-head">▶ Video Intelligence</div>
                      <div className="intel-card-body" style={{ padding:10, display:"flex", flexDirection:"column", gap:6 }}>
                        {(block.variants || []).map((v: any, i: number) => (
                          <a key={i}
                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent((block.query||"")+(v.suffix||""))}`}
                            target="_blank" rel="noreferrer"
                            style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"var(--srf2)", border:"1px solid var(--bdr)", borderRadius:6, textDecoration:"none", transition:".15s" }}
                          >
                            <div style={{ width:40, height:30, background:"rgba(239,68,68,.15)", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                              <span style={{ color:"#ef4444", fontSize:14 }}>▶</span>
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, color:"var(--t1)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.label}</div>
                              <div style={{ fontSize:10, color:"var(--t3)", fontFamily:"var(--mono)", marginTop:1 }}>YouTube ↗</div>
                            </div>
                          </a>
                        ))}
                        <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(block.query||"")}`} target="_blank" rel="noreferrer" className="intel-source-chip" style={{ alignSelf:"flex-start", marginTop:4 }}>
                          Browse all videos ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          )}

        </main>
      </div>

      {/* ══ JARVIS ══ */}
      <JarvisAssistant
        tasks={tasks}
        users={allUsers}
        userName={currentUserName}
        userRole="Supremo"
      />

      {/* ══ LOGOUT MODAL ══ */}
      {showLogout && (
        <div className="modal-overlay" onClick={() => setShowLogout(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:600, fontSize:18, marginBottom:8 }}>Sign Out</div>
            <div style={{ fontSize:14, color:"var(--t2)", lineHeight:1.6, marginBottom:24 }}>
              Are you sure you want to sign out of SmartCue? All active sessions will be terminated.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowLogout(false)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex:1 }} onClick={() => { setShowLogout(false); announceVoice("logout_confirmed"); setTimeout(() => logout(), 1200); }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* Inject font */}
      <style>{`
        @keyframes thinkDot{0%,80%,100%{transform:scale(.55);opacity:.35;}40%{transform:scale(1);opacity:1;}}
      `}</style>
    </>
  );
}






