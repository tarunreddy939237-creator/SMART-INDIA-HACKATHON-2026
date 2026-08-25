'use client';

import React, { useState, useRef, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, GraduationCap, Users, Lock, Mail,
  ArrowRight, AlertCircle, Zap,
  KeyRound, RefreshCw, CheckCircle2,
  BarChart3, Brain, Camera, Clock,
} from 'lucide-react';

const quickRoles = [
  {
    id: 'student', label: 'Student Portal', email: 'student@eduvision.ai',
    icon: GraduationCap, redirect: '/student/dashboard',
    desc: 'Streaks, quizzes & AI tutor',
    color: '#4F46E5', bg: 'rgba(79,70,229,0.04)', border: 'rgba(79,70,229,0.15)',
    activeBg: 'rgba(79,70,229,0.06)', activeBorder: '#4F46E5',
  },
  {
    id: 'faculty', label: 'Faculty Console', email: 'faculty@eduvision.ai',
    icon: Users, redirect: '/faculty/attendance',
    desc: 'Attendance & class analytics',
    color: '#0D9488', bg: 'rgba(13,148,136,0.04)', border: 'rgba(13,148,136,0.15)',
    activeBg: 'rgba(13,148,136,0.06)', activeBorder: '#0D9488',
  },
  {
    id: 'admin', label: 'Control Tower', email: 'admin@eduvision.ai',
    icon: ShieldCheck, redirect: '/admin/control-tower',
    desc: 'Campus-wide analytics',
    color: '#D97706', bg: 'rgba(217,119,6,0.04)', border: 'rgba(217,119,6,0.15)',
    activeBg: 'rgba(217,119,6,0.06)', activeBorder: '#D97706',
  },
];

const ROLE_REDIRECTS: Record<string, string> = {
  student: '/student/dashboard',
  faculty: '/faculty/attendance',
  admin: '/admin/control-tower',
};

const features = [
  { icon: Camera, label: 'Face Recognition Attendance', desc: 'Browser-side biometric verification' },
  { icon: Brain, label: 'AI Study Copilot', desc: 'Personalized study plans & adaptive learning' },
  { icon: BarChart3, label: 'Live Academic Analytics', desc: 'Campus-wide risk detection at a glance' },
  { icon: Zap, label: 'Smart Assessment Engine', desc: 'Adaptive quizzes & progress tracking' },
];

type LoginTab = 'password' | 'otp';
type OtpStep = 'email' | 'code';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<LoginTab>('password');
  const [email, setEmail] = useState('student@eduvision.ai');
  const [password, setPassword] = useState('password123');
  const [selectedRole, setSelectedRole] = useState<'student' | 'faculty' | 'admin'>('student');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');

  const [otpEmail, setOtpEmail] = useState('');
  const [otpStep, setOtpStep] = useState<OtpStep>('email');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpRef0 = useRef<HTMLInputElement>(null);
  const otpRef1 = useRef<HTMLInputElement>(null);
  const otpRef2 = useRef<HTMLInputElement>(null);
  const otpRef3 = useRef<HTMLInputElement>(null);
  const otpRef4 = useRef<HTMLInputElement>(null);
  const otpRef5 = useRef<HTMLInputElement>(null);
  const otpRefs = [otpRef0, otpRef1, otpRef2, otpRef3, otpRef4, otpRef5];
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpPreview, setOtpPreview] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleRoleSelect = (role: 'student' | 'faculty' | 'admin') => {
    setSelectedRole(role);
    const found = quickRoles.find(r => r.id === role);
    if (found) { setEmail(found.email); setPassword('password123'); setPwError(''); }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwLoading(true); setPwError('');
    try {
      const res = await signIn('credentials', { redirect: false, email, password });
      if (res?.error) {
        const msg = res.error;
        if (msg.includes('pending') || msg.includes('approval')) {
          setPwError('⏳ Your account is waiting for administrator approval. You will receive an email once your account is approved.');
        } else if (msg.includes('rejected')) {
          setPwError('❌ Your registration request was not approved. Please contact the administrator for further assistance.');
        } else if (msg.includes('suspended')) {
          setPwError('🚫 Your account has been suspended. Please contact support.');
        } else if (msg.includes('deactivated')) {
          setPwError('🚫 Your account has been deactivated. Please contact support.');
        } else if (msg.includes('not found')) {
          setPwError('No account found with this email. Please register first.');
        } else {
          setPwError('Invalid credentials. Please try again.');
        }
        return;
      }
      let actualRole = 'student';
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 300));
        const s = await fetch('/api/auth/session').then(r => r.json()).catch(() => null);
        if (s?.user?.role) { actualRole = s.user.role; break; }
      }
      router.push(ROLE_REDIRECTS[actualRole] || '/student/dashboard');
      router.refresh();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('pending') || msg.includes('approval')) {
        setPwError('⏳ Your account is waiting for administrator approval.');
      } else if (msg.includes('rejected')) {
        setPwError('❌ Your registration request was not approved.');
      } else {
        setPwError('An unexpected error occurred. Please try again.');
      }
    } finally { setPwLoading(false); }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(''); setOtpLoading(true);
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail.trim(), purpose: 'login' }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpError(data.error || 'Failed to send OTP.'); return; }
      if (data.preview) setOtpPreview(data.preview);
      setOtpStep('code'); setResendCooldown(60);
    } catch { setOtpError('Network error.'); }
    finally { setOtpLoading(false); }
  };

  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits]; next[i] = digit; setOtpDigits(next);
    if (digit && i < 5) otpRefs[i + 1].current?.focus();
  };
  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) otpRefs[i - 1].current?.focus();
  };
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length === 6) { setOtpDigits(digits); otpRefs[5].current?.focus(); }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length < 6) { setOtpError('Enter the complete 6-digit code.'); return; }
    setOtpLoading(true); setOtpError('');
    try {
      const vRes = await fetch('/api/otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail.trim(), otp, purpose: 'login' }),
      });
      const vData = await vRes.json();
      if (!vRes.ok) {
        const msg = vData.error || 'Verification failed.';
        if (msg.includes('pending') || msg.includes('approval')) {
          setOtpError('⏳ Your account is waiting for administrator approval.');
        } else if (msg.includes('rejected')) {
          setOtpError('❌ Your registration request was not approved.');
        } else {
          setOtpError(msg);
        }
        return;
      }
      await signIn('credentials', { redirect: false, email: otpEmail.trim(), password: 'OTP_VERIFIED_' + otp });
      const userRole = vData.user?.role || 'student';
      router.push(ROLE_REDIRECTS[userRole] || '/student/dashboard');
      router.refresh();
    } catch { setOtpError('Network error.'); }
    finally { setOtpLoading(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setOtpError(''); setOtpDigits(['', '', '', '', '', '']); setOtpLoading(true);
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail.trim(), purpose: 'login' }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpError(data.error || 'Failed to resend.'); return; }
      if (data.preview) setOtpPreview(data.preview);
      setResendCooldown(60);
    } catch { setOtpError('Network error.'); }
    finally { setOtpLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--ev-bg)' }}>
      {/* ══════════════════════════════════
          LEFT PANEL — Brand + Features
          ══════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-10 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0C1222 0%, #0F172A 60%, #1A1F3A 100%)' }}
      >
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(79,70,229,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(79,70,229,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 70% 50% at 30% 60%, rgba(79,70,229,0.06) 0%, transparent 60%)',
        }} />

        {/* Top logo */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.2)' }}>
              <GraduationCap strokeWidth={1.5} className="w-5 h-5" style={{ color: '#818CF8' }} />
            </div>
            <div>
              <span className="text-[18px] font-bold text-white tracking-tight block" style={{ fontFamily: 'var(--font-display)' }}>EduVision</span>
              <span className="font-mono text-[10px]" style={{ color: 'rgba(129,140,248,0.5)' }}>Academic OS · v2.4</span>
            </div>
          </Link>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center gap-8">
          {/* Abstract learning visual */}
          <div className="relative w-48 h-48">
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <circle cx="100" cy="100" r="80" stroke="rgba(79,70,229,0.15)" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx="100" cy="100" r="55" stroke="rgba(13,148,136,0.15)" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx="100" cy="100" r="30" stroke="rgba(79,70,229,0.2)" strokeWidth="1" />
              <circle cx="100" cy="100" r="6" fill="rgba(79,70,229,0.3)" />
              <circle cx="100" cy="100" r="3" fill="#818CF8" />
              <circle cx="180" cy="100" r="4" fill="rgba(13,148,136,0.4)" />
              <circle cx="100" cy="45" r="3" fill="rgba(79,70,229,0.4)" />
              <circle cx="45" cy="130" r="3" fill="rgba(217,119,6,0.4)" />
              <line x1="103" y1="100" x2="176" y2="100" stroke="rgba(13,148,136,0.1)" strokeWidth="0.5" />
              <line x1="100" y1="97" x2="100" y2="48" stroke="rgba(79,70,229,0.1)" strokeWidth="0.5" />
              <line x1="97" y1="103" x2="48" y2="128" stroke="rgba(217,119,6,0.1)" strokeWidth="0.5" />
            </svg>
          </div>

          <div className="text-center space-y-3 max-w-sm">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg font-mono text-[10px] font-bold"
              style={{ background: 'rgba(79,70,229,0.08)', color: '#818CF8', border: '1px solid rgba(79,70,229,0.15)' }}>
              <span className="w-1.5 h-1.5 rounded-full live-indicator" style={{ background: '#0D9488' }} />
              SMART INDIA HACKATHON 2026
            </div>
            <h2 className="text-[24px] font-bold text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Intelligent Academic<br />Platform
            </h2>
            <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Purpose-built for student outcomes — not a CRUD panel with AI bolted on.
            </p>
          </div>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-2">
          {features.map(({ icon: Icon, label, desc }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ borderLeft: '2px solid rgba(79,70,229,0.3)', background: 'rgba(79,70,229,0.03)' }}
            >
              <Icon strokeWidth={1.5} className="shrink-0" style={{ width: 16, height: 16, color: '#818CF8' }} />
              <div>
                <p className="text-[13px] font-semibold text-white leading-tight">{label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</p>
              </div>
            </motion.div>
          ))}

          <div className="flex items-center gap-2 pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[10px]"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="w-1.5 h-1.5 rounded-full live-indicator" style={{ background: '#059669' }} />
              18 sections · 480+ students
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
          RIGHT PANEL — Auth form
          ══════════════════════════════════ */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-16 overflow-y-auto" style={{ background: 'var(--ev-bg)' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-lg">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--ev-indigo-soft)', border: '1px solid rgba(79,70,229,0.15)' }}>
                <GraduationCap strokeWidth={1.5} className="w-4.5 h-4.5" style={{ color: 'var(--ev-indigo)', width: 18, height: 18 }} />
              </div>
              <span className="text-[20px] font-bold text-[var(--ev-text)]" style={{ fontFamily: 'var(--font-display)' }}>EduVision</span>
            </Link>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-[28px] font-bold text-[var(--ev-text)] mb-1" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              Welcome back
            </h1>
            <p className="text-[var(--ev-text-tertiary)] text-[14px]">Sign in to your institutional portal</p>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-2xl bg-[var(--ev-surface-subtle)] p-1.5 mb-7 gap-1.5">
            {(['password', 'otp'] as LoginTab[]).map(t => (
              <button key={t} type="button"
                onClick={() => { setTab(t); setPwError(''); setOtpError(''); }}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150"
                style={tab === t ? {
                  background: 'var(--ev-sidebar)',
                  color: 'var(--ev-cyan)',
                  boxShadow: '0 2px 8px rgba(13,148,136,0.2)',
                } : { color: 'var(--ev-text-muted)' }}>
                {t === 'password' ? '🔑  Password' : '📧  Email OTP'}
              </button>
            ))}
          </div>

          {/* ── PASSWORD TAB ── */}
          {tab === 'password' && (
            <motion.div key="pw" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {/* Role selector */}
              <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ev-text-muted)] mb-3 flex items-center gap-1.5">
                  <Zap strokeWidth={1.5} className="w-3.5 h-3.5" style={{ color: 'var(--ev-cyan)' }} />
                  Quick Demo Access
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {quickRoles.map(role => {
                    const Icon = role.icon;
                    const isActive = selectedRole === role.id;
                    return (
                      <motion.button key={role.id} type="button"
                        onClick={() => handleRoleSelect(role.id as any)}
                        whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
                        className="p-4 rounded-2xl text-left transition-all relative overflow-hidden"
                        style={isActive ? {
                          background: role.activeBg,
                          border: `1.5px solid ${role.activeBorder}`,
                          boxShadow: `0 4px 16px ${role.color}20`,
                        } : {
                          background: 'var(--ev-surface)',
                          border: '1.5px solid var(--ev-border)',
                        }}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
                          style={isActive
                            ? { background: `${role.color}18`, border: `1px solid ${role.color}40` }
                            : { background: 'var(--ev-surface-subtle)' }
                          }>
                          <Icon strokeWidth={1.5} style={{ width: 16, height: 16, color: isActive ? role.color : 'var(--ev-text-muted)' }} />
                        </div>
                        <span className="text-[13px] font-bold block leading-tight"
                          style={{ color: isActive ? role.color : 'var(--ev-text)' }}>
                          {role.label}
                        </span>
                        <span className="text-[11px] leading-tight block mt-1"
                          style={{ color: isActive ? `${role.color}99` : 'var(--ev-text-muted)' }}>
                          {role.desc}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <AnimatePresence>
                {pwError && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mb-5 p-4 rounded-2xl text-[13px] flex items-center gap-2.5"
                    style={{ background: 'rgba(255,77,94,0.06)', border: '1px solid rgba(255,77,94,0.3)', color: '#FF4D5E' }}>
                    <AlertCircle strokeWidth={1.5} className="w-4 h-4 shrink-0" /><span>{pwError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handlePasswordLogin} className="space-y-5">
                <div>
                  <label className="block text-[13px] font-semibold text-[var(--ev-text-secondary)] mb-2">Email Address</label>
                  <div className="relative">
                    <Mail strokeWidth={1.5} className="absolute left-4 top-3.5" style={{ width: 18, height: 18, color: 'var(--ev-text-muted)' }} />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full bg-white border-2 rounded-2xl pl-11 pr-4 py-3 text-[13px] outline-none transition-all duration-150"
                      style={{ borderColor: 'var(--ev-border)' }}
                      onFocus={e => (e.target.style.borderColor = 'var(--ev-cyan)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--ev-border)')}
                      placeholder="name@eduvision.ai" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[13px] font-semibold text-[var(--ev-text-secondary)]">Password</label>
                    <Link href="/forgot-password" className="text-[11px] font-semibold hover:underline" style={{ color: 'var(--ev-cyan)' }}>
                      Forgot Password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock strokeWidth={1.5} className="absolute left-4 top-3.5" style={{ width: 18, height: 18, color: 'var(--ev-text-muted)' }} />
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full bg-white border-2 rounded-2xl pl-11 pr-4 py-3 text-[13px] outline-none transition-all duration-150"
                      style={{ borderColor: 'var(--ev-border)' }}
                      onFocus={e => (e.target.style.borderColor = 'var(--ev-cyan)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--ev-border)')}
                      placeholder="••••••••••••" />
                  </div>
                </div>
                <motion.button type="submit" disabled={pwLoading}
                  whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
                  className="w-full font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2.5 disabled:opacity-50 text-[13px] transition-all"
                  style={{ background: 'linear-gradient(135deg, var(--ev-cyan) 0%, var(--ev-indigo) 100%)', color: '#fff', boxShadow: '0 6px 20px rgba(28,222,200,0.3)' }}>
                  {pwLoading
                    ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><span>Sign In to Portal</span><ArrowRight strokeWidth={1.5} className="w-4 h-4" /></>
                  }
                </motion.button>
              </form>

              <p className="mt-4 text-center text-[11px] text-[var(--ev-text-muted)]">
                Demo password: <code className="font-mono px-2 py-0.5 rounded-lg text-[var(--ev-text-secondary)]"
                  style={{ background: 'var(--ev-surface-subtle)' }}>password123</code>
              </p>
            </motion.div>
          )}

          {/* ── OTP TAB ── */}
          {tab === 'otp' && (
            <motion.div key="otp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AnimatePresence>
                {otpError && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mb-5 p-4 rounded-2xl text-[13px] flex items-center gap-2.5"
                    style={{ background: 'rgba(255,77,94,0.06)', border: '1px solid rgba(255,77,94,0.3)', color: '#FF4D5E' }}>
                    <AlertCircle strokeWidth={1.5} className="w-4 h-4 shrink-0" /><span>{otpError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {otpPreview && otpStep === 'code' && (
                <div className="mb-5 p-4 rounded-2xl text-[13px]"
                  style={{ background: 'rgba(255,170,0,0.06)', border: '1px solid rgba(255,170,0,0.3)', color: '#92400E' }}>
                  <p className="font-semibold mb-1">🔧 Dev mode — OTP code:</p>
                  <p className="font-mono text-[22px] tracking-[0.3em] font-bold" style={{ color: '#B45309' }}>
                    {otpPreview.replace('OTP logged to console: ', '')}
                  </p>
                </div>
              )}

              {otpStep === 'email' ? (
                <form onSubmit={handleSendOTP} className="space-y-5">
                  <div className="text-center py-4">
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: 'rgba(28,222,200,0.08)', border: '1px solid rgba(28,222,200,0.2)' }}>
                      <Mail strokeWidth={1.5} className="w-8 h-8" style={{ color: 'var(--ev-cyan)' }} />
                    </div>
                    <p className="text-[18px] font-bold text-[var(--ev-text)]">Sign in with OTP</p>
                    <p className="text-[13px] text-[var(--ev-text-tertiary)] mt-1">We'll send a 6-digit code to your registered email</p>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[var(--ev-text-secondary)] mb-2">Registered Email</label>
                    <div className="relative">
                      <Mail strokeWidth={1.5} className="absolute left-4 top-3.5" style={{ width: 18, height: 18, color: 'var(--ev-text-muted)' }} />
                      <input type="email" required value={otpEmail} onChange={e => setOtpEmail(e.target.value)}
                        className="w-full bg-white border-2 rounded-2xl pl-11 pr-4 py-3 text-[13px] outline-none transition-all duration-150"
                        style={{ borderColor: 'var(--ev-border)' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--ev-cyan)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--ev-border)')}
                        placeholder="you@college.edu" />
                    </div>
                  </div>
                  <motion.button type="submit" disabled={otpLoading}
                    whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
                    className="w-full font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2.5 disabled:opacity-50 text-[13px]"
                    style={{ background: 'linear-gradient(135deg, var(--ev-cyan) 0%, var(--ev-indigo) 100%)', color: '#fff', boxShadow: '0 6px 20px rgba(28,222,200,0.3)' }}>
                    {otpLoading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><KeyRound strokeWidth={1.5} className="w-4 h-4" /><span>Send Verification Code</span><ArrowRight strokeWidth={1.5} className="w-4 h-4" /></>
                    }
                  </motion.button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  <div className="text-center py-2">
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: 'rgba(28,222,200,0.08)', border: '1px solid rgba(28,222,200,0.2)' }}>
                      <KeyRound strokeWidth={1.5} className="w-8 h-8" style={{ color: 'var(--ev-cyan)' }} />
                    </div>
                    <p className="text-[18px] font-bold text-[var(--ev-text)]">Enter verification code</p>
                    <p className="text-[13px] text-[var(--ev-text-tertiary)] mt-1">Sent to <strong className="text-[var(--ev-text)]">{otpEmail}</strong></p>
                  </div>

                  <div className="flex items-center justify-center gap-3" onPaste={handleOtpPaste}>
                    {otpDigits.map((d, i) => (
                      <input key={i} ref={otpRefs[i]} type="text" inputMode="numeric" maxLength={1} value={d}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        className="w-12 h-14 text-center text-[22px] font-mono font-bold rounded-2xl border-2 outline-none transition-all duration-150"
                        style={{
                          borderColor: d ? 'var(--ev-cyan)' : 'var(--ev-border)',
                          background: d ? 'rgba(28,222,200,0.06)' : 'white',
                          color: d ? '#0E8F82' : 'var(--ev-text)',
                          boxShadow: d ? '0 0 0 3px rgba(28,222,200,0.12)' : 'none',
                        }}
                      />
                    ))}
                  </div>

                  <motion.button type="submit" disabled={otpLoading || otpDigits.join('').length < 6}
                    whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
                    className="w-full font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2.5 disabled:opacity-50 text-[13px]"
                    style={{ background: 'linear-gradient(135deg, var(--ev-cyan) 0%, var(--ev-indigo) 100%)', color: '#fff', boxShadow: '0 6px 20px rgba(28,222,200,0.3)' }}>
                    {otpLoading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><CheckCircle2 strokeWidth={1.5} className="w-4 h-4" /><span>Verify & Sign In</span></>
                    }
                  </motion.button>

                  <div className="flex items-center justify-between text-[13px] text-[var(--ev-text-tertiary)]">
                    <button type="button" onClick={() => { setOtpStep('email'); setOtpError(''); setOtpDigits(['', '', '', '', '', '']); }}
                      className="hover:text-[var(--ev-text-secondary)] transition-colors font-medium">← Change email</button>
                    <button type="button" onClick={handleResend} disabled={resendCooldown > 0 || otpLoading}
                      className="flex items-center gap-1.5 disabled:opacity-40 transition-colors font-medium"
                      style={{ color: resendCooldown > 0 ? 'var(--ev-text-muted)' : 'var(--ev-cyan)' }}>
                      <RefreshCw strokeWidth={1.5} className="w-3.5 h-3.5" />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[var(--ev-border)] flex items-center justify-between text-[13px]">
            <p className="text-[var(--ev-text-tertiary)]">
              No account?{' '}
              <Link href="/register" className="font-semibold hover:underline" style={{ color: 'var(--ev-cyan)' }}>Create one →</Link>
            </p>
            <Link href="/" className="text-[var(--ev-text-muted)] hover:text-[var(--ev-text-secondary)] transition-colors">← Home</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
