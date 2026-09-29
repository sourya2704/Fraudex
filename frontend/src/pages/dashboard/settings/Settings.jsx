import { Bell, Search, ShieldCheck } from "lucide-react";
import Sidebar from "../../Sidebar/Sidebar";

function Settings() {
  return (
    <main className="flex min-h-screen bg-[#f8fafc] text-slate-900">
      <Sidebar expanded />
      <div className="min-w-0 flex-1">
        <header className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8">
          <h1 className="text-base font-semibold">Settings</h1>
          <div className="flex items-center gap-4">
            <div className="hidden h-9 w-48 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-400 sm:flex"><Search size={15} /> Search invoices...</div>
            <div className="relative border-l border-slate-200 pl-4 text-slate-500"><Bell size={18} /><span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-red-500" /></div>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4"><span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-500 text-xs font-semibold text-white">JD</span><div className="hidden leading-tight sm:block"><p className="text-xs font-semibold">Jane Doe</p><p className="text-[11px] text-slate-400">Finance Analyst</p></div></div>
          </div>
        </header>

        <section className="mx-auto max-w-[558px] space-y-4 px-5 py-5 sm:py-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
            <h2 className="border-b border-slate-100 pb-3 text-sm font-semibold">Profile</h2>
            <div className="mt-4 flex items-center gap-3"><span className="grid h-14 w-14 place-items-center rounded-full bg-indigo-500 text-lg font-semibold text-white">JD</span><div><p className="text-sm font-semibold">Jane Doe</p><p className="text-xs text-slate-400">Finance Analyst · Acme Corporation</p></div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] font-medium text-slate-500">Full Name<input className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-indigo-400" defaultValue="Jane Doe" /></label>
              <label className="text-[11px] font-medium text-slate-500">Phone Number<input className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-indigo-400" placeholder="Enter phone number" /></label>
              <label className="text-[11px] font-medium text-slate-500">Organization<input className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-indigo-400" defaultValue="Acme Corporation" /></label>
              <label className="text-[11px] font-medium text-slate-500">Role<input className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-indigo-400" defaultValue="Finance Analyst" /></label>
            </div>
            <div className="mt-3 flex justify-end"><button className="rounded-md bg-indigo-500 px-3.5 py-2 text-xs font-semibold text-white" type="button">Save Changes</button></div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
            <h2 className="border-b border-slate-100 pb-3 text-sm font-semibold">Security</h2>
            <h3 className="mt-4 text-xs font-semibold text-slate-600">Change Password</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] font-medium text-slate-500">Current Password<input className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-indigo-400" type="password" /></label>
              <label className="text-[11px] font-medium text-slate-500">New Password<input className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-indigo-400" type="password" /></label>
              <label className="text-[11px] font-medium text-slate-500 sm:col-span-2">Confirm New Password<input className="mt-1.5 h-9 w-full rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-indigo-400 sm:w-[calc(50%-6px)]" type="password" /></label>
            </div>
            <div className="mt-3 flex justify-end"><button className="rounded-md border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-500" type="button">Update Password</button></div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><div><h3 className="text-xs font-semibold text-slate-600">SMS Notifications</h3><p className="text-[11px] text-slate-400">Receive fraud alerts on your phone.</p></div><button aria-label="Toggle SMS notifications" className="relative h-5 w-10 rounded-full bg-indigo-500" type="button"><span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" /></button></div>
          </section>
          <div className="flex items-center justify-center gap-2 pb-2 text-xs text-slate-400"><ShieldCheck size={14} /> Your account settings are protected</div>
        </section>
      </div>
    </main>
  );
}

export default Settings;
