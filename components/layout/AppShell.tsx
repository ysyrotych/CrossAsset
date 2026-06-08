import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <Topbar />
      <main className="ml-56 pt-[52px] min-h-screen">
        <div className="px-12 py-10 max-w-[1100px]">{children}</div>
      </main>
    </div>
  );
}
