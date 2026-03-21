// src/components/AddTaskForm.tsx
// ── REPLACE your existing AddTaskForm (or TaskNewAssignment) with this file ──
import React, { useState, useEffect } from "react";
import { useUser } from "../contexts/UserContext";

// ─── Design tokens ────────────────────────────────────────────────────────────
const G = {
  bg:           "#080600",
  bgDeep:       "#050400",
  surface:      "#0f0d08",
  surfaceMid:   "#171308",
  surfaceHigh:  "#211a0a",
  gold:         "#c9a96e",
  goldBright:   "#e8c84a",
  goldDim:      "rgba(201,169,110,0.15)",
  goldGlow:     "rgba(201,169,110,0.25)",
  goldBorder:   "rgba(201,169,110,0.2)",
  border:       "rgba(201,169,110,0.1)",
  borderHi:     "rgba(201,169,110,0.22)",
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
};

// ─── Inline CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');

  /* ── Dark-mode calendar icon fix ── */
  .at-input[type="date"]::-webkit-calendar-picker-indicator,
  .at-input[type="date"]::-webkit-inner-spin-button {
    filter: invert(1) brightness(0.75) sepia(1) hue-rotate(5deg) saturate(2.5);
    cursor: pointer;
    opacity: 0.75;
  }
  .at-input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }

  .at-input {
    width: 100%;
    background: ${G.bgDeep};
    border: 1px solid ${G.border};
    border-radius: 8px;
    padding: 12px 14px;
    color: ${G.textPrimary};
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    transition: border-color 0.2s, box-shadow 0.2s;
    color-scheme: dark;
  }
  .at-input:focus {
    outline: none;
    border-color: ${G.goldBorder};
    box-shadow: 0 0 0 3px ${G.goldDim};
  }
  .at-input::placeholder { color: ${G.textMuted}; }
  .at-input option        { background: ${G.surfaceMid}; color: ${G.textPrimary}; }
  .at-input optgroup      { color: ${G.textSecondary}; font-size: 11px; font-family: 'DM Mono', monospace; }

  .at-label {
    display: block;
    font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
    color: ${G.textSecondary}; margin-bottom: 8px; font-family: 'DM Mono', monospace;
  }

  .at-btn-gold {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 24px;
    background: linear-gradient(135deg, #c9a96e, #e8c84a, #c9a96e);
    color: #000; font-weight: 700; font-size: 12px; letter-spacing: 0.08em;
    text-transform: uppercase; border: none; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; cursor: pointer;
    transition: all 0.2s ease; box-shadow: 0 2px 16px rgba(201,169,110,0.3);
  }
  .at-btn-gold:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 28px rgba(201,169,110,0.45); }
  .at-btn-gold:disabled { opacity: 0.45; cursor: not-allowed; }

  .at-btn-ghost {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 24px;
    background: ${G.surfaceHigh}; color: ${G.textPrimary};
    border: 1px solid ${G.border}; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer;
    transition: all 0.2s ease;
  }
  .at-btn-ghost:hover { border-color: ${G.borderHi}; }

  .at-info  { background: ${G.goldDim};    border: 1px solid ${G.goldBorder};   color: ${G.gold};    padding: 10px 14px; border-radius: 8px; font-size: 12px; line-height: 1.5; }
  .at-warn  { background: ${G.amberDim};   border: 1px solid rgba(245,158,11,0.3); color: ${G.amber}; padding: 10px 14px; border-radius: 8px; font-size: 12px; line-height: 1.5; }
  .at-error { background: ${G.dangerDim};  border: 1px solid ${G.dangerBorder}; color: ${G.danger};  padding: 10px 14px; border-radius: 8px; font-size: 12px; line-height: 1.5; }
  .at-ok    { background: ${G.successDim}; border: 1px solid ${G.successBorder}; color: ${G.success}; padding: 10px 14px; border-radius: 8px; font-size: 12px; line-height: 1.5; }

  .at-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 520px) { .at-grid-2 { grid-template-columns: 1fr; } }
`;

// ─── Props ────────────────────────────────────────────────────────────────────
interface AddTaskFormProps {
  onClose?: () => void;
  onTaskCreated?: () => void;
  /** If set, the form will pre-populate for editing */
  taskToEdit?: import("../contexts/UserContext").Task | null;
}

// ─── Component ────────────────────────────────────────────────────────────────
const AddTaskForm: React.FC<AddTaskFormProps> = ({
  onClose,
  onTaskCreated,
  taskToEdit,
}) => {
  const { user, addTask, updateTask, projects, teamMembers } = useUser();

  const isEditing = !!taskToEdit;

  const [form, setForm] = useState({
    title:        taskToEdit?.title        ?? "",
    description:  taskToEdit?.description  ?? "",
    projectId:    taskToEdit?.projectId    ?? "",
    assignedTo:   taskToEdit?.assignedTo   ?? "",
    priority:     (taskToEdit?.priority    ?? "medium") as "low" | "medium" | "high",
    dueDate:      taskToEdit?.dueDate      ?? "",
    status:       (taskToEdit?.status      ?? "pending") as "pending" | "in_progress" | "completed" | "approved" | "rework",
  });

  const [errors,        setErrors]        = useState<Record<string, string>>({});
  const [loading,       setLoading]       = useState(false);
  const [autoFilledBy,  setAutoFilledBy]  = useState<string | null>(null);  // doer name when auto-assigned
  const [doerWarning,   setDoerWarning]   = useState(false);                // no mapping found

  // ── Active (non-inactive) projects only ──────────────────────────────────
  const activeProjects = projects.filter(
    (p) => !(p as any).status || (p as any).status === "active"
  );

  // ── All staff/doers ───────────────────────────────────────────────────────
  const staffMembers = teamMembers.filter(
    (m) => m.role === "staff" || (m as any).isDoer
  );
  const adminMembers = teamMembers.filter((m) => m.role === "admin" && m.email !== user?.email);

  // ── Auto-assign doer when project changes ─────────────────────────────────
  useEffect(() => {
    if (!form.projectId) {
      setAutoFilledBy(null);
      setDoerWarning(false);
      return;
    }

    const project = projects.find((p) => p.id === form.projectId) as any;
    if (!project) return;

    const doerEmail: string | undefined = project.concernedDoerEmail;
    if (doerEmail) {
      const doer = teamMembers.find((m) => m.email === doerEmail);
      if (doer) {
        setForm((prev) => ({ ...prev, assignedTo: doer.email }));
        setAutoFilledBy(doer.name);
        setDoerWarning(false);
        return;
      }
    }
    // No mapping
    setAutoFilledBy(null);
    setDoerWarning(true);
  }, [form.projectId, projects, teamMembers]);

  const field = (key: keyof typeof form, val: string) => {
    setForm((p) => ({ ...p, [key]: val }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim())    e.title      = "Title is required.";
    if (!form.projectId)       e.projectId  = "Please select a project.";
    if (!form.assignedTo)      e.assignedTo = "Please assign to someone.";
    if (!form.dueDate)         e.dueDate    = "Due date is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      if (isEditing && taskToEdit) {
        updateTask(taskToEdit.id, form);
      } else {
       addTask({
  ...form,
  assignedBy: user?.email || "",
  approvalStatus: "assigned",
});
      }
      setLoading(false);
      onTaskCreated?.();
      onClose?.();
    }, 700);
  };

  const selectedProject = projects.find((p) => p.id === form.projectId) as any;

  return (
    <>
      <style>{CSS}</style>

      <form
        onSubmit={handleSubmit}
        noValidate
        style={{
          background: `linear-gradient(160deg, ${G.surfaceMid}, ${G.surface})`,
          border: `1px solid ${G.border}`,
          borderRadius: 16,
          padding: "28px 28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: G.textSecondary, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
              {isEditing ? "Editing Task" : "New Task Assignment"}
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: G.textPrimary }}>
              {isEditing ? "Update Task" : "Assign Task"}
            </div>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: G.surfaceHigh, border: `1px solid ${G.border}`, color: G.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
              ×
            </button>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="at-label">Task Title *</label>
          <input className="at-input" value={form.title} onChange={(e) => field("title", e.target.value)} placeholder="e.g. Prepare site report" />
          {errors.title && <div style={{ color: G.danger, fontSize: 11, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{errors.title}</div>}
        </div>

        {/* Description */}
        <div>
          <label className="at-label">Description</label>
          <textarea className="at-input" value={form.description} onChange={(e) => field("description", e.target.value)} placeholder="Describe the task in detail…" style={{ minHeight: 80, resize: "vertical" }} />
        </div>

        {/* ── Project Dropdown ─────────────────────────────────────────────── */}
        <div>
          <label className="at-label">Project *</label>
          {activeProjects.length === 0 ? (
            <div className="at-warn">⚠ No active projects found. Contact your Super Admin to create one.</div>
          ) : (
            <select className="at-input" value={form.projectId} onChange={(e) => field("projectId", e.target.value)}>
              <option value="">— Select a project —</option>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{(p as any).projectCode ? ` (${(p as any).projectCode})` : ""}
                </option>
              ))}
            </select>
          )}
          {errors.projectId && <div style={{ color: G.danger, fontSize: 11, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{errors.projectId}</div>}

          {/* Project meta pill */}
          {selectedProject && (
            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              {selectedProject.projectCode && (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: G.gold, background: G.goldDim, border: `1px solid ${G.goldBorder}`, borderRadius: 99, padding: "2px 8px" }}>
                  {selectedProject.projectCode}
                </span>
              )}
              {selectedProject.launchDate && (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: G.textSecondary, background: G.surface, border: `1px solid ${G.border}`, borderRadius: 99, padding: "2px 8px" }}>
                  Launch: {new Date(selectedProject.launchDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Assigned To ─────────────────────────────────────────────────── */}
        <div>
          <label className="at-label">Assign To *</label>

          {/* Auto-fill notification */}
          {autoFilledBy && (
            <div className="at-ok" style={{ marginBottom: 8 }}>
              ✦ Auto-assigned to <strong>{autoFilledBy}</strong> based on project mapping.
            </div>
          )}
          {doerWarning && (
            <div className="at-warn" style={{ marginBottom: 8 }}>
              ⚠ No doer mapped for this project — please assign manually.
            </div>
          )}

          <select className="at-input" value={form.assignedTo} onChange={(e) => { field("assignedTo", e.target.value); setAutoFilledBy(null); }}>
            <option value="">— Select team member —</option>
            {adminMembers.length > 0 && (
              <optgroup label="── ADMINS ──">
                {adminMembers.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}
              </optgroup>
            )}
            {staffMembers.length > 0 && (
              <optgroup label="── STAFF / DOERS ──">
                {staffMembers.map((m) => <option key={m.id} value={m.email}>{m.name}</option>)}
              </optgroup>
            )}
          </select>
          {errors.assignedTo && <div style={{ color: G.danger, fontSize: 11, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{errors.assignedTo}</div>}
        </div>

        {/* Priority + Due Date */}
        <div className="at-grid-2">
          <div>
            <label className="at-label">Priority</label>
            <select className="at-input" value={form.priority} onChange={(e) => field("priority", e.target.value as any)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            {/* ── Calendar icon fix: dark-mode aware via CSS class ── */}
            <label className="at-label">Due Date *</label>
            <input
              type="date"
              className="at-input"
              value={form.dueDate}
              onChange={(e) => field("dueDate", e.target.value)}
              min={!isEditing ? new Date().toISOString().split("T")[0] : undefined}
            />
            {errors.dueDate && <div style={{ color: G.danger, fontSize: 11, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{errors.dueDate}</div>}
          </div>
        </div>

        {/* Status (only show when editing) */}
        {isEditing && (
          <div>
            <label className="at-label">Status</label>
            <select className="at-input" value={form.status} onChange={(e) => field("status", e.target.value as any)}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="approved">Approved</option>
              <option value="rework">Rework</option>
            </select>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="at-btn-gold" type="submit" disabled={loading} style={{ flex: 1 }}>
            {loading ? (isEditing ? "Updating…" : "Assigning…") : (isEditing ? "Update Task" : "Assign Task")}
          </button>
          {onClose && (
            <button className="at-btn-ghost" type="button" onClick={onClose}>Cancel</button>
          )}
        </div>
      </form>
    </>
  );
};

export default AddTaskForm;
