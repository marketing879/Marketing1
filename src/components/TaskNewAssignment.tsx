// src/components/TaskNewAssignment.tsx
import React, { useState, useEffect, useRef } from "react";
import { useUser, Task } from "../contexts/UserContext";
import "./AddTaskForm.css";

// ============ FIXED: Updated status values to match Task interface ============
interface NewTask {
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "approved" | "rework"; // ← FIXED: Changed from "in-progress" to "in_progress"
  priority: "low" | "medium" | "high";
  dueDate: string;
  projectId: string;
  assignedTo: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  projectId?: string;
  assignedTo?: string;
  dueDate?: string;
}

interface TaskNewAssignmentProps {
  onCancel: () => void;
  onTaskCreated: () => void;
  taskToEdit?: Task | null;
}

const EMPTY_TASK: NewTask = {
  title: "",
  description: "",
  status: "pending",
  priority: "medium",
  dueDate: "",
  projectId: "",
  assignedTo: "",
};

const TaskNewAssignment: React.FC<TaskNewAssignmentProps> = ({
  onCancel,
  onTaskCreated,
  taskToEdit,
}) => {
  const { user, addTask, updateTask, teamMembers, projects } = useUser();

  const [newTask, setNewTask] = useState<NewTask>(EMPTY_TASK);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const originalTaskRef = useRef<NewTask | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (taskToEdit) {
      const populated: NewTask = {
        title: taskToEdit.title,
        description: taskToEdit.description,
        status: taskToEdit.status,
        priority: taskToEdit.priority,
        dueDate: taskToEdit.dueDate,
        projectId: taskToEdit.projectId,
        assignedTo: taskToEdit.assignedTo,
      };
      setNewTask(populated);
      originalTaskRef.current = populated;
    } else {
      originalTaskRef.current = null;
    }
  }, [taskToEdit]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setNewTask((prev) => ({ ...prev, [name]: value }));

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!newTask.title.trim()) newErrors.title = "Task title is required";
    if (!newTask.description.trim())
      newErrors.description = "Description is required";
    if (!newTask.projectId) newErrors.projectId = "Please select a project";
    if (!newTask.assignedTo)
      newErrors.assignedTo = "Please assign to a team member";
    if (!newTask.dueDate) newErrors.dueDate = "Due date is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isDirty = (): boolean => {
    const baseline = originalTaskRef.current ?? EMPTY_TASK;
    return (Object.keys(baseline) as (keyof NewTask)[]).some(
      (key) => newTask[key] !== baseline[key]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setSuccessMessage(null);

    setTimeout(() => {
      if (!isMountedRef.current) return;

      if (taskToEdit) {
        updateTask(taskToEdit.id, newTask);
        setSuccessMessage("Task updated successfully!");
      } else {
        addTask({
          ...newTask,
          assignedBy: user?.email || "",
          approvalStatus: "assigned",
        });
        setSuccessMessage("Task created successfully!");
      }

      setNewTask(EMPTY_TASK);
      setErrors({});
      setIsLoading(false);
      onTaskCreated();
    }, 1000);
  };

  const handleCancelClick = () => {
    if (isDirty()) {
      setShowCancelConfirm(true);
    } else {
      onCancel();
    }
  };

  const handleConfirmCancel = () => {
    setNewTask(EMPTY_TASK);
    setErrors({});
    setShowCancelConfirm(false);
    onCancel();
  };

  // ============ FIXED: Updated filtering logic to use isDoer ============
  const doers = teamMembers.filter((member) => member.isDoer); // ← FIXED: Now uses isDoer instead of role === "staff"

  const today = new Date().toISOString().split("T")[0];

  return (
    <>
      <form onSubmit={handleSubmit} className="task-form" noValidate>
        <h1>{taskToEdit ? "Edit Task" : "Create New Task"}</h1>

        {successMessage && (
          <div className="success-message" role="status">
            ✅ {successMessage}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="title">Task Title</label>
          <input
            type="text"
            id="title"
            name="title"
            value={newTask.title}
            onChange={handleChange}
            placeholder="Enter task title"
            className={errors.title ? "error" : ""}
          />
          {errors.title && (
            <span className="error-message">{errors.title}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={newTask.description}
            onChange={handleChange}
            placeholder="Enter task description"
            className={errors.description ? "error" : ""}
          />
          {errors.description && (
            <span className="error-message">{errors.description}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="projectId">Project</label>
          <select
            id="projectId"
            name="projectId"
            value={newTask.projectId}
            onChange={handleChange}
            className={errors.projectId ? "error" : ""}
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {errors.projectId && (
            <span className="error-message">{errors.projectId}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="assignedTo">Assign To</label>
          <select
            id="assignedTo"
            name="assignedTo"
            value={newTask.assignedTo}
            onChange={handleChange}
            className={errors.assignedTo ? "error" : ""}
          >
            <option value="">Select a team member</option>
            {doers.map((member) => (
              <option key={member.id} value={member.name}>
                {member.name} ({member.role})
              </option>
            ))}
          </select>
          {errors.assignedTo && (
            <span className="error-message">{errors.assignedTo}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="priority">Priority</label>
          <select
            id="priority"
            name="priority"
            value={newTask.priority}
            onChange={handleChange}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="dueDate">Due Date</label>
          <input
            type="date"
            id="dueDate"
            name="dueDate"
            value={newTask.dueDate}
            onChange={handleChange}
            className={errors.dueDate ? "error" : ""}
            {...(!taskToEdit && { min: today })}
          />
          {errors.dueDate && (
            <span className="error-message">{errors.dueDate}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            value={newTask.status}
            onChange={handleChange}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="approved">Approved</option>
            <option value="rework">Rework</option>
          </select>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="cancel-btn"
            onClick={handleCancelClick}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading
              ? taskToEdit
                ? "Updating Task..."
                : "Creating Task..."
              : taskToEdit
              ? "Update Task"
              : "Create Task"}
          </button>
        </div>
      </form>

      {showCancelConfirm && (
        <div className="confirm-dialog" role="dialog" aria-modal="true">
          <p>
            Are you sure you want to cancel? All unsaved changes will be lost.
          </p>
          <div className="confirm-actions">
            <button
              className="cancel-btn"
              onClick={() => setShowCancelConfirm(false)}
            >
              Keep Editing
            </button>
            <button className="submit-btn" onClick={handleConfirmCancel}>
              Discard Changes
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskNewAssignment;
