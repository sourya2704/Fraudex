import { AlertTriangle, ArrowRight, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Sidebar from "../../Sidebar/Sidebar";

const RISK_STYLE = {
  LOW:      "border-emerald-200 bg-emerald-50 text-emerald-700",
  MEDIUM:   "border-amber-200 bg-amber-50 text-amber-700",
  HIGH:     "border-orange-200 bg-orange-50 text-orange-700",
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function InvoiceProcessing({ fileName, invoice, validation, fraud, onUploadAnother }) {
  const valid     = validation?.validation?.valid;
  const errors    = validation?.validation?.error_count   || 0;
  const warnings  = validation?.validation?.warning_count || 0;
  const issues    = validation?.validation?.issues        || [];

  return (
    <main className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar expanded/>
      <div className="min-w-0 flex-1">

        <header className="sticky top-0 z-10 flex h-16 items-center border-b border-slate-200 bg-white px-6 sm:px-8">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Invoice Processing</h1>
        </header>

        <div className="mx-auto max-w-2xl px-5 py-12 sm:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">

            {/* icon */}
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-indigo-600 text-white">
              <ShieldCheck size={30} strokeWidth={1.8}/>
            </div>

            <h2 className="mt-5 text-xl font-bold text-slate-900">Analysis Complete</h2>
            <p className="mt-2 text-sm text-slate-400">Your invoice was extracted, validated and checked for fraud.</p>

            {/* file name */}
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <FileText size={17}/>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Selected file</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-700">{fileName}</p>
              </div>
            </div>

            {/* status chip */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-emerald-600">
              <CheckCircle2 size={14}/>
              Processed invoice #{invoice?.id||"—"} · {invoice?.status||"DOCUMENTS_UPLOADED"}
            </div>

            {/* extracted fields grid */}
            {invoice && (
              <div className="mt-5 grid grid-cols-2 gap-2.5 text-left sm:grid-cols-4">
                {[
                  ["Invoice No.", invoice.invoice_number||"Not found"],
                  ["Date",        invoice.invoice_date   ||"Not found"],
                  ["Subtotal",    invoice.subtotal!=null  ? `${invoice.currency||""} ${invoice.subtotal}`.trim() : "Not found"],
                  ["Total",       invoice.total_amount!=null ? `${invoice.currency||""} ${invoice.total_amount}`.trim() : "Not found"],
                ].map(([l,v])=>(
                  <div key={l} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{l}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-700 truncate">{v}</p>
                  </div>
                ))}
              </div>
            )}

            {/* validation result */}
            {validation && (
              <div className={`mt-5 rounded-xl border px-5 py-4 text-left ${valid?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2">
                  {valid
                    ? <CheckCircle2 size={15} className="text-emerald-600"/>
                    : <AlertTriangle size={15} className="text-amber-600"/>}
                  <p className={`text-sm font-semibold ${valid?"text-emerald-700":"text-amber-700"}`}>
                    {valid?"Validation passed":"Review needed"}
                  </p>
                </div>
                <p className={`mt-1 text-xs ${valid?"text-emerald-600":"text-amber-600"}`}>
                  {errors} error{errors!==1?"s":""} · {warnings} warning{warnings!==1?"s":""}
                </p>
                {issues.length>0 && (
                  <ul className="mt-3 space-y-1.5">
                    {issues.slice(0,3).map((iss,i)=>(
                      <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"/>
                        {iss.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* fraud result */}
            {fraud && (
              <div className={`mt-4 rounded-xl border px-5 py-4 text-left ${RISK_STYLE[fraud.risk_level]||RISK_STYLE.LOW}`}>
                <p className="text-sm font-semibold">
                  Fraud risk: {fraud.risk_level} · {Number(fraud.risk_score).toFixed(1)} / 100
                </p>
                {fraud.fraud_flags?.length>0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {fraud.fraud_flags.slice(0,3).map((f,i)=>(
                      <li key={i} className="text-xs">{f.severity}: {f.message}</li>
                    ))}
                  </ul>
                ) : <p className="mt-1 text-xs">No fraud signals detected.</p>}
              </div>
            )}

            {/* actions */}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {invoice && (
                <Link to={`/dashboard/invoices/${invoice.id}`}
                  className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
                  View Full Analysis <ArrowRight size={15}/>
                </Link>
              )}
              {/* Same route, so a Link would not reset the page: reset state instead. */}
              <button type="button" onClick={onUploadAnother}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600">
                Upload Another
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
