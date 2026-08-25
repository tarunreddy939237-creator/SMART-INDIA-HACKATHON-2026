'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Lock, ExternalLink } from 'lucide-react';
import Link from 'next/link';

function ReportViewContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No report token provided.');
      setLoading(false);
      return;
    }
    fetchReport();
  }, [token]);

  const fetchReport = async () => {
    try {
      const res = await fetch(`/api/student-report/secure-link?token=${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load report');
      }
      const data = await res.json();
      setReport(data.report);
    } catch (err: any) {
      setError(err.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500">Loading secure report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center p-8 rounded-2xl bg-white border border-slate-200 max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Unable to Load Report</h2>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <Link href="/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            <Lock className="w-4 h-4" /> Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!report) return null;

  // Render the same report component as the parent report page
  return (
    <div className="min-h-screen" style={{ background: '#F7F8FC' }}>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-2 mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <Lock className="w-4 h-4 text-amber-600" />
          <span className="text-xs text-amber-700">This is a secure, time-limited report link.</span>
        </div>
        {/* Reuse the report display — simplified inline version */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6">
          <h1 className="text-xl font-bold text-slate-900">{report.student.name}</h1>
          <p className="text-sm text-slate-500">{report.student.rollNumber} • {report.student.branch}-{report.student.section}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="text-center p-3 rounded-xl bg-slate-50">
              <p className="text-lg font-bold">{report.attendance.percentage}%</p>
              <p className="text-[10px] text-slate-500 uppercase">Attendance</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-slate-50">
              <p className="text-lg font-bold">{report.academics.averageQuizScore}%</p>
              <p className="text-[10px] text-slate-500 uppercase">Quiz Average</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-slate-50">
              <p className="text-lg font-bold">{report.assignments.submitted}/{report.assignments.total}</p>
              <p className="text-[10px] text-slate-500 uppercase">Assignments</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-slate-50">
              <p className="text-lg font-bold">{report.streak.current} days</p>
              <p className="text-[10px] text-slate-500 uppercase">Streak</p>
            </div>
          </div>
          {report.summary && (
            <div className="mt-6 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
              <p className="text-sm text-slate-700">{report.summary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <ReportViewContent />
    </Suspense>
  );
}
