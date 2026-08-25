'use client';

import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CalendarCheck, BookOpen, Zap, Target, ClipboardCheck,
} from 'lucide-react';

export interface RiskFactor {
  name: string;
  weight: number;        // max contribution (e.g. 50, 30, 20)
  contribution: number;  // actual contribution to risk score (0–weight)
  status: 'good' | 'warn' | 'bad';
  trend: 'improving' | 'declining' | 'stable' | 'critical';
  detail: string;
  hasData: boolean;
}

interface RiskBreakdownPanelProps {
  riskScore: number | null;
  riskTier: string;
  factors: RiskFactor[];
  reasons: string[];
  compact?: boolean;  // for inline use (smaller padding)
}

const STATUS_COLORS = {
  good:  { bar: '#10B981', text: '#059669', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
  warn:  { bar: '#FFAA00', text: '#D97706', bg: 'rgba(255,170,0,0.08)',  border: 'rgba(255,170,0,0.2)' },
  bad:   { bar: '#FF4D5E', text: '#DC2626', bg: 'rgba(255,77,94,0.08)',  border: 'rgba(255,77,94,0.2)' },
};

const TIER_COLORS = {
  High:   { bg: 'rgba(255,77,94,0.08)',  color: '#FF4D5E', border: 'rgba(255,77,94,0.25)' },
  Medium: { bg: 'rgba(255,170,0,0.08)', color: '#FFAA00', border: 'rgba(255,170,0,0.25)' },
  Low:    { bg: 'rgba(16,185,129,0.08)', color: '#10B981', border: 'rgba(16,185,129,0.25)' },
};

const FACTOR_ICONS: Record<string, React.FC<any>> = {
  'Attendance': CalendarCheck,
  'Academic Performance': BookOpen,
  'Study Consistency': Target,
  'Academic Consistency': Target,
  'Engagement': Zap,
  'Assignment Completion': ClipboardCheck,
};

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === 'improving') return <TrendingUp className="w-3 h-3" style={{ color: '#10B981' }} />;
  if (trend === 'declining' || trend === 'critical') return <TrendingDown className="w-3 h-3" style={{ color: '#FF4D5E' }} />;
  return <Minus className="w-3 h-3" style={{ color: '#94A3B8' }} />;
};

const FactorBar = memo(function FactorBar({ factor }: { factor: RiskFactor }) {
  const colors = STATUS_COLORS[factor.status];
  const Icon = FACTOR_ICONS[factor.name] || AlertTriangle;
  const barWidth = factor.weight > 0 ? (factor.contribution / factor.weight) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon style={{ width: 12, height: 12, color: colors.text }} />
          <span className="text-[11px] font-semibold text-slate-700">{factor.name}</span>
          <span className="font-mono text-[9px] text-slate-400">({factor.weight}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          {!factor.hasData && (
            <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 border border-slate-200">
              NO DATA
            </span>
          )}
          <TrendIcon trend={factor.trend} />
          <span className="font-mono text-[10px] font-bold" style={{ color: colors.text }}>
            {factor.contribution}/{factor.weight}
          </span>
        </div>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.04)' }}>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: colors.bar }}
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
      <p className="text-[9px] text-slate-400 font-mono">{factor.detail}</p>
    </div>
  );
});

export default function RiskBreakdownPanel({
  riskScore,
  riskTier,
  factors,
  reasons,
  compact = false,
}: RiskBreakdownPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const tierStyle = TIER_COLORS[riskTier as keyof typeof TIER_COLORS] || TIER_COLORS.Low;

  // Compute total risk contribution
  const totalContribution = factors.reduce((sum, f) => sum + f.contribution, 0);

  return (
    <div className="rounded-xl overflow-hidden" style={{
      background: '#fff',
      border: `1px solid ${tierStyle.border}`,
      boxShadow: `0 2px 8px ${tierStyle.bg}`,
    }}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: tierStyle.color }} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: tierStyle.color }}>
              Risk Breakdown
            </span>
          </div>
          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg"
            style={{ background: tierStyle.bg, color: tierStyle.color, border: `1px solid ${tierStyle.border}` }}>
            {riskTier}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {riskScore !== null && (
            <span className="font-mono text-[11px] font-bold" style={{ color: tierStyle.color }}>
              {riskScore}/100
            </span>
          )}
          <ChevronDown
            className="w-3.5 h-3.5 text-slate-400 transition-transform"
            style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
          />
        </div>
      </button>

      {/* Expanded breakdown */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className={`px-3 ${compact ? 'pb-2' : 'pb-3'} space-y-3 border-t`} style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
              {/* Factor bars */}
              <div className={`${compact ? 'pt-2' : 'pt-3'} space-y-2.5`}>
                {factors.map((factor, i) => (
                  <FactorBar key={i} factor={factor} />
                ))}
              </div>

              {/* Summary bar */}
              <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                <span className="text-[10px] text-slate-500 font-semibold">Total Risk Contribution</span>
                <span className="font-mono text-[11px] font-bold" style={{ color: tierStyle.color }}>
                  {totalContribution}/100
                </span>
              </div>

              {/* Reasons (collapsed into short list) */}
              {reasons.length > 0 && reasons[0] !== 'All indicators within normal range' && (
                <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Key Factors
                  </p>
                  {reasons.slice(0, 3).map((reason, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertTriangle style={{ width: 9, height: 9, color: '#FFAA00', marginTop: 2, flexShrink: 0 }} />
                      <p className="text-[10px] text-slate-500 leading-relaxed">{reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
