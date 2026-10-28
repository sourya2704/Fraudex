import { CheckCircle2, ChevronRight, FileText, UploadCloud, X, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import Sidebar from "../../Sidebar/Sidebar";
import InvoiceProcessing from "./InvoiceProcessing";
import apiClient, { apiError } from "../../../api/client";
import NotificationBell from "../../../components/NotificationBell";

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILES = 50;
const RISK_STYLE = {
  LOW: "text-emerald-600", MEDIUM: "text-amber-600", HIGH: "text-orange-600", CRITICAL: "text-rose-600",
};

/** Upload one file and run it through the whole pipeline. */
async function processInvoice(file, onStep) {
  onStep("Uploading");
  const fd = new FormData(); fd.append("file", file);
  const { data: inv } = await apiClient.post("/invoices/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
  onStep("Extracting");
  const { data: extracted } = await apiClient.post(`/invoices/${inv.id}/extract`);
  onStep("Validating");
  const { data: val } = await apiClient.post(`/invoices/${inv.id}/validate`);
  onStep("Checking for fraud");
  // A failed fraud check should not hide the extraction result.
  const fraudRes = await apiClient.post(`/invoices/${inv.id}/detect-fraud`).catch(() => null);
  return { extracted, val, fraud: fraudRes?.data || null };
}

const STEPS = [
  { n:"1", title:"Upload File",        desc:"PDF or image invoice" },
  { n:"2", title:"Extract Data",       desc:"AI reads fields automatically" },
  { n:"3", title:"Validate",           desc:"Cross-check consistency" },
  { n:"4", title:"Detect Fraud",       desc:"Flag anomalies & patterns" },
  { n:"5", title:"Risk Score",         desc:"Get an explainable report" },
];

export default function UploadInvoice() {
  const [files,      setFiles]      = useState([]);
  const [error,      setError]      = useState("");
  const [screen,     setScreen]     = useState("upload");
  const [uploading,  setUploading]  = useState(false);
  const [uploadStep, setUploadStep] = useState(""); // current step message
  const [invoice,    setInvoice]    = useState(null);
  const [validation, setValidation] = useState(null);
  const [fraud,      setFraud]      = useState(null);
  const [dragOver,   setDragOver]   = useState(false);
  const [bulk,       setBulk]       = useState(null); // [{name, state, step, id, risk, score, error}]
  const inputRef = useRef(null);
  const file = files[0] || null;

  function pick(list) {
    const chosen = Array.from(list || []);
    if (!chosen.length) return;
    const bad = chosen.filter(f => !ACCEPTED.includes(f.type) || f.size > 10*1024*1024);
    const good = chosen.filter(f => !bad.includes(f)).slice(0, MAX_FILES);
    setBulk(null);
    setFiles(good);
    if (bad.length) {
      setError(`${bad.length} file${bad.length > 1 ? "s" : ""} skipped: only PDF, JPG or PNG up to 10 MB.`);
    } else if (chosen.length > MAX_FILES) {
      setError(`Only the first ${MAX_FILES} files were kept.`);
    } else {
      setError("");
    }
  }

  async function analyze() {
    if (!files.length||uploading) return;
    if (files.length > 1) return analyzeMany();
    setError(""); setUploading(true);
    try {
      const steps = { Uploading: "Uploading file…", Extracting: "Extracting text from invoice…",
                      Validating: "Validating fields…", "Checking for fraud": "Checking for fraud…" };
      const r = await processInvoice(file, step => setUploadStep(steps[step]));
      setInvoice(r.extracted); setValidation(r.val); setFraud(r.fraud); setScreen("processing");
    } catch(e) {
      setError(apiError(e, "Upload failed. Check your connection and try again."));
    } finally { setUploading(false); setUploadStep(""); }
  }

  // Several files: one after another, so the server and the list stay calm.
  async function analyzeMany() {
    setError(""); setUploading(true);
    const rows = files.map(f => ({ name: f.name, state: "queued" }));
    setBulk([...rows]);
    const update = (i, patch) => { rows[i] = { ...rows[i], ...patch }; setBulk([...rows]); };
    for (let i = 0; i < files.length; i++) {
      update(i, { state: "working", step: "Uploading" });
      try {
        const r = await processInvoice(files[i], step => update(i, { step }));
        update(i, { state: "done", id: r.extracted.id, number: r.extracted.invoice_number,
                    vendor: r.extracted.vendor_name, risk: r.fraud?.risk_level, score: r.fraud?.risk_score });
      } catch (e) {
        update(i, { state: "failed", error: apiError(e, "Failed") });
      }
    }
    setUploading(false);
  }

  function reset() {
    setFiles([]); setError(""); setInvoice(null); setValidation(null); setFraud(null); setBulk(null);
    setScreen("upload");
    if (inputRef.current) inputRef.current.value = "";
  }

  if (screen==="processing") return (
    <InvoiceProcessing fileName={file?.name||"invoice.pdf"} invoice={invoice} validation={validation}
      fraud={fraud} onUploadAnother={reset}/>
  );

  return (
    <main className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar expanded/>
      <div className="min-w-0 flex-1">

        {/* header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">Invoice workspace</p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Upload Invoice</h1>
          </div>
          <NotificationBell />
        </header>

        <div className="mx-auto max-w-3xl space-y-5 px-5 py-7 sm:px-8">

          {/* Drop zone */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Upload invoices</h2>
            <p className="mt-1 text-sm text-slate-400">Drag &amp; drop or browse — one file or up to {MAX_FILES} at once · PDF, JPG, PNG · Max 10 MB each</p>

            <div
              onClick={()=>inputRef.current?.click()}
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);pick(e.dataTransfer.files);}}
              onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")inputRef.current?.click();}}
              role="button" tabIndex={0}
              className={`mt-5 flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 ${
                dragOver  ? "border-indigo-400 bg-indigo-50/60 scale-[1.01]" :
                file      ? "border-emerald-300 bg-emerald-50/40" :
                             "border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/30"
              }`}
            >
              {file ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <FileText size={26}/>
                  </div>
                  {files.length === 1 ? (
                    <>
                      <p className="max-w-xs truncate text-sm font-semibold text-slate-800">{file.name}</p>
                      <p className="text-xs text-emerald-600">Ready · {(file.size/1024/1024).toFixed(2)} MB</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-slate-800">{files.length} invoices selected</p>
                      <p className="text-xs text-emerald-600">
                        Ready · {(files.reduce((n, f) => n + f.size, 0)/1024/1024).toFixed(2)} MB in total
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className={`grid h-14 w-14 place-items-center rounded-2xl transition-colors ${dragOver?"bg-indigo-100 text-indigo-600":"bg-indigo-50 text-indigo-400"}`}>
                    <UploadCloud size={28} strokeWidth={1.6}/>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Drop invoices here, or <span className="text-indigo-600">browse</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Supported: PDF, JPG, PNG · Max 10 MB</p>
                  </div>
                </div>
              )}
            </div>

            <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png"
              className="hidden" multiple onChange={e=>pick(e.target.files)}/>

            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={()=>inputRef.current?.click()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600">
                {file?"Replace Files":"Browse Files"}
              </button>
              {file && (
                <button type="button" onClick={reset}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-400 hover:border-rose-200 hover:text-rose-500 transition">
                  <X size={14}/>
                </button>
              )}
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-600">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500"/>
                {error}
              </div>
            )}
          </div>

          {/* Bulk results */}
          {bulk && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm" data-no-tilt>
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  {uploading ? "Processing" : "Processed"} {bulk.filter(r => r.state === "done" || r.state === "failed").length} of {bulk.length}
                </h2>
                <p className="text-xs text-slate-400">
                  {bulk.filter(r => r.risk === "HIGH" || r.risk === "CRITICAL").length} high risk ·{" "}
                  {bulk.filter(r => r.state === "failed").length} failed
                </p>
              </div>
              <ul className="divide-y divide-slate-100">
                {bulk.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 px-6 py-3 text-sm">
                    <FileText size={15} className="shrink-0 text-slate-400"/>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{r.name}</p>
                      <p className="truncate text-xs text-slate-400">
                        {r.state === "queued" && "Waiting"}
                        {r.state === "working" && `${r.step}…`}
                        {r.state === "done" && [r.number, r.vendor].filter(Boolean).join(" · ")}
                        {r.state === "failed" && <span className="text-rose-500">{r.error}</span>}
                      </p>
                    </div>
                    {r.state === "done" && (
                      <>
                        <span className={`text-xs font-bold ${RISK_STYLE[r.risk] || "text-slate-400"}`}>
                          {r.risk ? `${r.risk} · ${Number(r.score).toFixed(0)}` : "Not checked"}
                        </span>
                        <Link to={`/dashboard/invoices/${r.id}`} className="flex items-center text-xs font-semibold text-indigo-600">
                          View <ChevronRight size={13}/>
                        </Link>
                      </>
                    )}
                    {r.state === "working" && (
                      <svg className="h-4 w-4 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* How it works */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <Zap size={15} className="text-indigo-500"/>
              <h2 className="text-sm font-semibold text-slate-900">How Fraudex works</h2>
            </div>
            <div className="relative flex items-start gap-0 overflow-x-auto pb-2">
              <div className="absolute left-[28px] right-[28px] top-3.5 h-px bg-slate-200"/>
              {STEPS.map((s,i)=>(
                <div key={s.n} className="relative z-10 flex min-w-[110px] flex-1 flex-col items-center text-center">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {s.n}
                  </div>
                  <p className="mt-3 px-1 text-xs font-semibold text-slate-800">{s.title}</p>
                  <p className="mt-1 px-1 text-[11px] leading-4 text-slate-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Analyze button */}
          <div className="flex items-center justify-between">
            {uploading && uploadStep && (
              <p className="flex items-center gap-2 text-xs text-indigo-600 font-medium">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {uploadStep}
              </p>
            )}
            <div className="ml-auto">
              <button onClick={bulk && !uploading ? reset : analyze} disabled={!file||uploading} type="button"
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition enabled:hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm shadow-indigo-500/25">
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Analyzing…
                  </span>
                ) : bulk && !uploading ? (
                  <><CheckCircle2 size={16}/> Done</>
                ) : (
                  <><CheckCircle2 size={16}/> {files.length > 1 ? `Analyze ${files.length} Invoices` : "Analyze Invoice"}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
