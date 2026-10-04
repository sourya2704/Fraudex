import {
  Activity,
  Bell,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileUp,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../api/client";
import Sidebar from "../Sidebar/Sidebar";

// ── tiny helpers ──────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  DOCUMENTS_UPLOADED: "bg-blue-50 text-blue-600 border-blue-100",
  PROCESSING:         "bg-amber-50 text-amber-600 border-amber-100",
  ANALYSIS_READY:     "bg-indigo-50 text-indigo-600 border-indigo-100",
  UNDER_REVIEW:       "bg-violet-50 text-violet-600 border-violet-100",
  DECIDED:            "bg-green-50 text-green-600 border-green-100",
  PROCESSING_FAILED:  "bg-rose-50 text-rose-600 border-rose-100",
  DRAFT:              "bg-slate-50 text-slate-500 border-slate-200",
};
const STATUS_LABEL = {
  DOCUMENTS_UPLOADED: "Uploaded",
  PROCESSING: "Processing",
  ANALYSIS_READY: "Ready",
  UNDER_REVIEW: "Under Review",
  DECIDED: "Decided",
  PROCESSING_FAILED: "Failed",
  DRAFT: "Draft",
};
const RISK_BADGE = {
  CRITICAL: "bg-rose-50 text-rose-600 border-rose-100",
  HIGH:     "bg-orange-50 text-orange-600 border-orange-100",
  MEDIUM:   "bg-amber-50 text-amber-600 border-amber-100",
  LOW:      "bg-green-50 text-green-600 border-green-100",
};

function StatusBadge({ s }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[s] || STATUS_BADGE.DRAFT}`}>
      {STATUS_LABEL[s] || s}
    </span>
  );
}
function RiskBadge({ level }) {
  if (!level) return <span className="text-xs text-slate-300">—</span>;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${RISK_BADGE[level] || ""}`}>
      {level}
    </span>
  );
}
function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtAmt(v, cur) {
  if (v == null) return "—";
  return `${cur || ""} ${parseFloat(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`.trim();
}

// ── Risk sparkline (last 7 days) ──────────────────────────────────────────────
function RiskSparkline({ trends }) {
  if (!trends || trends.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
        No trend data yet — run fraud detection on invoices
      </div>
    );
  }

  const last7 = trends.slice(-7);
  const maxTotal = Math.max(...last7.map((d) => d.total), 1);

  return (
    <div className="flex h-40 items-end gap-1.5">
      {last7.map((day) => {
        const heightPct = (day.total / maxTotal) * 100;
        const hasCritical = day.CRITICAL > 0;
        const hasHigh = day.HIGH > 0;
        return (
          <div key={day.date} className="group relative flex flex-1 flex-col items-center gap-1">
            <div className="absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-[10px] text-white group-hover:block whitespace-nowrap">
              {day.date}: {day.total} event{day.total !== 1 ? "s" : ""}
            </div>
            <div
              className={`w-full rounded-t transition-all ${hasCritical ? "bg-rose-500" : hasHigh ? "bg-orange-400" : day.MEDIUM > 0 ? "bg-amber-400" : "bg-green-400"}`}
              style={{ height: `${Math.max(heightPct, 4)}%` }}
            />
            <span className="text-[9px] text-slate-400">
              {new Date(day.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [invoices, setInvoices]     = useState([]);
  const [fraudStats, setFraudStats] = useState(null);
  const [highRisk, setHighRisk]     = useState([]);
  const [trends, setTrends]         = useState([]);
  const [auditLog, setAuditLog]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadAll() {
    try {
      const [invRes, statsRes, riskRes, trendRes, auditRes] = await Promise.allSettled([
        apiClient.get("/invoices/"),
        apiClient.get("/fraud/statistics"),
        apiClient.get("/fraud/high-risk-invoices?min_risk_level=HIGH&limit=10"),
        apiClient.get("/fraud/fraud-trends?days=14"),
        apiClient.get("/audit/?limit=8"),
      ]);

      if (invRes.status === "fulfilled")   setInvoices(invRes.value.data);
      if (statsRes.status === "fulfilled") setFraudStats(statsRes.value.data);
      if (riskRes.status === "fulfilled")  setHighRisk(riskRes.value.data);
      if (trendRes.status === "fulfilled") setTrends(trendRes.value.data.trends || []);
      if (auditRes.status === "fulfilled") setAuditLog(auditRes.value.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadAll(); }, []);
  function refresh() { setRefreshing(true); loadAll(); }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const total        = invoices.length;
  const pending      = invoices.filter((i) => i.status === "ANALYSIS_READY" || i.status === "UNDER_REVIEW").length;
  const decided      = invoices.filter((i) => i.status === "DECIDED").length;
  const failed       = invoices.filter((i) => i.status === "PROCESSING_FAILED").length;
  const critHigh     = fraudStats ? fraudStats.critical_risk_count + fraudStats.high_risk_count : 0;
  const recentInvs   = [...invoices].slice(0, 6);

  const metricCards = [
    { label: "Total Invoices",   value: loading ? "…" : total,                  Icon: FileUp,     tone: "indigo" },
    { label: "Awaiting Review",  value: loading ? "…" : pending,                Icon: Clock3,     tone: "amber"  },
    { label: "High / Critical",  value: loading ? "…" : critHigh,               Icon: CircleAlert,tone: "rose"   },
    { label: "Decided",          value: loading ? "…" : decided,                Icon: ShieldCheck,tone: "green"  },
  ];

  const toneMap = {
    indigo: { wrap: "bg-indigo-50 text-indigo-600", num: "text-indigo-700" },
    amber:  { wrap: "bg-amber-50  text-amber-600",  num: "text-amber-700"  },
    rose:   { wrap: "bg-rose-50   text-rose-600",   num: "text-rose-700"   },
    green:  { wrap: "bg-green-50  text-green-600",  num: "text-green-700"  },
  };

  // Recent audit feed labels
  const actionLabel = {
    INVOICE_UPLOADED:       "Invoice uploaded",
    INVOICE_EXTRACTED:      "Text extracted",
    INVOICE_VALIDATED:      "Invoice validated",
    FRAUD_CHECK_RUN:        "Fraud check run",
    INVOICE_STATUS_CHANGED: "Status changed",
    REVIEW_DECISION:        "Review decision",
    USER_LOGIN:             "User logged in",
    USER_LOGOUT:            "User logged out",
    USER_REGISTERED:        "User registered",
  };

  return (
    <main className="flex min-h-screen bg-[#f4f5f0] text-slate-900">
      <Sidebar />
      <section className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Live overview of your invoice and fraud pipeline
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={refresh} title="Refresh"
              className={`grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 ${refreshing ? "animate-spin" : ""}`}
              type="button">
              <RefreshCw size={16} />
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800" type="button"><Search size={16} /></button>
            <button className="relative grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800" type="button">
              <Bell size={16} />
              {critHigh > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />}
            </button>
            <Link to="/dashboard/upload-invoice"
              className="flex items-center gap-2 rounded-xl bg-[#5967f2] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#5967f2]/20 hover:bg-[#4856df]">
              <FileUp size={15} /> Upload invoice
            </Link>
          </div>
        </header>

        {/* ── Metric cards ─────────────────────────────────────────────────── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(({ label, value, Icon, tone }) => (
            <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${toneMap[tone].wrap}`}>
                  <Icon size={17} strokeWidth={2} />
                </span>
              </div>
              <p className={`mt-4 text-3xl font-bold tracking-tight ${toneMap[tone].num}`}>{value}</p>
              {fraudStats && label === "High / Critical" && (
                <p className="mt-1 text-xs text-slate-400">avg risk score: {fraudStats.average_risk_score}</p>
              )}
              {label === "Total Invoices" && failed > 0 && (
                <p className="mt-1 text-xs text-rose-400">{failed} failed processing</p>
              )}
            </article>
          ))}
        </div>

        {/* ── Middle row: Trend + Open alerts ─────────────────────────────── */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">

          {/* Risk activity sparkline */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Risk activity</h2>
                <p className="mt-1 text-sm text-slate-500">Fraud detections over last 14 days</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <TrendingUp size={13} /> Live
              </span>
            </div>
            <div className="mt-6">
              <RiskSparkline trends={trends} />
            </div>
            {/* legend */}
            <div className="mt-3 flex gap-4 text-[11px] text-slate-400">
              {[["bg-rose-500","Critical"],["bg-orange-400","High"],["bg-amber-400","Medium"],["bg-green-400","Low"]].map(([c,l]) => (
                <span key={l} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${c}`}/>{l}</span>
              ))}
            </div>
          </section>

          {/* Open alerts */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Open alerts</h2>
                <p className="mt-1 text-sm text-slate-500">High / Critical risk invoices</p>
              </div>
              <Link to="/dashboard/fraud-detection" className="text-xs font-semibold text-indigo-500 hover:text-indigo-700">
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-2">
              {loading && <p className="text-xs text-slate-400">Loading…</p>}
              {!loading && highRisk.length === 0 && (
                <div className="flex min-h-40 flex-col items-center justify-center text-center">
                  <ShieldCheck size={28} className="text-slate-200" />
                  <p className="mt-2 text-sm font-semibold text-slate-500">No open alerts</p>
                  <p className="mt-1 text-xs text-slate-400">Run fraud detection to populate alerts</p>
                </div>
              )}
              {!loading && highRisk.slice(0, 5).map((inv) => (
                <Link key={inv.invoice_id} to={`/dashboard/invoices/${inv.invoice_id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 hover:border-indigo-200 hover:bg-indigo-50/30">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700">
                      {inv.vendor_name || "Unknown vendor"} — #{inv.invoice_id}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">Score: {inv.risk_score?.toFixed(1)}</p>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <RiskBadge level={inv.risk_level} />
                    <ChevronRight size={13} className="text-slate-300" />
                  </div>
                </Link>
              ))}
            </div>
            {!loading && highRisk.length > 0 && (
              <Link to="/dashboard/fraud-detection"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-xs font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600">
                <ShieldAlert size={13} /> Review alert queue
              </Link>
            )}
          </section>
        </div>

        {/* ── Recent invoices table ────────────────────────────────────────── */}
        <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-semibold text-slate-900">Recent invoices</h2>
              <p className="mt-0.5 text-sm text-slate-500">Latest activity across your workspace</p>
            </div>
            <Link to="/dashboard/invoices" className="text-xs font-semibold text-indigo-500 hover:text-indigo-700">
              View all
            </Link>
          </div>
          {loading ? (
            <p className="px-6 py-10 text-sm text-slate-400">Loading invoices…</p>
          ) : recentInvs.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center text-center">
              <p className="text-sm font-semibold text-slate-600">No invoices yet</p>
              <p className="mt-1 text-xs text-slate-400">Upload an invoice to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    {["ID","Invoice #","Vendor","Date","Amount","Status",""].map((c) => (
                      <th key={c} className="px-4 py-3">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentInvs.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-xs font-semibold text-slate-400">#{inv.id}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{inv.invoice_number || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{inv.vendor?.name || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmt(inv.invoice_date)}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">{fmtAmt(inv.total_amount, inv.currency)}</td>
                      <td className="px-4 py-3"><StatusBadge s={inv.status} /></td>
                      <td className="px-4 py-3">
                        <Link to={`/dashboard/invoices/${inv.id}`}
                          className="flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-700">
                          View <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Recent activity feed ─────────────────────────────────────────── */}
        {auditLog.length > 0 && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Recent activity</h2>
              <Link to="/dashboard/audit" className="text-xs font-semibold text-indigo-500 hover:text-indigo-700">
                Full audit log
              </Link>
            </div>
            <ul className="mt-4 space-y-2">
              {auditLog.map((e) => (
                <li key={e.id} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold">{actionLabel[e.action] || e.action}</span>
                      {e.invoice_id && <span className="text-slate-400"> — Invoice #{e.invoice_id}</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {new Date(e.timestamp).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

      </section>
    </main>
  );
}
