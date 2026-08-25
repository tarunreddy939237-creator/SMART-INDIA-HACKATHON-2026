'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Video, Calendar, Clock, CheckCircle, XCircle, AlertCircle,
  Loader2, BarChart3, Filter, ChevronRight,
} from 'lucide-react';

interface AttendanceStats {
  totalMeetings: number;
  meetingsAttended: number;
  partialMeetings: number;
  missedMeetings: number;
  overallAttendance: number;
  upcomingMeetings: any[];
}

interface MeetingAttendance {
  _id: string;
  meetingId: string;
  userName: string;
  attendancePercentage: number;
  attendanceStatus: string;
  totalDuration: number;
  firstJoinTime: string;
}

export default function StudentMeetingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (status !== 'authenticated') return;
    Promise.all([
      fetch('/api/meeting-stats').then(r => r.json()),
      fetch('/api/meetings?limit=50').then(r => r.json()),
    ]).then(([statsData, meetingsData]) => {
      setStats(statsData);
      setMeetings(meetingsData.meetings || []);
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
    filter === 'all' ? true :
    filter === 'upcoming' ? ['scheduled', 'waiting'].includes(m.status) :
    filter === 'completed' ? m.status === 'completed' :
    true
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Video className="w-6 h-6 text-indigo-400" />
          </div>
          My Meeting Attendance
        </h1>
        <p className="text-gray-400 mb-8 ml-15">Track your meeting participation and attendance</p>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats.totalMeetings}</p>
              <p className="text-xs text-gray-400">Total Meetings</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{stats.meetingsAttended}</p>
              <p className="text-xs text-gray-400">Attended</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{stats.partialMeetings}</p>
              <p className="text-xs text-gray-400">Partial</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{stats.missedMeetings}</p>
              <p className="text-xs text-gray-400">Missed</p>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-indigo-400">{stats.overallAttendance}%</p>
              <p className="text-xs text-gray-400">Overall</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6">
          {['all', 'upcoming', 'completed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-800/60 border border-gray-700/50 text-gray-400 hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Meetings list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Video className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No meetings found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(m => {
              const meetingDate = new Date(m.scheduledDate);
              const isToday = meetingDate.toDateString() === new Date().toDateString();
              return (
                <div
                  key={m._id}
                  className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 hover:border-indigo-500/40 cursor-pointer transition-all"
                  onClick={() => router.push(`/meet/${m.meetingUuid}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                        m.status === 'live' ? 'bg-green-500/10 border-green-500/20' :
                        m.status === 'completed' ? 'bg-gray-500/10 border-gray-500/20' :
                        'bg-blue-500/10 border-blue-500/20'
                      }`}>
                        {m.status === 'live' ? <Video className="w-5 h-5 text-green-400" /> :
                         m.status === 'completed' ? <CheckCircle className="w-5 h-5 text-gray-400" /> :
                         <Calendar className="w-5 h-5 text-blue-400" />}
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{m.title}</h3>
                        <p className="text-gray-500 text-sm">
                          {m.hostName} · {isToday ? 'Today' : meetingDate.toLocaleDateString()} · {m.scheduledStartTime}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {m.status === 'completed' && m.attendancePercentage !== undefined && (
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            m.attendancePercentage >= 75 ? 'text-green-400' :
                            m.attendancePercentage >= 30 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {m.attendancePercentage}%
                          </p>
                          <p className="text-xs text-gray-500">Attendance</p>
                        </div>
                      )}
                      {m.status === 'live' && (
                        <span className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          Live
                        </span>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
