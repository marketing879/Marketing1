import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, Task } from "../contexts/UserContext";
import TaskNewAssignment from "./TaskNewAssignment";

const Dashboard: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const handleAddNewTask = () => {
    setTaskToEdit(null);
    setShowTaskForm(true);
  };

  const handleCancelTaskForm = () => {
    setShowTaskForm(false);
    setTaskToEdit(null);
  };

  const handleTaskSuccess = () => {
    setShowTaskForm(false);
    setTaskToEdit(null);
  };

  const handleAddUser = () => {
    navigate("/add-user");
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
      navigate("/login", { replace: true });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        color: "#fff",
        padding: "40px 20px",
      }}
    >
      {/* Header */}
      <header
        style={{
          maxWidth: "1280px",
          margin: "0 auto 40px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          paddingBottom: "30px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          {/* Left Section */}
          <div>
            <h1
              style={{
                fontSize: "36px",
                fontWeight: "bold",
                margin: "0 0 12px 0",
                background: "linear-gradient(90deg, #22d3ee, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              ✨ Task Management
            </h1>
            <p
              style={{
                color: "#94a3b8",
                margin: "0 0 16px 0",
                fontSize: "15px",
              }}
            >
              Dashboard • {user?.role.toUpperCase() || "User"}
            </p>

            {user && (
              <div style={{ color: "#cbd5e1", fontSize: "14px" }}>
                <p style={{ margin: "0 0 4px 0" }}>👤 {user.name}</p>
                <p style={{ margin: "0" }}>📧 {user.email}</p>
              </div>
            )}
          </div>

          {/* Right Section - Buttons */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {/* Add User - Only for Superadmin */}
            {user?.role === "superadmin" && (
              <button
                onClick={handleAddUser}
                style={{
                  padding: "10px 20px",
                  background: "linear-gradient(90deg, #22d3ee, #06b6d4)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 10px 20px rgba(34, 211, 238, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                👤 Add User
              </button>
            )}

            {/* Add Task Button */}
            <button
              onClick={handleAddNewTask}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(90deg, #667eea, #764ba2)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 10px 20px rgba(102, 126, 234, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              ➕ Add Task
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              style={{
                padding: "10px 20px",
                background: "rgba(239, 68, 68, 0.2)",
                color: "#fca5a5",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                fontWeight: "600",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* Task Form Section */}
        {showTaskForm && (
          <section
            style={{
              background:
                "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.6))",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "16px",
              padding: "32px",
              marginBottom: "40px",
              animation: "slideDown 0.3s ease",
            }}
          >
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                margin: "0 0 24px 0",
                color: "#fff",
              }}
            >
              {taskToEdit ? "✏️ Edit Task" : "➕ Add New Task"}
            </h2>
            <TaskNewAssignment
              onCancel={handleCancelTaskForm}
              onTaskCreated={handleTaskSuccess}
              taskToEdit={taskToEdit}
            />
          </section>
        )}

        {/* Tasks List Section */}
        <section>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "24px",
              color: "#fff",
            }}
          >
            📋 All Tasks
          </h2>

          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.4))",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "16px",
              padding: "60px 20px",
              textAlign: "center",
              color: "#94a3b8",
            }}
          >
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>📋</div>
            <h3
              style={{
                fontSize: "22px",
                fontWeight: "bold",
                margin: "0 0 8px 0",
                color: "#cbd5e1",
              }}
            >
              Welcome to Task Management!
            </h3>
            <p style={{ margin: "0", fontSize: "15px" }}>
              Click the "Add Task" button to create your first task
            </p>
          </div>
        </section>
      </main>

      {/* Animation Styles */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
