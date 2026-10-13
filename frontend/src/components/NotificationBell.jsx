import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  FileUp,
  Info,
  ShieldAlert,
  XCircle,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";

const TYPE_META = {
  INVOICE_UPLOADED:       { Icon: FileUp,        color: "text-blue-500",   bg: "bg-blue-50"   },
  PROCESSING_FAILED:      { Icon: XCircle,       color: "text-rose-500",   bg: "bg-rose-50"   },
  FRAUD_HIGH:             { Icon: AlertTriangle,  color: "text-orange-500", bg: "bg-orange-50" },
  FRAUD_CRITICAL:         { Icon: ShieldAlert,    color: "text-rose-600",   bg: "bg-rose-50"   },
  REVIEW_DECISION:        { Icon: CheckCircle2,   color: "text-green-500",  bg: "bg-green-50"  },
  INVOICE_STATUS_CHANGED: { Icon: Info,           color: "text-indigo-500", bg: "bg-indigo-50" },
  AI_ANALYSIS_COMPLETE:   { Icon: Info,           color: "text-violet-500", bg: "bg-violet-50" },
};

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]               = useState(0);
  const [open, setOpen]                   = useState(false);
  const [loading, setLoading]             = useState(false);
  const ref                               = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const [nRes, cRes] = await Promise.all([
        apiClient.get("/notifications/?limit=20"),
        apiClient.get("/notifications/unread-count"),
      ]);
      setNotifications(nRes.data);
      setUnread(cRes.data.unread_count);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markRead(id) {
    await apiClient.post(`/notifications/${id}/read`);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    setUnread(prev => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    setLoading(true);
    await apiClient.post("/notifications/read-all");
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
    setLoading(false);
  }

  async function deleteOne(e, id) {
    e.stopPropagation();
    await apiClient.delete(`/notifications/${id}`);
    const deleted = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (deleted && !deleted.is_read) setUnread(prev => Math.max(0, prev - 1));
  }

  function toggleOpen() {
    setOpen(o => !o);
    if (!open) fetchNotifications();
  }

  return (
    <div className="relative" ref={ref}>
      {/* ── Bell button ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={toggleOpen}
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-indigo-300 hover:text-indigo-600"
        title="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown ────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
              {unread > 0 && (
                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={loading}
                className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell size={24} className="text-slate-200" />
                <p className="mt-2 text-sm font-semibold text-slate-400">All caught up!</p>
                <p className="mt-1 text-xs text-slate-300">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = TYPE_META[n.type] || { Icon: Info, color: "text-slate-500", bg: "bg-slate-50" };
                const { Icon } = meta;
                return (
                  <div
                    key={n.id}
                    className={`group relative flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50/60 ${!n.is_read ? "bg-indigo-50/30" : ""}`}
                    onClick={() => !n.is_read && markRead(n.id)}
                  >
                    {/* unread dot */}
                    {!n.is_read && (
                      <span className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    )}

                    {/* icon */}
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.bg}`}>
                      <Icon size={15} className={meta.color} />
                    </span>

                    {/* content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs font-semibold leading-snug ${!n.is_read ? "text-slate-800" : "text-slate-600"}`}>
                          {n.title}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => deleteOne(e, n.id)}
                          className="mt-0.5 hidden shrink-0 text-slate-300 hover:text-slate-500 group-hover:block"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-4 text-slate-400 line-clamp-2">
                        {n.message}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-slate-300">{timeAgo(n.created_at)}</span>
                        {n.invoice_id && (
                          <Link
                            to={`/dashboard/invoices/${n.invoice_id}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-0.5 text-[10px] font-semibold text-indigo-400 hover:text-indigo-600"
                          >
                            View <ChevronRight size={10} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5 text-center">
              <Link
                to="/dashboard/audit"
                onClick={() => setOpen(false)}
                className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700"
              >
                View full audit log →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
