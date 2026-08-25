'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Video, Calendar, Clock, Users, Plus, Search, Filter,
  ChevronRight, Play, CheckCircle, XCircle, AlertCircle,
  LayoutGrid, List, Loader2, Eye, Trash2,
} from 'lucide-react';

interface Meeting {
  _id: string;
  meetingUuid: string;
  title: string;
  description: string;
  hostId: string;
  hostName: string;
  scheduledDate: string;
  scheduledStartTime: string;
  expectedDuration: number;
  status: 'scheduled' | 'waiting' | 'live' | 'completed' | 'cancelled';
  totalInvited: number;
  totalJoined: number;
  presentCount: number;
  partialCount: number;
  absentCount: number;
  attendancePercentage: number;
  branch: string;
  year: string;
  section: string;
  participantCount?: number;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: typeof Video; label: string }> = {
  scheduled: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: Calendar, label: 'Scheduled' },
  waiting: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: Clock, label: 'Waiting' },
  live: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: Video, label: 'Live Now' },
  completed: { color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20', icon: CheckCircle, label: 'Completed' },
  cancelled: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: XCircle, label: 'Cancelled' },
};

export default function MeetingsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [stats, setStats] = useState<any>(null);

  const userRole = (session?.user as any)?.role || 'student';

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      params.set('limit', '50');

      const res = await fetch(`/api/meetings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings || []);
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/meeting-stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchMeetings();
      fetchStats();
    }
  }, [sessionStatus, fetchMeetings, fetchStats]);

  const filtered = meetings.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.hostName.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (meetingUuid: string) => {
    if (!confirm('Are you sure you want to cancel this meeting?')) return;
    try {
      const res = await fetch(`/api/meetings/${meetingUuid}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMeetings();
      }
    } catch (err) {
      alert('Failed to cancel meeting');
    }
  };

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Video className="w-6 h-6 text-indigo-400" />
              </div>
              Meetings
            </h1>
            <p className="text-gray-400 mt-2 ml-15">
              {userRole === 'faculty' ? 'Create and manage your meetings' : 'View and join your meetings'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats cards */}
            {stats && (
              <div className="hidden lg:flex items-center gap-2">
                <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg px-4 py-2 text-center">
                  <p className="text-xl font-bold text-white">
                    {userRole === 'student' ? (stats.totalMeetings || 0) : (stats.totalMeetings || 0)}
                  </p>
                  <p className="text-xs text-gray-400">Total</p>
                </div>
                {userRole === 'student' ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2 text-center">
                    <p className="text-xl font-bold text-green-400">{stats.overallAttendance || 0}%</p>
                    <p className="text-xs text-gray-400">Attendance</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2 text-center">
                      <p className="text-xl font-bold text-yellow-400">{stats.upcomingMeetings || 0}</p>
                      <p className="text-xs text-gray-400">Upcoming</p>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2 text-center">
                      <p className="text-xl font-bold text-green-400">{stats.averageAttendance || 0}%</p>
                      <p className="text-xs text-gray-400">Avg Att.</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {userRole === 'faculty' && (
              <button
                onClick={() => router.push('/meet/create')}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20"
              >
                <Plus className="w-5 h-5" />
                Create Meeting
              </button>
            )}
          </div>
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search meetings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {['all', 'scheduled', 'live', 'completed', 'cancelled'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800/60 border border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-600'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/50 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Meetings Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-800/60 border border-gray-700/50 flex items-center justify-center mb-4">
              <Video className="w-10 h-10 text-gray-600" />
            </div>
            <p className="text-gray-400 text-lg font-medium">No meetings found</p>
            <p className="text-gray-500 text-sm mt-1">
              {userRole === 'faculty' ? 'Create your first meeting to get started' : 'No meetings have been scheduled for you yet'}
            </p>
            {userRole === 'faculty' && (
              <button
                onClick={() => router.push('/meet/create')}
                className="mt-4 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all"
              >
                <Plus className="w-5 h-5" />
                Create Meeting
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'flex flex-col gap-3'
          }>
            {filtered.map(meeting => {
              const statusCfg = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;
              const StatusIcon = statusCfg.icon;
              const meetingDate = new Date(meeting.scheduledDate);
              const isToday = meetingDate.toDateString() === new Date().toDateString();
              const isPast = meetingDate < new Date() && meeting.status === 'completed';

              return viewMode === 'grid' ? (
                // GRID CARD
                <div
                  key={meeting._id}
                  className={`group relative rounded-2xl border ${statusCfg.bg} p-5 hover:border-indigo-500/40 transition-all cursor-pointer`}
                  onClick={() => router.push(`/meet/${meeting.meetingUuid}`)}
                >
                  {/* Status badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color} border`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                    {meeting.status === 'live' && (
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-white font-semibold text-lg mb-2 line-clamp-2 group-hover:text-indigo-300 transition-colors">
                    {meeting.title}
                  </h3>

                  {/* Host */}
                  <p className="text-gray-400 text-sm mb-3">
                    by {meeting.hostName}
                  </p>

                  {/* Date/Time */}
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {isToday ? 'Today' : meetingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {meeting.scheduledStartTime}
                    </span>
                    <span>{meeting.expectedDuration}m</span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-sm text-gray-400">
                      <Users className="w-4 h-4" />
                      {meeting.participantCount || meeting.totalInvited || 0} invited
                    </div>
                    {meeting.status === 'completed' && (
                      <span className="text-sm font-medium text-indigo-400">
                        {meeting.attendancePercentage || 0}% attendance
                      </span>
                    )}
                    {meeting.status === 'live' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/meet/${meeting.meetingUuid}`);
                        }}
                        className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white text-sm px-3 py-1 rounded-lg font-medium"
                      >
                        <Play className="w-4 h-4" />
                        Join
                      </button>
                    )}
                    {(meeting.status === 'scheduled' || meeting.status === 'waiting') && userRole === 'student' && (
                      <span className="text-sm text-blue-400 flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        View
                      </span>
                    )}
                  </div>

                  {/* Delete button for host */}
                  {(userRole === 'faculty' || userRole === 'admin') && meeting.status === 'scheduled' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(meeting.meetingUuid);
                      }}
                      className="absolute top-4 right-12 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Cancel meeting"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                // LIST ITEM
                <div
                  key={meeting._id}
                  className="group flex items-center gap-4 bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 hover:border-indigo-500/40 transition-all cursor-pointer"
                  onClick={() => router.push(`/meet/${meeting.meetingUuid}`)}
                >
                  <div className={`w-12 h-12 rounded-xl ${statusCfg.bg} flex items-center justify-center border`}>
                    <StatusIcon className={`w-5 h-5 ${statusCfg.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium truncate group-hover:text-indigo-300 transition-colors">
                        {meeting.title}
                      </h3>
                      {meeting.status === 'live' && (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm">
                      {meeting.hostName} · {new Date(meeting.scheduledDate).toLocaleDateString()} · {meeting.scheduledStartTime} · {meeting.expectedDuration}min
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right hidden md:block">
                      <p className="text-sm text-gray-400">{meeting.participantCount || meeting.totalInvited || 0} participants</p>
                      {meeting.status === 'completed' && (
                        <p className="text-sm text-indigo-400">{meeting.attendancePercentage}% attendance</p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-indigo-400 transition-colors" />
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
