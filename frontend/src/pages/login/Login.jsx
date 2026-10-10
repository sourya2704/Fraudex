import { Eye, EyeOff, ShieldCheck, Zap, TrendingUp, Lock } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const STATS = [
  { value: "$4.2M", label: "Fraud prevented" },
  { value: "190K+", label: "Invoices scanned" },
  { value: "99.3%", label: "Accuracy rate" },
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
      setError(err.response?.data?.detail || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0d1117] text-white">

      {/* ── LEFT  HERO ─────────────────────────────────────────────────── */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden p-12 lg:flex">

        {/* background gradient blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[100px]" />
          {/* subtle grid */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        {/* logo */}
        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <ShieldCheck size={20} strokeWidth={2.2} />
          </div>
          <span className="text-lg font-bold tracking-tight">Fraudex</span>
        </div>

        {/* center content */}
        <div className="relative">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            AI-Powered Fraud Detection
          </div>
          <h1 className="text-5xl font-bold leading-[1.12] tracking-tight">
            Detect invoice<br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              fraud instantly
            </span>
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-slate-400">
            Intelligent validation, historical analysis, and AI reasoning — all in one workspace.
          </p>

          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400">
                  <Icon size={14} strokeWidth={2} />
                </span>
                {text}
              </li>
            ))}
          </ul>

          {/* stats */}
          <div className="mt-10 grid grid-cols-3 gap-3">
            {STATS.map(({ value, label }) => (
              <div key={label} className="rounded-xl border border-white/8 bg-white/5 px-4 py-3 backdrop-blur-sm">
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-slate-600">© 2026 Fraudex. Evidence-first decisions.</p>
      </div>

      {/* ── RIGHT  FORM ────────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-[#f8f9fc] p-8 lg:p-16">
        <div className="w-full max-w-[400px]">

          {/* mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
              <ShieldCheck size={18} strokeWidth={2.2} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">Fraudex</span>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-500">Welcome back</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Sign in to Fraudex</h2>
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
                <button type="button" tabIndex={-1} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
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
