import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../supabaseClient";
import "../styles/login.css";

type LoginPageProps = {
  onLogin: () => void;
};

function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("ssr_admin_email");

    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError("Email aur password dono enter karo.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) {
        throw loginError;
      }

      if (!data.session || !data.user) {
        throw new Error("Login session create nahi hua.");
      }

      if (rememberMe) {
        localStorage.setItem("ssr_admin_email", cleanEmail);
      } else {
        localStorage.removeItem("ssr_admin_email");
      }

      onLogin();
    } catch (loginError) {
      const message =
        loginError instanceof Error
          ? loginError.message
          : "Login nahi ho paya.";

      if (message.toLowerCase().includes("invalid login credentials")) {
        setError("Email ya password galat hai.");
      } else if (message.toLowerCase().includes("email not confirmed")) {
        setError("Pehle email confirm karo.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Password reset ke liye email address enter karo.");
      return;
    }

    try {
      setResetLoading(true);
      setError("");
      setSuccessMessage("");

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });

      if (resetError) {
        throw resetError;
      }

      setSuccessMessage(
        "Password reset email bhej diya gaya hai. Inbox check karo."
      );
    } catch (resetError) {
      const message =
        resetError instanceof Error
          ? resetError.message
          : "Password reset email nahi bheja ja saka.";

      setError(message);
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className="premium-login-page">
      <section className="login-brand-panel">
        <div className="brand-overlay" />

        <div className="brand-content">
          <div className="large-login-logo">
            <span className="logo-scale">⚖</span>
            <strong>SSR</strong>
            <span className="logo-arrow">↗</span>
          </div>

          <h1>
            SHIV <span>SAKTI</span>
          </h1>

          <h2>RECOVERY CRM</h2>

          <p>
            Recovery cases, executives, payments aur field operations ka
            complete management system.
          </p>

          <div className="login-features">
            <article>
              <div>🏦</div>
              <strong>Bank Import</strong>
              <span>Case Management</span>
            </article>

            <article>
              <div>👨‍💼</div>
              <strong>Executives</strong>
              <span>Field Management</span>
            </article>

            <article>
              <div>📍</div>
              <strong>GPS Tracking</strong>
              <span>Live Location</span>
            </article>

            <article>
              <div>📊</div>
              <strong>Reports</strong>
              <span>Smart Analytics</span>
            </article>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="premium-login-card">
          <div className="small-login-logo">
            <span>⚖</span>
            <strong>SSR</strong>
          </div>

          <h1>Admin Login</h1>
          <p className="login-subtitle">Shiv Sakti Recovery CRM V2</p>

          <form className="premium-login-form" onSubmit={handleSubmit}>
            <label htmlFor="admin-email">Email Address</label>

            <div className="login-input-box">
              <span className="input-icon">👤</span>

              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@shivsakti.com"
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>

            <label htmlFor="admin-password">Password</label>

            <div className="login-input-box">
              <span className="input-icon">🔒</span>

              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
                disabled={loading}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>

            <div className="login-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  disabled={loading}
                />
                <span>Remember Me</span>
              </label>

              <button
                type="button"
                className="forgot-password"
                onClick={handleForgotPassword}
                disabled={loading || resetLoading}
              >
                {resetLoading ? "Sending..." : "Forgot Password?"}
              </button>
            </div>

            {error && <div className="login-error-message">{error}</div>}

            {successMessage && (
              <div className="login-success-message">{successMessage}</div>
            )}

            <button
              type="submit"
              className="premium-login-button"
              disabled={loading}
            >
              <span>{loading ? "Logging in..." : "Login to Dashboard"}</span>
              <strong>{loading ? "⌛" : "→"}</strong>
            </button>
          </form>

          <div className="login-footer">
            <strong>Shiv Sakti</strong> Recovery CRM V2
            <span>
              Powered by <b>Akky OS</b>
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;