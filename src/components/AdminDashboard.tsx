  import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
  import { useNavigate } from "react-router-dom";
  import { useUser } from "../contexts/UserContext";
  import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
  import {
    Plus, Upload, LogOut, CheckCircle, Eye, X,
    Zap, User, ChevronRight, Calendar, Flag,
    FileText, MessageSquare, Shield, Sparkles, Loader,
    TrendingUp, Clock, Activity, BarChart3,
    GitBranch, ListTree,
    AlertTriangle, History, Radio, Share2, RotateCw, Trash2,
  } from "lucide-react";
  import ClaudeChat from "./ClaudeChat";
  import HistoryTimeline from "./Historytimeline";
  import SmartAssistModal from "./Smartassistmodal";
  import ProgressTracker from "./Progresstracker";
  import { sendTaskWhatsApp } from "../services/WhatsAppService";
  import { greetUser, setElevenLabsVoice, announceVoice } from "../services/VoiceModule";


  void Sparkles; void RotateCw; void Radio;

  let ForwardedTaskTree: React.FC<{
    tasks: Task[];
    getNameFn: (e: string) => string;
    isAdminFn: (e: string) => boolean;
    onSelectTask: (t: Task) => void;
  }>;
  try {
    // eslint-disable-next-line
    ForwardedTaskTree = require("./ForwardedTaskTree").default;
  } catch {
    ForwardedTaskTree = () => (
      <div style={{ color: "#8a9aaa", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, padding: 24 }}>
        ForwardedTaskTree component not found.
      </div>
    );
  }

  import type { SmartAssistTicket } from "../services/SmartAssistService";
  import type { TATTask } from "../services/TATEngine";

  function computeExactDeadline(dueDate: string, timeSlot: string): string {
    if (!dueDate) return "";
    const d = new Date(dueDate + "T00:00:00");
    if (timeSlot === "AM") d.setHours(9, 0, 0, 0);
    else if (timeSlot === "Noon") d.setHours(12, 0, 0, 0);
    else d.setHours(18, 0, 0, 0);
    return d.toISOString();
  }

  function loadTickets(): SmartAssistTicket[] {
    try { return require("../services/SmartAssistService").loadTickets(); } catch { return []; }
  }
  function mergeTickets(prev: SmartAssistTicket[], next: SmartAssistTicket[]): SmartAssistTicket[] {
    try { return require("../services/SmartAssistService").mergeTickets(prev, next); }
    catch { return [...prev, ...next]; }
  }
  function resolveTicket(tickets: SmartAssistTicket[], taskId: string): SmartAssistTicket[] {
    try { return require("../services/SmartAssistService").resolveTicket(tickets, taskId); }
    catch { return tickets.filter((t) => t.taskId !== taskId); }
  }
  function submitRevision(
    tickets: SmartAssistTicket[],
    taskId: string,
    data: { revisedDate: string; revisedTimeSlot: string; delayReason: string }
  ): SmartAssistTicket[] {
    try { return require("../services/SmartAssistService").submitRevision(tickets, taskId, data); }
    catch { return tickets; }
  }
  function countActiveTickets(tickets: SmartAssistTicket[]): number {
    try { return require("../services/SmartAssistService").countActiveTickets(tickets); }
    catch { return tickets.filter((t) => t.status === "open").length; }
  }
  function getTicketForTask(tickets: SmartAssistTicket[], taskId: string): SmartAssistTicket | undefined {
    try { return require("../services/SmartAssistService").getTicketForTask(tickets, taskId); }
    catch { return tickets.find((t) => t.taskId === taskId); }
  }
  function startTATMonitor(
    getTasksFn: () => TATTask[],
    getNameFn: (e: string) => string,
    cb: (tasks: TATTask[], tickets: SmartAssistTicket[]) => void,
    interval: number
  ): () => void {
    try { return require("../services/TATEngine").startTATMonitor(getTasksFn, getNameFn, cb, interval); }
    catch { return () => {}; }
  }

  interface HistoryEntry {
    id: string;
    timestamp: string;
    action: string;
    by: string;
    to?: string;
    notes?: string;
  }

  interface AIReviewResult {
    image: number;
    status: "CLEAN" | "MINOR" | "ERROR";
    issues: string[];
    recommendations: string;
  }

  interface AIReviewResults {
    results: AIReviewResult[];
    hasErrors: boolean;
    timestamp: string;
  }

  interface Task {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: "high" | "medium" | "low";
    approvalStatus:
      | "assigned"
      | "rejected"
      | "in-review"
      | "admin-approved"
      | "superadmin-approved"
      | "in-progress"
      | "completed"
      | "pending";
    dueDate: string;
    assignedTo: string;
    assignedBy?: string;
    projectId?: string;
    timeSlot?: string;
    exactDeadline?: string;
    history?: HistoryEntry[];
    completionNotes?: string;
    adminComments?: string;
    attachments?: string[];
    tatBreached?: boolean;
    smartAssist?: { delayDuration?: string; reminderCount?: number };
    completedAt?: string;
    createdAt?: string;
    forwardedFrom?: string;
  }

  type TeamMember = { id: string; name: string; email: string; role: string; phone?: string };
  type Project    = { id: string; name: string; status?: string; projectCode?: string };

  // ── Design tokens ─────────────────────────────────────────────────────────────
  const G = {
    bg:           "rgba(4,6,14,0.55)",
    bgDeep:       "rgba(2,4,10,0.70)",
    surface:      "rgba(10,18,40,0.55)",
    surfaceMid:   "rgba(16,28,58,0.60)",
    surfaceHigh:  "rgba(22,38,78,0.65)",
    gold:         "#ffe066",
    goldBright:   "#fff3a0",
    goldDim:      "rgba(255,224,102,0.14)",
    goldGlow:     "rgba(255,224,102,0.45)",
    goldBorder:   "rgba(255,224,102,0.45)",
    goldBorderHi: "rgba(255,224,102,0.70)",
    border:       "rgba(255,255,255,0.12)",
    borderHi:     "rgba(255,255,255,0.28)",
    success:       "#00f5a0",
    successDim:    "rgba(0,245,160,0.12)",
    successBorder: "rgba(0,245,160,0.35)",
    danger:        "#ff2d55",
    dangerDim:     "rgba(255,45,85,0.14)",
    dangerBorder:  "rgba(255,45,85,0.40)",
    amber:         "#ff9f0a",
    amberDim:      "rgba(255,159,10,0.14)",
    cyan:          "#00d4ff",
    cyanDim:       "rgba(0,212,255,0.12)",
    purple:        "#bf5fff",
    purpleDim:     "rgba(191,95,255,0.14)",
    pink:          "#ff375f",
    pinkDim:       "rgba(255,55,95,0.12)",
    lime:          "#39ff14",
    limeDim:       "rgba(57,255,20,0.10)",
    textPrimary:   "#f0f4ff",
    textSecondary: "#b8c8e8",
    textMuted:     "#7890b0",
  };

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: transparent; color: ${G.textPrimary}; font-family: 'Poppins', sans-serif; -webkit-font-smoothing: antialiased; }
    ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${G.cyan}55; border-radius: 99px; }
    @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
    @keyframes scaleIn  { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
    @keyframes shimmer  { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
    @keyframes gradient-shift { 0% { background-position: 0% center; } 50% { background-position: 100% center; } 100% { background-position: 0% center; } }
    @keyframes glow-cyan { 0%,100% { box-shadow:0 0 18px ${G.cyan}77, 0 0 36px ${G.purple}44; } 50% { box-shadow:0 0 28px ${G.cyan}99, 0 0 56px ${G.purple}66; } }
    @keyframes spin     { to { transform:rotate(360deg); } }
    @keyframes progressBar { 0%{width:0%;} 50%{width:100%;} 100%{width:0%;} }
    @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
    @keyframes tatPulse { 0%,100%{box-shadow:0 0 0 0 ${G.danger}77;} 50%{box-shadow:0 0 0 8px ${G.danger}00;} }
    @keyframes neon-border { 0%,100%{border-color:${G.cyan}66;} 50%{border-color:${G.purple}88;} }
    @keyframes float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-4px);} }
    .fade-up  { animation: fadeUp  0.5s ease both; }
    .fade-in  { animation: fadeIn  0.35s ease both; }
    .scale-in { animation: scaleIn 0.3s  ease both; }
    .spin     { animation: spin 1s linear infinite; }
    .shimmer  { animation: shimmer 2s ease infinite; }
    .glow     { animation: glow-cyan 3s ease infinite; }
    .pulse    { animation: pulse 2s ease infinite; }
    .tat-pulse{ animation: tatPulse 2s ease infinite; }
    .float    { animation: float 4s ease infinite; }
    input:focus, textarea:focus, select:focus { outline: none; }
    input::placeholder, textarea::placeholder { color: ${G.textMuted}; }
    select option { background: #0d1a35; color: ${G.textPrimary}; }
    optgroup { color: ${G.textSecondary}; font-family: 'Poppins', sans-serif; font-size: 11px; }
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.8) brightness(1.4) hue-rotate(160deg); cursor: pointer; }

    .g-btn-gold { display:flex; align-items:center; justify-content:center; gap:8px; padding: 11px 22px; background: linear-gradient(135deg, ${G.cyan} 0%, #0099cc 50%, ${G.cyan} 100%); color: #001a26; font-weight:800; font-size:12px; letter-spacing:0.1em; text-transform:uppercase; border:none; border-radius:8px; font-family:'Oswald',sans-serif; cursor:pointer; transition: all 0.2s ease; box-shadow: 0 0 20px ${G.cyan}66, 0 4px 16px rgba(0,212,255,0.4), inset 0 1px 0 rgba(255,255,255,0.3); }
    .g-btn-gold:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 0 32px ${G.cyan}88, 0 8px 24px rgba(0,212,255,0.5); }
    .g-btn-gold:disabled { opacity:0.35; cursor:not-allowed; }
    .g-btn-ghost { display:flex; align-items:center; justify-content:center; gap:8px; padding: 11px 22px; background: rgba(255,255,255,0.06); color: ${G.textPrimary}; border: 1px solid rgba(255,255,255,0.14); border-radius:8px; font-family:'Poppins',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition: all 0.2s ease; backdrop-filter: blur(8px); }
    .g-btn-ghost:hover { border-color:${G.cyan}55; background:rgba(0,212,255,0.08); color:${G.cyan}; }
    .g-btn-success { display:flex; align-items:center; justify-content:center; gap:8px; padding: 11px 22px; background: linear-gradient(135deg, #00c87a, ${G.success}); color:#001a0e; border:none; border-radius:8px; font-family:'Oswald',sans-serif; font-weight:700; font-size:13px; cursor:pointer; transition:all 0.2s ease; box-shadow: 0 0 18px ${G.success}55, 0 4px 12px rgba(0,245,160,0.3); }
    .g-btn-success:hover { transform:translateY(-2px); box-shadow: 0 0 28px ${G.success}77; }
    .g-btn-danger { display:flex; align-items:center; justify-content:center; gap:8px; padding: 11px 22px; background: linear-gradient(135deg, #cc0033, ${G.danger}); color:#fff; border:none; border-radius:8px; font-family:'Oswald',sans-serif; font-weight:700; font-size:13px; cursor:pointer; transition:all 0.2s ease; box-shadow: 0 0 18px ${G.danger}55, 0 4px 12px rgba(255,45,85,0.3); }
    .g-btn-danger:hover { transform:translateY(-2px); box-shadow: 0 0 28px ${G.danger}77; }
    .g-btn-ai { display:flex; align-items:center; justify-content:center; gap:7px; padding: 9px 16px; background: rgba(191,95,255,0.15); color:${G.purple}; border: 1px solid rgba(191,95,255,0.40); border-radius:8px; font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; cursor:pointer; transition:all 0.2s ease; }
    .g-btn-ai:hover:not(:disabled) { background:rgba(191,95,255,0.28); border-color:rgba(191,95,255,0.7); transform:translateY(-1px); box-shadow: 0 0 16px ${G.purple}55; }
    .g-btn-ai:disabled { opacity:0.35; cursor:not-allowed; }
    .g-btn-review-att { display:flex; align-items:center; justify-content:center; gap:7px; padding: 9px 16px; background: rgba(0,245,160,0.12); color:${G.success}; border: 1px solid rgba(0,245,160,0.35); border-radius:8px; font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; cursor:pointer; transition:all 0.2s ease; }
    .g-btn-review-att:hover:not(:disabled) { background:rgba(0,245,160,0.25); border-color:rgba(0,245,160,0.65); transform:translateY(-1px); box-shadow: 0 0 16px ${G.success}55; }
    .g-btn-review-att:disabled { opacity:0.35; cursor:not-allowed; }
    .g-btn-delete { display:flex; align-items:center; justify-content:center; gap:7px; padding: 9px 14px; background: rgba(255,45,85,0.10); color:${G.danger}; border: 1px solid ${G.dangerBorder}; border-radius:8px; font-family:'Poppins',sans-serif; font-size:12px; font-weight:500; cursor:pointer; transition:all 0.2s ease; }
    .g-btn-delete:hover { background:rgba(255,45,85,0.22); border-color:${G.danger}; transform:translateY(-1px); box-shadow: 0 0 14px ${G.danger}44; }

    .g-input { width:100%; background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:12px 14px; color:${G.textPrimary}; font-size:14px; font-family:'Poppins',sans-serif; transition: border-color 0.2s, box-shadow 0.2s; backdrop-filter: blur(6px); }
    .g-input:focus { border-color:${G.cyan}66; box-shadow:0 0 0 3px rgba(0,212,255,0.15), inset 0 0 0 1px rgba(0,212,255,0.25); }
    .g-label { display:block; font-size:10px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:${G.textMuted}; margin-bottom:8px; font-family:'IBM Plex Mono',monospace; }
    .g-card { background:${G.surface}; border:1px solid rgba(255,255,255,0.10); border-radius:14px; transition: border-color 0.2s, background 0.2s; backdrop-filter: blur(16px); }
    .g-card:hover { border-color:rgba(0,212,255,0.30); background:${G.surfaceMid}; }

    .g-stat-card { background: linear-gradient(135deg, rgba(10,18,40,0.60) 0%, rgba(16,28,58,0.65) 100%); border:1px solid rgba(255,255,255,0.10); border-radius:16px; padding:22px 24px; position:relative; overflow:hidden; transition: all 0.25s ease; backdrop-filter: blur(20px); cursor: pointer; }
    .g-stat-card:hover { border-color:${G.cyan}55; transform:translateY(-5px); box-shadow: 0 12px 40px rgba(0,212,255,0.20), 0 0 30px rgba(0,212,255,0.10); }
    .g-stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background: linear-gradient(90deg, transparent, ${G.cyan}, ${G.purple}, ${G.cyan}, transparent); opacity:0.9; }

    .g-overlay { position:fixed; inset:0; background:rgba(0,0,6,0.80); backdrop-filter:blur(18px); z-index:100; display:flex; align-items:center; justify-content:center; padding:24px; animation:fadeIn 0.25s ease; }
    .g-modal { background: linear-gradient(160deg, rgba(16,26,56,0.92) 0%, rgba(10,18,40,0.95) 100%); border:1px solid rgba(255,255,255,0.12); border-radius:20px; width:100%; max-width:620px; max-height:90vh; overflow-y:auto; animation:scaleIn 0.3s ease; box-shadow: 0 40px 80px rgba(0,0,0,0.8), 0 0 60px rgba(0,212,255,0.08), inset 0 1px 0 rgba(255,255,255,0.12); backdrop-filter: blur(24px); }
    .g-modal-wide { max-width: 920px; }

    .g-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:600; letter-spacing:0.07em; font-family:'IBM Plex Mono',monospace; text-transform:uppercase; }
    .g-badge-gold  { background:${G.goldDim};    color:${G.gold};    border:1px solid ${G.goldBorder}; }
    .g-badge-green { background:${G.successDim}; color:${G.success}; border:1px solid ${G.successBorder}; }
    .g-badge-red   { background:${G.dangerDim};  color:${G.danger};  border:1px solid ${G.dangerBorder}; }
    .g-badge-muted { background:rgba(255,255,255,0.05); color:${G.textSecondary}; border:1px solid rgba(255,255,255,0.12); }
    .pri-high   { background:${G.dangerDim};  color:${G.danger};  border:1px solid ${G.dangerBorder}; }
    .pri-medium { background:rgba(0,212,255,0.10); color:${G.cyan};  border:1px solid rgba(0,212,255,0.35); }
    .pri-low    { background:${G.successDim}; color:${G.success}; border:1px solid ${G.successBorder}; }

    .g-drop { border:2px dashed rgba(255,255,255,0.15); border-radius:12px; padding:24px 16px; text-align:center; cursor:pointer; transition:all 0.2s ease; background:rgba(0,0,0,0.20); }
    .g-drop:hover, .g-drop.drag-over { border-color:${G.cyan}66; background:rgba(0,212,255,0.06); }
    .ai-progress-fill { height:100%; border-radius:3px; background: linear-gradient(90deg, ${G.success}, ${G.cyan}, ${G.purple}, ${G.success}); background-size: 200% 100%; animation: progressBar 1.8s ease-in-out infinite; }
    .glow-dot { width:7px; height:7px; border-radius:50%; animation:shimmer 2s ease infinite; }

    .g-toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%); background: linear-gradient(135deg, rgba(16,28,58,0.95), rgba(22,38,78,0.95)); border:1px solid ${G.cyan}55; border-radius:99px; padding:12px 28px; font-family:'IBM Plex Mono',monospace; font-size:12px; color:${G.textPrimary}; z-index:9999; white-space:nowrap; box-shadow:0 8px 32px rgba(0,0,0,0.7), 0 0 24px ${G.cyan}33; animation:fadeUp 0.3s ease; backdrop-filter: blur(16px); }

    .g-lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.96); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
    .g-lightbox-img { max-width: 90vw; max-height: 85vh; border-radius: 12px; object-fit: contain; box-shadow: 0 0 60px rgba(0,212,255,0.2), 0 40px 80px rgba(0,0,0,0.9); animation: scaleIn 0.25s ease; }
    .g-lightbox-close { position: absolute; top: 20px; right: 24px; width: 40px; height: 40px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 50%; color: white; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10; }
    .g-lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; background: rgba(0,212,255,0.10); border: 1px solid rgba(0,212,255,0.25); border-radius: 50%; color: ${G.cyan}; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .g-lightbox-nav.prev { left: 20px; } .g-lightbox-nav.next { right: 20px; }
    .g-lightbox-nav:disabled { opacity: 0.2; cursor: not-allowed; }
    .g-lightbox-counter { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.1em; }

    .tat-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:10px; font-weight:700; letter-spacing:0.07em; font-family:'IBM Plex Mono',monospace; text-transform:uppercase; background:${G.dangerDim}; color:${G.danger}; border:1px solid ${G.dangerBorder}; animation:tatPulse 2s ease infinite; }

    .g-dt-row { display:flex; gap:0; align-items:stretch; border:1px solid rgba(255,255,255,0.12); border-radius:8px; overflow:hidden; background:rgba(0,0,0,0.40); }
    .g-dt-row input[type="date"] { flex:1; background:transparent; border:none; padding:12px 14px; color:${G.textPrimary}; font-size:14px; font-family:'Poppins',sans-serif; min-width:0; }
    .g-dt-row input[type="date"]:focus { outline:none; box-shadow: inset 0 0 0 2px rgba(0,212,255,0.3); }
    .g-dt-row select { appearance: none; padding-right: 32px !important; }

    .g-slot-btn { padding:0 13px; background:transparent; border:none; border-left:1px solid rgba(255,255,255,0.10); color:${G.textMuted}; font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:600; letter-spacing:0.09em; cursor:pointer; transition:all 0.15s ease; white-space:nowrap; }
    .g-slot-btn:first-child { border-left: none; }
    .g-slot-btn.active { background:linear-gradient(135deg, rgba(0,212,255,0.25), rgba(191,95,255,0.18)); color:${G.cyan}; font-weight:700; box-shadow: inset 0 0 0 1.5px rgba(0,212,255,0.45); }
    .g-slot-btn:hover:not(.active) { color:${G.textSecondary}; background:rgba(255,255,255,0.04); }

    .admin-avatar { width: 48px; height: 48px; border-radius: 10px; background: linear-gradient(135deg, ${G.cyan}, ${G.purple}); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid rgba(0,212,255,0.45); cursor: pointer; transition: all 0.3s ease; position: relative; }
    .admin-avatar:hover { transform: scale(1.06); box-shadow: 0 0 20px ${G.cyan}66; }
    .admin-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .admin-avatar-placeholder { font-size: 22px; color: #fff; }

    .g-task-list-modal { max-width: 860px; max-height: 88vh; }
    .task-list-item { padding: 14px 18px; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; background: rgba(255,255,255,0.03); transition: all 0.2s ease; margin-bottom: 8px; }
    .task-list-item:hover { border-color: ${G.cyan}44; background: rgba(0,212,255,0.05); }

    .neon-divider { height: 1px; background: linear-gradient(90deg, transparent, ${G.cyan}, ${G.purple}, ${G.cyan}, transparent); opacity: 0.6; margin: 0; }

    /* Confirm delete overlay */
    .g-confirm-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(20px); z-index:200; display:flex; align-items:center; justify-content:center; animation:fadeIn 0.2s ease; }
    .g-confirm-box { background:linear-gradient(160deg,rgba(20,8,28,0.98),rgba(10,4,20,0.99)); border:1px solid ${G.dangerBorder}; border-radius:20px; padding:36px 40px; max-width:440px; width:100%; text-align:center; box-shadow:0 0 60px ${G.danger}22, 0 40px 80px rgba(0,0,0,0.9); animation:scaleIn 0.25s ease; }
  `;

  const priClass = (p: string) =>
    p === "high" ? "g-badge pri-high" : p === "low" ? "g-badge pri-low" : "g-badge pri-medium";

  const APPROVAL_COLORS: Record<string, string> = {
    assigned: G.gold, rejected: G.danger, "in-review": G.amber,
    "admin-approved": G.amber, "superadmin-approved": G.success,
    "in-progress": G.purple, completed: G.success, pending: G.textMuted,
  };
  const APPROVAL_LABELS: Record<string, string> = {
    assigned: "Assigned", rejected: "Needs Rework", "in-review": "Under Review",
    "admin-approved": "Admin Approved", "superadmin-approved": "Fully Approved",
    "in-progress": "In Progress", completed: "Completed", pending: "Pending",
  };

  const HOUR_SLOTS = Array.from({ length: 24 }, (_, i) => {
    const hour = i;
    const ampm = hour < 12 ? "AM" : "PM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return {
      value: String(hour).padStart(2, "0") + ":00",
      display: `${String(displayHour).padStart(2, "0")}:00 ${ampm}`,
      hour,
    };
  });

  interface DateTimePickerProps {
    label?: string;
    required?: boolean;
    dateValue: string;
    timeSlot: string;
    onDateChange: (v: string) => void;
    onTimeSlotChange: (v: string) => void;
    hideDateInput?: boolean;
  }

  const DateTimePicker: React.FC<DateTimePickerProps> = ({
    label, required, dateValue, timeSlot, onDateChange, onTimeSlotChange, hideDateInput,
  }) => (
    <div>
      {label && <label className="g-label">{label}{required ? " *" : ""}</label>}
      <div className="g-dt-row">
        {!hideDateInput && (
          <input type="date" value={dateValue} onChange={(e) => onDateChange(e.target.value)}
            style={{ colorScheme: "dark", flex: 1 } as React.CSSProperties} />
        )}
        {hideDateInput && (
          <div style={{ flex: 1, padding: "12px 14px", fontSize: 13, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace", display: "flex", alignItems: "center" }}>
            Select time →
          </div>
        )}
        <select value={timeSlot} onChange={(e) => onTimeSlotChange(e.target.value)}
          style={{ flex: 1, background: "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(191,95,255,0.10))", border: "none", borderLeft: "1px solid rgba(255,255,255,0.10)", padding: "12px 14px", color: G.textPrimary, fontSize: "14px", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2300d4ff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "32px" }}>
          <option value="" disabled>Select a time...</option>
          {HOUR_SLOTS.map((slot) => (
            <option key={slot.value} value={slot.value}>{slot.display}</option>
          ))}
        </select>
      </div>
    </div>
  );

  // ── Task List Modal ────────────────────────────────────────────────────────────
  interface TaskListModalProps {
    title: string;
    tasks: Task[];
    getNameFn: (e: string) => string;
    onClose: () => void;
    onSelectTask?: (t: Task) => void;
    onDeleteTask?: (t: Task) => void;
    accentColor?: string;
  }

  const TaskListModal: React.FC<TaskListModalProps> = ({ title, tasks, getNameFn, onClose, onSelectTask, onDeleteTask, accentColor = G.cyan }) => (
    <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="g-modal g-task-list-modal" style={{ animation: "scaleIn 0.28s ease" }}>
        <div style={{ padding: "24px 28px 18px", borderBottom: `1px solid rgba(255,255,255,0.10)` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: accentColor, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>Task List</div>
              <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, fontWeight: 700, color: G.textPrimary }}>{title}</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: accentColor, background: `${accentColor}18`, border: `1px solid ${accentColor}44`, borderRadius: 99, padding: "3px 12px" }}>
                {tasks.length} tasks
              </span>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: G.textSecondary }}>
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
        <div style={{ padding: "20px 28px 28px", overflowY: "auto", maxHeight: "calc(88vh - 110px)" }}>
          {tasks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 18, color: G.textMuted }}>No tasks in this category</div>
            </div>
          ) : (
            tasks.map((task, idx) => {
              const ac = APPROVAL_COLORS[task.approvalStatus] || G.textMuted;
              return (
                <div key={task.id} className="task-list-item fade-up" style={{ animationDelay: `${idx * 40}ms` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted }}>
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, cursor: onSelectTask ? "pointer" : "default" }} onClick={() => onSelectTask?.(task)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                        <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 14, fontWeight: 600, color: G.textPrimary }}>{task.title}</span>
                        <span className={priClass(task.priority)}><Flag size={8} />{task.priority.toUpperCase()}</span>
                        <span className="g-badge" style={{ background: `${ac}18`, color: ac, border: `1px solid ${ac}33` }}>{APPROVAL_LABELS[task.approvalStatus] || task.approvalStatus}</span>
                      </div>
                      <p style={{ fontSize: 12, color: G.textMuted, lineHeight: 1.5, marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                        {task.description}
                      </p>
                      <div style={{ display: "flex", gap: 14, fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><User size={9} />{getNameFn(task.assignedTo)}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={9} />{new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        {task.timeSlot && <span style={{ color: G.gold }}>· {task.timeSlot}</span>}
                        {task.tatBreached && <span style={{ color: G.danger, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={9} />TAT BREACH</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                      {onSelectTask && (
                        <div style={{ color: G.textMuted, cursor: "pointer" }} onClick={() => onSelectTask(task)}><ChevronRight size={14} /></div>
                      )}
                      {onDeleteTask && (
                        <button
                          className="g-btn-delete"
                          style={{ padding: "6px 10px" }}
                          onClick={(e) => { e.stopPropagation(); onDeleteTask(task); }}
                          title="Delete task"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  // ── Confirm Delete Modal ───────────────────────────────────────────────────────
  interface ConfirmDeleteProps {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }
  const ConfirmDeleteModal: React.FC<ConfirmDeleteProps> = ({ message, onConfirm, onCancel }) => (
    <div className="g-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="g-confirm-box">
        <div style={{ width: 56, height: 56, borderRadius: 14, background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Trash2 size={24} color={G.danger} />
        </div>
        <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, fontWeight: 700, color: G.textPrimary, marginBottom: 12 }}>Confirm Delete</h3>
        <p style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6, marginBottom: 28 }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="g-btn-danger" onClick={onConfirm} style={{ flex: 1 }}><Trash2 size={14} />Delete</button>
          <button className="g-btn-ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  );

  // ── Main Component ─────────────────────────────────────────────────────────────
  const AdminDashboard: React.FC = () => {
    const {
      getTasksForAdminReview, getAssignedTasks, submitTaskCompletion,
      adminReviewTask, logout, user, teamMembers, addTask, projects, updateTask,
      deleteTask, deleteAllTasks,
    } = useUser() as ReturnType<typeof useUser> & {
      deleteTask: (id: string) => void;
      deleteAllTasks: () => void;
    };
    const navigate = useNavigate();

    const allMembers     = teamMembers as TeamMember[];
    const activeProjects = (projects as Project[]).filter((p) => !p.status || p.status === "active");

    const [activeTab,       setActiveTab]       = useState("analytics");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAIPanel,     setShowAIPanel]     = useState(false);
    const [toastMsg,        setToastMsg]        = useState<string | null>(null);
    const [adminProfileImg, setAdminProfileImg] = useState<string | null>(null);
    const [roswalLogo,      setRoswalLogo]      = useState<string | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const profileInputRef = useRef<HTMLInputElement | null>(null);
    const logoInputRef = useRef<HTMLInputElement | null>(null);

    // ── Delete confirmation state ─────────────────────────────────────────────
    const [confirmDelete, setConfirmDelete] = useState<{
      message: string;
      onConfirm: () => void;
    } | null>(null);

    const requestDeleteTask = (task: Task) => {
      setConfirmDelete({
        message: `Delete "${task.title}"? This action cannot be undone.`,
        onConfirm: () => {
          deleteTask(task.id);
          fetch(`http://localhost:5000/api/tasks/${task.id}`, { method: "DELETE" }).catch(() => {});
          toast("🗑 Task deleted.");
          setConfirmDelete(null);
        },
      });
    };

    const requestDeleteAll = () => {
      setConfirmDelete({
        message: `Delete ALL ${allTasksCombined.length} tasks permanently? This cannot be undone.`,
        onConfirm: () => {
          deleteAllTasks();
          fetch("http://localhost:5000/api/tasks/all", { method: "DELETE" }).catch(() => {});
          toast("🗑 All tasks deleted.");
          setConfirmDelete(null);
        },
      });
    };

    // ── Task List Modal (click on stat cards) ────────────────────────────────
    const [showTaskListModal,  setShowTaskListModal]  = useState(false);
    const [taskListModalTitle, setTaskListModalTitle] = useState("");
    const [taskListModalTasks, setTaskListModalTasks] = useState<Task[]>([]);
    const [taskListModalColor, setTaskListModalColor] = useState(G.cyan);

    const openTaskListModal = (title: string, tasks: Task[], color: string) => {
      setTaskListModalTitle(title);
      setTaskListModalTasks(tasks);
      setTaskListModalColor(color);
      setShowTaskListModal(true);
    };

    const [smartAssistTickets, setSmartAssistTickets] = useState<SmartAssistTicket[]>(() => loadTickets());
    const [showSmartAssist,    setShowSmartAssist]    = useState(false);
    const [activeTicket,       setActiveTicket]       = useState<SmartAssistTicket | null>(null);

    const [showGlobalHistory, setShowGlobalHistory] = useState(false);

    const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
    const [lightboxIndex,  setLightboxIndex]  = useState(0);
    const [showLightbox,   setShowLightbox]   = useState(false);

    const [newTask, setNewTask] = useState({
      title: "", description: "", priority: "medium", dueDate: "",
      assignedTo: "", projectId: "", timeSlot: "PM",
    });

    const [showForwardModal, setShowForwardModal] = useState(false);
    const [forwardTask,      setForwardTask]      = useState<Task | null>(null);
    const [forwardTo,        setForwardTo]        = useState("");
    const [forwardNotes,     setForwardNotes]     = useState("");

    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyTask,      setHistoryTask]      = useState<Task | null>(null);

    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selectedTask,    setSelectedTask]    = useState<Task | null>(null);
    const [reviewComments,  setReviewComments]  = useState("");

    const [showSubmitModal,  setShowSubmitModal]  = useState(false);
    const [submitTask,       setSubmitTask]       = useState<Task | null>(null);
    const [submitNotes,      setSubmitNotes]      = useState("");
    const [submitPhotos,     setSubmitPhotos]     = useState<string[]>([]);
    const [submitTimeSlot,   setSubmitTimeSlot]   = useState("PM");
    const [submitDragOver,   setSubmitDragOver]   = useState(false);
    const [aiDrafting,       setAiDrafting]       = useState(false);
    const [aiReviewing,      setAiReviewing]      = useState(false);
    const [aiReviewResults,  setAiReviewResults]  = useState<AIReviewResults | null>(null);
    const [reviewPanelOpen,  setReviewPanelOpen]  = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [backgroundImage,    setBackgroundImage]    = useState<string | null>(null);
    const [useImageBackground, setUseImageBackground] = useState(false);
    const backgroundInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      const loadRoswalLogo = async () => {
        try {
          const response = await fetch("/logos/roswalt-logo-golden-8k.png");
          if (response.ok) {
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onload = (e) => {
              if (typeof e.target?.result === "string") setRoswalLogo(e.target.result);
            };
            reader.readAsDataURL(blob);
          }
        } catch { /* no logo found */ }
      };
      loadRoswalLogo();
    }, []);

  const greetedRef = useRef(false);

  useEffect(() => {
      if (greetedRef.current) return;
      greetedRef.current = true;
      setElevenLabsVoice("EXAVITQu4vr4xnSDxMaL");
     const fullName = (user as { name?: string }).name 
  || localStorage.getItem("fullName") 
  || "there";
setTimeout(() => {
  greetUser(fullName);
}, 800);
    }, []);

    const tasksToReview = (getTasksForAdminReview() as unknown as Task[]).filter(t =>
      t.title && t.description &&
      !t.title.toLowerCase().includes("test") &&
      !t.description.toLowerCase().includes("test")
    );
    const myAssignedTasks = (getAssignedTasks() as unknown as Task[]).filter(t =>
      t.title && t.description &&
      !t.title.toLowerCase().includes("test") &&
      !t.description.toLowerCase().includes("test")
    );
    const myPendingTasks = myAssignedTasks.filter(
      (t) => t.approvalStatus === "assigned" || t.approvalStatus === "rejected"
    );
    const mySubmittedTasks = myAssignedTasks.filter((t) =>
      (["in-review", "admin-approved", "superadmin-approved"] as string[]).includes(t.approvalStatus)
    );

    const assignableAdmins = allMembers.filter(
      (m) => m.role === "admin" && m.email.toLowerCase() !== (user?.email ?? "").toLowerCase()
    );
    const assignableStaff  = allMembers.filter((m) => m.role === "staff");
    const selectedMember   = allMembers.find((m) => m.email === newTask.assignedTo);

    const getName = useCallback(
      (email: string): string => allMembers.find((m) => m.email === email)?.name ?? email,
      [allMembers]
    );
    const isAdminEmail = (email: string): boolean =>
      allMembers.find((m) => m.email === email)?.role === "admin";

    useEffect(() => {
      const cleanup = startTATMonitor(
        () => [...(getTasksForAdminReview() as unknown as TATTask[]), ...(getAssignedTasks() as unknown as TATTask[])],
        getName,
        (_: TATTask[], newTickets: SmartAssistTicket[]) => {
          if (newTickets.length > 0) {
            setSmartAssistTickets((prev) => mergeTickets(prev, newTickets));
            toast(`⚠ ${newTickets.length} TAT breach${newTickets.length !== 1 ? "es" : ""} detected`);
          }
        },
        60_000
      );
      return cleanup;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (!showLightbox) return;
        if (e.key === "Escape")      setShowLightbox(false);
        if (e.key === "ArrowRight")  setLightboxIndex((i) => Math.min(i + 1, lightboxPhotos.length - 1));
        if (e.key === "ArrowLeft")   setLightboxIndex((i) => Math.max(i - 1, 0));
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [showLightbox, lightboxPhotos.length]);

    const allTasksCombined = useMemo<Task[]>(() => {
      const map = new Map<string, Task>();
      [...tasksToReview, ...myAssignedTasks].forEach((t) => map.set(t.id, t));
      return Array.from(map.values());
    }, [tasksToReview, myAssignedTasks]);

    const analytics = useMemo(() => {
      const allTasks        = allTasksCombined;
      const totalTasks      = allTasks.length;
      const completedTasks  = allTasks.filter((t) => t.approvalStatus === "superadmin-approved").length;
      const pendingTasks    = allTasks.filter(
        (t) => t.approvalStatus === "assigned" || (t.approvalStatus as string) === "pending"
      ).length;
      const inProgressTasks = allTasks.filter((t) =>
        (["in-review", "admin-approved"] as string[]).includes(t.approvalStatus)
      ).length;
      const tatBreachedCount  = allTasks.filter((t) => t.tatBreached).length;
      const completionRate    = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const activeTicketCount = countActiveTickets(smartAssistTickets);

      const tasksPerStaff: Record<string, number> = {};
      allTasks.forEach((task) => {
        tasksPerStaff[task.assignedTo] = (tasksPerStaff[task.assignedTo] ?? 0) + 1;
      });

      const completedWithTime = allTasks.filter((t) => t.completedAt && t.createdAt);
      let avgMs = 0;
      if (completedWithTime.length > 0) {
        avgMs = completedWithTime.reduce(
          (acc, t) => acc + (new Date(t.completedAt!).getTime() - new Date(t.createdAt!).getTime()), 0
        ) / completedWithTime.length;
      }
      const avgCompletionTime = avgMs > 0 ? `${(avgMs / (1000 * 60 * 60 * 24)).toFixed(1)}d` : "—";

      const chartData = totalTasks === 0
        ? [
            { name: "Week 1", rate: 0,  target: 30 },
            { name: "Week 2", rate: 0,  target: 50 },
            { name: "Week 3", rate: 0,  target: 70 },
            { name: "Week 4", rate: 0,  target: 85 },
          ]
        : [
            { name: "Week 1", rate: Math.round(completionRate * 0.30), target: 30 },
            { name: "Week 2", rate: Math.round(completionRate * 0.55), target: 50 },
            { name: "Week 3", rate: Math.round(completionRate * 0.78), target: 70 },
            { name: "Week 4", rate: completionRate,                    target: 85 },
          ];

      return {
        totalTasks, completedTasks, pendingTasks, inProgressTasks,
        completionRate, avgCompletionTime, tatBreachedCount, activeTicketCount,
        chartData,
        tasksByStatus: {
          approved:  allTasks.filter((t) => t.approvalStatus === "superadmin-approved").length,
          inProcess: inProgressTasks, pending: pendingTasks, completed: completedTasks,
        },
        tasksPerStaff,
        allTasks,
      };
    }, [allTasksCombined, smartAssistTickets]);

    const toast = (msg: string): void => {
      setToastMsg(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
    };

    // ── Sync task updates to backend ──────────────────────────────────────────
    const syncTaskToBackend = async (task: Task): Promise<void> => {
      try {
        await fetch(`http://localhost:5000/api/tasks/${task.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
        });
      } catch (error) {
        console.error("Failed to sync task to backend:", error);
      }
    };

    const handleProfileImageUpload = (files: FileList | null): void => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) { toast("⚠ Please upload an image file."); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") { setAdminProfileImg(e.target.result); toast("✓ Profile photo updated"); }
      };
      reader.readAsDataURL(file);
    };

    const handleBackgroundImageUpload = (files: FileList | null): void => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) { toast("⚠ Please upload an image file."); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") { setBackgroundImage(e.target.result); setUseImageBackground(true); toast("✓ Background image set"); }
      };
      reader.readAsDataURL(file);
    };

    const handleLogoUpload = (files: FileList | null): void => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) { toast("⚠ Please upload an image file."); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") { setRoswalLogo(e.target.result); toast("✓ Logo updated"); }
      };
      reader.readAsDataURL(file);
    };

    const openLightbox = (photos: string[], index = 0): void => {
      setLightboxPhotos(photos); setLightboxIndex(index); setShowLightbox(true);
    };

    const openSubmitModal = (task: Task): void => {
      setSubmitTask(task);
      setSubmitNotes(task.completionNotes ?? "");
      setSubmitPhotos(task.attachments ?? []);
      setSubmitTimeSlot(task.timeSlot ?? "PM");
      setAiReviewResults(null); setReviewPanelOpen(false);
      setShowSubmitModal(true);
    };

    const closeSubmitModal = (): void => {
      setShowSubmitModal(false); setSubmitTask(null); setSubmitNotes("");
      setSubmitPhotos([]); setAiReviewResults(null); setReviewPanelOpen(false);
    };

    const handlePhotoAdd = (files: FileList | null): void => {
      if (!files) return;
      Array.from(files).forEach((file: File) => {
        if (!file.type.startsWith("image/")) return;
        const r = new FileReader();
        r.onload = (e) => {
          if (typeof e.target?.result === "string") {
            setSubmitPhotos((prev) => [...prev, e.target!.result as string]);
            setAiReviewResults(null);
          }
        };
        r.readAsDataURL(file);
      });
      toast("Photo uploaded ✓");
    };

    const removePhoto = (i: number): void => {
      setSubmitPhotos((prev) => prev.filter((_, idx) => idx !== i));
      setAiReviewResults(null);
    };

    const openSmartAssist = (task: Task): void => {
      const ticket = getTicketForTask(smartAssistTickets, task.id);
      setActiveTicket(
        ticket ?? {
          id: `sa_${task.id}`, taskId: task.id, taskTitle: task.title,
          assignedTo: task.assignedTo, assignedToName: getName(task.assignedTo),
          assignedBy: task.assignedBy, assignedByName: getName(task.assignedBy ?? ""),
          delayDuration: task.smartAssist?.delayDuration ?? "Unknown",
          originalDeadline: task.exactDeadline ?? computeExactDeadline(task.dueDate, task.timeSlot ?? "PM"),
          timeSlot: task.timeSlot ?? "PM", reminderCount: task.smartAssist?.reminderCount ?? 1,
          status: "open", lastReminderAt: new Date().toISOString(),
        }
      );
      setShowSmartAssist(true);
    };

    const handleSmartAssistSubmit = ({ revisedDate, revisedTimeSlot, delayReason }: { revisedDate: string; revisedTimeSlot: string; delayReason: string }): void => {
      if (!activeTicket) return;
      setSmartAssistTickets(submitRevision(smartAssistTickets, activeTicket.taskId, { revisedDate, revisedTimeSlot, delayReason }));
      toast("✓ Revised timeline submitted");
    };

    const handleSubmitTask = (): void => {
      if (!submitTask) return;
      if (!submitNotes.trim()) { toast("⚠ Please add completion notes."); return; }
      if (aiReviewResults?.hasErrors) { toast("⚠ Fix attachment errors before submitting."); return; }
      const histEntry: HistoryEntry = {
        id: `hist_${Date.now()}`, timestamp: new Date().toISOString(),
        action: "completed", by: user?.email ?? "", notes: submitNotes,
      };
      const updatedTask = {
        ...submitTask, completionNotes: submitNotes, attachments: submitPhotos,
        timeSlot: submitTimeSlot, exactDeadline: computeExactDeadline(submitTask.dueDate, submitTimeSlot),
        history: [...(submitTask.history ?? []), histEntry], completedAt: new Date().toISOString(),
      };
      updateTask(submitTask.id, {
        ...submitTask, completionNotes: submitNotes, attachments: submitPhotos,
        timeSlot: submitTimeSlot, exactDeadline: computeExactDeadline(submitTask.dueDate, submitTimeSlot),
        history: [...(submitTask.history ?? []), histEntry], completedAt: new Date().toISOString(),
      } as never);
      setSmartAssistTickets(resolveTicket(smartAssistTickets, submitTask.id));
      submitTaskCompletion(submitTask.id, submitNotes);
      closeSubmitModal();
      toast("✓ Task submitted for review.");
    };

    const handleAIDraft = async (): Promise<void> => {
      if (!submitTask || !submitNotes.trim()) { toast("⚠ Write some notes first."); return; }
      setAiDrafting(true);
      try {
        const res = await fetch("http://localhost:5000/api/draft-notes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: submitTask.id, notes: submitNotes }),
        });
        if (!res.ok) { toast(`✕ ${(await res.json() as { message: string }).message}`); return; }
        const { improvedNotes } = await res.json() as { improvedNotes?: string };
        setSubmitNotes(improvedNotes || submitNotes);
        toast("✨ Notes improved by AI!");
      } catch { toast("✕ Backend not running. Run: npm start"); }
      finally { setAiDrafting(false); }
    };

    const handleAIReview = async (): Promise<void> => {
      if (!submitTask || submitPhotos.length === 0) { toast("⚠ Upload attachments first."); return; }
      setAiReviewing(true); setAiReviewResults(null);
      try {
        const contentArray: Array<Record<string, unknown>> = [
          { type: "text", text: `Review each image. Return ONLY JSON:[{"image":1,"status":"CLEAN|MINOR|ERROR","issues":[],"recommendations":"..."}]` },
        ];
        for (const photo of submitPhotos) {
          let base64 = photo, mime = "image/jpeg";
          if (photo.startsWith("data:")) {
            const m = photo.match(/data:([^;]+);base64,(.+)/);
            if (m) { mime = m[1]; base64 = m[2]; }
          }
          contentArray.push({ type: "image", source: { type: "base64", media_type: mime, data: base64 } });
        }
        const res = await fetch("http://localhost:5000/api/review-attachments", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: submitTask.id, contentArray }),
        });
        if (!res.ok) { toast(`✕ ${(await res.json() as { message: string }).message}`); return; }
        const data = await res.json() as { results?: AIReviewResult[]; hasErrors?: boolean };
        setAiReviewResults({ results: data.results ?? [], hasErrors: data.hasErrors ?? false, timestamp: new Date().toISOString() });
        setReviewPanelOpen(true);
        toast(data.hasErrors ? "⚠ Errors found — fix before submitting." : "✓ All attachments clear!");
      } catch { toast("✕ Backend not running. Run: npm start"); }
      finally { setAiReviewing(false); }
    };

    const handleForwardTask = (): void => {
      if (!forwardTask || !forwardTo) { toast("⚠ Please select a team member."); return; }
      const h: HistoryEntry = { id: `hist_${Date.now()}`, timestamp: new Date().toISOString(), action: "forwarded", by: user?.email ?? "", to: forwardTo, notes: forwardNotes };
      const updatedTask = { ...forwardTask, assignedTo: forwardTo, assignedBy: user?.email, forwardedFrom: forwardTask.assignedTo, history: [...(forwardTask.history ?? []), h] };
      updateTask(forwardTask.id, updatedTask as never);
      syncTaskToBackend(updatedTask as Task);
      toast(`✓ Task forwarded to ${getName(forwardTo)}`);
      setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes("");
    };

  const handleApprove = (): void => {
    if (!selectedTask) return;
    const h: HistoryEntry = { id: `hist_${Date.now()}`, timestamp: new Date().toISOString(), action: "approved", by: user?.email ?? "", notes: reviewComments };
    const updatedTask = { ...selectedTask, history: [...(selectedTask.history ?? []), h] };
    updateTask(selectedTask.id, updatedTask as never);
    syncTaskToBackend(updatedTask as Task);

    // ── ADD THIS ──
    const assignee = allMembers.find((m) => m.email === selectedTask.assignedTo);
    sendTaskWhatsApp({
      recipientPhone:  assignee?.phone ?? "",
      taskTitle:       selectedTask.title,
      taskDescription: `✅ Your task has been APPROVED by ${(user as { name?: string }).name ?? user?.email ?? "Admin"}. ${reviewComments ? "Notes: " + reviewComments : ""}`,
      priority:        selectedTask.priority,
      dueDate:         selectedTask.dueDate,
    timeSlot: selectedTask.timeSlot ?? "",
      assignedByName:  (user as { name?: string }).name ?? user?.email ?? "Admin",
      projectName:     activeProjects.find((p) => p.id === selectedTask.projectId)?.name ?? "—",
      taskId:          selectedTask.id,
    });
    // ── END ADD ──

    adminReviewTask(selectedTask.id, true, reviewComments);
    setShowReviewModal(false); setSelectedTask(null); setReviewComments("");
    toast("✓ Approved — forwarded to Superadmin.");
  };

    // ── handleRework ──────────────────────────────────────────────────────────
    const handleRework = (): void => {
      if (!selectedTask) return;
      if (!reviewComments.trim()) { toast("⚠ Add a reason for rework."); return; }
      const h: HistoryEntry = {
        id: `hist_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "rejected",
        by: user?.email ?? "",
        notes: reviewComments,
      };
      const updatedTask = {
        ...selectedTask,
        approvalStatus: "rejected" as const,
        adminComments: reviewComments,
        history: [...(selectedTask.history ?? []), h],
      };
      updateTask(selectedTask.id, updatedTask as never);
      syncTaskToBackend(updatedTask as Task);
      adminReviewTask(selectedTask.id, false, reviewComments);
      setShowReviewModal(false); setSelectedTask(null); setReviewComments("");
      toast("↩ Sent back for rework.");
    };

    // ── handleCreateTask ──────────────────────────────────────────────────────
  const handleCreateTask = (): void => {
      if (!newTask.title || !newTask.description || !newTask.assignedTo || !newTask.dueDate) {
        toast("⚠ Fill all required fields.");
        return;
      }
      if (!newTask.projectId) {
        toast("⚠ Select a project.");
        return;
      }

      const member = allMembers.find((m) => m.email === newTask.assignedTo);
      if (!member) {
        toast("⚠ Selected member not found.");
        return;
      }
      const taskId        = crypto.randomUUID();
      const exactDeadline = computeExactDeadline(newTask.dueDate, newTask.timeSlot);
      const now           = new Date().toISOString();

      const history: HistoryEntry[] = [
        { id: crypto.randomUUID(), timestamp: now, action: "created",  by: user?.email ?? "", to: newTask.assignedTo },
        { id: crypto.randomUUID(), timestamp: now, action: "assigned", by: user?.email ?? "", to: newTask.assignedTo },
      ];

  // ── Voice callout to doer ──
      announceVoice("task_assigned");

      const newTaskObj: Task = {
        id:             taskId,
        title:          newTask.title,
        description:    newTask.description,
        status:         "pending",
        approvalStatus: "assigned",
        priority:       newTask.priority as Task["priority"],
        dueDate:        newTask.dueDate,
        assignedTo:     newTask.assignedTo,
        assignedBy:     user?.email ?? "",
        projectId:      newTask.projectId,
        timeSlot:       newTask.timeSlot,
        exactDeadline,
        history,
        createdAt:      now,
      };

      addTask(newTaskObj as never);
      
      syncTaskToBackend(newTaskObj).then(() => {
      console.log("✅ Task created with history:", history);
    }).catch(err => {
      console.error("❌ Backend sync failed:", err);
      toast("⚠ Task created locally but backend sync failed");
    });
      

  if (member.phone) {
        try {
          sendTaskWhatsApp({
            recipientPhone:  member.phone,
            taskTitle:       newTask.title,
            taskDescription: newTask.description,
            priority:        newTask.priority as "high" | "medium" | "low",
            dueDate:         newTask.dueDate,
            timeSlot:        newTask.timeSlot,
            assignedByName:  (user as { name?: string }).name ?? user?.email ?? "Admin",
            projectName:     activeProjects.find((p) => p.id === newTask.projectId)?.name ?? "—",
            taskId,
          });
          toast(`✓ Task assigned to ${member.name} — WhatsApp sent to ${member.phone}`);
        } catch (err) {
          console.error("WhatsApp send failed:", err);
          toast(`✓ Task assigned to ${member.name} — ⚠ WhatsApp failed`);
        }
      } else {
        toast(`✓ Task assigned to ${member.name} — ⚠ No phone on file (WhatsApp skipped)`);
        console.warn(`WhatsApp skipped: "${member.name}" (${member.email}) has no phone number.`);
      }

      setNewTask({ title: "", description: "", priority: "medium", dueDate: "", assignedTo: "", projectId: "", timeSlot: "PM" });
      setShowCreateModal(false);
    };  // ← this closing brace for handleCreateTask MUST be here

    // ── handleLogout ──────────────────────────────────────────────────────────
    const handleLogout = (): void => {
      if (window.confirm("Sign out?")) { logout(); navigate("/login", { replace: true }); }
    };

    const activeSmartAssistCount = countActiveTickets(smartAssistTickets);

    const TABS = [
      { id: "analytics", label: "Analytics", icon: TrendingUp },
      { id: "overview",  label: "Overview",  icon: BarChart3 },
      { id: "review",    label: "Review",    icon: Eye },
      { id: "mytasks",   label: "My Tasks",  icon: User },
      { id: "progress",  label: "Progress",  icon: Activity },
      { id: "taskmap",   label: "Task Map",  icon: GitBranch },
    ];

    const statCards = [
      {
        label: "Pending Review", accent: G.gold, icon: Clock,
        value: analytics.tasksByStatus.pending,
        tasks: allTasksCombined.filter(t => t.approvalStatus === "assigned" || (t.approvalStatus as string) === "pending"),
      },
      {
        label: "In Progress", accent: G.purple, icon: Activity,
        value: analytics.tasksByStatus.inProcess,
        tasks: allTasksCombined.filter(t => (["in-review", "admin-approved"] as string[]).includes(t.approvalStatus)),
      },
      {
        label: "Approved", accent: G.success, icon: CheckCircle,
        value: analytics.tasksByStatus.approved,
        tasks: allTasksCombined.filter(t => t.approvalStatus === "superadmin-approved"),
      },
      {
        label: "TAT Breached", accent: G.danger, icon: AlertTriangle,
        value: analytics.tatBreachedCount,
        tasks: allTasksCombined.filter(t => t.tatBreached),
      },
    ];

    // ════════════════════════════════════════════════════════════════════════════
    return (
      <>
        <style>{CSS}</style>

        {/* Background layer */}
        {useImageBackground && backgroundImage ? (
          <img src={backgroundImage} alt="Background" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: -1, opacity: 0.45 }} />
        ) : (
          <video style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: -1, opacity: 1 }}
            autoPlay muted loop playsInline preload="auto">
            <source src="/videos/5658021_Coll_wavebreak_Animation_1280x720.mp4" type="video/mp4" />
          </video>
        )}

        <input ref={backgroundInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleBackgroundImageUpload(e.target.files)} />

        <div style={{ minHeight: "100vh", position: "relative" }}>
          <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "0 28px" }}>

            {/* ── HEADER ── */}
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", position: "sticky", top: 0, zIndex: 50, background: "transparent", backdropFilter: "blur(28px)", borderBottom: "1px solid rgba(255,255,255,0.08)", boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 -1px 0 ${G.cyan}22` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>

                {/* Logo */}
                <div style={{ width: 56, height: 56, borderRadius: 12, background: roswalLogo ? "transparent" : `linear-gradient(135deg, ${G.gold}44, ${G.amber}22)`, border: `2px solid ${G.gold}66`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", boxShadow: `0 0 20px ${G.gold}33` }}
                  onClick={() => logoInputRef.current?.click()} title="Click to update logo">
                  {roswalLogo ? <img src={roswalLogo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} /> : <span style={{ fontSize: 28 }}>♞</span>}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleLogoUpload(e.target.files)} />

                {/* BG Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: 3 }}>
                  <button onClick={() => { if (useImageBackground) setUseImageBackground(false); else backgroundInputRef.current?.click(); }}
                    style={{ padding: "5px 10px", background: !useImageBackground ? "rgba(0,212,255,0.15)" : "transparent", border: !useImageBackground ? `1px solid ${G.cyan}44` : "1px solid transparent", borderRadius: 5, color: !useImageBackground ? G.cyan : G.textMuted, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase" as const }}>
                    🎬 Video
                  </button>
                  <button onClick={() => backgroundInputRef.current?.click()}
                    style={{ padding: "5px 10px", background: useImageBackground ? "rgba(255,224,102,0.15)" : "transparent", border: useImageBackground ? `1px solid ${G.gold}44` : "1px solid transparent", borderRadius: 5, color: useImageBackground ? G.gold : G.textMuted, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase" as const }}>
                    🖼️ Image {backgroundImage ? "✓" : ""}
                  </button>
                </div>

                {/* Title */}
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, background: `linear-gradient(90deg, ${G.cyan} 0%, #60efff 20%, ${G.gold} 50%, #60efff 80%, ${G.cyan} 100%)`, backgroundSize: "300% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1, animation: "gradient-shift 8s ease infinite" } as React.CSSProperties}>
                    Admin <em>Control</em>
                  </div>
                  <div style={{ fontSize: 9, color: G.gold, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.18em", textTransform: "uppercase" as const, fontWeight: 700 }}>ROSWALT REALTY</div>
                </div>

                {/* Avatar */}
                <div className="admin-avatar glow" onClick={() => profileInputRef.current?.click()} title="Change profile photo" style={{ marginLeft: 8 }}>
                  {adminProfileImg ? <img src={adminProfileImg} alt="Admin" /> : <div style={{ fontSize: 22 }}>👤</div>}
                </div>
                <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleProfileImageUpload(e.target.files)} />

                {user && <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, marginLeft: 6, letterSpacing: "0.10em", textTransform: "uppercase" as const }}>{(user as { name?: string }).name} · {user.email}</div>}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {activeSmartAssistCount > 0 && (
                  <button onClick={() => { setActiveTicket(null); setShowSmartAssist(true); }} className="tat-badge" style={{ cursor: "pointer", border: "none" }}>
                    <AlertTriangle size={11} /> {activeSmartAssistCount} TAT Breach{activeSmartAssistCount !== 1 ? "es" : ""}
                  </button>
                )}
                <button onClick={() => setShowGlobalHistory(true)} className="g-btn-ghost" style={{ padding: "9px 13px" }}><History size={15} /></button>

                {/* ── DELETE ALL TASKS BUTTON ── */}
                {allTasksCombined.length > 0 && (
                  <button
                    className="g-btn-delete"
                    style={{ padding: "9px 14px", gap: 6 }}
                    onClick={requestDeleteAll}
                    title={`Delete all ${allTasksCombined.length} tasks`}
                  >
                    <Trash2 size={14} />
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.06em" }}>
                      Delete All ({allTasksCombined.length})
                    </span>
                  </button>
                )}

                <div style={{ display: "flex", gap: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: 3 }}>
                  {TABS.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", background: activeTab === tab.id ? "rgba(0,212,255,0.14)" : "transparent", color: activeTab === tab.id ? G.cyan : G.textSecondary, border: activeTab === tab.id ? `1px solid ${G.cyan}44` : "1px solid transparent", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.2s", position: "relative" as const }}>
                      <tab.icon size={12} />{tab.label}
                      {tab.id === "review"  && tasksToReview.length > 0 && <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: G.danger, borderRadius: "50%", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{tasksToReview.length}</span>}
                      {tab.id === "mytasks" && myPendingTasks.length > 0 && <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, background: G.danger, borderRadius: "50%", fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{myPendingTasks.length}</span>}
                    </button>
                  ))}
                </div>
                <button className="g-btn-gold" onClick={() => setShowCreateModal(true)}><Plus size={14} strokeWidth={2.5} />New Task</button>
                <button className="g-btn-ghost" onClick={() => setShowAIPanel(!showAIPanel)} style={{ padding: "9px 13px", borderColor: showAIPanel ? `${G.cyan}55` : undefined }}><MessageSquare size={16} color={showAIPanel ? G.cyan : undefined} /></button>
                <button className="g-btn-ghost" onClick={handleLogout} style={{ padding: "9px 13px" }}><LogOut size={16} /></button>
              </div>
            </header>

            {showAIPanel && (
              <div style={{ marginTop: 20, height: 500, borderRadius: 16, overflow: "hidden", border: `1px solid ${G.cyan}33` }}>
                <ClaudeChat theme="amber" />
              </div>
            )}

            {/* ══ ANALYTICS TAB ══ */}
            {activeTab === "analytics" && (
              <section style={{ marginTop: 32, paddingBottom: 60 }}>
                <div style={{ marginBottom: 28 }}>
                  <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 30, fontWeight: 700, color: G.textPrimary, marginBottom: 4 }}>
                    Task <em style={{ color: G.cyan }}>Analytics</em>
                  </h2>
                  <div className="neon-divider" style={{ marginBottom: 8 }} />
                  <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, letterSpacing: "0.10em", textTransform: "uppercase" as const }}>Real-time performance metrics — click any card to drill down</p>
                </div>

                {/* Key Metrics Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 28 }}>
                  {[
                    { title: "Total Tasks",     value: analytics.totalTasks,       subtitle: "All time",          color: G.cyan,    tasks: analytics.allTasks },
                    { title: "Completion Rate", value: `${analytics.completionRate}%`, subtitle: "Success ratio",  color: G.success, tasks: analytics.allTasks.filter(t => t.approvalStatus === "superadmin-approved") },
                    { title: "Avg Completion",  value: analytics.avgCompletionTime,subtitle: "Per task",           color: G.purple,  tasks: analytics.allTasks.filter(t => t.completedAt) },
                    { title: "Active Tasks",    value: analytics.inProgressTasks,  subtitle: "In progress",        color: G.amber,   tasks: analytics.allTasks.filter(t => (["in-review","admin-approved"] as string[]).includes(t.approvalStatus)) },
                    { title: "TAT Breached",    value: analytics.tatBreachedCount, subtitle: "Deadline misses",    color: G.danger,  tasks: analytics.allTasks.filter(t => t.tatBreached) },
                    { title: "Smart Assist",    value: analytics.activeTicketCount,subtitle: "Open escalations",   color: G.amber,   tasks: [] },
                  ].map((card, i) => (
                    <div key={i} className="g-stat-card fade-up" style={{ animationDelay: `${i * 60}ms` }}
                      onClick={() => card.tasks.length > 0 && openTaskListModal(card.title, card.tasks, card.color)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{card.title}</div>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: card.color, boxShadow: `0 0 12px ${card.color}` }} />
                      </div>
                      <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 40, fontWeight: 700, color: card.color, lineHeight: 1, marginBottom: 8, textShadow: `0 0 20px ${card.color}55` }}>{card.value}</div>
                      <div style={{ fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>{card.subtitle}</div>
                      {card.tasks.length > 0 && <div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 9, color: `${card.color}88`, fontFamily: "'IBM Plex Mono',monospace" }}>click to view ›</div>}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${card.color}66,transparent)` }} />
                    </div>
                  ))}
                </div>

                {/* SVG gradient defs */}
                <svg width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
                  <defs>
                    <linearGradient id="barG0" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#00ffb3" stopOpacity="1"/><stop offset="40%" stopColor="#00f5a0" stopOpacity="1"/><stop offset="100%" stopColor="#00874d" stopOpacity="0.65"/>
                    </linearGradient>
                    <linearGradient id="barG1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#e040fb" stopOpacity="1"/><stop offset="40%" stopColor="#bf5fff" stopOpacity="1"/><stop offset="100%" stopColor="#5c0099" stopOpacity="0.65"/>
                    </linearGradient>
                    <linearGradient id="barG2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#fff176" stopOpacity="1"/><stop offset="40%" stopColor="#ffe066" stopOpacity="1"/><stop offset="100%" stopColor="#b35c00" stopOpacity="0.65"/>
                    </linearGradient>
                    <linearGradient id="barG3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#ff6b8a" stopOpacity="1"/><stop offset="40%" stopColor="#ff2d55" stopOpacity="1"/><stop offset="100%" stopColor="#7a0011" stopOpacity="0.65"/>
                    </linearGradient>
                    <radialGradient id="pieG0" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor="#00ffb3"/><stop offset="100%" stopColor="#00874d"/></radialGradient>
                    <radialGradient id="pieG1" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor="#e040fb"/><stop offset="100%" stopColor="#5c0099"/></radialGradient>
                    <radialGradient id="pieG2" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor="#fff176"/><stop offset="100%" stopColor="#b35c00"/></radialGradient>
                    <radialGradient id="pieG3" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#0057a8"/></radialGradient>
                  </defs>
                </svg>

                {/* Charts Row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 20, marginBottom: 20 }}>

                  {/* BAR CHART */}
                  <div style={{ background: "linear-gradient(145deg, rgba(4,8,22,0.92) 0%, rgba(10,18,48,0.88) 100%)", border: "1px solid rgba(0,212,255,0.28)", borderRadius: 20, padding: "26px 24px 16px", backdropFilter: "blur(28px)", boxShadow: "0 0 0 1px rgba(0,212,255,0.08), 0 12px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                      <div>
                        <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 17, fontWeight: 700, color: "#f0f4ff", letterSpacing: "0.03em", marginBottom: 3 }}>Task Status Breakdown</h3>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#00d4ff88", letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Live data · All tasks</div>
                      </div>
                      <div style={{ display: "flex", gap: 5 }}>
                        {["#00ffb3","#e040fb","#fff176","#ff6b8a"].map((c, i) => (
                          <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, boxShadow: `0 0 14px ${c}` }} />
                        ))}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={[
                        { name: "Completed",   value: analytics.completedTasks,   fill: "url(#barG0)" },
                        { name: "In Progress", value: analytics.inProgressTasks,  fill: "url(#barG1)" },
                        { name: "Pending",     value: analytics.pendingTasks,     fill: "url(#barG2)" },
                        { name: "TAT Breach",  value: analytics.tatBreachedCount, fill: "url(#barG3)" },
                      ]} margin={{ top: 10, right: 10, left: -10, bottom: 4 }} barCategoryGap="38%">
                        <CartesianGrid strokeDasharray="1 8" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="name" stroke="transparent" tick={{ fill: "#7890b0", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis stroke="transparent" tick={{ fill: "#7890b0", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: "rgba(0,212,255,0.04)" }} contentStyle={{ background: "rgba(2,6,20,0.98)", border: "1px solid rgba(0,212,255,0.35)", borderRadius: 12, color: "#f0f4ff", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }} labelStyle={{ color: "#00d4ff", fontWeight: 700 }} />
                        <Bar dataKey="value" radius={[10, 10, 2, 2]} maxBarSize={58}>
                          {(["url(#barG0)","url(#barG1)","url(#barG2)","url(#barG3)"] as string[]).map((fill, idx) => (
                            <Cell key={idx} fill={fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      {[{label:"Completed",c:"#00ffb3"},{label:"In Progress",c:"#e040fb"},{label:"Pending",c:"#fff176"},{label:"TAT Breach",c:"#ff6b8a"}].map((item,i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "#7890b0", fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                          <div style={{ width: 10, height: 4, borderRadius: 99, background: item.c, boxShadow: `0 0 10px ${item.c}` }} />{item.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PIE CHART */}
                  <div style={{ background: "linear-gradient(145deg, rgba(4,8,22,0.92) 0%, rgba(14,10,44,0.88) 100%)", border: "1px solid rgba(191,95,255,0.30)", borderRadius: 20, padding: "26px 24px 16px", backdropFilter: "blur(28px)", boxShadow: "0 0 0 1px rgba(191,95,255,0.08), 0 12px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                      <div>
                        <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 17, fontWeight: 700, color: "#f0f4ff", letterSpacing: "0.03em", marginBottom: 3 }}>Status Distribution</h3>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#bf5fff88", letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Proportional breakdown</div>
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#bf5fff", letterSpacing: "0.14em", textTransform: "uppercase" as const, background: "rgba(191,95,255,0.12)", border: "1px solid rgba(191,95,255,0.30)", borderRadius: 99, padding: "4px 12px" }}>● LIVE</div>
                    </div>
                    {analytics.totalTasks === 0 ? (
                      <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                        <div style={{ width: 80, height: 80, borderRadius: "50%", border: `2px dashed ${G.purple}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <BarChart3 size={28} color={G.textMuted} />
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: G.textMuted, letterSpacing: "0.10em" }}>No data yet</div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Approved",    value: analytics.tasksByStatus.approved  || 0 },
                              { name: "In Progress", value: analytics.tasksByStatus.inProcess || 0 },
                              { name: "Pending",     value: analytics.tasksByStatus.pending   || 0 },
                              { name: "Completed",   value: analytics.tasksByStatus.completed || 0 },
                            ]}
                            cx="50%" cy="48%" innerRadius={54} outerRadius={96} paddingAngle={5} dataKey="value" labelLine={false}
                            label={({ name, value, cx: pcx, cy: pcy, midAngle, outerRadius: por }: { name?: string; value?: number; cx?: number; cy?: number; midAngle?: number; outerRadius?: number }) => {
                              if ((value ?? 0) === 0) return null;
                              const RAD = Math.PI / 180;
                              const rad = (por ?? 96) + 22;
                              const x = (pcx ?? 0) + rad * Math.cos(-((midAngle ?? 0) * RAD));
                              const y = (pcy ?? 0) + rad * Math.sin(-((midAngle ?? 0) * RAD));
                              return <text x={x} y={y} fill="#b8c8e8" textAnchor={x > (pcx ?? 0) ? "start" : "end"} dominantBaseline="central" style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>{value}</text>;
                            }}
                          >
                            {[{ fill: "url(#pieG0)", stroke: "#00ffb3" },{ fill: "url(#pieG1)", stroke: "#e040fb" },{ fill: "url(#pieG2)", stroke: "#fff176" },{ fill: "url(#pieG3)", stroke: "#22d3ee" }].map((s, idx) => (
                              <Cell key={idx} fill={s.fill} stroke={`${s.stroke}77`} strokeWidth={3} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "rgba(2,6,20,0.98)", border: "1px solid rgba(191,95,255,0.40)", borderRadius: 12, color: "#f0f4ff", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }} labelStyle={{ color: "#bf5fff", fontWeight: 700 }} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: "#7890b0", textTransform: "uppercase" as const, letterSpacing: "0.08em", paddingTop: 4 }} formatter={(value) => <span style={{ color: "#b8c8e8" }}>{value}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* AREA CHART */}
                <div style={{ background: "linear-gradient(145deg, rgba(4,8,22,0.92) 0%, rgba(6,18,36,0.88) 100%)", border: "1px solid rgba(0,245,160,0.28)", borderRadius: 20, padding: "26px 24px 16px", backdropFilter: "blur(28px)", boxShadow: "0 0 0 1px rgba(0,245,160,0.07), 0 12px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                    <div>
                      <h3 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 17, fontWeight: 700, color: "#f0f4ff", letterSpacing: "0.03em", marginBottom: 3 }}>Completion Rate Trend</h3>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#00f5a088", letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Weekly performance vs target</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 22, height: 3, borderRadius: 99, background: "linear-gradient(90deg,#00ffb3,#00d4ff,#bf5fff,#ff2d55)" }} />
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#00d4ff", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Actual</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 22, height: 2, borderRadius: 99, background: "#ffe06655", borderTop: "2px dashed #ffe06699" }} />
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#ffe066", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Target</span>
                      </div>
                      {analytics.totalTasks === 0 && (
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "3px 10px" }}>
                          No tasks yet
                        </span>
                      )}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={analytics.chartData} margin={{ top: 14, right: 24, left: -12, bottom: 5 }}>
                      <defs>
                        <linearGradient id="areaGradMain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#00ffb3" stopOpacity="0.55"/>
                          <stop offset="35%"  stopColor="#00d4ff" stopOpacity="0.28"/>
                          <stop offset="75%"  stopColor="#bf5fff" stopOpacity="0.10"/>
                          <stop offset="100%" stopColor="#00d4ff" stopOpacity="0"/>
                        </linearGradient>
                        <linearGradient id="areaGradTarget" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#fff176" stopOpacity="0.22"/>
                          <stop offset="100%" stopColor="#ff9f0a" stopOpacity="0"/>
                        </linearGradient>
                        <linearGradient id="areaLineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%"   stopColor="#00ffb3"/>
                          <stop offset="30%"  stopColor="#00d4ff"/>
                          <stop offset="65%"  stopColor="#bf5fff"/>
                          <stop offset="100%" stopColor="#ff2d55"/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="1 10" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="name" stroke="transparent" tick={{ fill: "#7890b0", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="transparent" tick={{ fill: "#7890b0", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: "rgba(2,6,20,0.98)", border: "1px solid rgba(0,245,160,0.38)", borderRadius: 12, color: "#f0f4ff", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}
                        labelStyle={{ color: "#00f5a0", fontWeight: 700, marginBottom: 4 }}
                        formatter={(v: number | undefined) => [`${v ?? 0}%`, ""] as [string, string]}
                      />
                      <Area type="monotone" dataKey="target" stroke="rgba(255,224,102,0.55)" strokeWidth={1.5} strokeDasharray="6 4" fill="url(#areaGradTarget)" dot={false} name="Target" />
                      <Area
                        type="monotone" dataKey="rate"
                        stroke="url(#areaLineGrad)" strokeWidth={3.5}
                        fill="url(#areaGradMain)"
                        dot={{ fill: "#00ffb3", r: 7, strokeWidth: 2.5, stroke: "#010812" }}
                        activeDot={{ r: 11, fill: "#fff176", stroke: "#010812", strokeWidth: 2.5 }}
                        name="Completion %"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Status mini cards */}
                <div style={{ background: "rgba(8,14,32,0.70)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "22px 26px", marginBottom: 20, backdropFilter: "blur(20px)" }}>
                  <h3 style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 600, color: G.textSecondary, marginBottom: 18, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Tasks by Status <span style={{ color: G.textMuted, fontSize: 10 }}>— click to view</span></h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                    {[
                      { label: "Approved",   value: analytics.tasksByStatus.approved,  color: G.success, filter: (t: Task) => t.approvalStatus === "superadmin-approved" },
                      { label: "In Process", value: analytics.tasksByStatus.inProcess, color: G.purple,  filter: (t: Task) => (["in-review","admin-approved"] as string[]).includes(t.approvalStatus) },
                      { label: "Pending",    value: analytics.tasksByStatus.pending,   color: G.gold,    filter: (t: Task) => t.approvalStatus === "assigned" || (t.approvalStatus as string) === "pending" },
                      { label: "Completed",  value: analytics.tasksByStatus.completed, color: G.cyan,    filter: (t: Task) => t.approvalStatus === "superadmin-approved" },
                    ].map((item, i) => (
                      <div key={i} onClick={() => openTaskListModal(item.label, analytics.allTasks.filter(item.filter), item.color)}
                        style={{ padding: "16px", background: `${item.color}08`, border: `1px solid ${item.color}22`, borderRadius: 12, textAlign: "center", cursor: "pointer", transition: "all 0.25s ease", position: "relative" as const }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${item.color}33`; (e.currentTarget as HTMLDivElement).style.borderColor = `${item.color}55`; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; (e.currentTarget as HTMLDivElement).style.borderColor = `${item.color}22`; }}>
                        <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 38, fontWeight: 700, color: item.color, textShadow: `0 0 20px ${item.color}66`, marginBottom: 6 }}>{item.value}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team distribution */}
                <div style={{ background: "rgba(8,14,32,0.70)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "22px 26px", backdropFilter: "blur(20px)" }}>
                  <h3 style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 600, color: G.textSecondary, marginBottom: 20, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Task Distribution by Team</h3>
                  {Object.keys(analytics.tasksPerStaff).length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 24px", color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>No tasks assigned yet.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {Object.entries(analytics.tasksPerStaff).slice(0, 6).map(([email, count], i) => {
                        const member   = allMembers.find((m) => m.email === email);
                        const values   = Object.values(analytics.tasksPerStaff) as number[];
                        const maxTasks = Math.max(...values);
                        const pct      = (count / maxTasks) * 100;
                        const colors   = [G.cyan, G.purple, G.success, G.gold, G.amber, G.danger];
                        const barColor = colors[i % colors.length];
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ width: 150, flexShrink: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: G.textPrimary }}>{member?.name || "Unknown"}</div>
                              <div style={{ fontSize: 9, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{member?.role || "staff"}</div>
                            </div>
                            <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${barColor}, ${barColor}aa)`, borderRadius: 99, transition: "width 0.6s ease", boxShadow: `0 0 8px ${barColor}66` }} />
                            </div>
                            <div style={{ width: 55, textAlign: "right", fontSize: 13, fontWeight: 700, color: barColor }}>{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ══ OVERVIEW TAB ══ */}
            {activeTab === "overview" && (
              <>
                <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginTop: 32 }}>
                  {statCards.map((s, i) => (
                    <div key={i} className="g-stat-card fade-up" style={{ animationDelay: `${i * 70}ms` }}
                      onClick={() => s.tasks.length > 0 && openTaskListModal(s.label, s.tasks, s.accent)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 48, fontWeight: 700, color: s.accent, lineHeight: 1, textShadow: `0 0 24px ${s.accent}55` }}>{s.value}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginTop: 10 }}>{s.label}</div>
                        </div>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.accent}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <s.icon size={18} color={s.accent} />
                        </div>
                      </div>
                      {s.tasks.length > 0 && <div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 9, color: `${s.accent}77`, fontFamily: "'IBM Plex Mono',monospace" }}>click ›</div>}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${s.accent}55,transparent)` }} />
                    </div>
                  ))}
                </section>

                {activeSmartAssistCount > 0 && (
                  <div className="fade-up" style={{ marginTop: 22, padding: "16px 20px", background: "rgba(255,45,85,0.08)", border: `1px solid ${G.danger}44`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: "blur(12px)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <AlertTriangle size={20} color={G.danger} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: G.danger }}>{activeSmartAssistCount} Active TAT Breach{activeSmartAssistCount !== 1 ? "es" : ""}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: G.textMuted, marginTop: 3 }}>Smart Assist reminders running every 24h</div>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab("progress")} className="g-btn-ghost" style={{ fontSize: 12, padding: "8px 14px" }}>View Progress <ChevronRight size={13} /></button>
                  </div>
                )}

                <section style={{ marginTop: 32, paddingBottom: 60 }}>
                  <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary, marginBottom: 20 }}>Task <em style={{ color: G.cyan }}>Monitor</em></h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>
                    {[
                      { label: "Approved",   color: G.success, tasks: tasksToReview.filter((t) => (["admin-approved","superadmin-approved"] as string[]).includes(t.approvalStatus)) },
                      { label: "In Process", color: G.purple,  tasks: myAssignedTasks.filter((t) => t.approvalStatus === "in-review") },
                      { label: "Pending",    color: G.gold,    tasks: myAssignedTasks.filter((t) => t.approvalStatus === "assigned" || (t.approvalStatus as string) === "pending") },
                      { label: "Completed",  color: G.cyan,    tasks: [...tasksToReview, ...myAssignedTasks].filter((t) => t.approvalStatus === "superadmin-approved") },
                    ].map((group, i) => (
                      <div key={i} className="fade-up" style={{ animationDelay: `${i * 70}ms`, background: "rgba(8,14,32,0.65)", border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 14, padding: "20px 22px", backdropFilter: "blur(16px)", cursor: group.tasks.length > 0 ? "pointer" : "default" }}
                        onClick={() => group.tasks.length > 0 && openTaskListModal(group.label, group.tasks, group.color)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                          <div>
                            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{group.label}</div>
                            <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 34, fontWeight: 700, color: group.color, textShadow: `0 0 16px ${group.color}44`, marginTop: 4 }}>{group.tasks.length}</div>
                          </div>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: group.color, boxShadow: `0 0 14px ${group.color}` }} className="shimmer" />
                        </div>
                        {group.tasks.length > 0 && (
                          <div style={{ fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
                            Latest: {group.tasks[group.tasks.length - 1]?.title.substring(0, 28)}…
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* ══ MY TASKS TAB ══ */}
            {activeTab === "mytasks" && (
              <section style={{ marginTop: 40, paddingBottom: 60 }}>
                <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary, marginBottom: 6 }}>My <em style={{ color: G.gold }}>Tasks</em></h2>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginBottom: 24, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Tasks assigned to you by other admins</p>
                {myAssignedTasks.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "72px 24px", background: "rgba(8,14,32,0.65)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, backdropFilter: "blur(16px)" }}>
                    <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, fontWeight: 700, color: G.textMuted }}>No tasks assigned to you</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[...myPendingTasks, ...mySubmittedTasks].map((task, idx) => {
                      const canSubmit  = task.approvalStatus === "assigned" || task.approvalStatus === "rejected";
                      const canForward = task.approvalStatus === "assigned";
                      const ac = APPROVAL_COLORS[task.approvalStatus] || G.textMuted;
                      return (
                        <div key={task.id} className="g-card fade-up" style={{ animationDelay: `${idx * 55}ms`, padding: "20px 24px", borderColor: task.tatBreached ? G.dangerBorder : undefined }}>
                          {task.tatBreached && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, borderRadius: 8, marginBottom: 14, fontSize: 12, color: G.danger, fontFamily: "'IBM Plex Mono',monospace" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={12} /> TAT BREACH — {task.smartAssist?.delayDuration || "Overdue"}</span>
                              <button onClick={() => openSmartAssist(task)} style={{ background: "none", border: `1px solid ${G.dangerBorder}`, borderRadius: 6, color: G.danger, cursor: "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", padding: "3px 8px" }}>View Ticket</button>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 600, color: G.textPrimary }}>{task.title}</h3>
                                <span className={priClass(task.priority)}><Flag size={9} />{task.priority.toUpperCase()}</span>
                                <span className="g-badge" style={{ background: `${ac}18`, color: ac, border: `1px solid ${ac}33` }}>{APPROVAL_LABELS[task.approvalStatus] || task.approvalStatus}</span>
                              </div>
                              {task.assignedBy && (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "4px 12px", borderRadius: 99, background: G.goldDim, border: `1px solid ${G.goldBorder}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.gold }}>
                                  <Shield size={9} /> Assigned by <strong style={{ marginLeft: 3 }}>{getName(task.assignedBy)}</strong>
                                </div>
                              )}
                              <p style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>{task.description}</p>
                              {task.approvalStatus === "rejected" && task.adminComments && (
                                <div style={{ padding: "10px 14px", background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, borderRadius: 8, fontSize: 13, color: G.danger, marginBottom: 10 }}>↩ <strong>Rework reason:</strong> {task.adminComments}</div>
                              )}
                              {task.completionNotes && (
                                <div style={{ padding: "10px 14px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 8, fontSize: 13, color: G.textSecondary, marginBottom: 10 }}>📝 {task.completionNotes}</div>
                              )}
                              <div style={{ display: "flex", gap: 14, fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace", flexWrap: "wrap" }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <Calendar size={10} />Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  {task.timeSlot && <span style={{ color: G.gold, marginLeft: 4 }}>· {task.timeSlot}</span>}
                                </span>
                                {task.history && task.history.length > 0 && (
                                  <button onClick={() => { setHistoryTask(task); setShowHistoryModal(true); }} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: G.cyan, cursor: "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", padding: 0 }}>
                                    <ListTree size={10} />View History ({task.history.length})
                                  </button>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexDirection: "column" }}>
                              {canForward && <button className="g-btn-ghost" onClick={() => { setForwardTask(task); setShowForwardModal(true); }} style={{ padding: "9px 14px", fontSize: 12 }}><Share2 size={13} />Forward</button>}
                              {canSubmit  && <button className="g-btn-gold"  onClick={() => openSubmitModal(task)} style={{ padding: "9px 16px", fontSize: 12 }}><Upload size={13} />Submit</button>}
                              <button className="g-btn-delete" onClick={() => requestDeleteTask(task)} style={{ padding: "9px 14px" }}><Trash2 size={13} />Delete</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ══ REVIEW TAB ══ */}
            {activeTab === "review" && (
              <section style={{ marginTop: 40, paddingBottom: 60 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary }}>Pending <em style={{ color: G.gold }}>Review</em></h2>
                    <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{tasksToReview.length} task{tasksToReview.length !== 1 ? "s" : ""} awaiting decision</p>
                  </div>
                  {tasksToReview.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div className="glow-dot" style={{ background: G.success }} />
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted }}>LIVE</span>
                    </div>
                  )}
                </div>
                {tasksToReview.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "72px 24px", background: "rgba(8,14,32,0.65)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, backdropFilter: "blur(16px)" }}>
                    <CheckCircle size={32} color={G.success} style={{ marginBottom: 16 }} />
                    <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 24, fontWeight: 700, color: G.textPrimary, marginBottom: 8 }}>All clear</div>
                    <div style={{ fontSize: 13, color: G.textMuted }}>No tasks pending review.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {tasksToReview.map((task, idx) => (
                      <TaskRow key={task.id} task={task} idx={idx}
                        staffName={getName(task.assignedTo)}
                        isAdminAssignee={isAdminEmail(task.assignedTo)}
                        onReview={() => { setSelectedTask(task); setShowReviewModal(true); }}
                        onViewHistory={() => { setHistoryTask(task); setShowHistoryModal(true); }}
                        onDelete={() => requestDeleteTask(task)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ══ PROGRESS TAB ══ */}
            {activeTab === "progress" && (
              <section style={{ marginTop: 40, paddingBottom: 60 }}>
                <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary, marginBottom: 6 }}>Task <em style={{ color: G.cyan }}>Progress</em></h2>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginBottom: 24, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Real-time visibility into all assigned tasks</p>
                <ProgressTracker tasks={allTasksCombined} getNameFn={getName} isAdminFn={isAdminEmail} pollInterval={30000} onRefresh={() => toast("↻ Progress refreshed")} />
              </section>
            )}

            {/* ══ TASK MAP TAB ══ */}
            {activeTab === "taskmap" && (
              <section style={{ marginTop: 40, paddingBottom: 60 }}>
                <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 26, fontWeight: 700, color: G.textPrimary, marginBottom: 6 }}>Task <em style={{ color: G.purple }}>Map</em></h2>
                <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginBottom: 24, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Parent-child forwarding tree with full context</p>
                <ForwardedTaskTree tasks={allTasksCombined} getNameFn={getName} isAdminFn={isAdminEmail} onSelectTask={(task: Task) => { setSelectedTask(task); setShowReviewModal(true); }} />
              </section>
            )}
          </div>

          {/* ════ MODALS ════ */}

          {/* Confirm Delete Modal */}
          {confirmDelete && (
            <ConfirmDeleteModal
              message={confirmDelete.message}
              onConfirm={confirmDelete.onConfirm}
              onCancel={() => setConfirmDelete(null)}
            />
          )}

          {/* Task List Drill-Down Modal */}
          {showTaskListModal && (
            <TaskListModal
              title={taskListModalTitle}
              tasks={taskListModalTasks}
              getNameFn={getName}
              accentColor={taskListModalColor}
              onClose={() => setShowTaskListModal(false)}
              onDeleteTask={(task) => {
                setShowTaskListModal(false);
                requestDeleteTask(task);
              }}
              onSelectTask={(task) => {
                setShowTaskListModal(false);
                const isReviewable = (["in-review","admin-approved"] as string[]).includes(task.approvalStatus);
                if (isReviewable) { setSelectedTask(task); setShowReviewModal(true); }
                else { setHistoryTask(task); setShowHistoryModal(true); }
              }}
            />
          )}

          {showGlobalHistory && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowGlobalHistory(false); }}>
              <div className="g-modal g-modal-wide" style={{ maxHeight: "85vh" }}>
                <ModalHeader title="Master History Log" sub="All task activity across the system — chronological" onClose={() => setShowGlobalHistory(false)} accent={G.purple} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <HistoryTimeline
                    history={allTasksCombined
                      .flatMap(t => (t.history ?? []).map(h => ({ ...h, taskTitle: t.title, taskId: t.id })))
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    }
                    getNameFn={getName}
                    compact={false}
                  />
                </div>
              </div>
            </div>
          )}

          {showCreateModal && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
              <div className="g-modal" style={{ maxHeight: "90vh" }}>
                <ModalHeader title="Assign New Task" sub="Task pushed to assignee dashboard immediately" onClose={() => setShowCreateModal(false)} accent={G.cyan} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="g-label">Task Title *</label>
                      <input className="g-input" type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="e.g., Redesign onboarding flow" />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="g-label">Assign to *</label>
                      <select className="g-input" value={newTask.assignedTo} onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}>
                        <option value="">Select a person...</option>
                        {assignableAdmins.length > 0 && <optgroup label="── ADMINS ──">{assignableAdmins.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}</optgroup>}
                        {assignableStaff.length > 0  && <optgroup label="── STAFF / DOERS ──">{assignableStaff.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}</optgroup>}
                      </select>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <DateTimePicker label="Due Date" required dateValue={newTask.dueDate} timeSlot={newTask.timeSlot} onDateChange={(v) => setNewTask({ ...newTask, dueDate: v })} onTimeSlotChange={(v) => setNewTask({ ...newTask, timeSlot: v })} />
                    </div>
                    <div>
                      <label className="g-label">Priority</label>
                      <select className="g-input" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}>
                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="g-label">Project *</label>
                      {activeProjects.length === 0 ? (
                        <div style={{ padding: "12px 14px", background: G.amberDim, border: "1px solid rgba(255,159,10,0.3)", borderRadius: 8, color: G.amber, fontSize: 12, fontFamily: "'IBM Plex Mono',monospace" }}>⚠ No active projects.</div>
                      ) : (
                        <select className="g-input" value={newTask.projectId} onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}>
                          <option value="">— Select a project —</option>
                          {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.projectCode ? ` · ${p.projectCode}` : ""}</option>)}
                        </select>
                      )}
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label className="g-label">Description *</label>
                      <textarea className="g-input" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Detailed description…" style={{ minHeight: 90, resize: "vertical" as const }} />
                    </div>
                  </div>
                  {selectedMember && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: selectedMember.role === "admin" ? G.goldDim : G.successDim, border: `1px solid ${selectedMember.role === "admin" ? G.goldBorder : G.successBorder}`, borderRadius: 10, marginBottom: 16 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: selectedMember.role === "admin" ? `linear-gradient(135deg,${G.gold},${G.amber})` : G.success, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {selectedMember.role === "admin" ? <Shield size={14} color="#000" /> : <User size={14} color="#000" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: G.textPrimary }}>{selectedMember.name}</div>
                        <div style={{ fontSize: 11, color: G.textSecondary }}>{selectedMember.email}</div>
                      </div>
                      <span className="g-badge" style={{ background: selectedMember.role === "admin" ? G.goldDim : G.successDim, color: selectedMember.role === "admin" ? G.gold : G.success, border: `1px solid ${selectedMember.role === "admin" ? G.goldBorder : G.successBorder}` }}>
                        {selectedMember.role === "admin" ? "ADMIN" : "STAFF"}
                      </span>
                    </div>
                  )}
                  {newTask.dueDate && (
                    <div style={{ padding: "8px 14px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 8, marginBottom: 16, fontSize: 12, color: G.gold, fontFamily: "'IBM Plex Mono',monospace", display: "flex", alignItems: "center", gap: 8 }}>
                      <Clock size={12} />Deadline: {new Date(computeExactDeadline(newTask.dueDate, newTask.timeSlot)).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="g-btn-gold" onClick={handleCreateTask} style={{ flex: 1 }}><CheckCircle size={14} strokeWidth={2.5} />Assign Task</button>
                    <button className="g-btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showForwardModal && forwardTask && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes(""); } }}>
              <div className="g-modal">
                <ModalHeader title={`Forward: ${forwardTask.title}`} sub="Delegate while preserving full context" onClose={() => { setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes(""); }} accent={G.purple} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, marginBottom: 18 }}>
                    <div style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6 }}>{forwardTask.description}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
                      <span>Priority: {forwardTask.priority?.toUpperCase()}</span><span>·</span>
                      <span>Due: {new Date(forwardTask.dueDate).toLocaleDateString()}</span>
                      {forwardTask.timeSlot && <span>· {forwardTask.timeSlot}</span>}
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label className="g-label">Forward to *</label>
                    <select className="g-input" value={forwardTo} onChange={(e) => setForwardTo(e.target.value)}>
                      <option value="">Select a team member...</option>
                      {assignableStaff.length > 0  && <optgroup label="── STAFF ──">{assignableStaff.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}</optgroup>}
                      {assignableAdmins.length > 0 && <optgroup label="── ADMINS ──">{assignableAdmins.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}</optgroup>}
                    </select>
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <label className="g-label">Notes (Optional)</label>
                    <textarea className="g-input" value={forwardNotes} onChange={(e) => setForwardNotes(e.target.value)} placeholder="Add context for the new assignee…" style={{ minHeight: 90, resize: "vertical" as const }} />
                  </div>
                  <div style={{ padding: "10px 14px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 8, marginBottom: 16, fontSize: 12, color: G.textSecondary, display: "flex", gap: 8 }}>
                    <GitBranch size={14} color={G.gold} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div><strong style={{ color: G.gold }}>Context Linking:</strong> Full history and parent-child relationship is preserved.</div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="g-btn-gold" onClick={handleForwardTask} disabled={!forwardTo} style={{ flex: 1 }}><Share2 size={14} />Forward Task</button>
                    <button className="g-btn-ghost" onClick={() => { setShowForwardModal(false); setForwardTask(null); setForwardTo(""); setForwardNotes(""); }}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showHistoryModal && historyTask && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowHistoryModal(false); setHistoryTask(null); } }}>
              <div className="g-modal g-modal-wide" style={{ maxHeight: "85vh" }}>
                <ModalHeader title={`History: ${historyTask.title}`} sub="Complete activity timeline for this task" onClose={() => { setShowHistoryModal(false); setHistoryTask(null); }} accent={G.purple} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                    <span className={priClass(historyTask.priority)}><Flag size={9} />{historyTask.priority?.toUpperCase()}</span>
                    <span className="g-badge g-badge-gold"><User size={9} />{getName(historyTask.assignedTo)}</span>
                    {historyTask.tatBreached && <span className="tat-badge"><AlertTriangle size={9} />TAT BREACH</span>}
                    {historyTask.timeSlot && <span className="g-badge g-badge-muted"><Clock size={9} />{historyTask.timeSlot}</span>}
                  </div>
                  <HistoryTimeline history={historyTask.history ?? []} getNameFn={getName} filterByTaskId={historyTask.id} compact={false} />
                  <div style={{ marginTop: 20 }}>
                    <button className="g-btn-ghost" onClick={() => { setShowHistoryModal(false); setHistoryTask(null); }} style={{ width: "100%" }}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showReviewModal && selectedTask && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); } }}>
              <div className="g-modal g-modal-wide" style={{ maxHeight: "90vh" }}>
                <ModalHeader title={`Review: ${selectedTask.title}`} sub="Approve to forward to Superadmin, or send back for rework" onClose={() => { setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); }} accent={G.gold} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                    <span className={priClass(selectedTask.priority)}><Flag size={9} />{selectedTask.priority?.toUpperCase()}</span>
                    <span className="g-badge g-badge-gold"><User size={9} />{getName(selectedTask.assignedTo)}</span>
                    {selectedTask.tatBreached && <span className="tat-badge"><AlertTriangle size={9} />TAT BREACH</span>}
                    {selectedTask.timeSlot && <span className="g-badge g-badge-muted"><Clock size={9} />{selectedTask.timeSlot}</span>}
                  </div>
                  <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, marginBottom: 14 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 8 }}>Description</div>
                    <p style={{ fontSize: 14, color: G.textSecondary, lineHeight: 1.65 }}>{selectedTask.description}</p>
                  </div>
                  {selectedTask.completionNotes && (
                    <div style={{ padding: "14px 16px", background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 10, marginBottom: 14 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.gold, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 8 }}>📝 Completion Notes</div>
                      <p style={{ fontSize: 14, color: G.textSecondary, lineHeight: 1.65 }}>{selectedTask.completionNotes}</p>
                    </div>
                  )}
                  {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: G.textMuted, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 10 }}>Attachments ({selectedTask.attachments.length})</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {selectedTask.attachments.map((src, i) => (
                          <div key={i} style={{ position: "relative", cursor: "pointer" }} onClick={() => openLightbox(selectedTask.attachments!, i)}>
                            <img src={src} alt={`Attachment ${i + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid ${G.cyan}33` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, marginBottom: 16, fontSize: 12, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace", display: "flex", alignItems: "center", gap: 8 }}>
                    <Calendar size={12} />Due: {new Date(selectedTask.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    {selectedTask.timeSlot && <span style={{ color: G.gold }}>· {selectedTask.timeSlot}</span>}
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label className="g-label">Review Comments {reviewComments.length === 0 ? "(required for rework)" : ""}</label>
                    <textarea className="g-input" value={reviewComments} onChange={(e) => setReviewComments(e.target.value)} placeholder="Add feedback, notes, or reason for rework…" style={{ minHeight: 100, resize: "vertical" as const }} />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="g-btn-success" onClick={handleApprove} style={{ flex: 1 }}><CheckCircle size={14} />Approve & Forward</button>
                    <button className="g-btn-danger"  onClick={handleRework}  style={{ flex: 1 }}><RotateCw size={14} />Send for Rework</button>
                    <button className="g-btn-ghost" onClick={() => { setShowReviewModal(false); setSelectedTask(null); setReviewComments(""); }}>Cancel</button>
                  </div>
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    <button className="g-btn-delete" style={{ width: "100%" }} onClick={() => { setShowReviewModal(false); requestDeleteTask(selectedTask); }}>
                      <Trash2 size={13} />Delete This Task
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showSubmitModal && submitTask && (
            <div className="g-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeSubmitModal(); }}>
              <div className="g-modal g-modal-wide" style={{ maxHeight: "90vh" }}>
                <ModalHeader title={`Submit: ${submitTask.title}`} sub="Add completion notes and attachments before review" onClose={closeSubmitModal} accent={G.success} />
                <div style={{ padding: "24px 28px 28px" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                    <span className={priClass(submitTask.priority)}><Flag size={9} />{submitTask.priority?.toUpperCase()}</span>
                    {submitTask.timeSlot && <span className="g-badge g-badge-muted"><Clock size={9} />{submitTask.timeSlot}</span>}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
                      <Calendar size={10} />Due {new Date(submitTask.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label className="g-label">Completion Notes *</label>
                    <textarea className="g-input" value={submitNotes} onChange={(e) => setSubmitNotes(e.target.value)} placeholder="Describe what was done, blockers encountered, and the outcome…" style={{ minHeight: 120, resize: "vertical" as const }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="g-btn-ai" onClick={handleAIDraft} disabled={aiDrafting || !submitNotes.trim()}>
                        {aiDrafting ? <><Loader size={11} className="spin" />Improving…</> : <><Sparkles size={11} />AI Polish</>}
                      </button>
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <DateTimePicker label="Submission Time Slot" hideDateInput dateValue="" timeSlot={submitTimeSlot} onDateChange={() => {}} onTimeSlotChange={setSubmitTimeSlot} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label className="g-label">Attachments (Photos)</label>
                    <div className={`g-drop${submitDragOver ? " drag-over" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setSubmitDragOver(true); }}
                      onDragLeave={() => setSubmitDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setSubmitDragOver(false); handlePhotoAdd(e.dataTransfer.files); }}
                      onClick={() => fileInputRef.current?.click()}>
                      <Upload size={20} color={G.textMuted} style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 13, color: G.textSecondary }}>Drop images here or <span style={{ color: G.cyan }}>browse</span></div>
                      <div style={{ fontSize: 11, color: G.textMuted, marginTop: 4 }}>PNG, JPG, WEBP supported</div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handlePhotoAdd(e.target.files)} />
                    {submitPhotos.length > 0 && (
                      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {submitPhotos.map((src, i) => (
                          <div key={i} style={{ position: "relative" }}>
                            <img src={src} alt={`Photo ${i + 1}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${G.cyan}33`, cursor: "pointer" }} onClick={() => openLightbox(submitPhotos, i)} />
                            <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: G.danger, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11 }}>
                              <X size={10} />
                            </button>
                            {aiReviewResults && (() => {
                              const r = aiReviewResults.results.find((r) => r.image === i + 1);
                              const c = r?.status === "CLEAN" ? G.success : r?.status === "ERROR" ? G.danger : G.amber;
                              return r ? <span style={{ position: "absolute", bottom: 2, left: 2, right: 2, textAlign: "center", fontSize: 8, background: `${c}cc`, color: "#fff", padding: "1px 4px", borderRadius: 4, fontFamily: "'IBM Plex Mono',monospace" }}>{r.status}</span> : null;
                            })()}
                          </div>
                        ))}
                        <button className="g-btn-review-att" onClick={handleAIReview} disabled={aiReviewing} style={{ height: 72, minWidth: 72, flexDirection: "column" as const, gap: 4 }}>
                          {aiReviewing ? <Loader size={14} className="spin" /> : <Eye size={14} />}
                          <span style={{ fontSize: 9 }}>{aiReviewing ? "Reviewing…" : "AI Review"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {aiReviewResults && reviewPanelOpen && (
                    <div style={{ marginBottom: 16, padding: "14px 16px", background: aiReviewResults.hasErrors ? G.dangerDim : G.successDim, border: `1px solid ${aiReviewResults.hasErrors ? G.dangerBorder : G.successBorder}`, borderRadius: 10 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: aiReviewResults.hasErrors ? G.danger : G.success, letterSpacing: "0.10em", textTransform: "uppercase" as const, marginBottom: 10 }}>
                        {aiReviewResults.hasErrors ? "⚠ Issues Found" : "✓ All Clear"}
                      </div>
                      {aiReviewResults.results.map((r, i) => (
                        <div key={i} style={{ marginBottom: 8, fontSize: 12, color: G.textSecondary }}>
                          <strong style={{ color: r.status === "CLEAN" ? G.success : r.status === "ERROR" ? G.danger : G.amber }}>Image {r.image} — {r.status}</strong>
                          {r.issues.length > 0 && <ul style={{ marginTop: 4, paddingLeft: 16 }}>{r.issues.map((issue, j) => <li key={j}>{issue}</li>)}</ul>}
                          {r.recommendations && <div style={{ marginTop: 4, color: G.textMuted }}>{r.recommendations}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="g-btn-gold" onClick={handleSubmitTask} disabled={!submitNotes.trim() || (aiReviewResults?.hasErrors ?? false)} style={{ flex: 1 }}>
                      <FileText size={14} />Submit for Review
                    </button>
                    <button className="g-btn-ghost" onClick={closeSubmitModal}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showSmartAssist && activeTicket && (
            <SmartAssistModal
              ticket={activeTicket}
              onClose={() => { setShowSmartAssist(false); setActiveTicket(null); }}
              onSubmit={handleSmartAssistSubmit}
              isDoer={activeTicket.assignedTo === user?.email}
            />
          )}

          {showLightbox && lightboxPhotos.length > 0 && (
            <div className="g-lightbox" onClick={() => setShowLightbox(false)}>
              <button className="g-lightbox-close" onClick={() => setShowLightbox(false)}><X size={16} /></button>
              <button className="g-lightbox-nav prev" disabled={lightboxIndex === 0} onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => Math.max(i - 1, 0)); }}>‹</button>
              <img className="g-lightbox-img" src={lightboxPhotos[lightboxIndex]} alt={`Photo ${lightboxIndex + 1}`} onClick={(e) => e.stopPropagation()} />
              <button className="g-lightbox-nav next" disabled={lightboxIndex === lightboxPhotos.length - 1} onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => Math.min(i + 1, lightboxPhotos.length - 1)); }}>›</button>
              <div className="g-lightbox-counter">{lightboxIndex + 1} / {lightboxPhotos.length}</div>
            </div>
          )}
        </div>

        {toastMsg && <div className="g-toast">{toastMsg}</div>}
      </>
    );
  };

  // ── Modal Header ──────────────────────────────────────────────────────────────
  const ModalHeader: React.FC<{ title: string; sub: string; onClose: () => void; accent?: string }> = ({ title, sub, onClose, accent = G.cyan }) => (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "22px 26px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: accent, letterSpacing: "0.16em", textTransform: "uppercase" as const, marginBottom: 6 }}>{sub}</div>
        <h2 style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, fontWeight: 700, color: G.textPrimary, lineHeight: 1.2, maxWidth: 460 }}>{title}</h2>
      </div>
      <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: G.textMuted }}>
        <X size={15} />
      </button>
    </div>
  );

  // ── Task Row ──────────────────────────────────────────────────────────────────
  interface TaskRowProps {
    task: Task;
    idx: number;
    staffName: string;
    isAdminAssignee: boolean;
    onReview: () => void;
    onViewHistory: () => void;
    onDelete: () => void;
  }

  const TaskRow: React.FC<TaskRowProps> = ({ task, idx, staffName, isAdminAssignee, onReview, onViewHistory, onDelete }) => {
    const [hovered, setHovered] = React.useState(false);
    return (
      <div className="fade-up"
        style={{ animationDelay: `${idx * 55}ms`, background: hovered ? G.surfaceMid : G.surface, border: `1px solid ${hovered ? G.cyan + "44" : task.tatBreached ? G.dangerBorder : "rgba(255,255,255,0.09)"}`, borderRadius: 12, padding: "18px 22px", transition: "all 0.2s ease", backdropFilter: "blur(16px)" }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        {task.tatBreached && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "6px 12px", background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, borderRadius: 7, fontSize: 11, color: G.danger, fontFamily: "'IBM Plex Mono',monospace" }}>
            <AlertTriangle size={11} /> TAT BREACH — {task.smartAssist?.delayDuration || "Overdue"}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
          <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: G.textMuted, marginTop: 2 }}>
            {String(idx + 1).padStart(2, "0")}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: G.textPrimary }}>{task.title}</h3>
              <span className={priClass(task.priority)}><Flag size={9} />{task.priority?.toUpperCase()}</span>
              {isAdminAssignee && <span className="g-badge g-badge-gold"><Shield size={9} />ADMIN</span>}
            </div>
            <p style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
              {task.description}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 11, color: G.textMuted, fontFamily: "'IBM Plex Mono',monospace" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: isAdminAssignee ? G.gold : G.textSecondary }}>
                {isAdminAssignee ? <Shield size={10} color={G.gold} /> : <User size={10} />}{staffName}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Calendar size={10} />{new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {task.timeSlot && <span style={{ color: G.gold }}>· {task.timeSlot}</span>}
              </span>
              {task.completionNotes && <span style={{ display: "flex", alignItems: "center", gap: 5, color: G.cyan }}><FileText size={10} />Has notes</span>}
              {task.history && task.history.length > 0 && (
                <button onClick={onViewHistory} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: G.cyan, cursor: "pointer", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", padding: 0 }}>
                  <ListTree size={10} />History ({task.history.length})
                </button>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 2 }}>
            <button onClick={onReview}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: hovered ? `linear-gradient(135deg,${G.cyan},#60efff)` : "rgba(255,255,255,0.05)", color: hovered ? "#001a26" : G.textSecondary, border: `1px solid ${hovered ? G.cyan : "rgba(255,255,255,0.10)"}`, borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: "pointer", transition: "all 0.2s ease", whiteSpace: "nowrap", boxShadow: hovered ? `0 0 20px ${G.cyan}55` : "none" }}>
              <Eye size={12} />Review<ChevronRight size={11} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="g-btn-delete"
              style={{ padding: "9px 12px" }}
              title="Delete task"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  export default AdminDashboard;