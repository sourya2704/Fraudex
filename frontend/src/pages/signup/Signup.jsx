import { Eye, EyeOff, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiClient, { apiError } from "../../api/client";
import Scene3D from "../../components/Scene3D";
import { useAuth } from "../../context/AuthContext";

function getStrength(pwd) {
  if (!pwd) return { score: 0, label: "", color: "" };
  let s = 0;
  if (pwd.length >= 6)  s++;
  if (pwd.length >= 10) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  if (s <= 1) return { score: s, label: "Too weak",  color: "bg-rose-500"   };
  if (s === 2) return { score: s, label: "Weak",      color: "bg-orange-400" };
  if (s === 3) return { score: s, label: "Fair",      color: "bg-amber-400"  };
  if (s === 4) return { score: s, label: "Good",      color: "bg-blue-500"   };
  return               { score: s, label: "Strong",   color: "bg-emerald-500" };
}

function StrengthBar({ password }) {
  const { score, label, color } = getStrength(password);
  if (!password) return null;
  const labelColor = score <= 1 ? "text-rose-500" : score === 2 ? "text-orange-400" : score === 3 ? "text-amber-500" : score === 4 ? "text-blue-500" : "text-emerald-500";
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? color : "bg-slate-200"}`} />
        ))}
      </div>
      <p className={`mt-1 text-[11px] font-medium ${labelColor}`}>{label}</p>
    </div>
  );
}

function validate(form) {
  const e = {};
  if (!form.name.trim() || form.name.trim().length < 2) e.name = "Full name must be at least 2 characters.";
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Valid email required.";
  if (!form.password || form.password.length < 6) e.password = "Password must be at least 6 characters.";
  else if (getStrength(form.password).score <= 1)  e.password = "Password too weak — add numbers or symbols.";
  if (!form.confirm) e.confirm = "Please confirm your password.";
  else if (form.password !== form.confirm) e.confirm = "Passwords do not match.";
  return e;
}

const PERKS = [
  "Upload and validate invoices in seconds",
  "Compare vendors with historical evidence",
  "Keep every decision audit-ready",
  "Real-time fraud risk scoring",
];

export default function Signup() {
  const navigate  = useNavigate();
  const { login } = useAuth();

  const [form, setForm]       = useState({ name: "", email: "", password: "", confirm: "" });
  const [errs, setErrs]       = useState({});
  const [serverErr, setServerErr] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showCfm, setShowCfm] = useState(false);
  const [loading, setLoading] = useState(false);

  function onChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errs[name]) setErrs(ev => ({ ...ev, [name]: "" }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setServerErr("");
    const v = validate(form);
    if (Object.keys(v).length) { setErrs(v); return; }
    setErrs({});
    setLoading(true);
    try {
      await apiClient.post("/users/", { name: form.name.trim(), email: form.email.trim(), password: form.password, role: "EMPLOYEE" });
      await login(form.email.trim(), form.password, false);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setServerErr(apiError(err, "Could not create account. Try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#0b0b08] text-[#f1eee3]">
      {/* live 3D scanner spanning the page: invoices orbit through the beam, flagged ones flash */}
      <Scene3D variant="hero" className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_50%,transparent,rgba(11,11,8,0.7))]" />

      {/* ── LEFT HERO ──────────────────────────────────────────────────── */}
      <div className="relative z-10 hidden w-[52%] flex-col justify-between overflow-hidden p-12 lg:flex">

        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600">
            <ShieldCheck size={20} strokeWidth={2.2} />
          </div>
          <span className="text-lg font-bold tracking-tight">Fraudex</span>
        </div>

        <div className="relative">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            Join your team's workspace
          </div>
          <h1 className="text-5xl font-bold leading-[1.12] tracking-tight">
            Safer payment<br />
            <span className="text-violet-300">
              workflows start here
            </span>
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-slate-400">
            One workspace for extraction, fraud signals, and human review — all traceable.
          </p>

          <ul className="mt-8 space-y-3">
            {PERKS.map(p => (
              <li key={p} className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 size={15} className="shrink-0 text-violet-400" strokeWidth={2} />
                {p}
              </li>
            ))}
          </ul>

          <div className="mt-10 grid grid-cols-3 gap-3">
            {[["24/7","Monitoring"],["100%","Traceable"],["1","Workspace"]].map(([v,l]) => (
              <div key={l} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xl font-bold">{v}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-slate-600">© 2026 Fraudex. Evidence-first decisions.</p>
      </div>

      {/* ── RIGHT FORM ─────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-8 lg:p-16">
        <div className="glass-card w-full max-w-[440px] p-8 sm:p-10" style={{ animation: "rise 0.8s cubic-bezier(0.2,0.8,0.2,1) backwards" }}>

          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600">
              <ShieldCheck size={18} strokeWidth={2.2} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">Fraudex</span>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-500">Get started</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Create your account</h2>
          <p className="mt-2 text-sm text-slate-500">You'll be signed in automatically after registering.</p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>

            {/* name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="name">Full name</label>
              <input id="name" name="name" type="text" placeholder="Your full name" autoComplete="name"
                value={form.name} onChange={onChange}
                className={`input-base ${errs.name ? "border-rose-400 focus:border-rose-400" : ""}`} />
              {errs.name && <p className="mt-1 text-xs text-rose-600">{errs.name}</p>}
            </div>

            {/* email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="reg-email">Work email</label>
              <input id="reg-email" name="email" type="email" placeholder="you@company.com" autoComplete="email"
                value={form.email} onChange={onChange}
                className={`input-base ${errs.email ? "border-rose-400" : ""}`} />
              {errs.email && <p className="mt-1 text-xs text-rose-600">{errs.email}</p>}
            </div>

            {/* password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="reg-pwd">Password</label>
              <div className="relative">
                <input id="reg-pwd" name="password" type={showPwd ? "text" : "password"}
                  placeholder="Min. 6 characters" autoComplete="new-password"
                  value={form.password} onChange={onChange}
                  className={`input-base pr-11 ${errs.password ? "border-rose-400" : ""}`} />
                <button type="button" tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <StrengthBar password={form.password} />
              {errs.password && <p className="mt-1 text-xs text-rose-600">{errs.password}</p>}
            </div>

            {/* confirm */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="reg-cfm">Confirm password</label>
              <div className="relative">
                <input id="reg-cfm" name="confirm" type={showCfm ? "text" : "password"}
                  placeholder="Re-enter your password" autoComplete="new-password"
                  value={form.confirm} onChange={onChange}
                  className={`input-base pr-11 ${errs.confirm ? "border-rose-400" : form.confirm && form.password === form.confirm ? "border-emerald-400" : ""}`} />
                <button type="button" tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowCfm(v => !v)}>
                  {showCfm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.confirm && form.password === form.confirm && !errs.confirm && (
                <p className="mt-1 text-xs font-medium text-emerald-600">✓ Passwords match</p>
              )}
              {errs.confirm && <p className="mt-1 text-xs text-rose-600">{errs.confirm}</p>}
            </div>

            {serverErr && (
              <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                {serverErr}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm mt-1">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Creating account…
                </span>
              ) : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">Sign in</Link>
          </p>

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
