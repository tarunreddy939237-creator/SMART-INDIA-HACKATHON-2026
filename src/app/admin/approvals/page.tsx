'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Users, GraduationCap, CheckCircle2, XCircle,
  Search, RefreshCw, AlertCircle, Clock, ChevronDown, ChevronUp,
  Check, X, UserCheck, Eye, Mail, Hash, BookOpen, Building2,
  Filter,
} from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Topbar from '@/components/dashboard/Topbar';

type PendingUser = {
  _id: string;
  name: string;
  email: string;
  role: string;
  collegeName: string;
  rollNumber: string;
  facultyId: string;
  department: string;
  branch: string;
  section: string;
  yearOfStudy: number;
  classOrSubject: string;
  createdAt: string;
  accountStatus: string;
};

export default function AccountApprovalsPage() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'all' | 'student' | 'faculty'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; userId: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewAll, setViewAll] = useState(false); // show all statuses, not just pending

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('role', filter);
      if (search) params.set('search', search);
      if (viewAll) params.set('status', 'all');

      const res = await fetch(`/api/colleges/pending?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setPendingUsers(data.users || []);
      } else {
        // Show the error but still set empty list so UI renders
        if (data.error) setError(`API: ${data.error}`);
        setPendingUsers([]);
      }
    } catch { setError('Failed to load data.'); }
    finally { setLoading(false); }
  }, [filter, search, viewAll]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    setError('');
    try {
      const res = await fetch('/api/colleges/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to approve.'); return; }
      setSuccess(data.message);
      setPendingUsers(prev => prev.filter(u => u._id !== userId));
      setConfirmAction(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Network error.'); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (userId: string, reason: string) => {
    setActionLoading(userId);
    setError('');
    try {
      const res = await fetch('/api/colleges/reject', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason: reason.trim() || 'Registration not approved' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to reject.'); return; }
      setSuccess(data.message);
      setPendingUsers(prev => prev.filter(u => u._id !== userId));
      setConfirmAction(null);
      setRejectReason('');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Network error.'); }
    finally { setActionLoading(null); }
  };

  const pendingCount = pendingUsers.filter(u => u.accountStatus === 'pending').length;

  return (
    <div className="flex min-h-screen dash-bg text-slate-900">
      <Sidebar role="admin" />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Account Approvals" roleBadge="ADMIN" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4"
            style={{ borderBottom: '1px solid rgba(255,170,0,0.2)' }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full live-indicator" style={{ background: '#FFAA00' }} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: '#FFAA00' }}>
                  REGISTRATION MANAGEMENT
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Account Approvals
              </h1>
              <p className="text-sm text-slate-500 mt-1">Review and approve student/faculty registration requests</p>
            </div>

            <div className="flex items-center gap-3">
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-2 font-mono text-xs font-bold px-3 py-1.5 rounded-xl"
                  style={{ background: 'rgba(255,77,94,0.08)', color: '#FF4D5E', border: '1px solid rgba(255,77,94,0.25)' }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FF4D5E' }} />
                  {pendingCount} Pending
                </span>
              )}
              <button onClick={fetchData} disabled={loading}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
                <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Status messages */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
                <button onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-600">✕</button>
              </motion.div>
            )}
            {success && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email, roll number..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <div className="flex gap-2">
              {(['all', 'student', 'faculty'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${filter === f ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {f === 'all' ? 'All' : f === 'student' ? 'Students' : 'Faculty'}
                </button>
              ))}
            </div>
          </div>

          {/* Users list */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-16 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
                <p className="text-sm">Loading registration requests…</p>
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-sm font-bold text-slate-700">All caught up!</p>
                <p className="text-xs text-slate-500 mt-1">No pending registration requests to review.</p>
              </div>
            ) : (
              pendingUsers.map(user => {
                const isExpanded = expandedId === user._id;
                const isAction = actionLoading === user._id;
                const isPending = user.accountStatus === 'pending';
                return (
                  <motion.div key={user._id} layout
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 p-5">
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        user.role === 'student' ? 'bg-indigo-50 border border-indigo-200' : 'bg-emerald-50 border border-emerald-200'
                      }`}>
                        {user.role === 'student'
                          ? <GraduationCap className="w-5 h-5 text-indigo-600" />
                          : <Users className="w-5 h-5 text-emerald-600" />
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPending ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            user.accountStatus === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {user.accountStatus?.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{user.role}</span>
                          {user.rollNumber && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                              Roll: {user.rollNumber}
                            </span>
                          )}
                          {user.facultyId && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                              ID: {user.facultyId}
                            </span>
                          )}
                          {user.classOrSubject && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                              {user.classOrSubject}
                            </span>
                          )}
                          {user.collegeName && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">
                              {user.collegeName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Date */}
                      <div className="hidden sm:block text-right shrink-0">
                        <p className="text-[10px] text-slate-400">
                          {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(user.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setExpandedId(isExpanded ? null : user._id)}
                          className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {isPending && (
                          <>
                            <button onClick={() => setConfirmAction({ type: 'approve', userId: user._id, name: user.name })}
                              disabled={isAction}
                              className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setConfirmAction({ type: 'reject', userId: user._id, name: user.name })}
                              disabled={isAction}
                              className="p-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition-colors shadow-sm">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-100 px-5 pb-5">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs">
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Role</span>
                              <p className="font-bold text-slate-900 capitalize mt-0.5">{user.role}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase tracking-wider">College</span>
                              <p className="font-bold text-slate-900 mt-0.5">{user.collegeName || '—'}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Section</span>
                              <p className="font-bold text-slate-900 mt-0.5">{user.classOrSubject}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Year</span>
                              <p className="font-bold text-slate-900 mt-0.5">
                                {user.yearOfStudy ? `${user.yearOfStudy}${user.yearOfStudy === 1 ? 'st' : user.yearOfStudy === 2 ? 'nd' : user.yearOfStudy === 3 ? 'rd' : 'th'} Year` : '—'}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Branch</span>
                              <p className="font-bold text-slate-900 mt-0.5">{user.branch || user.department || '—'}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Roll Number</span>
                              <p className="font-bold text-slate-900 mt-0.5">{user.rollNumber || '—'}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase tracking-wider">Registered</span>
                              <p className="font-bold text-slate-900 mt-0.5">{new Date(user.createdAt).toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase tracking-wider">OTP Verified</span>
                              <p className="font-bold text-emerald-600 mt-0.5">✓ Yes</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setConfirmAction(null); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  confirmAction.type === 'approve' ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'
                }`}>
                  {confirmAction.type === 'approve'
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    : <XCircle className="w-5 h-5 text-rose-600" />
                  }
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {confirmAction.type === 'approve' ? 'Approve Registration' : 'Reject Registration'}
                  </h3>
                  <p className="text-xs text-slate-500">For {confirmAction.name}</p>
                </div>
              </div>

              {confirmAction.type === 'approve' ? (
                <p className="text-sm text-slate-600 mb-6">
                  This will activate the account and send an approval email to <strong>{confirmAction.name}</strong>. They will be able to log in immediately.
                </p>
              ) : (
                <div className="mb-6">
                  <p className="text-sm text-slate-600 mb-3">
                    This will reject the registration and send a rejection email to <strong>{confirmAction.name}</strong>.
                  </p>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rejection reason (optional)</label>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                    placeholder="e.g. Roll number does not match our records"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 resize-none"
                    rows={3} />
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setConfirmAction(null); setRejectReason(''); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => confirmAction.type === 'approve'
                    ? handleApprove(confirmAction.userId)
                    : handleReject(confirmAction.userId, rejectReason)}
                  disabled={actionLoading !== null}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors ${
                    confirmAction.type === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-500 hover:bg-rose-600'
                  }`}>
                  {actionLoading ? 'Processing…' : confirmAction.type === 'approve' ? 'Approve Account' : 'Reject Account'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
