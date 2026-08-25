'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  BookOpen, ChevronRight, FileText, Link as LinkIcon,
  Video, Clock, CheckCircle2, AlertCircle, ArrowRight,
  Target, Calendar, Loader2, ExternalLink,
} from 'lucide-react';
import StudentSidebar from '@/components/dashboard/StudentSidebar';
import StudentTopbar from '@/components/dashboard/StudentTopbar';

interface Course {
  _id: string;
  name: string;
  code: string;
  description: string;
  branch: string;
  year: number;
  semester: number;
  sections: string[];
  modules: {
    title: string;
    description: string;
    materials: { title: string; type: string; url: string; content: string; }[];
  }[];
}

export default function StudentCoursesPage() {
  const { data: session } = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'modules' | 'assignments'>('modules');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/courses', { cache: 'no-store' });
        const data = await res.json();
        setCourses(data.courses || []);
      } catch { /* non-fatal */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetch(`/api/assignments?courseId=${selectedCourse._id}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(d => setAssignments(d.assignments || []))
        .catch(() => {});
    }
  }, [selectedCourse]);

  const materialIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-4 h-4" style={{ color: 'var(--ev-rose)' }} />;
      case 'link': return <LinkIcon className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />;
      case 'video': return <Video className="w-4 h-4" style={{ color: '#8B5CF6' }} />;
      default: return <FileText className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />;
    }
  };

  const handleSubmit = async (assignmentId: string) => {
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', assignmentId, content: 'Submitted via course workspace' }),
      });
      const data = await res.json();
      if (data.submission) {
        setAssignments(prev => prev.map(a => a._id === assignmentId ? { ...a, submission: data.submission } : a));
      }
    } catch { /* non-fatal */ }
  };

  return (
    <div className="flex min-h-screen text-slate-900" style={{ background: 'var(--ev-bg)' }}>
      <StudentSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <StudentTopbar title="My Courses" subtitle="Course materials and assignments" />
        <main className="flex-1 p-4 lg:p-6 xl:p-8 space-y-5 overflow-y-auto">
          {!selectedCourse ? (
            <>
              <h2 className="font-display text-[18px] font-bold text-slate-900">My Courses</h2>
              {loading ? (
                <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--ev-indigo)' }} /></div>
              ) : courses.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-[14px] font-semibold text-slate-500">No courses assigned yet</p>
                  <p className="text-[12px] text-slate-400 mt-1">Your faculty will publish courses here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {courses.map(course => {
                    const totalMaterials = course.modules?.reduce((acc: number, m: any) => acc + (m.materials?.length || 0), 0) || 0;
                    return (
                      <button key={course._id} onClick={() => setSelectedCourse(course)}
                        className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:shadow-md hover:border-slate-300 transition-all group">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)' }}>
                            <BookOpen className="w-5 h-5" style={{ color: 'var(--ev-indigo)' }} />
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </div>
                        <h3 className="text-[14px] font-bold text-slate-900 mb-1">{course.name}</h3>
                        {course.code && <p className="text-[11px] font-mono text-slate-400 mb-2">{course.code}</p>}
                        {course.description && <p className="text-[11px] text-slate-500 mb-2 line-clamp-2">{course.description}</p>}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
                          <span>{course.modules?.length || 0} modules</span>
                          <span>·</span>
                          <span>{totalMaterials} materials</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Course Detail */}
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setSelectedCourse(null)}
                  className="text-[12px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                  ← Back to courses
                </button>
                <span className="text-slate-300">/</span>
                <h2 className="font-display text-[16px] font-bold text-slate-900">{selectedCourse.name}</h2>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 w-fit">
                {(['modules', 'assignments'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className="px-4 py-2 rounded-lg text-[12px] font-semibold transition-all capitalize"
                    style={activeTab === tab ? { background: '#0C1222', color: 'var(--ev-indigo)' } : { color: '#64748B' }}>
                    {tab}
                  </button>
                ))}
              </div>

              {/* Modules Tab */}
              {activeTab === 'modules' && (
                <div className="space-y-4">
                  {(selectedCourse.modules || []).length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                      <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-[13px] text-slate-500">No modules published yet</p>
                    </div>
                  ) : (
                    selectedCourse.modules.map((mod, mi) => (
                      <div key={mi} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                            {mi + 1}
                          </div>
                          <div>
                            <h4 className="text-[13px] font-bold text-slate-900">{mod.title}</h4>
                            {mod.description && <p className="text-[11px] text-slate-500">{mod.description}</p>}
                          </div>
                        </div>
                        {(mod.materials || []).length > 0 && (
                          <div className="border-t border-slate-100 px-5 py-3 space-y-1.5">
                            {mod.materials.map((mat, matI) => (
                              <div key={matI} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                  {materialIcon(mat.type)}
                                  <div>
                                    <p className="text-[12px] font-semibold text-slate-800">{mat.title}</p>
                                    <p className="text-[10px] text-slate-400 capitalize">{mat.type}</p>
                                  </div>
                                </div>
                                {mat.url && (
                                  <a href={mat.url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all hover:scale-[1.02]"
                                    style={{ color: 'var(--ev-indigo)', background: 'rgba(91,82,255,0.06)', border: '1px solid rgba(91,82,255,0.15)' }}>
                                    <ExternalLink className="w-3 h-3" /> Open
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Assignments Tab */}
              {activeTab === 'assignments' && (
                <div className="space-y-2">
                  {assignments.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                      <Target className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-[13px] text-slate-500">No assignments yet</p>
                    </div>
                  ) : (
                    assignments.map(a => {
                      const isOverdue = new Date(a.dueDate) < new Date();
                      const isSubmitted = !!a.submission;
                      const isGraded = a.submission?.status === 'graded';
                      return (
                        <div key={a._id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: isGraded ? 'rgba(16,185,129,0.08)' : isOverdue && !isSubmitted ? 'rgba(225,29,72,0.06)' : 'rgba(79,70,229,0.06)' }}>
                              {isGraded ? <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--ev-emerald)' }} /> :
                               isSubmitted ? <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--ev-amber)' }} /> :
                               <Target className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} />}
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-slate-900">{a.title}</p>
                              <p className="text-[10px] text-slate-400">
                                Due: {new Date(a.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {a.dueTime ? ` at ${a.dueTime}` : ''} · Max: {a.maxScore}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isGraded && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded"
                                style={{ background: 'rgba(16,185,129,0.08)', color: 'var(--ev-emerald)' }}>
                                {a.submission.score}/{a.maxScore}
                              </span>
                            )}
                            {isOverdue && !isSubmitted && (
                              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded"
                                style={{ background: 'rgba(225,29,72,0.06)', color: 'var(--ev-rose)' }}>OVERDUE</span>
                            )}
                            {!isSubmitted && !isOverdue && (
                              <button onClick={() => handleSubmit(a._id)}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition-all hover:scale-[1.02]"
                                style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                                Submit
                              </button>
                            )}
                            {isSubmitted && !isGraded && (
                              <span className="text-[10px] font-semibold" style={{ color: 'var(--ev-amber)' }}>Submitted</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
