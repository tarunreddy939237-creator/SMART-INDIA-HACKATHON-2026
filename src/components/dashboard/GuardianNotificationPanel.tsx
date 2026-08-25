'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, BellOff, Phone, Mail, MessageSquare, Save,
  CheckCircle2, AlertTriangle, Clock, Shield,
} from 'lucide-react';

interface GuardianContact {
  name: string;
  phone: string;
  email: string;
  preferredChannel: 'whatsapp' | 'sms' | 'email';
}

interface AlertLogEntry {
  date: string;
  type: string;
  message: string;
  channel: string;
  status: string;
}

interface GuardianNotificationPanelProps {
  studentId: string;
  isFaculty?: boolean;
}

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: '#10B981' },
  { value: 'sms', label: 'SMS', icon: Phone, color: '#5B52FF' },
  { value: 'email', label: 'Email', icon: Mail, color: '#FFAA00' },
];

export default function GuardianNotificationPanel({
  studentId,
  isFaculty = false,
}: GuardianNotificationPanelProps) {
  const [contact, setContact] = useState<GuardianContact>({
    name: '',
    phone: '',
    email: '',
    preferredChannel: 'whatsapp',
  });
  const [notifyOptIn, setNotifyOptIn] = useState(true);
  const [alertLog, setAlertLog] = useState<AlertLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/guardian-settings?studentId=${studentId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.guardianContact) setContact(data.guardianContact);
      if (data.notifyOptIn !== undefined) setNotifyOptIn(data.notifyOptIn);
      if (data.alertLog) setAlertLog(data.alertLog);
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/guardian-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, guardianContact: contact, notifyOptIn }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg('Settings saved successfully!');
        setTimeout(() => setSaveMsg(''), 3000);
      } else {
        setSaveMsg(data.error || 'Failed to save');
      }
    } catch {
      setSaveMsg('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Guardian Notifications</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNotifyOptIn(!notifyOptIn)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{
              background: notifyOptIn ? 'rgba(16,185,129,0.08)' : 'rgba(255,77,94,0.08)',
              color: notifyOptIn ? '#10B981' : '#FF4D5E',
              border: `1px solid ${notifyOptIn ? 'rgba(16,185,129,0.25)' : 'rgba(255,77,94,0.25)'}`,
            }}
          >
            {notifyOptIn ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
            {notifyOptIn ? 'Alerts ON' : 'Alerts OFF'}
          </button>
        </div>
      </div>

      {/* Opt-in description */}
      <div className="p-3 rounded-xl text-xs text-slate-600 flex items-start gap-2"
        style={{
          background: notifyOptIn ? 'rgba(16,185,129,0.04)' : 'rgba(255,77,94,0.04)',
          border: `1px solid ${notifyOptIn ? 'rgba(16,185,129,0.15)' : 'rgba(255,77,94,0.15)'}`,
        }}>
        <Shield className="w-4 h-4 shrink-0 mt-0.5" style={{ color: notifyOptIn ? '#10B981' : '#FF4D5E' }} />
        <div>
          <strong className="block mb-0.5" style={{ color: notifyOptIn ? '#059669' : '#DC2626' }}>
            {notifyOptIn ? 'Guardian alerts enabled' : 'Guardian alerts disabled'}
          </strong>
          {notifyOptIn
            ? 'Alerts are sent when attendance drops below 75% or risk level changes to High. Rate-limited to one alert per student per day.'
            : 'No alerts will be sent. Enable to notify guardians of attendance concerns.'}
        </div>
      </div>

      {/* Contact form */}
      <div className="space-y-3">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">
          Guardian Contact Information
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Guardian Name</label>
            <input
              type="text"
              value={contact.name}
              onChange={(e) => setContact(c => ({ ...c, name: e.target.value }))}
              placeholder="e.g. Sunita Sharma"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Phone Number</label>
            <input
              type="tel"
              value={contact.phone}
              onChange={(e) => setContact(c => ({ ...c, phone: e.target.value }))}
              placeholder="+919876543210"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Email (optional)</label>
            <input
              type="email"
              value={contact.email}
              onChange={(e) => setContact(c => ({ ...c, email: e.target.value }))}
              placeholder="guardian@example.com"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Preferred Channel</label>
            <div className="flex gap-1.5">
              {CHANNEL_OPTIONS.map((ch) => {
                const Icon = ch.icon;
                const active = contact.preferredChannel === ch.value;
                return (
                  <button
                    key={ch.value}
                    onClick={() => setContact(c => ({ ...c, preferredChannel: ch.value as any }))}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-all"
                    style={{
                      background: active ? `${ch.color}12` : '#F9FAFB',
                      color: active ? ch.color : '#94A3B8',
                      border: `1px solid ${active ? `${ch.color}40` : '#E2E8F0'}`,
                    }}
                  >
                    <Icon className="w-3 h-3" />
                    {ch.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saveMsg && (
            <span className="text-[11px] font-semibold" style={{ color: saveMsg.includes('success') ? '#10B981' : '#FF4D5E' }}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>

      {/* Alert history log */}
      <div className="space-y-2 pt-3 border-t border-slate-100">
        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          Recent Alert History
        </p>
        {alertLog.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-3 text-center">No alerts sent yet</p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {alertLog.map((entry, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-[11px] font-medium text-slate-700">{entry.message}</p>
                    <p className="text-[9px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(entry.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                    {entry.channel}
                  </span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
