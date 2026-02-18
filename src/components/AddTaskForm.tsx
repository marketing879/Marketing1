// src/components/AddTaskForm.tsx
import React, { useState } from "react";
import { useUser } from "../contexts/UserContext";
import "./AddTaskForm.css"; // Import the correct CSS file

interface NewTask {
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "on-hold";
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

const AddTaskForm: React.FC = () => {
  const { addTask, teamMembers, projects } = useUser();

  const [newTask, setNewTask] = useState<NewTask>({
    title: "",
    description: "",
    status: "pending",
    priority: "medium",
    dueDate: "",
    projectId: "",
    assignedTo: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setNewTask((prevState) => ({
      ...prevState,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!newTask.title.trim()) {
      newErrors.title = "Task title is required";
    }

    if (!newTask.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (!newTask.projectId) {
      newErrors.projectId = "Please select a project";
    }

    if (!newTask.assignedTo) {
      newErrors.assignedTo = "Please assign to a team member";
    }

    if (!newTask.dueDate) {
      newErrors.dueDate = "Due date is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      setIsLoading(true);

      // Simulate API call with a delay
      setTimeout(() => {
        // Add task to the context
        addTask(newTask);

        // Reset form after adding task
        setNewTask({
          title: "",
          description: "",
          status: "pending",
          priority: "medium",
          dueDate: "",
          projectId: "",
          assignedTo: "",
        });
        setErrors({});
        setIsLoading(false);

        // Success feedback
        alert("✅ Task created successfully!");
      }, 1000);
    }
  };

  const handleCancel = () => {
    if (
      newTask.title ||
      newTask.description ||
      newTask.projectId ||
      newTask.assignedTo ||
      newTask.dueDate
    ) {
      if (
        confirm("Are you sure you want to cancel? All changes will be lost.")
      ) {
        setNewTask({
          title: "",
          description: "",
          status: "pending",
          priority: "medium",
          dueDate: "",
          projectId: "",
          assignedTo: "",
        });
        setErrors({});
      }
    }
  };

  // Get filtered team members who are doers
  const doers = teamMembers.filter((member) => member.isDoer);

  return (
    <form onSubmit={handleSubmit} className="task-form">
      <h1>Create New Task</h1>

      {/* Task Title */}
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
        {errors.title && <span className="error-message">{errors.title}</span>}
      </div>

      {/* Description */}
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

      {/* Project Dropdown */}
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

      {/* Assign To */}
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
          {doers.length > 0 ? (
            doers.map((member) => (
              <option key={member.id} value={member.name}>
                {member.name} ({member.role})
              </option>
            ))
          ) : (
            <option value="" disabled>
              No team members available
            </option>
          )}
        </select>
        {errors.assignedTo && (
          <span className="error-message">{errors.assignedTo}</span>
        )}
      </div>

      {/* Priority */}
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

      {/* Due Date */}
      <div className="form-group">
        <label htmlFor="dueDate">Due Date</label>
        <input
          type="date"
          id="dueDate"
          name="dueDate"
          value={newTask.dueDate}
          onChange={handleChange}
          className={errors.dueDate ? "error" : ""}
          min={new Date().toISOString().split("T")[0]} // Prevent past dates
        />
        {errors.dueDate && (
          <span className="error-message">{errors.dueDate}</span>
        )}
      </div>

      {/* Status */}
      <div className="form-group">
        <label htmlFor="status">Status</label>
        <select
          id="status"
          name="status"
          value={newTask.status}
          onChange={handleChange}
        >
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="on-hold">On Hold</option>
        </select>
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <button
          type="button"
          className="cancel-btn"
          onClick={handleCancel}
          disabled={isLoading}
        >
          Cancel
        </button>
        <button type="submit" className="submit-btn" disabled={isLoading}>
          {isLoading ? "Creating Task..." : "Create Task"}
        </button>
      </div>
    </form>
  );
};

export default AddTaskForm;
