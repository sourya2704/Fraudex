/**
 * ModelPanel — the fraud model's status, and (for admins) retraining it on
 * reviewers' APPROVE/REJECT decisions.
 *
 * Retraining runs on the server in the background; this panel polls
 * GET /ml/status every 2 s while a job is running.
 */

import { Brain, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import apiClient, { apiError } from "../api/client";

const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export default function ModelPanel({ isAdmin }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get("/ml/status");
      setStatus(data);
      return data;
    } catch (e) {
      setError(apiError(e, "Could not load the model status."));
      return null;
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const running = status?.job?.state === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [running, load]);

  async function retrain() {
    setError(""); setBusy(true);
    try { await apiClient.post("/ml/retrain"); await load(); }
    catch (e) { setError(apiError(e, "Could not start retraining.")); }
    finally { setBusy(false); }
  }

  async function rollback() {
    if (!window.confirm("Go back to the previous fraud model?")) return;
    setError(""); setBusy(true);
    try { await apiClient.post("/ml/rollback"); await load(); }
    catch (e) { setError(apiError(e, "Could not roll back.")); }
    finally { setBusy(false); }
  }

  const model = status?.model;
  const reviews = status?.reviews;
  const trained = model?.trained_on || {};
  const realCv = model?.metrics?.real_cross_validated;
  const synth = model?.metrics?.synthetic_test || model?.metrics?.model;
  const job = status?.job;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" data-no-tilt>
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Brain size={14} /></div>
          <h2 className="text-sm font-semibold text-slate-900">Fraud Model</h2>
        </div>
        {model && (
          <span className="rounded-full border border-slate-200 px-2.5 py-0.5 font-mono-num text-[11px] text-slate-500">
            {status.using_retrained_model ? "retrained" : "base"} · v{model.version}
          </span>
        )}
      </div>

      <div className="space-y-4 px-6 py-5">
        {!status && !error && <p className="text-sm text-slate-400">Loading…</p>}

        {status && !model && (
          <p className="text-sm text-slate-500">No trained model is installed. Fraud checks use the rules only.</p>
        )}

        {model && (
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="Synthetic invoices" value={(trained.synthetic_invoices ?? trained.invoices ?? 0).toLocaleString()} />
              <Stat label="Real reviews used" value={trained.real_reviewed_invoices ?? 0}
                hint={trained.real_reviewed_invoices ? `${trained.real_approved} approved · ${trained.real_rejected} rejected` : "none yet"} />
              <Stat label="Fraud caught" value={pct(synth?.recall)} hint="held-out synthetic test" />
              <Stat label="On real reviews" value={realCv ? pct(realCv.recall) : "—"}
                hint={realCv ? `precision ${pct(realCv.precision)}, ${realCv.folds}-fold` : "needs 20+ reviews of both kinds"} />
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Approved invoices teach the model what is legitimate and rejected ones what is fraud;
              each real decision counts five times a synthetic invoice.{" "}
              <strong className="text-slate-700">{reviews?.new_since_training ?? 0}</strong> review
              {reviews?.new_since_training === 1 ? "" : "s"} not yet used ({reviews?.approved ?? 0} approved,{" "}
              {reviews?.rejected ?? 0} rejected in total).
            </p>
          </>
        )}

        {running && (
          <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            <Sparkles size={15} className="animate-pulse" />
            Retraining… {job.step}
          </div>
        )}
        {job?.state === "done" && job.result && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            Retrained as v{job.result.version} with {job.result.trained_on.real_reviewed_invoices} real reviews.
            It is now used for every fraud check.
          </p>
        )}
        {job?.state === "failed" && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            Retraining failed: {job.error}. The previous model is still in use.
          </p>
        )}
        {error && <p className="text-xs font-medium text-rose-500">{error}</p>}

        {isAdmin && model !== undefined && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={retrain} disabled={busy || running}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Brain size={14} /> {running ? "Retraining…" : "Retrain with reviews"}
            </button>
            {status?.can_rollback && (
              <button type="button" onClick={rollback} disabled={busy || running}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600 disabled:opacity-50">
                <RotateCcw size={14} /> Roll back
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
