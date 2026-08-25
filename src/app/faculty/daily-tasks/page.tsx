'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Target, CalendarCheck, Clock, Send, Trash2, ChevronDown, BarChart3,
  CheckCircle2, AlertCircle, Users, BookOpen, Filter, Loader2,
} from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Topbar from '@/components/dashboard/Topbar';
import LoadingState from '@/components/shared/LoadingState';

const SECTIONS: Record<string, string[]> = {
  CSE: ['CSE-A', 'CSE-B', 'CSE-C'],
  ECE: ['ECE-A', 'ECE-B', 'ECE-C'],
  IT: ['IT-A', 'IT-B', 'IT-C'],
  AI: ['AI-A', 'AI-B', 'AI-C'],
  MECH: ['MECH-A', 'MECH-B', 'MECH-C'],
  CIVIL: ['CIVIL-A', 'CIVIL-B', 'CIVIL-C'],
};
const ALL_SECTIONS = Object.values(SECTIONS).flat();

const TASK_TYPES = [
  { value: 'study', label: 'Study', icon: '📖', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'assignment', label: 'Assignment', icon: '📝', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'lab_work', label: 'Lab Work', icon: '🔬', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'practice', label: 'Practice', icon: '🎯', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'revision', label: 'Revision', icon: '🔄', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'lecture', label: 'Watch Lecture', icon: '🎥', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'quiz', label: 'Quiz', icon: '❓', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-slate-600 bg-slate-50 border-slate-200' },
  { value: 'medium', label: 'Medium', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'high', label: 'High', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'urgent', label: 'Urgent', color: 'text-rose-600 bg-rose-50 border-rose-200' },
];

interface ClassTaskItem {
  _id: string;
  title: string;
  description: string;
  subject: string;
  section: string;
  taskType: string;
  priority: string;
  dueDate: string;
  dueTime: string;
  createdBy: { name: string };
  completion?: { completed: boolean; completedAt: string | null };
}

interface TaskAnalytics {
  taskId: string;
  title: string;
  section: string;
  subject: string;
  completedCount: number;
  totalCount: number;
  completionRate: number;
}

export default function FacultyDailyTasksPage() {
  const [tasks, setTasks] = useState<ClassTaskItem[]>([]);
  const [analytics, setAnalytics] = useState<TaskAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterSection, setFilterSection] = useState('All');
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState('');
  const [createError, setCreateError] = useState('');

  // Form state
  const [form, setForm] = useState({
    section: '',
    subject: '',
    title: '',
    description: '',
    taskType: 'study',
    priority: 'medium',
    dueDate: new Date().toISOString().slice(0, 10),
    dueTime: '8:00 PM',
    resourceUrl: '',
    resourceTitle: '',
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSection !== 'All') params.set('section', filterSection);
      const res = await fetch(`/api/class-tasks?${params.toString()}`);
      const data = await res.json();
      setTasks(data.tasks || []);
      setAnalytics(data.analytics || []);
    } catch { setTasks([]); }
    finally { setLoading(false); }
  }, [filterSection]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.section || !form.subject || !form.title) {
      setCreateError('Section, subject, and title are required.');
      return;
    }
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      const res = await fetch('/api/class-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...form,
          dueDate: form.dueDate,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCreateSuccess('Task published successfully!');
        setForm({
          section: '', subject: '', title: '', description: '',
          taskType: 'study', priority: 'medium',
          dueDate: new Date().toISOString().slice(0, 10),
          dueTime: '8:00 PM', resourceUrl: '', resourceTitle: '',
        });
        fetchTasks();
        setTimeout(() => { setCreateSuccess(''); setShowCreate(false); }, 2000);
      } else {
        setCreateError(data.error || 'Failed to create task.');
      }
    } catch {
      setCreateError('Network error.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await fetch('/api/class-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', taskId }),
      });
      fetchTasks();
    } catch { /* ignore */ }
  };

  const todayTasks = tasks.filter(t => {
    const d = new Date(t.dueDate);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const upcomingTasks = tasks.filter(t => {
    const d = new Date(t.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d > today;
  });

  const totalStudents = analytics.length > 0 ? analytics[0].totalCount : 0;
  const avgCompletion = analytics.length > 0
    ? Math.round(analytics.reduce((s, a) => s + a.completionRate, 0) / analytics.length)
    : 0;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar role="faculty" />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Daily Class Tasks" roleBadge="FACULTY" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-5 overflow-y-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Daily Class Tasks</h1>
              <p className="text-xs text-slate-500 mt-1">Create and manage tasks for your students. Track completion rates in real-time.</p>
            </div>
            <div className="flex items-center gap-3">
              <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
                className="bg-white border border-slate-300 text-xs font-semibold text-slate-800 rounded-xl px-3 py-2 outline-none shadow-sm">
                <option value="All">All Sections</option>
                {ALL_SECTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
              <button onClick={() => setShowCreate(!showCreate)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all">
                <Plus className="w-4 h-4" /> Create Task
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Tasks', value: tasks.length, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
              { label: 'Today\'s Tasks', value: todayTasks.length, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
              { label: 'Avg Completion', value: `${avgCompletion}%`, color: 'text-blue-700 bg-blue-50 border-blue-200' },
              { label: 'Enrolled Students', value: totalStudents, color: 'text-amber-700 bg-amber-50 border-amber-200' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{s.label}</p>
                <p className="text-2xl font-black mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Create Form */}
          {showCreate && (
            <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" /> Create New Daily Task
                </h3>
                <button type="button" onClick={() => setShowCreate(false)} className="text-xs text-slate-500 hover:text-slate-800">Cancel</button>
              </div>

              {createSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> {createSuccess}
                </div>
              )}
              {createError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">{createError}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Section */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Section *</label>
                  <select value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none">
                    <option value="">Select section...</option>
                    {ALL_SECTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Subject *</label>
                  <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="e.g. Digital Electronics"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none" />
                </div>

                {/* Title */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Task Title *</label>
                  <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Revise MOSFET Operating Regions"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none" />
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional instructions or context..."
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none resize-none" />
                </div>

                {/* Task Type */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Task Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {TASK_TYPES.map(tt => (
                      <button key={tt.value} type="button" onClick={() => setForm(f => ({ ...f, taskType: tt.value }))}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${form.taskType === tt.value ? tt.color + ' ring-1 ring-current/30' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        {tt.icon} {tt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Priority</label>
                  <div className="flex gap-1.5">
                    {PRIORITIES.map(p => (
                      <button key={p.value} type="button" onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                        className={`flex-1 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${form.priority === p.value ? p.color + ' ring-1 ring-current/30' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Due Date *</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none" />
                </div>

                {/* Due Time */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Due Time</label>
                  <input type="text" value={form.dueTime} onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))}
                    placeholder="e.g. 8:00 PM"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none" />
                </div>

                {/* Resource URL */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Resource URL (optional)</label>
                  <input type="url" value={form.resourceUrl} onChange={e => setForm(f => ({ ...f, resourceUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none" />
                </div>
              </div>

              <button type="submit" disabled={creating}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</> : <><Send className="w-4 h-4" /> Publish Task</>}
              </button>
            </form>
          )}

          {/* Task List */}
          <div className="space-y-4">
            {loading ? (
              <LoadingState message="Loading tasks..." />
            ) : tasks.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-500">No tasks created yet</p>
                <p className="text-xs text-slate-400 mt-1">Click "Create Task" to assign work to your students.</p>
              </div>
            ) : (
              <>
                {/* Today's Tasks */}
                {todayTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <CalendarCheck className="w-3.5 h-3.5" /> Today&apos;s Tasks ({todayTasks.length})
                    </h3>
                    <div className="space-y-2">
                      {todayTasks.map(task => (
                        <TaskCard key={task._id} task={task} onDelete={handleDelete} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Upcoming Tasks */}
                {upcomingTasks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> Upcoming ({upcomingTasks.length})
                    </h3>
                    <div className="space-y-2">
                      {upcomingTasks.map(task => (
                        <TaskCard key={task._id} task={task} onDelete={handleDelete} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Past Tasks */}
                {tasks.filter(t => new Date(t.dueDate) < new Date(new Date().toDateString())).length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Past Tasks</h3>
                    <div className="space-y-2 opacity-60">
                      {tasks.filter(t => new Date(t.dueDate) < new Date(new Date().toDateString())).map(task => (
                        <TaskCard key={task._id} task={task} onDelete={handleDelete} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Analytics Section */}
          {analytics.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" /> Task Completion Analytics
              </h3>
              <div className="space-y-3">
                {analytics.map(a => (
                  <div key={a.taskId} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{a.title}</p>
                      <p className="text-[10px] text-slate-400">{a.subject} · {a.section}</p>
                    </div>
                    <div className="w-32 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${a.completionRate}%`,
                          background: a.completionRate >= 80 ? '#10B981' : a.completionRate >= 50 ? '#FFAA00' : '#FF4D5E',
                        }} />
                    </div>
                    <span className="font-mono text-[11px] font-bold w-16 text-right" style={{
                      color: a.completionRate >= 80 ? '#10B981' : a.completionRate >= 50 ? '#FFAA00' : '#FF4D5E',
                    }}>
                      {a.completedCount}/{a.totalCount} · {a.completionRate}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Task Card Component ──────────────────────────────────────────────────────
function TaskCard({ task, onDelete }: { task: ClassTaskItem; onDelete: (id: string) => void }) {
  const typeMeta = TASK_TYPES.find(t => t.value === task.taskType) || TASK_TYPES[0];
  const prioMeta = PRIORITIES.find(p => p.value === task.priority) || PRIORITIES[1];
  const dueDate = new Date(task.dueDate);
  const isPastDue = dueDate < new Date();

  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all hover:shadow-sm ${isPastDue ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'}`}
      style={{ borderLeft: `3px solid ${task.priority === 'urgent' ? '#FF4D5E' : task.priority === 'high' ? '#FFAA00' : '#5B52FF'}` }}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${typeMeta.color}`}>
        <span className="text-sm">{typeMeta.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-slate-900 truncate">{task.title}</p>
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${prioMeta.color}`}>
            {task.priority.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-indigo-600 font-semibold">{task.subject}</span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-[10px] text-slate-400">{task.section}</span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-[10px] text-slate-400">{task.dueTime || 'No time set'}</span>
        </div>
        {task.description && (
          <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{task.description}</p>
        )}
      </div>
      <button onClick={() => onDelete(task._id)}
        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
        title="Delete task">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
