import { Bell, CheckCircle2, Clock3, Search } from "lucide-react";
import Sidebar from "../../Sidebar/Sidebar";

function InvoiceProcessing({ fileName }) {
  return (
    <main className="flex min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        <header className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <h1 className="text-base font-semibold text-slate-900">Invoice processing</h1>
          <div className="flex items-center gap-5 text-slate-400"><Search size={18} /><Bell size={18} /></div>
        </header>
        <section className="mx-auto max-w-2xl px-5 py-8 sm:px-8 lg:py-12">
          <section className="rounded-xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-50 text-indigo-600"><Clock3 size={27} /></span>
            <h2 className="mt-5 text-xl font-bold text-slate-900">Invoice uploaded</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Your file is ready. Fraud analysis will appear here once the backend processing service is connected.</p>
            <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-left"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Selected file</p><p className="mt-1 truncate text-sm font-semibold text-slate-700">{fileName}</p></div>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-emerald-600"><CheckCircle2 size={16} />File accepted locally</div>
          </section>
        </section>
      </div>
    </main>
  );
}

export default InvoiceProcessing;
