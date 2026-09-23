import { AlertTriangle, Bell, Download, Search, ShieldAlert } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Sidebar from "../../Sidebar/Sidebar";

const invoiceFields = ["Vendor", "Invoice #", "Date", "Amount", "Tax", "PO Number"];
const anomalyTypes = ["Duplicate Invoice Number", "Vendor Information Mismatch", "Unusual Invoice Amount", "Bank Account Change"];

function InvoiceDetail() {
  const { invoiceId } = useParams();

  return (
    <main className="flex min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        <header className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8"><h1 className="text-base font-semibold">Invoice Analysis</h1><div className="flex items-center gap-5 text-slate-400"><Search size={18} /><Bell size={18} /></div></header>
        <section className="mx-auto max-w-5xl px-5 py-6 sm:px-8 lg:py-7">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-sm text-indigo-700"><strong>Invoice {invoiceId || "details"}</strong> is ready for backend analysis. Analysis values will appear here after the invoice service responds.</div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold">Extracted Invoice Information</h2><div className="mt-4 grid grid-cols-2 gap-2">{invoiceFields.map((field) => <div className="rounded-lg bg-slate-50 p-3" key={field}><p className="text-[11px] text-slate-400">{field}</p><p className="mt-1 text-xs font-medium text-slate-400">Pending backend data</p></div>)}</div></section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-500 text-white"><ShieldAlert size={14} /></span>AI Analysis</h2><div className="mt-5 flex min-h-44 flex-col items-center justify-center text-center"><ShieldAlert className="text-slate-300" size={28} /><p className="mt-3 text-sm font-semibold text-slate-600">Analysis not available yet</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">Risk assessment and explanation will be displayed here when the backend returns the analysis.</p></div></section>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3"><div className="rounded-xl border border-slate-200 bg-white p-4 text-center"><strong className="text-lg text-slate-400">--</strong><p className="text-xs text-slate-400">Risk Score</p></div><div className="rounded-xl border border-slate-200 bg-white p-4 text-center"><strong className="text-lg text-slate-400">--</strong><p className="text-xs text-slate-400">Anomalies</p></div><div className="rounded-xl border border-slate-200 bg-white p-4 text-center"><strong className="text-lg text-slate-400">--</strong><p className="text-xs text-slate-400">Confidence</p></div></div>
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold">Fraud Detection Findings</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{anomalyTypes.map((type) => <article className="rounded-lg border border-slate-200 bg-slate-50/60 p-3" key={type}><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-300" /><h3 className="text-xs font-semibold text-slate-500">{type}</h3></div><p className="mt-2 text-xs text-slate-400">Awaiting backend analysis</p></article>)}</div></section>
          <div className="mt-4 flex justify-end gap-2"><Link className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600" to="/dashboard/invoices">Back to Invoices</Link><button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-400" disabled type="button"><Download size={14} />Download Report</button><button className="flex items-center gap-2 rounded-lg bg-slate-300 px-4 py-2 text-xs font-semibold text-white" disabled type="button"><AlertTriangle size={14} />Flag Invoice</button></div>
        </section>
      </div>
    </main>
  );
}

export default InvoiceDetail;
