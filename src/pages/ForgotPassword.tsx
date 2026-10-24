import React, { useState, useId, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { useToast } from "../components/ToastContext";
import { validatePassword, scorePassword } from "../utils/passwordPolicy";

// ---------------------------------------------------------------------------
// Password strength helpers (shared with NewPasswordState)
// ---------------------------------------------------------------------------

function computeStrength(password: string): number {
  if (!password) return 0;
  return Math.max(1, Math.ceil((scorePassword(password) / 5) * 4));
}

const STRENGTH_COPY: Record<number, string> = {
  0: "Enter a password to see its strength",
  1: "Password requirements not met",
  2: "Some password requirements met",
  3: "Most password requirements met",
  4: "Strong enough for a production workspace",
};

// ---------------------------------------------------------------------------
// Expired-link state — #258
// ---------------------------------------------------------------------------

function ExpiredLinkState() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleSendNew = () => {
    navigate("/forgot-password");
    addToast("Enter your email below to receive a fresh reset link.", "info");
  };

  const handleContactSupport = () => {
    addToast("Opening support contact channels in a new window.", "info");
  };

  const highlights = [
    "Expired links take you back to the request step in one tap",
    "Messages stay readable in high-contrast mode",
    "Help is always one click away",
  ];

  return (
    <AuthShell
      eyebrow="Recovery"
      title="Link expired"
      description="Password reset links are valid for 15 minutes. This one has expired — request a fresh link below."
      footerPrompt="Remembered your credentials?"
      footerLinkLabel="Return to sign in"
      footerLinkHref="/login"
      sideTitle="Quick recovery, no dead ends"
      sideDescription="Request a reset link and set a new password in a few steps."
      sideHighlights={highlights}
    >
      {/* Error hero */}
      <div className="auth-expired-hero" aria-hidden="true">
        <svg
          className="auth-expired-icon"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke="var(--warning)"
            strokeWidth="2.5"
            strokeDasharray="6 4"
          />
          <circle
            cx="32"
            cy="32"
            r="20"
            stroke="var(--warning)"
            strokeWidth="1.5"
            opacity="0.4"
          />
          {/* Clock face */}
          <circle
            cx="32"
            cy="32"
            r="13"
            fill="var(--warning-soft)"
            stroke="var(--warning)"
            strokeWidth="1.5"
          />
          {/* Hour hand */}
          <line
            x1="32"
            y1="32"
            x2="32"
            y2="22"
            stroke="var(--warning)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Minute hand — past 12, angled */}
          <line
            x1="32"
            y1="32"
            x2="39"
            y2="37"
            stroke="var(--warning)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Centre dot */}
          <circle cx="32" cy="32" r="2" fill="var(--warning)" />
          {/* X mark overlay */}
          <line
            x1="44"
            y1="44"
            x2="52"
            y2="52"
            stroke="var(--danger)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="52"
            y1="44"
            x2="44"
            y2="52"
            stroke="var(--danger)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Alert message */}
      <div
        className="auth-message auth-message-warning"
        role="alert"
        aria-live="assertive"
      >
        <span aria-hidden="true" className="auth-message-icon">
          ⚠
        </span>
        This reset link has expired. Reset links are single-use and valid for 15
        minutes. Request a new one using the button below.
      </div>

      <div className="auth-actions">
        <button
          type="button"
          className="auth-button auth-button-primary"
          onClick={handleSendNew}
        >
          Send a new link
        </button>
        <button
          type="button"
          className="auth-button auth-button-ghost"
          onClick={handleContactSupport}
        >
          Contact support
        </button>
      </div>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------
// New-password entry state — #259
// ---------------------------------------------------------------------------

function NewPasswordState({ token }: { token: string | null }) {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const newPasswordId = useId();
  const confirmPasswordId = useId();
  const strengthId = useId();
  const matchId = useId();
  const passwordPolicyId = useId();

  const strength = computeStrength(newPassword);
  const passwordPolicy = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword;
  const showMatchError =
    confirmTouched && confirmPassword.length > 0 && !passwordsMatch;
  const showMatchSuccess =
    confirmTouched && confirmPassword.length > 0 && passwordsMatch;

  const highlights = [
    "A live strength meter gives feedback as you type",
    "Show or hide your password to avoid typos",
    "We confirm both fields match before you submit",
  ];

  // Missing or blank token — show incomplete-link error
  if (!token || !token.trim()) {
    const handleRequestNew = () => navigate("/forgot-password");
    return (
      <AuthShell
        eyebrow="Recovery"
        title="Incomplete link"
        description="The reset link is missing required information. Request a new one to continue."
        footerPrompt="Remembered your credentials?"
        footerLinkLabel="Return to sign in"
        footerLinkHref="/login"
        sideTitle="A safer recovery flow"
        sideDescription="All reset links are cryptographically signed and expire automatically for your account security."
        sideHighlights={highlights}
      >
        <div
          className="auth-message auth-message-warning"
          role="alert"
          aria-live="assertive"
        >
          <span aria-hidden="true" className="auth-message-icon">
            ⚠
          </span>
          This reset link appears to be incomplete or corrupted. Please request
          a fresh link to set your new password.
        </div>
        <div className="auth-actions">
          <button
            type="button"
            className="auth-button auth-button-primary"
            onClick={handleRequestNew}
          >
            Request a new link
          </button>
        </div>
      </AuthShell>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmTouched(true);

    if (!passwordPolicy.valid) {
      addToast(
        "Your password does not meet the requirements shown below.",
        "error",
      );
      return;
    }
    if (!passwordsMatch) {
      addToast("Passwords do not match. Please check both fields.", "error");
      return;
    }

    addToast("Your password has been updated. You can now sign in.", "success");
    navigate("/login");
  };

  return (
    <AuthShell
      eyebrow="Recovery"
      title="Set new password"
      description="Choose a strong password for your Veritasor workspace. It must be at least 8 characters."
      footerPrompt="Remembered your credentials?"
      footerLinkLabel="Return to sign in"
      footerLinkHref="/login"
      sideTitle="A safer recovery flow"
      sideDescription="Choose a strong new password to finish recovering your account."
      sideHighlights={highlights}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {/* New password */}
        <div className="auth-input-group">
          <label className="auth-label" htmlFor={newPasswordId}>
            New password
          </label>
          <div className="auth-input-toggle-group">
            <input
              id={newPasswordId}
              className="auth-input"
              type={showNew ? "text" : "password"}
              placeholder="Create a strong password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              aria-describedby={`${strengthId} ${passwordPolicyId}`}
            />
            <button
              type="button"
              className="auth-toggle-btn"
              aria-pressed={showNew}
              aria-label={showNew ? "Hide new password" : "Show new password"}
              onClick={() => setShowNew((v) => !v)}
            >
              {showNew ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Strength meter — shared with Signup */}
        <div
          className="auth-strength"
          id={strengthId}
          aria-label="Password strength"
          aria-live="polite"
          aria-atomic="true"
        >
          {[1, 2, 3, 4].map((bar) => (
            <span
              key={bar}
              className={
                "auth-strength-bar" +
                (strength >= bar ? " auth-strength-bar-active" : "")
              }
            />
          ))}
          <p className="auth-strength-copy">{STRENGTH_COPY[strength]}</p>
        </div>

        <ul
          id={passwordPolicyId}
          className="auth-message auth-message-help"
          aria-label="Password requirements"
        >
          {passwordPolicy.failures.length > 0 ? (
            passwordPolicy.failures.map((failure) => (
              <li key={failure}>{failure}</li>
            ))
          ) : (
            <li>Password meets all requirements.</li>
          )}
        </ul>

        {/* Confirm password */}
        <div className="auth-input-group">
          <label className="auth-label" htmlFor={confirmPasswordId}>
            Confirm password
          </label>
          <div className="auth-input-toggle-group">
            <input
              id={confirmPasswordId}
              className={
                "auth-input" + (showMatchError ? " auth-input-error" : "")
              }
              type={showConfirm ? "text" : "password"}
              placeholder="Repeat your new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setConfirmTouched(true);
              }}
              aria-describedby={matchId}
              aria-invalid={showMatchError ? "true" : undefined}
            />
            <button
              type="button"
              className="auth-toggle-btn"
              aria-pressed={showConfirm}
              aria-label={
                showConfirm ? "Hide confirm password" : "Show confirm password"
              }
              onClick={() => setShowConfirm((v) => !v)}
            >
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>

          {showMatchError && (
            <p
              id={matchId}
              className="auth-message auth-message-error"
              role="alert"
            >
              <span aria-hidden="true" className="auth-message-icon">
                !
              </span>
              Passwords do not match.
            </p>
          )}
          {showMatchSuccess && (
            <p
              id={matchId}
              className="auth-message auth-message-success"
              role="status"
            >
              <span aria-hidden="true" className="auth-message-icon">
                ✓
              </span>
              Passwords match.
            </p>
          )}
          {!showMatchError && !showMatchSuccess && (
            <span id={matchId} className="sr-only">
              Confirm your new password to continue.
            </span>
          )}
        </div>

        <div className="auth-actions">
          <button type="submit" className="auth-button auth-button-primary">
            Set new password
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------
// Request-email state (original form)
// ---------------------------------------------------------------------------

const requestHighlights = [
  "One clear next step at every stage of recovery",
  "Reset links are signed and expire automatically",
  "Works comfortably on phones and tablets",
];

// ---------------------------------------------------------------------------
// Requested-email state — #257 (success with resend timer / quiet unknown)
// ---------------------------------------------------------------------------

const requestedHighlights = [
  "Success copy never confirms or denies whether an email is registered",
  "A resend timer and quiet, accessible error state prevent account enumeration",
  "Support and spam-folders guidance give users a next action without anxiety",
];

function RequestedState({
  email,
  onResend,
  onRequestAgain,
}: {
  email: string;
  onResend: (email: string) => void;
  onRequestAgain: () => void;
}) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [resendCountdown, setResendCountdown] = useState(60);
  const [lastSentAt, setLastSentAt] = useState<Date>(new Date());

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const id = window.setInterval(
      () => setResendCountdown((n) => Math.max(0, n - 1)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [resendCountdown]);

  const handleResend = () => {
    onResend(email);
    setLastSentAt(new Date());
    setResendCountdown(60);
    addToast(
      "If the address is registered, a fresh reset link has been sent.",
      "info",
    );
  };

  const handleContactSupport = () => {
    addToast("Opening support contact channels in a new window.", "info");
  };

  const handleOpenSpamFolder = () => {
    addToast(
      'Tip: search your inbox for "Veritasor" across All mail and Spam.',
      "info",
    );
  };

  const countdownMin = Math.floor(resendCountdown / 60);
  const countdownSec = resendCountdown % 60;
  const countdownFormatted = `${countdownMin}:${String(countdownSec).padStart(
    2,
    "0",
  )}`;

  const sentAtFormatted = lastSentAt.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <AuthShell
      eyebrow="Recovery"
      title="Check your email"
      description="We have sent password reset instructions to the email you entered."
      footerPrompt="Remembered your credentials?"
      footerLinkLabel="Return to sign in"
      footerLinkHref="/login"
      sideTitle="A safer recovery flow"
      sideDescription="The confirmation screen intentionally gives identical guidance for registered and unregistered addresses so that attackers cannot enumerate accounts."
      sideHighlights={requestedHighlights}
    >
      {/* Success hero icon */}
      <div
        className="auth-requested-hero"
        aria-hidden="true"
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "0.5rem",
        }}
      >
        <div
          role="img"
          aria-label="Email sent illustration"
          style={{
            width: "5.5rem",
            height: "5.5rem",
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, rgba(94, 234, 212, 0.14), rgba(96, 165, 250, 0.12))",
            border: "1px solid rgba(94, 234, 212, 0.35)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2.5rem",
          }}
        >
          📬
        </div>
      </div>

      {/* Success status message — never confirm existence */}
      <div
        className="auth-message auth-message-success"
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true" className="auth-message-icon">
          ✓
        </span>
        If <strong>{email}</strong> is registered with a Veritasor workspace,
        you will receive an email shortly at <strong>{sentAtFormatted}</strong>.
        Follow the link in that message to set a new password.
      </div>

      {/* Next-step guidance */}
      <section
        aria-labelledby="recovery-next-heading"
        style={{
          display: "grid",
          gap: "0.75rem",
          padding: "0.875rem 0",
        }}
      >
        <h2 id="recovery-next-heading" className="sr-only">
          Next steps
        </h2>
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "0.5rem",
          }}
        >
          {[
            {
              t: "Check your Spam or Junk folder",
              d: 'Automated messages can be filtered by your email provider. Search All mail for "Veritasor".',
              action: handleOpenSpamFolder,
            },
            {
              t: "Add no-reply@veritasor.com to your contacts",
              d: "This will prevent future sign-in and recovery emails from being filtered.",
              action: null,
            },
            {
              t: "Wait a few minutes before retrying",
              d: "Large providers can take a moment to deliver automated mail. We show a countdown below.",
              action: null,
            },
          ].map((item, idx) => (
            <li
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "0.75rem",
                alignItems: "flex-start",
                padding: "0.75rem 0.875rem",
                borderRadius: "calc(var(--radius-sm) - 0.1rem)",
                border: "1px solid var(--border)",
                background: "var(--surface-soft)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "1.75rem",
                  height: "1.75rem",
                  borderRadius: 999,
                  background: "rgba(94, 234, 212, 0.12)",
                  color: "var(--accent)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "0.05rem",
                }}
              >
                {idx + 1}
              </span>
              <div style={{ display: "grid", gap: "0.2rem", minWidth: 0 }}>
                {item.action ? (
                  <button
                    type="button"
                    onClick={item.action}
                    className="auth-inline-link"
                    style={{
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontWeight: 700,
                      justifySelf: "start",
                      color: "var(--text)",
                      textAlign: "left",
                    }}
                  >
                    {item.t}
                  </button>
                ) : (
                  <div style={{ fontWeight: 700, color: "var(--text)" }}>
                    {item.t}
                  </div>
                )}
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.88rem",
                    lineHeight: 1.55,
                    color: "var(--muted)",
                  }}
                >
                  {item.d}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Resend timer */}
      <div
        role="region"
        aria-label="Resend link timer"
        style={{
          display: "grid",
          gap: "0.5rem",
          padding: "1rem",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: "var(--surface-strong)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontWeight: 700,
              fontSize: "1.2rem",
              fontVariantNumeric: "tabular-nums",
              color: resendCountdown > 0 ? "var(--muted)" : "var(--accent)",
            }}
            aria-live="polite"
          >
            {resendCountdown > 0
              ? `Resend available in ${countdownFormatted}`
              : "Ready to resend"}
          </div>
          <div
            role="progressbar"
            aria-label="Resend cooldown progress"
            aria-valuemin={0}
            aria-valuemax={60}
            aria-valuenow={60 - resendCountdown}
            style={{
              width: "min(10rem, 35vw)",
              height: "0.35rem",
              borderRadius: 999,
              background: "rgba(148, 163, 184, 0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${((60 - resendCountdown) / 60) * 100}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--accent), #60a5fa)",
                transition: "width 1s linear",
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCountdown > 0}
          className="auth-button auth-button-secondary"
          aria-label={
            resendCountdown > 0
              ? `Resend link (available in ${countdownFormatted})`
              : "Resend reset link"
          }
          style={{ minHeight: "3rem" }}
        >
          {resendCountdown > 0
            ? `Resend link (${countdownFormatted})`
            : "Resend link"}
        </button>
      </div>

      {/* Quiet error / "Didn't receive it?" alternatives */}
      <div className="auth-message auth-message-warning" role="note">
        <span aria-hidden="true" className="auth-message-icon">
          ⚠
        </span>
        If you used a different email address when joining the workspace, go
        back and try that address instead. Still no message after 10 minutes?
        Reach out to your workspace admin or contact support below.
      </div>

      <div className="auth-actions">
        <button
          type="button"
          className="auth-button auth-button-ghost"
          onClick={onRequestAgain}
        >
          ← Try a different email
        </button>
        <button
          type="button"
          className="auth-button auth-button-secondary"
          onClick={handleContactSupport}
        >
          Contact support
        </button>
      </div>
    </AuthShell>
  );
}

function RequestLinkState({
  onRequested,
}: {
  onRequested: (email: string) => void;
}) {
  const { addToast } = useToast();
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      addToast("Please enter a valid verified email address.", "error");
      return;
    }
    onRequested(email.trim());
  };

  const handleContactSupport = () => {
    addToast("Opening support contact channels in a new window.", "info");
  };

  return (
    <AuthShell
      eyebrow="Recovery"
      title="Reset your password"
      description="We will email a secure recovery link to your verified workspace address."
      footerPrompt="Remembered your credentials?"
      footerLinkLabel="Return to sign in"
      footerLinkHref="/login"
      sideTitle="A safer recovery flow"
      sideDescription="Request a reset link and set a new password in a few steps."
      sideHighlights={requestHighlights}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-input-group">
          <label className="auth-label" htmlFor="recovery-email">
            Verified email
          </label>
          <input
            id="recovery-email"
            className="auth-input"
            type="email"
            placeholder="security@veritasor.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby="recovery-email-help"
          />
          <p
            id="recovery-email-help"
            className="auth-message auth-message-help"
          >
            Recovery links expire after 15 minutes and invalidate any older
            reset requests.
          </p>
        </div>

        <div className="auth-message auth-message-success" role="status">
          <span aria-hidden="true" className="auth-message-icon">
            ✓
          </span>
          We will confirm on the next screen once the reset link is on its way.
        </div>

        <div className="auth-message auth-message-warning">
          <span aria-hidden="true" className="auth-message-icon">
            ⚠
          </span>
          If your workspace signs in through SSO, reset your password with your
          identity provider instead.
        </div>

        <div className="auth-actions">
          <button type="submit" className="auth-button auth-button-primary">
            Send reset link
          </button>
          <button
            type="button"
            className="auth-button auth-button-secondary"
            onClick={handleContactSupport}
          >
            Contact support
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------
// ForgotPassword — state router
// ---------------------------------------------------------------------------

type ForgotPasswordUiState =
  | { kind: "request" }
  | { kind: "requested"; email: string }
  | { kind: "expired" }
  | { kind: "reset"; token: string | null };

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const state = searchParams.get("state");
  const token = searchParams.get("token");

  const [ui, setUi] = useState<ForgotPasswordUiState>(() => {
    if (state === "expired") return { kind: "expired" };
    if (state === "reset") return { kind: "reset", token };
    return { kind: "request" };
  });

  // React to URL param changes
  useEffect(() => {
    if (state === "expired") setUi({ kind: "expired" });
    else if (state === "reset") setUi({ kind: "reset", token });
    // 'requested' state is only reached via internal state transitions
    // (not URL) to prevent enumeration by URL tampering.
  }, [state, token]);

  if (ui.kind === "requested") {
    return (
      <RequestedState
        email={ui.email}
        onResend={(e) => {
          setUi({ kind: "requested", email: e });
        }}
        onRequestAgain={() => setUi({ kind: "request" })}
      />
    );
  }

  if (ui.kind === "expired") {
    return <ExpiredLinkState />;
  }

  if (ui.kind === "reset") {
    return <NewPasswordState token={ui.token} />;
  }

  return (
    <RequestLinkState
      onRequested={(email) => setUi({ kind: "requested", email })}
    />
  );
}
