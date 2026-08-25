'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
  Calendar as CalIcon, ChevronLeft, ChevronRight, Clock, MapPin, BookOpen,
  CalendarDays, Target, AlertCircle, CheckCircle2, ArrowRight, List, LayoutGrid,
  Loader2, Bell,
} from 'lucide-react';
import StudentSidebar from '@/components/dashboard/StudentSidebar';
import StudentTopbar from '@/components/dashboard/StudentTopbar';

const EVENT_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  exam: { label: 'Exam', icon: '📝', color: 'var(--ev-rose)' },
  assignment: { label: 'Assignment', icon: '📋', color: 'var(--ev-indigo)' },
  project: { label: 'Project', icon: '🚀', color: '#8B5CF6' },
  internal_assessment: { label: 'Internal', icon: '📊', color: 'var(--ev-amber)' },
  lab_exam: { label: 'Lab Exam', icon: '🔬', color: 'var(--ev-emerald)' },
  class_test: { label: 'Class Test', icon: '✏️', color: '#06B6D4' },
  workshop: { label: 'Workshop', icon: '🔧', color: '#F97316' },
  seminar: { label: 'Seminar', icon: '🎤', color: '#EC4899' },
  holiday: { label: 'Holiday', icon: '🏖️', color: '#14B8A6' },
  college_event: { label: 'College Event', icon: '🏛️', color: '#6366F1' },
  other: { label: 'Other', icon: '📌', color: '#64748B' },
};

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDate(d: Date) { return d.toISOString().slice(0, 10); }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getDaysArray(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  return cells;
}

export default function StudentCalendarPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const today = new Date();

  // Fetch events + tasks
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, tasksRes] = await Promise.all([
        fetch('/api/academic-events?upcoming=true', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ events: [] })),
        fetch('/api/class-tasks', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ tasks: [] })),
      ]);
      setEvents(eventsRes.events || []);
      setTasks(tasksRes.tasks || []);
    } catch { /* keep defaults */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    events.forEach(e => {
      const key = e.date?.slice(0, 10);
      if (key) { if (!map[key]) map[key] = []; map[key].push(e); }
    });
    // Also add tasks as events
    tasks.forEach(t => {
      const key = t.dueDate?.slice(0, 10);
      if (key) {
        if (!map[key]) map[key] = [];
        map[key].push({
          ...t,
          eventType: t.taskType || 'assignment',
          title: t.title,
          isTask: true,
          completed: t.completion?.completed,
        });
      }
    });
    return map;
  }, [events, tasks]);

  const todayEvents = useMemo(() => {
    const key = formatDate(today);
    return eventsByDate[key] || [];
  }, [eventsByDate]);

  const upcoming = useMemo(() => {
    const todayStr = formatDate(today);
    return events
      .filter(e => e.date?.slice(0, 10) >= todayStr)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [events]);

  const pendingTasks = useMemo(() => tasks.filter((t: any) => !t.completion?.completed), [tasks]);

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  return (
    <div className="flex min-h-screen text-slate-900" style={{ background: 'var(--ev-bg)' }}>
      <StudentSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <StudentTopbar title="Academic Calendar" subtitle="Your events, tasks, and deadlines" />

        <main className="flex-1 p-4 lg:p-6 xl:p-8 space-y-5 overflow-y-auto">

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden">
              {([['month', 'Month'], ['week', 'Week'], ['day', 'Day']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-[11px] font-semibold transition-all ${view === v ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <h2 className="font-display text-[15px] font-bold text-slate-900 min-w-[160px] text-center">
                {MONTHS[month]} {year}
              </h2>
              <button onClick={() => navigate(1)} className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
              <button onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-200 hover:bg-indigo-100 ml-1">
                Today
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Calendar */}
            <div className="lg:col-span-3">
              {view === 'month' ? (
                <MonthView year={year} month={month} eventsByDate={eventsByDate} selectedDate={null}
                  onEventClick={setSelectedEvent} today={today} />
              ) : view === 'week' ? (
                <WeekView currentDate={currentDate} eventsByDate={eventsByDate} onEventClick={setSelectedEvent} today={today} />
              ) : (
                <DayView currentDate={currentDate} events={eventsByDate[formatDate(currentDate)] || []} onEventClick={setSelectedEvent} today={today} />
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Today's Tasks */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-[13px] font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} /> Today&apos;s Tasks
                </h3>
                {pendingTasks.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-3">No pending tasks</p>
                ) : (
                  <div className="space-y-2">
                    {pendingTasks.slice(0, 4).map((t: any) => (
                      <div key={t._id} className="p-2.5 rounded-xl border border-slate-100 text-[11px]">
                        <p className="font-semibold text-slate-800 truncate">{t.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{t.subject} · {t.dueTime || 'By end of day'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming Events */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-[13px] font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} /> Upcoming
                </h3>
                {upcoming.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-3">No upcoming events</p>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map((e: any) => {
                      const meta = EVENT_TYPES[e.eventType] || EVENT_TYPES.other;
                      const daysUntil = Math.ceil((new Date(e.date).getTime() - today.getTime()) / 86400000);
                      return (
                        <button key={e._id} onClick={() => setSelectedEvent(e)}
                          className="w-full text-left p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all group">
                          <div className="flex items-start gap-2">
                            <span className="text-sm mt-0.5">{meta.icon}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{e.title}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] font-mono text-slate-400">{e.date?.slice(5)}</span>
                                {e.startTime && <span className="text-[9px] text-slate-400">· {e.startTime}</span>}
                              </div>
                            </div>
                            {daysUntil <= 3 && daysUntil >= 0 && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
                                style={{ background: daysUntil === 0 ? 'rgba(255,77,94,0.1)' : 'rgba(255,170,0,0.1)', color: daysUntil === 0 ? '#FF4D5E' : '#FFAA00' }}>
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
            </div>
          </div>
        </main>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{(EVENT_TYPES[selectedEvent.eventType] || EVENT_TYPES.other).icon}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{
                  background: (EVENT_TYPES[selectedEvent.eventType] || EVENT_TYPES.other).color + '15',
                  color: (EVENT_TYPES[selectedEvent.eventType] || EVENT_TYPES.other).color,
                }}>{(EVENT_TYPES[selectedEvent.eventType] || EVENT_TYPES.other).label}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">{selectedEvent.title}</h2>
            </div>
            <div className="p-5 space-y-3 text-[12px]">
              {selectedEvent.date && (
                <div className="flex items-center gap-2 text-slate-600">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              )}
              {selectedEvent.startTime && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {selectedEvent.startTime}{selectedEvent.endTime ? ` - ${selectedEvent.endTime}` : ''}
                </div>
              )}
              {selectedEvent.subject && (
                <div className="flex items-center gap-2 text-slate-600">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />{selectedEvent.subject}
                </div>
              )}
              {selectedEvent.venue && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />{selectedEvent.venue}
                </div>
              )}
              {selectedEvent.description && (
                <p className="text-slate-500 leading-relaxed pt-2 border-t border-slate-100">{selectedEvent.description}</p>
              )}
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Month View ──
function MonthView({ year, month, eventsByDate, selectedDate, onEventClick, today }: {
  year: number; month: number; eventsByDate: Record<string, any[]>; selectedDate: Date | null;
  onEventClick: (e: any) => void; today: Date;
}) {
  const cells = getDaysArray(year, month);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAYS_SHORT.map(d => <div key={d} className="p-2 text-center text-[10px] font-bold text-slate-400 uppercase">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} className="min-h-[72px] border-b border-r border-slate-50 bg-slate-50/30" />;
          const key = formatDate(date);
          const dayEvents = eventsByDate[key] || [];
          const isToday = isSameDay(date, today);
          return (
            <div key={key} className={`min-h-[72px] border-b border-r border-slate-50 p-1 ${isToday ? 'bg-indigo-50/30' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[11px] font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
                  {date.getDate()}
                </span>
                {dayEvents.length > 0 && <span className="text-[9px] font-mono text-slate-400">{dayEvents.length}</span>}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e: any) => {
                  const meta = EVENT_TYPES[e.eventType] || EVENT_TYPES.other;
                  return (
                    <button key={e._id} onClick={() => onEventClick(e)}
                      className="w-full text-left px-1.5 py-0.5 rounded text-[9px] font-medium truncate hover:opacity-80"
                      style={{ background: meta.color + '15', color: meta.color, borderLeft: `2px solid ${meta.color}` }}>
                      {e.title}
                    </button>
                  );
                })}
                {dayEvents.length > 3 && <p className="text-[9px] text-slate-400 px-1">+{dayEvents.length - 3}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ──
function WeekView({ currentDate, eventsByDate, onEventClick, today }: {
  currentDate: Date; eventsByDate: Record<string, any[]>; onEventClick: (e: any) => void; today: Date;
}) {
  const start = new Date(currentDate);
  start.setDate(currentDate.getDate() - currentDate.getDay());
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-slate-100">
        {days.map(date => {
          const key = formatDate(date);
          const dayEvts = eventsByDate[key] || [];
          const isToday = isSameDay(date, today);
          return (
            <div key={key} className="min-h-[350px]">
              <div className={`p-2 text-center border-b border-slate-100 ${isToday ? 'bg-indigo-50' : ''}`}>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{DAYS_SHORT[date.getDay()]}</p>
                <p className={`text-[14px] font-bold ${isToday ? 'text-indigo-600' : 'text-slate-800'}`}>{date.getDate()}</p>
              </div>
              <div className="p-1 space-y-1">
                {dayEvts.map((e: any) => {
                  const meta = EVENT_TYPES[e.eventType] || EVENT_TYPES.other;
                  return (
                    <button key={e._id} onClick={() => onEventClick(e)}
                      className="w-full text-left p-1.5 rounded-lg border transition-all hover:shadow-sm"
                      style={{ borderColor: meta.color + '30', background: meta.color + '08' }}>
                      <p className="text-[9px] font-semibold truncate" style={{ color: meta.color }}>{e.title}</p>
                      {e.startTime && <p className="text-[8px] text-slate-400">{e.startTime}</p>}
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

// ── Day View ──
function DayView({ currentDate, events, onEventClick, today }: {
  currentDate: Date; events: any[]; onEventClick: (e: any) => void; today: Date;
}) {
  const isToday = isSameDay(currentDate, today);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 className={`text-lg font-bold mb-4 ${isToday ? 'text-indigo-600' : 'text-slate-900'}`}>
        {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        {isToday && <span className="ml-2 text-xs font-mono text-indigo-400">TODAY</span>}
      </h3>
      {events.length === 0 ? (
        <div className="text-center py-12">
          <CalIcon className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No events for this day</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.sort((a: any, b: any) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00')).map((e: any) => {
            const meta = EVENT_TYPES[e.eventType] || EVENT_TYPES.other;
            return (
              <button key={e._id} onClick={() => onEventClick(e)}
                className="w-full text-left p-4 rounded-xl border border-slate-100 transition-all hover:shadow-md group"
                style={{ borderLeftWidth: '3px', borderLeftColor: meta.color }}>
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{e.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                      {e.startTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{e.startTime}</span>}
                      {e.subject && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{e.subject}</span>}
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
