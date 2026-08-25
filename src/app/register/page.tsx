'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Users, ShieldCheck, User, Mail, Lock,
  Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle,
  BookOpen, KeyRound, RefreshCw, Send, Building2,
  BadgeCheck, Clock,
} from 'lucide-react';

function Orb({ className }: { className: string }) {
  return <div className={`absolute rounded-full blur-3xl pointer-events-none ${className}`} />;
}

const ROLES = [
  { id: 'student',  label: 'Student',       icon: GraduationCap, color: 'text-indigo-400',  border: 'border-indigo-500/40',  bg: 'bg-indigo-500/10',  desc: 'Quizzes, streaks & AI study plan',    placeholder: 'CSE-A',              classLabel: 'Section / Batch'   },
  { id: 'faculty',  label: 'Faculty',        icon: Users,         color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', desc: 'Attendance, analytics & assessments', placeholder: 'Digital Electronics', classLabel: 'Teaching Subject'  },
  { id: 'admin',    label: 'Administrator',  icon: ShieldCheck,   color: 'text-amber-400',   border: 'border-amber-500/40',   bg: 'bg-amber-500/10',   desc: 'Campus-wide control tower',           placeholder: 'Administration',     classLabel: 'Department'        },
];

type Step = 'details' | 'otp' | 'done';

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('details');

  // Form fields
  const [role, setRole]                     = useState('student');
  const [name, setName]                     = useState('');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [classOrSubject, setClassOrSubject] = useState('CSE-A');
  const [rollNumber, setRollNumber]         = useState('');
  const [yearOfStudy, setYearOfStudy]       = useState('1');
  const [facultyId, setFacultyId]           = useState('');
  const [collegeName, setCollegeName]       = useState('');
  const [showPw, setShowPw]                 = useState(false);
  const [showCpw, setShowCpw]               = useState(false);

  // OTP
  const [otpDigits, setOtpDigits]         = useState(['', '', '', '', '', '']);
  const otpRef0 = useRef<HTMLInputElement>(null);
  const otpRef1 = useRef<HTMLInputElement>(null);
  const otpRef2 = useRef<HTMLInputElement>(null);
  const otpRef3 = useRef<HTMLInputElement>(null);
  const otpRef4 = useRef<HTMLInputElement>(null);
  const otpRef5 = useRef<HTMLInputElement>(null);
  const otpRefs = [otpRef0, otpRef1, otpRef2, otpRef3, otpRef4, otpRef5];
  const [resendCooldown, setResendCooldown] = useState(0);

  // UI state
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [otpPreview, setOtpPreview]       = useState('');

  const currentRole = ROLES.find(r => r.id === role)!;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const passwordStrength = (() => {
    if (!password) return { label: '', color: 'bg-slate-200', w: '0%' };
    if (password.length < 6)  return { label: 'Weak',   color: 'bg-rose-500',    w: '25%' };
    if (password.length < 10) return { label: 'Fair',   color: 'bg-amber-500',   w: '55%' };
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return { label: 'Strong', color: 'bg-emerald-500', w: '100%' };
    return { label: 'Good', color: 'bg-indigo-500', w: '75%' };
  })();

  // Step 1 → send OTP
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!collegeName.trim())                { setError('College name is required.'); return; }
    if (!name.trim())                       { setError('Full name is required.'); return; }
    if (password.length < 6)                { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword)       { setError('Passwords do not match.'); return; }
    if (role === 'student') {
      if (!rollNumber.trim())               { setError('Roll number is required.'); return; }
      if (rollNumber.trim().length > 30)    { setError('Roll number is too long.'); return; }
      const yr = parseInt(yearOfStudy);
      if (yr < 1 || yr > 4)                 { setError('Please select your year of study.'); return; }
    }
    if (role === 'faculty') {
      if (!facultyId.trim())                { setError('Faculty ID is required.'); return; }
    }

    setLoading(true);
    try {
      const res  = await fetch('/api/otp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), purpose: 'register' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send OTP.'); return; }
      if (data.preview) setOtpPreview(data.preview);
      setStep('otp');
      setResendCooldown(60);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next  = [...otpDigits];
    next[i]     = digit;
    setOtpDigits(next);
    if (error) setError(''); // Clear stale errors when user types
    if (digit && i < 5) otpRefs[i + 1].current?.focus();
  };
  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) otpRefs[i - 1].current?.focus();
  };
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length === 6) {
      setOtpDigits(digits);
      otpRefs[5].current?.focus();
    }
  };

  // Step 2 → verify OTP + create account
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const otp = otpDigits.join('');
    if (otp.length < 6) { setError('Please enter the complete 6-digit code.'); return; }

    setLoading(true);
    try {
      const res  = await fetch('/api/otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(), otp, purpose: 'register',
          name: name.trim(), password, role, classOrSubject,
          rollNumber: rollNumber.trim(), yearOfStudy: parseInt(yearOfStudy) || 1,
          facultyId: facultyId.trim(), collegeName: collegeName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Verification failed.'); return; }
      setStep('done');
      setTimeout(() => router.push('/login'), 4000);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(''); setOtpDigits(['','','','','','']);
    setLoading(true);
    try {
      const res  = await fetch('/api/otp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), purpose: 'register' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to resend.'); return; }
      if (data.preview) setOtpPreview(data.preview);
      setResendCooldown(60);
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  // ── Done screen — 3-step registration status ─────────────────────────────
  if (step === 'done') return (
    <div className="min-h-screen school-bg flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 border-2 border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Registration Submitted</h2>
            <p className="text-sm text-slate-500 mt-1">Your email has been verified successfully.</p>
          </div>

          {/* 3-step status timeline */}
          <div className="space-y-0">
            {/* Step 1: Registration Submitted — DONE */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="w-0.5 flex-1 bg-emerald-300 my-1" />
              </div>
              <div className="pb-4">
                <p className="text-sm font-bold text-emerald-700">Registration Submitted ✓</p>
                <p className="text-xs text-slate-500 mt-0.5">Your details have been received</p>
              </div>
            </div>

            {/* Step 2: Email Verified — DONE */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="w-0.5 flex-1 bg-amber-300 my-1" />
              </div>
              <div className="pb-4">
                <p className="text-sm font-bold text-emerald-700">Email Verified ✓</p>
                <p className="text-xs text-slate-500 mt-0.5">OTP verification completed</p>
              </div>
            </div>

            {/* Step 3: Admin Approval — PENDING */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center shrink-0 animate-pulse">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-amber-700">Admin Approval Pending ⏳</p>
                <p className="text-xs text-slate-500 mt-0.5">Waiting for administrator review</p>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-700">What happens next?</p>
            <ul className="list-disc list-inside space-y-1 text-slate-500">
              <li>Your administrator will review your registration</li>
              <li>You'll receive an email once your account is approved</li>
              <li>You can then sign in with your email and password</li>
            </ul>
          </div>

          {/* CTA */}
          <Link href="/login" className="mt-6 block w-full text-center py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
            Go to Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen school-bg flex items-center justify-center p-4 py-12 relative overflow-hidden">
      <Orb className="w-[500px] h-[500px] bg-indigo-600/20 top-[-150px] left-[-150px]" />
      <Orb className="w-[400px] h-[400px] bg-purple-500/15 bottom-[-100px] right-[-100px]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-lg z-10"
      >
        {/* Logo */}
        <div className="text-center mb-7">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-3 group">
            <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
              <GraduationCap className="w-5 h-5" />
            </motion.div>
            <span className="text-2xl font-bold tracking-tight text-white">EduVision</span>
          </Link>
          <h1 className="text-lg font-bold text-white">
            {step === 'details' ? 'Create Your Account' : 'Verify Your Email'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {step === 'details' ? 'Join the SIH 2026 Academic Platform' : `Code sent to ${email}`}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-7 sm:p-10">

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {['Details', 'Verify OTP'].map((label, i) => {
              const done    = (i === 0 && ((step as Step) === 'otp' || (step as Step) === 'done'));
              const current = (i === 0 && step === 'details') || (i === 1 && step === 'otp');
              return (
                <React.Fragment key={label}>
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${current ? 'text-indigo-600' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${current ? 'bg-indigo-600 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {done ? '✓' : i + 1}
                    </div>
                    {label}
                  </div>
                  {i < 1 && <div className={`flex-1 h-0.5 rounded-full ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div key="err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dev OTP preview */}
          {otpPreview && step === 'otp' && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <p className="font-semibold mb-1">🔧 Dev mode — no email configured</p>
              <p className="font-mono text-base tracking-widest font-bold text-amber-900">{otpPreview.replace('OTP logged to console: ', '')}</p>
              <p className="text-[10px] mt-1 text-amber-600">Copy this code into the boxes above</p>
            </div>
          )}

          {/* ── STEP 1: Details ── */}
          {step === 'details' && (
            <form onSubmit={handleSendOTP} className="space-y-5">

              {/* College Name — FIRST field, always required */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">College / Institution Name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input type="text" required value={collegeName} onChange={e => setCollegeName(e.target.value)}
                    placeholder="e.g. Vasireddy Venkatadri Institute of Technology"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-10 py-3 text-sm outline-none" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Your college will be auto-detected. Variations like "VVIT" match the same institution.</p>
              </div>

              {/* Role selector */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2 block">I am a…</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map(r => {
                    const Icon   = r.icon;
                    const active = role === r.id;
                    return (
                      <motion.button key={r.id} type="button" onClick={() => { setRole(r.id); setClassOrSubject(r.placeholder); }}
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        className={`p-3 rounded-xl border text-left transition-all ${active ? `${r.bg} ${r.border}` : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                        <Icon className={`w-4 h-4 mb-1.5 ${active ? r.color : 'text-slate-400'}`} />
                        <span className={`text-xs font-bold block ${active ? 'text-slate-900' : 'text-slate-600'}`}>{r.label}</span>
                        <span className="text-[10px] text-slate-500 leading-tight block">{r.desc}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Aarav Sharma"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-10 py-3 text-sm outline-none" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Personal Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-10 py-3 text-sm outline-none" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Personal emails are accepted. Your college identity is verified separately.</p>
              </div>

              {/* Class/Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">{currentRole.classLabel}</label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input type="text" required value={classOrSubject} onChange={e => setClassOrSubject(e.target.value)} placeholder={currentRole.placeholder}
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-10 py-3 text-sm outline-none" />
                </div>
              </div>

              {/* Roll Number + Year — Student only */}
              {role === 'student' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">Roll Number</label>
                    <input type="text" required value={rollNumber} onChange={e => setRollNumber(e.target.value)}
                      placeholder="e.g. 21CSE001"
                      className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">Year of Study</label>
                    <select required value={yearOfStudy} onChange={e => setYearOfStudy(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm outline-none">
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Faculty ID — Faculty only */}
              {role === 'faculty' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">Faculty ID / Employee ID</label>
                  <input type="text" required value={facultyId} onChange={e => setFacultyId(e.target.value)}
                    placeholder="e.g. FAC-2024-001"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-sm outline-none" />
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters"
                    className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-10 py-3 text-sm outline-none pr-10" />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div animate={{ width: passwordStrength.w }} className={`h-full rounded-full ${passwordStrength.color}`} />
                    </div>
                    <p className="text-[10px] text-slate-500">Strength: <strong>{passwordStrength.label}</strong></p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input type={showCpw ? 'text' : 'password'} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password"
                    className={`w-full bg-white border focus:ring-2 rounded-xl px-10 py-3 text-sm outline-none pr-10 ${confirmPassword && confirmPassword !== password ? 'border-rose-400 focus:ring-rose-400/20' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'}`} />
                  <button type="button" onClick={() => setShowCpw(v => !v)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">
                    {showCpw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {confirmPassword && confirmPassword === password && <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-9 top-3.5" />}
                </div>
              </div>

              <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-indigo-200">
                {loading
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Send className="w-4 h-4" /><span>Send Verification Code</span></>
                }
              </motion.button>
            </form>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mx-auto">
                  <KeyRound className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="text-sm font-semibold text-slate-800">Enter the 6-digit code</p>
                <p className="text-xs text-slate-500">Sent to <strong className="text-slate-700">{email}</strong></p>
              </div>

              <div className="flex items-center justify-center gap-2" onPaste={handleOtpPaste}>
                {otpDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={otpRefs[i]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className={`w-11 h-12 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all ${d ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-900'} focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20`}
                  />
                ))}
              </div>

              <motion.button type="submit" disabled={loading || otpDigits.join('').length < 6} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-indigo-200">
                {loading
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><CheckCircle2 className="w-4 h-4" /><span>Verify & Submit Registration</span></>
                }
              </motion.button>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <button type="button" onClick={() => { setStep('details'); setError(''); setOtpDigits(['','','','','','']); }}
                  className="hover:text-indigo-600 transition-colors">
                  ← Change details
                </button>
                <button type="button" onClick={handleResend} disabled={resendCooldown > 0 || loading}
                  className="flex items-center gap-1 hover:text-indigo-600 disabled:opacity-50 transition-colors">
                  <RefreshCw className="w-3 h-3" />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-600 font-semibold hover:text-indigo-700">Sign In here</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
