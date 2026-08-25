'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Building2, Users, GraduationCap, CheckCircle2, AlertCircle,
  Search, RefreshCw, Plus, UserCheck, UserX, Clock,
} from 'lucide-react';

type College = {
  _id: string;
  name: string;
  normalizedName: string;
  status: string;
  stats: { studentCount: number; facultyCount: number; pendingCount: number };
  admin: { name: string; email: string } | null;
  createdAt: string;
};

export default function SuperAdminPage() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCollege, setNewCollege] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchColleges = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/colleges/super-admin?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setColleges(data.colleges || []);
      }
    } catch { setError('Failed to load colleges.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchColleges(); }, []);
  useEffect(() => {
    const t = setTimeout(() => fetchColleges(), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleCreateCollege = async () => {
    if (!newCollege.trim()) { setError('College name is required.'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/colleges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollege.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed.'); return; }
      setSuccess(data.message);
      setNewCollege('');
      setShowCreate(false);
      fetchColleges();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Network error.'); }
    finally { setCreating(false); }
  };

  const totalStudents = colleges.reduce((acc, c) => acc + (c.stats?.studentCount || 0), 0);
  const totalFaculty = colleges.reduce((acc, c) => acc + (c.stats?.facultyCount || 0), 0);
  const totalPending = colleges.reduce((acc, c) => acc + (c.stats?.pendingCount || 0), 0);

  return (
    <div className="min-h-screen bg-[#0C1222] text-white p-4 lg:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Super Admin — Platform Control</h1>
            <p className="text-xs text-slate-400">Manage colleges, admins, and platform-wide settings</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Colleges', value: colleges.length, icon: Building2, color: 'text-purple-400' },
          { label: 'Students', value: totalStudents, icon: GraduationCap, color: 'text-indigo-400' },
          { label: 'Faculty', value: totalFaculty, icon: Users, color: 'text-emerald-400' },
          { label: 'Pending', value: totalPending, icon: Clock, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-xs text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search colleges..."
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500" />
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Register College
        </button>
        <button onClick={fetchColleges}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Create College Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="max-w-6xl mx-auto mb-6 overflow-hidden">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex gap-3">
              <input type="text" value={newCollege} onChange={e => setNewCollege(e.target.value)}
                placeholder="College name (e.g. Vasireddy Venkatadri Institute of Technology)"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-500"
                onKeyDown={e => e.key === 'Enter' && handleCreateCollege()} />
              <button onClick={handleCreateCollege} disabled={creating}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status messages */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="max-w-6xl mx-auto mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto">✕</button>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="max-w-6xl mx-auto mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Colleges grid */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading colleges…</p>
          </div>
        ) : colleges.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-700" />
            <p className="text-sm font-semibold">No colleges registered</p>
            <p className="text-xs mt-1">Click "Register College" to add the first one.</p>
          </div>
        ) : (
          colleges.map(college => (
            <div key={college._id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{college.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    college.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    college.status === 'suspended' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                    'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                  }`}>
                    {college.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-indigo-400">{college.stats?.studentCount || 0}</p>
                  <p className="text-[10px] text-slate-500">Students</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-400">{college.stats?.facultyCount || 0}</p>
                  <p className="text-[10px] text-slate-500">Faculty</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-400">{college.stats?.pendingCount || 0}</p>
                  <p className="text-[10px] text-slate-500">Pending</p>
                </div>
              </div>

              {college.admin ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Admin: <strong className="text-slate-300">{college.admin.name}</strong></span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <UserX className="w-3.5 h-3.5" />
                  <span>No admin assigned</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
