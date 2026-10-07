import { Bell, Camera, Lock, Moon, Save, ShieldCheck, Sun, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import apiClient from "../../../api/client";
import { useAuth } from "../../../context/AuthContext";
import { useAvatar } from "../../../context/AvatarContext";
import Sidebar from "../../Sidebar/Sidebar";

const ROLE_META = {
  ADMIN:           { label: "Admin",           cls: "bg-rose-50 text-rose-600 border-rose-200",       dot: "bg-rose-500",   grad: "from-rose-500 to-pink-600"     },
  FINANCE_MANAGER: { label: "Finance Manager", cls: "bg-violet-50 text-violet-600 border-violet-200", dot: "bg-violet-500", grad: "from-violet-500 to-purple-600" },
  EMPLOYEE:        { label: "Employee",        cls: "bg-indigo-50 text-indigo-600 border-indigo-200", dot: "bg-indigo-500", grad: "from-indigo-500 to-violet-600" },
};

function Toggle({ on, onToggle, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 ${on ? "border-indigo-500 bg-indigo-500" : "border-slate-300 bg-slate-200"}`}
    >
      <span className={`inline-block h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
    </button>
  );
}

function PwdStrength({ pwd }) {
  if (!pwd) return null;
  let s = 0;
  if (pwd.length >= 6)            s++;
  if (pwd.length >= 10)           s++;
  if (/[A-Z]/.test(pwd))          s++;
  if (/[0-9]/.test(pwd))          s++;
  if (/[^A-Za-z0-9]/.test(pwd))   s++;
  const cfg = s <= 1 ? { label: "Too weak", bar: "bg-rose-500",    text: "text-rose-500"    }
            : s === 2 ? { label: "Weak",     bar: "bg-orange-400", text: "text-orange-400" }
            : s === 3 ? { label: "Fair",     bar: "bg-amber-400",  text: "text-amber-500"  }
            : s === 4 ? { label: "Good",     bar: "bg-blue-500",   text: "text-blue-500"   }
            :           { label: "Strong",   bar: "bg-emerald-500",text: "text-emerald-500"};
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= s ? cfg.bar : "bg-slate-200"}`} />
        ))}
      </div>
      <p className={`mt-1 text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</p>
    </div>
  );
}

export default function Settings() {
  const { user: authUser } = useAuth();
  const { avatar, setAvatar, clearAvatar } = useAvatar();

  const [profile, setProfile] = useState(null);
  const [dark,    setDark]    = useState(() => localStorage.getItem("fraudex-theme") === "dark");
  const [sms,     setSms]     = useState(true);

  const [pwd,       setPwd]       = useState({ current: "", next: "", confirm: "" });
  const [pwdMsg,    setPwdMsg]    = useState({ text: "", type: "" });
  const [pwdShow,   setPwdShow]   = useState({ current: false, next: false, confirm: false });
  const [pwdLoading,setPwdLoading]= useState(false);

  // avatar upload
  const fileInputRef   = useRef(null);
  const [avatarHover, setAvatarHover] = useState(false);

  useEffect(() => {
    apiClient.get("/auth/me").then(r => setProfile(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("fraudex-theme", dark ? "dark" : "light");
  }, [dark]);

  const name     = profile?.name  || authUser?.name  || "—";
  const email    = profile?.email || authUser?.email || "—";
  const role     = profile?.role  || authUser?.role  || "EMPLOYEE";
  const rm       = ROLE_META[role] || ROLE_META.EMPLOYEE;
  const initials = name !== "—" ? name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase() : "?";

  function onPwd(e) {
    setPwd(p => ({ ...p, [e.target.name]: e.target.value }));
    setPwdMsg({ text: "", type: "" });
  }
  function toggleShow(f) { setPwdShow(s => ({ ...s, [f]: !s[f] })); }

  // Compress image to ~80KB max and store as base64
  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 200; // 200×200px max
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        setAvatar(dataUrl);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    // reset so same file can be re-picked
    e.target.value = "";
  }

  function submitPwd(e) {
    e.preventDefault();
    if (!pwd.current)              { setPwdMsg({ text: "Current password is required.", type: "error" }); return; }
    if (pwd.next.length < 6)       { setPwdMsg({ text: "New password must be at least 6 characters.", type: "error" }); return; }
    if (pwd.next !== pwd.confirm)   { setPwdMsg({ text: "Passwords do not match.", type: "error" }); return; }
    setPwdLoading(true);
    setTimeout(() => {
      setPwdLoading(false);
      setPwdMsg({ text: "Password update endpoint coming soon.", type: "info" });
      setPwd({ current: "", next: "", confirm: "" });
    }, 800);
  }

  return (
    <main className="flex min-h-screen bg-[#f5f6fb]">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">

        {/* header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md sm:px-8">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Settings</h1>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700">
            <Bell size={15} />
          </button>
        </header>

        <div className="mx-auto max-w-2xl space-y-4 px-5 py-8 sm:px-8">

          {/* ── Profile card ─────────────────────────────────────── */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* cover */}
            <div className={`h-20 bg-gradient-to-br ${rm.grad} relative`}>
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "radial-gradient(circle,white 1px,transparent 1px)", backgroundSize: "16px 16px" }} />
            </div>

            {/* avatar + info */}
            <div className="flex items-end gap-4 px-6 pb-5">

              {/* clickable avatar */}
              <div
                className="relative -mt-8 shrink-0 cursor-pointer"
                onMouseEnter={() => setAvatarHover(true)}
                onMouseLeave={() => setAvatarHover(false)}
                onClick={() => fileInputRef.current?.click()}
                title="Change profile picture"
              >
                {/* avatar image or initials */}
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Profile"
                    className="h-16 w-16 rounded-2xl object-cover ring-4 ring-white shadow-lg"
                  />
                ) : (
                  <div className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${rm.grad} text-xl font-bold text-white shadow-lg ring-4 ring-white`}>
                    {initials}
                  </div>
                )}

                {/* overlay on hover */}
                <div className={`absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 transition-opacity duration-150 ${avatarHover ? "opacity-100" : "opacity-0"}`}>
                  <Camera size={18} className="text-white" />
                </div>
              </div>

              {/* hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />

              <div className="pb-1">
                <p className="text-base font-semibold text-slate-900">{name}</p>
                <p className="text-sm text-slate-400">{email}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    <Camera size={11} /> Change photo
                  </button>
                  {avatar && (
                    <>
                      <span className="text-slate-300">·</span>
                      <button
                        type="button"
                        onClick={clearAvatar}
                        className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-rose-500 transition"
                      >
                        <Trash2 size={11} /> Remove
                      </button>
                    </>
                  )}
                </div>
              </div>

              <span className={`mb-1 ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${rm.cls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${rm.dot}`} />
                {rm.label}
              </span>
            </div>
          </section>

          {/* ── Change Password ───────────────────────────────────── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-500">
                <Lock size={15} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Change Password</h2>
                <p className="text-xs text-slate-400">Keep your account secure</p>
              </div>
            </div>

            <form onSubmit={submitPwd} className="space-y-4 p-6">
              {/* current */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Current Password</label>
                <div className="relative">
                  <input
                    type={pwdShow.current ? "text" : "password"}
                    name="current"
                    autoComplete="current-password"
                    value={pwd.current}
                    onChange={onPwd}
                    placeholder="Enter current password"
                    className="input-base pr-14 text-sm"
                  />
                  <button type="button" tabIndex={-1} onClick={() => toggleShow("current")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-100">
                    {pwdShow.current ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* new + confirm */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">New Password</label>
                  <div className="relative">
                    <input
                      type={pwdShow.next ? "text" : "password"}
                      name="next"
                      autoComplete="new-password"
                      value={pwd.next}
                      onChange={onPwd}
                      placeholder="Min. 6 characters"
                      className="input-base pr-14 text-sm"
                    />
                    <button type="button" tabIndex={-1} onClick={() => toggleShow("next")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-100">
                      {pwdShow.next ? "Hide" : "Show"}
                    </button>
                  </div>
                  <PwdStrength pwd={pwd.next} />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={pwdShow.confirm ? "text" : "password"}
                      name="confirm"
                      autoComplete="new-password"
                      value={pwd.confirm}
                      onChange={onPwd}
                      placeholder="Re-enter password"
                      className={`input-base pr-14 text-sm ${pwd.confirm && pwd.next === pwd.confirm ? "border-emerald-400" : ""}`}
                    />
                    <button type="button" tabIndex={-1} onClick={() => toggleShow("confirm")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-100">
                      {pwdShow.confirm ? "Hide" : "Show"}
                    </button>
                  </div>
                  {pwd.confirm && pwd.next === pwd.confirm && (
                    <p className="mt-1 text-xs font-semibold text-emerald-600">✓ Passwords match</p>
                  )}
                </div>
              </div>

              {pwdMsg.text && (
                <div className={`rounded-xl border px-4 py-2.5 text-xs font-medium ${
                  pwdMsg.type === "error"   ? "border-rose-200 bg-rose-50 text-rose-600"
                : pwdMsg.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                :                             "border-amber-200 bg-amber-50 text-amber-700"
                }`}>
                  {pwdMsg.text}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button type="submit" disabled={pwdLoading}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40 disabled:opacity-50">
                  {pwdLoading ? (
                    <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Updating…</>
                  ) : <><Save size={14} /> Update Password</>}
                </button>
              </div>
            </form>
          </section>

          {/* ── Preferences ──────────────────────────────────────── */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Preferences</h2>
            </div>
            <div className="divide-y divide-slate-100 px-6">

              {/* dark mode */}
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  {dark ? <Moon size={16} className="text-slate-500" /> : <Sun size={16} className="text-slate-500" />}
                  <div>
                    <p className="text-sm font-medium text-slate-800">Dark Mode</p>
                    <p className="text-xs text-slate-400">Switch to a darker interface</p>
                  </div>
                </div>
                <Toggle on={dark} onToggle={() => setDark(d => !d)} label="Dark mode" />
              </div>

              {/* sms alerts */}
              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">SMS Fraud Alerts</p>
                  <p className="text-xs text-slate-400">Get notified for high-risk invoices</p>
                </div>
                <Toggle on={sms} onToggle={() => setSms(s => !s)} label="SMS alerts" />
              </div>

            </div>
          </section>

          {/* footer */}
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
            <ShieldCheck size={12} className="text-indigo-400" />
            Your data is encrypted and protected
          </div>

        </div>
      </div>
    </main>
  );
}
