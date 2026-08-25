'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, X, User, Clock } from 'lucide-react';

interface Anomaly {
  _id: string;
  studentId: { name: string; email: string; classOrSubject: string } | string;
  expectedSection: string;
  actualSession: string;
  confidence: number;
  timestamp: string;
  resolved: boolean;
  resolvedBy?: { name: string } | string;
  resolvedAt?: string;
  notes?: string;
}

interface AnomalyFlagListProps {
  section: string;
}

export default function AnomalyFlagList({ section }: AnomalyFlagListProps) {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance-anomalies?section=${encodeURIComponent(section)}&resolved=false`);
      const data = await res.json();
      if (data.anomalies) setAnomalies(data.anomalies);
    } catch {
      setAnomalies([]);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  const handleResolve = async (anomalyId: string) => {
    setResolvingId(anomalyId);
    try {
      await fetch('/api/attendance-anomalies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomalyId, resolved: true, notes: 'Faculty override — verified in person' }),
      });
      setAnomalies(prev => prev.filter(a => a._id !== anomalyId));
    } catch {
      // keep the anomaly visible
    } finally {
      setResolvingId(null);
    }
  };

  const unresolved = anomalies.filter(a => !a.resolved);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-bold text-slate-900">Flagged Anomalies</h3>
          {unresolved.length > 0 && (
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
              {unresolved.length} UNRESOLVED
            </span>
          )}
        </div>
        <button
          onClick={fetchAnomalies}
          className="text-[10px] font-mono text-slate-400 hover:text-slate-600 transition-colors"
        >
          REFRESH
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : unresolved.length === 0 ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No flagged anomalies for {section}</p>
          <p className="text-[10px] text-slate-300 mt-1">Cross-section mismatches will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {unresolved.map((anomaly) => {
              const studentName = typeof anomaly.studentId === 'object'
                ? anomaly.studentId.name
                : 'Unknown Student';
              const studentSection = typeof anomaly.studentId === 'object'
                ? anomaly.studentId.classOrSubject
                : anomaly.expectedSection;

              return (
                <motion.div
                  key={anomaly._id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-3 rounded-xl border border-rose-200 bg-rose-50/50 relative overflow-hidden"
                >
                  {/* Left accent */}
                  <div className="absolute top-0 left-0 bottom-0 w-0.5 bg-rose-400" />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-rose-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-900 truncate">{studentName}</p>
                        <p className="text-[10px] text-slate-500">
                          Enrolled in <span className="font-mono font-bold text-rose-600">{studentSection}</span>
                          {' — marked present in '}
                          <span className="font-mono font-bold text-amber-600">{anomaly.actualSession}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                            {anomaly.confidence}% match
                          </span>
                          <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(anomaly.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleResolve(anomaly._id)}
                      disabled={resolvingId === anomaly._id}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-[10px] font-semibold text-slate-600 hover:text-emerald-700 transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {resolvingId === anomaly._id ? 'Resolving…' : 'Override'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
