'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, CheckCircle2, XCircle, Save, Users, ShieldCheck,
  Play, Square, ShieldAlert, AlertCircle, AlertTriangle, UserX,
} from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Topbar from '@/components/dashboard/Topbar';
import AnomalyFlagList from '@/components/dashboard/AnomalyFlagList';
import Badge from '@/components/shared/Badge';

interface EnrolledStudent {
  _id: string;
  name: string;
  email: string;
  classOrSubject: string;
  faceEmbedding: number[];
  status: 'present' | 'absent';
  confidenceScore: number;
  voteCount: number;
  consecutiveMisses: number;
}

const SECTIONS = [
  'CSE-A','CSE-B','CSE-C','ECE-A','ECE-B','ECE-C',
  'IT-A','IT-B','IT-C','AI-A','AI-B','AI-C',
  'MECH-A','MECH-B','MECH-C','CIVIL-A','CIVIL-B','CIVIL-C',
];

const VOTES_REQUIRED    = 5;    // consecutive frames needed to confirm presence
const MATCH_THRESHOLD   = 0.50; // combined distance threshold
const MIN_CONFIDENCE    = 75;   // % — below this = warn, never auto-mark present
const MAX_FACES_ALLOWED = 1;    // warn if more than 1 face in frame

function normalize(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return mag === 0 ? v : v.map(x => x / mag);
}
function euclidean(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}
function cosineDistance(a: number[], b: number[]): number {
  return 1 - a.reduce((s, v, i) => s + v * b[i], 0);
}
function combinedDist(a: number[], b: number[]): number {
  const na = normalize(a), nb = normalize(b);
  return 0.5 * euclidean(na, nb) + 0.5 * cosineDistance(na, nb);
}

// face-api distances: 0.0=identical, ~0.6=different person
// Map to 0–100% so dist=0→100%, dist=0.6→0%
function distToConfidence(dist: number): number {
  return Math.round(Math.max(0, Math.min(100, (1 - dist / 0.6) * 100)));
}

type Warning = 'multi-face' | 'low-conf' | 'unknown' | null;

interface LiveResult {
  label: string;
  conf: number;
  matched: boolean;
  studentId: string;
}

export default function FacultyAttendancePage() {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const loopRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceApiRef  = useRef<any>(null);
  const studentsRef = useRef<EnrolledStudent[]>([]);

  const [section, setSection]         = useState('CSE-A');
  const [students, setStudents]       = useState<EnrolledStudent[]>([]);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [cameraOn, setCameraOn]       = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Live recognition state
  const [liveResults, setLiveResults]   = useState<LiveResult[]>([]);
  const [warning, setWarning]           = useState<Warning>(null);
  const [warningMsg, setWarningMsg]     = useState('');
  const [fps, setFps]                   = useState(0);
  const fpsRef = useRef({ count: 0, last: Date.now() });

  useEffect(() => { studentsRef.current = students; }, [students]);

  // Load models
  useEffect(() => {
    import('face-api.js').then(async (fapi) => {
      await Promise.all([
        fapi.nets.ssdMobilenetv1.loadFromUri('/models'),
        fapi.nets.faceLandmark68Net.loadFromUri('/models'),
        fapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      faceApiRef.current = fapi;
      setModelsReady(true);
    }).catch(() => {}).finally(() => setModelLoading(false));
    return () => stopCamera();
  }, []);

  // Load roster on section change
  useEffect(() => {
    stopCamera();
    setStudents([]);
    setLiveResults([]);
    setWarning(null);
    fetch(`/api/face-embedding?section=${section}`)
      .then(r => r.json())
      .then(d => {
        if (d.students) {
          setStudents(d.students.map((u: any) => ({
            _id: u._id, name: u.name, email: u.email,
            classOrSubject: u.classOrSubject,
            faceEmbedding: u.faceEmbedding?.length ? normalize(u.faceEmbedding) : [],
            status: 'absent' as const,
            confidenceScore: 0,
            voteCount: 0,
            consecutiveMisses: 0,
          })));
        }
      }).catch(() => {});
  }, [section]);

  const stopCamera = useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setLiveResults([]);
    setWarning(null);
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', frameRate: { ideal: 30 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraOn(true);
      startLoop();
    } catch {
      alert('Camera access denied.');
    }
  };

  const startLoop = () => {
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = setInterval(async () => {
      const fapi = faceApiRef.current;
      if (!fapi || !videoRef.current) return;

      // FPS
      fpsRef.current.count++;
      const now = Date.now();
      if (now - fpsRef.current.last >= 1000) {
        setFps(fpsRef.current.count);
        fpsRef.current = { count: 0, last: now };
      }

      const detections = await fapi
        .detectAllFaces(videoRef.current, new fapi.SsdMobilenetv1Options({ minConfidence: 0.72 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      // ── MULTI-FACE WARNING ─────────────────────────────────────────────
      if (detections.length > MAX_FACES_ALLOWED) {
        setWarning('multi-face');
        setWarningMsg(`${detections.length} faces detected in frame. Only 1 student at a time is allowed for accurate recognition. Please ask others to step back.`);
        setLiveResults([]);
        // Reset all vote counts — can't trust any match when multiple faces present
        setStudents(prev => prev.map(s => ({ ...s, voteCount: 0, consecutiveMisses: 0 })));
        return;
      }

      if (!detections.length) {
        setWarning(null);
        setLiveResults([]);
        // Increment miss counter — never touch already-confirmed students
        setStudents(prev => prev.map(s => {
          if (s.status === 'present') return s;
          const misses = Math.min(s.consecutiveMisses + 1, 10);
          return misses >= 3
            ? { ...s, consecutiveMisses: misses, voteCount: 0 }
            : { ...s, consecutiveMisses: misses };
        }));
        return;
      }

      // ── SINGLE FACE — run recognition ─────────────────────────────────
      const det = detections[0];

      // Quality gate
      if (det.detection.score < 0.75) {
        setWarning('low-conf');
        setWarningMsg(`Face detection confidence too low (${Math.round(det.detection.score * 100)}%). Improve lighting or move closer.`);
        setLiveResults([]);
        return;
      }

      const descriptor = normalize(Array.from(det.descriptor) as number[]);
      const roster = studentsRef.current;

      // Find best match
      let best = { id: '', name: 'Unknown', dist: 999 };
      for (const s of roster) {
        if (!s.faceEmbedding?.length) continue;
        const dist = combinedDist(descriptor, s.faceEmbedding);
        if (dist < best.dist) best = { id: s._id, name: s.name, dist };
      }

      const conf = distToConfidence(best.dist);

      // ── UNKNOWN FACE ──────────────────────────────────────────────────
      if (best.dist > MATCH_THRESHOLD || !best.id) {
        setWarning('unknown');
        setWarningMsg(`Face not recognised (best distance: ${best.dist.toFixed(3)}, threshold: ${MATCH_THRESHOLD}). Student may not have registered their face.`);
        setLiveResults([{ label: 'Unknown', conf: 0, matched: false, studentId: '' }]);
        setStudents(prev => prev.map(s =>
          s.status === 'present' ? s : {
            ...s,
            consecutiveMisses: Math.min(s.consecutiveMisses + 1, 10),
            voteCount: s.consecutiveMisses + 1 >= 3 ? 0 : s.voteCount,
          }
        ));
        return;
      }

      // ── LOW CONFIDENCE WARNING ─────────────────────────────────────────
      if (conf < MIN_CONFIDENCE) {
        setWarning('low-conf');
        setWarningMsg(`Possible match: ${best.name} — confidence ${conf}% is below minimum ${MIN_CONFIDENCE}%. Ask the student to reposition or improve lighting.`);
        setLiveResults([{ label: best.name, conf, matched: false, studentId: best.id }]);
        return;
      }

      // ── GOOD MATCH ────────────────────────────────────────────────────
      setWarning(null);
      setLiveResults([{ label: best.name, conf, matched: true, studentId: best.id }]);

      setStudents(prev => prev.map(s => {
        if (s.status === 'present') return s; // already confirmed, never touch
        if (s._id !== best.id) {
          const misses = Math.min(s.consecutiveMisses + 1, 10);
          return { ...s, consecutiveMisses: misses, voteCount: misses >= 3 ? 0 : s.voteCount };
        }
        const newVotes = s.voteCount + 1;
        if (newVotes >= VOTES_REQUIRED) {
          return { ...s, status: 'present', confidenceScore: conf, voteCount: newVotes, consecutiveMisses: 0 };
        }
        return { ...s, voteCount: newVotes, consecutiveMisses: 0 };
      }));
    }, 500);
  };

  const handleCommit = async () => {
    setIsSaving(true); setSaveSuccess(false);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: students.map(s => ({
            studentId: s._id,
            status: s.status === 'present' ? 'present' : 'absent',
            confidenceScore: s.confidenceScore,
            livenessVerified: s.status === 'present',
            livenessChallenge: 'face-recognition',
          })),
        }),
      });
      if (res.ok) { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 4000); }
    } catch { /* ignore */ }
    finally { setIsSaving(false); }
  };

  const presentCount     = students.filter(s => s.status === 'present').length;
  const enrolledWithFace = students.filter(s => s.faceEmbedding?.length > 0).length;

  const warningColors: Record<NonNullable<Warning>, string> = {
    'multi-face': 'bg-rose-50 border-rose-300 text-rose-800',
    'low-conf':   'bg-amber-50 border-amber-300 text-amber-800',
    'unknown':    'bg-orange-50 border-orange-300 text-orange-800',
  };
  const warningIcons: Record<NonNullable<Warning>, React.ReactNode> = {
    'multi-face': <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
    'low-conf':   <AlertCircle   className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
    'unknown':    <UserX         className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />,
  };

  return (
    <div className="flex min-h-screen dash-bg text-slate-900">
      <Sidebar role="faculty" />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Face Attendance" roleBadge="FACULTY" />
        <main className="flex-1 p-5 sm:p-6 lg:p-8 space-y-5 overflow-y-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4"
            style={{ borderBottom: '1px solid rgba(28,222,200,0.15)' }}>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>Real-Time Face Recognition</h1>
              <p className="font-mono text-[10px] text-slate-400 mt-0.5" style={{ letterSpacing: '0.04em' }}>
                SsdMobilenetv1 · {VOTES_REQUIRED}-vote lock · min {MIN_CONFIDENCE}% confidence · 1 face at a time
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select value={section} onChange={e => setSection(e.target.value)}
                className="font-mono text-xs border rounded-xl px-3 py-2 bg-white outline-none shadow-sm"
                style={{ borderColor: 'rgba(28,222,200,0.3)' }}>
                {SECTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
              <span className="font-mono text-xs px-3 py-1.5 rounded-xl bg-white border shadow-sm"
                style={{ borderColor: 'rgba(28,222,200,0.25)' }}>
                Present: <strong style={{ color: 'var(--ev-emerald)' }}>{presentCount}</strong> / {students.length}
              </span>
              <motion.button onClick={handleCommit} disabled={isSaving || !students.length}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="px-4 py-2 rounded-xl text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #10B981, #1CDEC8)', boxShadow: '0 4px 16px rgba(28,222,200,0.3)' }}>
                <Save className="w-4 h-4" />{isSaving ? 'Saving…' : 'Commit Attendance'}
              </motion.button>
            </div>
          </div>

          {/* Model status */}
          <div className="p-3.5 rounded-2xl flex items-start gap-3"
            style={{ background: 'rgba(28,222,200,0.06)', border: '1px solid rgba(79,70,229,0.15)' }}>
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--ev-indigo)' }} />
            <p className="font-mono text-[11px] text-slate-700">
              <strong style={{ color: 'var(--ev-indigo)' }}>
                {modelLoading ? 'Loading models…' : modelsReady ? 'Models ready · ' : 'Model load failed · '}
              </strong>
              {modelsReady && `${enrolledWithFace}/${students.length} faces enrolled · ${VOTES_REQUIRED} consecutive matches required · confidence ≥ ${MIN_CONFIDENCE}% · 1 face per frame`}
            </p>
          </div>

          {/* No face data warning */}
          {enrolledWithFace === 0 && students.length > 0 && (
            <div className="p-3.5 rounded-2xl flex items-start gap-3 bg-amber-50 border border-amber-200 shadow-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700">
                <strong className="text-amber-800">No face data enrolled — </strong>
                Students must visit <strong>Dashboard → Register Face</strong> first.
              </p>
            </div>
          )}

          {/* Live warning banner */}
          <AnimatePresence>
            {warning && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-medium ${warningColors[warning]}`}>
                {warningIcons[warning]}
                <div>
                  <strong className="block mb-0.5">
                    {warning === 'multi-face' ? '⚠ Multiple Faces Detected — Recognition Paused'
                      : warning === 'low-conf' ? '⚠ Low Confidence Match'
                      : '⚠ Unknown Face'}
                  </strong>
                  {warningMsg}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {saveSuccess && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Attendance committed successfully!
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Camera panel */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl p-5 flex flex-col ev-scanline-loop" style={{ background: '#0C1222', border: '1px solid #1A2535', height: 520 }}>
                <div className="relative flex-1 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: '#050810' }}>
                  <video ref={videoRef} autoPlay playsInline muted
                    className={`w-full h-full object-cover -scale-x-100 ${cameraOn ? 'block' : 'hidden'}`}
                  />

                  {/* Viewfinder brackets */}
                  {cameraOn && (
                    <div className="absolute inset-[12px] pointer-events-none transition-all duration-200"
                      style={{ opacity: liveResults[0]?.matched ? 1 : 0.5 }}>
                      {/* TL */}
                      <div className="absolute top-0 left-0 transition-all duration-200"
                        style={{ width: liveResults[0]?.matched ? 10 : 16, height: liveResults[0]?.matched ? 10 : 16, borderTop: '2px solid #1CDEC8', borderLeft: '2px solid #1CDEC8' }} />
                      {/* TR */}
                      <div className="absolute top-0 right-0 transition-all duration-200"
                        style={{ width: liveResults[0]?.matched ? 10 : 16, height: liveResults[0]?.matched ? 10 : 16, borderTop: '2px solid #1CDEC8', borderRight: '2px solid #1CDEC8' }} />
                      {/* BL */}
                      <div className="absolute bottom-0 left-0 transition-all duration-200"
                        style={{ width: liveResults[0]?.matched ? 10 : 16, height: liveResults[0]?.matched ? 10 : 16, borderBottom: '2px solid #1CDEC8', borderLeft: '2px solid #1CDEC8' }} />
                      {/* BR */}
                      <div className="absolute bottom-0 right-0 transition-all duration-200"
                        style={{ width: liveResults[0]?.matched ? 10 : 16, height: liveResults[0]?.matched ? 10 : 16, borderBottom: '2px solid #1CDEC8', borderRight: '2px solid #1CDEC8' }} />
                    </div>
                  )}

                  {/* Recognition result overlay */}
                  {cameraOn && liveResults.length > 0 && (
                    <div className="absolute top-3 left-3 right-3 space-y-1">
                      {liveResults.map((r, i) => (
                        <div key={i} className="font-mono text-xs px-3 py-2 rounded-xl flex items-center gap-2"
                          style={!r.matched
                            ? { background: 'rgba(255,77,94,0.85)', color: '#FFE4E8', border: '1px solid rgba(255,77,94,0.5)' }
                            : r.conf >= MIN_CONFIDENCE
                              ? { background: 'rgba(28,222,200,0.15)', color: 'var(--ev-indigo)', border: '1px solid rgba(28,222,200,0.5)' }
                              : { background: 'rgba(255,170,0,0.15)', color: 'var(--ev-amber)', border: '1px solid rgba(255,170,0,0.5)' }
                          }>
                          {!r.matched ? '✗' : r.conf >= MIN_CONFIDENCE ? '✓' : '⚠'}
                          <span className="font-bold">{r.label}</span>
                          {r.conf > 0 && <span className="ml-auto opacity-80">{r.conf}% conf</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Multi-face overlay */}
                  {cameraOn && warning === 'multi-face' && (
                    <div className="absolute inset-0 rounded-xl pointer-events-none flex items-center justify-center"
                      style={{ border: '2px solid rgba(255,77,94,0.6)' }}>
                      <div className="text-xs font-mono font-bold px-4 py-2 rounded-xl flex items-center gap-2"
                        style={{ background: 'rgba(255,77,94,0.9)', color: '#fff' }}>
                        <AlertTriangle className="w-4 h-4" /> MULTIPLE FACES — PAUSED
                      </div>
                    </div>
                  )}

                  {/* Bottom HUD */}
                  {cameraOn && (
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono px-3 py-1.5 rounded-xl"
                      style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(79,70,229,0.15)', color: '#E2E8F0' }}>
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full live-indicator`}
                          style={{ background: warning === 'multi-face' ? '#FF4D5E' : '#1CDEC8' }} />
                        {warning === 'multi-face' ? 'PAUSED' : 'SCANNING'} · SsdMobilenetv1
                      </span>
                      <span style={{ color: 'rgba(28,222,200,0.8)' }}>{fps} fps · thr {MATCH_THRESHOLD} · {VOTES_REQUIRED}-vote</span>
                    </div>
                  )}

                  {!cameraOn && (
                    <div className="text-center space-y-3 p-6">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                        style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)' }}>
                        <Camera className="w-7 h-7" style={{ color: 'var(--ev-indigo)' }} />
                      </div>
                      <p className="text-sm font-semibold text-white">Camera Inactive</p>
                      <p className="font-mono text-[11px] max-w-xs mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {modelsReady ? 'Start camera · Students approach one at a time' : modelLoading ? 'Loading AI models…' : 'Models unavailable'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex items-center justify-between">
                  {!cameraOn
                    ? <motion.button onClick={startCamera} disabled={!modelsReady} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        className="px-4 py-2 rounded-xl text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', boxShadow: '0 4px 14px rgba(28,222,200,0.3)' }}>
                        <Play className="w-3.5 h-3.5" /> Start Camera
                      </motion.button>
                    : <motion.button onClick={stopCamera} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        className="px-4 py-2 rounded-xl text-white font-semibold text-xs flex items-center gap-1.5"
                        style={{ background: '#FF4D5E', boxShadow: '0 4px 14px rgba(255,77,94,0.3)' }}>
                        <Square className="w-3.5 h-3.5" /> Stop Camera
                      </motion.button>
                  }
                  <span className="font-mono text-[10px]" style={{ color: modelLoading ? '#94A3B8' : modelsReady ? '#1CDEC8' : '#FF4D5E' }}>
                    {modelLoading ? 'Loading…' : modelsReady ? '✓ SsdMobilenetv1 ready' : '✗ Models failed'}
                  </span>
                </div>
              </div>
            </div>

            {/* Roster */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl p-5 flex flex-col" style={{ background: '#fff', border: '1px solid rgba(79,70,229,0.15)', height: 520, boxShadow: '0 2px 12px rgba(28,222,200,0.06)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color: 'var(--ev-indigo)' }} /> {section} Roster
                  </h3>
                  <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: 'rgba(79,70,229,0.06)', color: 'var(--ev-indigo)', border: '1px solid rgba(79,70,229,0.15)' }}>
                    {students.length} ENROLLED
                  </span>
                </div>

                <p className="font-mono text-[9px] mb-3" style={{ color: 'rgba(28,222,200,0.6)', letterSpacing: '0.04em' }}>
                  FACE RECOGNITION ONLY · USE MANUAL PAGE FOR OVERRIDES
                </p>

                {students.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                    No students found for {section}
                  </div>
                )}

                <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                  {students.map(s => {
                    const isPresent    = s.status === 'present';
                    const isMatching   = liveResults[0]?.studentId === s._id && liveResults[0]?.matched;
                    const voteProgress = Math.min(s.voteCount / VOTES_REQUIRED, 1);
                    // Build vote dot string: ■ filled, □ empty
                    const voteDots = Array.from({ length: VOTES_REQUIRED }, (_, i) =>
                      i < s.voteCount ? '■' : '□'
                    ).join(' ');

                    return (
                      <motion.div key={s._id} layout
                        className="p-3 rounded-xl border transition-all"
                        style={isPresent
                          ? { background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.3)' }
                          : isMatching
                          ? { background: 'rgba(28,222,200,0.06)', borderColor: 'rgba(28,222,200,0.35)' }
                          : { background: '#F9FAFB', borderColor: '#E2E8F0' }
                        }>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 truncate">{s.name}</span>
                              {isPresent && (
                                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                  style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--ev-emerald)', border: '1px solid rgba(16,185,129,0.3)' }}>
                                  <ShieldAlert className="w-2.5 h-2.5" /> Face {s.confidenceScore}%
                                </span>
                              )}
                              {!s.faceEmbedding?.length && (
                                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                                  style={{ background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}>No face</span>
                              )}
                            </div>

                            {/* Vote progress — monospace dots */}
                            {!isPresent && s.voteCount > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                <p className="font-mono text-[10px] tracking-wider" style={{ color: 'var(--ev-indigo)' }}>{voteDots} {s.voteCount}/{VOTES_REQUIRED}</p>
                              </div>
                            )}
                          </div>

                          {/* Status badge */}
                          <div className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 shrink-0"
                            style={isPresent
                              ? { background: 'rgba(16,185,129,0.08)', color: 'var(--ev-emerald)', border: '1px solid rgba(16,185,129,0.3)' }
                              : isMatching
                              ? { background: 'rgba(79,70,229,0.06)', color: 'var(--ev-indigo)', border: '1px solid rgba(28,222,200,0.3)' }
                              : { background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }
                            }>
                            {isPresent
                              ? <><CheckCircle2 className="w-3 h-3" /> PRESENT</>
                              : isMatching
                              ? <><Camera className="w-3 h-3" /> SCAN…</>
                              : <><XCircle className="w-3 h-3" /> ABSENT</>
                            }
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="pt-3 flex items-center justify-between font-mono text-[10px]"
                  style={{ borderTop: '1px solid rgba(28,222,200,0.15)', color: 'rgba(28,222,200,0.5)' }}>
                  <span>{VOTES_REQUIRED}-VOTE CONFIRMATION · READ-ONLY</span>
                  <span className="font-bold" style={{ color: 'var(--ev-indigo)' }}>{presentCount}/{students.length} CONFIRMED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Anomaly Flag List — below camera + roster */}
          <div className="mt-6">
            <AnomalyFlagList section={section} />
          </div>
        </main>
      </div>
    </div>
  );
}
