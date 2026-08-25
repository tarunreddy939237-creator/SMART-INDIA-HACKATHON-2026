'use client';

import React, { useState, useEffect } from 'react';
import {
  Send, Clock, CheckCircle2, XCircle, AlertTriangle,
  Filter, RefreshCw, MessageSquare,
} from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Topbar from '@/components/dashboard/Topbar';

interface CommunicationLogEntry {
  _id: string;
  studentId: { name: string; rollNumber: string; classOrSubject: string } | null;
  sentBy: { name: string } | null;
  channel: string;
  status: string;
  messagePreview: string;
  failureReason: string;
  sentAt: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  pending:   { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  sent:      { icon: Send, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  delivered: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  failed:    { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
};

export default function FacultyReportHistoryPage() {
  const [logs, setLogs] = useState<CommunicationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/communication/history');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--ev-bg, #F7F8FC)' }}>
      <Sidebar />
      <div className="flex-1 ml-[256px]">
        <Topbar />
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Communication History</h1>
              <p className="text-sm text-slate-500 mt-1">Track reports sent to parents via WhatsApp/SMS</p>
            </div>
            <button onClick={fetchLogs}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-white border border-slate-200 transition-all">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {['all', 'sent', 'delivered', 'failed', 'pending'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filter === s ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-white border border-slate-200">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No communication history yet.</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Channel</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Sent By</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(log => {
                    const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                    const Icon = cfg.icon;
                    return (
                      <tr key={log._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-slate-900">{log.studentId?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-slate-400">{log.studentId?.rollNumber}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                            {log.channel}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg.bg} ${cfg.color}`}>
                            <Icon className="w-3 h-3" /> {log.status}
                          </span>
                          {log.failureReason && (
                            <p className="text-[10px] text-rose-500 mt-1">{log.failureReason}</p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">{log.sentBy?.name || 'System'}</td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {log.sentAt ? new Date(log.sentAt).toLocaleString() : new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
