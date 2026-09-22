import { ArrowLeft, FileUp, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

function UploadInvoice() {
  return (
    <main className="min-h-screen bg-[#f5f7fb] px-5 py-6 text-slate-900 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600" to="/dashboard">
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        <div className="mt-8">
          <p className="text-sm font-medium text-indigo-600">Invoice intake</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Upload invoice</h1>
          <p className="mt-2 text-sm text-slate-500">Prepare an invoice for review in your Fraudex workspace.</p>
        </div>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40 sm:p-8">
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 px-6 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <FileUp size={26} />
            </span>
            <span className="mt-5 text-base font-semibold text-slate-800">Drop your invoice here</span>
            <span className="mt-2 text-sm text-slate-500">Invoice preview area</span>
            <span className="mt-4 text-xs text-slate-400">PDF, PNG, or JPG up to 10 MB</span>
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <ShieldCheck className="mt-0.5 shrink-0" size={17} />
            <p>Your invoice is encrypted and checked securely before processing.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default UploadInvoice;
