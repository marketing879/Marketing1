// src/components/TaskDetails.tsx
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import "./TaskDetails.css";

const TaskDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTaskById, updateTask, deleteTask, teamMembers } = useUser();

  const task = getTaskById(id!);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(task);

  if (!task || !editedTask) {
    return (
      <div className="task-details-container">
        <div className="error-card">
          <h2>Task Not Found</h2>
          <p>The task you're looking for doesn't exist.</p>
          <button onClick={() => navigate("/")} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    updateTask(id!, editedTask);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      deleteTask(id!);
      navigate("/");
    }
  };

  const handleStatusChange = (newStatus: typeof task.status) => {
    const updated = { ...editedTask, status: newStatus };
    setEditedTask(updated);
    updateTask(id!, { status: newStatus });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "#ef4444";
      case "medium":
        return "#f59e0b";
      case "low":
        return "#22c55e";
      default:
        return "#64748b";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="task-details-container">
      <div className="task-details-card fade-in">
        <div className="details-header">
          <button onClick={() => navigate("/")} className="back-btn">
            ← Back
          </button>
          <div className="header-actions">
            {!isEditing && (
              <>
                <button onClick={() => setIsEditing(true)} className="btn-edit">
                  ✏️ Edit
                </button>
                <button onClick={handleDelete} className="btn-delete">
                  🗑️ Delete
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button onClick={handleSave} className="btn-save">
                  💾 Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <div className="task-content">
          {!isEditing ? (
            <>
              <div className="title-section">
                <h1>{task.title}</h1>
                <span
                  className="priority-badge"
                  style={{ backgroundColor: getPriorityColor(task.priority) }}
                >
                  {task.priority.toUpperCase()}
                </span>
              </div>

              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Status</span>
                  <div className="status-buttons">
                    {(
                      [
                        "pending",
                        "in-progress",
                        "under-review",
                        "completed",
                      ] as const
                    ).map((status) => (
                      <button
                        key={status}
                        className={`status-btn ${
                          task.status === status ? "active" : ""
                        }`}
                        onClick={() => handleStatusChange(status)}
                      >
                        {status
                          .split("-")
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(" ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="info-item">
                  <span className="info-label">Assigned To</span>
                  <div className="assignee-display">
                    <div className="assignee-avatar-large">
                      {getInitials(task.assignedTo)}
                    </div>
                    <div className="assignee-details">
                      <span className="assignee-name">{task.assignedTo}</span>
                      <span className="assignee-role">
                        {teamMembers.find((m) => m.name === task.assignedTo)
                          ?.role || "Team Member"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="info-item">
                  <span className="info-label">Due Date</span>
                  <span className="info-value">📅 {task.dueDate}</span>
                </div>

                <div className="info-item">
                  <span className="info-label">Created</span>
                  <span className="info-value">📆 {task.createdAt}</span>
                </div>
              </div>

              <div className="description-section">
                <h3>Description</h3>
                <p>{task.description}</p>
              </div>
            </>
          ) : (
            <div className="edit-form">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={editedTask.title}
                  onChange={(e) =>
                    setEditedTask({ ...editedTask, title: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editedTask.description}
                  onChange={(e) =>
                    setEditedTask({
                      ...editedTask,
                      description: e.target.value,
                    })
                  }
                  rows={6}
                />
              </div>

              <div className="form-group">
                <label>Assign To</label>
                <select
                  value={editedTask.assignedTo}
                  onChange={(e) =>
                    setEditedTask({ ...editedTask, assignedTo: e.target.value })
                  }
                >
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.name}>
                      {member.name} ({member.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={editedTask.priority}
                    onChange={(e) =>
                      setEditedTask({
                        ...editedTask,
                        priority: e.target.value as "low" | "medium" | "high",
                      })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={editedTask.dueDate}
                    onChange={(e) =>
                      setEditedTask({ ...editedTask, dueDate: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {task.status === "completed" && (
          <div className="review-section">
            <button
              onClick={() => navigate(`/review/${id}`)}
              className="btn-review"
            >
              📝 Write Review
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskDetails;
