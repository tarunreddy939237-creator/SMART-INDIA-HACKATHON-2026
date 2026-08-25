'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; isPositive: boolean };
  accentColor?: 'cyan' | 'emerald' | 'amber' | 'indigo' | 'purple' | 'blue' | 'green' | 'red' | 'slate' | 'coral';
  /** 0-100, renders animated SVG ring */
  ringValue?: number;
}

const accent: Record<string, {
  color: string; dimColor: string; iconColor: string;
  ringStroke: string; barGrad: string; glowColor: string;
}> = {
  blue:    { color: '#5B52FF', dimColor: 'rgba(91,82,255,0.08)',   iconColor: '#5B52FF', ringStroke: '#5B52FF', barGrad: 'from-indigo-500 to-violet-500', glowColor: 'rgba(91,82,255,0.2)' },
  indigo:  { color: '#5B52FF', dimColor: 'rgba(91,82,255,0.08)',   iconColor: '#5B52FF', ringStroke: '#5B52FF', barGrad: 'from-indigo-500 to-violet-500', glowColor: 'rgba(91,82,255,0.2)' },
  cyan:    { color: '#1CDEC8', dimColor: 'rgba(28,222,200,0.08)',  iconColor: '#1CDEC8', ringStroke: '#1CDEC8', barGrad: 'from-cyan-400 to-teal-400',     glowColor: 'rgba(28,222,200,0.2)' },
  green:   { color: '#10B981', dimColor: 'rgba(16,185,129,0.08)',  iconColor: '#10B981', ringStroke: '#10B981', barGrad: 'from-emerald-500 to-teal-500',   glowColor: 'rgba(16,185,129,0.2)' },
  emerald: { color: '#10B981', dimColor: 'rgba(16,185,129,0.08)',  iconColor: '#10B981', ringStroke: '#10B981', barGrad: 'from-emerald-500 to-teal-500',   glowColor: 'rgba(16,185,129,0.2)' },
  amber:   { color: '#FFAA00', dimColor: 'rgba(255,170,0,0.08)',   iconColor: '#FFAA00', ringStroke: '#FFAA00', barGrad: 'from-amber-400 to-orange-400',   glowColor: 'rgba(255,170,0,0.2)' },
  red:     { color: '#FF4D5E', dimColor: 'rgba(255,77,94,0.08)',   iconColor: '#FF4D5E', ringStroke: '#FF4D5E', barGrad: 'from-rose-500 to-red-500',       glowColor: 'rgba(255,77,94,0.2)' },
  coral:   { color: '#FF4D5E', dimColor: 'rgba(255,77,94,0.08)',   iconColor: '#FF4D5E', ringStroke: '#FF4D5E', barGrad: 'from-rose-500 to-coral-500',     glowColor: 'rgba(255,77,94,0.2)' },
  purple:  { color: '#8B5CF6', dimColor: 'rgba(139,92,246,0.08)',  iconColor: '#8B5CF6', ringStroke: '#8B5CF6', barGrad: 'from-violet-500 to-purple-600',  glowColor: 'rgba(139,92,246,0.2)' },
  slate:   { color: '#64748B', dimColor: 'rgba(100,116,139,0.08)', iconColor: '#64748B', ringStroke: '#94A3B8', barGrad: 'from-slate-400 to-slate-500',    glowColor: 'rgba(100,116,139,0.1)' },
};

/** Animated SVG ring that counts up from 0 to `value` */
function ProgressRing({ value, color, size = 44 }: { value: number; color: string; size?: number }) {
  const radius = (size - 6) / 2;
  const circ   = 2 * Math.PI * radius;
  const [animated, setAnimated] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimated(Math.round(eased * value));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  const offset = circ - (animated / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={radius} fill="none" strokeWidth={2}
          stroke="rgba(255,255,255,0.08)" />
        {/* Progress */}
        <circle cx={size/2} cy={size/2} r={radius} fill="none" strokeWidth={2.5}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.05s linear', filter: `drop-shadow(0 0 3px ${color}80)` }}
        />
      </svg>
    </div>
  );
}

export default function StatCard({
  title, value, subtitle, icon: Icon, trend, accentColor = 'blue', ringValue,
}: StatCardProps) {
  const a = accent[accentColor] ?? accent.blue;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm transition-all duration-200 relative overflow-hidden"
      style={{
        boxShadow: hovered
          ? `0 8px 30px ${a.glowColor}, 0 2px 8px rgba(0,0,0,0.06)`
          : `0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)`,
        transform: hovered ? 'translateY(-3px)' : 'none',
        borderColor: hovered ? `${a.color}30` : '#e2e8f0',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Gradient top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${a.barGrad} rounded-t-2xl`} />

      {/* Viewfinder brackets — appear on hover */}
      <div className="absolute inset-[6px] pointer-events-none transition-all duration-200"
        style={{
          background: hovered ? `
            linear-gradient(${a.color}, ${a.color}) top left / 10px 1.5px no-repeat,
            linear-gradient(${a.color}, ${a.color}) top left / 1.5px 10px no-repeat,
            linear-gradient(${a.color}, ${a.color}) bottom right / 10px 1.5px no-repeat,
            linear-gradient(${a.color}, ${a.color}) bottom right / 1.5px 10px no-repeat
          ` : undefined,
          opacity: hovered ? 0.45 : 0,
        }}
      />

      {/* Header: title + ring icon */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider leading-tight">{title}</p>
        <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
          {ringValue !== undefined ? (
            <ProgressRing value={Math.min(ringValue, 100)} color={a.color} />
          ) : (
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: a.dimColor }}>
              <Icon strokeWidth={1.5} style={{ width: 18, height: 18, color: a.iconColor }} />
            </div>
          )}
          {/* Icon watermark inside ring */}
          {ringValue !== undefined && (
            <Icon
              strokeWidth={1.5}
              className="absolute inset-0 m-auto"
              style={{ width: 14, height: 14, color: a.iconColor, opacity: 0.7 }}
            />
          )}
        </div>
      </div>

      {/* Hero value — JetBrains Mono, large */}
      <p className="font-mono text-[32px] font-bold leading-none mb-2 tabular-nums"
        style={{ color: '#0F172A', letterSpacing: '-0.03em' }}>
        {value}
      </p>

      {/* Subtitle + trend */}
      <div className="flex items-center justify-between gap-2 mt-1">
        {subtitle && (
          <p className="text-[11px] text-slate-400 truncate leading-tight">{subtitle}</p>
        )}
        {trend && (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0"
            style={trend.isPositive ? {
              background: 'rgba(16,185,129,0.08)',
              color: '#10B981',
              border: '1px solid rgba(16,185,129,0.2)',
            } : {
              background: 'rgba(255,77,94,0.08)',
              color: '#FF4D5E',
              border: '1px solid rgba(255,77,94,0.2)',
            }}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
