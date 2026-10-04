import {
  Activity,
  Bell,
  CheckCircle,
  ChevronDown,
  Clock,
  FileSearch,
  FileUp,
  Search,
  ShieldAlert,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import Sidebar from "../../Sidebar/Sidebar";
import apiClient from "../../../api/client";

// ── Action metadata ─────────────────────────────────────────────────────────
const ACTION_META = {
  INVOICE_UPLOADED:        { label: "Invoice Uploaded",       color: "blue",   Icon: FileUp },
  INVOICE_EXTRACTED:       { label: "Text Extracted",         color: "indigo", Icon: FileSearch },
  INVOICE_VALIDATED:       { label: "Invoice Validated",      color: "violet", Icon: CheckCircle },
  FRAUD_CHECK_RUN:         { label: "Fraud Check Run",        color: "orange", Icon: ShieldAlert },
  INVOICE_STATUS_CHANGED:  { label: "Status Changed",         color: "amber",  Icon: Activity },
  REVIEW_DECISION:         { label: "Review Decision",        color: "green",  Icon: CheckCircle },
  USER_REGISTERED:         { label: "User Registered",        color: "teal",   Icon: User },
  USER_LOGIN:              { label: "User Login",             color: "slate",  Icon: User },
  USER_LOGOUT:             { label: "User Logout",            color: "slate",  Icon: User },
};

const COLOR_CLASSES = {
  blue:   "bg-blue-50   text-blue-600   border-blue-100",
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  violet: "bg-violet-50 text-violet-600 border-violet-100",
  orange: "bg-orange-50 text-orange-600 border-orange-100",
  amber:  "bg-amber-50  text-amber-500  border-amber-100",
  green:  "bg-green-50  text-green-600  border-green-100",
  teal:   "bg-teal-50   text-teal-600   border-teal-100",
  slate:  "bg-slate-50  text-slate-500  border-slate-100",
  rose:   "bg-rose-50   text-rose-600   border-rose-100",
};

const DOT_COLORS = {
  blue: "bg-blue-500", indigo: "bg-indigo-500", violet: "bg-violet-500",
  orange: "bg-orange-500", amber: "bg-amber-400", green: "bg-green-500",
  teal: "bg-teal-500", slate: "bg-slate-400", rose: "bg-rose-500",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function parseDetail(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

function DetailBadges({ detail }) {
  if (!detail) return null;
  if (typeof detail === "string") return <span className="text-xs text-slate-500">{detail}</span>;

  const entries = Object.entries(detail);
  if (!entries.length) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
          <span className="font-medium text-slate-400">{k}:</span>
          <span>{String(v)}</span>
        </span>
      ))}
    </div>
  );
}

function RiskBadge({ level }) {
  const map = { CRITICAL: "rose", HIGH: "orange", MEDIUM: "amber", LOW: "green" };
  const color = map[level] || "slate";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${COLOR_CLASSES[color]}`}>
      {level}
    </span>
  );
}

// ── Single audit row ──────────────────────────────────────────────────────────
function AuditRow({ entry }) {
  const [open, setOpen] = useState(false);
  const meta = ACTION_META[entry.action] || { label: entry.action, color: "slate", Icon: Activity };
  const { label, color, Icon } = meta;
  const detail = parseDetail(entry.detail);

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/60"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        {/* Timeline dot */}
        <div className="mt-1 flex flex-col items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-full ${DOT_COLORS[color]}`} />
        </div>

        {/* Icon badge */}
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${COLOR_CLASSES[color]}`}>
          <Icon size={15} strokeWidth={2} />
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{label}</span>
            {entry.invoice_id && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                Invoice #{entry.invoice_id}
              </span>
            )}
            {detail?.risk_level && <RiskBadge level={detail.risk_level} />}
            {detail?.decision && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${detail.decision === "APPROVE" ? COLOR_CLASSES.green : detail.decision === "REJECT" ? COLOR_CLASSES.rose : COLOR_CLASSES.amber}`}>
                {detail.decision}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Clock size={11} />{formatTime(entry.timestamp)}</span>
            {entry.user_id && <span className="flex items-center gap-1"><User size={11} />User {entry.user_id}</span>}
          </div>
          {!open && detail && typeof detail === "object" && (
            <p className="mt-1 truncate text-xs text-slate-400">
              {Object.entries(detail).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ")}
            </p>
          )}
        </div>

        {/* Expand chevron */}
        <ChevronDown
          size={15}
          className={`mt-1 shrink-0 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 pl-[72px]">
          <DetailBadges detail={detail} />
          {detail?.reason && (
            <p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 italic">
              "{detail.reason}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
const ALL_ACTIONS = ["ALL", ...Object.keys(ACTION_META)];

function FilterBar({ selected, onChange, search, onSearch }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="h-9 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="Search action or invoice..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["ALL", "INVOICE_UPLOADED", "FRAUD_CHECK_RUN", "REVIEW_DECISION", "USER_LOGIN"].map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onChange(action)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              selected === action
                ? "border-indigo-500 bg-indigo-500 text-white"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            {action === "ALL" ? "All events" : ACTION_META[action]?.label || action}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ logs }) {
  const counts = logs.reduce((acc, e) => {
    acc[e.action] = (acc[e.action] || 0) + 1;
    return acc;
  }, {});

  const stats = [
    { label: "Total Events",    value: logs.length,                             color: "indigo" },
    { label: "Uploads",         value: counts["INVOICE_UPLOADED"] || 0,         color: "blue" },
    { label: "Fraud Checks",    value: counts["FRAUD_CHECK_RUN"] || 0,           color: "orange" },
    { label: "Review Decisions",value: counts["REVIEW_DECISION"] || 0,           color: "green" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(({ label, value, color }) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold tracking-tight text-slate-800">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");

  useEffect(() => {
    const params = {};
    if (filter !== "ALL") params.action = filter;
    params.limit = 200;

    apiClient
      .get("/audit/", { params })
      .then((r) => { setLogs(r.data); setLoading(false); })
      .catch((e) => {
        setError(e.response?.data?.detail || "Failed to load audit logs");
        setLoading(false);
      });
  }, [filter]);

  // Client-side search filter
  const visible = logs.filter((e) => {
    const searchLow = search.toLowerCase();
    const matchSearch =
      !search ||
      e.action.toLowerCase().includes(searchLow) ||
      String(e.invoice_id || "").includes(searchLow) ||
      (e.detail || "").toLowerCase().includes(searchLow);
    const matchInvoice =
      !invoiceFilter || String(e.invoice_id) === invoiceFilter;
    return matchSearch && matchInvoice;
  });

  return (
    <main className="flex min-h-screen bg-[#f4f5f0] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        {/* Header */}
        <header className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <div className="flex items-center gap-3">
            <Activity size={18} className="text-indigo-500" />
            <h1 className="text-base font-semibold">Audit Log</h1>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <Search size={18} />
            <Bell size={18} />
          </div>
        </header>

        <section className="mx-auto max-w-5xl space-y-5 px-5 py-6 sm:px-8 lg:py-7">

          {/* Stats */}
          {!loading && !error && <StatsBar logs={logs} />}

          {/* Filters */}
          <FilterBar
            selected={filter}
            onChange={setFilter}
            search={search}
            onSearch={setSearch}
          />

          {/* Invoice ID quick filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filter by invoice ID:</span>
            {[...new Set(logs.map((e) => e.invoice_id).filter(Boolean))].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setInvoiceFilter(invoiceFilter === String(id) ? "" : String(id))}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                  invoiceFilter === String(id)
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                #{id}
              </button>
            ))}
            {invoiceFilter && (
              <button
                type="button"
                onClick={() => setInvoiceFilter("")}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
              >
                <XCircle size={12} /> Clear
              </button>
            )}
          </div>

          {/* Log feed */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Event Timeline</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                {visible.length} event{visible.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-20 text-sm text-slate-400">
                <Activity size={18} className="mr-2 animate-pulse text-indigo-400" />
                Loading audit events…
              </div>
            )}

            {error && (
              <div className="m-5 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                <strong>Error:</strong> {error}
                {error.includes("permission") && (
                  <p className="mt-1 text-xs">System-wide audit log requires ADMIN role.</p>
                )}
              </div>
            )}

            {!loading && !error && visible.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Activity size={28} className="text-slate-200" />
                <p className="mt-3 text-sm font-semibold text-slate-500">No events found</p>
                <p className="mt-1 text-xs text-slate-400">Try adjusting your filters</p>
              </div>
            )}

            {!loading && !error && visible.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
