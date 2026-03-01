// src/components/ProjectManagementNew.tsx
// ── REPLACE your existing ProjectManagement component with this file ──────────
import React, { useState } from "react";
import { useUser } from "../contexts/UserContext";
import type { Project } from "../contexts/UserContext";

// ─── Design tokens (mirrors AdminDashboard golden theme) ─────────────────────
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
  goldBorderHi: "rgba(201,169,110,0.45)",
  border:       "rgba(201,169,110,0.1)",
  borderHi:     "rgba(201,169,110,0.22)",
  success:      "#6ee7b7",
  successDim:   "rgba(110,231,183,0.12)",
  successBorder:"rgba(110,231,183,0.25)",
  danger:       "#f87171",
  dangerDim:    "rgba(248,113,113,0.12)",
  dangerBorder: "rgba(248,113,113,0.25)",
  amber:        "#f59e0b",
  textPrimary:  "#f0e6d3",
  textSecondary:"#8a7355",
  textMuted:    "#4a3f2a",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes scaleIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }

  .pm-fade-up  { animation: fadeUp  0.45s ease both; }
  .pm-scale-in { animation: scaleIn 0.3s  ease both; }

  /* calendar icon — dark-mode aware */
  input[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(1) brightness(0.8) sepia(1) hue-rotate(5deg) saturate(3);
    cursor: pointer;
    opacity: 0.7;
  }
  input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }

  .pm-input {
    width: 100%;
    background: ${G.bgDeep};
    border: 1px solid ${G.border};
    border-radius: 8px;
    padding: 12px 14px;
    color: ${G.textPrimary};
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    transition: border-color 0.2s, box-shadow 0.2s;
    colorScheme: dark;
  }
  .pm-input:focus {
    outline: none;
    border-color: ${G.goldBorder};
    box-shadow: 0 0 0 3px ${G.goldDim};
  }
  .pm-input::placeholder { color: ${G.textMuted}; }
  .pm-input option       { background: ${G.surfaceMid}; color: ${G.textPrimary}; }

  .pm-label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${G.textSecondary};
    margin-bottom: 8px;
    font-family: 'DM Mono', monospace;
  }

  .pm-card {
    background: ${G.surface};
    border: 1px solid ${G.border};
    border-radius: 14px;
    padding: 24px;
    transition: border-color 0.2s, transform 0.2s;
  }
  .pm-card:hover {
    border-color: ${G.goldBorder};
    transform: translateY(-2px);
  }

  .pm-btn-gold {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 11px 22px;
    background: linear-gradient(135deg, #c9a96e, #e8c84a, #c9a96e);
    color: #000; font-weight: 700; font-size: 12px; letter-spacing: 0.08em;
    text-transform: uppercase; border: none; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; cursor: pointer;
    transition: all 0.2s ease; box-shadow: 0 2px 16px rgba(201,169,110,0.3);
  }
  .pm-btn-gold:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 28px rgba(201,169,110,0.45); }
  .pm-btn-gold:disabled { opacity: 0.45; cursor: not-allowed; }

  .pm-btn-ghost {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 11px 22px;
    background: ${G.surfaceHigh}; color: ${G.textPrimary};
    border: 1px solid ${G.border}; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer;
    transition: all 0.2s ease;
  }
  .pm-btn-ghost:hover { border-color: ${G.borderHi}; background: ${G.surfaceMid}; }

  .pm-badge-active   { background: ${G.successDim}; color: ${G.success}; border: 1px solid ${G.successBorder}; }
  .pm-badge-inactive { background: ${G.dangerDim};  color: ${G.danger};  border: 1px solid ${G.dangerBorder}; }
  .pm-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 99px;
    font-size: 10px; font-weight: 600; letter-spacing: 0.07em;
    font-family: 'DM Mono', monospace; text-transform: uppercase;
  }

  .pm-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(14px);
    z-index: 200; display: flex; align-items: center; justify-content: center; padding: 24px;
    animation: fadeUp 0.2s ease;
  }
  .pm-modal {
    background: linear-gradient(160deg, ${G.surfaceMid}, ${G.surface});
    border: 1px solid ${G.border}; border-radius: 20px;
    width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto;
    animation: scaleIn 0.28s ease;
    box-shadow: 0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(201,169,110,0.1);
  }

  .pm-denied {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 80px 24px; text-align: center;
    background: ${G.surface}; border: 1px solid ${G.border}; border-radius: 16px;
  }

  .pm-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

  .pm-stat-top::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, ${G.gold}, transparent); opacity: 0.5;
  }
`;

// ─── Color palette for project swatches ──────────────────────────────────────
const COLOR_OPTIONS = [
  { value: "#c9a96e", name: "Gold"    },
  { value: "#6ee7b7", name: "Mint"    },
  { value: "#60a5fa", name: "Blue"    },
  { value: "#f87171", name: "Red"     },
  { value: "#a78bfa", name: "Violet"  },
  { value: "#f59e0b", name: "Amber"   },
  { value: "#34d399", name: "Emerald" },
  { value: "#818cf8", name: "Indigo"  },
];

const EMPTY_PROJECT = {
  name:                "",
  description:         "",
  color:               "#c9a96e",
  projectCode:         "",
  concernedDoerEmail:  "",
  launchDate:          "",
  status:              "active" as "active" | "inactive",
};

// ─── ProjectManagement (default export) ───────────────────────────────────────
const ProjectManagementNew: React.FC = () => {
  const { user, projects, teamMembers, addProject } = useUser();
  const isSuperAdmin = user?.role === "superadmin";

  const [showForm, setShowForm]   = useState(false);
  const [form,     setForm]       = useState(EMPTY_PROJECT);
  const [errors,   setErrors]     = useState<Record<string, string>>({});
  const [loading,  setLoading]    = useState(false);
  const [toast,    setToast]      = useState<string | null>(null);

  // Only staff/admins who are "doers" appear in the doer dropdown
  const doers = teamMembers.filter(
    (m) => m.role === "staff" || m.isDoer
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())              e.name              = "Project name is required.";
    if (!form.projectCode.trim())       e.projectCode       = "Project code is required.";
    if (!form.concernedDoerEmail)       e.concernedDoerEmail= "Please select a concerned doer.";
    if (!form.launchDate)               e.launchDate        = "Launch date is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setLoading(true);

    // ── POST to backend + update context ──────────────────────────────────
    fetch("http://localhost:5000/api/projects", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...form, createdBy: user?.email }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Server error");
        const saved: Project = await res.json();
        // Optimistically reflect in context (addProject should accept full obj)
        addProject(saved);
        showToast("✓ Project created successfully!");
        setForm(EMPTY_PROJECT);
        setShowForm(false);
      })
      .catch(() => {
        // If backend not yet updated, fall back to local context
        addProject({ ...form } as any);
        showToast("✓ Project saved locally (backend unreachable).");
        setForm(EMPTY_PROJECT);
        setShowForm(false);
      })
      .finally(() => setLoading(false));
  };

  const field = (key: keyof typeof form, val: string) => {
    setForm((p) => ({ ...p, [key]: val }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: "" }));
  };

  const getDoerName = (email: string) =>
    teamMembers.find((m) => m.email === email)?.name ?? email;

  return (
    <>
      <style>{CSS}</style>

      <div style={{
        maxWidth: 1100, margin: "0 auto", padding: "40px 28px",
        background: G.bg, minHeight: "100vh", color: G.textPrimary,
        fontFamily: "'DM Sans', sans-serif",
      }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36, paddingBottom: 24, borderBottom: `1px solid ${G.border}` }}>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 400, letterSpacing: "-0.01em", color: G.textPrimary, lineHeight: 1 }}>
              Project <span style={{ fontStyle: "italic", color: G.gold }}>Registry</span>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: G.textSecondary, marginTop: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {projects.length} project{projects.length !== 1 ? "s" : ""} · {isSuperAdmin ? "Full Access" : "Read Only"}
            </div>
          </div>
          {isSuperAdmin && (
            <button className="pm-btn-gold" onClick={() => setShowForm(true)}>
              + New Project
            </button>
          )}
        </div>

        {/* ── Access Denied Banner (non-superadmin) ── */}
        {!isSuperAdmin && (
          <div style={{
            padding: "12px 18px", background: G.dangerDim,
            border: `1px solid ${G.dangerBorder}`, borderRadius: 10,
            color: G.danger, fontSize: 12, fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.06em", marginBottom: 28,
          }}>
            🔒 Only Super Admins can create or edit projects.
          </div>
        )}

        {/* ── Project Grid ── */}
        {projects.length === 0 ? (
          <div className="pm-denied">
            <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 300, color: G.textSecondary, marginBottom: 8 }}>
              No projects yet
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: G.textMuted }}>
              {isSuperAdmin ? "Click \"+ New Project\" to get started." : "Contact your Super Admin to create a project."}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 18 }}>
            {projects.map((project, idx) => (
              <div
                key={project.id}
                className="pm-card pm-fade-up"
                style={{ animationDelay: `${idx * 60}ms`, position: "relative", overflow: "hidden" }}
              >
                {/* colour accent bar */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: project.color ?? G.gold, borderRadius: "14px 14px 0 0" }} />

                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 6, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: project.color ?? G.gold, flexShrink: 0 }} />
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: G.textPrimary }}>{project.name}</span>
                  </div>
                  <span className={`pm-badge ${(project as any).status === "inactive" ? "pm-badge-inactive" : "pm-badge-active"}`}>
                    {(project as any).status ?? "active"}
                  </span>
                </div>

                {project.description && (
                  <p style={{ fontSize: 12, color: G.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>{project.description}</p>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
                  <div>
                    <div style={{ color: G.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Code</div>
                    <div style={{ color: G.gold }}>{(project as any).projectCode || "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: G.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Launch</div>
                    <div style={{ color: G.textSecondary }}>
                      {(project as any).launchDate
                        ? new Date((project as any).launchDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </div>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ color: G.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Doer</div>
                    <div style={{ color: G.textSecondary }}>{(project as any).concernedDoerEmail ? getDoerName((project as any).concernedDoerEmail) : "—"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════ CREATE PROJECT MODAL (SuperAdmin only) ══════════ */}
      {showForm && isSuperAdmin && (
        <div className="pm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="pm-modal">

            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "24px 28px 20px", borderBottom: `1px solid ${G.border}` }}>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: G.textSecondary, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Super Admin · New Entry</div>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400, color: G.textPrimary }}>Create Project</h2>
              </div>
              <button
                onClick={() => setShowForm(false)}
                style={{ width: 32, height: 32, borderRadius: 8, background: G.surfaceHigh, border: `1px solid ${G.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: G.textSecondary, fontSize: 16 }}
              >×</button>
            </div>

            {/* Form Body */}
            <div style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Name + Code */}
              <div className="pm-grid-2">
                <div>
                  <label className="pm-label">Project Name *</label>
                  <input className="pm-input" value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="e.g. Marina Heights" />
                  {errors.name && <div style={{ color: G.danger, fontSize: 11, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{errors.name}</div>}
                </div>
                <div>
                  <label className="pm-label">Project Code *</label>
                  <input className="pm-input" value={form.projectCode} onChange={(e) => field("projectCode", e.target.value.toUpperCase())} placeholder="e.g. MKT-001" />
                  {errors.projectCode && <div style={{ color: G.danger, fontSize: 11, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{errors.projectCode}</div>}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="pm-label">Description</label>
                <textarea className="pm-input" value={form.description} onChange={(e) => field("description", e.target.value)} placeholder="Short project description…" style={{ minHeight: 72, resize: "vertical" }} />
              </div>

              {/* Concerned Doer */}
              <div>
                <label className="pm-label">Concerned Doer *</label>
                <select className="pm-input" value={form.concernedDoerEmail} onChange={(e) => field("concernedDoerEmail", e.target.value)}>
                  <option value="">— Select doer —</option>
                  {doers.map((m) => (
                    <option key={m.id} value={m.email}>{m.name} ({m.role})</option>
                  ))}
                </select>
                {errors.concernedDoerEmail && <div style={{ color: G.danger, fontSize: 11, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{errors.concernedDoerEmail}</div>}
              </div>

              {/* Launch Date + Status */}
              <div className="pm-grid-2">
                <div>
                  <label className="pm-label">Launch Date *</label>
                  <input
                    type="date"
                    className="pm-input"
                    value={form.launchDate}
                    onChange={(e) => field("launchDate", e.target.value)}
                    style={{ colorScheme: "dark" }}
                  />
                  {errors.launchDate && <div style={{ color: G.danger, fontSize: 11, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{errors.launchDate}</div>}
                </div>
                <div>
                  <label className="pm-label">Status</label>
                  <select className="pm-input" value={form.status} onChange={(e) => field("status", e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="pm-label">Project Color</label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.name}
                      onClick={() => field("color", c.value)}
                      style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: c.value, border: form.color === c.value ? `3px solid #fff` : `2px solid rgba(255,255,255,0.15)`,
                        cursor: "pointer",
                        transform: form.color === c.value ? "scale(1.18)" : "scale(1)",
                        transition: "all 0.2s ease",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button className="pm-btn-gold" onClick={handleSubmit} disabled={loading} style={{ flex: 1 }}>
                  {loading ? "Saving…" : "Create Project"}
                </button>
                <button className="pm-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: `linear-gradient(135deg, ${G.surfaceHigh}, ${G.surfaceMid})`,
          border: `1px solid ${G.goldBorder}`, borderRadius: 99,
          padding: "12px 24px", fontFamily: "'DM Mono', monospace", fontSize: 12,
          color: G.textPrimary, zIndex: 9999, whiteSpace: "nowrap",
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${G.goldGlow}`,
        }}>
          {toast}
        </div>
      )}
    </>
  );
};

export default ProjectManagementNew;