'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, ArrowLeft, GraduationCap, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      setSent(true);
    } catch {
      setSent(true); // Show success anyway to prevent email enumeration
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--ev-bg)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
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
          {!sent ? (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)' }}>
                  <Mail className="w-7 h-7" style={{ color: 'var(--ev-indigo)' }} />
                </div>
                <h1 className="text-xl font-bold text-slate-900 mb-1">Forgot Password?</h1>
                <p className="text-sm text-slate-500">Enter your registered email address and we&apos;ll help you reset your password.</p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3" style={{ width: 18, height: 18, color: '#94A3B8' }} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@college.edu"
                      className="w-full bg-white border-2 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none transition-all border-slate-200 focus:border-[#1CDEC8]"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading || !email.trim()}
                  className="w-full font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2.5 disabled:opacity-50 text-sm transition-all"
                  style={{ background: 'linear-gradient(135deg, #1CDEC8 0%, #5B52FF 100%)', color: '#fff', boxShadow: '0 6px 20px rgba(28,222,200,0.3)' }}>
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Send Reset Link <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--ev-emerald)' }} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Check your email</h2>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                If an account exists for <strong className="text-slate-700">{email}</strong>, a password reset link has been sent.
              </p>
              <p className="text-xs text-slate-400 mb-6">The link expires in 15 minutes. Check your spam folder if you don&apos;t see it.</p>
              <button onClick={() => { setSent(false); setEmail(''); }}
                className="text-sm font-semibold hover:underline" style={{ color: 'var(--ev-indigo)' }}>
                ← Try another email
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700 font-medium inline-flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
