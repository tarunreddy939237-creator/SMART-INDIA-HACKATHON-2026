'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, Scan, Sun, Move, Volume2, VolumeX, Lock } from 'lucide-react';
import StudentSidebar from '@/components/dashboard/StudentSidebar';
import StudentTopbar from '@/components/dashboard/StudentTopbar';

type Status = 'idle' | 'loading-models' | 'ready' | 'capturing' | 'processing' | 'success' | 'error';

const TOTAL_SAMPLES = 30;
const POSE_HINTS = [
  'Look straight at the camera',
  'Slightly turn left',
  'Slightly turn right',
  'Tilt head slightly up',
  'Look straight again',
];

function normalize(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return mag === 0 ? v : v.map(x => x / mag);
}

export default function RegisterFacePage() {
  const { data: session } = useSession();
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceApiRef  = useRef<any>(null);
  const samplesRef  = useRef<number[][]>([]);

  const [status, setStatus]             = useState<Status>('idle');
  const [message, setMessage]           = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [poseHint, setPoseHint]         = useState(POSE_HINTS[0]);
  const [quality, setQuality]           = useState(0);
  const [muted, setMuted]               = useState(false);
  const [lastTickTime, setLastTickTime] = useState(0);
  const [lockIn, setLockIn]             = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  /* ── Web Audio API tone helpers ── */
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const playTickTone = useCallback(() => {
    if (muted) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch { /* audio not available */ }
  }, [muted, getAudioCtx]);

  const playSuccessTone = useCallback(() => {
    if (muted) return;
    try {
      const ctx = getAudioCtx();
      // Three-note ascending chime
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.25);
      });
    } catch { /* audio not available */ }
  }, [muted, getAudioCtx]);

  useEffect(() => {
    setStatus('loading-models');
    setMessage('Loading face recognition models…');
    import('face-api.js').then(async (fapi) => {
      await Promise.all([
        fapi.nets.ssdMobilenetv1.loadFromUri('/models'),
        fapi.nets.faceLandmark68Net.loadFromUri('/models'),
        fapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      faceApiRef.current = fapi;
      setStatus('ready');
      setMessage('Models ready. Start camera to register your face.');
    }).catch(() => {
      setStatus('error');
      setMessage('Failed to load models. Please refresh.');
    });
    return () => stopCamera();
  }, []);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', frameRate: { ideal: 30 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      samplesRef.current = [];
      setCaptureCount(0);
      setStatus('capturing');
      setMessage('Look straight at the camera. Hold still…');
      startDetectionLoop();
    } catch {
      setStatus('error');
      setMessage('Camera access denied. Please allow camera permissions.');
    }
  };

  const startDetectionLoop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      const fapi = faceApiRef.current;
      if (!fapi || !videoRef.current) return;

      const detection = await fapi
        .detectSingleFace(videoRef.current, new fapi.SsdMobilenetv1Options({ minConfidence: 0.7 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setFaceDetected(false);
        setQuality(0);
        setMessage('No face detected. Move closer, improve lighting.');
        return;
      }

      const score = detection.detection.score;
      const box = detection.detection.box;
      const sizePct = (box.width * box.height) / ((videoRef.current.videoWidth || 640) * (videoRef.current.videoHeight || 480));
      setQuality(Math.round(score * 100));

      if (score < 0.75 || sizePct < 0.04) {
        setFaceDetected(false);
        setMessage('Move closer to the camera for better quality.');
        return;
      }

      setFaceDetected(true);
      const descriptor = normalize(Array.from(detection.descriptor) as number[]);
      samplesRef.current = [...samplesRef.current, descriptor];
      const count = samplesRef.current.length;
      setCaptureCount(count);
      setLastTickTime(Date.now());
      playTickTone();
      setPoseHint(POSE_HINTS[Math.floor(count / 6) % POSE_HINTS.length]);

      if (count >= TOTAL_SAMPLES) {
        clearInterval(intervalRef.current!);
        processEmbeddings(samplesRef.current);
      } else {
        setMessage(`Capturing… ${count}/${TOTAL_SAMPLES} — ${POSE_HINTS[Math.floor(count / 6) % POSE_HINTS.length]}`);
      }
    }, 300);
  };

  const processEmbeddings = async (samples: number[][]) => {
    setStatus('processing');
    stopCamera();
    setMessage('Computing optimal face descriptor…');

    const centroid = samples[0].map((_, i) => samples.reduce((s, v) => s + v[i], 0) / samples.length);
    const dists = samples.map(s => Math.sqrt(s.reduce((sum, v, i) => sum + (v - centroid[i]) ** 2, 0)));
    const meanDist = dists.reduce((a, b) => a + b, 0) / dists.length;
    const stdDist = Math.sqrt(dists.map(d => (d - meanDist) ** 2).reduce((a, b) => a + b, 0) / dists.length);
    const filtered = samples.filter((_, i) => dists[i] <= meanDist + stdDist);

    const maxDist = Math.max(...filtered.map((_, i) => dists[i]));
    const weights = filtered.map((_, i) => maxDist - dists[i] + 0.001);
    const totalW = weights.reduce((a, b) => a + b, 0);
    const weighted = filtered[0].map((_, dim) =>
      filtered.reduce((sum, s, i) => sum + s[dim] * weights[i], 0) / totalW
    );
    const final = normalize(weighted);

    try {
      const res = await fetch('/api/face-embedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embedding: final }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLockIn(true);
      playSuccessTone();
      setTimeout(() => {
        setStatus('success');
        setMessage(`Face registered with ${filtered.length} quality samples. You can now use face attendance.`);
      }, 600);
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message || 'Failed to save face data.');
    }
  };

  const reset = () => {
    stopCamera();
    samplesRef.current = [];
    setCaptureCount(0);
    setFaceDetected(false);
    setQuality(0);
    setPoseHint(POSE_HINTS[0]);
    setStatus('ready');
    setMessage('Models ready. Start camera to register your face.');
  };

  const pct = Math.round((captureCount / TOTAL_SAMPLES) * 100);

  return (
    <div className="flex min-h-screen dash-bg text-slate-900">
      <StudentSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <StudentTopbar title="Face Registration" subtitle="Biometric attendance setup" />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="w-full max-w-5xl mx-auto space-y-5">

            {/* Privacy notice */}
            <div className="rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden"
              style={{ background: 'rgba(28,222,200,0.04)', border: '1px solid rgba(28,222,200,0.25)' }}>
              <div className="absolute top-0 left-0 bottom-0 w-0.5" style={{ background: 'linear-gradient(180deg, #4F46E5, #6366F1)' }} />
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--ev-indigo)' }} />
              <div className="text-xs text-slate-700">
                <strong className="block mb-0.5" style={{ color: '#0E8F82' }}>Privacy Notice</strong>
                Only a <span className="font-mono">128-number</span> mathematical descriptor is stored — <strong>no photos</strong>. All processing runs in your browser using SsdMobilenetv1 + 30-sample weighted averaging.
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* LEFT: Camera */}
              <div className="lg:col-span-7 rounded-2xl p-5 space-y-4" style={{ background: '#0C1222', border: '1px solid #1A2535' }}>
                {/* Video area */}
                <div className="relative rounded-xl overflow-hidden ev-scanline-loop" style={{ aspectRatio: '4/3', background: '#050810' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover -scale-x-100 ${status === 'capturing' ? 'block' : 'hidden'}`}
                  />

                  {/* Viewfinder brackets — tighten on face detection */}
                  {status === 'capturing' && (
                    <div className="absolute inset-[10px] pointer-events-none transition-all duration-300"
                      style={{ opacity: faceDetected ? 1 : 0.5 }}>
                      {/* TL */}
                      <div className="absolute top-0 left-0 transition-all duration-300"
                        style={{ width: faceDetected ? 10 : 18, height: faceDetected ? 10 : 18, borderTop: `2px solid ${faceDetected ? '#1CDEC8' : 'rgba(28,222,200,0.5)'}`, borderLeft: `2px solid ${faceDetected ? '#1CDEC8' : 'rgba(28,222,200,0.5)'}` }} />
                      {/* TR */}
                      <div className="absolute top-0 right-0 transition-all duration-300"
                        style={{ width: faceDetected ? 10 : 18, height: faceDetected ? 10 : 18, borderTop: `2px solid ${faceDetected ? '#1CDEC8' : 'rgba(28,222,200,0.5)'}`, borderRight: `2px solid ${faceDetected ? '#1CDEC8' : 'rgba(28,222,200,0.5)'}` }} />
                      {/* BL */}
                      <div className="absolute bottom-0 left-0 transition-all duration-300"
                        style={{ width: faceDetected ? 10 : 18, height: faceDetected ? 10 : 18, borderBottom: `2px solid ${faceDetected ? '#1CDEC8' : 'rgba(28,222,200,0.5)'}`, borderLeft: `2px solid ${faceDetected ? '#1CDEC8' : 'rgba(28,222,200,0.5)'}` }} />
                      {/* BR */}
                      <div className="absolute bottom-0 right-0 transition-all duration-300"
                        style={{ width: faceDetected ? 10 : 18, height: faceDetected ? 10 : 18, borderBottom: `2px solid ${faceDetected ? '#1CDEC8' : 'rgba(28,222,200,0.5)'}`, borderRight: `2px solid ${faceDetected ? '#1CDEC8' : 'rgba(28,222,200,0.5)'}` }} />
                    </div>
                  )}

                  {/* Pose hint */}
                  {status === 'capturing' && faceDetected && (
                    <div className="absolute top-3 left-3 right-3 font-mono text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-2"
                      style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--ev-indigo)', border: '1px solid rgba(28,222,200,0.3)' }}>
                      <Move className="w-3.5 h-3.5 shrink-0" />
                      {poseHint}
                    </div>
                  )}

                  {/* SVG Circular Progress Ring — Face ID style */}
                  {status === 'capturing' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <svg width="75%" height="75%" viewBox="0 0 200 200" className="-rotate-90">
                        {/* Track */}
                        <circle cx="100" cy="100" r="88" fill="none" strokeWidth="3"
                          stroke="rgba(255,255,255,0.08)" />
                        {/* Progress */}
                        <circle cx="100" cy="100" r="88" fill="none" strokeWidth="4"
                          stroke="url(#ringGrad)"
                          strokeDasharray={2 * Math.PI * 88}
                          strokeDashoffset={2 * Math.PI * 88 * (1 - captureCount / TOTAL_SAMPLES)}
                          strokeLinecap="round"
                          style={{ filter: 'drop-shadow(0 0 6px rgba(28,222,200,0.5))', transition: 'stroke-dashoffset 0.15s ease-out' }} />
                        <defs>
                          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#1CDEC8" />
                            <stop offset="100%" stopColor="#5B52FF" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  )}

                  {/* Tick flash — brief glow on each capture */}
                  {status === 'capturing' && lastTickTime > 0 && (
                    <div className="absolute inset-0 pointer-events-none" style={{
                      background: 'radial-gradient(circle at center, rgba(28,222,200,0.15) 0%, transparent 60%)',
                      animation: 'tick-flash 0.3s ease-out forwards',
                    }} />
                  )}

                  {/* Lock-in animation overlay */}
                  {lockIn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: [0.5, 1.2, 1], opacity: [0, 1, 1] }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      >
                        <Lock className="w-16 h-16" style={{ color: 'var(--ev-indigo)', filter: 'drop-shadow(0 0 12px rgba(28,222,200,0.6))' }} />
                      </motion.div>
                    </div>
                  )}

                  {/* Idle/status overlay */}
                  {status !== 'capturing' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                      {status === 'loading-models' && <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(79,70,229,0.15)', borderTopColor: '#1CDEC8' }} />}
                      {status === 'processing'     && <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(79,70,229,0.15)', borderTopColor: '#5B52FF' }} />}
                      {status === 'success'        && <CheckCircle2 className="w-14 h-14" style={{ color: 'var(--ev-indigo)' }} />}
                      {status === 'error'          && <AlertCircle  className="w-14 h-14" style={{ color: 'var(--ev-rose)' }} />}
                      {status === 'ready'          && <Camera       className="w-14 h-14" style={{ color: 'rgba(28,222,200,0.4)' }} />}
                      <p className="text-sm text-center px-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{message}</p>
                    </div>
                  )}
                </div>

                {/* Capture progress — large mono counter */}
                {status === 'capturing' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] text-slate-400">{message}</span>
                      <span className="font-mono text-2xl font-bold tabular-nums" style={{ color: 'var(--ev-indigo)', letterSpacing: '-0.03em' }}>
                        {String(captureCount).padStart(2,'0')}<span className="text-sm opacity-40">/{TOTAL_SAMPLES}</span>
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: TOTAL_SAMPLES }).map((_, i) => (
                        <div key={i} className="flex-1 h-1.5 rounded-full transition-colors"
                          style={{ background: i < captureCount ? '#1CDEC8' : 'rgba(255,255,255,0.08)' }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  {status === 'ready' && (
                    <motion.button onClick={startCamera} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="flex-1 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
                      style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', boxShadow: '0 6px 20px rgba(28,222,200,0.3)' }}>
                      <Scan className="w-4 h-4" /> Start Registration
                    </motion.button>
                  )}
                  {(status === 'success' || status === 'error') && (
                    <motion.button onClick={reset} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm">
                      <RefreshCw className="w-4 h-4" /> Register Again
                    </motion.button>
                  )}
                  {status === 'capturing' && (
                    <motion.button onClick={reset} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm">
                      Cancel
                    </motion.button>
                  )}
                </div>

                {/* Mute toggle — respects quiet demo rooms */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setMuted(m => !m)}
                    className="flex items-center gap-1.5 font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                    style={{
                      background: muted ? 'rgba(255,255,255,0.06)' : 'rgba(28,222,200,0.1)',
                      color: muted ? '#64748B' : '#1CDEC8',
                      border: `1px solid ${muted ? 'rgba(255,255,255,0.08)' : 'rgba(28,222,200,0.25)'}`,
                    }}
                  >
                    {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    {muted ? 'SOUND OFF' : 'SOUND ON'}
                  </button>
                </div>
              </div>

              {/* RIGHT: Instructions */}
              <div className="lg:col-span-5 space-y-4">

                {/* Status card */}
                <div className="study-card p-5 space-y-3">
                  <p className="text-sm font-bold text-slate-800">Registration Status</p>
                  <div className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                    status === 'success'   ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : status === 'error'  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                    : status === 'capturing' ? 'bg-indigo-50 border border-indigo-200 text-indigo-800'
                    : 'bg-slate-50 border border-slate-200 text-slate-700'
                  }`}>
                    {status === 'success'    && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                    {status === 'error'      && <AlertCircle  className="w-4 h-4 shrink-0 mt-0.5" />}
                    {status === 'capturing'  && <Camera       className="w-4 h-4 shrink-0 mt-0.5" />}
                    <span className="leading-relaxed">{message || 'Initializing…'}</span>
                  </div>
                  {status === 'capturing' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Samples captured</span>
                        <span className="font-mono font-bold text-indigo-600">{captureCount}/{TOTAL_SAMPLES}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Tips */}
                <div className="study-card p-5 space-y-3">
                  <p className="text-sm font-bold text-slate-700">Tips for Best Accuracy</p>
                  <div className="space-y-3">
                    {[
                      { icon: Sun,          tip: 'Good front lighting — avoid backlight or harsh shadows' },
                      { icon: Move,         tip: 'Slightly vary your head angle during capture for better coverage' },
                      { icon: Camera,       tip: 'Keep face 40–60 cm from camera, centered in the frame' },
                      { icon: CheckCircle2, tip: 'Remove glasses if possible for first registration' },
                    ].map(({ icon: Icon, tip }, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs text-slate-600">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <span className="leading-relaxed">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* How it works */}
                <div className="rounded-2xl p-5 space-y-3" style={{ background: '#0C1222', border: '1px solid #1A2535' }}>
                  <p className="font-display text-sm font-bold text-white">How Registration Works</p>
                  <ol className="space-y-3">
                    {[
                      'Camera captures 30 face samples at different angles.',
                      'Outlier samples are filtered for quality.',
                      'A weighted average descriptor is computed.',
                      'Only the 128-number vector is saved — no photos stored.',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="font-mono w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold"
                          style={{ background: 'rgba(28,222,200,0.1)', color: 'var(--ev-indigo)', border: '1px solid rgba(28,222,200,0.25)' }}>
                          {i + 1}
                        </span>
                        <span className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
