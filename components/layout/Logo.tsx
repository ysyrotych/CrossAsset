export default function Logo() {
  return (
    <div className="flex items-center gap-3.5">
      {/* Mark: bold "CA" lettermark in a clean square */}
      <div className="w-8 h-8 bg-white rounded-sm flex items-center justify-center shrink-0">
        <span
          className="text-[#0c1b38] text-[13px] font-semibold tracking-tight leading-none"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          CA
        </span>
      </div>

      <div>
        <p
          className="text-[13.5px] font-semibold tracking-[0.12em] uppercase text-white leading-none"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          CrossAsset
        </p>
        <p className="text-[9px] tracking-[0.2em] uppercase text-white/40 mt-1.5">
          Macro Intelligence
        </p>
      </div>
    </div>
  );
}
