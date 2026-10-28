import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import apiClient, { apiError } from "../../../api/client";
import NotificationBell from "../../../components/NotificationBell";
import Sidebar from "../../Sidebar/Sidebar";

// Some records store the GSTIN with a "GSTIN" prefix; show the number itself.
const gstin = (t) => (t || "").replace(/^GSTIN/i, "");
const inr = (v) => (v == null ? "—" : `INR ${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);
const compact = (v) => (v >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${v}`);
const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const monthLabel = (m) => new Date(`${m}-01`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

const RISK_STYLE = {
  CRITICAL: "bg-rose-50 text-rose-600 border-rose-200",
  HIGH: "bg-orange-50 text-orange-600 border-orange-200",
  MEDIUM: "bg-amber-50 text-amber-600 border-amber-200",
  LOW: "bg-emerald-50 text-emerald-600 border-emerald-200",
};

// Chart ink: one series per chart, text stays in text tokens
const AMOUNT = "#9fc61c";
const RISK = "#cf8a58";
const AXIS = { fontSize: 10, fill: "#9b9a8b" };

function Tile({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1.5 text-xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function ChartTip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-700">{monthLabel(label)}</p>
      <p className="text-slate-500">{format(payload[0].value, payload[0].payload)}</p>
    </div>
  );
}

export default function VendorProfile() {
  const { vendorId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient.get(`/vendor-insights/${vendorId}`)
      .then(({ data }) => setData(data))
      .catch((e) => setError(apiError(e, "Failed to load vendor")));
  }, [vendorId]);

  const v = data?.vendor;
  const s = data?.stats;
  const levels = s?.risk_levels || {};
  const checked = Object.values(levels).reduce((a, b) => a + b, 0);

  return (
    <main className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/vendors" className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-indigo-600">
              <ChevronLeft size={15} /> Vendors
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="truncate text-sm font-bold text-slate-800">{v?.name || "Vendor"}</h1>
          </div>
          <NotificationBell />
        </header>

        <div className="mx-auto max-w-6xl space-y-5 px-5 py-6 sm:px-8">
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
          {!data && !error && <p className="text-sm text-slate-400">Loading…</p>}

          {data && (
            <>
              {/* identity */}
              <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Building2 size={22} /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-bold text-slate-900">{v.name}</h2>
                  <p className="font-mono-num text-xs text-slate-400">
                    GSTIN {gstin(v.tax_id) || "—"}{v.address ? ` · ${v.address}` : ""}{v.email ? ` · ${v.email}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  Invoices from {day(s.first_invoice_date)}<br />to {day(s.last_invoice_date)}
                </div>
              </section>

              {/* key numbers */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Tile label="Invoices" value={s.invoice_count} hint={`${inr(s.total_amount)} billed`} />
                <Tile label="Usual amount" value={inr(s.median_amount)} hint={`max ${inr(s.max_amount)}`} />
                <Tile label="Usual GST rate" value={s.usual_gst_rate != null ? `${s.usual_gst_rate}%` : "—"} hint="most common on its invoices" />
                <Tile label="Rejection rate"
                  value={s.rejection_rate != null ? `${(s.rejection_rate * 100).toFixed(0)}%` : "—"}
                  hint={`${s.approved} approved · ${s.rejected} rejected`} />
              </div>

              {/* monthly history: two charts, one axis each */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-no-tilt>
                <h3 className="text-sm font-semibold text-slate-900">Billed per month</h3>
                <p className="text-xs text-slate-400">Total invoice value by invoice month</p>
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                      <CartesianGrid vertical={false} stroke="rgba(120,118,106,0.15)" />
                      <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
                      <YAxis tickFormatter={compact} tick={AXIS} axisLine={false} tickLine={false} width={44} />
                      <Tooltip cursor={{ fill: "rgba(159,198,28,0.08)" }}
                        content={<ChartTip format={(val, row) => `${inr(val)} · ${row.invoices} invoice${row.invoices === 1 ? "" : "s"}`} />} />
                      <Bar dataKey="amount" fill={AMOUNT} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <h3 className="mt-6 text-sm font-semibold text-slate-900">Average fraud risk per month</h3>
                <p className="text-xs text-slate-400">Mean risk score (0–100) of that month's checked invoices</p>
                <div className="mt-4 h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="rgba(120,118,106,0.15)" />
                      <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
                      <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS} axisLine={false} tickLine={false} width={44} />
                      <Tooltip content={<ChartTip format={(val) => (val == null ? "Not checked" : `Average risk ${val}`)} />} />
                      <Line type="monotone" dataKey="average_risk" stroke={RISK} strokeWidth={2} dot={{ r: 3, fill: RISK, strokeWidth: 0 }}
                        activeDot={{ r: 5 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                {/* risk mix */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">Risk levels</h3>
                  <p className="text-xs text-slate-400">{checked} of {s.invoice_count} invoices fraud-checked</p>
                  <ul className="mt-4 space-y-2.5">
                    {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((lv) => (
                      <li key={lv} className="flex items-center gap-3 text-xs">
                        <span className={`w-20 rounded-full border px-2 py-0.5 text-center text-[10px] font-semibold ${RISK_STYLE[lv]}`}>{lv}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-slate-400" style={{ width: checked ? `${((levels[lv] || 0) / checked) * 100}%` : 0 }} />
                        </div>
                        <span className="w-8 text-right font-semibold text-slate-700">{levels[lv] || 0}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* most common flags */}
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">Most common fraud flags</h3>
                  <p className="text-xs text-slate-400">Across this vendor's checked invoices</p>
                  {data.top_flags.length ? (
                    <ul className="mt-4 space-y-2">
                      {data.top_flags.map((f) => (
                        <li key={f.code} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">{f.code.replaceAll("_", " ")}</span>
                          <span className="font-semibold text-slate-800">{f.count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-4 text-xs text-slate-400">No fraud flags raised.</p>}
                </section>
              </div>

              {/* recent invoices */}
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" data-no-tilt>
                <div className="border-b border-slate-100 px-6 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">Recent invoices</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <tr>{["Invoice No.", "Date", "Amount", "Risk", "Decision", ""].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.recent_invoices.map((i) => (
                        <tr key={i.id} className="hover:bg-indigo-50/30">
                          <td className="px-5 py-3 text-xs font-medium text-slate-700">{i.invoice_number || "—"}</td>
                          <td className="px-5 py-3 text-xs text-slate-500">{day(i.invoice_date)}</td>
                          <td className="px-5 py-3 text-xs font-semibold text-slate-800">{inr(i.total_amount)}</td>
                          <td className="px-5 py-3">
                            {i.risk_level
                              ? <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${RISK_STYLE[i.risk_level]}`}>{i.risk_level} · {Number(i.risk_score).toFixed(0)}</span>
                              : <span className="text-[11px] text-slate-300">Not checked</span>}
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">{i.decision ? i.decision.replaceAll("_", " ").toLowerCase() : "—"}</td>
                          <td className="px-5 py-3">
                            <Link to={`/dashboard/invoices/${i.id}`} className="flex items-center gap-1 text-xs font-semibold text-indigo-600">View <ChevronRight size={13} /></Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
