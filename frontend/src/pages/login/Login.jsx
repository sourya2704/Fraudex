import { Eye, EyeOff, ShieldCheck, Zap, TrendingUp, Lock } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Scene3D from "../../components/Scene3D";

// What the system actually runs (see docs/ML_MODEL_REPORT.md)
const STATS = [
  { value: "16",  label: "Fraud rules" },
  { value: "7",   label: "AI agents" },
  { value: "10K", label: "Training invoices" },
];

const FEATURES = [
  { icon: Zap,         text: "AI-powered risk scoring on every invoice" },
  { icon: TrendingUp,  text: "Duplicate & vendor mismatch detection" },
  { icon: Lock,        text: "Real-time fraud alerts for finance teams" },
];

export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();

  const [form, setForm]               = useState({ email: "", password: "" });
  const [remember, setRemember]       = useState(false);
  const [showPwd, setShowPwd]         = useState(false);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  function onChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!form.password)     { setError("Password is required."); return; }
    setLoading(true);
    try {
      await login(form.email.trim(), form.password, remember);
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiError(err, "Invalid credentials. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page relative flex min-h-screen overflow-hidden">
      {/* live 3D scanner spanning the page: invoices orbit through the beam, flagged ones flash */}
      <Scene3D variant="hero" className="absolute inset-0" />
      <div className="auth-vignette pointer-events-none absolute inset-0" />

      {/* ── LEFT  HERO ─────────────────────────────────────────────────── */}
      <div className="auth-hero relative z-10 hidden w-[54%] flex-col justify-between overflow-hidden p-12 lg:flex">

        {/* logo */}
        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#c4ef3a] text-[#11110c] shadow-[0_0_30px_rgba(196,239,58,0.45)]">
            <ShieldCheck size={20} strokeWidth={2.4} />
          </div>
          <span className="font-display text-xl font-extrabold tracking-tight">Frau<span className="text-[#c4ef3a]">Dex</span></span>
        </div>

        {/* center content */}
        <div className="relative max-w-md">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#c4ef3a]/30 bg-[#c4ef3a]/10 px-4 py-1.5 font-mono-num text-[11px] uppercase tracking-[0.18em] text-[#d3f55f] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c4ef3a]" style={{ animation: "pulse-ring 1.6s ease-out infinite" }} />
            Scanning invoices
          </div>
          <h1 className="text-6xl font-extrabold leading-[0.98] tracking-tight">
            Every invoice<br />
            <span className="gradient-text">under the lens.</span>
          </h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-[var(--auth-muted)]">
            Rules, a trained fraud model and AI agents read every line, then show you the evidence before you approve.
          </p>

          <ul className="mt-8 space-y-3.5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-[var(--auth-soft)]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#c4ef3a]/25 bg-[#c4ef3a]/10 text-[#c4ef3a]">
                  <Icon size={14} strokeWidth={2} />
                </span>
                {text}
              </li>
            ))}
          </ul>

          {/* stats */}
          <div className="mt-10 grid grid-cols-3 gap-3">
            {STATS.map(({ value, label }) => (
              <div key={label} data-tilt className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 backdrop-blur-md">
                <p className="font-display text-3xl font-extrabold text-[var(--auth-text)]">{value}</p>
                <p className="mt-0.5 font-mono-num text-[10px] uppercase tracking-[0.14em] text-[var(--auth-faint)]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative font-mono-num text-[11px] tracking-wider text-[var(--auth-faint)]">© 2026 FRAUDEX · EVIDENCE-FIRST DECISIONS</p>
      </div>

      {/* ── RIGHT  FORM ────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-8 lg:p-16">
        <div className="glass-card w-full max-w-[440px] p-8 sm:p-10" style={{ animation: "rise 0.8s cubic-bezier(0.2,0.8,0.2,1) backwards" }}>

          {/* mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#c4ef3a] text-[#11110c]">
              <ShieldCheck size={18} strokeWidth={2.4} />
            </div>
            <span className="text-lg font-bold text-slate-900">Fraudex</span>
          </div>

          <p className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-500">Welcome back</p>
          <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900">Sign in to FrauDex</h2>
          <p className="mt-2 text-sm text-slate-500">Enter your credentials to continue.</p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>

            {/* email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="email">
                Work email
              </label>
              <input
                id="email" name="email" type="email"
                placeholder="you@company.com" autoComplete="email"
                value={form.email} onChange={onChange}
                className="input-base"
              />
            </div>

            {/* password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700" htmlFor="password">Password</label>
                <button type="button" tabIndex={-1} onClick={() => navigate("/forgot-password")} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password" name="password"
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••" autoComplete="current-password"
                  value={form.password} onChange={onChange}
                  className="input-base pr-11"
                />
                <button type="button" tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* remember */}
            <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-slate-600">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
              Remember me for 30 days
            </label>

            {/* error */}
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                {error}
              </div>
            )}

            {/* submit */}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm mt-1">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Signing in…
                </span>
              ) : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link to="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700">Create one</Link>
          </p>

          {/* divider */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">Secure · Encrypted · Audited</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
