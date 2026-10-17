import { ArrowLeft, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiClient, { apiError } from "../../api/client";
import Scene3D from "../../components/Scene3D";

/* ── tiny spinner ─────────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  );
}

/* ── step indicator ───────────────────────────────────────────────────────── */
function Steps({ current }) {
  const steps = ["Enter email", "Enter OTP", "Done"];
  return (
    <div className="mb-8 flex items-center gap-0">
      {steps.map((label, i) => {
        const idx   = i + 1;
        const done  = idx < current;
        const active = idx === current;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition-colors ${
                done   ? "bg-indigo-600 text-white"
                : active ? "border-2 border-indigo-600 bg-indigo-50 text-indigo-600"
                :          "border-2 border-slate-200 bg-white text-slate-400"
              }`}>
                {done ? <ShieldCheck size={13}/> : idx}
              </div>
              <span className={`mt-1 text-[10px] font-medium whitespace-nowrap ${active ? "text-indigo-600" : done ? "text-slate-500" : "text-slate-400"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-1 mb-4 h-0.5 flex-1 rounded-full transition-colors ${done ? "bg-indigo-500" : "bg-slate-200"}`}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Left hero panel: defined at module level so the 3D scene isn't
      re-created on every keystroke ──────────────────────────────────── */
function Hero() {
  return (
  <div className="relative z-10 hidden w-[52%] flex-col justify-between overflow-hidden p-12 lg:flex">
    <div className="relative flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600">
        <ShieldCheck size={20} strokeWidth={2.2}/>
      </div>
      <span className="text-lg font-bold tracking-tight text-white">Fraudex</span>
    </div>
    <div className="relative">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"/>
        Secure Account Recovery
      </div>
      <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
        Recover your<br/>
        <span className="text-indigo-300">account safely</span>
      </h1>
      <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">
        Enter your registered email. We'll send a one-time code to verify your identity and let you set a new password.
      </p>
      <div className="mt-8 space-y-3">
        {[
          { Icon: Mail,     text: "Request a 6-digit OTP for your email"  },
          { Icon: KeyRound, text: "Enter the OTP to verify your identity"  },
          { Icon: ShieldCheck,text:"Set a new secure password"             },
        ].map(({ Icon, text }) => (
          <div key={text} className="flex items-center gap-3 text-sm text-slate-300">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400">
              <Icon size={14}/>
            </span>
            {text}
          </div>
        ))}
      </div>
    </div>
    <p className="relative text-xs text-slate-600">© 2026 Fraudex. Evidence-first decisions.</p>
  </div>
);
}

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step,     setStep]     = useState(1);
  const [email,    setEmail]    = useState("");
  const [otp,      setOtp]      = useState("");
  const [newPwd,   setNewPwd]   = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  /* ── Step 1: request OTP ──────────────────────────────────────────────── */
  async function submitEmail(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Please enter your email."); return; }
    setLoading(true);
    try {
      await apiClient.post("/auth/forgot-password", { email: email.trim() });
      setStep(2);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Step 2: verify OTP + set new password ────────────────────────────── */
  async function submitReset(e) {
    e.preventDefault();
    setError("");
    if (otp.length !== 6)          { setError("OTP must be 6 digits."); return; }
    if (newPwd.length < 6)         { setError("Password must be at least 6 characters."); return; }
    if (newPwd !== confirm)        { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await apiClient.post("/auth/reset-password", {
        email:        email.trim(),
        otp:          otp.trim(),
        new_password: newPwd,
      });
      setStep(3);
    } catch (err) {
      setError(apiError(err, "Invalid or expired OTP."));
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#0b0b08] text-[#f1eee3]">
      {/* live 3D scanner spanning the page: invoices orbit through the beam, flagged ones flash */}
      <Scene3D variant="hero" className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_50%,transparent,rgba(11,11,8,0.7))]" />
      <Hero/>

      {/* right panel */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-8 lg:p-16">
        <div className="glass-card w-full max-w-[440px] p-8 sm:p-10" style={{ animation: "rise 0.8s cubic-bezier(0.2,0.8,0.2,1) backwards" }}>

          {/* mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600">
              <ShieldCheck size={18} className="text-white"/>
            </div>
            <span className="text-lg font-bold text-slate-900">Fraudex</span>
          </div>

          <Steps current={step}/>

          {/* ── STEP 1: EMAIL ─────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-500">Account recovery</p>
              <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">Forgot your password?</h2>
              <p className="mt-1.5 text-sm text-slate-500">Enter your registered email and we'll send a reset code.</p>

              <form onSubmit={submitEmail} className="mt-7 space-y-4" noValidate>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    <input
                      type="email" autoComplete="email" autoFocus
                      value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="input-base pl-10"
                    />
                  </div>
                </div>

                {error && <Alert type="error" msg={error}/>}

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm">
                  {loading ? <><Spinner/> Sending OTP…</> : "Send Reset Code"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition">
                  <ArrowLeft size={14}/> Back to sign in
                </Link>
              </div>
            </>
          )}

          {/* ── STEP 2: OTP + NEW PASSWORD ────────────────────────────── */}
          {step === 2 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-500">Verify & reset</p>
              <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">Enter your OTP</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                We sent a 6-digit OTP to <span className="font-semibold text-slate-700">{email}</span>. Check your inbox (and spam folder).
              </p>

              {/* email sent info banner */}
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                <Mail size={16} className="shrink-0 text-indigo-500"/>
                <p className="text-sm text-indigo-700">OTP sent! Check your Gmail inbox.</p>
              </div>

              <form onSubmit={submitReset} className="mt-6 space-y-4" noValidate>
                {/* OTP */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">6-digit OTP</label>
                  <input
                    type="text" inputMode="numeric" maxLength={6} autoFocus
                    value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="• • • • • •"
                    className="input-base text-center text-xl tracking-[0.5em] font-bold"
                  />
                </div>

                {/* New password */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={newPwd} onChange={e => setNewPwd(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="input-base pr-11"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </div>

                {/* Confirm */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm password</label>
                  <div className="relative">
                    <input
                      type={showConf ? "text" : "password"}
                      value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="Re-enter password"
                      className={`input-base pr-11 ${confirm && newPwd === confirm ? "border-emerald-400" : ""}`}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowConf(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showConf ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                  {confirm && newPwd === confirm && (
                    <p className="mt-1 text-xs font-semibold text-emerald-600">✓ Passwords match</p>
                  )}
                </div>

                {error && <Alert type="error" msg={error}/>}

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm">
                  {loading ? <><Spinner/> Resetting…</> : "Reset Password"}
                </button>
              </form>

              <button type="button" onClick={() => { setStep(1); setOtp(""); setError(""); }}
                className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition">
                <ArrowLeft size={14}/> Use a different email
              </button>
            </>
          )}

          {/* ── STEP 3: SUCCESS ───────────────────────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm">
                <ShieldCheck size={32}/>
              </div>
              <h2 className="mt-5 text-2xl font-bold text-slate-900">Password updated!</h2>
              <p className="mt-2 text-sm text-slate-500">
                Your password has been reset successfully.<br/>You can now sign in with your new password.
              </p>
              <button type="button" onClick={() => navigate("/login")}
                className="btn-primary mt-7 px-8 py-3 text-sm">
                Go to sign in
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ── tiny alert ───────────────────────────────────────────────────────────── */
function Alert({ type, msg, className = "" }) {
  const s = type === "error"
    ? "border-rose-200 bg-rose-50 text-rose-600"
    : "border-indigo-200 bg-indigo-50 text-indigo-700";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${s} ${className}`}>{msg}</div>
  );
}
