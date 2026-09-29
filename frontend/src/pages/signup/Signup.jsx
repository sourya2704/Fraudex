import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import apiClient from "../../api/client";

function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await apiClient.post("/users/", form);
      setSuccess("Account created. You can sign in now.");
      setForm({ name: "", email: "", password: "" });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to create your account. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f8f3] text-slate-900 md:flex-row">
      <section className="order-2 flex min-h-[360px] flex-1 flex-col justify-between bg-[#151a31] p-8 text-white md:order-1 md:min-h-screen md:w-3/5 md:p-12">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#c7f36b] text-lg text-[#151a31]">
            ✦
          </span>
          <strong className="text-lg">Fraudex</strong>
        </div>
        <div className="mx-auto w-full max-w-xl py-12 text-center md:py-0">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-[2rem] border border-[#c7f36b]/30 bg-[#c7f36b]/10 text-[#c7f36b]">
            <ShieldCheck size={48} strokeWidth={1.8} />
          </div>
          <h1 className="mt-8 max-w-lg text-3xl font-bold tracking-tight md:text-5xl">
            Build a safer payment workflow
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-400">
            Bring invoice extraction, fraud signals, and human review into one
            clear workspace.
          </p>
          <ul className="mx-auto mt-8 max-w-md space-y-4 text-left text-sm text-slate-300">
            <li>
              <span className="mr-3 text-[#c7f36b]">●</span> Upload and
              validate invoices in seconds
            </li>
            <li>
              <span className="mr-3 text-[#c7f36b]">●</span> Compare vendors
              with historical evidence
            </li>
            <li>
              <span className="mr-3 text-[#c7f36b]">●</span> Keep every
              decision ready for audit
            </li>
          </ul>
          <div className="mt-10 flex justify-center gap-3 text-center">
            <div className="rounded-xl border border-[#303754] bg-[#202641] px-5 py-3">
              <strong className="block text-lg">24/7</strong>
              <span className="text-xs text-slate-400">Monitoring</span>
            </div>
            <div className="rounded-xl border border-[#303754] bg-[#202641] px-5 py-3">
              <strong className="block text-lg">100%</strong>
              <span className="text-xs text-slate-400">Traceable</span>
            </div>
            <div className="rounded-xl border border-[#303754] bg-[#202641] px-5 py-3">
              <strong className="block text-lg">1</strong>
              <span className="text-xs text-slate-400">Workspace</span>
            </div>
          </div>
        </div>
        <p className="hidden text-xs text-slate-500 md:block">
          Evidence first. Decisions with confidence.
        </p>
      </section>

      <section className="order-1 flex flex-1 items-center justify-center p-8 md:order-2 md:w-2/5 md:p-12">
        <div className="w-full max-w-md">
          <div className="mb-14 flex items-center gap-3 md:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#c7f36b] text-lg text-[#151a31]">
              ✦
            </span>
            <strong className="text-lg">Fraudex</strong>
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-indigo-600">Get started</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            Create account.
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            Start your protected Fraudex workspace.
          </p>
          <form
            className="mt-10 space-y-5"
            onSubmit={handleSubmit}
          >
            <div>
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="signup-name"
              >
                Full name
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                id="signup-name"
                type="text"
                name="name"
                placeholder="Your full name"
                autoComplete="name"
                value={form.name}
                onChange={updateField}
              />
            </div>
            <div>
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="signup-email"
              >
                Work email
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                id="signup-email"
                type="email"
                name="email"
                placeholder="you@company.com"
                autoComplete="email"
                value={form.email}
                onChange={updateField}
              />
            </div>
            <div>
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="signup-password"
              >
                Password
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                id="signup-password"
                type="password"
                name="password"
                placeholder="Create a password"
                autoComplete="new-password"
                value={form.password}
                onChange={updateField}
              />
            </div>
            {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
            {success && <p className="text-sm text-emerald-600" role="status">{success}</p>}
            <button
              className="w-full rounded-xl bg-[#5967f2] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#5967f2]/20 hover:bg-[#4856df] disabled:cursor-wait disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link className="font-medium text-indigo-600" to="/login">
              Login
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Signup;