import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Circle,
  Trash2,
  Plus,
  Sparkles,
  Clock,
  Calendar,
  TrendingUp,
  Inbox,
  AlertCircle,
  Loader2,
  Check,
  RotateCcw
} from "lucide-react";

interface Task {
  id: string;
  name: string;
  deadline: string; // YYYY-MM-DD
  completed: boolean;
  createdAt: number;
}

const INITIAL_TASKS: Task[] = [
  {
    id: "1",
    name: "Design TaskBuddy AI landing page layout",
    deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
    completed: false,
    createdAt: Date.now() - 3600000
  },
  {
    id: "2",
    name: "Prepare task prioritization data structure",
    deadline: new Date(Date.now() + 172800000).toISOString().split('T')[0], // in 2 days
    completed: true,
    createdAt: Date.now() - 7200000
  },
  {
    id: "3",
    name: "Integrate server-side Gemini API route",
    deadline: new Date().toISOString().split('T')[0], // today
    completed: false,
    createdAt: Date.now()
  }
];

function getDeadlineStatus(deadlineStr: string) {
  if (!deadlineStr) {
    return {
      label: "No deadline",
      color: "bg-slate-100 text-slate-600 border-slate-200"
    };
  }

  const deadlineDate = new Date(deadlineStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);

  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      label: `Overdue by ${absDays} day${absDays > 1 ? 's' : ''}`,
      color: "bg-rose-50 text-rose-700 border-rose-100 border text-xs px-2.5 py-0.5 rounded-full font-medium"
    };
  } else if (diffDays === 0) {
    return {
      label: "Due today",
      color: "bg-amber-50 text-amber-700 border-amber-100 border text-xs px-2.5 py-0.5 rounded-full font-medium"
    };
  } else if (diffDays === 1) {
    return {
      label: "Due tomorrow",
      color: "bg-indigo-50 text-indigo-700 border-indigo-100 border text-xs px-2.5 py-0.5 rounded-full font-medium"
    };
  } else {
    return {
      label: `Due in ${diffDays} days`,
      color: "bg-emerald-50 text-emerald-700 border-emerald-100 border text-xs px-2.5 py-0.5 rounded-full font-medium"
    };
  }
}

// Simple and highly robust split-based markdown renderer
function SimpleMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const renderFormattedText = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    if (parts.length === 1) return text;
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-semibold text-slate-900">{part}</strong>;
      }
      return part;
    });
  };

  const blocks = content.split('\n');
  return (
    <div className="space-y-3.5 text-[14px] text-slate-600 leading-relaxed">
      {blocks.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Headers
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-[15px] font-semibold text-slate-800 mt-4 mb-2 flex items-center gap-1.5">
              {trimmed.substring(4)}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-base font-bold text-slate-900 mt-5 mb-2 border-b border-slate-100 pb-1">
              {trimmed.substring(3)}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-lg font-extrabold text-slate-900 mt-6 mb-3">
              {trimmed.substring(2)}
            </h2>
          );
        }

        // Bullet points
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const text = trimmed.substring(2);
          return (
            <li key={idx} className="list-disc list-inside ml-2.5 text-slate-600">
              {renderFormattedText(text)}
            </li>
          );
        }

        // Numbered lists
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex gap-2 ml-1 text-slate-600">
              <span className="font-semibold text-indigo-600 shrink-0">{numMatch[1]}.</span>
              <span>{renderFormattedText(numMatch[2])}</span>
            </div>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="text-slate-600">
            {renderFormattedText(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem("taskbuddy_tasks");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing tasks from local storage", e);
      }
    }
    return INITIAL_TASKS;
  });

  const [taskName, setTaskName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  // AI prioritization states
  const [isPrioritizing, setIsPrioritizing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem("taskbuddy_tasks", JSON.stringify(tasks));
  }, [tasks]);

  // Dashboard Stats Calculations
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, percentage };
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filter === "completed") return t.completed;
      if (filter === "pending") return !t.completed;
      return true;
    }).sort((a, b) => {
      // Uncompleted tasks with earlier deadlines or created newer
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [tasks, filter]);

  // Handlers
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      name: taskName.trim(),
      deadline: deadline || "",
      completed: false,
      createdAt: Date.now()
    };

    setTasks(prev => [newTask, ...prev]);
    setTaskName("");
    setDeadline("");
  };

  const handleToggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all tasks?")) {
      setTasks([]);
      setAiSuggestion(null);
    }
  };

  const handlePrioritizeTasks = async () => {
    if (tasks.length === 0) {
      setAiError("Please add some tasks first before using AI prioritization.");
      return;
    }

    setIsPrioritizing(true);
    setAiError(null);
    setAiSuggestion(null);

    try {
      const response = await fetch("/api/prioritize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tasks })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      setAiSuggestion(data.recommendation);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Failed to reach the AI prioritization service. Please verify your GEMINI_API_KEY.");
    } finally {
      setIsPrioritizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans flex flex-col">
      {/* Decorative header highlight */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:py-12">
        {/* Header Block */}
        <header className="mb-10 text-center sm:text-left sm:flex sm:items-center sm:justify-between border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2.5 mb-1.5">
              <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
                <Check className="h-5 w-5 stroke-[2.5]" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                TaskBuddy <span className="text-indigo-600">AI</span>
              </h1>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              A minimalist deadline assistant to view, organize, and prioritize your daily agenda.
            </p>
          </div>

          <div className="mt-4 sm:mt-0 flex gap-2 justify-center">
            {tasks.length > 0 && (
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-100"
              >
                Clear All
              </button>
            )}
          </div>
        </header>

        {/* Dashboard Stats Panel */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Card: Total Tasks */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Tasks</p>
              <h3 className="text-3xl font-black text-slate-900">{stats.total}</h3>
            </div>
            <div className="h-11 w-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
              <Inbox className="h-5.5 w-5.5" />
            </div>
          </div>

          {/* Card: Completed Tasks */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Completed</p>
              <div className="flex items-baseline gap-1.5">
                <h3 className="text-3xl font-black text-emerald-600">{stats.completed}</h3>
                {stats.total > 0 && (
                  <span className="text-xs text-slate-400 font-bold">({stats.percentage}%)</span>
                )}
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100">
              <CheckCircle2 className="h-5.5 w-5.5" />
            </div>
          </div>

          {/* Card: Pending Tasks */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending</p>
              <h3 className="text-3xl font-black text-amber-600">{stats.pending}</h3>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100">
              <Clock className="h-5.5 w-5.5" />
            </div>
          </div>
        </section>

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: Task Creation & AI Engine (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Create Task Form */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Plus className="h-4.5 w-4.5 text-indigo-600 stroke-[2.5]" />
                Add New Task
              </h2>
              <form onSubmit={handleAddTask} className="space-y-4">
                <div>
                  <label htmlFor="taskName" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Task Name
                  </label>
                  <input
                    type="text"
                    id="taskName"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    placeholder="e.g. Complete math assignment"
                    maxLength={100}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-colors placeholder-slate-400 text-slate-800 font-medium"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="deadline" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Deadline (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      id="deadline"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-colors text-slate-800 font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!taskName.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-indigo-100"
                >
                  <Plus className="h-4 w-4" />
                  Add Task
                </button>
              </form>
            </div>

            {/* AI Prioritizer Action Box */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 h-24 w-24 bg-indigo-50 rounded-full blur-2xl opacity-50 -mr-6 -mt-6" />
              
              <div className="relative">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="h-4.5 w-4.5 text-indigo-600 fill-indigo-100" />
                      Gemini Prioritizer
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Analyze active deadlines and generate an optimized priority queue using Gemini AI.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handlePrioritizeTasks}
                  disabled={isPrioritizing || tasks.filter(t => !t.completed).length === 0}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-100 disabled:shadow-none"
                >
                  {isPrioritizing ? (
                    <>
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      Prioritizing Tasks...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 fill-white" />
                      Prioritize Tasks
                    </>
                  )}
                </button>

                {/* AI Error Alert */}
                {aiError && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl text-xs flex gap-2.5 items-start">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <p className="leading-relaxed font-medium">{aiError}</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT PANEL: List View & AI Suggestion Outputs (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* AI suggestions output box - Only display if we have a suggestion or loading */}
            {(aiSuggestion || isPrioritizing) && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-50/40 p-6 rounded-2xl border border-indigo-100/70 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-indigo-100/50 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-indigo-100 text-indigo-700">
                      <Sparkles className="h-4 w-4 fill-indigo-200" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">TaskBuddy Smart Advice</h3>
                  </div>
                  {aiSuggestion && (
                    <button
                      onClick={() => setAiSuggestion(null)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                    >
                      Dismiss
                    </button>
                  )}
                </div>

                {isPrioritizing ? (
                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800">Reviewing deadlines...</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Gemini is computing the ideal productivity order for your active tasks.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-slate prose-sm max-w-none">
                    <SimpleMarkdown content={aiSuggestion || ""} />
                  </div>
                )}
              </motion.div>
            )}

            {/* Task List Management Card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              
              {/* Filter Tabs */}
              <div className="px-6 pt-5 pb-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-indigo-600" />
                  Your Tasks
                </h2>
                
                {/* Custom Styled Filter Tabs */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold self-start sm:self-auto">
                  <button
                    onClick={() => setFilter("all")}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      filter === "all"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    All ({stats.total})
                  </button>
                  <button
                    onClick={() => setFilter("pending")}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      filter === "pending"
                        ? "bg-white text-amber-700 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Pending ({stats.pending})
                  </button>
                  <button
                    onClick={() => setFilter("completed")}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      filter === "completed"
                        ? "bg-white text-emerald-700 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Completed ({stats.completed})
                  </button>
                </div>
              </div>

              {/* List Content */}
              <div className="divide-y divide-slate-100">
                <AnimatePresence initial={false}>
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map((task) => {
                      const deadlineInfo = getDeadlineStatus(task.deadline);
                      return (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className={`p-4 flex items-center justify-between gap-4 group transition-colors hover:bg-slate-50/50 ${
                            task.completed ? "bg-slate-50/30" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Checkbox Icon Toggler */}
                            <button
                              onClick={() => handleToggleTask(task.id)}
                              aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
                              className="focus:outline-none shrink-0"
                            >
                              {task.completed ? (
                                <div className="h-5.5 w-5.5 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="h-5.5 w-5.5 rounded-lg border-2 border-slate-300 hover:border-indigo-500 bg-white transition-all" />
                              )}
                            </button>

                            <div className="min-w-0">
                              {/* Task Title text */}
                              <p
                                onClick={() => handleToggleTask(task.id)}
                                className={`text-sm font-semibold select-none cursor-pointer truncate ${
                                  task.completed
                                    ? "text-slate-400 line-through decoration-slate-300 decoration-1"
                                    : "text-slate-800 hover:text-indigo-600"
                                }`}
                              >
                                {task.name}
                              </p>

                              {/* Task Metadata row */}
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1">
                                {task.deadline ? (
                                  <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                                    <Calendar className="h-3 w-3 text-slate-400" />
                                    {task.deadline}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400 font-medium">No deadline</span>
                                )}
                                
                                {!task.completed && task.deadline && (
                                  <span className={deadlineInfo.color}>
                                    {deadlineInfo.label}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Items */}
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            aria-label="Delete Task"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                        <Inbox className="h-6 w-6 stroke-[1.5]" />
                      </div>
                      <div className="space-y-1 max-w-xs">
                        <p className="text-sm font-bold text-slate-800">No tasks found</p>
                        <p className="text-xs text-slate-500">
                          {filter === "all"
                            ? "Get started by adding your very first task on the left panel!"
                            : `You have no tasks matching the "${filter}" filter status.`}
                        </p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>

            </div>

          </div>

        </div>
      </main>

      {/* Clean Bottom Footer */}
      <footer className="mt-auto border-t border-slate-100 py-6 text-center text-xs text-slate-400 font-medium">
        <p>TaskBuddy AI &copy; 2026 &bull; Powered by Google Gemini AI</p>
      </footer>
    </div>
  );
}
