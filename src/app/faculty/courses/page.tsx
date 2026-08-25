'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  BookOpen, Plus, ChevronRight, FileText, Link as LinkIcon,
  Video, Upload, Trash2, GripVertical, Calendar, Users,
  Clock, CheckCircle2, AlertCircle, ArrowRight, Loader2,
  Target, Edit3, ChevronDown, ChevronUp, Archive,
} from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Topbar from '@/components/dashboard/Topbar';

interface Course {
  _id: string;
  name: string;
  code: string;
  description: string;
  branch: string;
  year: number;
  semester: number;
  sections: string[];
  facultyIds: string[];
  modules: Module[];
  studentCount: number;
  isArchived: boolean;
}

interface Module {
  title: string;
  description: string;
  order: number;
  materials: Material[];
  isPublished: boolean;
}

interface Material {
  title: string;
  type: string;
  url: string;
  content: string;
  order: number;
}

export default function FacultyCoursesPage() {
  const { data: session } = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'modules' | 'assignments' | 'students'>('modules');

  // Create course modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', code: '', description: '', branch: 'CSE', year: '2', semester: '3', sections: 'A' });
  const [creating, setCreating] = useState(false);

  // Module/material creation
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialForm, setMaterialForm] = useState({ title: '', type: 'note', url: '', content: '' });
  const [materialModuleIdx, setMaterialModuleIdx] = useState(0);

  // Assignments for selected course
  const [assignments, setAssignments] = useState<any[]>([]);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/courses', { cache: 'no-store' });
      const data = await res.json();
      setCourses(data.courses || []);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  const fetchAssignments = useCallback(async (courseId: string) => {
    try {
      const res = await fetch(`/api/assignments?courseId=${courseId}`, { cache: 'no-store' });
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  useEffect(() => {
    if (selectedCourse) fetchAssignments(selectedCourse._id);
  }, [selectedCourse, fetchAssignments]);

  // ── Create course ──
  const handleCreateCourse = async () => {
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...createForm,
          sections: createForm.sections.split(',').map(s => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.course) {
        setCourses(prev => [...prev, data.course]);
        setShowCreateModal(false);
        setCreateForm({ name: '', code: '', description: '', branch: 'CSE', year: '2', semester: '3', sections: 'A' });
      }
    } catch { /* non-fatal */ }
    finally { setCreating(false); }
  };

  // ── Add module ──
  const handleAddModule = async () => {
    if (!selectedCourse || !moduleForm.title.trim()) return;
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addModule', courseId: selectedCourse._id, ...moduleForm }),
      });
      const data = await res.json();
      if (data.course) {
        setSelectedCourse(data.course);
        setCourses(prev => prev.map(c => c._id === data.course._id ? data.course : c));
        setShowModuleModal(false);
        setModuleForm({ title: '', description: '' });
      }
    } catch { /* non-fatal */ }
  };

  // ── Add material ──
  const handleAddMaterial = async () => {
    if (!selectedCourse || !materialForm.title.trim()) return;
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addMaterial', courseId: selectedCourse._id, moduleIndex: materialModuleIdx, ...materialForm }),
      });
      const data = await res.json();
      if (data.course) {
        setSelectedCourse(data.course);
        setCourses(prev => prev.map(c => c._id === data.course._id ? data.course : c));
        setShowMaterialModal(false);
        setMaterialForm({ title: '', type: 'note', url: '', content: '' });
      }
    } catch { /* non-fatal */ }
  };

  // ── Delete module ──
  const handleDeleteModule = async (moduleIndex: number) => {
    if (!selectedCourse) return;
    if (!confirm('Delete this module and all its materials?')) return;
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteModule', courseId: selectedCourse._id, moduleIndex }),
      });
      const data = await res.json();
      if (data.course) {
        setSelectedCourse(data.course);
        setCourses(prev => prev.map(c => c._id === data.course._id ? data.course : c));
      }
    } catch { /* non-fatal */ }
  };

  // ── Delete material ──
  const handleDeleteMaterial = async (moduleIndex: number, materialIndex: number) => {
    if (!selectedCourse) return;
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteMaterial', courseId: selectedCourse._id, moduleIndex, materialIndex }),
      });
      const data = await res.json();
      if (data.course) {
        setSelectedCourse(data.course);
        setCourses(prev => prev.map(c => c._id === data.course._id ? data.course : c));
      }
    } catch { /* non-fatal */ }
  };

  const materialIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-3.5 h-3.5" style={{ color: 'var(--ev-rose)' }} />;
      case 'link': return <LinkIcon className="w-3.5 h-3.5" style={{ color: 'var(--ev-indigo)' }} />;
      case 'video': return <Video className="w-3.5 h-3.5" style={{ color: '#8B5CF6' }} />;
      default: return <FileText className="w-3.5 h-3.5" style={{ color: 'var(--ev-indigo)' }} />;
    }
  };

  return (
    <div className="flex min-h-screen text-slate-900" style={{ background: 'var(--ev-bg)' }}>
      <Sidebar role="faculty" />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Course Workspace" subtitle="Manage your courses and content" roleBadge="FACULTY" />
        <main className="flex-1 p-4 lg:p-6 xl:p-8 space-y-5 overflow-y-auto">
          {!selectedCourse ? (
            <>
              {/* Course Grid */}
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[18px] font-bold text-slate-900">My Courses</h2>
                <button onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                  <Plus className="w-4 h-4" /> New Course
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--ev-indigo)' }} /></div>
              ) : courses.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-[14px] font-semibold text-slate-500 mb-1">No courses yet</p>
                  <p className="text-[12px] text-slate-400 mb-4">Create your first course to get started</p>
                  <button onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 rounded-xl text-[12px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                    Create Course
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {courses.map(course => (
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
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{course.sections.join(', ')}</span>
                        <span>{course.branch} · {course.year > 0 ? `Y${course.year}` : 'All'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400">
                        <span>{course.modules?.length || 0} modules</span>
                        <span>·</span>
                        <span>{course.modules?.reduce((acc: number, m: any) => acc + (m.materials?.length || 0), 0) || 0} materials</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Course Detail View */}
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setSelectedCourse(null)}
                  className="text-[12px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                  ← Back to courses
                </button>
                <span className="text-slate-300">/</span>
                <h2 className="font-display text-[16px] font-bold text-slate-900">{selectedCourse.name}</h2>
                {selectedCourse.code && <span className="text-[11px] font-mono text-slate-400">{selectedCourse.code}</span>}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 w-fit">
                {(['modules', 'assignments', 'students'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className="px-4 py-2 rounded-lg text-[12px] font-semibold transition-all capitalize"
                    style={activeTab === tab ? {
                      background: '#0C1222', color: 'var(--ev-indigo)',
                    } : {
                      color: '#64748B',
                    }}>
                    {tab}
                  </button>
                ))}
              </div>

              {/* Modules Tab */}
              {activeTab === 'modules' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button onClick={() => setShowModuleModal(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold text-white transition-all"
                      style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                      <Plus className="w-3.5 h-3.5" /> Add Module
                    </button>
                  </div>

                  {(selectedCourse.modules || []).length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                      <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-[13px] text-slate-500 mb-3">No modules yet</p>
                      <button onClick={() => setShowModuleModal(true)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                        Add First Module
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCourse.modules.map((mod, mi) => (
                        <div key={mi} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, #5B52FF, #8B5CF6)' }}>
                                {mi + 1}
                              </div>
                              <div>
                                <h4 className="text-[13px] font-bold text-slate-900">{mod.title}</h4>
                                {mod.description && <p className="text-[11px] text-slate-500">{mod.description}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setMaterialModuleIdx(mi); setShowMaterialModal(true); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                                style={{ background: 'rgba(79,70,229,0.06)', color: '#0E8F82', border: '1px solid rgba(79,70,229,0.15)' }}>
                                <Plus className="w-3 h-3" /> Add Material
                              </button>
                              <button onClick={() => handleDeleteModule(mi)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {(mod.materials || []).length > 0 && (
                            <div className="border-t border-slate-100 px-5 py-3 space-y-1.5">
                              {mod.materials.map((mat, matI) => (
                                <div key={matI} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                                  <div className="flex items-center gap-2.5">
                                    {materialIcon(mat.type)}
                                    <div>
                                      <p className="text-[12px] font-semibold text-slate-800">{mat.title}</p>
                                      <p className="text-[10px] text-slate-400 capitalize">{mat.type}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {mat.url && (
                                      <a href={mat.url} target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                                        style={{ color: 'var(--ev-indigo)', background: 'rgba(91,82,255,0.06)' }}>
                                        Open
                                      </a>
                                    )}
                                    <button onClick={() => handleDeleteMaterial(mi, matI)}
                                      className="p-1 rounded text-slate-300 hover:text-rose-500 transition-colors">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Assignments Tab */}
              {activeTab === 'assignments' && (
                <AssignmentsTab courseId={selectedCourse._id} courseName={selectedCourse.name} />
              )}

              {/* Students Tab */}
              {activeTab === 'students' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-[13px] text-slate-500">Enrolled students for {selectedCourse.branch} {selectedCourse.sections.join(', ')}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Student management is handled through the Faculty Students page</p>
                  <Link href="/faculty/students" className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ color: 'var(--ev-indigo)', background: 'rgba(91,82,255,0.06)' }}>
                    View Students <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-slate-900 mb-4">Create New Course</h3>
            <div className="space-y-3">
              <input placeholder="Course name *" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8]" />
              <input placeholder="Course code (e.g. CS201)" value={createForm.code} onChange={e => setCreateForm(p => ({ ...p, code: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8]" />
              <textarea placeholder="Description" value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8] h-20 resize-none" />
              <div className="grid grid-cols-3 gap-2">
                <select value={createForm.branch} onChange={e => setCreateForm(p => ({ ...p, branch: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none">
                  {['CSE', 'ECE', 'IT', 'AI', 'MECH', 'CIVIL', 'EEE'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={createForm.year} onChange={e => setCreateForm(p => ({ ...p, year: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none">
                  <option value="1">1st Year</option><option value="2">2nd Year</option>
                  <option value="3">3rd Year</option><option value="4">4th Year</option>
                </select>
                <input placeholder="Sections (A,B)" value={createForm.sections} onChange={e => setCreateForm(p => ({ ...p, sections: e.target.value }))}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8]" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-xl text-[12px] font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleCreateCourse} disabled={creating || !createForm.name.trim()}
                className="px-4 py-2 rounded-xl text-[12px] font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModuleModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-slate-900 mb-4">Add Module</h3>
            <div className="space-y-3">
              <input placeholder="Module title *" value={moduleForm.title} onChange={e => setModuleForm(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8]" />
              <textarea placeholder="Description (optional)" value={moduleForm.description} onChange={e => setModuleForm(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8] h-16 resize-none" />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModuleModal(false)} className="px-4 py-2 rounded-xl text-[12px] font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleAddModule} disabled={!moduleForm.title.trim()}
                className="px-4 py-2 rounded-xl text-[12px] font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                Add Module
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowMaterialModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-slate-900 mb-4">Add Study Material</h3>
            <div className="space-y-3">
              <input placeholder="Material title *" value={materialForm.title} onChange={e => setMaterialForm(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8]" />
              <select value={materialForm.type} onChange={e => setMaterialForm(p => ({ ...p, type: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none">
                <option value="note">📝 Note</option>
                <option value="pdf">📄 PDF/Document</option>
                <option value="link">🔗 External Link</option>
                <option value="video">🎥 Video</option>
              </select>
              <input placeholder="URL (for PDF/Link/Video)" value={materialForm.url} onChange={e => setMaterialForm(p => ({ ...p, url: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8]" />
              <textarea placeholder="Content (for notes)" value={materialForm.content} onChange={e => setMaterialForm(p => ({ ...p, content: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8] h-20 resize-none" />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowMaterialModal(false)} className="px-4 py-2 rounded-xl text-[12px] font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleAddMaterial} disabled={!materialForm.title.trim()}
                className="px-4 py-2 rounded-xl text-[12px] font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                Add Material
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Assignments sub-tab ── */
function AssignmentsTab({ courseId, courseName }: { courseId: string; courseName: string }) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', dueTime: '', maxScore: '100' });
  const [creating, setCreating] = useState(false);

  const fetchAssignments = useCallback(async () => {
    const res = await fetch(`/api/assignments?courseId=${courseId}`, { cache: 'no-store' });
    const data = await res.json();
    setAssignments(data.assignments || []);
  }, [courseId]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.dueDate) return;
    setCreating(true);
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', courseId, ...form, maxScore: parseInt(form.maxScore) || 100 }),
      });
      const data = await res.json();
      if (data.assignment) {
        setAssignments(prev => [data.assignment, ...prev]);
        setShowCreateModal(false);
        setForm({ title: '', description: '', dueDate: '', dueTime: '', maxScore: '100' });
      }
    } catch { /* non-fatal */ }
    finally { setCreating(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
          <Plus className="w-3.5 h-3.5" /> New Assignment
        </button>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <Target className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-[13px] text-slate-500">No assignments yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => {
            const isOverdue = new Date(a.dueDate) < new Date();
            return (
              <div key={a._id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: isOverdue ? 'rgba(225,29,72,0.06)' : 'rgba(79,70,229,0.06)' }}>
                    <Target className="w-4 h-4" style={{ color: isOverdue ? '#FF4D5E' : '#5B52FF' }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">{a.title}</p>
                    <p className="text-[10px] text-slate-400">
                      Due: {new Date(a.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {a.dueTime ? ` at ${a.dueTime}` : ''} · Max: {a.maxScore}
                    </p>
                  </div>
                </div>
                {isOverdue && (
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded"
                    style={{ background: 'rgba(225,29,72,0.06)', color: 'var(--ev-rose)' }}>
                    OVERDUE
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-slate-900 mb-4">New Assignment — {courseName}</h3>
            <div className="space-y-3">
              <input placeholder="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8]" />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8] h-16 resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Due Date *</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8]" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Due Time</label>
                  <input type="time" value={form.dueTime} onChange={e => setForm(p => ({ ...p, dueTime: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8]" />
                </div>
              </div>
              <input type="number" placeholder="Max Score" value={form.maxScore} onChange={e => setForm(p => ({ ...p, maxScore: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-[12px] outline-none focus:border-[#1CDEC8]" />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-xl text-[12px] font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !form.title.trim() || !form.dueDate}
                className="px-4 py-2 rounded-xl text-[12px] font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
