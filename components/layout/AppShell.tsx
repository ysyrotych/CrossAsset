import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <main className="ml-56 min-h-screen overflow-x-hidden">
        <div className="px-10 py-10 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
