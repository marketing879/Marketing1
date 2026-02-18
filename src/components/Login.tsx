import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, Role } from "../contexts/UserContext";

const Login: React.FC = () => {
  const { login, teamMembers } = useUser();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [otp, setOtp] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGenerateOTP = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const foundUser = teamMembers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.role === role
    );
    if (!foundUser) {
      setError("No account found with this email and role combination.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("otp");
    }, 800);
  };

  const handleVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const success = login(email, otp);
      if (!success) {
        setError("Invalid OTP. Please check the code and try again.");
        setOtpDigits(["", "", "", "", "", ""]);
        setOtp("");
        setLoading(false);
        setTimeout(() => document.getElementById("otp-0")?.focus(), 50);
        return;
      }
      navigate(`/${role}`);
    }, 600);
  };

  const handleOtpDigit = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    setOtp(newDigits.join(""));
    if (value && index < 5)
      document.getElementById(`otp-${index + 1}`)?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const roles: { value: Role; label: string; icon: string }[] = [
    { value: "staff", label: "Staff", icon: "◈" },
    { value: "admin", label: "Admin", icon: "◆" },
    { value: "superadmin", label: "Super Admin", icon: "✦" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .login-root { min-height: 100vh; background: #0a0a0f; display: flex; align-items: center; justify-content: center; font-family: 'DM Sans', sans-serif; position: relative; overflow: hidden; }
        .bg-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.15; pointer-events: none; }
        .bg-orb-1 { width: 600px; height: 600px; background: radial-gradient(circle, #c9a96e, transparent); top: -200px; left: -200px; animation: drift1 12s ease-in-out infinite alternate; }
        .bg-orb-2 { width: 500px; height: 500px; background: radial-gradient(circle, #6e8fc9, transparent); bottom: -150px; right: -150px; animation: drift2 15s ease-in-out infinite alternate; }
        .bg-orb-3 { width: 300px; height: 300px; background: radial-gradient(circle, #c96e9a, transparent); top: 50%; left: 50%; transform: translate(-50%, -50%); animation: drift3 10s ease-in-out infinite alternate; }
        @keyframes drift1 { from { transform: translate(0,0); } to { transform: translate(60px,40px); } }
        @keyframes drift2 { from { transform: translate(0,0); } to { transform: translate(-40px,-60px); } }
        @keyframes drift3 { from { transform: translate(-50%,-50%) scale(1); } to { transform: translate(-50%,-50%) scale(1.3); } }
        .grid-overlay { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 60px 60px; pointer-events: none; }
        .card { position: relative; width: 460px; padding: 56px 48px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; backdrop-filter: blur(40px); box-shadow: 0 0 0 1px rgba(255,255,255,0.04) inset, 0 40px 80px rgba(0,0,0,0.6); transition: opacity 0.8s ease, transform 0.8s ease; }
        .logo-area { text-align: center; margin-bottom: 40px; }
        .logo-icon { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: linear-gradient(135deg, rgba(201,169,110,0.2), rgba(201,169,110,0.05)); border: 1px solid rgba(201,169,110,0.3); border-radius: 16px; margin-bottom: 20px; font-size: 24px; }
        .logo-title { font-family: 'Cormorant Garamond', serif; font-size: 36px; font-weight: 300; letter-spacing: 0.08em; color: #f0e6d3; line-height: 1; margin-bottom: 8px; }
        .logo-subtitle { font-size: 12px; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(201,169,110,0.6); font-weight: 300; }
        .step-indicator { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 32px; }
        .step-dot { width: 6px; height: 6px; border-radius: 50%; transition: all 0.3s ease; }
        .step-dot.active { background: #c9a96e; box-shadow: 0 0 8px rgba(201,169,110,0.5); width: 20px; border-radius: 3px; }
        .step-dot.inactive { background: rgba(255,255,255,0.1); }
        .error-box { padding: 12px 16px; background: rgba(220,60,60,0.08); border: 1px solid rgba(220,60,60,0.2); border-radius: 10px; color: #e87070; font-size: 13px; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
        .field-group { margin-bottom: 24px; }
        .field-label { display: block; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 10px; font-weight: 500; }
        .field-input { width: 100%; padding: 14px 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; color: #f0e6d3; font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; transition: all 0.3s ease; }
        .field-input::placeholder { color: rgba(255,255,255,0.18); }
        .field-input:focus { border-color: rgba(201,169,110,0.4); background: rgba(255,255,255,0.06); box-shadow: 0 0 0 3px rgba(201,169,110,0.08); }
        .role-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 10px; }
        .role-btn { padding: 14px 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; color: rgba(255,255,255,0.35); font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.25s ease; display: flex; flex-direction: column; align-items: center; gap: 6px; letter-spacing: 0.05em; }
        .role-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.12); }
        .role-btn.active { background: rgba(201,169,110,0.1); border-color: rgba(201,169,110,0.35); color: #c9a96e; box-shadow: 0 0 20px rgba(201,169,110,0.08); }
        .role-icon { font-size: 18px; line-height: 1; }
        .submit-btn { width: 100%; padding: 16px; background: linear-gradient(135deg, #c9a96e, #a07840); border: none; border-radius: 12px; color: #0a0a0f; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.3s ease; margin-top: 8px; }
        .submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(201,169,110,0.3); }
        .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .back-btn { width: 100%; padding: 14px; background: transparent; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; color: rgba(255,255,255,0.35); font-size: 12px; font-family: 'DM Sans', sans-serif; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.25s ease; margin-top: 10px; }
        .back-btn:hover { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.55); background: rgba(255,255,255,0.03); }
        .info-box { padding: 14px 16px; background: rgba(201,169,110,0.06); border: 1px solid rgba(201,169,110,0.15); border-radius: 10px; color: rgba(201,169,110,0.7); font-size: 12px; margin-top: 20px; text-align: center; line-height: 1.6; }
        .email-confirm { padding: 16px 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; margin-bottom: 28px; }
        .email-confirm-row { display: flex; align-items: center; gap: 10px; font-size: 13px; color: rgba(255,255,255,0.5); }
        .email-confirm-row + .email-confirm-row { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); }
        .email-confirm-val { color: #f0e6d3; }
        .otp-row { display: flex; gap: 10px; justify-content: center; }
        .otp-cell { width: 52px; height: 60px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; color: #c9a96e; font-size: 22px; font-family: 'Cormorant Garamond', serif; font-weight: 500; text-align: center; outline: none; transition: all 0.25s ease; caret-color: #c9a96e; }
        .otp-cell:focus { border-color: rgba(201,169,110,0.5); background: rgba(201,169,110,0.06); box-shadow: 0 0 0 3px rgba(201,169,110,0.08); transform: translateY(-2px); }
        .footer-text { text-align: center; margin-top: 36px; font-size: 11px; letter-spacing: 0.12em; color: rgba(255,255,255,0.12); text-transform: uppercase; }
        .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.2); border-top-color: #0a0a0f; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 8px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div className="login-root">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        <div className="grid-overlay" />
        <div
          className="card"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <div className="logo-area">
            <div className="logo-icon">📋</div>
            <div className="logo-title">TaskFlow</div>
            <div className="logo-subtitle">Workspace Management</div>
          </div>
          <div className="step-indicator">
            <div
              className={`step-dot ${step === "email" ? "active" : "inactive"}`}
            />
            <div
              className={`step-dot ${step === "otp" ? "active" : "inactive"}`}
            />
          </div>
          {error && (
            <div className="error-box">
              <span>⚠</span> {error}
            </div>
          )}
          {step === "email" ? (
            <form onSubmit={handleGenerateOTP}>
              <div className="field-group">
                <label className="field-label">Email Address</label>
                <input
                  className="field-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoFocus
                />
              </div>
              <div className="field-group">
                <label className="field-label">Access Level</label>
                <div className="role-grid">
                  {roles.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      className={`role-btn ${role === r.value ? "active" : ""}`}
                      onClick={() => setRole(r.value)}
                    >
                      <span className="role-icon">{r.icon}</span>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                className="submit-btn"
                disabled={loading || !email}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Checking...
                  </>
                ) : (
                  "Request Access Code"
                )}
              </button>
              <div className="info-box">
                Enter your email and select your access level to continue. Use
                the OTP provided by your Superadmin.
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP}>
              <div className="email-confirm">
                <div className="email-confirm-row">
                  <span>✉</span>
                  <span className="email-confirm-val">{email}</span>
                </div>
                <div className="email-confirm-row">
                  <span>◈</span>
                  <span
                    className="email-confirm-val"
                    style={{ textTransform: "capitalize" }}
                  >
                    {role}
                  </span>
                </div>
              </div>
              <div className="field-group">
                <label
                  className="field-label"
                  style={{
                    textAlign: "center",
                    display: "block",
                    marginBottom: "16px",
                  }}
                >
                  Enter Verification Code
                </label>
                <div className="otp-row">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      className="otp-cell"
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigit(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
              </div>
              <button
                type="submit"
                className="submit-btn"
                disabled={loading || otp.length !== 6}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Verifying
                  </>
                ) : (
                  "Verify & Enter"
                )}
              </button>
              <button
                type="button"
                className="back-btn"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setOtpDigits(["", "", "", "", "", ""]);
                  setError("");
                }}
              >
                ← Back
              </button>
            </form>
          )}
          <div className="footer-text">TaskFlow © 2024 · Secure Access</div>
        </div>
      </div>
    </>
  );
};

export default Login;
