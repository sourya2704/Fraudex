import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileSearch,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import apiClient from "../../../api/client";
import Sidebar from "../../Sidebar/Sidebar";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  DOCUMENTS_UPLOADED: "bg-blue-50 text-blue-600 border-blue-100",
  PROCESSING:         "bg-amber-50 text-amber-600 border-amber-100",
  ANALYSIS_READY:     "bg-indigo-50 text-indigo-600 border-indigo-100",
  UNDER_REVIEW:       "bg-violet-50 text-violet-600 border-violet-100",
  DECIDED:            "bg-green-50 text-green-600 border-green-100",
  PROCESSING_FAILED:  "bg-rose-50 text-rose-600 border-rose-100",
  DRAFT:              "bg-slate-50 text-slate-500 border-slate-200",
};
const STATUS_LABEL = {
  DOCUMENTS_UPLOADED:"Uploaded", PROCESSING:"Processing",
  ANALYSIS_READY:"Analysis Ready", UNDER_REVIEW:"Under Review",
  DECIDED:"Decided", PROCESSING_FAILED:"Failed", DRAFT:"Draft",
};
const RISK_STYLES = {
  CRITICAL:"bg-rose-50 text-rose-600 border-rose-200",
  HIGH:    "bg-orange-50 text-orange-600 border-orange-200",
  MEDIUM:  "bg-amber-50 text-amber-600 border-amber-200",
  LOW:     "bg-green-50 text-green-600 border-green-200",
};
const SEV_STYLES = {
  CRITICAL:"bg-rose-100 text-rose-700",
  HIGH:    "bg-orange-100 text-orange-700",
  MEDIUM:  "bg-amber-100 text-amber-700",
  LOW:     "bg-blue-100 text-blue-700",
  INFO:    "bg-slate-100 text-slate-600",
};
const SEV_DOT = {
  CRITICAL:"bg-rose-500", HIGH:"bg-orange-500",
  MEDIUM:"bg-amber-400", LOW:"bg-blue-400", INFO:"bg-slate-400",
};

function StatusBadge({ s }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[s] || STATUS_STYLES.DRAFT}`}>
      {STATUS_LABEL[s] || s}
    </span>
  );
}
function RiskBadge({ level }) {
  if (!level) return null;
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${RISK_STYLES[level] || ""}`}>
      {level}
    </span>
  );
}
function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}
function fmtAmt(v, cur) {
  if (v == null) return "—";
  return `${cur || ""} ${parseFloat(v).toLocaleString("en-IN",{minimumFractionDigits:2})}`.trim();
}
function fmtTs(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}

function Field({ label, value, highlight }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${highlight ? "text-rose-600" : value && value !== "—" ? "text-slate-800" : "text-slate-300"}`}>
        {value || "—"}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk score ring
// ─────────────────────────────────────────────────────────────────────────────
function RiskScoreRing({ score, level }) {
  const pct  = Math.min(100, Math.max(0, score || 0));
  const r    = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color =
    level === "CRITICAL" ? "#ef4444" :
    level === "HIGH"     ? "#f97316" :
    level === "MEDIUM"   ? "#f59e0b" :
                           "#22c55e";
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <text x="48" y="52" textAnchor="middle" fontSize="18" fontWeight="bold" fill={color}>
          {pct.toFixed(0)}
        </text>
      </svg>
      {level && <RiskBadge level={level} />}
      <p className="text-xs text-slate-400">Risk Score / 100</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fraud flags list
// ─────────────────────────────────────────────────────────────────────────────
function FraudFlags({ flags }) {
  const [expanded, setExpanded] = useState(null);
  if (!flags || flags.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <ShieldCheck size={28} className="text-green-300" />
        <p className="mt-2 text-sm font-semibold text-slate-500">No fraud flags detected</p>
      </div>
    );
  }
  const order = { CRITICAL:0, HIGH:1, MEDIUM:2, LOW:3, INFO:4 };
  const sorted = [...flags].sort((a,b) => (order[a.severity]??5) - (order[b.severity]??5));
  return (
    <div className="space-y-2">
      {sorted.map((flag, i) => (
        <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/60">
          <button
            className="flex w-full items-start gap-3 px-4 py-3 text-left"
            onClick={() => setExpanded(expanded === i ? null : i)}
            type="button"
          >
            <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${SEV_DOT[flag.severity] || "bg-slate-400"}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${SEV_STYLES[flag.severity]}`}>
                  {flag.severity}
                </span>
                <span className="text-xs font-semibold text-slate-700">{flag.code.replace(/_/g," ")}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{flag.message}</p>
            </div>
            <span className="text-[10px] text-slate-400">{expanded === i ? "▲" : "▼"}</span>
          </button>
          {expanded === i && flag.evidence && Object.keys(flag.evidence).length > 0 && (
            <div className="border-t border-slate-100 bg-white px-4 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Evidence</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(flag.evidence).map(([k, v]) => (
                  <span key={k} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                    <span className="font-medium text-slate-400">{k}:</span> {String(v ?? "—")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation issues
// ─────────────────────────────────────────────────────────────────────────────
function ValidationIssues({ result }) {
  if (!result) return null;
  const { valid, issues } = result;
  if (!issues || issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
        <CheckCircle2 size={16} /> All validation checks passed
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${valid ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
        {valid ? <AlertTriangle size={14} /> : <XCircle size={14} />}
        {valid ? `Valid with ${issues.length} warning(s)` : `Invalid — ${result.error_count} error(s), ${result.warning_count} warning(s)`}
      </div>
      {issues.map((issue, i) => (
        <div key={i} className={`flex gap-3 rounded-lg border px-4 py-3 ${issue.severity === "ERROR" ? "border-rose-100 bg-rose-50/60" : "border-amber-100 bg-amber-50/60"}`}>
          <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${issue.severity === "ERROR" ? "bg-rose-500" : "bg-amber-400"}`} />
          <div>
            <p className="text-xs font-semibold text-slate-700">{issue.code.replace(/_/g," ")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{issue.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit timeline
// ─────────────────────────────────────────────────────────────────────────────
const ACTION_LABEL = {
  INVOICE_UPLOADED:"Uploaded", INVOICE_EXTRACTED:"Text extracted",
  INVOICE_VALIDATED:"Validated", FRAUD_CHECK_RUN:"Fraud check run",
  INVOICE_STATUS_CHANGED:"Status changed", REVIEW_DECISION:"Review decision",
};
const ACTION_COLOR = {
  INVOICE_UPLOADED:"bg-blue-400", INVOICE_EXTRACTED:"bg-indigo-400",
  INVOICE_VALIDATED:"bg-violet-400", FRAUD_CHECK_RUN:"bg-orange-400",
  INVOICE_STATUS_CHANGED:"bg-amber-400", REVIEW_DECISION:"bg-green-500",
};

function AuditTimeline({ logs }) {
  if (!logs || logs.length === 0) {
    return <p className="text-xs text-slate-400">No audit events yet</p>;
  }
  return (
    <div className="space-y-3">
      {logs.map((e) => {
        let detail = null;
        try { detail = e.detail ? JSON.parse(e.detail) : null; } catch {}
        return (
          <div key={e.id} className="flex gap-3">
            <div className="flex flex-col items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${ACTION_COLOR[e.action] || "bg-slate-400"}`} />
              <span className="w-px flex-1 bg-slate-100" />
            </div>
            <div className="pb-3">
              <p className="text-xs font-semibold text-slate-700">
                {ACTION_LABEL[e.action] || e.action}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">{fmtTs(e.timestamp)}</p>
              {detail && typeof detail === "object" && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {Object.entries(detail).slice(0,3).map(([k,v]) => (
                    <span key={k} className="rounded border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Review form
// ─────────────────────────────────────────────────────────────────────────────
function ReviewForm({ invoiceId, existingReview, onReviewed }) {
  const [decision, setDecision] = useState(existingReview?.decision || "");
  const [reason, setReason]     = useState(existingReview?.reason || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!decision || !reason.trim()) { setError("Decision and reason are both required."); return; }
    setError(""); setSubmitting(true);
    try {
      await apiClient.post(`/invoices/${invoiceId}/review`, { decision, reason });
      setSuccess(true);
      onReviewed();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  const decisions = [
    { value:"APPROVE",                label:"Approve",              style:"border-green-300 bg-green-50 text-green-700",  active:"border-green-500 bg-green-500 text-white" },
    { value:"REJECT",                 label:"Reject",               style:"border-rose-300 bg-rose-50 text-rose-700",    active:"border-rose-500 bg-rose-500 text-white" },
    { value:"REQUEST_FURTHER_REVIEW", label:"Request Further Review",style:"border-amber-300 bg-amber-50 text-amber-700",active:"border-amber-500 bg-amber-500 text-white" },
  ];

  if (success) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
        <CheckCircle2 size={16} /> Review submitted successfully
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {existingReview && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
          <strong>Previous decision:</strong> {existingReview.decision} — "{existingReview.reason}"
          <br /><span className="text-indigo-400">Submitting again will overwrite this.</span>
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Decision *</p>
        <div className="flex flex-wrap gap-2">
          {decisions.map((d) => (
            <button key={d.value} type="button"
              onClick={() => setDecision(d.value)}
              className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${decision === d.value ? d.active : d.style}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="review-reason">
          Written reason * <span className="font-normal text-slate-400">(required)</span>
        </label>
        <textarea
          id="review-reason"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          rows={3}
          placeholder="Explain your decision — this is recorded in the audit trail…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !decision || !reason.trim()}
        className="flex items-center gap-2 rounded-lg bg-[#5967f2] px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#4856df] disabled:cursor-not-allowed disabled:opacity-50">
        <ShieldCheck size={15} />
        {submitting ? "Submitting…" : "Submit Review"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main InvoiceDetail page
// ─────────────────────────────────────────────────────────────────────────────
export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice]     = useState(null);
  const [fraud, setFraud]         = useState(null);
  const [validation, setValidation] = useState(null);
  const [audit, setAudit]         = useState([]);
  const [review, setReview]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [runningFraud, setRunningFraud] = useState(false);
  const [runningExtract, setRunningExtract] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);

  async function loadAll() {
    try {
      const [invRes, fraudRes, auditRes, revRes] = await Promise.allSettled([
        apiClient.get(`/invoices/${invoiceId}`),
        apiClient.get(`/invoices/${invoiceId}/fraud-detection`),
        apiClient.get(`/audit/${invoiceId}`),
        apiClient.get(`/invoices/${invoiceId}/review`),
      ]);
      if (invRes.status   === "fulfilled") setInvoice(invRes.value.data);
      else setError("Invoice not found");
      if (fraudRes.status === "fulfilled") setFraud(fraudRes.value.data);
      if (auditRes.status === "fulfilled") setAudit(auditRes.value.data);
      if (revRes.status   === "fulfilled") setReview(revRes.value.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadAll(); }, [invoiceId]);

  async function runExtract() {
    setRunningExtract(true);
    try {
      await apiClient.post(`/invoices/${invoiceId}/extract`);
      await loadAll();
    } finally { setRunningExtract(false); }
  }

  async function runFraudCheck() {
    setRunningFraud(true);
    try {
      const res = await apiClient.post(`/invoices/${invoiceId}/detect-fraud`);
      setFraud(res.data);
      const valRes = await apiClient.post(`/invoices/${invoiceId}/validate`);
      setValidation(valRes.data.validation);
      const auditRes = await apiClient.get(`/audit/${invoiceId}`);
      setAudit(auditRes.data);
    } finally { setRunningFraud(false); }
  }

  function refresh() { setRefreshing(true); loadAll(); }

  if (loading) {
    return (
      <main className="flex min-h-screen bg-[#f4f5f0]">
        <Sidebar expanded />
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          Loading invoice…
        </div>
      </main>
    );
  }

  if (error || !invoice) {
    return (
      <main className="flex min-h-screen bg-[#f4f5f0]">
        <Sidebar expanded />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-rose-600">{error || "Invoice not found"}</p>
          <Link to="/dashboard/invoices" className="text-xs font-semibold text-indigo-500 hover:text-indigo-700">
            ← Back to invoices
          </Link>
        </div>
      </main>
    );
  }

  const flagCounts = fraud ? {
    critical: fraud.critical_count, high: fraud.high_count,
    medium: fraud.medium_count,     low:  fraud.low_count,
  } : null;

  return (
    <main className="flex min-h-screen bg-[#f4f5f0] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/invoices"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700">
              <ChevronLeft size={15} /> Invoices
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-sm font-semibold text-slate-800">
              Invoice #{invoiceId}
              {invoice.invoice_number && <span className="ml-2 text-slate-400">· {invoice.invoice_number}</span>}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge s={invoice.status} />
            <button onClick={refresh} title="Refresh" type="button"
              className={`grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-700 ${refreshing?"animate-spin":""}`}>
              <RefreshCw size={14} />
            </button>
            <Bell size={16} className="text-slate-400" />
          </div>
        </header>

        <section className="mx-auto max-w-6xl space-y-5 px-5 py-6 sm:px-8">

          {/* ── Top row: fields + risk score ────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-[1fr_auto]">

            {/* Extracted invoice fields */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <FileText size={15} className="text-indigo-400" /> Extracted Invoice Data
                </h2>
                {invoice.status === "DOCUMENTS_UPLOADED" && (
                  <button onClick={runExtract} disabled={runningExtract} type="button"
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-60">
                    <FileSearch size={13} /> {runningExtract ? "Extracting…" : "Run Extraction"}
                  </button>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Field label="Invoice Number" value={invoice.invoice_number} />
                <Field label="Invoice Date"   value={fmt(invoice.invoice_date)} />
                <Field label="Due Date"       value={fmt(invoice.due_date)} />
                <Field label="Subtotal"       value={fmtAmt(invoice.subtotal, invoice.currency)} />
                <Field label="Tax"            value={fmtAmt(invoice.tax, invoice.currency)} />
                <Field label="Total Amount"   value={fmtAmt(invoice.total_amount, invoice.currency)}
                  highlight={!invoice.total_amount} />
                <Field label="Currency"       value={invoice.currency} highlight={!invoice.currency} />
                <Field label="Uploaded"       value={fmtTs(invoice.created_at)} />
                <Field label="Last Updated"   value={fmtTs(invoice.updated_at)} />
              </div>

              {/* Line items */}
              {invoice.items && invoice.items.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-slate-500">Line Items ({invoice.items.length})</p>
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <tr>
                          {["Description","Qty","Unit Price","Tax","Line Total"].map(c=>(
                            <th key={c} className="px-3 py-2">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {invoice.items.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50/60">
                            <td className="px-3 py-2 text-slate-700">{item.description || "—"}</td>
                            <td className="px-3 py-2 text-slate-500">{item.quantity ?? "—"}</td>
                            <td className="px-3 py-2 text-slate-500">{fmtAmt(item.unit_price, invoice.currency)}</td>
                            <td className="px-3 py-2 text-slate-500">{fmtAmt(item.tax, invoice.currency)}</td>
                            <td className="px-3 py-2 font-semibold text-slate-700">{fmtAmt(item.line_total, invoice.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* Risk score ring */}
            <section className="flex w-52 flex-col items-center justify-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="self-start text-sm font-semibold">Risk Score</h2>
              {fraud ? (
                <>
                  <RiskScoreRing score={fraud.risk_score} level={fraud.risk_level} />
                  <div className="w-full space-y-1.5 border-t border-slate-100 pt-3">
                    {[
                      ["Critical", flagCounts.critical, "text-rose-600"],
                      ["High",     flagCounts.high,     "text-orange-500"],
                      ["Medium",   flagCounts.medium,   "text-amber-500"],
                      ["Low",      flagCounts.low,      "text-green-500"],
                    ].map(([label, count, color]) => (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{label} flags</span>
                        <span className={`font-bold ${color}`}>{count}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <ShieldAlert size={32} className="text-slate-200" />
                  <p className="text-xs text-slate-400">Not analyzed yet</p>
                  <button onClick={runFraudCheck} disabled={runningFraud} type="button"
                    className="mt-2 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-60">
                    {runningFraud ? "Running…" : "Run Fraud Check"}
                  </button>
                </div>
              )}
              {fraud && (
                <button onClick={runFraudCheck} disabled={runningFraud} type="button"
                  className="w-full rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-60">
                  {runningFraud ? "Running…" : "Re-run Check"}
                </button>
              )}
            </section>
          </div>

          {/* ── Middle row: Fraud flags + Validation ────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert size={15} className="text-orange-400" /> Fraud Detection Findings
                {fraud && (
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {fraud.fraud_flags?.length || 0} flags
                  </span>
                )}
              </h2>
              {fraud
                ? <FraudFlags flags={fraud.fraud_flags} />
                : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <ShieldAlert size={28} className="text-slate-200" />
                    <p className="mt-2 text-sm text-slate-400">Run fraud detection to see results</p>
                  </div>
                )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 size={15} className="text-violet-400" /> Validation Results
              </h2>
              {validation
                ? <ValidationIssues result={validation} />
                : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <CheckCircle2 size={28} className="text-slate-200" />
                    <p className="mt-2 text-sm text-slate-400">Run fraud check to also see validation</p>
                  </div>
                )}
            </section>
          </div>

          {/* ── Bottom row: Human Review + Audit timeline ────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <User size={15} className="text-green-400" /> Human Review
              </h2>
              {review && (
                <div className={`mb-4 rounded-lg border px-4 py-3 ${review.decision === "APPROVE" ? "border-green-200 bg-green-50" : review.decision === "REJECT" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${review.decision === "APPROVE" ? "bg-green-500 text-white" : review.decision === "REJECT" ? "bg-rose-500 text-white" : "bg-amber-400 text-white"}`}>
                      {review.decision}
                    </span>
                    <span className="text-slate-400">{fmtTs(review.reviewed_at)}</span>
                  </div>
                  <p className="mt-2 text-xs italic text-slate-600">"{review.reason}"</p>
                </div>
              )}
              <ReviewForm
                invoiceId={invoiceId}
                existingReview={review}
                onReviewed={loadAll}
              />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Activity size={15} className="text-indigo-400" /> Audit Trail
                <Link to="/dashboard/audit" className="ml-auto text-[11px] font-semibold text-indigo-500 hover:text-indigo-700">
                  Full log →
                </Link>
              </h2>
              <div className="max-h-72 overflow-y-auto">
                <AuditTimeline logs={audit} />
              </div>
            </section>
          </div>

        </section>
      </div>
    </main>
  );
}
