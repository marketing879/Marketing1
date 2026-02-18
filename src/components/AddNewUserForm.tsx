import React, { useState } from "react";
import { useUser } from "../contexts/UserContext";

interface FormData {
  name: string;
  email: string;
  role: string;
  systemRole: "staff" | "admin" | "superadmin";
  isDoer: boolean;
}

interface FormErrors {
  name?: string;
  email?: string;
  role?: string;
  systemRole?: string;
}

interface AddNewUserFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const generateUserId = (email: string, systemRole: string): string => {
  const prefixes: { [key: string]: string } = {
    staff: "STF",
    admin: "ADM",
    superadmin: "SPA",
  };
  const prefix = prefixes[systemRole.toLowerCase()] || "USR";
  const emailPrefix = email.split("@")[0].substring(0, 4).toUpperCase();
  const timestamp = Date.now().toString(36).substring(-4).toUpperCase();
  return `${prefix}-${emailPrefix}-${timestamp}`;
};

const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

const AddNewUserForm: React.FC<AddNewUserFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { addUser, user } = useUser();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    role: "",
    systemRole: "staff",
    isDoer: true,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showCredentials, setShowCredentials] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    userId: string;
    email: string;
    otp: string;
    name: string;
    systemRole: string;
  } | null>(null);

  if (!user || user.role !== "superadmin") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <div
          style={{
            textAlign: "center",
            padding: 40,
            background: "rgba(220,60,60,0.07)",
            border: "1px solid rgba(220,60,60,0.2)",
            borderRadius: 16,
            maxWidth: 400,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 24,
              color: "#f0e6d3",
              marginBottom: 12,
            }}
          >
            Access Denied
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
              marginBottom: 24,
            }}
          >
            Only Superadmin can create new users and assign system access roles.
          </p>
          <button
            onClick={onCancel}
            style={{
              padding: "10px 24px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Please enter a valid email";
    if (!formData.role.trim()) newErrors.role = "Job role is required";
    if (!formData.systemRole)
      newErrors.systemRole = "System access role is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const userId = generateUserId(formData.email, formData.systemRole);
    const otp = generateOTP();

    const result = addUser({
      name: formData.name,
      email: formData.email,
      role: formData.systemRole,
      password: otp,
    });

    if (!result.success) {
      setErrors({ email: result.message });
      return;
    }

    setGeneratedCredentials({
      userId,
      email: formData.email,
      otp,
      name: formData.name,
      systemRole: formData.systemRole,
    });
    setShowCredentials(true);
    console.log(
      `✓ User created: ${formData.name} (${formData.systemRole}) — OTP: ${otp}`
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`✅ ${label} copied to clipboard!`);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      role: "",
      systemRole: "staff",
      isDoer: true,
    });
    setErrors({});
    setShowCredentials(false);
    setGeneratedCredentials(null);
  };

  const handleCancel = () => {
    if (formData.name || formData.email || formData.role) {
      if (
        window.confirm(
          "Are you sure you want to cancel? All changes will be lost."
        )
      ) {
        if (onCancel) onCancel();
      }
    } else {
      if (onCancel) onCancel();
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    color: "#f0e6d3",
    fontSize: 14,
    fontFamily: "DM Sans, sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.3)",
    marginBottom: 8,
    fontWeight: 500,
  };
  const errorStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#e87070",
    marginTop: 6,
    display: "block",
  };

  if (showCredentials && generatedCredentials) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px" }}>
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: 36,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(16,185,129,0.15)",
                border: "1px solid rgba(16,185,129,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                margin: "0 auto 20px",
              }}
            >
              ✓
            </div>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 28,
                fontWeight: 400,
                color: "#f0e6d3",
                marginBottom: 8,
              }}
            >
              User Created Successfully!
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
              Share these credentials with {generatedCredentials.name}
            </p>
          </div>

          <div
            style={{
              padding: "14px 16px",
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.2)",
              borderRadius: 10,
              marginBottom: 24,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fcd34d",
                  marginBottom: 4,
                }}
              >
                Important: Save These Credentials
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                The OTP is the password for login. Share it securely with the
                user.
              </p>
            </div>
          </div>

          {[
            {
              label: "User ID",
              value: generatedCredentials.userId,
              isOtp: false,
            },
            {
              label: "Email (Username for Login)",
              value: generatedCredentials.email,
              isOtp: false,
            },
            {
              label: "OTP (Password for Login)",
              value: generatedCredentials.otp,
              isOtp: true,
            },
            {
              label: "System Access Level",
              value: generatedCredentials.systemRole,
              isOtp: false,
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                marginBottom: 16,
                padding: "14px 16px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
              }}
            >
              <label style={{ ...labelStyle, marginBottom: 10 }}>
                {item.label}
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <code
                  style={{
                    fontSize: item.isOtp ? 24 : 14,
                    color: item.isOtp ? "#c9a96e" : "#f0e6d3",
                    fontFamily: "DM Mono, monospace",
                    letterSpacing: item.isOtp ? "0.3em" : "0.05em",
                  }}
                >
                  {item.value}
                </code>
                {item.label !== "System Access Level" && (
                  <button
                    onClick={() => copyToClipboard(item.value, item.label)}
                    style={{
                      padding: "6px 12px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      color: "rgba(255,255,255,0.5)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontFamily: "DM Sans, sans-serif",
                      whiteSpace: "nowrap",
                    }}
                  >
                    📋 Copy
                  </button>
                )}
              </div>
            </div>
          ))}

          <div
            style={{
              padding: "16px 18px",
              background: "rgba(102,126,234,0.07)",
              border: "1px solid rgba(102,126,234,0.15)",
              borderRadius: 10,
              marginBottom: 24,
            }}
          >
            <h3
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#a5b4fc",
                marginBottom: 12,
              }}
            >
              📧 Login Instructions for User:
            </h3>
            <ol
              style={{
                paddingLeft: 18,
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                lineHeight: 2,
              }}
            >
              <li>Go to the login page</li>
              <li>
                Enter Email:{" "}
                <strong style={{ color: "#f0e6d3" }}>
                  {generatedCredentials.email}
                </strong>
              </li>
              <li>
                Select Role:{" "}
                <strong style={{ color: "#f0e6d3" }}>
                  {generatedCredentials.systemRole}
                </strong>
              </li>
              <li>Click "Generate OTP"</li>
              <li>
                Enter OTP:{" "}
                <strong style={{ color: "#c9a96e" }}>
                  {generatedCredentials.otp}
                </strong>
              </li>
              <li>Click "Login"</li>
            </ol>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={resetForm}
              style={{
                flex: 1,
                padding: 14,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                color: "rgba(255,255,255,0.5)",
                fontSize: 13,
                fontFamily: "DM Sans, sans-serif",
                cursor: "pointer",
              }}
            >
              ➕ Create Another
            </button>
            <button
              onClick={() => {
                resetForm();
                if (onSuccess) onSuccess();
              }}
              style={{
                flex: 1,
                padding: 14,
                background: "linear-gradient(135deg, #c9a96e, #a07840)",
                border: "none",
                borderRadius: 10,
                color: "#080810",
                fontSize: 13,
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✓ Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: 36,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 28,
              fontWeight: 400,
              color: "#f0e6d3",
            }}
          >
            Add Team Member
          </h1>
          <span
            style={{
              padding: "4px 12px",
              background: "rgba(201,169,110,0.12)",
              border: "1px solid rgba(201,169,110,0.25)",
              borderRadius: 6,
              fontSize: 11,
              color: "#c9a96e",
              letterSpacing: "0.1em",
            }}
          >
            👑 SUPERADMIN
          </span>
        </div>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.3)",
            marginBottom: 28,
          }}
        >
          Create new users and assign system access roles
        </p>

        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Full Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter full name"
            style={{
              ...inputStyle,
              borderColor: errors.name
                ? "rgba(220,60,60,0.4)"
                : "rgba(255,255,255,0.08)",
            }}
          />
          {errors.name && <span style={errorStyle}>{errors.name}</span>}
        </div>

        {/* Email */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>
            Email Address *{" "}
            <span
              style={{
                color: "rgba(255,255,255,0.2)",
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              (username)
            </span>
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="name@example.com"
            style={{
              ...inputStyle,
              borderColor: errors.email
                ? "rgba(220,60,60,0.4)"
                : "rgba(255,255,255,0.08)",
            }}
          />
          {errors.email && <span style={errorStyle}>{errors.email}</span>}
        </div>

        {/* System Role */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>System Access Role *</label>
          <select
            name="systemRole"
            value={formData.systemRole}
            onChange={handleChange}
            style={{
              ...inputStyle,
              borderColor: errors.systemRole
                ? "rgba(220,60,60,0.4)"
                : "rgba(255,255,255,0.08)",
            }}
          >
            <option value="staff">👨‍💼 Staff — Basic Access</option>
            <option value="admin">
              📋 Admin — Can manage tasks and review
            </option>
            <option value="superadmin">
              👑 Superadmin — Full System Access
            </option>
          </select>
          {errors.systemRole && (
            <span style={errorStyle}>{errors.systemRole}</span>
          )}
          <div
            style={{
              marginTop: 8,
              padding: "10px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8,
              fontSize: 12,
              color: "rgba(255,255,255,0.3)",
              lineHeight: 1.8,
            }}
          >
            <strong style={{ color: "rgba(255,255,255,0.5)" }}>Staff:</strong>{" "}
            View and complete assigned tasks
            <br />
            <strong style={{ color: "rgba(255,255,255,0.5)" }}>
              Admin:
            </strong>{" "}
            Create tasks, review staff submissions
            <br />
            <strong style={{ color: "rgba(255,255,255,0.5)" }}>
              Superadmin:
            </strong>{" "}
            Full access including user management
          </div>
        </div>

        {/* Job Role */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>
            Job Role *{" "}
            <span
              style={{
                color: "rgba(255,255,255,0.2)",
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              (position/title)
            </span>
          </label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            style={{
              ...inputStyle,
              borderColor: errors.role
                ? "rgba(220,60,60,0.4)"
                : "rgba(255,255,255,0.08)",
            }}
          >
            <option value="">Select a job role</option>
            <option value="Graphic Designer">Graphic Designer</option>
            <option value="Senior Graphic Designer">
              Senior Graphic Designer
            </option>
            <option value="Video Editor">Video Editor</option>
            <option value="Copy Writer">Copy Writer</option>
            <option value="AI Creative Lead">AI Creative Lead</option>
            <option value="Corporate Creative Support Lead">
              Corporate Creative Support Lead
            </option>
            <option value="Project Manager">Project Manager</option>
            <option value="Developer">Developer</option>
          </select>
          {errors.role && <span style={errorStyle}>{errors.role}</span>}
        </div>

        {/* Is Doer */}
        <div
          style={{
            marginBottom: 24,
            padding: "14px 16px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="isDoer"
              checked={formData.isDoer}
              onChange={handleChange}
              style={{ width: 16, height: 16, accentColor: "#c9a96e" }}
            />
            <div>
              <span
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.65)",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                Is a Doer (Can be assigned tasks)
              </span>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.25)",
                  marginTop: 2,
                }}
              >
                Check this if the team member can be assigned tasks directly
              </p>
            </div>
          </label>
        </div>

        {/* Info Box */}
        <div
          style={{
            padding: "14px 16px",
            background: "rgba(102,126,234,0.07)",
            border: "1px solid rgba(102,126,234,0.15)",
            borderRadius: 10,
            marginBottom: 28,
          }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#a5b4fc",
              marginBottom: 8,
            }}
          >
            🔐 Automatic Credentials Generation
          </h3>
          <ul
            style={{
              paddingLeft: 16,
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
              lineHeight: 1.8,
              listStyle: "disc",
            }}
          >
            <li>User ID will be auto-generated based on email and role</li>
            <li>6-digit OTP will be created (used as login password)</li>
            <li>Email will be the username for login</li>
          </ul>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              padding: "14px 24px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              color: "rgba(255,255,255,0.3)",
              fontSize: 13,
              fontFamily: "DM Sans, sans-serif",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              flex: 1,
              padding: 14,
              background: "linear-gradient(135deg, #c9a96e, #a07840)",
              border: "none",
              borderRadius: 10,
              color: "#080810",
              fontSize: 13,
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              letterSpacing: "0.08em",
              cursor: "pointer",
            }}
          >
            Create User Account
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddNewUserForm;
