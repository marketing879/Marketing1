import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, Task } from "../contexts/UserContext";
import {
  Plus,
  LogOut,
  CheckCircle,
  RotateCw,
  Eye,
  X,
  Zap,
  Clock,
  TrendingUp,
  Award,
  ChevronRight,
  User,
  Calendar,
  Flag,
  FileText,
  ArrowUpRight,
  MessageSquare,
} from "lucide-react";
import ClaudeChat from "./ClaudeChat";

const DS = {
  bg: "#0a0a0b",
  surface: "#111113",
  surfaceHigh: "#1a1a1e",
  border: "rgba(255,255,255,0.07)",
  borderHover: "rgba(255,255,255,0.15)",
  accent: "#f59e0b",
  accentGlow: "rgba(245,158,11,0.25)",
  accentDim: "rgba(245,158,11,0.12)",
  cyan: "#22d3ee",
  cyanGlow: "rgba(34,211,238,0.2)",
  success: "#34d399",
  successGlow: "rgba(52,211,153,0.2)",
  danger: "#f87171",
  dangerGlow: "rgba(248,113,113,0.2)",
  textPrimary: "#f0ece4",
  textSecondary: "#6b7280",
  textMuted: "#3f3f46",
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${DS.bg}; color: ${DS.textPrimary}; font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${DS.textMuted}; border-radius: 99px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pulseGlow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.9; } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.93); } to { opacity: 1; transform: scale(1); } }
  .fade-up { animation: fadeUp 0.5s ease both; }
  .fade-in { animation: fadeIn 0.4s ease both; }
  .scale-in { animation: scaleIn 0.35s ease both; }
  .grain::after { content: ''; position: fixed; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); pointer-events: none; z-index: 9999; opacity: 0.4; }
  input:focus, textarea:focus, select:focus { outline: none; }
  input::placeholder, textarea::placeholder { color: ${DS.textMuted}; }
  select option { background: #1a1a1e; color: ${DS.textPrimary}; }
  .btn-primary { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 22px; background: ${DS.accent}; color: #000; border: none; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 13px; letter-spacing: 0.02em; cursor: pointer; transition: all 0.2s ease; }
  .btn-primary:hover { background: #fbbf24; transform: translateY(-1px); box-shadow: 0 8px 24px ${DS.accentGlow}; }
  .btn-ghost { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 22px; background: ${DS.surfaceHigh}; color: ${DS.textPrimary}; border: 1px solid ${DS.border}; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-weight: 500; font-size: 13px; cursor: pointer; transition: all 0.2s ease; }
  .btn-ghost:hover { border-color: ${DS.borderHover}; background: rgba(255,255,255,0.05); }
  .btn-success { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 22px; background: linear-gradient(135deg, #059669, #34d399); color: #fff; border: none; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s ease; }
  .btn-success:hover { transform: translateY(-1px); box-shadow: 0 8px 24px ${DS.successGlow}; }
  .btn-danger { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 22px; background: linear-gradient(135deg, #dc2626, #f87171); color: #fff; border: none; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s ease; }
  .btn-danger:hover { transform: translateY(-1px); box-shadow: 0 8px 24px ${DS.dangerGlow}; }
  .input-field { width: 100%; background: ${DS.bg}; border: 1px solid ${DS.border}; border-radius: 8px; padding: 12px 14px; color: ${DS.textPrimary}; font-size: 14px; font-family: 'DM Sans', sans-serif; transition: border-color 0.2s, box-shadow 0.2s; }
  .input-field:focus { border-color: ${DS.accent}; box-shadow: 0 0 0 3px ${DS.accentDim}; }
  .label { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${DS.textSecondary}; margin-bottom: 8px; font-family: 'DM Mono', monospace; }
  .task-card { background: ${DS.surface}; border: 1px solid ${DS.border}; border-radius: 12px; padding: 20px 24px; transition: border-color 0.2s, background 0.2s; }
  .task-card:hover { border-color: ${DS.borderHover}; background: ${DS.surfaceHigh}; }
  .priority-high { background: rgba(248,113,113,0.12); color: #f87171; border: 1px solid rgba(248,113,113,0.2); }
  .priority-medium { background: rgba(245,158,11,0.12); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
  .priority-low { background: rgba(52,211,153,0.12); color: #34d399; border: 1px solid rgba(52,211,153,0.2); }
  .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; font-family: 'DM Mono', monospace; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(12px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px; animation: fadeIn 0.25s ease; }
  .modal-box { background: ${DS.surface}; border: 1px solid ${DS.border}; border-radius: 20px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; animation: scaleIn 0.3s ease; }
  .stat-card { background: ${DS.surface}; border: 1px solid ${DS.border}; border-radius: 14px; padding: 22px 24px; position: relative; overflow: hidden; transition: border-color 0.2s, transform 0.2s; }
  .stat-card:hover { border-color: ${DS.borderHover}; transform: translateY(-2px); }
  .divider { width: 100%; height: 1px; background: ${DS.border}; margin: 0; }
  .glow-dot { width: 6px; height: 6px; border-radius: 50%; animation: pulseGlow 2s ease infinite; }
`;

const getPriorityClass = (p: string) =>
  p === "high"
    ? "priority-high"
    : p === "low"
    ? "priority-low"
    : "priority-medium";
const getPriorityIcon = (p: string) =>
  p === "high" ? "↑↑" : p === "medium" ? "↑" : "—";

const Tag = ({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <span className={`badge ${className}`} style={style}>
    {children}
  </span>
);

const AdminDashboard: React.FC = () => {
  const {
    getTasksForAdminReview,
    adminReviewTask,
    logout,
    user,
    teamMembers,
    addTask,
  } = useUser();
  const navigate = useNavigate();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [reviewComments, setReviewComments] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [ready, setReady] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
    dueDate: "",
    assignedTo: "",
    projectId: "1",
  });

  const tasksToReview = getTasksForAdminReview();

  useEffect(() => {
    setTimeout(() => setReady(true), 60);
  }, []);

  const toast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200);
  };

  const handleLogout = () => {
    if (window.confirm("Sign out of Admin Dashboard?")) {
      logout();
      navigate("/login", { replace: true });
    }
  };

  const handleCreateTask = () => {
    if (
      !newTask.title ||
      !newTask.description ||
      !newTask.assignedTo ||
      !newTask.dueDate
    ) {
      toast("⚠ Please fill in all required fields.");
      return;
    }
    const staffMember = teamMembers.find((m) => m.email === newTask.assignedTo);
    if (!staffMember) {
      toast("⚠ Selected staff member not found.");
      return;
    }
    addTask({
      title: newTask.title,
      description: newTask.description,
      status: "pending",
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      assignedTo: newTask.assignedTo,
      projectId: newTask.projectId,
    });
    toast(`✓ Task assigned to ${staffMember.name}`);
    setNewTask({
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
      assignedTo: "",
      projectId: "1",
    });
    setShowCreateModal(false);
  };

  const handleApprove = () => {
    if (!selectedTask) return;
    adminReviewTask(selectedTask.id, true, reviewComments);
    closeReview();
    toast("✓ Approved — forwarded to Superadmin.");
  };
  const handleRework = () => {
    if (!selectedTask) return;
    if (!reviewComments.trim()) {
      toast("⚠ Add a reason for rework.");
      return;
    }
    adminReviewTask(selectedTask.id, false, reviewComments);
    closeReview();
    toast("↩ Sent back for rework.");
  };
  const closeReview = () => {
    setShowReviewModal(false);
    setSelectedTask(null);
    setReviewComments("");
  };
  const getStaffName = (email: string) =>
    teamMembers.find((m) => m.email === email)?.name ?? email;

  const stats = [
    {
      label: "Pending Review",
      value: tasksToReview.length,
      icon: Clock,
      accent: DS.accent,
      glow: DS.accentGlow,
    },
    {
      label: "Approved",
      value: 12,
      icon: CheckCircle,
      accent: DS.success,
      glow: DS.successGlow,
    },
    {
      label: "In Progress",
      value: 8,
      icon: TrendingUp,
      accent: DS.cyan,
      glow: DS.cyanGlow,
    },
    {
      label: "Completed",
      value: 45,
      icon: Award,
      accent: "#a78bfa",
      glow: "rgba(167,139,250,0.2)",
    },
  ];

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="grain" style={{ minHeight: "100vh", background: DS.bg }}>
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-10%",
              right: "5%",
              width: 600,
              height: 600,
              background: `radial-gradient(circle, ${DS.accentGlow} 0%, transparent 70%)`,
              filter: "blur(80px)",
              animation: "pulseGlow 6s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "10%",
              left: "-5%",
              width: 500,
              height: 500,
              background: `radial-gradient(circle, ${DS.cyanGlow} 0%, transparent 70%)`,
              filter: "blur(80px)",
              animation: "pulseGlow 8s ease-in-out infinite 2s",
            }}
          />
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 1140,
            margin: "0 auto",
            padding: "0 24px",
          }}
        >
          {/* HEADER */}
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "28px 0 24px",
              borderBottom: `1px solid ${DS.border}`,
              position: "sticky",
              top: 0,
              zIndex: 50,
              background: `${DS.bg}cc`,
              backdropFilter: "blur(20px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  background: DS.accent,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Zap size={20} color="#000" strokeWidth={2.5} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: 26,
                    color: DS.textPrimary,
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Admin{" "}
                  <span style={{ fontStyle: "italic", color: DS.accent }}>
                    Control
                  </span>
                </div>
                {user && (
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color: DS.textSecondary,
                      marginTop: 4,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {user.name} · {user.email}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={15} strokeWidth={2.5} />
                New Task
              </button>
              <button
                className="btn-ghost"
                onClick={() => setShowAIPanel(!showAIPanel)}
                style={{
                  padding: "11px 14px",
                  borderColor: showAIPanel ? "rgba(245,158,11,0.4)" : DS.border,
                }}
              >
                <MessageSquare size={16} />
              </button>
              <button
                className="btn-ghost"
                onClick={handleLogout}
                style={{ padding: "11px 14px" }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </header>

          {/* AI PANEL */}
          {showAIPanel && (
            <div style={{ marginTop: 24, height: 500 }}>
              <ClaudeChat theme="amber" />
            </div>
          )}

          {/* STATS */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginTop: 32,
            }}
          >
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={i}
                  className="stat-card fade-up"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: s.accent,
                      opacity: 0.8,
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "'DM Serif Display', serif",
                          fontSize: 40,
                          color: DS.textPrimary,
                          lineHeight: 1,
                          letterSpacing: "-0.03em",
                        }}
                      >
                        {s.value}
                      </div>
                      <div
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 11,
                          color: DS.textSecondary,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          marginTop: 8,
                        }}
                      >
                        {s.label}
                      </div>
                    </div>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: `${s.accent}18`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={17} color={s.accent} strokeWidth={1.8} />
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          {/* TASKS */}
          <section style={{ marginTop: 40, paddingBottom: 60 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div>
                <h2
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: 22,
                    color: DS.textPrimary,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Pending Review
                </h2>
                <p
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    color: DS.textSecondary,
                    marginTop: 4,
                    letterSpacing: "0.04em",
                  }}
                >
                  {tasksToReview.length} task
                  {tasksToReview.length !== 1 ? "s" : ""} awaiting your decision
                </p>
              </div>
              {tasksToReview.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="glow-dot" style={{ background: DS.accent }} />
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color: DS.textSecondary,
                    }}
                  >
                    LIVE
                  </span>
                </div>
              )}
            </div>

            {tasksToReview.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "72px 24px",
                  background: DS.surface,
                  border: `1px solid ${DS.border}`,
                  borderRadius: 16,
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 14,
                    background: DS.successGlow,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                  }}
                >
                  <CheckCircle size={28} color={DS.success} strokeWidth={1.5} />
                </div>
                <div
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: 22,
                    color: DS.textPrimary,
                    marginBottom: 8,
                  }}
                >
                  All clear
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    color: DS.textSecondary,
                  }}
                >
                  No tasks pending review at this moment.
                </div>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {tasksToReview.map((task, idx) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    idx={idx}
                    staffName={getStaffName(task.assignedTo)}
                    onReview={() => {
                      setSelectedTask(task);
                      setShowReviewModal(true);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* CREATE TASK MODAL */}
        {showCreateModal && (
          <div
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCreateModal(false);
            }}
          >
            <div className="modal-box">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "24px 28px 20px",
                  borderBottom: `1px solid ${DS.border}`,
                }}
              >
                <div>
                  <h2
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontSize: 22,
                      color: DS.textPrimary,
                    }}
                  >
                    Assign New Task
                  </h2>
                  <p
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color: DS.textSecondary,
                      marginTop: 4,
                      letterSpacing: "0.04em",
                    }}
                  >
                    Task will be pushed to the assignee's dashboard immediately.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: DS.surfaceHigh,
                    border: `1px solid ${DS.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: DS.textSecondary,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: "24px 28px 28px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 18,
                    marginBottom: 18,
                  }}
                >
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="label">Task Title *</label>
                    <input
                      className="input-field"
                      type="text"
                      value={newTask.title}
                      onChange={(e) =>
                        setNewTask({ ...newTask, title: e.target.value })
                      }
                      placeholder="e.g., Redesign onboarding flow"
                    />
                  </div>
                  <div>
                    <label className="label">Assign to *</label>
                    <select
                      className="input-field"
                      value={newTask.assignedTo}
                      onChange={(e) =>
                        setNewTask({ ...newTask, assignedTo: e.target.value })
                      }
                    >
                      <option value="">Select team member...</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.email}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Due Date *</label>
                    <input
                      className="input-field"
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) =>
                        setNewTask({ ...newTask, dueDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Priority</label>
                    <select
                      className="input-field"
                      value={newTask.priority}
                      onChange={(e) =>
                        setNewTask({
                          ...newTask,
                          priority: e.target.value as any,
                        })
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Project ID</label>
                    <input
                      className="input-field"
                      type="text"
                      value={newTask.projectId}
                      onChange={(e) =>
                        setNewTask({ ...newTask, projectId: e.target.value })
                      }
                      placeholder="Project ID"
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="label">Description *</label>
                    <textarea
                      className="input-field"
                      value={newTask.description}
                      onChange={(e) =>
                        setNewTask({ ...newTask, description: e.target.value })
                      }
                      placeholder="Detailed description of the task…"
                      style={{ minHeight: 100, resize: "vertical" }}
                    />
                  </div>
                </div>
                {newTask.assignedTo &&
                  (() => {
                    const m = teamMembers.find(
                      (tm) => tm.email === newTask.assignedTo
                    );
                    return m ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 14px",
                          background: DS.accentDim,
                          border: `1px solid rgba(245,158,11,0.2)`,
                          borderRadius: 10,
                          marginBottom: 18,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: DS.accent,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <User size={15} color="#000" strokeWidth={2.5} />
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: DS.textPrimary,
                            }}
                          >
                            {m.name}
                          </div>
                          <div
                            style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 11,
                              color: DS.textSecondary,
                            }}
                          >
                            {m.email}
                          </div>
                        </div>
                        <ArrowUpRight
                          size={14}
                          color={DS.accent}
                          style={{ marginLeft: "auto" }}
                        />
                        <span
                          style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 11,
                            color: DS.accent,
                          }}
                        >
                          Will be notified
                        </span>
                      </div>
                    ) : null;
                  })()}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className="btn-primary"
                    onClick={handleCreateTask}
                    style={{ flex: 1 }}
                  >
                    <CheckCircle size={15} strokeWidth={2.5} />
                    Assign Task
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REVIEW MODAL */}
        {showReviewModal && selectedTask && (
          <div
            className="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeReview();
            }}
          >
            <div className="modal-box">
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  padding: "24px 28px 20px",
                  borderBottom: `1px solid ${DS.border}`,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 10,
                      color: DS.textSecondary,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Task Review
                  </div>
                  <h2
                    style={{
                      fontFamily: "'DM Serif Display', serif",
                      fontSize: 20,
                      color: DS.textPrimary,
                      lineHeight: 1.2,
                      maxWidth: 380,
                    }}
                  >
                    {selectedTask.title}
                  </h2>
                </div>
                <button
                  onClick={closeReview}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    flexShrink: 0,
                    background: DS.surfaceHigh,
                    border: `1px solid ${DS.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: DS.textSecondary,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: "22px 28px 28px" }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    marginBottom: 18,
                  }}
                >
                  <Tag className={getPriorityClass(selectedTask.priority)}>
                    <Flag size={10} />
                    {getPriorityIcon(selectedTask.priority)}{" "}
                    {selectedTask.priority.toUpperCase()}
                  </Tag>
                  <Tag
                    style={{
                      background: "rgba(34,211,238,0.1)",
                      color: DS.cyan,
                      border: "1px solid rgba(34,211,238,0.2)",
                    }}
                  >
                    <User size={10} />
                    {getStaffName(selectedTask.assignedTo)}
                  </Tag>
                  <Tag
                    style={{
                      background: DS.surfaceHigh,
                      color: DS.textSecondary,
                      border: `1px solid ${DS.border}`,
                    }}
                  >
                    <Calendar size={10} />
                    Due{" "}
                    {new Date(selectedTask.dueDate).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  </Tag>
                </div>
                <div
                  style={{
                    padding: "14px 16px",
                    background: DS.bg,
                    border: `1px solid ${DS.border}`,
                    borderRadius: 10,
                    marginBottom: 18,
                    fontSize: 14,
                    color: "#9ca3af",
                    lineHeight: 1.65,
                  }}
                >
                  {selectedTask.description}
                </div>
                {selectedTask.completionNotes && (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "rgba(34,211,238,0.05)",
                      border: `1px solid rgba(34,211,238,0.15)`,
                      borderRadius: 10,
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 10,
                        color: DS.cyan,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      📝 Staff Completion Notes
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: "#9ca3af",
                        lineHeight: 1.65,
                      }}
                    >
                      {selectedTask.completionNotes}
                    </div>
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <label className="label">Your Review Notes</label>
                  <textarea
                    className="input-field"
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    placeholder="Feedback, approval notes, or reason for rework…"
                    style={{ minHeight: 110, resize: "vertical" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className="btn-success"
                    onClick={handleApprove}
                    style={{ flex: 1 }}
                  >
                    <CheckCircle size={15} strokeWidth={2.5} />
                    Approve
                  </button>
                  <button
                    className="btn-danger"
                    onClick={handleRework}
                    style={{ flex: 1 }}
                  >
                    <RotateCw size={15} strokeWidth={2.5} />
                    Rework
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={closeReview}
                    style={{ padding: "11px 14px" }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {toastMsg && (
          <div
            style={{
              position: "fixed",
              bottom: 28,
              left: "50%",
              transform: "translateX(-50%)",
              background: DS.surfaceHigh,
              border: `1px solid ${DS.borderHover}`,
              borderRadius: 99,
              padding: "12px 22px",
              fontFamily: "'DM Mono', monospace",
              fontSize: 13,
              color: DS.textPrimary,
              zIndex: 9999,
              boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
              animation: "fadeUp 0.3s ease",
              whiteSpace: "nowrap",
            }}
          >
            {toastMsg}
          </div>
        )}
      </div>
    </>
  );
};

const TaskRow: React.FC<{
  task: Task;
  idx: number;
  staffName: string;
  onReview: () => void;
}> = ({ task, idx, staffName, onReview }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="fade-up"
      style={{
        animationDelay: `${idx * 60}ms`,
        background: hovered ? DS.surfaceHigh : DS.surface,
        border: `1px solid ${hovered ? DS.borderHover : DS.border}`,
        borderRadius: 12,
        padding: "18px 22px",
        display: "flex",
        alignItems: "flex-start",
        gap: 18,
        transition: "all 0.2s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 6,
          background: DS.bg,
          border: `1px solid ${DS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          color: DS.textMuted,
          marginTop: 2,
        }}
      >
        {String(idx + 1).padStart(2, "0")}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 6,
          }}
        >
          <h3
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 600,
              color: DS.textPrimary,
            }}
          >
            {task.title}
          </h3>
          <span className={`badge ${getPriorityClass(task.priority)}`}>
            <Flag size={9} /> {task.priority.toUpperCase()}
          </span>
        </div>
        <p
          style={{
            fontSize: 13,
            color: DS.textSecondary,
            lineHeight: 1.6,
            marginBottom: 10,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {task.description}
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            fontSize: 12,
            color: DS.textSecondary,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <User size={11} /> {staffName}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Calendar size={11} />
            {new Date(task.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          {task.completionNotes && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: DS.cyan,
              }}
            >
              <FileText size={11} /> Has notes
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onReview}
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "9px 16px",
          background: hovered ? DS.accent : DS.surfaceHigh,
          color: hovered ? "#000" : DS.textSecondary,
          border: `1px solid ${hovered ? DS.accent : DS.border}`,
          borderRadius: 8,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
          transition: "all 0.2s ease",
          whiteSpace: "nowrap",
          marginTop: 2,
        }}
      >
        <Eye size={13} />
        Review
        <ChevronRight size={12} />
      </button>
    </div>
  );
};

export default AdminDashboard;
