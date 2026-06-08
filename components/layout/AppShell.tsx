import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

interface AppShellProps {
  children: React.ReactNode;
  isDemo?: boolean;
}

export default function AppShell({ children, isDemo = true }: AppShellProps) {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <Sidebar />
      <Topbar isDemo={isDemo} />
      <main className="ml-56 pt-12 min-h-screen">
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
