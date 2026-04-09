import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, KeyRound, Server, Activity } from "lucide-react";
import { useAuth } from "../App";
import { useEffect } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverStatus, setServerStatus] = useState("checking"); // 'checking', 'online', 'offline'

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(
          "https://glossary.sarawakskills.edu.my/gateway/attendance/health/check",
        );
        if (res.ok) setServerStatus("online");
        else setServerStatus("offline");
      } catch (err) {
        setServerStatus("offline");
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    console.log("[Login] Starting local login for:", email);
    try {
      await login({ email, password });
      console.log("[Login] Success! Navigating to /");
      navigate("/");
    } catch (err) {
      console.error("[Login] Error during login:", err.message);
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleOIDCLogin = () => {
    const backendUrl =
      import.meta.env.VITE_API_URL ||
      "https://glossary.sarawakskills.edu.my/gateway/attendance";
    window.location.href = `${backendUrl}/auth/oidc/login`;
  };

  return (
    <div
      className="flex-center"
      style={{ minHeight: "100vh", padding: "1rem" }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{ width: "100%", maxWidth: "420px", padding: "2.5rem" }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            className="flex-center"
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "var(--accent-glow)",
              margin: "0 auto 1.5rem",
              border: "1px solid var(--accent-primary)",
            }}
          >
            <LogIn size={32} color="var(--accent-primary)" />
          </div>
          <h2>Hello Lads!!</h2>
          <p className="subtitle">Sign in to the Attendance System</p>

          <div
            className="flex-center"
            style={{ gap: "0.5rem", marginTop: "0.75rem", fontSize: "0.8rem" }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background:
                  serverStatus === "online"
                    ? "#10b981"
                    : serverStatus === "offline"
                      ? "#ef4444"
                      : "#f59e0b",
                boxShadow: `0 0 8px ${serverStatus === "online" ? "#10b981" : serverStatus === "offline" ? "#ef4444" : "#f59e0b"}`,
              }}
            ></div>
            <span
              style={{
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: "600",
              }}
            >
              Server {serverStatus}
            </span>
          </div>
        </div>

        {error && (
          <div
            className="badge danger"
            style={{
              width: "100%",
              display: "block",
              textAlign: "center",
              marginBottom: "1.5rem",
              padding: "0.75rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLocalLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="admin@attendance.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.85rem",
              background: "var(--accent-primary)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              marginBottom: "1.5rem",
              boxShadow: "0 4px 14px 0 rgba(99, 102, 241, 0.39)",
            }}
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div
          style={{ display: "flex", alignItems: "center", margin: "1.5rem 0" }}
        >
          <div
            style={{
              flex: 1,
              height: "1px",
              background: "var(--border-glass)",
            }}
          ></div>
          <span
            style={{
              padding: "0 1rem",
              color: "var(--text-muted)",
              fontSize: "0.9rem",
            }}
          >
            OR
          </span>
          <div
            style={{
              flex: 1,
              height: "1px",
              background: "var(--border-glass)",
            }}
          ></div>
        </div>

        <button
          onClick={handleOIDCLogin}
          style={{
            width: "100%",
            padding: "0.85rem",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-glass)",
            borderRadius: "var(--radius-md)",
            fontSize: "1rem",
            fontWeight: "500",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            transition: "all var(--transition-fast)",
          }}
          onMouseOver={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
          }
          onMouseOut={(e) =>
            (e.currentTarget.style.background = "var(--bg-secondary)")
          }
        >
          <KeyRound size={20} />
          Sign in with Company Provider
        </button>

        <p
          style={{
            textAlign: "center",
            marginTop: "1.5rem",
            fontSize: "0.85rem",
            color: "var(--text-muted)",
          }}
        >
          Test Accounts: admin@, hr@, staff@ (password123)
        </p>
      </div>
    </div>
  );
}
