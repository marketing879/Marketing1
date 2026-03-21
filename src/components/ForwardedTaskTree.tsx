import React from "react";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: "high" | "medium" | "low";
  approvalStatus: string;
  dueDate: string;
  assignedTo: string;
  assignedBy?: string;
  projectId?: string;
  timeSlot?: string;
  exactDeadline?: string;
  history?: Array<{
    id: string;
    timestamp: string;
    action: string;
    by: string;
    to?: string;
    notes?: string;
  }>;
  completionNotes?: string;
  adminComments?: string;
  attachments?: string[];
  tatBreached?: boolean;
  smartAssist?: { delayDuration?: string; reminderCount?: number };
  completedAt?: string;
  createdAt?: string;
  forwardedFrom?: string;
}

interface ForwardedTaskTreeProps {
  tasks: Task[];
  getNameFn: (email: string) => string;
  isAdminFn: (email: string) => boolean;
  onSelectTask: (task: Task) => void;
}

const ForwardedTaskTree: React.FC<ForwardedTaskTreeProps> = ({
  tasks,
  getNameFn,
  isAdminFn,
  onSelectTask,
}) => {
  if (!tasks || tasks.length === 0) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "#8a7355" }}>
        No tasks to display in the task tree.
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ color: "#f0e6d3", fontSize: 14, lineHeight: 1.6 }}>
        <p>📋 Task forwarding tree visualization</p>
        <p style={{ fontSize: 12, color: "#8a7355", marginTop: 10 }}>
          Showing {tasks.length} task(s) with parent-child relationships
        </p>
        <div
          style={{
            marginTop: 20,
            padding: "12px",
            background: "#0f0d08",
            border: "1px solid rgba(201,169,110,0.1)",
            borderRadius: 8,
          }}
        >
          <ul style={{ listStyle: "none", padding: 0 }}>
            {tasks.map((task) => (
              <li
                key={task.id}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(201,169,110,0.1)",
                  cursor: "pointer",
                  color: "#c9a96e",
                }}
                onClick={() => onSelectTask(task)}
              >
                <strong>{task.title}</strong>
                <div style={{ fontSize: 11, color: "#8a7355", marginTop: 4 }}>
                  Assigned to: {getNameFn(task.assignedTo)}
                  {task.forwardedFrom && (
                    <div>Forwarded from: {getNameFn(task.forwardedFrom)}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ForwardedTaskTree;
