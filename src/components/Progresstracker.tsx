import React, { useEffect, useState } from "react";
import {
  Activity, Clock, CheckCircle, RotateCw, User, Shield,
  Calendar, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";

// Suppress unused-import warnings for icons kept for potential use
void Clock; void CheckCircle; void RotateCw;

const G = {
  bg:           "#080600",
  bgDeep:       "#050400",
  surface:      "#0f0d08",
  surfaceMid:   "#171308",
  surfaceHigh:  "#211a0a",
  gold:         "#c9a96e",
  goldBright:   "#e8c84a",
  goldDim:      "rgba(201,169,110,0.15)",
  goldBorder:   "rgba(201,169,110,0.2)",
  goldGlow:     "rgba(201,169,110,0.25)",
  border:       "rgba(201,169,110,0.1)",
  success:      "#6ee7b7",
  successDim:   "rgba(110,231,183,0.12)",
  successBorder:"rgba(110,231,183,0.25)",
  danger:       "#f87171",
  dangerDim:    "rgba(248,113,113,0.12)",
  dangerBorder: "rgba(248,113,113,0.25)",
  amber:        "#f59e0b",
  amberDim:     "rgba(245,158,11,0.12)",
  textPrimary:  "#f0e6d3",
  textSecondary:"#8a7355",
  textMuted:    "#4a3f2a",
  purple:       "#a78bfa",
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface HistoryEntry {
  action?: string;
}

interface SmartAssistInfo {
  delayDuration?: string;
  revisedDate?: string;
  revisedTimeSlot?: string;
  delayReason?: string;
}

export interface ProgressTask {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  assignedTo: string;
  approvalStatus: string;
  priority?: string;
  timeSlot?: string;
  tatBreached?: boolean;
  completionNotes?: string;
  adminComments?: string;
  smartAssist?: SmartAssistInfo | null;
  history?: HistoryEntry[];
}

interface ProgressTrackerProps {
  tasks?: ProgressTask[];
  getNameFn?: (email: string) => string;
  isAdminFn?: (email: string) => boolean;
  pollInterval?: number;
  onRefresh?: () => void;
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_PROGRESS: Record<string, number> = {
  assigned: 10, rejected: 20, "in-review": 55,
  "admin-approved": 75, "superadmin-approved": 100,
  "in-progress": 40, completed: 100, pending: 5,
};

const STATUS_STEPS = [
  { key: "assigned",              label: "Assigned",    color: G.gold    },
  { key: "in-progress",          label: "In Progress", color: G.purple  },
  { key: "in-review",            label: "Submitted",   color: G.amber   },
  { key: "admin-approved",       label: "Admin OK",    color: G.amber   },
  { key: "superadmin-approved",  label: "Approved",    color: G.success },
] as const;

function currentStepIdx(status: string): number {
  const map: Record<string, number> = {
    assigned: 0, "in-progress": 1, rejected: 1,
    "in-review": 2, "admin-approved": 3, "superadmin-approved": 4, completed: 4,
  };
  return map[status] ?? 0;
}

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

// ── Component ─────────────────────────────────────────────────────────────────
const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  tasks = [],
  getNameFn = (e) => e,
  isAdminFn = () => false,
  pollInterval = 30_000,
  onRefresh,
}) => {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => {
      onRefresh?.();
      setLastUpdated(new Date());
    }, pollInterval);
    return () => clearInterval(id);
  }, [pollInterval, onRefresh]);

  const toggle = (id: string): void =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  if (tasks.length === 0) {
    return (
      <div style={{
        textAlign: "center", padding: "48px 24px",
        background: G.surface, border: `1px solid ${G.border}`, borderRadius: 16,
      }}>
        <Activity size={32} color={G.textMuted} strokeWidth={1} style={{ marginBottom: 12 }} />
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 300, color: G.textSecondary }}>
          No tasks to track
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: G.textMuted, marginTop: 6 }}>
          Tasks you assign to others will appear here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Poll indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: G.success, display: "inline-block" }} />
          Live · refreshes every {pollInterval / 1000}s
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.textMuted }}>
          Updated {lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>

      {tasks.map((task) => {
        const pct       = STATUS_PROGRESS[task.approvalStatus] ?? 10;
        const ac        = APPROVAL_COLORS[task.approvalStatus] || G.textSecondary;
        const stepIdx   = currentStepIdx(task.approvalStatus);
        const isExpanded = expanded.has(task.id);
        const isAdmin   = isAdminFn(task.assignedTo);
        const daysUntil = Math.ceil(
          (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        const isOverdue = daysUntil < 0;
        const isUrgent  = daysUntil <= 1 && !isOverdue;

        return (
          <div
            key={task.id}
            style={{
              background: G.surface,
              border: `1px solid ${task.tatBreached ? G.dangerBorder : G.border}`,
              borderRadius: 14, overflow: "hidden", transition: "all 0.2s",
            }}
          >
            {/* TAT breach warning bar */}
            {task.tatBreached && (
              <div style={{
                padding: "7px 18px", background: G.dangerDim,
                borderBottom: `1px solid ${G.dangerBorder}`,
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 11, color: G.danger, fontFamily: "'DM Mono',monospace",
              }}>
                <AlertTriangle size={12} />
                <span>TAT BREACHED — Smart Assist Active · {task.smartAssist?.delayDuration}</span>
              </div>
            )}

            <div style={{ padding: "16px 20px" }}>
              {/* Title row */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: G.textPrimary }}>
                      {task.title}
                    </span>
                    <span style={{
                      padding: "2px 8px", background: `${ac}18`,
                      border: `1px solid ${ac}33`, borderRadius: 99,
                      fontSize: 9, color: ac, fontFamily: "'DM Mono',monospace",
                    }}>
                      {APPROVAL_LABELS[task.approvalStatus] || task.approvalStatus}
                    </span>
                    {isOverdue && (
                      <span style={{ padding: "2px 8px", background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, borderRadius: 99, fontSize: 9, color: G.danger, fontFamily: "'DM Mono',monospace" }}>
                        OVERDUE
                      </span>
                    )}
                    {isUrgent && !isOverdue && (
                      <span style={{ padding: "2px 8px", background: G.amberDim, border: "1px solid rgba(245,158,11,0.3)", borderRadius: 99, fontSize: 9, color: G.amber, fontFamily: "'DM Mono',monospace" }}>
                        DUE SOON
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: G.textMuted, fontFamily: "'DM Mono',monospace" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: isAdmin ? G.gold : G.textMuted }}>
                      {isAdmin ? <Shield size={9} color={G.gold} /> : <User size={9} />}
                      {getNameFn(task.assignedTo)}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: isOverdue ? G.danger : isUrgent ? G.amber : G.textMuted }}>
                      <Calendar size={9} />
                      {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {task.timeSlot && <span>·{task.timeSlot}</span>}
                    </span>
                    {isOverdue
                      ? <span style={{ color: G.danger }}>{Math.abs(daysUntil)}d overdue</span>
                      : <span>{daysUntil}d left</span>
                    }
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 300, color: ac, lineHeight: 1 }}>{pct}%</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: G.textMuted }}>progress</div>
                  </div>
                  <button
                    onClick={() => toggle(task.id)}
                    style={{
                      width: 28, height: 28, borderRadius: 7, background: G.surfaceHigh,
                      border: `1px solid ${G.border}`, display: "flex", alignItems: "center",
                      justifyContent: "center", cursor: "pointer", color: G.textSecondary,
                    }}
                  >
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 6, background: G.bgDeep, borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
                <div style={{
                  width: `${pct}%`, height: "100%",
                  background: `linear-gradient(90deg,${ac},${pct === 100 ? G.success : ac}BB)`,
                  borderRadius: 99, transition: "width 0.6s ease",
                }} />
              </div>

              {/* Step breadcrumb */}
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {STATUS_STEPS.map((step, si) => {
                  const done   = si < stepIdx;
                  const active = si === stepIdx;
                  const sc     = done ? G.success : active ? ac : G.textMuted;
                  return (
                    <React.Fragment key={step.key}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: done || active ? sc : G.textMuted,
                          boxShadow: active ? `0 0 8px ${sc}80` : "none",
                          transition: "all 0.3s",
                        }} />
                        <div style={{
                          fontFamily: "'DM Mono',monospace", fontSize: 8, color: sc,
                          letterSpacing: "0.05em", textAlign: "center", maxWidth: 52, lineHeight: 1.2,
                        }}>
                          {step.label}
                        </div>
                      </div>
                      {si < STATUS_STEPS.length - 1 && (
                        <div style={{
                          flex: 1, height: 1,
                          background: done ? G.success : G.border,
                          margin: "0 4px", marginBottom: 14, transition: "background 0.3s",
                        }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${G.border}` }}>
                  {task.description && (
                    <p style={{ fontSize: 13, color: G.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>
                      {task.description}
                    </p>
                  )}
                  {task.completionNotes && (
                    <div style={{
                      padding: "10px 12px", background: G.goldDim, border: `1px solid ${G.goldBorder}`,
                      borderRadius: 8, fontSize: 13, color: G.textSecondary, marginBottom: 10,
                    }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: G.gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                        📝 Completion Notes
                      </div>
                      {task.completionNotes}
                    </div>
                  )}
                  {task.adminComments && (
                    <div style={{ padding: "10px 12px", background: G.dangerDim, border: `1px solid ${G.dangerBorder}`, borderRadius: 8, fontSize: 13, color: G.danger }}>
                      ↩ <strong>Review comment:</strong> {task.adminComments}
                    </div>
                  )}
                  {task.smartAssist?.revisedDate && (
                    <div style={{ marginTop: 10, padding: "10px 12px", background: G.amberDim, border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, fontSize: 12, color: G.amber }}>
                      📅 Revised deadline:{" "}
                      <strong>
                        {new Date(task.smartAssist.revisedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {task.smartAssist.revisedTimeSlot && ` (${task.smartAssist.revisedTimeSlot})`}
                      </strong>
                      {task.smartAssist.delayReason && (
                        <div style={{ marginTop: 4, color: G.textSecondary }}>
                          Reason: {task.smartAssist.delayReason}
                        </div>
                      )}
                    </div>
                  )}
                  {(task.history?.length ?? 0) > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: G.textMuted, fontFamily: "'DM Mono',monospace" }}>
                      {task.history!.length} history entries · Last: {task.history![task.history!.length - 1]?.action}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProgressTracker;