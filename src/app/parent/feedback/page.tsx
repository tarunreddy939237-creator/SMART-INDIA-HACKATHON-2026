'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Send, Clock, CheckCircle2, AlertCircle,
  ChevronDown, Plus, Filter,
} from 'lucide-react';

interface FeedbackItem {
  _id: string;
  category: string;
  subject: string;
  message: string;
  priority: string;
  status: string;
  facultyResponse: string;
  respondedAt: string;
  createdAt: string;
}

const CATEGORIES = [
  { value: 'academic', label: 'Academic' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'behaviour', label: 'Behaviour' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'general', label: 'General' },
];

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  submitted: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'Submitted' },
  reviewed:  { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Reviewed' },
  responded: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Responded' },
  resolved:  { color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200', label: 'Resolved' },
};

export default function ParentFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  // Form state
  const [form, setForm] = useState({ category: 'academic', subject: '', message: '', priority: 'medium' });
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => { fetchFeedbacks(); }, []);

  const fetchFeedbacks = async () => {
    try {
      const res = await fetch('/api/parent/feedback');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setFeedbacks(data.feedback || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      setFormError('Subject and message are required.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/parent/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      setSuccessMsg('Feedback submitted successfully!');
      setForm({ category: 'academic', subject: '', message: '', priority: 'medium' });
      setShowForm(false);
      fetchFeedbacks();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit feedback.');
    } finally { setSubmitting(false); }
  };

  const filtered = filterStatus === 'all' ? feedbacks : feedbacks.filter(f => f.status === filterStatus);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Feedback</h1>
          <p className="text-sm text-slate-500 mt-1">Submit feedback to faculty and track responses</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
          <Plus className="w-4 h-4" />
          New Feedback
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {/* New Feedback Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Submit New Feedback</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Subject</label>
            <input type="text" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              placeholder="Brief subject line"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Message</label>
            <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              rows={4} placeholder="Describe your feedback..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none" />
          </div>

          {formError && <p className="text-xs text-rose-600">{formError}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all">
              <Send className="w-3.5 h-3.5" /> {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        {['all', 'submitted', 'reviewed', 'responded', 'resolved'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filterStatus === s ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Feedback List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-white border border-slate-200">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No feedback yet. Click "New Feedback" to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(fb => {
            const statusCfg = STATUS_CONFIG[fb.status] || STATUS_CONFIG.submitted;
            return (
              <div key={fb._id} className="rounded-2xl bg-white border border-slate-200 p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-600">
                      {fb.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusCfg.bg} ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                    {fb.priority === 'high' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200">High Priority</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(fb.createdAt).toLocaleDateString()}</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">{fb.subject}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{fb.message}</p>

                {fb.facultyResponse && (
                  <div className="mt-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                    <p className="text-[10px] font-semibold text-indigo-700 uppercase mb-1">Faculty Response</p>
                    <p className="text-xs text-slate-700">{fb.facultyResponse}</p>
                    {fb.respondedAt && (
                      <p className="text-[10px] text-slate-400 mt-1">Responded {new Date(fb.respondedAt).toLocaleDateString()}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
