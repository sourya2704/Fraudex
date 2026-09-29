import { Bell, CheckCircle2, Clock3, Search } from "lucide-react";
import Sidebar from "../../Sidebar/Sidebar";

function InvoiceProcessing({ fileName, invoice, validation }) {
  return (
    <main className="flex min-h-screen bg-[#f4f5f0] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        <header className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <h1 className="text-base font-semibold text-slate-900">Invoice processing</h1>
          <div className="flex items-center gap-5 text-slate-400"><Search size={18} /><Bell size={18} /></div>
        </header>
        <section className="mx-auto max-w-2xl px-5 py-8 sm:px-8 lg:py-12">
          <section className="rounded-xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-50 text-indigo-600"><Clock3 size={27} /></span>
            <h2 className="mt-5 text-xl font-bold text-slate-900">Invoice analysis complete</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Your file was extracted and checked for data consistency.</p>
            <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-left"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Selected file</p><p className="mt-1 truncate text-sm font-semibold text-slate-700">{fileName}</p></div>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-emerald-600"><CheckCircle2 size={16} />Processed invoice #{invoice?.id || "pending"} · {invoice?.status || "DOCUMENTS_UPLOADED"}</div>
            {invoice && (
              <div className="mt-5 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-400">Invoice no.</p><p className="mt-1 truncate text-xs font-semibold text-slate-700">{invoice.invoice_number || "Not found"}</p></div>
                <div className="rounded-lg border border-slate-200 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-400">Date</p><p className="mt-1 text-xs font-semibold text-slate-700">{invoice.invoice_date || "Not found"}</p></div>
                <div className="rounded-lg border border-slate-200 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-400">Subtotal</p><p className="mt-1 text-xs font-semibold text-slate-700">{invoice.subtotal ?? "Not found"}</p></div>
                <div className="rounded-lg border border-slate-200 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-400">Total</p><p className="mt-1 text-xs font-semibold text-slate-700">{invoice.total_amount ? `${invoice.currency || ""} ${invoice.total_amount}` : "Not found"}</p></div>
              </div>
            )}
            {validation && (
              <div className={`mt-5 rounded-lg px-4 py-3 text-left text-xs ${validation.validation?.valid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                <p className="font-semibold">{validation.validation?.valid ? "Validation passed" : "Review needed"}</p>
                <p className="mt-1">{validation.validation?.error_count || 0} errors · {validation.validation?.warning_count || 0} warnings</p>
                {validation.validation?.issues?.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {validation.validation.issues.slice(0, 3).map((issue) => <li key={`${issue.code}-${issue.field}`}>{issue.message}</li>)}
                  </ul>
                )}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

export default InvoiceProcessing;
