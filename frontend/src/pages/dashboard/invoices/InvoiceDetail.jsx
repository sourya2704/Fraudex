import {
  Activity,
  AlertTriangle,
  Bell,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileSearch,
  FileText,
  Pencil,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import apiClient, { apiError } from "../../../api/client";
import Sidebar from "../../Sidebar/Sidebar";
import { useAuth } from "../../../context/AuthContext";

/* ── helpers ──────────────────────────────────────────────────────────────── */
const STATUS_STYLE = {
  DOCUMENTS_UPLOADED:"bg-blue-50 text-blue-600 border-blue-200",
  PROCESSING:"bg-amber-50 text-amber-600 border-amber-200",
  ANALYSIS_READY:"bg-indigo-50 text-indigo-600 border-indigo-200",
  UNDER_REVIEW:"bg-violet-50 text-violet-600 border-violet-200",
  DECIDED:"bg-emerald-50 text-emerald-600 border-emerald-200",
  PROCESSING_FAILED:"bg-rose-50 text-rose-600 border-rose-200",
  DRAFT:"bg-slate-100 text-slate-500 border-slate-200",
};
const STATUS_LABEL = {
  DOCUMENTS_UPLOADED:"Uploaded", PROCESSING:"Processing", ANALYSIS_READY:"Analysis Ready",
  UNDER_REVIEW:"Under Review", DECIDED:"Decided", PROCESSING_FAILED:"Failed", DRAFT:"Draft",
};
const RISK_STYLE = {
  CRITICAL:"bg-rose-50 text-rose-600 border-rose-200",
  HIGH:"bg-orange-50 text-orange-600 border-orange-200",
  MEDIUM:"bg-amber-50 text-amber-600 border-amber-200",
  LOW:"bg-emerald-50 text-emerald-600 border-emerald-200",
};
const SEV_STYLE = {
  CRITICAL:"bg-rose-100 text-rose-700", HIGH:"bg-orange-100 text-orange-700",
  MEDIUM:"bg-amber-100 text-amber-700", LOW:"bg-blue-100 text-blue-700", INFO:"bg-slate-100 text-slate-500",
};
const SEV_DOT = {
  CRITICAL:"bg-rose-500", HIGH:"bg-orange-500", MEDIUM:"bg-amber-400", LOW:"bg-blue-400", INFO:"bg-slate-400",
};
const ACTION_DOT = {
  INVOICE_UPLOADED:"bg-blue-400", INVOICE_EXTRACTED:"bg-indigo-400",
  INVOICE_VALIDATED:"bg-violet-400", FRAUD_CHECK_RUN:"bg-orange-400",
  INVOICE_STATUS_CHANGED:"bg-amber-400", REVIEW_DECISION:"bg-emerald-500",
};
const ACTION_LABEL = {
  INVOICE_UPLOADED:"Uploaded", INVOICE_EXTRACTED:"Text extracted",
  INVOICE_VALIDATED:"Validated", FRAUD_CHECK_RUN:"Fraud check",
  INVOICE_STATUS_CHANGED:"Status changed", REVIEW_DECISION:"Review decision",
};

function Badge({ cls, children }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}
function fmt(d) { return d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—"; }
function fmtAmt(v,c) { return v==null?"—":`${c||""} ${parseFloat(v).toLocaleString("en-IN",{minimumFractionDigits:2})}`.trim(); }
function fmtTs(ts) { return ts ? new Date(ts).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"; }

/* ── Field tile ───────────────────────────────────────────────────────────── */
function FieldTile({ label, value, warn }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1.5 text-sm font-semibold ${warn ? "text-rose-500" : value&&value!=="—" ? "text-slate-800" : "text-slate-300"}`}>
        {value||"—"}
      </p>
    </div>
  );
}

/* ── Risk score ring ──────────────────────────────────────────────────────── */
function RiskRing({ score, level }) {
  const pct = Math.min(100, Math.max(0, score||0));
  const r = 38; const circ = 2*Math.PI*r;
  const dash = (pct/100)*circ;
  const col = level==="CRITICAL"?"#ef4444":level==="HIGH"?"#f97316":level==="MEDIUM"?"#f59e0b":"#10b981";
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={col} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{transition:"stroke-dasharray 0.7s ease"}}/>
        <text x="50" y="54" textAnchor="middle" fontSize="20" fontWeight="800" fill={col}>{pct.toFixed(0)}</text>
      </svg>
      {level && <Badge cls={RISK_STYLE[level]||""}>{level}</Badge>}
      <p className="text-[11px] text-slate-400">out of 100</p>
    </div>
  );
}

/* ── Fraud flags ──────────────────────────────────────────────────────────── */
function FraudFlags({ flags }) {
  const [open, setOpen] = useState(null);
  if (!flags?.length) return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-500"><ShieldCheck size={22}/></div>
      <p className="mt-3 text-sm font-semibold text-slate-600">No fraud flags detected</p>
      <p className="mt-1 text-xs text-slate-400">Invoice passed all fraud checks</p>
    </div>
  );
  const order = {CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3,INFO:4};
  return (
    <div className="space-y-2">
      {[...flags].sort((a,b)=>(order[a.severity]??5)-(order[b.severity]??5)).map((f,i)=>(
        <div key={i} className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <button type="button"
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
            onClick={()=>setOpen(open===i?null:i)}>
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${SEV_DOT[f.severity]||"bg-slate-400"}`}/>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${SEV_STYLE[f.severity]}`}>{f.severity}</span>
                <span className="text-xs font-semibold text-slate-700">{f.code.replace(/_/g," ")}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{f.message}</p>
            </div>
            <span className="mt-0.5 text-[10px] text-slate-300">{open===i?"▲":"▼"}</span>
          </button>
          {open===i && f.evidence && Object.keys(f.evidence).length>0 && (
            <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Evidence</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(f.evidence).map(([k,v])=>(
                  <span key={k} className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                    <span className="font-medium text-slate-400">{k}:</span> {String(v??"—")}
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

/* ── Validation ───────────────────────────────────────────────────────────── */
function Validation({ result }) {
  if (!result) return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-300"><CheckCircle2 size={22}/></div>
      <p className="mt-3 text-xs text-slate-400">Run fraud check to see validation results</p>
    </div>
  );
  const { valid, issues } = result;
  if (!issues?.length) return (
    <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
      <CheckCircle2 size={16}/> All validation checks passed
    </div>
  );
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-semibold ${valid?"bg-amber-50 text-amber-700":"bg-rose-50 text-rose-700"}`}>
        {valid?<AlertTriangle size={14}/>:<XCircle size={14}/>}
        {valid?`Valid with ${issues.length} warning(s)`:`${result.error_count} error(s), ${result.warning_count} warning(s)`}
      </div>
      {issues.map((iss,i)=>(
        <div key={i} className={`flex gap-3 rounded-xl border px-4 py-3 ${iss.severity==="ERROR"?"border-rose-100 bg-rose-50/60":"border-amber-100 bg-amber-50/60"}`}>
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${iss.severity==="ERROR"?"bg-rose-500":"bg-amber-400"}`}/>
          <div>
            <p className="text-xs font-semibold text-slate-700">{iss.code.replace(/_/g," ")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{iss.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Audit timeline ───────────────────────────────────────────────────────── */
function Timeline({ logs }) {
  if (!logs?.length) return <p className="text-xs text-slate-400">No audit events yet</p>;
  return (
    <div className="space-y-1">
      {logs.map((e,i)=>{
        let detail = null;
        try { detail = e.detail ? JSON.parse(e.detail) : null; } catch {}
        return (
          <div key={e.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${ACTION_DOT[e.action]||"bg-slate-300"}`}/>
              {i<logs.length-1 && <span className="mt-1 w-px flex-1 bg-slate-100"/>}
            </div>
            <div className="pb-4 min-w-0">
              <p className="text-xs font-semibold text-slate-700">{ACTION_LABEL[e.action]||e.action}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{fmtTs(e.timestamp)}</p>
              {detail && typeof detail==="object" && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(detail).slice(0,3).map(([k,v])=>(
                    <span key={k} className="rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
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

/* ── Review form ──────────────────────────────────────────────────────────── */
function ReviewForm({ invoiceId, existingReview, onReviewed }) {
  const [editing,     setEditing]     = useState(!existingReview);  // if no review yet, start in edit mode
  const [decision,    setDecision]    = useState(existingReview?.decision || "");
  const [reason,      setReason]      = useState(existingReview?.reason   || "");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");

  // sync when existingReview changes (after submit)
  function startEdit() {
    setDecision(existingReview?.decision || "");
    setReason(existingReview?.reason     || "");
    setError("");
    setEditing(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (!decision || !reason.trim()) { setError("Both decision and reason are required."); return; }
    setError(""); setSubmitting(true);
    try {
      await apiClient.post(`/invoices/${invoiceId}/review`, { decision, reason });
      setEditing(false);
      onReviewed();
    } catch(err) { setError(apiError(err, "Failed to submit review")); }
    finally { setSubmitting(false); }
  }

  const DECISION_STYLE = {
    APPROVE:                { label:"Approved",              bg:"bg-emerald-50", text:"text-emerald-700", border:"border-emerald-200", badge:"bg-emerald-500" },
    REJECT:                 { label:"Rejected",              bg:"bg-rose-50",    text:"text-rose-700",    border:"border-rose-200",    badge:"bg-rose-500"    },
    REQUEST_FURTHER_REVIEW: { label:"Further Review Needed", bg:"bg-amber-50",   text:"text-amber-700",  border:"border-amber-200",   badge:"bg-amber-500"   },
  };

  const decisions = [
    { v:"APPROVE",                l:"Approve",               idle:"border-emerald-200 bg-emerald-50 text-emerald-700",  active:"border-emerald-500 bg-emerald-500 text-white" },
    { v:"REJECT",                 l:"Reject",                idle:"border-rose-200 bg-rose-50 text-rose-700",           active:"border-rose-500 bg-rose-500 text-white"       },
    { v:"REQUEST_FURTHER_REVIEW", l:"Request Further Review",idle:"border-amber-200 bg-amber-50 text-amber-700",        active:"border-amber-500 bg-amber-500 text-white"     },
  ];

  // ── Submitted view (not editing) ────────────────────────────────────────
  if (existingReview && !editing) {
    const ds = DECISION_STYLE[existingReview.decision] || DECISION_STYLE.APPROVE;
    return (
      <div className={`rounded-xl border ${ds.border} ${ds.bg} p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`rounded-full ${ds.badge} px-3 py-0.5 text-[11px] font-bold text-white tracking-wide`}>
              {ds.label}
            </span>
            <span className="text-xs text-slate-400">
              {new Date(existingReview.reviewed_at).toLocaleString("en-IN", {
                day:"2-digit", month:"short", year:"numeric",
                hour:"2-digit", minute:"2-digit"
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={startEdit}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition"
          >
            <Pencil size={11}/> Edit
          </button>
        </div>
        <p className={`mt-2 text-sm font-medium ${ds.text}`}>"{existingReview.reason}"</p>
      </div>
    );
  }

  // ── Edit / Submit form ───────────────────────────────────────────────────
  return (
    <form onSubmit={submit} className="space-y-4">
      {existingReview && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
          <p className="text-xs text-slate-500">
            Editing previous: <strong>{existingReview.decision}</strong> — "{existingReview.reason}"
          </p>
          <button type="button" onClick={() => setEditing(false)}
            className="text-xs text-slate-400 hover:text-slate-700 transition">
            Cancel
          </button>
        </div>
      )}
      <div>
        <p className="mb-2.5 text-xs font-semibold text-slate-600">Decision *</p>
        <div className="flex flex-wrap gap-2">
          {decisions.map(d => (
            <button key={d.v} type="button" onClick={() => setDecision(d.v)}
              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-all ${decision === d.v ? d.active : d.idle}`}>
              {d.l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="rev-reason">
          Reason * <span className="font-normal text-slate-400">(recorded in audit trail)</span>
        </label>
        <textarea id="rev-reason" rows={3}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
          placeholder="Explain your decision…"
          value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button type="submit" disabled={submitting || !decision || !reason.trim()}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
        <ShieldCheck size={15}/>
        {submitting ? "Submitting…" : existingReview ? "Update Review" : "Submit Review"}
      </button>
    </form>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const navigate      = useNavigate();
  const { user }      = useAuth();
  const isAdmin       = user?.role === "ADMIN";
  const [invoice, setInvoice]     = useState(null);
  const [fraud, setFraud]         = useState(null);
  const [validation, setValidation] = useState(null);
  const [audit, setAudit]         = useState([]);
  const [review, setReview]       = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [runningFraud, setRunningFraud] = useState(false);
  const [runningExtract, setRunningExtract] = useState(false);
  const [runningAI, setRunningAI] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [actionError, setActionError] = useState(null);

  function showActionError(what, e) {
    setActionError(`${what} failed: ${apiError(e, e?.message || "unknown error")}`);
  }

  async function loadAll() {
    try {
      const [invRes, fraudRes, auditRes, revRes, aiRes] = await Promise.allSettled([
        apiClient.get(`/invoices/${invoiceId}`),
        apiClient.get(`/invoices/${invoiceId}/fraud-detection`),
        apiClient.get(`/audit/${invoiceId}`),
        apiClient.get(`/invoices/${invoiceId}/review`),
        apiClient.get(`/invoices/${invoiceId}/ai-analysis`),
      ]);
      if (invRes.status   === "fulfilled") setInvoice(invRes.value.data);
      else setError("Invoice not found");
      if (fraudRes.status === "fulfilled") setFraud(fraudRes.value.data);
      if (auditRes.status === "fulfilled") setAudit(auditRes.value.data);
      if (revRes.status   === "fulfilled") setReview(revRes.value.data);
      if (aiRes.status    === "fulfilled") setAiAnalysis(aiRes.value.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(()=>{ loadAll(); },[invoiceId]);

  async function runExtract() {
    setRunningExtract(true); setActionError(null);
    try { await apiClient.post(`/invoices/${invoiceId}/extract`); await loadAll(); }
    catch (e) { showActionError("Extraction", e); await loadAll(); }
    finally { setRunningExtract(false); }
  }

  async function runFraudCheck() {
    setRunningFraud(true); setActionError(null);
    try {
      const r = await apiClient.post(`/invoices/${invoiceId}/detect-fraud`); setFraud(r.data);
      const v = await apiClient.post(`/invoices/${invoiceId}/validate`); setValidation(v.data.validation);
      const a = await apiClient.get(`/audit/${invoiceId}`); setAudit(a.data);
    } catch (e) {
      showActionError("Fraud check", e);
    } finally { setRunningFraud(false); }
  }

  async function runAIAnalysis() {
    setRunningAI(true); setActionError(null);
    try {
      const res = await apiClient.post(`/invoices/${invoiceId}/ai-analyze`);
      setAiAnalysis(res.data);
      const auditRes = await apiClient.get(`/audit/${invoiceId}`);
      setAudit(auditRes.data);
    } catch (e) {
      showActionError("AI analysis", e);
    } finally { setRunningAI(false); }
  }

  async function deleteInvoice() {
    setDeleting(true);
    try {
      await apiClient.delete(`/invoices/${invoiceId}`);
      navigate("/dashboard/invoices");
    } catch(e) {
      alert(apiError(e, "Failed to delete invoice."));
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

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
  if (error||!invoice) return (
    <main className="flex min-h-screen bg-[var(--bg-base)]"><Sidebar expanded/>
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-rose-600">{error||"Invoice not found"}</p>
        <Link to="/dashboard/invoices" className="text-xs font-semibold text-indigo-600 hover:underline">← Back to invoices</Link>
      </div>
    </main>
  );

  const fc = fraud ? {critical:fraud.critical_count,high:fraud.high_count,medium:fraud.medium_count,low:fraud.low_count} : null;

  return (
    <>
    <main className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar expanded/>
      <div className="min-w-0 flex-1">

        {/* header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/invoices" className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-indigo-600 transition">
              <ChevronLeft size={15}/> Invoices
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-sm font-bold text-slate-800">
              Invoice #{invoiceId}
              {invoice.invoice_number && <span className="ml-2 font-normal text-slate-400">· {invoice.invoice_number}</span>}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge cls={STATUS_STYLE[invoice.status]||STATUS_STYLE.DRAFT}>{STATUS_LABEL[invoice.status]||invoice.status}</Badge>
            <button onClick={()=>{setRefreshing(true);loadAll();}} type="button"
              className={`grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 ${refreshing?"animate-spin":""}`}>
              <RefreshCw size={13}/>
            </button>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400">
              <Bell size={13}/>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition"
              >
                <Trash2 size={13}/> Delete
              </button>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-5 px-5 py-6 sm:px-8">

          {actionError && (
            <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              <span>{actionError}</span>
              <button type="button" onClick={()=>setActionError(null)} className="font-semibold hover:text-rose-900">Dismiss</button>
            </div>
          )}

          {/* ── Row 1: fields + risk ring ──────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-[1fr_200px]">

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><FileText size={14}/></div>
                  Extracted Invoice Data
                </h2>
                {invoice.status==="DOCUMENTS_UPLOADED" && (
                  <button onClick={runExtract} disabled={runningExtract} type="button"
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-600 hover:text-white disabled:opacity-50">
                    <FileSearch size={13}/>{runningExtract?"Extracting…":"Run Extraction"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <FieldTile label="Invoice Number" value={invoice.invoice_number}/>
                <FieldTile label="Vendor"         warn={!invoice.vendor_name} value={invoice.vendor_name &&
                  <Link to={`/dashboard/vendors/${invoice.vendor_id}`} className="hover:text-indigo-600 hover:underline">{invoice.vendor_name}</Link>}/>
                <FieldTile label="Invoice Date"   value={fmt(invoice.invoice_date)}/>
                <FieldTile label="Due Date"       value={fmt(invoice.due_date)}/>
                <FieldTile label="Subtotal"       value={fmtAmt(invoice.subtotal,invoice.currency)}/>
                <FieldTile label="Tax"            value={fmtAmt(invoice.tax,invoice.currency)}/>
                <FieldTile label="Total Amount"   value={fmtAmt(invoice.total_amount,invoice.currency)} warn={!invoice.total_amount}/>
                <FieldTile label="Currency"       value={invoice.currency} warn={!invoice.currency}/>
                <FieldTile label="Uploaded"       value={fmtTs(invoice.created_at)}/>
                <FieldTile label="Last Updated"   value={fmtTs(invoice.updated_at)}/>
              </div>
              {invoice.items?.length>0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold text-slate-500">Line Items ({invoice.items.length})</p>
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <tr>{["Description","Qty","Unit Price","Tax","Line Total"].map(c=><th key={c} className="px-3 py-2">{c}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {invoice.items.map((it,i)=>(
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 text-slate-700">{it.description||"—"}</td>
                            <td className="px-3 py-2.5 text-slate-500">{it.quantity??"-"}</td>
                            <td className="px-3 py-2.5 text-slate-500">{fmtAmt(it.unit_price,invoice.currency)}</td>
                            <td className="px-3 py-2.5 text-slate-500">{fmtAmt(it.tax,invoice.currency)}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-800">{fmtAmt(it.line_total,invoice.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* Risk ring */}
            <section className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="self-start text-sm font-semibold text-slate-900">Risk Score</h2>
              {fraud ? (
                <>
                  <RiskRing score={fraud.risk_score} level={fraud.risk_level}/>
                  <div className="w-full space-y-2 border-t border-slate-100 pt-3">
                    {[["Critical",fc.critical,"text-rose-600"],["High",fc.high,"text-orange-500"],["Medium",fc.medium,"text-amber-500"],["Low",fc.low,"text-emerald-600"]].map(([l,v,c])=>(
                      <div key={l} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{l}</span>
                        <span className={`font-bold ${c}`}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={runFraudCheck} disabled={runningFraud} type="button"
                    className="w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50">
                    {runningFraud?"Running…":"Re-run Check"}
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-50 text-slate-300"><ShieldAlert size={26}/></div>
                  <p className="text-xs text-slate-400">Not analyzed yet</p>
                  <button onClick={runFraudCheck} disabled={runningFraud} type="button"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition">
                    {runningFraud ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Running…
                      </span>
                    ) : "Run Fraud Check"}
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* ── Row 2: fraud flags + validation ───────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-orange-50 text-orange-500"><ShieldAlert size={14}/></div>
                Fraud Flags
                {fraud && <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">{fraud.fraud_flags?.length||0}</span>}
              </h2>
              {fraud ? <FraudFlags flags={fraud.fraud_flags}/> : (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-300"><ShieldAlert size={22}/></div>
                  <p className="mt-3 text-xs text-slate-400">Run fraud detection to see results</p>
                </div>
              )}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet-50 text-violet-600"><CheckCircle2 size={14}/></div>
                Validation
              </h2>
              <Validation result={validation}/>
            </section>
          </div>

          {/* ── AI Analysis panel ───────────────────────────────────────── */}
          <section className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <BrainCircuit size={15} className="text-indigo-500" />
                AI Fraud Analysis
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                  LangGraph · 7 Agents
                </span>
              </h2>
              <div className="flex items-center gap-2">
                {!fraud && (
                  <button onClick={runFraudCheck} disabled={runningFraud} type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600 hover:bg-orange-100 disabled:opacity-50 transition">
                    {runningFraud ? "Running…" : "① Run Fraud Check First"}
                  </button>
                )}
                <button
                  onClick={runAIAnalysis}
                  disabled={runningAI}
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                >
                  {runningAI ? "Analyzing… (may take 30s)" : aiAnalysis ? "Re-run AI Analysis" : "② Run AI Analysis"}
                </button>
              </div>
            </div>

            {runningAI && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-indigo-100 bg-white px-4 py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                <div>
                  <p className="text-xs font-semibold text-indigo-700">Running 7-agent analysis pipeline…</p>
                  <p className="text-[11px] text-slate-400">Invoice Analyzer → Duplicate Check → Vendor Analysis → Historical → RAG Evidence → Risk Assessment → Explanation</p>
                </div>
              </div>
            )}

            {!runningAI && !aiAnalysis && (
              <div className="mt-4 flex flex-col items-center py-6 text-center">
                <BrainCircuit size={28} className="text-indigo-200" />
                <p className="mt-2 text-sm font-semibold text-slate-500">AI analysis not run yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Click "Run AI Analysis" to get LangGraph multi-agent risk assessment with RAG evidence
                </p>
              </div>
            )}

            {!runningAI && aiAnalysis && (
              <div className="mt-4 space-y-4">
                {/* Score comparison */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Deterministic Score", val: aiAnalysis.risk_score_deterministic, color: "slate" },
                    { label: "AI Score",             val: aiAnalysis.risk_score_ai,            color: "indigo" },
                    { label: "Final Score",          val: aiAnalysis.risk_score_final,          color: aiAnalysis.risk_level === "CRITICAL" ? "rose" : aiAnalysis.risk_level === "HIGH" ? "orange" : aiAnalysis.risk_level === "MEDIUM" ? "amber" : "green" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="rounded-lg border border-slate-100 bg-white p-3 text-center">
                      <p className={`text-xl font-bold ${color === "rose" ? "text-rose-600" : color === "orange" ? "text-orange-500" : color === "amber" ? "text-amber-500" : color === "indigo" ? "text-indigo-600" : "text-green-600"}`}>
                        {val != null ? val.toFixed(1) : "—"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Risk level */}
                {aiAnalysis.risk_level && (
                  <div className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${
                    aiAnalysis.risk_level === "CRITICAL" ? "border-rose-200 bg-rose-50" :
                    aiAnalysis.risk_level === "HIGH" ? "border-orange-200 bg-orange-50" :
                    aiAnalysis.risk_level === "MEDIUM" ? "border-amber-200 bg-amber-50" :
                    "border-green-200 bg-green-50"
                  }`}>
                    <ShieldAlert size={14} className={
                      aiAnalysis.risk_level === "CRITICAL" ? "text-rose-600" :
                      aiAnalysis.risk_level === "HIGH" ? "text-orange-500" :
                      aiAnalysis.risk_level === "MEDIUM" ? "text-amber-500" : "text-green-600"
                    } />
                    <span className="text-xs font-bold text-slate-700">
                      Final Risk Level: {aiAnalysis.risk_level}
                    </span>
                    <span className="ml-auto text-[11px] text-slate-400">
                      {aiAnalysis.risk_score_ai==null
                        ? "AI model unavailable — deterministic score used"
                        : "60% deterministic + 40% AI weighted"}
                    </span>
                  </div>
                )}

                {/* AI Explanation */}
                {aiAnalysis.ai_explanation && (
                  <div className="rounded-lg border border-indigo-100 bg-white p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                      AI-Generated Analysis
                    </p>
                    <p className="text-xs leading-5 text-slate-600">{aiAnalysis.ai_explanation}</p>
                    <p className="mt-2 text-[10px] text-slate-400 italic">
                      This analysis supports human review. The final decision rests with the reviewer.
                    </p>
                  </div>
                )}

                {/* Evidence used */}
                {aiAnalysis.evidence_used && aiAnalysis.evidence_used.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Policies cited ({aiAnalysis.evidence_used.length} passages)
                    </p>
                    <div className="space-y-1.5">
                      {aiAnalysis.evidence_used.map((e, i) => (
                        <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                          <p className="flex flex-wrap items-center gap-x-2 text-[10px] font-semibold text-indigo-500">
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono-num">{e.ref || `P${i + 1}`}</span>
                            {e.document_name}
                            {e.matched && (
                              <span className="font-normal text-slate-400">
                                for {e.matched.replace(/^[A-Z]+: /, "").replace(/_/g, " ").toLowerCase()}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500 line-clamp-3">{e.chunk_text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-right text-[11px] text-slate-400">
                  Analyzed: {new Date(aiAnalysis.analyzed_at).toLocaleString("en-IN")}
                </p>
              </div>
            )}
          </section>

          {/* ── Bottom row: Human Review + Audit timeline ────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><User size={14}/></div>
                Human Review
              </h2>
              <ReviewForm invoiceId={invoiceId} existingReview={review} onReviewed={loadAll}/>            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Activity size={14}/></div>
                Audit Trail
                <Link to="/dashboard/audit" className="ml-auto text-[11px] font-semibold text-indigo-600 hover:underline">Full log →</Link>
              </h2>
              <div className="max-h-72 overflow-y-auto pr-1">
                <Timeline logs={audit}/>
              </div>
            </section>
          </div>

        </div>
      </div>
    </main>

    {/* ── Delete Confirm Modal ───────────────────────────────────────────── */}
    {showDeleteModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
            <Trash2 size={22}/>
          </div>
          <h3 className="text-base font-bold text-slate-900">Delete Invoice #{invoiceId}?</h3>
          <p className="mt-1.5 text-sm text-slate-500">
            This will permanently delete this invoice and its uploaded file. This action cannot be undone.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={deleteInvoice}
              disabled={deleting}
              className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 transition"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
