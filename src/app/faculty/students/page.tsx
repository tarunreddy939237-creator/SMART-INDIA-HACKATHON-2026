'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Send, AlertTriangle, CheckCircle2,
  Mail, BookOpen, CalendarCheck, Award, X, Bell, Star, AlertCircle, Pencil, Save, BarChart2,
} from 'lucide-react';
import Sidebar   from '@/components/dashboard/Sidebar';
import Topbar    from '@/components/dashboard/Topbar';
import HealthAura from '@/components/dashboard/HealthAura';

const SECTIONS: Record<string, string[]> = {
  CSE:   ['CSE-A',   'CSE-B',   'CSE-C'],
  ECE:   ['ECE-A',   'ECE-B',   'ECE-C'],
  IT:    ['IT-A',    'IT-B',    'IT-C'],
  AI:    ['AI-A',    'AI-B',    'AI-C'],
  MECH:  ['MECH-A',  'MECH-B',  'MECH-C'],
  CIVIL: ['CIVIL-A', 'CIVIL-B', 'CIVIL-C'],
};
const ALL_SECTIONS = ['All', ...Object.values(SECTIONS).flat()];

const NOTICE_TYPES = [
  { value: 'notice',       label: 'Notice',       icon: Bell,          color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { value: 'warning',      label: 'Warning',      icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'urgent',       label: 'Urgent',       icon: AlertCircle,   color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { value: 'appreciation', label: 'Appreciation', icon: Star,          color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
];

const RISK_VARIANT: Record<string, 'red' | 'amber' | 'emerald'> = {
  High: 'red', Medium: 'amber', Low: 'emerald',
};

/** Map risk tier string to a representative 0-100 score for the aura */
function tierToScore(tier: string | undefined): number | null {
  if (!tier) return null;
  if (tier === 'High') return 75;
  if (tier === 'Medium') return 45;
  if (tier === 'Low') return 15;
  return null;
}

interface Student {
  id: string; name: string; email: string;
  classOrSubject: string;
  rollNumber?: string; yearOfStudy?: number;
  subjects: string[]; labs: string[];
  attendancePct: number; avgQuizScore: number;
  riskTier?: string; riskScore?: number; successScore?: number | null;
}

interface NoticeForm { type: string; subject: string; message: string; }

const EMPTY_SUBJECTS = ['', '', '', '', ''];
const EMPTY_LABS     = ['', '', ''];

export default function FacultyStudentsPage() {
  const [section, setSection]         = useState('All');
  const [students, setStudents]       = useState<Student[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState<Student | null>(null);
  const [sentNotices, setSentNotices] = useState<any[]>([]);
  const [form, setForm]               = useState<NoticeForm>({ type: 'notice', subject: '', message: '' });
  const [sending, setSending]         = useState(false);
  const [sendSuccess, setSendSuccess] = useState('');
  const [sendError, setSendError]     = useState('');

  // Subject/lab editing
  const [editingSubjects, setEditingSubjects] = useState(false);
  const [draftSubjects, setDraftSubjects]     = useState<string[]>(EMPTY_SUBJECTS);
  const [draftLabs, setDraftLabs]             = useState<string[]>(EMPTY_LABS);
  const [savingSubjects, setSavingSubjects]   = useState(false);
  const [subjectMsg, setSubjectMsg]           = useState('');

  // Send to parent state
  const [sendParentModal, setSendParentModal] = useState(false);
  const [sendParentStudent, setSendParentStudent] = useState<Student | null>(null);
  const [sendParentChannel, setSendParentChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [sendParentLoading, setSendParentLoading] = useState(false);
  const [sendParentResult, setSendParentResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadStudents = useCallback(async (sec: string) => {
    setLoading(true);
    try {
      const url = sec === 'All' ? '/api/students' : `/api/students?section=${sec}`;
      const res  = await fetch(url);
      const data = await res.json();
      const list: Student[] = (data.students || []).map((s: any) => ({
        id:             s.id,
        name:           s.name,
        email:          s.email || '—',
        classOrSubject: s.classOrSubject || sec,
        subjects:       s.subjects || [],
        labs:           s.labs     || [],
        attendancePct:  s.attendancePct  ?? 0,
        avgQuizScore:   s.avgQuizScore   ?? 0,
        riskTier:       s.riskTier,
        riskScore:      s.riskScore,
        successScore:   s.successScore,
      }));
      setStudents(list);
    } catch { setStudents([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStudents(section); }, [section, loadStudents]);

  const openStudent = async (s: Student) => {
    setSelected(s);
    setForm({ type: 'notice', subject: '', message: '' });
    setSendSuccess(''); setSendError(''); setSubjectMsg('');
    setEditingSubjects(false);
    // Pad to fixed lengths
    setDraftSubjects([...s.subjects, ...EMPTY_SUBJECTS].slice(0, 5));
    setDraftLabs([...s.labs, ...EMPTY_LABS].slice(0, 3));
    try {
      const res  = await fetch(`/api/notices?studentId=${s.id}`);
      const data = await res.json();
      setSentNotices(data.notices || []);
    } catch { setSentNotices([]); }
  };

  const handleSaveSubjects = async () => {
    if (!selected) return;
    setSavingSubjects(true); setSubjectMsg('');
    try {
      const subjects = draftSubjects.map(s => s.trim()).filter(Boolean);
      const labs     = draftLabs.map(l => l.trim()).filter(Boolean);
      if (subjects.length < 5) { setSubjectMsg('Please fill all 5 subjects.'); setSavingSubjects(false); return; }
      if (labs.length < 3)     { setSubjectMsg('Please fill all 3 labs.');     setSavingSubjects(false); return; }
      const res  = await fetch('/api/students', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selected.id, subjects, labs }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubjectMsg('Subjects saved successfully!');
        // Update local state
        const updated = { ...selected, subjects, labs };
        setSelected(updated);
        setStudents(prev => prev.map(s => s.id === selected.id ? { ...s, subjects, labs } : s));
        setEditingSubjects(false);
        setTimeout(() => setSubjectMsg(''), 3000);
      } else { setSubjectMsg(data.error || 'Failed to save.'); }
    } catch { setSubjectMsg('Network error.'); }
    finally { setSavingSubjects(false); }
  };

  const handleSendToParent = (student: Student) => {
    setSendParentStudent(student);
    setSendParentChannel('whatsapp');
    setSendParentResult(null);
    setSendParentModal(true);
  };

  const handleConfirmSendToParent = async () => {
    if (!sendParentStudent) return;
    setSendParentLoading(true);
    setSendParentResult(null);
    try {
      const res = await fetch('/api/communication/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: sendParentStudent.id, channel: sendParentChannel }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSendParentResult({ success: true, message: data.message });
      } else {
        setSendParentResult({ success: false, message: data.error || 'Failed to send.' });
      }
    } catch {
      setSendParentResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setSendParentLoading(false);
    }
  };

  const handleSendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !form.subject.trim() || !form.message.trim()) {
      setSendError('Subject and message are required.'); return;
    }
    setSending(true); setSendError('');
    try {
      const res  = await fetch('/api/notices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selected.id, ...form }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSendSuccess(`Notice sent to ${selected.name}!`);
        setForm({ type: 'notice', subject: '', message: '' });
        setSentNotices(prev => [data.notice, ...prev]);
        setTimeout(() => setSendSuccess(''), 4000);
      } else { setSendError(data.error || 'Failed to send.'); }
    } catch { setSendError('Network error.'); }
    finally { setSending(false); }
  };

  const filtered = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total:   students.length,
    high:    students.filter(s => s.riskTier === 'High').length,
    below75: students.filter(s => s.attendancePct < 75).length,
    avgAtt:  students.length ? Math.round(students.reduce((a, s) => a + s.attendancePct, 0) / students.length) : 0,
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar role="faculty" />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Enrolled Students" roleBadge="FACULTY" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-5 overflow-y-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Enrolled Students</h1>
              <p className="text-xs text-slate-500 mt-1">View student details, edit subjects, and send individual notices.</p>
            </div>
            <select value={section} onChange={e => setSection(e.target.value)}
              className="bg-white border border-slate-300 text-xs font-semibold text-slate-800 rounded-xl px-3 py-2 outline-none shadow-sm">
              {ALL_SECTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Enrolled', value: stats.total,        color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
              { label: 'Avg Attendance', value: `${stats.avgAtt}%`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
              { label: 'High Risk',      value: stats.high,         color: 'text-rose-700 bg-rose-50 border-rose-200' },
              { label: 'Below 75%',      value: stats.below75,      color: 'text-amber-700 bg-amber-50 border-amber-200' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{s.label}</p>
                <p className="text-2xl font-black mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 rounded-xl text-xs outline-none" />
          </div>

          {/* Student Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No students found for {section}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(s => (
                <div key={s.id} onClick={() => openStudent(s)}
                  className="bg-white border border-slate-200 rounded-2xl cursor-pointer hover:shadow-md transition-all group">
                  <HealthAura
                    riskScore={s.riskScore ?? tierToScore(s.riskTier)}
                    displayValue={`${s.attendancePct}%`}
                    name={s.name}
                    subtitle={`${s.rollNumber ? s.rollNumber + ' · ' : ''}${s.classOrSubject}`}
                    size="sm"
                    tier={s.riskTier}
                    interactive={false}
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── Student Detail Modal ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                  {selected.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{selected.name}</h2>
                  <p className="text-xs text-slate-500">{selected.email} · {selected.rollNumber ? `Roll: ${selected.rollNumber} · ` : ''}{selected.classOrSubject}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Attendance</p>
                  <p className={`text-xl font-black mt-1 ${selected.attendancePct >= 85 ? 'text-emerald-700' : selected.attendancePct >= 75 ? 'text-amber-700' : 'text-rose-700'}`}>{selected.attendancePct}%</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Quiz Avg</p>
                  <p className="text-xl font-black mt-1 text-indigo-700">{selected.avgQuizScore}%</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Risk</p>
                  <p className={`text-xl font-black mt-1 ${selected.riskTier === 'High' ? 'text-rose-700' : selected.riskTier === 'Medium' ? 'text-amber-700' : 'text-emerald-700'}`}>{selected.riskTier || '—'}</p>
                </div>
              </div>

              {/* ── Report Actions ── */}
              <div className="flex gap-2">
                <a href={`/api/student-report?studentId=${selected.id}`}
                  target="_blank"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all"
                >
                  <BarChart2 className="w-3.5 h-3.5" /> View Report
                </a>
                <button
                  onClick={() => handleSendToParent(selected)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all"
                >
                  <Send className="w-3.5 h-3.5" /> Send to Parent
                </button>
              </div>

              {/* ── Subjects & Labs Editor ── */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> Subjects & Labs
                  </h3>
                  {!editingSubjects ? (
                    <button onClick={() => setEditingSubjects(true)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingSubjects(false); setSubjectMsg(''); }}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100">
                        Cancel
                      </button>
                      <button onClick={handleSaveSubjects} disabled={savingSubjects}
                        className="flex items-center gap-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1 rounded-lg transition-colors">
                        <Save className="w-3 h-3" />{savingSubjects ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>

                {subjectMsg && (
                  <p className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${subjectMsg.includes('success') ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                    {subjectMsg}
                  </p>
                )}

                {/* Theory Subjects */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Theory Subjects (5)</p>
                  <div className="space-y-1.5">
                    {(editingSubjects ? draftSubjects : [...selected.subjects, ...EMPTY_SUBJECTS].slice(0, 5)).map((sub, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 w-4 shrink-0">{i + 1}.</span>
                        {editingSubjects ? (
                          <input value={draftSubjects[i] || ''} onChange={e => {
                            const next = [...draftSubjects]; next[i] = e.target.value; setDraftSubjects(next);
                          }} placeholder={`Subject ${i + 1}`}
                            className="flex-1 bg-white border border-slate-300 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs outline-none" />
                        ) : (
                          <span className={`text-xs px-2.5 py-1 rounded-lg border flex-1 ${sub ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-100 border-slate-100 text-slate-400 italic'}`}>
                            {sub || 'Not assigned'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Labs */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Lab Subjects (3)</p>
                  <div className="space-y-1.5">
                    {(editingSubjects ? draftLabs : [...selected.labs, ...EMPTY_LABS].slice(0, 3)).map((lab, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 w-4 shrink-0">{i + 1}.</span>
                        {editingSubjects ? (
                          <input value={draftLabs[i] || ''} onChange={e => {
                            const next = [...draftLabs]; next[i] = e.target.value; setDraftLabs(next);
                          }} placeholder={`Lab ${i + 1}`}
                            className="flex-1 bg-white border border-slate-300 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs outline-none" />
                        ) : (
                          <span className={`text-xs px-2.5 py-1 rounded-lg border flex-1 ${lab ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-100 border-slate-100 text-slate-400 italic'}`}>
                            {lab || 'Not assigned'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Send Notice Form */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Send className="w-3.5 h-3.5 text-indigo-600" /> Send Individual Notice
                </h3>
                {sendSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />{sendSuccess}
                  </div>
                )}
                {sendError && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{sendError}</div>}
                <form onSubmit={handleSendNotice} className="space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    {NOTICE_TYPES.map(t => {
                      const Icon = t.icon;
                      const active = form.type === t.value;
                      return (
                        <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, type: t.value }))}
                          className={`py-1.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${active ? t.color + ' ring-1 ring-current/40' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          <Icon className="w-3 h-3" />{t.label}
                        </button>
                      );
                    })}
                  </div>
                  <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Subject (e.g. Attendance Warning)"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs outline-none" />
                  <textarea rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Write your message to the student..."
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs outline-none resize-none" />
                  <button type="submit" disabled={sending}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2">
                    <Send className="w-3.5 h-3.5" />{sending ? 'Sending...' : 'Send Notice'}
                  </button>
                </form>
              </div>

              {/* Previous notices */}
              {sentNotices.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" /> Previous Notices ({sentNotices.length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {sentNotices.map((n: any, i: number) => {
                      const meta = NOTICE_TYPES.find(t => t.value === n.type) || NOTICE_TYPES[0];
                      const Icon = meta.icon;
                      return (
                        <div key={i} className={`p-3 rounded-xl border text-xs ${meta.color}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold flex items-center gap-1"><Icon className="w-3 h-3" />{n.subject}</span>
                            <span className="text-[10px] opacity-70">{new Date(n.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="opacity-80 leading-relaxed">{n.message}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Send to Parent Modal ── */}
      {sendParentModal && sendParentStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <h3 className="text-base font-bold text-slate-900">Send Report to Parent</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Student:</span><span className="font-medium text-slate-900">{sendParentStudent.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Roll:</span><span className="font-medium text-slate-900">{sendParentStudent.rollNumber || '—'}</span></div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Channel</label>
              <div className="flex gap-2">
                <button onClick={() => setSendParentChannel('whatsapp')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${sendParentChannel === 'whatsapp' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                  📱 WhatsApp
                </button>
                <button onClick={() => setSendParentChannel('sms')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${sendParentChannel === 'sms' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                  💬 SMS
                </button>
              </div>
            </div>

            {sendParentResult && (
              <div className={`p-3 rounded-lg text-sm ${sendParentResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {sendParentResult.success ? '✅' : '❌'} {sendParentResult.message}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleConfirmSendToParent} disabled={sendParentLoading}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all">
                {sendParentLoading ? 'Sending...' : 'Send Report'}
              </button>
              <button onClick={() => setSendParentModal(false)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
