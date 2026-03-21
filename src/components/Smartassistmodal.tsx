import React, { useState } from "react";
import {
  X, Clock, AlertTriangle, Calendar, ChevronRight,
  User, RefreshCw, CheckCircle, Loader,
} from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const G = {
  bg:          "#080600",
  bgDeep:      "#050400",
  surface:     "#0f0d08",
  surfaceMid:  "#171308",
  surfaceHigh: "#211a0a",
  gold:        "#c9a96e",
  goldBright:  "#e8c84a",
  goldDim:     "rgba(201,169,110,0.15)",
  goldBorder:  "rgba(201,169,110,0.2)",
  border:      "rgba(201,169,110,0.1)",
  success:     "#6ee7b7",
  successDim:  "rgba(110,231,183,0.12)",
  successBorder:"rgba(110,231,183,0.25)",
  danger:      "#f87171",
  dangerDim:   "rgba(248,113,113,0.12)",
  dangerBorder:"rgba(248,113,113,0.25)",
  amber:       "#f59e0b",
  amberDim:    "rgba(245,158,11,0.12)",
  textPrimary: "#f0e6d3",
  textSecondary:"#8a7355",
  textMuted:   "#4a3f2a",
};

const TIME_SLOTS = ["AM", "Noon", "PM"] as const;
type TimeSlot = typeof TIME_SLOTS[number];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SmartAssistTicket {
  id: string;
  taskId: string;
  taskTitle: string;
  assignedTo: string;
  assignedToName: string;
  assignedBy?: string;
  assignedByName?: string;
  delayDuration: string;
  originalDeadline?: string;
  timeSlot?: string;
  reminderCount: number;
  status: "open" | "awaiting-completion" | "resolved";
  lastReminderAt?: string;
  revisedDate?: string;
  revisedTimeSlot?: string;
  delayReason?: string;
}

export interface RevisionSubmitPayload {
  revisedDate: string;
  revisedTimeSlot: string;
  delayReason: string;
}

interface SmartAssistModalProps {
  ticket: SmartAssistTicket | null;
  onClose?: () => void;
  onSubmit?: (payload: RevisionSubmitPayload) => void;
  isDoer?: boolean;
}

// ── Sub-components ────────────────────────────────────────────────────────────
interface InfoBlockProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}

const InfoBlock: React.FC<InfoBlockProps> = ({ icon, label, value, accent }) => (
  <div style={{ padding: "10px 12px", background: G.bgDeep, border: `1px solid ${G.border}`, borderRadius: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
      {icon}
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: G.textMuted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: accent ?? G.textPrimary, lineHeight: 1.3 }}>
      {value || "—"}
    </div>
  </div>
);

// ── Time slot picker ──────────────────────────────────────────────────────────
interface TimeSlotPickerProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}

const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({ value, onChange, label }) => (
  <div>
    {label && (
      <label style={{ display: "block", fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: G.textSecondary, marginBottom: 8, fontFamily: "'DM Mono',monospace" }}>
        {label}
      </label>
    )}
    <div style={{ display: "flex", gap: 8 }}>
      {TIME_SLOTS.map((slot) => (
        <button
          key={slot}
          type="button"
          onClick={() => onChange(slot)}
          style={{
            flex: 1, padding: "9px 0",
            background: value === slot ? G.goldDim : G.bgDeep,
            border: `1px solid ${value === slot ? G.goldBorder : G.border}`,
            borderRadius: 8, color: value === slot ? G.gold : G.textSecondary,
            fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 600,
            letterSpacing: "0.08em", cursor: "pointer", transition: "all 0.15s",
          }}
        >
          {slot}
        </button>
      ))}
    </div>
  </div>
);

// ── Modal ─────────────────────────────────────────────────────────────────────
const SmartAssistModal: React.FC<SmartAssistModalProps> = ({
  ticket,
  onClose,
  onSubmit,
  isDoer = true,
}) => {
  const [revisedDate,     setRevisedDate]     = useState<string>(ticket?.revisedDate ?? "");
  const [revisedTimeSlot, setRevisedTimeSlot] = useState<string>(ticket?.revisedTimeSlot ?? "PM");
  const [delayReason,     setDelayReason]     = useState<string>(ticket?.delayReason ?? "");
  const [submitting,      setSubmitting]      = useState<boolean>(false);
  const [submitted,       setSubmitted]       = useState<boolean>(
    ticket?.status === "awaiting-completion"
  );

  if (!ticket) return null;

  const canSubmit = revisedDate.trim().length > 0 && delayReason.trim().length > 0;

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setSubmitting(true);
    await new Promise<void>((r) => setTimeout(r, 600));
    onSubmit?.({ revisedDate, revisedTimeSlot, delayReason });
    setSubmitted(true);
    setSubmitting(false);
  };

  const fmtDeadline = (iso: string | undefined): string => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const alreadySubmitted = submitted || ticket.status === "awaiting-completion";

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
        backdropFilter: "blur(16px)", zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{
        background: `linear-gradient(160deg,${G.surfaceMid},${G.surface})`,
        border: `1px solid ${G.dangerBorder}`, borderRadius: 20,
        width: "100%", maxWidth: 520, overflow: "hidden",
        boxShadow: `0 40px 80px rgba(0,0,0,0.7),0 0 40px ${G.dangerDim}`,
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg,${G.dangerDim},${G.amberDim})`,
          borderBottom: `1px solid ${G.dangerBorder}`, padding: "20px 24px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: G.dangerDim,
              border: `1px solid ${G.dangerBorder}`, display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0,
            }}>
              <AlertTriangle size={22} color={G.danger} strokeWidth={1.5} />
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.danger, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
                Smart Assist · TAT Breach #{ticket.reminderCount}
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 400, color: G.textPrimary, lineHeight: 1.2 }}>
                {ticket.taskTitle}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, background: G.surfaceHigh, border: `1px solid ${G.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: G.textSecondary }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <InfoBlock icon={<Clock size={12} color={G.danger} />}   label="Overdue By"         value={ticket.delayDuration}                 accent={G.danger} />
            <InfoBlock icon={<Calendar size={12} color={G.gold} />}  label="Original Deadline"  value={fmtDeadline(ticket.originalDeadline)} accent={G.gold} />
            <InfoBlock icon={<User size={12} color={G.textSecondary} />}  label="Assigned To"  value={ticket.assignedToName}                accent={G.textSecondary} />
            <InfoBlock icon={<RefreshCw size={12} color={G.amber} />} label="Reminders Sent"   value={`${ticket.reminderCount} reminder${ticket.reminderCount !== 1 ? "s" : ""}`} accent={G.amber} />
          </div>

          {/* Already-submitted confirmation */}
          {alreadySubmitted && ticket.revisedDate && (
            <div style={{ padding: "12px 14px", background: G.successDim, border: `1px solid ${G.successBorder}`, borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <CheckCircle size={16} color={G.success} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: G.success, marginBottom: 4 }}>
                  Revision Submitted
                </div>
                <div style={{ fontSize: 12, color: G.textSecondary }}>
                  New deadline:{" "}
                  <strong style={{ color: G.textPrimary }}>
                    {new Date(ticket.revisedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {ticket.revisedTimeSlot && ` (${ticket.revisedTimeSlot})`}
                  </strong>
                </div>
                {ticket.delayReason && (
                  <div style={{ fontSize: 12, color: G.textSecondary, marginTop: 4 }}>
                    Reason: {ticket.delayReason}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Revision form — only shown to doer before submission */}
          {isDoer && !alreadySubmitted && (
            <div style={{ background: G.bgDeep, border: `1px solid ${G.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: G.gold, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                ◈ Submit Revised Timeline
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: G.textSecondary, marginBottom: 8, fontFamily: "'DM Mono',monospace" }}>
                  Revised Completion Date *
                </label>
                <input
                  type="date"
                  value={revisedDate}
                  onChange={(e) => setRevisedDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  style={{ width: "100%", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 8, padding: "10px 12px", color: G.textPrimary, fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", colorScheme: "dark" } as React.CSSProperties}
                />
              </div>

              <TimeSlotPicker
                value={revisedTimeSlot}
                onChange={setRevisedTimeSlot}
                label="Revised Time Slot *"
              />

              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: G.textSecondary, marginBottom: 8, fontFamily: "'DM Mono',monospace" }}>
                  Reason for Delay *
                </label>
                <textarea
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  placeholder="Explain why the task is delayed and what steps are being taken…"
                  style={{ width: "100%", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 8, padding: "10px 12px", color: G.textPrimary, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical", minHeight: 80, lineHeight: 1.6 }}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "11px 20px",
                  background: submitting || !canSubmit
                    ? "rgba(201,169,110,0.2)"
                    : `linear-gradient(135deg,${G.gold},${G.goldBright})`,
                  color: submitting || !canSubmit ? G.textMuted : "#000",
                  border: "none", borderRadius: 8, fontFamily: "'DM Sans',sans-serif",
                  fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
                  cursor: submitting || !canSubmit ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                {submitting
                  ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} />Submitting…</>
                  : <><ChevronRight size={13} />Submit Revised Date</>
                }
              </button>
            </div>
          )}

          <div style={{ fontSize: 11, color: G.textMuted, fontFamily: "'DM Mono',monospace", textAlign: "center", lineHeight: 1.6 }}>
            Reminders continue every 24 hours until task is marked{" "}
            <strong style={{ color: G.success }}>Completed</strong>.
          </div>

          <button
            onClick={onClose}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 20px", background: G.surfaceHigh, color: G.textSecondary, border: `1px solid ${G.border}`, borderRadius: 8, fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 13, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartAssistModal;
