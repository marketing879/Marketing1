import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, Role } from "../contexts/UserContext";
import roswaltLogo from "../assets/ROSWALT-LOGO-GOLDEN-8K.png";

const Login: React.FC = () => {
  const { login, teamMembers } = useUser();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [logoError, setLogoError] = useState(false);

  const proverbs = [
    "Powered by Insight, Driven by Action",
    "Excellence is a journey, not a destination",
    "Transforming visions into reality",
    "Where ambition meets opportunity",
    "Building futures, one step at a time",
    "Innovate. Inspire. Impact.",
    "Your success is our mission",
    "Driven by passion, guided by purpose",
    "Together we achieve greatness",
    "Excellence starts with a single decision",
    "Empowering tomorrow's leaders today",
    "Success is the sum of small efforts",
    "Dream big, work hard, stay focused",
    "Creating possibilities, delivering results",
    "Your potential, our commitment",
  ];

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % proverbs.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [proverbs.length]);

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
      setStep("password");
      setPassword("");
    }, 800);
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const success = login(email, password);
      if (!success) {
        setError("Invalid password. Please try again.");
        setPassword("");
        setLoading(false);
        return;
      }
      navigate("/" + role);
    }, 600);
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
        body { background: #0a0a0a; }

        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
          padding: 20px;
        }

        .background-video {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          z-index: 1;
        }

        .video-overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.65);
          z-index: 2;
        }

        .card {
          position: relative;
          z-index: 10;
          background: linear-gradient(135deg, rgba(15,15,15,0.95) 0%, rgba(25,20,15,0.95) 100%);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(201,169,110,0.25);
          border-radius: 24px;
          padding: 70px 50px;
          width: 100%;
          max-width: 450px;
          min-height: 600px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px rgba(0,0,0,0.8), inset 0 1px 0 rgba(201,169,110,0.1);
        }

        .card-header {
          text-align: center;
          margin-bottom: 45px;
          flex-shrink: 0;
        }

        .logo-img {
          width: 110px;
          height: 110px;
          object-fit: contain;
          display: block;
          margin: 0 auto 25px;
          filter: drop-shadow(0 0 18px rgba(201,169,110,0.45)) drop-shadow(0 4px 12px rgba(201,169,110,0.2));
        }

        .logo-fallback {
          width: 110px;
          height: 110px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 25px;
          border: 2px solid rgba(201,169,110,0.4);
          border-radius: 50%;
          font-size: 36px;
          color: #c9a96e;
          filter: drop-shadow(0 0 18px rgba(201,169,110,0.45));
        }

        .card-header h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 42px;
          font-weight: 400;
          letter-spacing: 3px;
          color: #f5f0e8;
          margin: 0;
          line-height: 1.2;
        }

        .tagline {
          font-size: 11px;
          color: #c9a96e;
          margin-top: 14px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          font-weight: 500;
          min-height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeInOutTagline 4s ease-in-out infinite;
        }

        @keyframes fadeInOutTagline {
          0%   { opacity: 0; transform: translateY(-8px); }
          8%   { opacity: 1; transform: translateY(0); }
          92%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(8px); }
        }

        .progress-indicator {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin-bottom: 30px;
        }

        .progress-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: rgba(201,169,110,0.3);
          transition: all 0.3s ease;
        }

        .progress-dot.active {
          background: #c9a96e;
          width: 24px;
          border-radius: 4px;
        }

        .form-container { flex: 1; display: flex; flex-direction: column; }

        .form-group { margin-bottom: 25px; }

        .form-group label {
          display: block;
          color: #a89968;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 10px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .form-group input {
          width: 100%;
          padding: 14px 18px;
          background: rgba(30,25,20,0.8);
          border: 1px solid rgba(201,169,110,0.2);
          border-radius: 10px;
          color: #f5f0e8;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          transition: all 0.3s ease;
        }

        .form-group input::placeholder { color: rgba(201,169,110,0.35); }

        .form-group input:focus {
          outline: none;
          border-color: #c9a96e;
          background: rgba(30,25,20,1);
          box-shadow: 0 0 0 4px rgba(201,169,110,0.08);
        }

        .role-selector {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          margin-bottom: 25px;
        }

        .role-btn {
          padding: 14px 16px;
          background: linear-gradient(135deg, rgba(30,25,20,0.9) 0%, rgba(25,20,15,0.9) 100%);
          border: 1.5px solid rgba(201,169,110,0.2);
          border-radius: 12px;
          color: #a89968;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 1px;
          position: relative;
          overflow: hidden;
        }

        .role-btn::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(201,169,110,0.1), transparent);
          transition: left 0.5s ease;
        }

        .role-btn:hover:not(:disabled)::before { left: 100%; }

        .role-btn:hover:not(:disabled) {
          border-color: #c9a96e;
          background: linear-gradient(135deg, rgba(201,169,110,0.08) 0%, rgba(201,169,110,0.04) 100%);
          box-shadow: 0 8px 20px rgba(201,169,110,0.15);
          transform: translateY(-2px);
        }

        .role-btn.active {
          background: linear-gradient(135deg, #c9a96e 0%, #d4b896 100%);
          color: #0a0a0a;
          border-color: #c9a96e;
          box-shadow: 0 12px 32px rgba(201,169,110,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
          text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }

        .role-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .password-boxes {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }

        .password-input {
          padding: 14px 4px !important;
          background: rgba(30,25,20,0.8) !important;
          border: 1px solid rgba(201,169,110,0.2) !important;
          border-radius: 10px !important;
          color: #c9a96e !important;
          font-family: 'Cormorant Garamond', serif !important;
          font-size: 22px !important;
          font-weight: 600 !important;
          text-align: center !important;
          transition: all 0.3s ease !important;
          caret-color: #c9a96e;
        }

        .password-input:focus {
          outline: none !important;
          border-color: #c9a96e !important;
          background: rgba(30,25,20,1) !important;
          box-shadow: 0 0 0 3px rgba(201,169,110,0.12) !important;
          transform: translateY(-2px);
        }

        .error-message {
          background: rgba(255,107,107,0.1);
          border: 1px solid rgba(255,107,107,0.3);
          color: #ff8787;
          font-size: 12px;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          line-height: 1.4;
        }

        .info-message {
          background: rgba(201,169,110,0.1);
          border: 1px solid rgba(201,169,110,0.2);
          color: #c9a96e;
          font-size: 11px;
          padding: 14px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          line-height: 1.6;
          text-align: center;
        }

        .button-group {
          display: flex;
          gap: 12px;
          margin-top: auto;
          flex-shrink: 0;
        }

        .submit-btn {
          flex: 1;
          padding: 14px 24px;
          background: linear-gradient(135deg, #c9a96e 0%, #d4b896 100%);
          border: none;
          border-radius: 10px;
          color: #0a0a0a;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(201,169,110,0.35);
        }

        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .back-btn {
          flex: 1;
          padding: 14px 24px;
          background: transparent;
          border: 1.5px solid rgba(201,169,110,0.3);
          border-radius: 10px;
          color: #c9a96e;
          font-weight: 600;
          font-size: 12px;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .back-btn:hover:not(:disabled) {
          border-color: #c9a96e;
          background: rgba(201,169,110,0.08);
        }

        .back-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .card-footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid rgba(201,169,110,0.1);
          font-size: 10px;
          color: #6b6355;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }

        .loading {
          display: inline-block;
          width: 4px; height: 4px;
          background: #0a0a0a;
          border-radius: 50%;
          margin-left: 6px;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="login-root">

        {/* ── FIX 1: URL-encode the space in the video filename ── */}
        <video autoPlay muted loop playsInline className="background-video">
          <source src="/videos/roswalt%20logo%20animation.mp4" type="video/mp4" />
          {/* Fallback: rename the file to remove the space and use the line below instead */}
          {/* <source src="/videos/roswalt-logo-animation.mp4" type="video/mp4" /> */}
        </video>

        {/* DARK OVERLAY */}
        <div className="video-overlay" />

        {/* LOGIN CARD */}
        <div
          className="card"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(30px)",
            transition: "all 0.8s cubic-bezier(0.34,1.56,0.64,1)"
          }}
        >
          {/* HEADER */}
          <div className="card-header">

            {/* ── FIX 2: onError fallback if the imported logo fails to load ── */}
            {!logoError ? (
              <img
                src={roswaltLogo}
                alt="Roswalt Realty"
                className="logo-img"
                onError={() => setLogoError(true)}
              />
            ) : (
              // Fallback: golden "R" monogram shown if image is missing
              <div className="logo-fallback">R</div>
            )}

            <h2>SmartCue</h2>
            <p key={taglineIndex} className="tagline">
              {proverbs[taglineIndex]}
            </p>
          </div>

          {/* PROGRESS */}
          <div className="progress-indicator">
            <div className={"progress-dot" + (step === "email" ? " active" : "")} />
            <div className={"progress-dot" + (step === "password" ? " active" : "")} />
          </div>

          <div className="form-container">
            {step === "email" ? (
              <form onSubmit={handleGenerateOTP}>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>Access Level</label>
                  <div className="role-selector">
                    {roles.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        className={"role-btn" + (role === r.value ? " active" : "")}
                        onClick={() => setRole(r.value)}
                        disabled={loading}
                      >
                        <span style={{ fontSize: "16px", display: "block", marginBottom: "4px" }}>{r.icon}</span>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="info-message">
                  Enter your email and select your access level to continue.<br />
                  Use the OTP provided by your Superadmin.
                </div>

                <div className="button-group">
                  <button type="submit" className="submit-btn" disabled={loading || !email}>
                    REQUEST ACCESS CODE
                    {loading && <span className="loading" />}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyPassword}>
                <div className="form-group">
                  <label>Password (6 Digits)</label>
                  <div className="password-boxes">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <input
                        key={index}
                        type="text"
                        className="password-input"
                        value={password[index] || ""}
                        onChange={(e) => {
                          if (!/^\d*$/.test(e.target.value)) return;
                          const chars = password.split("");
                          chars[index] = e.target.value.slice(-1);
                          setPassword(chars.join(""));
                          if (e.target.value && index < 5)
                            document.getElementById("pwd-" + (index + 1))?.focus();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && !password[index] && index > 0)
                            document.getElementById("pwd-" + (index - 1))?.focus();
                        }}
                        id={"pwd-" + index}
                        maxLength={1}
                        inputMode="numeric"
                        disabled={loading}
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="button-group">
                  <button
                    type="button"
                    className="back-btn"
                    onClick={() => { setStep("email"); setPassword(""); setError(""); }}
                    disabled={loading}
                  >
                    ← Back
                  </button>
                  <button type="submit" className="submit-btn" disabled={loading || password.length !== 6}>
                    LOGIN
                    {loading && <span className="loading" />}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* FOOTER */}
          <div className="card-footer">
            SMARTCUE © 2026 · ROSWALT REALTY · SECURE ACCESS
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;