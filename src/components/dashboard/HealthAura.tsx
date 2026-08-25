'use client';

import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarCheck, Flame, BookOpen, AlertTriangle,
  CheckCircle2, TrendingDown, TrendingUp, ChevronDown,
} from 'lucide-react';

/* ── Risk color mapping ─────────────────────────────────────────── */

function riskToColor(score: number | null): { primary: string; glow: string; label: string } {
  if (score === null) return { primary: '#94A3B8', glow: 'rgba(148,163,184,0.3)', label: 'No Data' };
  if (score < 30)     return { primary: '#1CDEC8', glow: 'rgba(28,222,200,0.4)',  label: 'Healthy' };
  if (score < 60)     return { primary: '#FFAA00', glow: 'rgba(255,170,0,0.4)',  label: 'Watch' };
  return                      { primary: '#FF4D5E', glow: 'rgba(255,77,94,0.45)', label: 'At Risk' };
}

function riskToPulseDuration(score: number | null): number {
  if (score === null) return 0; // no pulse for no-data
  if (score < 30) return 4;     // calm, slow
  if (score < 60) return 2.5;   // moderate
  return 1.2;                   // agitated
}

function riskToGlowIntensity(score: number | null): number {
  if (score === null) return 0.15;
  if (score < 30) return 0.3;
  if (score < 60) return 0.5;
  return 0.7;
}

/* ── Interpolate between two hex colors ──────────────────────────── */
function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function riskToSmoothColor(score: number | null): string {
  if (score === null) return '#94A3B8';
  if (score < 20) return '#1CDEC8';
  if (score < 30) return lerpColor('#1CDEC8', '#FFAA00', (score - 20) / 10);
  if (score < 50) return '#FFAA00';
  if (score < 60) return lerpColor('#FFAA00', '#FF4D5E', (score - 50) / 10);
  return '#FF4D5E';
}

/* ── Types ─────────────────────────────────────────────────────── */

export interface AuraFactor {
  label: string;
  value: string;
  icon: React.FC<any>;
  status: 'good' | 'warn' | 'bad' | 'neutral';
}

interface HealthAuraProps {
  /** 0–100 risk score, or null for "no data yet" */
  riskScore: number | null;
  /** Optional: percentage display inside the orb */
  displayValue?: string;
  /** Student name (shown below in compact mode) */
  name?: string;
  /** Section/class info */
  subtitle?: string;
  /** 'sm' = 56px for faculty grid, 'md' = 88px, 'lg' = 120px for student dashboard */
  size?: 'sm' | 'md' | 'lg';
  /** Factors to show in expanded detail */
  factors?: AuraFactor[];
  /** Risk reasons from backend */
  reasons?: string[];
  /** Risk tier label */
  tier?: string;
  /** Whether the card is interactive (hover/click to expand) */
  interactive?: boolean;
}

/* ── SVG Aura Ring ──────────────────────────────────────────────── */

const AuraOrb = memo(function AuraOrb({
  score,
  size,
  displayValue,
}: {
  score: number | null;
  size: number;
  displayValue?: string;
}) {
  const { primary, glow } = riskToColor(score);
  const smoothColor = riskToSmoothColor(score);
  const pulseDuration = riskToPulseDuration(score);
  const glowIntensity = riskToGlowIntensity(score);
  const isNoData = score === null;

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = score !== null
    ? circumference - (score / 100) * circumference
    : circumference; // fully empty for no-data

  // Unique gradient ID to avoid conflicts with multiple instances
  const gradientId = useMemo(() => `aura-grad-${Math.random().toString(36).slice(2, 8)}`, []);
  const glowId = useMemo(() => `aura-glow-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        <defs>
          {/* Radial gradient for the orb fill */}
          <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={smoothColor} stopOpacity={isNoData ? 0.05 : 0.15} />
            <stop offset="70%" stopColor={smoothColor} stopOpacity={isNoData ? 0.03 : 0.08} />
            <stop offset="100%" stopColor={smoothColor} stopOpacity={0} />
          </radialGradient>
          {/* Glow filter */}
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={isNoData ? 2 : 4} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - 2}
          fill={`url(#${gradientId})`}
        />

        {/* Track ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={size > 80 ? 3 : 2.5}
          stroke={isNoData ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.06)'}
          strokeDasharray={isNoData ? `${circumference * 0.08} ${circumference * 0.06}` : undefined}
          strokeLinecap="round"
        />

        {/* Progress ring */}
        {!isNoData && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={size > 80 ? 3 : 2.5}
            stroke={smoothColor}
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            strokeLinecap="round"
            filter={`url(#${glowId})`}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        )}

        {/* Inner glow ring (pulsing) */}
        {!isNoData && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius - (size > 80 ? 8 : 6)}
            fill="none"
            strokeWidth={1}
            stroke={smoothColor}
            strokeOpacity={glowIntensity * 0.4}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              animation: `aura-breathe ${pulseDuration}s ease-in-out infinite`,
            }}
          />
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {displayValue && (
          <span
            className="font-mono font-bold tabular-nums leading-none"
            style={{
              fontSize: size > 100 ? 22 : size > 70 ? 16 : 11,
              color: isNoData ? '#94A3B8' : smoothColor,
              letterSpacing: '-0.03em',
              opacity: isNoData ? 0.5 : 1,
            }}
          >
            {displayValue}
          </span>
        )}
        {isNoData && size > 70 && (
          <span
            className="font-mono text-center leading-tight"
            style={{ fontSize: 8, color: '#94A3B8', opacity: 0.6, letterSpacing: '0.05em' }}
          >
            NO DATA
          </span>
        )}
      </div>
    </div>
  );
});

/* ── Main Component ──────────────────────────────────────────────── */

export default function HealthAura({
  riskScore,
  displayValue,
  name,
  subtitle,
  size = 'md',
  factors = [],
  reasons = [],
  tier,
  interactive = true,
}: HealthAuraProps) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const { primary, label } = riskToColor(riskScore);
  const smoothColor = riskToSmoothColor(riskScore);
  const pulseDuration = riskToPulseDuration(riskScore);
  const isNoData = riskScore === null;

  const sizeMap = { sm: 56, md: 88, lg: 120 };
  const px = sizeMap[size];

  // Close expanded on click outside
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  return (
    <div ref={cardRef} className="relative">
      {/* ── Aura card ── */}
      <motion.div
        className="relative rounded-2xl overflow-hidden cursor-pointer select-none"
        style={{
          background: '#fff',
          border: `1px solid ${hovered ? `${smoothColor}40` : '#E2E8F0'}`,
          boxShadow: hovered
            ? `0 8px 30px ${riskToColor(riskScore).glow}, 0 2px 8px rgba(0,0,0,0.06)`
            : '0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => interactive && setExpanded(!expanded)}
        whileHover={interactive ? { y: -2 } : undefined}
        transition={{ duration: 0.2 }}
      >
        {/* Top accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{
            background: isNoData
              ? 'linear-gradient(90deg, #94A3B8, #CBD5E1)'
              : `linear-gradient(90deg, ${smoothColor}, ${smoothColor}88)`,
          }}
        />

        {/* Viewfinder brackets on hover */}
        <div
          className="absolute inset-[5px] pointer-events-none transition-all duration-200"
          style={{
            background: hovered && !isNoData ? `
              linear-gradient(${smoothColor}, ${smoothColor}) top left / 8px 1.5px no-repeat,
              linear-gradient(${smoothColor}, ${smoothColor}) top left / 1.5px 8px no-repeat,
              linear-gradient(${smoothColor}, ${smoothColor}) bottom right / 8px 1.5px no-repeat,
              linear-gradient(${smoothColor}, ${smoothColor}) bottom right / 1.5px 8px no-repeat
            ` : undefined,
            opacity: hovered ? 0.4 : 0,
          }}
        />

        {size === 'sm' ? (
          /* ── Compact mode (faculty grid) ── */
          <div className="p-3 flex items-center gap-3">
            {/* Pulsing aura wrapper */}
            <div
              style={pulseDuration > 0 ? {
                animation: `aura-breathe ${pulseDuration}s ease-in-out infinite`,
              } : undefined}
            >
              <AuraOrb score={riskScore} size={px} displayValue={displayValue} />
            </div>

            <div className="flex-1 min-w-0">
              {name && (
                <p className="text-[12px] font-bold text-slate-900 truncate leading-tight">{name}</p>
              )}
              {subtitle && (
                <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: isNoData ? 'rgba(148,163,184,0.08)' : `${smoothColor}15`,
                    color: isNoData ? '#94A3B8' : smoothColor,
                    border: `1px solid ${isNoData ? 'rgba(148,163,184,0.15)' : `${smoothColor}30`}`,
                  }}
                >
                  {isNoData ? 'NO DATA' : `${riskScore}`}
                </span>
                {tier && (
                  <span className="text-[9px] text-slate-400 font-semibold uppercase">{tier}</span>
                )}
              </div>
            </div>

            {interactive && (
              <ChevronDown
                className="w-3 h-3 shrink-0 transition-transform"
                style={{
                  color: '#94A3B8',
                  transform: expanded ? 'rotate(180deg)' : undefined,
                }}
              />
            )}
          </div>
        ) : (
          /* ── Full mode (student dashboard) ── */
          <div className={`p-${size === 'lg' ? '5' : '4'} flex flex-col items-center gap-3`}>
            {/* Pulsing aura wrapper */}
            <div
              style={pulseDuration > 0 ? {
                animation: `aura-breathe ${pulseDuration}s ease-in-out infinite`,
              } : undefined}
            >
              <AuraOrb score={riskScore} size={px} displayValue={displayValue} />
            </div>

            {/* Status label */}
            <div className="text-center">
              <span
                className="font-mono text-[10px] font-bold uppercase tracking-widest"
                style={{ color: isNoData ? '#94A3B8' : smoothColor }}
              >
                {label}
              </span>
              {name && (
                <p className="text-[12px] font-semibold text-slate-900 mt-1 truncate max-w-[140px]">{name}</p>
              )}
              {subtitle && (
                <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
              )}
            </div>

            {/* Quick factor chips */}
            {factors.length > 0 && size === 'lg' && (
              <div className="flex flex-wrap justify-center gap-1.5 w-full">
                {factors.slice(0, 3).map((f, i) => {
                  const FIcon = f.icon;
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 font-mono text-[9px] font-bold px-2 py-0.5 rounded-lg"
                      style={{
                        background: f.status === 'good' ? 'rgba(16,185,129,0.06)'
                          : f.status === 'warn' ? 'rgba(255,170,0,0.06)'
                          : f.status === 'bad' ? 'rgba(255,77,94,0.06)'
                          : 'rgba(148,163,184,0.06)',
                        color: f.status === 'good' ? '#10B981'
                          : f.status === 'warn' ? '#FFAA00'
                          : f.status === 'bad' ? '#FF4D5E'
                          : '#94A3B8',
                        border: `1px solid ${
                          f.status === 'good' ? 'rgba(16,185,129,0.15)'
                          : f.status === 'warn' ? 'rgba(255,170,0,0.15)'
                          : f.status === 'bad' ? 'rgba(255,77,94,0.15)'
                          : 'rgba(148,163,184,0.1)'
                        }`,
                      }}
                    >
                      <FIcon style={{ width: 10, height: 10 }} />
                      {f.value}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Expanded detail panel ── */}
      <AnimatePresence>
        {expanded && interactive && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute z-50 left-0 right-0 mt-2 rounded-2xl p-4 bg-white border border-slate-200 shadow-xl"
            style={{ minWidth: 220 }}
          >
            {/* Risk score header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: smoothColor, boxShadow: `0 0 6px ${smoothColor}` }}
                />
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: smoothColor }}>
                  Risk Assessment
                </span>
              </div>
              {riskScore !== null && (
                <span
                  className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg"
                  style={{
                    background: `${smoothColor}12`,
                    color: smoothColor,
                    border: `1px solid ${smoothColor}30`,
                  }}
                >
                  {riskScore}/100
                </span>
              )}
            </div>

            {/* Factor breakdown */}
            {factors.length > 0 && (
              <div className="space-y-2 mb-3">
                {factors.map((f, i) => {
                  const FIcon = f.icon;
                  const statusColor = f.status === 'good' ? '#10B981'
                    : f.status === 'warn' ? '#FFAA00'
                    : f.status === 'bad' ? '#FF4D5E'
                    : '#94A3B8';
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FIcon style={{ width: 12, height: 12, color: statusColor }} />
                        <span className="text-[11px] text-slate-600">{f.label}</span>
                      </div>
                      <span className="font-mono text-[11px] font-bold" style={{ color: statusColor }}>
                        {f.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Risk reasons */}
            {reasons.length > 0 && reasons[0] !== 'All indicators within normal range' && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  Factors
                </p>
                {reasons.slice(0, 3).map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle
                      style={{ width: 10, height: 10, color: '#FFAA00', marginTop: 2, flexShrink: 0 }}
                    />
                    <p className="text-[10px] text-slate-500 leading-relaxed">{r}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Utility: compute client-side risk score from dashboard data ── */
export function computeStudentRiskScore(opts: {
  attendancePct: number;
  avgQuizScore: number | null;
  currentStreak: number;
  hasData: boolean;
}): number | null {
  if (!opts.hasData) return null;

  let score = 0;

  // Attendance (weight: 50)
  if (opts.attendancePct < 75) score += 50;
  else if (opts.attendancePct < 85) score += 20;
  else if (opts.attendancePct < 90) score += 5;

  // Quiz score (weight: 30)
  if (opts.avgQuizScore !== null) {
    if (opts.avgQuizScore < 50) score += 30;
    else if (opts.avgQuizScore < 65) score += 15;
    else if (opts.avgQuizScore < 75) score += 5;
  } else {
    score += 10; // no quiz data → mild risk
  }

  // Streak (weight: 20)
  if (opts.currentStreak === 0) score += 15;
  else if (opts.currentStreak < 3) score += 8;

  return Math.min(100, score);
}
