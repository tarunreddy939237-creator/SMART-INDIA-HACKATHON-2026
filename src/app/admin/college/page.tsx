'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Users, ShieldCheck, CheckCircle2, XCircle,
  Search, Filter, RefreshCw, AlertCircle, Building2, UserCheck,
  Clock, ChevronDown, ChevronUp, Mail, Hash, BookOpen,
  Check, X, UserX,
} from 'lucide-react';

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

type CollegeInfo = {
  _id: string;
  name: string;
  normalizedName: string;
  status: string;
  stats: { studentCount: number; facultyCount: number; pendingCount: number };
  admin: { name: string; email: string } | null;
};

export default function CollegeAdminPage() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [college, setCollege] = useState<CollegeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'all' | 'student' | 'faculty'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingRes, collegeRes] = await Promise.all([
        fetch(`/api/colleges/pending?role=${filter === 'all' ? '' : filter}&search=${encodeURIComponent(search)}`),
        fetch('/api/colleges'),
      ]);

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingUsers(data.users || []);
      }

      if (collegeRes.ok) {
        const data = await collegeRes.json();
        setCollege(data.college);
      }
    } catch { setError('Failed to load data.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [filter]);

  useEffect(() => {
    const debounce = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(debounce);
  }, [search]);

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
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Network error.'); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (userId: string) => {
    setActionLoading(userId);
    setError('');
    try {
      const res = await fetch('/api/colleges/reject', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason: 'Verification failed' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to reject.'); return; }
      setSuccess(data.message);
      setPendingUsers(prev => prev.filter(u => u._id !== userId));
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Network error.'); }
    finally { setActionLoading(null); }
  };

  const handleBulkApprove = async () => {
    const ids = pendingUsers.map(u => u._id);
    if (ids.length === 0) return;
    setActionLoading('bulk');
    try {
      const res = await fetch('/api/colleges/bulk-approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed.'); return; }
      setSuccess(data.message);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Network error.'); }
    finally { setActionLoading(null); }
  };

  const filtered = pendingUsers;

  return (
    <div className="min-h-screen bg-[#0C1222] text-white p-4 lg:p-8">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">College Admin Dashboard</h1>
            {college && <p className="text-xs text-slate-400">{college.name}</p>}
          </div>
        </div>
      </div>

      {/* Stats */}
      {college && (
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Students', value: college.stats?.studentCount || 0, icon: GraduationCap, color: 'text-indigo-400' },
            { label: 'Faculty', value: college.stats?.facultyCount || 0, icon: Users, color: 'text-emerald-400' },
            { label: 'Pending', value: college.stats?.pendingCount || 0, icon: Clock, color: 'text-amber-400' },
            { label: 'Status', value: college.status, icon: Building2, color: 'text-cyan-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, roll number..."
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500" />
        </div>
        <div className="flex gap-2">
          {(['all', 'student', 'faculty'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {f === 'all' ? 'All' : f === 'student' ? 'Students' : 'Faculty'}
            </button>
          ))}
          {filtered.length > 0 && (
            <button onClick={handleBulkApprove} disabled={!!actionLoading}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              Approve All ({filtered.length})
            </button>
          )}
          <button onClick={fetchData} disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status messages */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="max-w-5xl mx-auto mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="max-w-5xl mx-auto mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending users list */}
      <div className="max-w-5xl mx-auto space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading pending accounts…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500/50" />
            <p className="text-sm font-semibold">No pending accounts</p>
            <p className="text-xs mt-1">All registration requests have been reviewed.</p>
          </div>
        ) : (
          filtered.map(user => {
            const isExpanded = expandedId === user._id;
            const isAction = actionLoading === user._id || actionLoading === 'bulk';
            return (
              <motion.div key={user._id} layout
                className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${user.role === 'student' ? 'bg-indigo-500/10' : 'bg-emerald-500/10'}`}>
                    {user.role === 'student'
                      ? <GraduationCap className="w-5 h-5 text-indigo-400" />
                      : <Users className="w-5 h-5 text-emerald-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {user.rollNumber && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          Roll: {user.rollNumber}
                        </span>
                      )}
                      {user.facultyId && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ID: {user.facultyId}
                        </span>
                      )}
                      {user.classOrSubject && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          {user.classOrSubject}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setExpandedId(isExpanded ? null : user._id)}
                      className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleApprove(user._id)} disabled={isAction}
                      className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleReject(user._id)} disabled={isAction}
                      className="p-2 rounded-lg bg-rose-600/80 text-white hover:bg-rose-600 disabled:opacity-50 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-800 px-4 pb-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 text-xs">
                        <div><span className="text-slate-500">Role</span><p className="font-semibold capitalize">{user.role}</p></div>
                        <div><span className="text-slate-500">College</span><p className="font-semibold">{user.collegeName || '—'}</p></div>
                        <div><span className="text-slate-500">Section</span><p className="font-semibold">{user.classOrSubject}</p></div>
                        <div><span className="text-slate-500">Year</span><p className="font-semibold">{user.yearOfStudy ? `${user.yearOfStudy}${user.yearOfStudy === 1 ? 'st' : user.yearOfStudy === 2 ? 'nd' : user.yearOfStudy === 3 ? 'rd' : 'th'} Year` : '—'}</p></div>
                        <div><span className="text-slate-500">Department</span><p className="font-semibold">{user.department || '—'}</p></div>
                        <div><span className="text-slate-500">Registered</span><p className="font-semibold">{new Date(user.createdAt).toLocaleDateString()}</p></div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
