/**
 * BatchCheckBar — "N invoices not checked yet · Check all" with live progress.
 *
 * Starts POST /batch/fraud-check on the server and polls its progress every
 * 1.5 s; calls onDone() when the job finishes so the page can reload.
 * Rendered for admins and finance managers only (the API enforces it too).
 */

import { ShieldCheck, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import apiClient, { apiError } from "../api/client";

export default function BatchCheckBar({ onDone }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const wasRunning = useRef(false);
  // A ref, not a dependency: callers pass a fresh function every render, and
  // depending on it would re-fetch the status on every render.
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/batch/fraud-check");
      setStatus(data);
      const running = data.job.state === "running";
      if (wasRunning.current && !running) onDoneRef.current?.();
      wasRunning.current = running;
    } catch (e) {
      setError(apiError(e, "Could not load batch status."));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const job = status?.job;
  const running = job?.state === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [running, load]);

  async function start(scope) {
    setError("");
    try {
      await apiClient.post("/batch/fraud-check", { scope });
      wasRunning.current = true;
      await load();
    } catch (e) {
      setError(apiError(e, "Could not start the batch check."));
    }
  }

  if (!status) return null;
  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
  const lv = job.levels || {};

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm" data-no-tilt>
      {running ? (
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-semibold text-slate-800">
              <Zap size={15} className="animate-pulse text-indigo-600" />
              Checking invoices… {job.done.toLocaleString()} of {job.total.toLocaleString()}
            </span>
            <span className="font-mono-num text-xs text-slate-400">{pct}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><ShieldCheck size={16} /></div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {status.unanalyzed
                  ? `${status.unanalyzed.toLocaleString()} invoice${status.unanalyzed === 1 ? "" : "s"} not fraud-checked yet`
                  : "Every invoice has been fraud-checked"}
              </p>
              {job.state === "done" && (
                <p className="text-xs text-slate-400">
                  Last run: {job.total.toLocaleString()} checked · {(lv.CRITICAL || 0) + (lv.HIGH || 0)} high or critical ·{" "}
                  {lv.MEDIUM || 0} medium · {lv.LOW || 0} low{job.failed ? ` · ${job.failed} failed` : ""}
                </p>
              )}
              {job.state === "failed" && <p className="text-xs text-rose-500">Last run failed: {job.error}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            {status.unanalyzed > 0 && (
              <button type="button" onClick={() => start("unanalyzed")}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
                <Zap size={14} /> Check all
              </button>
            )}
            <button type="button" onClick={() => start("all")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-600">
              Re-check everything
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs font-medium text-rose-500">{error}</p>}
    </div>
  );
}
