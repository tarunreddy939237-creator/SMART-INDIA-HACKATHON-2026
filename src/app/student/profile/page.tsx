'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  User, Mail, BookOpen, GraduationCap, Flame, CalendarCheck,
  Award, Brain, TrendingUp, ShieldCheck, ScanFace, Clock,
} from 'lucide-react';
import StudentSidebar from '@/components/dashboard/StudentSidebar';
import StudentTopbar from '@/components/dashboard/StudentTopbar';
import LoadingState from '@/components/shared/LoadingState';
import GuardianNotificationPanel from '@/components/dashboard/GuardianNotificationPanel';
import Link from 'next/link';

interface ProfileData {
  user: { _id: string; name: string; email: string; role: string; classOrSubject: string; rollNumber?: string; yearOfStudy?: number };
  streak: { currentStreak: number; longestStreak: number; badges: string[] };
  attendance: { overallPercentage: number; totalClasses: number; presentCount: number; absentCount: number };
  quizSummary: { avgScore: number; totalAttempts: number; weakTopics: { topic: string; missedCount: number }[] };
  score: { successScore: number | null; riskTier: string } | null;
}

interface StudentInfo {
  subjects: string[];
  labs: string[];
}

export default function StudentProfilePage() {
  const { data: session } = useSession();
  const studentId = (session?.user as any)?.id || '';
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo>({ subjects: [], labs: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    Promise.all([
      fetch(`/api/student-profile?studentId=${studentId}`).then(r => r.json()).catch(() => null),
      fetch(`/api/students?studentId=${studentId}`).then(r => r.json()).catch(() => null),
    ]).then(([profileRes, studentRes]) => {
      if (profileRes?.profile) setProfile(profileRes.profile);
      if (studentRes?.student) setStudentInfo(studentRes.student);
    }).finally(() => setLoading(false));
  }, [studentId]);

  const riskColor = (tier: string) =>
    tier === 'High' ? 'text-rose-700 bg-rose-50 border-rose-200'
    : tier === 'Medium' ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-emerald-700 bg-emerald-50 border-emerald-200';

  const attendancePct = profile?.attendance.overallPercentage ?? 0;
  const attendanceColor = attendancePct >= 75 ? 'text-emerald-700' : 'text-rose-700';

  return (
    <div className="flex min-h-screen bg-[#F4F6FA] text-slate-900">
      <StudentSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <StudentTopbar title="My Profile" subtitle="Academic profile & settings" />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">

          {loading ? <LoadingState message="Loading your profile..." /> : (
            <>
              {/* Profile header */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shrink-0">
                  {profile?.user.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'S'}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-slate-900">{profile?.user.name || session?.user?.name}</h1>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail className="w-3.5 h-3.5" />{profile?.user.email || session?.user?.email}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-medium">
                      <GraduationCap className="w-3.5 h-3.5" />{profile?.user.classOrSubject || (session?.user as any)?.classOrSubject || 'N/A'}
                    </span>
                    {(profile?.user.rollNumber || (session?.user as any)?.rollNumber) && (
                      <span className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded font-medium">
                        🆔 {profile?.user.rollNumber || (session?.user as any)?.rollNumber}
                      </span>
                    )}
                    {(profile?.user.yearOfStudy || (session?.user as any)?.yearOfStudy) ? (
                      <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded font-medium">
                        📚 {['', '1st Year', '2nd Year', '3rd Year', '4th Year'][profile?.user.yearOfStudy || (session?.user as any)?.yearOfStudy || 0]}
                      </span>
                    ) : null}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded border capitalize bg-slate-50 border-slate-200 text-slate-600">
                      {profile?.user.role || 'student'}
                    </span>
                  </div>
                </div>
                <Link href="/student/register-face"
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-sm">
                  <ScanFace className="w-4 h-4" /> Update Face ID
                </Link>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Attendance */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <CalendarCheck className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Attendance</span>
                  </div>
                  <p className={`text-3xl font-black ${attendanceColor}`}>{attendancePct}%</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {profile?.attendance.presentCount ?? 0} present · {profile?.attendance.absentCount ?? 0} absent
                  </p>
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${attendancePct >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${attendancePct}%` }} />
                  </div>
                </div>

                {/* Streak */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Study Streak</span>
                  </div>
                  <p className="text-3xl font-black text-amber-600">{profile?.streak.currentStreak ?? 0}</p>
                  <p className="text-[11px] text-slate-400 mt-1">days · Best: {profile?.streak.longestStreak ?? 0} days</p>
                </div>

                {/* Quiz score */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                      <Brain className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg Quiz Score</span>
                  </div>
                  <p className="text-3xl font-black text-emerald-600">{profile?.quizSummary.avgScore ?? 0}%</p>
                  <p className="text-[11px] text-slate-400 mt-1">{profile?.quizSummary.totalAttempts ?? 0} attempts total</p>
                </div>

                {/* Risk tier */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Risk Level</span>
                  </div>
                  <span className={`inline-flex items-center text-sm font-bold px-3 py-1 rounded-lg border ${riskColor(profile?.score?.riskTier || 'Low')}`}>
                    {profile?.score?.riskTier || 'Low'} Risk
                  </span>
                  {profile?.score?.successScore != null && (
                    <p className="text-[11px] text-slate-400 mt-2">Success score: {profile.score.successScore}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Subjects & Labs */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-[14px] font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" /> Enrolled Subjects
                  </h3>
                  {studentInfo.subjects.length === 0 && studentInfo.labs.length === 0 ? (
                    <p className="text-xs text-slate-400">No subjects assigned yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {studentInfo.subjects.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Theory Subjects</p>
                          <div className="space-y-1.5">
                            {studentInfo.subjects.map((s, i) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                                <span className="text-[10px] font-bold text-indigo-400 w-5 shrink-0">{i + 1}.</span>
                                <span className="text-[13px] font-medium text-indigo-900">{s}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {studentInfo.labs.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Lab Subjects</p>
                          <div className="space-y-1.5">
                            {studentInfo.labs.map((l, i) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                                <span className="text-[10px] font-bold text-emerald-400 w-5 shrink-0">{i + 1}.</span>
                                <span className="text-[13px] font-medium text-emerald-900">{l}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Badges & Weak Topics */}
                <div className="space-y-4">
                  {/* Badges */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-[14px] font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" /> Achievements
                    </h3>
                    {(profile?.streak.badges ?? []).length === 0 ? (
                      <p className="text-xs text-slate-400">Complete quizzes and maintain streaks to earn badges.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {profile!.streak.badges.map((badge, i) => (
                          <span key={i} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-1.5">
                            <Award className="w-3 h-3" />{badge}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Weak topics */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-[14px] font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-rose-500" /> Topics Needing Attention
                    </h3>
                    {(profile?.quizSummary.weakTopics ?? []).length === 0 ? (
                      <p className="text-xs text-slate-400">No weak topics identified yet. Take a quiz to get insights.</p>
                    ) : (
                      <div className="space-y-2">
                        {profile!.quizSummary.weakTopics.slice(0, 5).map((w, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 bg-rose-50 border border-rose-100 rounded-xl">
                            <span className="text-[12px] font-medium text-rose-900">{w.topic}</span>
                            <span className="text-[10px] text-rose-500 font-semibold">{w.missedCount} miss{w.missedCount !== 1 ? 'es' : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <Link href="/student/learning"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline">
                      Generate AI Study Plan →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Guardian Notification Settings */}
              {studentId && <GuardianNotificationPanel studentId={studentId} />}

              {/* Privacy info */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Data Privacy</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your biometric face data is stored as a 128-number mathematical vector only — no photos are retained.
                    All academic data is encrypted in transit and at rest.
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
