'use client';

import React, { useState, useEffect } from 'react';
import { PlayCircle, Clock, BookOpen, Search, Filter, Video } from 'lucide-react';
import { useSession } from 'next-auth/react';
import StudentSidebar from '@/components/dashboard/StudentSidebar';
import StudentTopbar from '@/components/dashboard/StudentTopbar';
import LoadingState from '@/components/shared/LoadingState';

interface VideoLecture {
  _id: string;
  title: string;
  description: string;
  subject: string;
  branch: string;
  section: string;
  videoUrl: string;
  duration: string;
  createdAt: string;
  uploadedBy?: { name: string };
}

const SUBJECTS = ['All', 'Digital Electronics', 'Data Structures & Algorithms', 'Signals & Systems', 'Database Management Systems', 'Deep Learning & Neural Nets', 'Computer Networks'];

export default function StudentVideosPage() {
  const { data: session } = useSession();
  const studentSection = (session?.user as any)?.classOrSubject || '';
  const [videos, setVideos]           = useState<VideoLecture[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeVideo, setActiveVideo] = useState<VideoLecture | null>(null);
  const [search, setSearch]           = useState('');
  const [filterSubject, setFilterSubject] = useState('All');

  useEffect(() => {
    const params = studentSection ? `?section=${encodeURIComponent(studentSection)}` : '';
    fetch(`/api/video-lectures${params}`)
      .then(r => r.json())
      .then(data => { if (data.videos) setVideos(data.videos); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentSection]);

  const filtered = videos.filter(v => {
    const matchSearch  = !search || v.title.toLowerCase().includes(search.toLowerCase()) || v.subject.toLowerCase().includes(search.toLowerCase());
    const matchSubject = filterSubject === 'All' || v.subject === filterSubject;
    return matchSearch && matchSubject;
  });

  return (
    <div className="flex min-h-screen bg-[#F4F6FA] text-slate-900">
      <StudentSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <StudentTopbar title="Video Lectures" subtitle="Faculty-published lectures" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">

          {/* Header */}
          <div className="pb-2 border-b border-slate-200">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Video Lectures</h1>
            <p className="text-xs text-slate-500 mt-1">Faculty-published lectures for your enrolled courses.</p>
          </div>

          {/* Active Video Player */}
          {activeVideo && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={activeVideo.videoUrl}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  title={activeVideo.title}
                />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{activeVideo.title}</h2>
                    {activeVideo.description && (
                      <p className="text-xs text-slate-500 mt-1">{activeVideo.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-medium">{activeVideo.subject}</span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1"><BookOpen className="w-3 h-3" />{activeVideo.branch} · {activeVideo.section}</span>
                      {activeVideo.duration && <span className="text-[11px] text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{activeVideo.duration}</span>}
                      {activeVideo.uploadedBy?.name && <span className="text-[11px] text-slate-500">By {activeVideo.uploadedBy.name}</span>}
                    </div>
                  </div>
                  <button onClick={() => setActiveVideo(null)}
                    className="shrink-0 text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by title or subject..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 focus:border-indigo-500 rounded-xl text-xs outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                className="bg-white border border-slate-300 text-xs font-medium text-slate-700 rounded-xl px-3 py-2.5 outline-none">
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Video Grid */}
          {loading ? (
            <LoadingState message="Loading video lectures..." />
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Video className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No video lectures found.</p>
              <p className="text-xs text-slate-400 mt-1">Your faculty hasn't uploaded any videos yet, or try a different filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((v) => (
                <div key={v._id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-indigo-200 transition-all group cursor-pointer"
                  onClick={() => { setActiveVideo(v); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center relative">
                    {v.videoUrl.includes('youtube.com/embed') ? (
                      <img
                        src={`https://img.youtube.com/vi/${v.videoUrl.split('/embed/')[1]?.split('?')[0]}/hqdefault.jpg`}
                        alt={v.title}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : null}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                        <PlayCircle className="w-7 h-7 text-indigo-600" />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <p className="text-[13px] font-semibold text-slate-900 line-clamp-2 leading-snug">{v.title}</p>
                    {v.description && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{v.description}</p>}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">{v.subject}</span>
                      <span className="text-[10px] text-slate-400">{v.branch} · {v.section}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      {v.duration
                        ? <span className="text-[11px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{v.duration}</span>
                        : <span />}
                      <span className="text-[10px] text-slate-400">{new Date(v.createdAt).toLocaleDateString()}</span>
                    </div>
                    {v.uploadedBy?.name && (
                      <p className="text-[10px] text-slate-400 mt-1">By {v.uploadedBy.name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
