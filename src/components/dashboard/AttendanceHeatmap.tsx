'use client';

import React, { useState, useEffect, memo, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface HeatmapDay {
  date: string;
  dayOfWeek: string;
  pct: number;
  present: number;
  late: number;
  total: number;
  totalStudents: number;
}

interface AttendanceHeatmapProps {
  section: string;
}

const PCT_COLORS = [
  { min: 0,   color: '#FEE2E2', label: '< 75%' },   // red-100
  { min: 75,  color: '#FEF3C7', label: '75–84%' },   // amber-100
  { min: 85,  color: '#D1FAE5', label: '85–94%' },   // emerald-100
  { min: 95,  color: '#10B981', label: '95–100%' },  // emerald-500
];

function getColor(pct: number): string {
  if (pct >= 95) return '#10B981';
  if (pct >= 85) return '#6EE7B7';
  if (pct >= 75) return '#FCD34D';
  if (pct >= 60) return '#FB923C';
  return '#EF4444';
}

function getColorOpacity(pct: number): number {
  if (pct >= 95) return 1;
  if (pct >= 85) return 0.8;
  if (pct >= 75) return 0.6;
  if (pct >= 60) return 0.4;
  return 0.3;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const HeatmapCell = memo(function HeatmapCell({
  day,
  onHover,
}: {
  day: HeatmapDay | null;
  onHover: (day: HeatmapDay | null, x: number, y: number) => void;
}) {
  if (!day) {
    return (
      <div
        className="w-[14px] h-[14px] rounded-[3px]"
        style={{ background: '#F1F5F9' }}
      />
    );
  }

  const color = getColor(day.pct);

  return (
    <div
      className="w-[14px] h-[14px] rounded-[3px] cursor-pointer transition-transform hover:scale-125 hover:z-10 relative"
      style={{
        background: color,
        opacity: getColorOpacity(day.pct),
      }}
      onMouseEnter={(e) => onHover(day, e.clientX, e.clientY)}
      onMouseLeave={() => onHover(null, 0, 0)}
    />
  );
});

export default function AttendanceHeatmap({ section }: AttendanceHeatmapProps) {
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current, -1 = prev week, etc.

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance-heatmap?section=${encodeURIComponent(section)}&days=90`);
      const data = await res.json();
      if (data.heatmap) setHeatmap(data.heatmap);
    } catch {
      setHeatmap([]);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  // Build the grid: 7 rows (days of week) × N columns (weeks)
  const buildGrid = () => {
    if (!heatmap.length) return { weeks: [], months: [] };

    // Create a map of date → heatmap day
    const dateMap = new Map(heatmap.map(d => [d.date, d]));

    // Find the range: go back 90 days from today
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 89);

    // Align to start of week (Monday)
    const dayOfWeek = startDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const alignedStart = new Date(startDate);
    alignedStart.setDate(alignedStart.getDate() + mondayOffset);

    // Build weeks
    const weeks: (HeatmapDay | null)[][] = [];
    const months: { label: string; colStart: number }[] = [];
    let lastMonth = -1;
    let currentWeek: (HeatmapDay | null)[] = [];
    let colIndex = 0;

    const cursor = new Date(alignedStart);
    while (cursor <= today || currentWeek.length > 0) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const day = dateMap.get(dateStr) || null;

      // Track month labels
      const month = cursor.getMonth();
      if (month !== lastMonth && cursor >= alignedStart) {
        months.push({ label: MONTH_LABELS[month], colStart: colIndex });
        lastMonth = month;
      }

      // Monday=0, Sunday=6 in our grid
      const gridDay = (cursor.getDay() + 6) % 7;
      currentWeek[gridDay] = day;

      if (gridDay === 6 || cursor >= today) {
        // Pad incomplete weeks
        while (currentWeek.length < 7) currentWeek.push(null);
        weeks.push(currentWeek);
        currentWeek = [];
        colIndex++;
      }

      cursor.setDate(cursor.getDate() + 1);
      if (cursor > today && currentWeek.length === 0) break;
    }

    return { weeks, months };
  };

  const { weeks, months } = buildGrid();

  const handleHover = (day: HeatmapDay | null, x: number, y: number) => {
    setHoveredDay(day);
    setTooltipPos({ x: x + 10, y: y - 40 });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Attendance Heatmap</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400">{section}</span>
        </div>
      </div>

      {loading ? (
        <div className="h-32 rounded-xl animate-pulse" style={{ background: '#F1F5F9' }} />
      ) : heatmap.length === 0 ? (
        <div className="h-32 rounded-xl flex flex-col items-center justify-center gap-2"
          style={{ background: 'rgba(91,82,255,0.03)', border: '1px dashed rgba(91,82,255,0.2)' }}>
          <Calendar className="w-5 h-5" style={{ color: 'rgba(91,82,255,0.4)' }} />
          <p className="text-[11px] text-slate-400">No attendance data yet for {section}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Month labels */}
          <div className="flex items-center gap-0 ml-[32px]">
            {months.map((m, i) => (
              <span
                key={i}
                className="text-[9px] font-mono text-slate-400"
                style={{ marginLeft: i === 0 ? m.colStart * 18 : (m.colStart - months[i - 1].colStart) * 18 - 20 }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="flex items-start gap-0">
            {/* Day labels */}
            <div className="flex flex-col gap-[2px] mr-1">
              {DAY_LABELS.map((d, i) => (
                <div key={d} className="h-[14px] flex items-center">
                  <span className="text-[8px] font-mono text-slate-400 w-6 text-right">
                    {i % 2 === 1 ? d.slice(0, 1) : ''}
                  </span>
                </div>
              ))}
            </div>

            {/* Weeks */}
            <div className="flex gap-[2px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {week.map((day, di) => (
                    <HeatmapCell key={di} day={day} onHover={handleHover} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-[9px] text-slate-400">Less</span>
            {[50, 65, 75, 85, 95].map((pct) => (
              <div
                key={pct}
                className="w-[10px] h-[10px] rounded-[2px]"
                style={{ background: getColor(pct), opacity: getColorOpacity(pct) }}
              />
            ))}
            <span className="text-[9px] text-slate-400">More</span>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {hoveredDay && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-2 rounded-xl text-xs shadow-lg border"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            background: '#fff',
            borderColor: '#E2E8F0',
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="font-semibold text-slate-900">{hoveredDay.date}</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: getColor(hoveredDay.pct) + '20',
                color: getColor(hoveredDay.pct),
              }}>
              {hoveredDay.pct}%
            </span>
          </div>
          <p className="text-[10px] text-slate-500">
            {hoveredDay.present}/{hoveredDay.total} present · {hoveredDay.dayOfWeek}
          </p>
        </div>
      )}
    </div>
  );
}
