interface MacroCardProps {
  title: string;
  children: React.ReactNode;
  accent?: boolean;
  className?: string;
}

export default function MacroCard({ title, children, accent, className = "" }: MacroCardProps) {
  return (
    <div className={`bg-zinc-950 border border-zinc-800 rounded-md ${className}`}>
      <div className={`px-4 py-2.5 border-b border-zinc-800 ${accent ? "border-l-2 border-l-[#E8C468]" : ""}`}>
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}
