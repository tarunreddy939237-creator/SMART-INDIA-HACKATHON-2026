'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, Clock, Users, FileText, Settings,
  Loader2, CheckCircle, AlertCircle, Video, ChevronDown,
} from 'lucide-react';

export default function CreateMeetingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    agenda: '',
    scheduledDate: '',
    scheduledStartTime: '',
    expectedDuration: '60',
    branch: '',
    year: '',
    section: '',
    visibility: 'class',
    allowStudentScreenShare: false,
    enableRecording: false,
  });

  // Get today's date as minimum
  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.title || !form.scheduledDate || !form.scheduledStartTime) {
      setError('Please fill in title, date, and start time');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          expectedDuration: parseInt(form.expectedDuration),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create meeting');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/meet');
      }, 2000);
    } catch (err) {
      setError('Failed to create meeting. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-800/60 border border-green-500/30 rounded-2xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Meeting Created!</h2>
          <p className="text-gray-400">Your meeting has been scheduled successfully.</p>
          <p className="text-sm text-gray-500 mt-2">Redirecting to meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-gray-800/60 border border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Video className="w-6 h-6 text-indigo-400" />
              </div>
              Create Meeting
            </h1>
            <p className="text-gray-400 mt-2 ml-15">Schedule a new meeting for your class</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Meeting Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Meeting Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., DSA Review Session"
                  className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the meeting..."
                  rows={3}
                  className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Agenda</label>
                <textarea
                  value={form.agenda}
                  onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))}
                  placeholder="Meeting agenda items..."
                  rows={3}
                  className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              Schedule
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Date *</label>
                <input
                  type="date"
                  value={form.scheduledDate}
                  min={today}
                  onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                  className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Start Time *</label>
                <input
                  type="time"
                  value={form.scheduledStartTime}
                  onChange={e => setForm(f => ({ ...f, scheduledStartTime: e.target.value }))}
                  className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Duration</label>
                <select
                  value={form.expectedDuration}
                  onChange={e => setForm(f => ({ ...f, expectedDuration: e.target.value }))}
                  className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none appearance-none"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                  <option value="180">3 hours</option>
                </select>
              </div>
            </div>
          </div>

          {/* Target Audience */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Target Audience
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Branch / Department</label>
                <input
                  type="text"
                  value={form.branch}
                  onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                  placeholder="e.g., CSE"
                  className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Year</label>
                <input
                  type="text"
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  placeholder="e.g., 2nd Year"
                  className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Section</label>
                <input
                  type="text"
                  value={form.section}
                  onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                  placeholder="e.g., A"
                  className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Students matching the above criteria will be automatically invited to this meeting.
              Leave all fields empty to invite all students.
            </p>
          </div>

          {/* Settings */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              Settings
            </h2>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allowStudentScreenShare}
                  onChange={e => setForm(f => ({ ...f, allowStudentScreenShare: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-white text-sm font-medium">Allow Student Screen Sharing</p>
                  <p className="text-gray-500 text-xs">Students can share their screen during the meeting</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enableRecording}
                  onChange={e => setForm(f => ({ ...f, enableRecording: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-white text-sm font-medium">Enable Recording</p>
                  <p className="text-gray-500 text-xs">Allow meeting recording (if supported)</p>
                </div>
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-xl border border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-600 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Video className="w-5 h-5" />
                  Create Meeting
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
