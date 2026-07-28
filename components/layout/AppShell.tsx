import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-56 min-h-screen overflow-x-clip">
        <div className="px-10 py-10">{children}</div>
      </main>
    </div>
  );
}
