"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { DEMO_TASKS } from "@/lib/data/demoData";
import type { Task, TaskStatus, TaskPriority, TaskCategory } from "@/lib/types";
import { Plus, Trash2, CheckCircle2, Circle, Clock, X } from "lucide-react";

function generateId() { return Math.random().toString(36).slice(2); }

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  High: "bg-red-950 text-red-400",
  Medium: "bg-amber-950 text-amber-400",
  Low: "bg-zinc-800 text-zinc-500",
};

const STATUS_ICON: Record<TaskStatus, React.FC<{ size: number; className?: string }>> = {
  not_started: Circle,
  in_progress: Clock,
  complete: CheckCircle2,
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(DEMO_TASKS);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<TaskCategory>("research");
  const [newPriority, setNewPriority] = useState<TaskPriority>("Medium");
  const [newDue, setNewDue] = useState("");
  const [newTicker, setNewTicker] = useState("");
  const [newEvent, setNewEvent] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("crossasset_tasks");
    if (stored) { try { setTasks(JSON.parse(stored)); } catch { /* keep demo */ } }
  }, []);

  function save(updated: Task[]) {
    setTasks(updated);
    localStorage.setItem("crossasset_tasks", JSON.stringify(updated));
  }

  function cycleStatus(id: string) {
    const order: TaskStatus[] = ["not_started", "in_progress", "complete"];
    save(tasks.map((t) => t.id === id ? { ...t, status: order[(order.indexOf(t.status) + 1) % 3] } : t));
  }

  function removeTask(id: string) { save(tasks.filter((t) => t.id !== id)); }

  function addTask() {
    if (!newTitle.trim()) return;
    const t: Task = {
      id: generateId(), title: newTitle.trim(), category: newCategory,
      priority: newPriority, dueDate: newDue || undefined,
      relatedTicker: newTicker || undefined, relatedEvent: newEvent || undefined,
      status: "not_started", createdAt: new Date().toISOString().split("T")[0],
    };
    save([t, ...tasks]);
    setNewTitle(""); setNewCategory("research"); setNewPriority("Medium");
    setNewDue(""); setNewTicker(""); setNewEvent("");
    setAdding(false);
  }

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
  const counts = {
    all: tasks.length,
    not_started: tasks.filter((t) => t.status === "not_started").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    complete: tasks.filter((t) => t.status === "complete").length,
  };

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Tasks</h1>
          <p className="text-sm text-zinc-500 mt-0.5">AI-generated and manual analyst tasks from today's macro brief.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs bg-[#E8C468] hover:bg-[#d4b05a] text-black font-semibold px-3 py-1.5 rounded transition-colors"
        >
          <Plus size={12} /> Add Task
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5">
        {(["all", "not_started", "in_progress", "complete"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              filter === s ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {s === "all" ? "All" : s === "not_started" ? "Not Started" : s === "in_progress" ? "In Progress" : "Complete"}
            <span className="ml-1.5 text-[10px] text-zinc-600">({counts[s]})</span>
          </button>
        ))}
      </div>

      {/* Add task form */}
      {adding && (
        <div className="mb-5 bg-zinc-950 border border-zinc-700 rounded-md p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-semibold text-white uppercase tracking-wider">New Task</p>
            <button onClick={() => setAdding(false)}><X size={14} className="text-zinc-500 hover:text-white" /></button>
          </div>
          <div className="mb-3">
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Title *</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task description..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as TaskCategory)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                {["research", "watchlist", "calendar", "reading", "model_update", "meeting_prep"].map((c) => (
                  <option key={c} value={c}>{c.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                {["High", "Medium", "Low"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Due Date</label>
              <input
                type="date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Related Ticker</label>
              <input
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                placeholder="e.g. AAPL"
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addTask} className="text-xs bg-[#E8C468] hover:bg-[#d4b05a] text-black font-semibold px-3 py-1.5 rounded">
              Add Task
            </button>
            <button onClick={() => setAdding(false)} className="text-xs text-zinc-500 hover:text-white px-3">Cancel</button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2">
        {filtered.map((task) => {
          const Icon = STATUS_ICON[task.status];
          return (
            <div
              key={task.id}
              className={`bg-zinc-950 border rounded-md px-4 py-3 flex items-start gap-3 transition-colors ${
                task.status === "complete" ? "border-zinc-800 opacity-60" : "border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <button onClick={() => cycleStatus(task.id)} className="mt-0.5 flex-shrink-0">
                <Icon
                  size={14}
                  className={
                    task.status === "complete"
                      ? "text-emerald-500"
                      : task.status === "in_progress"
                      ? "text-amber-400"
                      : "text-zinc-600"
                  }
                />
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium leading-snug ${task.status === "complete" ? "line-through text-zinc-500" : "text-white"}`}>
                  {task.title}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[10px] text-zinc-600">{task.category.replace("_", " ")}</span>
                  {task.relatedTicker && (
                    <span className="font-mono text-[10px] text-zinc-500">{task.relatedTicker}</span>
                  )}
                  {task.relatedEvent && (
                    <span className="text-[10px] text-zinc-600">· {task.relatedEvent}</span>
                  )}
                  {task.dueDate && (
                    <span className="text-[10px] text-zinc-600">Due {task.dueDate}</span>
                  )}
                </div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${PRIORITY_STYLES[task.priority]}`}>
                {task.priority}
              </span>
              <button onClick={() => removeTask(task.id)} className="text-zinc-700 hover:text-red-400 transition-colors flex-shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-zinc-600 text-sm">No tasks in this view.</div>
        )}
      </div>
    </AppShell>
  );
}
