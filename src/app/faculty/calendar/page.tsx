'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar as CalIcon, Plus, ChevronLeft, ChevronRight, Search, Filter, X,
  Clock, MapPin, Users, BookOpen, Edit3, Trash2, AlertTriangle, Star,
  CheckCircle2, Loader2, CalendarDays, List, LayoutGrid, Bell,
} from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Topbar from '@/components/dashboard/Topbar';
import LoadingState from '@/components/shared/LoadingState';

const EVENT_TYPES = [
  { value: 'exam', label: 'Exam', icon: '📝', color: '#FF4D5E', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'assignment', label: 'Assignment', icon: '📋', color: '#5B52FF', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'project', label: 'Project', icon: '🚀', color: '#8B5CF6', bg: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'internal_assessment', label: 'Internal', icon: '📊', color: '#FFAA00', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'lab_exam', label: 'Lab Exam', icon: '🔬', color: '#10B981', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'class_test', label: 'Class Test', icon: '✏️', color: '#06B6D4', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { value: 'workshop', label: 'Workshop', icon: '🔧', color: '#F97316', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'seminar', label: 'Seminar', icon: '🎤', color: '#EC4899', bg: 'bg-pink-50 text-pink-700 border-pink-200' },
  { value: 'holiday', label: 'Holiday', icon: '🏖️', color: '#14B8A6', bg: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'college_event', label: 'College Event', icon: '🏛️', color: '#6366F1', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'other', label: 'Other', icon: '📌', color: '#64748B', bg: 'bg-slate-50 text-slate-700 border-slate-200' },
];

const PRIORITIES = [
  { value: 'normal', label: 'Normal', color: '#64748B' },
  { value: 'important', label: 'Important', color: '#FFAA00' },
  { value: 'critical', label: 'Critical', color: '#FF4D5E' },
];

const SECTIONS = ['CSE-A', 'CSE-B', 'CSE-C', 'ECE-A', 'ECE-B', 'IT-A', 'IT-B', 'AI-A', 'AI-B'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface AcademicEvent {
  _id: string;
  title: string;
  description: string;
  eventType: string;
  priority: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  section: string;
  venue: string;
  targetSections: string[];
  attachments: { title: string; url: string }[];
  createdBy: { name: string };
  createdAt: string;
  updatedAt: string;
}

function getEventTypeMeta(type: string) {
  return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getDaysArray(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  return cells;
}

// ── Main Component ────────────────────────────────────────────────────────
export default function FacultyCalendarPage() {
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AcademicEvent | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<AcademicEvent | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState('');
  const [createError, setCreateError] = useState('');

  // Form state
  const emptyForm = {
    title: '', description: '', eventType: 'exam', priority: 'normal',
    date: formatDate(new Date()), startTime: '09:00', endTime: '11:00',
    subject: '', section: '', venue: '', targetSections: [] as string[],
  };
  const [form, setForm] = useState(emptyForm);

  // ── Fetch events ──
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const y = currentDate.getFullYear();
      const m = currentDate.getMonth() + 1;
      const params = new URLSearchParams({ month: `${y}-${String(m).padStart(2, '0')}` });
      const res = await fetch(`/api/academic-events?${params.toString()}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [currentDate]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ── Filter events ──
  const filteredEvents = useMemo(() => {
    let result = events;
    if (filterType) result = result.filter(e => e.eventType === filterType);
    if (filterPriority) result = result.filter(e => e.priority === filterPriority);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e => e.title.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q));
    }
    return result;
  }, [events, filterType, filterPriority, search]);

  // ── Group events by date ──
  const eventsByDate = useMemo(() => {
    const map: Record<string, AcademicEvent[]> = {};
    filteredEvents.forEach(e => {
      const key = e.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [filteredEvents]);

  // ── Navigate months/weeks/days ──
  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  // ── Create event ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.eventType || !form.date) {
      setCreateError('Title, event type, and date are required.');
      return;
    }
    setCreating(true); setCreateError(''); setCreateSuccess('');
    try {
      const res = await fetch('/api/academic-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...form }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCreateSuccess('Event published!');
        setForm(emptyForm);
        fetchEvents();
        setTimeout(() => { setCreateSuccess(''); setShowCreate(false); }, 1500);
      } else {
        setCreateError(data.error || 'Failed to create event.');
      }
    } catch { setCreateError('Network error.'); }
    finally { setCreating(false); }
  };

  // ── Delete event ──
  const handleDelete = async (eventId: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      await fetch('/api/academic-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', eventId }),
      });
      fetchEvents();
      setSelectedEvent(null);
    } catch { /* ignore */ }
  };

  // ── Quick add from calendar cell ──
  const quickAdd = (date: Date) => {
    setForm({ ...emptyForm, date: formatDate(date) });
    setShowCreate(true);
  };

  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // ── Upcoming events sidebar data ──
  const upcoming = useMemo(() => {
    const todayStr = formatDate(today);
    return filteredEvents
      .filter(e => e.date.slice(0, 10) >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [filteredEvents]);

  // ── Upcoming deadlines for sidebar ──
  const deadlines = useMemo(() => {
    const now = new Date();
    return filteredEvents
      .filter(e => new Date(e.date) >= now && ['exam', 'assignment', 'project', 'internal_assessment', 'lab_exam', 'class_test'].includes(e.eventType))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [filteredEvents]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar role="faculty" />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Academic Calendar" roleBadge="FACULTY" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-5 overflow-y-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Academic Calendar</h1>
              <p className="text-xs text-slate-500 mt-1">Manage academic events, exams, and deadlines for your classes.</p>
            </div>
            <button onClick={() => { setForm(emptyForm); setShowCreate(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all">
              <Plus className="w-4 h-4" /> Quick Add Event
            </button>
          </div>

          {/* Controls Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* View Toggle */}
            <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden">
              {([['month', 'Month'], ['week', 'Week'], ['day', 'Day']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-[11px] font-semibold transition-all ${view === v ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-all">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <h2 className="font-display text-[15px] font-bold text-slate-900 min-w-[160px] text-center">
                {MONTHS[month]} {year}
              </h2>
              <button onClick={() => navigate(1)} className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-all">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
              <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-200 hover:bg-indigo-100 transition-all ml-1">
                Today
              </button>
            </div>

            {/* Search + Filters */}
            <div className="flex items-center gap-2 flex-1 justify-end">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search events..."
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] outline-none focus:border-indigo-400 w-36 sm:w-44" />
              </div>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 outline-none">
                <option value="">All Types</option>
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 outline-none">
                <option value="">All Priority</option>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Main Content: Calendar + Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

            {/* Calendar Grid */}
            <div className="lg:col-span-3">
              {view === 'month' ? (
                <MonthView
                  year={year} month={month} eventsByDate={eventsByDate}
                  selectedDate={selectedDate} onSelectDate={setSelectedDate}
                  onEventClick={setSelectedEvent} onQuickAdd={quickAdd} today={today}
                />
              ) : view === 'week' ? (
                <WeekView
                  currentDate={currentDate} eventsByDate={eventsByDate}
                  onEventClick={setSelectedEvent} today={today}
                />
              ) : (
                <DayView
                  currentDate={currentDate} events={eventsByDate[formatDate(currentDate)] || []}
                  onEventClick={setSelectedEvent} today={today}
                />
              )}
            </div>

            {/* Sidebar: Upcoming + Deadlines */}
            <div className="space-y-4">
              {/* Upcoming Events */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-[13px] font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-indigo-600" /> Upcoming Events
                </h3>
                {upcoming.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-4">No upcoming events</p>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map(e => {
                      const meta = getEventTypeMeta(e.eventType);
                      const daysUntil = Math.ceil((new Date(e.date).getTime() - today.getTime()) / 86400000);
                      return (
                        <button key={e._id} onClick={() => setSelectedEvent(e)}
                          className="w-full text-left p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all group">
                          <div className="flex items-start gap-2">
                            <span className="text-sm mt-0.5">{meta.icon}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{e.title}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] font-mono text-slate-400">{e.date.slice(5)}</span>
                                {e.startTime && <span className="text-[9px] text-slate-400">· {e.startTime}</span>}
                              </div>
                            </div>
                            {daysUntil <= 3 && daysUntil >= 0 && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
                                style={{
                                  background: daysUntil === 0 ? 'rgba(255,77,94,0.1)' : 'rgba(255,170,0,0.1)',
                                  color: daysUntil === 0 ? '#FF4D5E' : '#FFAA00',
                                }}>
                                {daysUntil === 0 ? 'TODAY' : `${daysUntil}d`}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Upcoming Deadlines */}
              {deadlines.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <h3 className="text-[13px] font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Deadlines
                  </h3>
                  <div className="space-y-2">
                    {deadlines.map(e => {
                      const meta = getEventTypeMeta(e.eventType);
                      const daysUntil = Math.ceil((new Date(e.date).getTime() - today.getTime()) / 86400000);
                      const isPast = daysUntil < 0;
                      const isUrgent = daysUntil <= 2 && daysUntil >= 0;
                      return (
                        <button key={e._id} onClick={() => setSelectedEvent(e)}
                          className="w-full text-left p-2.5 rounded-xl border transition-all group"
                          style={{
                            borderColor: isPast ? 'rgba(255,77,94,0.3)' : isUrgent ? 'rgba(255,170,0,0.3)' : '#E2E8F0',
                            background: isPast ? 'rgba(255,77,94,0.03)' : isUrgent ? 'rgba(255,170,0,0.03)' : 'white',
                          }}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{meta.icon}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-slate-800 truncate">{e.title}</p>
                              <p className="text-[9px] text-slate-400">{e.subject || 'General'} · {e.date.slice(5)}</p>
                            </div>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
                              style={{
                                background: isPast ? 'rgba(255,77,94,0.1)' : isUrgent ? 'rgba(255,170,0,0.1)' : 'rgba(100,116,139,0.08)',
                                color: isPast ? '#FF4D5E' : isUrgent ? '#FFAA00' : '#64748B',
                              }}>
                              {isPast ? 'OVERDUE' : daysUntil === 0 ? 'TODAY' : `${daysUntil}d left`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Create/Edit Event Modal ── */}
      {(showCreate || showEdit) && (
        <EventModal
          form={showEdit ? {
            title: showEdit.title, description: showEdit.description, eventType: showEdit.eventType,
            priority: showEdit.priority, date: showEdit.date.slice(0, 10),
            startTime: showEdit.startTime, endTime: showEdit.endTime,
            subject: showEdit.subject, section: showEdit.section, venue: showEdit.venue,
            targetSections: showEdit.targetSections || [],
          } : form}
          setForm={showEdit ? (f: any) => setShowEdit({ ...showEdit, ...f } as AcademicEvent) : setForm}
          onSubmit={showEdit ? async () => {
            try {
              const res = await fetch('/api/academic-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update', eventId: showEdit._id, ...form }),
              });
              if (res.ok) { fetchEvents(); setShowEdit(null); setSelectedEvent(null); }
            } catch { /* ignore */ }
          } : handleCreate}
          onClose={() => { setShowCreate(false); setShowEdit(null); setCreateError(''); setCreateSuccess(''); }}
          isEdit={!!showEdit}
          loading={creating}
          success={createSuccess}
          error={createError}
        />
      )}

      {/* ── Event Details Modal ── */}
      {selectedEvent && !showCreate && !showEdit && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => { setShowEdit(selectedEvent); setSelectedEvent(null); }}
          onDelete={() => handleDelete(selectedEvent._id)}
        />
      )}
    </div>
  );
}

// ── Month View ────────────────────────────────────────────────────────────
function MonthView({ year, month, eventsByDate, selectedDate, onSelectDate, onEventClick, onQuickAdd, today }: {
  year: number; month: number; eventsByDate: Record<string, AcademicEvent[]>;
  selectedDate: Date | null; onSelectDate: (d: Date) => void;
  onEventClick: (e: AcademicEvent) => void; onQuickAdd: (d: Date) => void; today: Date;
}) {
  const cells = getDaysArray(year, month);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAYS_SHORT.map(d => (
          <div key={d} className="p-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d}</div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-slate-50 bg-slate-50/30" />;
          const key = formatDate(date);
          const dayEvents = eventsByDate[key] || [];
          const isToday = isSameDay(date, today);
          const isSelected = selectedDate && isSameDay(date, selectedDate);

          return (
            <div key={key}
              className={`min-h-[80px] border-b border-r border-slate-50 p-1 cursor-pointer transition-all hover:bg-indigo-50/30 ${isSelected ? 'bg-indigo-50/50' : ''}`}
              onClick={() => { onSelectDate(date); if (dayEvents.length === 0) onQuickAdd(date); }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[11px] font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
                  {date.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[9px] font-mono text-slate-400">{dayEvents.length}</span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(e => {
                  const meta = getEventTypeMeta(e.eventType);
                  return (
                    <button key={e._id} onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                      className="w-full text-left px-1.5 py-0.5 rounded text-[9px] font-medium truncate transition-all hover:opacity-80"
                      style={{ background: meta.color + '15', color: meta.color, borderLeft: `2px solid ${meta.color}` }}>
                      {e.title}
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <p className="text-[9px] text-slate-400 px-1">+{dayEvents.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ─────────────────────────────────────────────────────────────
function WeekView({ currentDate, eventsByDate, onEventClick, today }: {
  currentDate: Date; eventsByDate: Record<string, AcademicEvent[]>;
  onEventClick: (e: AcademicEvent) => void; today: Date;
}) {
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-slate-100">
        {weekDays.map(date => {
          const key = formatDate(date);
          const dayEvents = eventsByDate[key] || [];
          const isToday = isSameDay(date, today);

          return (
            <div key={key} className="min-h-[400px]">
              <div className={`p-2 text-center border-b border-slate-100 ${isToday ? 'bg-indigo-50' : ''}`}>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{DAYS_SHORT[date.getDay()]}</p>
                <p className={`text-[16px] font-bold ${isToday ? 'text-indigo-600' : 'text-slate-800'}`}>{date.getDate()}</p>
              </div>
              <div className="p-1.5 space-y-1">
                {dayEvents.map(e => {
                  const meta = getEventTypeMeta(e.eventType);
                  return (
                    <button key={e._id} onClick={() => onEventClick(e)}
                      className="w-full text-left p-2 rounded-lg border transition-all hover:shadow-sm"
                      style={{ borderColor: meta.color + '30', background: meta.color + '08' }}>
                      <p className="text-[10px] font-semibold truncate" style={{ color: meta.color }}>{e.title}</p>
                      {e.startTime && <p className="text-[9px] text-slate-400 mt-0.5">{e.startTime}</p>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day View ──────────────────────────────────────────────────────────────
function DayView({ currentDate, events, onEventClick, today }: {
  currentDate: Date; events: AcademicEvent[];
  onEventClick: (e: AcademicEvent) => void; today: Date;
}) {
  const isToday = isSameDay(currentDate, today);
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7AM to 8PM

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 className={`text-lg font-bold mb-4 ${isToday ? 'text-indigo-600' : 'text-slate-900'}`}>
        {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        {isToday && <span className="ml-2 text-xs font-mono text-indigo-400">TODAY</span>}
      </h3>
      {events.length === 0 ? (
        <div className="text-center py-12">
          <CalIcon className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No events scheduled for this day</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00')).map(e => {
            const meta = getEventTypeMeta(e.eventType);
            const prio = PRIORITIES.find(p => p.value === e.priority) || PRIORITIES[0];
            return (
              <button key={e._id} onClick={() => onEventClick(e)}
                className="w-full text-left p-4 rounded-xl border transition-all hover:shadow-md group"
                style={{ borderColor: meta.color + '30', borderLeftWidth: '3px' }}>
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{e.title}</p>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: prio.color + '15', color: prio.color }}>
                        {e.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                      {e.startTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{e.startTime}{e.endTime ? ` - ${e.endTime}` : ''}</span>}
                      {e.subject && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{e.subject}</span>}
                      {e.section && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{e.section}</span>}
                      {e.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.venue}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Event Modal (Create/Edit) ─────────────────────────────────────────────
function EventModal({ form, setForm, onSubmit, onClose, isEdit, loading, success, error }: {
  form: any; setForm: (f: any) => void; onSubmit: (e?: any) => void; onClose: () => void;
  isEdit: boolean; loading: boolean; success: string; error: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">{isEdit ? 'Edit Event' : 'Create Academic Event'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit(); }} className="p-5 space-y-4">
          {success && <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{success}</div>}
          {error && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>}

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Title *</label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Mid-1 Examination" className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Event Type *</label>
              <select value={form.eventType} onChange={e => setForm({ ...form, eventType: e.target.value })}
                className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none">
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none">
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Start Time</label>
              <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}
                className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">End Time</label>
              <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
                className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Subject</label>
              <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g. Digital Electronics" className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Venue</label>
              <input type="text" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })}
                placeholder="e.g. Room 301" className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Optional details..." className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs outline-none resize-none" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Target Sections (leave empty for all)</label>
            <div className="flex flex-wrap gap-1.5">
              {SECTIONS.map(s => (
                <button key={s} type="button" onClick={() => {
                  const ts = form.targetSections.includes(s)
                    ? form.targetSections.filter((x: string) => x !== s)
                    : [...form.targetSections, s];
                  setForm({ ...form, targetSections: ts });
                }}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-all ${form.targetSections.includes(s) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Update Event' : 'Publish Event'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Event Details Modal ───────────────────────────────────────────────────
function EventDetailsModal({ event, onClose, onEdit, onDelete }: {
  event: AcademicEvent; onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const meta = getEventTypeMeta(event.eventType);
  const prio = PRIORITIES.find(p => p.value === event.priority) || PRIORITIES[0];
  const daysUntil = Math.ceil((new Date(event.date).getTime() - Date.now()) / 86400000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        {/* Header with event type color */}
        <div className="p-5 border-b border-slate-200 relative" style={{ borderLeftWidth: '4px', borderLeftColor: meta.color }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{meta.icon}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${meta.bg}`}>{meta.label}</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{ background: prio.color + '15', color: prio.color }}>
                  {event.priority.toUpperCase()}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">{event.title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
          </div>
          {daysUntil >= 0 && (
            <span className="text-[11px] font-mono mt-2 inline-block px-2 py-0.5 rounded-lg"
              style={{ background: daysUntil <= 2 ? 'rgba(255,170,0,0.1)' : 'rgba(100,116,139,0.08)', color: daysUntil <= 2 ? '#FFAA00' : '#64748B' }}>
              {daysUntil === 0 ? '🟢 Today' : daysUntil === 1 ? '🟡 Tomorrow' : `🔵 ${daysUntil} days remaining`}
            </span>
          )}
        </div>

        <div className="p-5 space-y-3">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: CalIcon, label: 'Date', value: new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) },
              { icon: Clock, label: 'Time', value: event.startTime ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ''}` : 'Not specified' },
              { icon: BookOpen, label: 'Subject', value: event.subject || 'General' },
              { icon: Users, label: 'Section', value: event.section || event.targetSections?.join(', ') || 'All sections' },
              { icon: MapPin, label: 'Venue', value: event.venue || 'Not specified' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                  <p className="text-[11px] text-slate-700 font-medium">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {event.description && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</p>
              <p className="text-[12px] text-slate-700 leading-relaxed">{event.description}</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>Created by {event.createdBy?.name || 'Faculty'}</span>
            <span>·</span>
            <span>{new Date(event.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2">
          <button onClick={onDelete}
            className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button onClick={onEdit}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5">
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}
