import { useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  FileText,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import Sidebar from "../../Sidebar/Sidebar";
import InvoiceProcessing from "./InvoiceProcessing";

const workflowSteps = [
  {
    number: "1",
    title: "Upload Invoice",
    description: "Upload your PDF or image invoice file",
  },
  {
    number: "2",
    title: "Extract Invoice Data",
    description: "AI extracts vendor, amount, and dates",
  },
  {
    number: "3",
    title: "Validate Information",
    description: "Cross-reference with known records",
  },
  {
    number: "4",
    title: "Analyze Fraud Patterns",
    description: "Detect anomalies and flag duplicates",
  },
  {
    number: "5",
    title: "Generate Risk Score",
    description: "Produce a detailed fraud risk report",
  },
];

function UploadInvoice() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [screen, setScreen] = useState("upload");
  const fileInputRef = useRef(null);

  function selectFile(file) {
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    const maxFileSize = 25 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      setSelectedFile(null);
      setUploadError("Please choose a PDF, JPG, or PNG file.");
      return;
    }

    if (file.size > maxFileSize) {
      setSelectedFile(null);
      setUploadError("File size must be 25 MB or less.");
      return;
    }

    setSelectedFile(file);
    setUploadError("");
  }

  function handleFileChange(event) {
    selectFile(event.target.files?.[0]);
  }

  function handleDrop(event) {
    event.preventDefault();
    selectFile(event.dataTransfer.files?.[0]);
  }

  function formatFileSize(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (screen === "processing") {
    return <InvoiceProcessing fileName={selectedFile?.name || "invoice.pdf"} />;
  }

  return (
    <main className="flex min-h-screen bg-[#f5f7fb] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        <header className="flex flex-col gap-5 border-b border-slate-200 px-5 pb-6 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div>
            <p className="text-sm font-medium text-indigo-600">
              Invoice workspace
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Upload invoice
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Add an invoice to begin your Fraudex review.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
              title="Search"
              type="button"
            >
              <Search size={18} />
            </button>
            <button
              className="relative grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
              title="Notifications"
              type="button"
            >
              <Bell size={18} />
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-4xl px-5 py-7 sm:px-8 lg:px-10 lg:py-8">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40 sm:p-7">
            <h2 className="text-base font-semibold text-slate-900">
              Upload your invoice
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Drag &amp; drop your invoice here or browse your files
            </p>
            <div
              className={`mt-5 flex min-h-[182px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 text-center transition-colors ${selectedFile ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20"}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ")
                  fileInputRef.current?.click();
              }}
            >
              {selectedFile ? (
                <>
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                    <FileText size={23} />
                  </span>
                  <p className="mt-4 max-w-full truncate text-sm font-semibold text-slate-800">
                    {selectedFile.name}
                  </p>
                  <p className="mt-1 text-xs text-emerald-600">
                    Ready to upload · {formatFileSize(selectedFile.size)}
                  </p>
                </>
              ) : (
                <>
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-indigo-50 text-indigo-500">
                    <UploadCloud size={25} strokeWidth={1.8} />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-slate-800">
                    Drop your file here, or{" "}
                    <span className="text-indigo-600">browse</span>
                  </p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Supported formats: PDF, JPG, PNG · Max file size: 25 MB
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={handleFileChange}
            />
            {uploadError && (
              <p className="mt-3 text-center text-xs font-medium text-rose-600">
                {uploadError}
              </p>
            )}
            <div className="mt-4 flex justify-center">
              <button
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-600"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {selectedFile ? "Replace File" : "Browse Files"}
              </button>
              {selectedFile && (
                <button
                  className="ml-2 grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-rose-500"
                  onClick={() => setSelectedFile(null)}
                  title="Remove selected file"
                  type="button"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </section>

          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40 sm:p-7">
            <h2 className="text-sm font-semibold text-slate-900">
              How Fraudex works
            </h2>
            <div className="relative mt-6 flex min-w-[650px] items-start gap-3 overflow-x-auto pb-1">
              <div className="absolute left-[8%] right-[8%] top-3 h-px bg-slate-200" />
              {workflowSteps.map((step) => (
                <div
                  className="relative z-10 min-w-0 flex-1 text-center"
                  key={step.number}
                >
                  <span
                    className="relative z-10 mx-auto flex shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold leading-none text-white shadow-sm shadow-indigo-200"
                    style={{ width: "28px", height: "28px" }}
                  >
                    {step.number}
                  </span>
                  <p className="mx-auto mt-3 max-w-[130px] text-xs font-semibold leading-4 text-slate-800">
                    {step.title}
                  </p>
                  <p className="mx-auto mt-1 max-w-[135px] text-[11px] leading-4 text-slate-400">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-5 flex justify-end">
            <button
              className="flex items-center gap-2 rounded-lg bg-indigo-300 px-5 py-2.5 text-xs font-semibold text-white shadow-sm enabled:bg-indigo-600 enabled:hover:bg-indigo-500 disabled:cursor-not-allowed"
              onClick={() => setScreen("processing")}
              disabled={!selectedFile}
              type="button"
            >
              <CheckCircle2 size={15} />
              Analyze Invoice
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default UploadInvoice;
