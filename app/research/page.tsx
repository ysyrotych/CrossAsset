"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";

const NAVY    = "#0c1b38";
const POSITIVE= "#147a4f";
const NEGATIVE= "#b42318";
const AMBER   = "#b7791f";
const BORDER  = "#e8e3da";

type ResearchStatus = "Working Paper" | "Published" | "Archived";

type ResearchItem = {
  id: string;
  title: string;
  abstract: string;
  tags: string[];
  status: ResearchStatus;
  createdAt: string;
  updatedAt: string;
};

const STATUS_COLORS: Record<ResearchStatus, { bg: string; border: string; text: string }> = {
  "Working Paper": { bg: "#fffbf0", border: "#f0d89a", text: "#b7791f" },
  "Published":     { bg: "#f0faf4", border: "#b8e6ce", text: "#147a4f" },
  "Archived":      { bg: "#f5f5f5", border: "#e0e0e0", text: "#999" },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38]">{children}</p>;
}
function MiniLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999]">{children}</p>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`border border-[#e8e3da] bg-white ${className}`}>{children}</section>;
}

const DEMO_ITEMS: ResearchItem[] = [
  {
    id: "demo-1",
    title: "Macro Regime Classification Using FRED Composite Indicators",
    abstract: "This paper develops a four-quadrant macro regime classification framework using publicly available FRED data. We construct weighted z-score composites of eight macro indicators — initial claims, building permits, unemployment, industrial production, yield curve, consumer sentiment, high-yield spreads, and payrolls — to classify the U.S. economy into Recovery, Expansion, Slowdown, and Contraction phases.",
    tags: ["macro", "regime", "FRED", "factor investing"],
    status: "Working Paper",
    createdAt: "2026-05-12",
    updatedAt: "2026-06-29",
  },
];

const FILTER_LABELS = ["All", "Working Paper", "Published", "Archived"] as const;
type FilterLabel = typeof FILTER_LABELS[number];

const STORAGE_KEY = "crossasset_research_items";

export default function ResearchPage() {
  const [items, setItems] = useState<ResearchItem[]>(() => {
    if (typeof window === "undefined") return DEMO_ITEMS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as ResearchItem[]) : DEMO_ITEMS;
    } catch {
      return DEMO_ITEMS;
    }
  });
  const [filter, setFilter] = useState<FilterLabel>("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formTitle,    setFormTitle]    = useState("");
  const [formAbstract, setFormAbstract] = useState("");
  const [formTags,     setFormTags]     = useState("");
  const [formStatus,   setFormStatus]   = useState<ResearchStatus>("Working Paper");

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const filtered = filter === "All" ? items : items.filter(i => i.status === filter);

  const openNew = () => {
    setEditingId(null);
    setFormTitle(""); setFormAbstract(""); setFormTags(""); setFormStatus("Working Paper");
    setShowForm(true);
  };

  const openEdit = (item: ResearchItem) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormAbstract(item.abstract);
    setFormTags(item.tags.join(", "));
    setFormStatus(item.status);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formTitle.trim()) return;
    const tags = formTags.split(",").map(t => t.trim()).filter(Boolean);
    const now = new Date().toISOString().slice(0, 10);
    if (editingId) {
      setItems(prev => prev.map(i => i.id === editingId
        ? { ...i, title: formTitle, abstract: formAbstract, tags, status: formStatus, updatedAt: now }
        : i
      ));
    } else {
      setItems(prev => [...prev, {
        id: `item-${Date.now()}`,
        title: formTitle, abstract: formAbstract, tags, status: formStatus,
        createdAt: now, updatedAt: now,
      }]);
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <AppShell>
      <main className="pb-20">

        {/* Header */}
        <div className="-mx-10 -mt-10 mb-0 bg-[#0c1b38] px-10 py-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">CrossAsset</p>
                <span className="text-white/20">·</span>
                <span className="inline-flex items-center gap-1 border border-[#c8d0e8] bg-[#eef1f8] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#0c1b38]">
                  Research Hub
                </span>
              </div>
              <h1 className="text-[26px] font-semibold tracking-tight text-white leading-none"
                style={{ fontFamily: "var(--font-serif)" }}>
                Published Research
              </h1>
              <p className="mt-1.5 text-[11.5px] text-white/45 tracking-wide">
                Your working papers, notes, and published research
              </p>
            </div>
            <button
              onClick={openNew}
              className="mt-1 flex items-center gap-2 border border-white/20 bg-white/[0.08] px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white hover:bg-white/15 transition-all"
            >
              + New Research
            </button>
          </div>
          <div className="mt-4 flex items-center gap-5">
            <span className="text-[10px] text-white/35">{today}</span>
            <span className="text-white/15">·</span>
            <span className="text-[10px] text-white/35">{items.length} piece{items.length !== 1 ? "s" : ""}</span>
            <span className="text-white/15">·</span>
            <span className="text-[10px] text-white/35">{items.filter(i => i.status === "Published").length} published · {items.filter(i => i.status === "Working Paper").length} in progress</span>
          </div>
        </div>

        {/* Tab filter */}
        <div className="-mx-10 mb-8 border-b border-[#e8e3da] bg-[#fbfaf7] px-10">
          <div className="flex gap-0">
            {FILTER_LABELS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-3.5 text-[10.5px] font-bold uppercase tracking-[0.16em] border-b-2 -mb-px transition-colors ${
                  filter === f ? "border-[#0c1b38] text-[#0c1b38]" : "border-transparent text-[#999] hover:text-[#555]"
                }`}>
                {f}
                {f !== "All" && (
                  <span className="ml-1.5 text-[9px] font-bold tabular-nums text-[#bbb]">
                    ({items.filter(i => i.status === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* New / Edit form */}
        {showForm && (
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <SectionLabel>{editingId ? "Edit Research" : "New Research"}</SectionLabel>
              <button onClick={() => setShowForm(false)} className="text-[#bbb] hover:text-[#555] text-[18px] leading-none">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <MiniLabel>Title</MiniLabel>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Research title..."
                  className="mt-1.5 w-full border border-[#e8e3da] bg-white px-3 py-2 text-[13px] text-[#0a0a0a] outline-none focus:border-[#0c1b38]"
                />
              </div>
              <div>
                <MiniLabel>Abstract</MiniLabel>
                <textarea
                  value={formAbstract}
                  onChange={e => setFormAbstract(e.target.value)}
                  placeholder="Brief summary of your research..."
                  rows={4}
                  className="mt-1.5 w-full border border-[#e8e3da] bg-white px-3 py-2 text-[12px] text-[#333] leading-relaxed outline-none focus:border-[#0c1b38] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <MiniLabel>Tags (comma-separated)</MiniLabel>
                  <input
                    type="text"
                    value={formTags}
                    onChange={e => setFormTags(e.target.value)}
                    placeholder="macro, rates, equities..."
                    className="mt-1.5 w-full border border-[#e8e3da] bg-white px-3 py-2 text-[12px] text-[#555] outline-none focus:border-[#0c1b38]"
                  />
                </div>
                <div>
                  <MiniLabel>Status</MiniLabel>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as ResearchStatus)}
                    className="mt-1.5 w-full border border-[#e8e3da] bg-white px-3 py-2 text-[12px] text-[#0a0a0a] outline-none focus:border-[#0c1b38]"
                  >
                    <option value="Working Paper">Working Paper</option>
                    <option value="Published">Published</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={!formTitle.trim()}
                  className="bg-[#0c1b38] text-white px-5 py-2 text-[10.5px] font-bold uppercase tracking-[0.14em] hover:bg-[#162d5c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {editingId ? "Save Changes" : "Add Research"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="border border-[#e8e3da] px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#777] hover:border-[#0c1b38] hover:text-[#0c1b38] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Research list */}
        {filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-[14px] font-semibold text-[#0c1b38] mb-2">
              {filter === "All" ? "No research yet" : `No ${filter} items`}
            </p>
            <p className="text-[12px] text-[#999] mb-5">
              {filter === "All"
                ? "Click \"+ New Research\" to share your first piece of work."
                : `You have no items with status "${filter}".`}
            </p>
            {filter === "All" && (
              <button
                onClick={openNew}
                className="bg-[#0c1b38] text-white px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] hover:bg-[#162d5c] transition-colors"
              >
                + New Research
              </button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map(item => {
              const sc = STATUS_COLORS[item.status];
              return (
                <Card key={item.id} className="p-6 hover:border-[#c8c0b0] transition-colors">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      {/* Status + date row */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-flex items-center border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                          style={{ borderColor: sc.border, backgroundColor: sc.bg, color: sc.text }}>
                          {item.status}
                        </span>
                        <span className="text-[9.5px] text-[#bbb]">Updated {item.updatedAt}</span>
                        {item.createdAt !== item.updatedAt && (
                          <span className="text-[9.5px] text-[#bbb]">· Created {item.createdAt}</span>
                        )}
                      </div>

                      {/* Title */}
                      <h2 className="text-[16px] font-semibold text-[#0c1b38] leading-snug mb-2"
                        style={{ fontFamily: "var(--font-serif)" }}>
                        {item.title}
                      </h2>

                      {/* Abstract */}
                      {item.abstract && (
                        <p className="text-[11.5px] text-[#555] leading-relaxed line-clamp-3 mb-3">
                          {item.abstract}
                        </p>
                      )}

                      {/* Tags */}
                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {item.tags.map(tag => (
                            <span key={tag}
                              className="border border-[#e8e3da] bg-[#fbfaf7] px-2 py-0.5 text-[9.5px] font-medium text-[#777]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(item)}
                        className="border border-[#e8e3da] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#777] hover:border-[#0c1b38] hover:text-[#0c1b38] transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="border border-[#e8e3da] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#bbb] hover:border-[#b42318] hover:text-[#b42318] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        <div className="mt-8 border border-[#eee9df] bg-[#fbfaf7] px-5 py-3">
          <p className="text-[10px] text-[#bbb] leading-relaxed">
            Research Hub is a local workspace — all items are persisted in your browser&apos;s localStorage and survive page refreshes.
            Cloud sync and public sharing are planned for Phase 2.
          </p>
        </div>

      </main>
    </AppShell>
  );
}
