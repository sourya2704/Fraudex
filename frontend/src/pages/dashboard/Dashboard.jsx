import Sidebar from "../Sidebar/Sidebar";

function Dashboard() {
  return (
    <main className="flex min-h-screen bg-slate-100 text-slate-900">
      <Sidebar />
      <section className="flex-1 p-8">
        <p className="text-sm font-medium text-indigo-600">Overview</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Dashboard</h1>
      </section>
    </main>
  );
}

export default Dashboard;