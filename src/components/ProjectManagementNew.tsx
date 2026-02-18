import React, { useState } from "react";
import { useUser } from "../contexts/UserContext";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "rgba(15, 23, 42, 0.5)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: "600",
  color: "#cbd5e1",
  marginBottom: "8px",
};

const colorOptions = [
  { value: "#3B82F6", name: "Blue" },
  { value: "#8B5CF6", name: "Purple" },
  { value: "#EC4899", name: "Pink" },
  { value: "#10B981", name: "Green" },
  { value: "#F59E0B", name: "Amber" },
  { value: "#EF4444", name: "Red" },
  { value: "#6366F1", name: "Indigo" },
  { value: "#14B8A6", name: "Teal" },
  { value: "#F97316", name: "Orange" },
  { value: "#06B6D4", name: "Cyan" },
];

// ─── Assign-Task Form ────────────────────────────────────────────────────────
interface AssignTaskFormProps {
  onClose: () => void;
}

const AssignTaskForm: React.FC<AssignTaskFormProps> = ({ onClose }) => {
  const { projects, teamMembers, addTask } = useUser();

  const [form, setForm] = useState({
    title: "",
    description: "",
    projectId: "", // ← bound to project dropdown
    assignedTo: "",
    priority: "medium" as "low" | "medium" | "high",
    dueDate: "",
    status: "pending" as const,
  });
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return setError("Title is required.");
    if (!form.projectId) return setError("Please select a project.");
    if (!form.assignedTo) return setError("Please select a team member.");
    if (!form.dueDate) return setError("Due date is required.");

    addTask(form);
    onClose();
  };

  const field = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const focusBorder = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    e.currentTarget.style.borderColor = "rgba(59,130,246,0.6)";
  };
  const blurBorder = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
  };

  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.7))",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "16px",
        padding: "32px",
        marginBottom: "32px",
        animation: "slideDown 0.3s ease",
      }}
    >
      <h3
        style={{
          fontSize: "20px",
          fontWeight: "600",
          color: "#fff",
          margin: "0 0 24px 0",
        }}
      >
        Assign New Task
      </h3>

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: "8px",
            padding: "10px 14px",
            color: "#fca5a5",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "18px" }}
      >
        {/* Title */}
        <div>
          <label style={labelStyle}>Task Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => field("title", e.target.value)}
            placeholder="Enter task title"
            style={inputStyle}
            onFocus={focusBorder}
            onBlur={blurBorder}
          />
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => field("description", e.target.value)}
            placeholder="Enter task description"
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            onFocus={focusBorder}
            onBlur={blurBorder}
          />
        </div>

        {/* ── Project Dropdown ─────────────────────────────────────────────── */}
        <div>
          <label style={labelStyle}>Project *</label>
          <div style={{ position: "relative" }}>
            {/* colour swatch preview */}
            {form.projectId && (
              <span
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor:
                    projects.find((p) => p.id === form.projectId)?.color ??
                    "#6366F1",
                  pointerEvents: "none",
                }}
              />
            )}
            <select
              value={form.projectId}
              onChange={(e) => field("projectId", e.target.value)}
              style={{
                ...inputStyle,
                paddingLeft: form.projectId ? "34px" : "16px",
                appearance: "none",
                WebkitAppearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 14px center",
                cursor: "pointer",
              }}
              onFocus={focusBorder}
              onBlur={blurBorder}
            >
              <option value="" style={{ background: "#1e293b" }}>
                — Select a project —
              </option>
              {projects.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  style={{ background: "#1e293b" }}
                >
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {projects.length === 0 && (
            <p style={{ fontSize: "12px", color: "#f59e0b", marginTop: "6px" }}>
              No projects yet — create one above first.
            </p>
          )}
        </div>
        {/* ─────────────────────────────────────────────────────────────────── */}

        {/* Assign To */}
        <div>
          <label style={labelStyle}>Assign To *</label>
          <select
            value={form.assignedTo}
            onChange={(e) => field("assignedTo", e.target.value)}
            style={{
              ...inputStyle,
              appearance: "none",
              WebkitAppearance: "none",
              cursor: "pointer",
            }}
            onFocus={focusBorder}
            onBlur={blurBorder}
          >
            <option value="" style={{ background: "#1e293b" }}>
              — Select team member —
            </option>
            {teamMembers.map((m) => (
              <option
                key={m.id}
                value={m.email}
                style={{ background: "#1e293b" }}
              >
                {m.name} ({m.role})
              </option>
            ))}
          </select>
        </div>

        {/* Priority + Due Date (row) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          <div>
            <label style={labelStyle}>Priority</label>
            <select
              value={form.priority}
              onChange={(e) =>
                field("priority", e.target.value as "low" | "medium" | "high")
              }
              style={{
                ...inputStyle,
                appearance: "none",
                WebkitAppearance: "none",
                cursor: "pointer",
              }}
              onFocus={focusBorder}
              onBlur={blurBorder}
            >
              <option value="low" style={{ background: "#1e293b" }}>
                🟢 Low
              </option>
              <option value="medium" style={{ background: "#1e293b" }}>
                🟡 Medium
              </option>
              <option value="high" style={{ background: "#1e293b" }}>
                🔴 High
              </option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Due Date *</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => field("dueDate", e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
          <button
            type="submit"
            style={{
              flex: 1,
              padding: "12px",
              background: "linear-gradient(90deg,#3B82F6,#2563EB)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Assign Task
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "12px 20px",
              background: "rgba(255,255,255,0.08)",
              color: "#cbd5e1",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const ProjectManagement: React.FC = () => {
  const { projects, addProject } = useUser();

  const [showAddProject, setShowAddProject] = useState(false);
  const [showAssignTask, setShowAssignTask] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
  });

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim()) return alert("Please enter a project name");
    addProject(newProject); // ← calls real context function
    setNewProject({ name: "", description: "", color: "#3B82F6" });
    setShowAddProject(false);
  };

  return (
    <div
      style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "40px 20px",
        background:
          "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)",
        minHeight: "100vh",
        color: "#fff",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
          paddingBottom: "24px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <h2
          style={{
            fontSize: "28px",
            fontWeight: "bold",
            color: "#fff",
            margin: 0,
          }}
        >
          📁 Project Management
        </h2>

        <div style={{ display: "flex", gap: "10px" }}>
          {/* ── Assign Task button ── */}
          <button
            onClick={() => {
              setShowAssignTask((v) => !v);
              setShowAddProject(false);
            }}
            style={{
              padding: "10px 20px",
              background: showAssignTask
                ? "rgba(255,255,255,0.1)"
                : "linear-gradient(90deg,#8B5CF6,#6D28D9)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            {showAssignTask ? "✕ Cancel" : "✅ Assign Task"}
          </button>

          {/* Add Project button */}
          <button
            onClick={() => {
              setShowAddProject((v) => !v);
              setShowAssignTask(false);
            }}
            style={{
              padding: "10px 20px",
              background: showAddProject
                ? "rgba(255,255,255,0.1)"
                : "linear-gradient(90deg,#3B82F6,#2563EB)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            {showAddProject ? "✕ Cancel" : "+ Add Project"}
          </button>
        </div>
      </div>

      {/* Assign Task Form */}
      {showAssignTask && (
        <AssignTaskForm onClose={() => setShowAssignTask(false)} />
      )}

      {/* Add Project Form */}
      {showAddProject && (
        <div
          style={{
            background:
              "linear-gradient(135deg,rgba(30,41,59,0.8),rgba(15,23,42,0.6))",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px",
            padding: "32px",
            marginBottom: "32px",
            animation: "slideDown 0.3s ease",
          }}
        >
          <h3
            style={{
              fontSize: "20px",
              fontWeight: "600",
              marginBottom: "24px",
              color: "#fff",
            }}
          >
            Add New Project
          </h3>
          <form
            onSubmit={handleAddProject}
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#cbd5e1",
                  marginBottom: "8px",
                }}
              >
                Project Name *
              </label>
              <input
                type="text"
                value={newProject.name}
                onChange={(e) =>
                  setNewProject({ ...newProject, name: e.target.value })
                }
                placeholder="Enter project name"
                style={inputStyle}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(59,130,246,0.5)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")
                }
                required
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#cbd5e1",
                  marginBottom: "8px",
                }}
              >
                Description
              </label>
              <input
                type="text"
                value={newProject.description}
                onChange={(e) =>
                  setNewProject({ ...newProject, description: e.target.value })
                }
                placeholder="Enter project description"
                style={inputStyle}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(59,130,246,0.5)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")
                }
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#cbd5e1",
                  marginBottom: "12px",
                }}
              >
                Color
              </label>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() =>
                      setNewProject({ ...newProject, color: color.value })
                    }
                    title={color.name}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      backgroundColor: color.value,
                      border:
                        newProject.color === color.value
                          ? "3px solid #fff"
                          : "2px solid rgba(255,255,255,0.3)",
                      cursor: "pointer",
                      transform:
                        newProject.color === color.value
                          ? "scale(1.15)"
                          : "scale(1)",
                      transition: "all 0.2s ease",
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              style={{
                padding: "12px 24px",
                background: "linear-gradient(90deg,#3B82F6,#2563EB)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Add Project
            </button>
          </form>
        </div>
      )}

      {/* Projects Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "20px",
        }}
      >
        {projects.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              background:
                "linear-gradient(135deg,rgba(30,41,59,0.6),rgba(15,23,42,0.4))",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
              padding: "60px 20px",
              textAlign: "center",
              color: "#94a3b8",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📁</div>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                margin: "0 0 8px 0",
                color: "#cbd5e1",
              }}
            >
              No projects yet
            </h3>
            <p style={{ margin: 0, fontSize: "14px" }}>
              Click "+ Add Project" to create your first project
            </p>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              style={{
                background:
                  "linear-gradient(135deg,rgba(30,41,59,0.8),rgba(15,23,42,0.6))",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
                padding: "20px",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    backgroundColor: project.color ?? "#6366F1",
                    flexShrink: 0,
                  }}
                />
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#fff",
                    margin: 0,
                  }}
                >
                  {project.name}
                </h3>
              </div>

              {project.description && (
                <p
                  style={{
                    color: "#94a3b8",
                    fontSize: "13px",
                    margin: "0 0 12px 0",
                  }}
                >
                  {project.description}
                </p>
              )}

              <div
                style={{
                  paddingTop: "12px",
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  color: "#64748b",
                  fontSize: "12px",
                }}
              >
                ID: {project.id}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        select option { background: #1e293b; color: #fff; }
      `}</style>
    </div>
  );
};

export default ProjectManagement;
