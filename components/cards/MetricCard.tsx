import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MacroMetric } from "@/lib/types";

interface MetricCardProps {
  metric: MacroMetric;
  invertColor?: boolean; // true = up is bad (yields, unemployment)
}

export default function MetricCard({ metric, invertColor = false }: MetricCardProps) {
  const { label, value, change, direction, context } = metric;

  const isUp = direction === "up";
  const isDown = direction === "down";

  // For yields/unemployment, "up" is red; for equities "up" is green.
  // We use neutral labels (higher/lower) and subtle color cues.
  const changeColor = direction === "flat"
    ? "text-zinc-500"
    : invertColor
    ? isUp ? "text-red-400" : "text-emerald-400"
    : isUp ? "text-emerald-400" : "text-red-400";

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-md px-4 py-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-end justify-between">
        <span className="text-xl font-semibold text-white tabular-nums">{value}</span>
        {change && change !== "N/A" && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${changeColor}`}>
            {direction === "up" && <TrendingUp size={11} />}
            {direction === "down" && <TrendingDown size={11} />}
            {direction === "flat" && <Minus size={11} />}
            {change}
          </span>
        )}
      </div>
      {context && <p className="text-[10px] text-zinc-600 mt-1">{context}</p>}
    </div>
  );
}
