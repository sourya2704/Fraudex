import { Bell, CheckCircle2, FileText, Search, UploadCloud, X, Zap } from "lucide-react";
import { useRef, useState } from "react";
import Sidebar from "../../Sidebar/Sidebar";
import InvoiceProcessing from "./InvoiceProcessing";
import apiClient from "../../../api/client";

const STEPS = [
  { n:"1", title:"Upload File",        desc:"PDF or image invoice" },
  { n:"2", title:"Extract Data",       desc:"AI reads fields automatically" },
  { n:"3", title:"Validate",           desc:"Cross-check consistency" },
  { n:"4", title:"Detect Fraud",       desc:"Flag anomalies & patterns" },
  { n:"5", title:"Risk Score",         desc:"Get an explainable report" },
];

export default function UploadInvoice() {
  const [file,       setFile]       = useState(null);
  const [error,      setError]      = useState("");
  const [screen,     setScreen]     = useState("upload");
  const [uploading,  setUploading]  = useState(false);
  const [invoice,    setInvoice]    = useState(null);
  const [validation, setValidation] = useState(null);
  const [dragOver,   setDragOver]   = useState(false);
  const inputRef = useRef(null);

  function pick(f) {
    if (!f) return;
    if (!["application/pdf","image/jpeg","image/png"].includes(f.type)) {
      setFile(null); setError("Please choose a PDF, JPG, or PNG file."); return;
    }
    if (f.size > 10*1024*1024) { setFile(null); setError("File must be 10 MB or less."); return; }
    setFile(f); setError("");
  }

  async function analyze() {
    if (!file||uploading) return;
    setError(""); setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data: inv } = await apiClient.post("/invoices/upload", fd, { headers:{"Content-Type":"multipart/form-data"} });
      const { data: extracted } = await apiClient.post(`/invoices/${inv.id}/extract`);
      const { data: val }       = await apiClient.post(`/invoices/${inv.id}/validate`);
      setInvoice(extracted); setValidation(val); setScreen("processing");
    } catch(e) {
      setError(e.response?.data?.detail||"Upload failed. Check your connection and try again.");
    } finally { setUploading(false); }
  }

  if (screen==="processing") return (
    <InvoiceProcessing fileName={file?.name||"invoice.pdf"} invoice={invoice} validation={validation}/>
  );

  return (
    <main className="flex min-h-screen bg-[#f5f6fb]">
      <Sidebar expanded/>
      <div className="min-w-0 flex-1">

        {/* header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">Invoice workspace</p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Upload Invoice</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700"><Search size={15}/></button>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700"><Bell size={15}/></button>
          </div>
        </header>

        <div className="mx-auto max-w-3xl space-y-5 px-5 py-7 sm:px-8">

          {/* Drop zone */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Upload your invoice</h2>
            <p className="mt-1 text-sm text-slate-400">Drag &amp; drop or browse — PDF, JPG, PNG · Max 10 MB</p>

            <div
              onClick={()=>inputRef.current?.click()}
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);pick(e.dataTransfer.files?.[0]);}}
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
                  <p className="max-w-xs truncate text-sm font-semibold text-slate-800">{file.name}</p>
                  <p className="text-xs text-emerald-600">Ready · {(file.size/1024/1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className={`grid h-14 w-14 place-items-center rounded-2xl transition-colors ${dragOver?"bg-indigo-100 text-indigo-600":"bg-indigo-50 text-indigo-400"}`}>
                    <UploadCloud size={28} strokeWidth={1.6}/>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Drop your file here, or <span className="text-indigo-600">browse</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Supported: PDF, JPG, PNG · Max 10 MB</p>
                  </div>
                </div>
              )}
            </div>

            <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png"
              className="hidden" onChange={e=>pick(e.target.files?.[0])}/>

            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={()=>inputRef.current?.click()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600">
                {file?"Replace File":"Browse Files"}
              </button>
              {file && (
                <button type="button" onClick={()=>setFile(null)}
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

          {/* How it works */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <Zap size={15} className="text-indigo-500"/>
              <h2 className="text-sm font-semibold text-slate-900">How Fraudex works</h2>
            </div>
            <div className="relative flex items-start gap-0 overflow-x-auto pb-2">
              <div className="absolute left-[28px] right-[28px] top-3.5 h-px bg-gradient-to-r from-indigo-200 via-violet-200 to-indigo-200"/>
              {STEPS.map((s,i)=>(
                <div key={s.n} className="relative z-10 flex min-w-[110px] flex-1 flex-col items-center text-center">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-lg shadow-indigo-500/25">
                    {s.n}
                  </div>
                  <p className="mt-3 px-1 text-xs font-semibold text-slate-800">{s.title}</p>
                  <p className="mt-1 px-1 text-[11px] leading-4 text-slate-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Analyze button */}
          <div className="flex justify-end">
            <button onClick={analyze} disabled={!file||uploading} type="button"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition enabled:hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50">
              <CheckCircle2 size={16}/>
              {uploading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Analyzing…
                </span>
              ) : "Analyze Invoice"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
