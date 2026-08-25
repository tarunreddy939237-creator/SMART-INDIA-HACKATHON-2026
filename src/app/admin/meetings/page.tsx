'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Video, Calendar, Clock, Users, BarChart3, Loader2,
  CheckCircle, XCircle, Eye, Search,
} from 'lucide-react';

export default function AdminMeetingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (status !== 'authenticated') return;
    Promise.all([
      fetch('/api/meeting-stats').then(r => r.json()),
      fetch('/api/meetings?limit=100').then(r => r.json()),
    ]).then(([s, m]) => {
      setStats(s);
      setMeetings(m.meetings || []);
    }).finally(() => setLoading(false));
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  const filtered = meetings.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.hostName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Video className="w-6 h-6 text-indigo-400" />
          </div>
          Meeting Management
        </h1>
        <p className="text-gray-400 mb-8 ml-15">Platform-wide meeting overview and statistics</p>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats.totalMeetings || 0}</p>
              <p className="text-xs text-gray-400">Total Meetings</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.upcomingMeetings || 0}</p>
              <p className="text-xs text-gray-400">Upcoming</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{stats.liveMeetings || 0}</p>
              <p className="text-xs text-gray-400">Live</p>
            </div>
            <div className="bg-gray-500/10 border border-gray-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-400">{stats.completedMeetings || 0}</p>
              <p className="text-xs text-gray-400">Completed</p>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-indigo-400">{stats.averageAttendance || 0}%</p>
              <p className="text-xs text-gray-400">Avg Attendance</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search meetings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 outline-none"
          />
        </div>

        {/* Table */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700/50">
                  <th className="text-left py-4 px-6">Meeting</th>
                  <th className="text-left py-4 px-6">Host</th>
                  <th className="text-left py-4 px-6">Date</th>
                  <th className="text-left py-4 px-6">Status</th>
                  <th className="text-left py-4 px-6">Participants</th>
                  <th className="text-left py-4 px-6">Attendance</th>
                  <th className="text-left py-4 px-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-4 px-6">
                      <p className="text-white font-medium">{m.title}</p>
                      <p className="text-gray-500 text-xs">{m.scheduledStartTime} · {m.expectedDuration}min</p>
                    </td>
                    <td className="py-4 px-6 text-gray-300">{m.hostName}</td>
                    <td className="py-4 px-6 text-gray-300">
                      {new Date(m.scheduledDate).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        m.status === 'live' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        m.status === 'completed' ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20' :
                        m.status === 'scheduled' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {m.status === 'live' && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span></span>}
                        {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-300">{m.participantCount || m.totalInvited || 0}</td>
                    <td className="py-4 px-6">
                      {m.status === 'completed' ? (
                        <span className={`font-medium ${
                          m.attendancePercentage >= 75 ? 'text-green-400' :
                          m.attendancePercentage >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {m.attendancePercentage || 0}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => router.push(`/meet/${m.meetingUuid}`)}
                        className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No meetings found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
