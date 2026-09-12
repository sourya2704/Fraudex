import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

function Login() {
  return (
    <main className="flex min-h-screen flex-col bg-white text-slate-900 md:flex-row">
      <section className="order-2 flex min-h-[360px] flex-1 flex-col justify-between bg-slate-950 p-8 text-white md:order-1 md:min-h-screen md:w-3/5 md:p-12">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-500 text-lg">
            ✦
          </span>
          <strong className="text-lg">Fraudex</strong>
        </div>
        <div className="mx-auto w-full max-w-xl py-12 text-center md:py-0">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-indigo-400/30 bg-indigo-500/10 text-indigo-400">
            <ShieldCheck size={48} strokeWidth={1.8} />
          </div>
          <h1 className="mt-8 text-3xl font-bold md:text-4xl">
            Detect invoice fraud instantly
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-400">
            Fraudex uses intelligent checks to analyze invoices, identify
            anomalies, and flag suspicious activity before payment is processed.
          </p>
          <ul className="mx-auto mt-8 max-w-md space-y-4 text-left text-sm text-slate-300">
            <li>
              <span className="mr-3 text-indigo-400">●</span> AI-powered risk
              scoring on every invoice
            </li>
            <li>
              <span className="mr-3 text-indigo-400">●</span> Duplicate and
              vendor mismatch detection
            </li>
            <li>
              <span className="mr-3 text-indigo-400">●</span> Real-time fraud
              alerts for finance teams
            </li>
          </ul>
          <div className="mt-10 flex justify-center gap-3 text-center">
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-5 py-3">
              <strong className="block text-lg">$4.2M</strong>
              <span className="text-xs text-slate-400">Fraud detected</span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-5 py-3">
              <strong className="block text-lg">190K+</strong>
              <span className="text-xs text-slate-400">Invoices scanned</span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-5 py-3">
              <strong className="block text-lg">99.3%</strong>
              <span className="text-xs text-slate-400">Accuracy rate</span>
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
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-500 text-lg text-white">
              ✦
            </span>
            <strong className="text-lg">Fraudex</strong>
          </div>
          <p className="text-sm font-medium text-indigo-600">Welcome back</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">
            Welcome back.
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            Sign in to Fraudex to continue.
          </p>
          <form
            className="mt-10 space-y-5"
            onSubmit={(event) => event.preventDefault()}
          >
            <div>
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="login-email"
              >
                Work email
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                id="login-email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label
                  className="text-sm font-medium text-slate-700"
                  htmlFor="login-password"
                >
                  Password
                </label>
                <a className="text-xs text-indigo-600" href="#forgot">
                  Forgot password?
                </a>
              </div>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                id="login-password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                type="checkbox"
              />{" "}
              Remember me for 30 days
            </label>
            <button
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
              type="submit"
            >
              Login
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link className="font-medium text-indigo-600" to="/signup">
              Sign up
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Login;
