'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft, GraduationCap, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }
    fetch(`/api/auth/reset-password?token=${token}`)
      .then(r => r.json())
      .then(d => setTokenValid(d.valid))
      .catch(() => setTokenValid(false));
  }, [token]);

  const passwordChecks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
  ];

  const allMet = passwordChecks.every(c => c.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet) {
      setError('Please meet all password requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(data.error || 'Failed to reset password.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Token validation loading
  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ev-bg)' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--ev-indigo)' }} />
          <p className="text-sm text-slate-500">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // Token invalid
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--ev-bg)' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(225,29,72,0.06)', border: '1px solid rgba(255,77,94,0.2)' }}>
              <AlertCircle className="w-7 h-7" style={{ color: 'var(--ev-rose)' }} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Link Expired</h1>
            <p className="text-sm text-slate-500 mb-6">This password reset link is invalid or has expired. Please request a new one.</p>
            <Link href="/forgot-password"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', color: '#fff' }}>
              Request a New Reset Link <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="mt-4">
            <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700 font-medium inline-flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--ev-bg)' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(28,222,200,0.12)', border: '1px solid rgba(28,222,200,0.3)' }}>
              <GraduationCap strokeWidth={1.5} className="w-5 h-5" style={{ color: 'var(--ev-indigo)' }} />
            </div>
            <span className="font-display text-xl font-bold text-slate-900">EduVision</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {!success ? (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)' }}>
                  <ShieldCheck className="w-7 h-7" style={{ color: 'var(--ev-indigo)' }} />
                </div>
                <h1 className="text-xl font-bold text-slate-900 mb-1">Set New Password</h1>
                <p className="text-sm text-slate-500">Choose a strong password for your account.</p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3" style={{ width: 18, height: 18, color: '#94A3B8' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border-2 rounded-2xl pl-11 pr-11 py-3 text-sm outline-none transition-all border-slate-200 focus:border-[#1CDEC8]"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password strength checks */}
                {password.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {passwordChecks.map((check, i) => (
                      <div key={i} className={`flex items-center gap-1.5 text-[11px] ${check.met ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <CheckCircle2 className={`w-3 h-3 ${check.met ? 'opacity-100' : 'opacity-30'}`} />
                        {check.label}
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3" style={{ width: 18, height: 18, color: '#94A3B8' }} />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border-2 rounded-2xl pl-11 pr-11 py-3 text-sm outline-none transition-all border-slate-200 focus:border-[#1CDEC8]"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition-colors">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[11px] text-rose-500 mt-1">Passwords do not match</p>
                  )}
                </div>

                <button type="submit" disabled={loading || !allMet || password !== confirmPassword}
                  className="w-full font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2.5 disabled:opacity-50 text-sm transition-all"
                  style={{ background: 'linear-gradient(135deg, #1CDEC8 0%, #5B52FF 100%)', color: '#fff', boxShadow: '0 6px 20px rgba(28,222,200,0.3)' }}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Reset Password <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--ev-emerald)' }} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Password Reset Successfully</h2>
              <p className="text-sm text-slate-500 mb-2">You can now log in with your new password.</p>
              <p className="text-xs text-slate-400">Redirecting to login...</p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700 font-medium inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ev-bg)' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--ev-indigo)' }} />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordInner />
    </Suspense>
  );
}
