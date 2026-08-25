/**
 * Meeting utility functions.
 * Pure logic — no AI dependency.
 */

/**
 * Attendance thresholds (configurable, centralized).
 * Adjust these to change attendance classification globally.
 */
export const ATTENDANCE_THRESHOLDS = {
  PRESENT: 75,   // >= 75% → Present
  PARTIAL: 30,   // >= 30%  → Partial
                  // < 30%   → Absent
};

/**
 * Calculate attendance percentage from duration and meeting duration.
 * Returns a number between 0 and 100.
 */
export function calculateAttendancePercentage(participantDurationSeconds, meetingDurationMinutes) {
  if (!meetingDurationMinutes || meetingDurationMinutes <= 0) return 0;
  const meetingSeconds = meetingDurationMinutes * 60;
  if (meetingSeconds <= 0) return 0;
  const pct = Math.round((participantDurationSeconds / meetingSeconds) * 100);
  return Math.min(100, Math.max(0, pct));
}

/**
 * Classify attendance status based on percentage.
 */
export function classifyAttendance(attendancePercentage) {
  if (attendancePercentage >= ATTENDANCE_THRESHOLDS.PRESENT) return 'present';
  if (attendancePercentage >= ATTENDANCE_THRESHOLDS.PARTIAL) return 'partial';
  return 'absent';
}

/**
 * Format seconds into a human-readable duration string.
 * Examples: "0:42", "18:05", "1:02:30"
 */
export function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 0) return '0:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Generate a cryptographically random meeting UUID (URL-safe).
 */
export function generateMeetingUuid() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(24);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < 24; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Get meeting duration in minutes.
 * Uses actual duration if meeting has ended, otherwise scheduled expected duration.
 */
export function getEffectiveDurationMinutes(meeting) {
  if (meeting.actualStartTime && meeting.actualEndTime) {
    return (new Date(meeting.actualEndTime) - new Date(meeting.actualStartTime)) / (1000 * 60);
  }
  return meeting.expectedDuration || 60;
}

/**
 * Build attendance summary from meeting and attendance records.
 */
export function buildAttendanceSummary(meeting, attendanceRecords) {
  const totalInvited = meeting.totalInvited || attendanceRecords.length;
  const joined = attendanceRecords.filter(a => a.attendanceStatus !== 'not_joined');
  const present = attendanceRecords.filter(a => a.attendanceStatus === 'present');
  const partial = attendanceRecords.filter(a => a.attendanceStatus === 'partial');
  const absent = attendanceRecords.filter(a => a.attendanceStatus === 'absent');

  const avgDuration = joined.length > 0
    ? Math.round(joined.reduce((sum, a) => sum + a.totalDuration, 0) / joined.length / 60)
    : 0;

  const attendanceRate = totalInvited > 0
    ? Math.round(((present.length + partial.length * 0.5) / totalInvited) * 1000) / 10
    : 0;

  return {
    meetingTitle: meeting.title,
    host: meeting.hostName,
    date: meeting.scheduledDate,
    startTime: meeting.actualStartTime || meeting.scheduledStartTime,
    endTime: meeting.actualEndTime,
    totalDuration: meeting.actualStartTime && meeting.actualEndTime
      ? Math.round((new Date(meeting.actualEndTime) - new Date(meeting.actualStartTime)) / 60000)
      : meeting.expectedDuration,
    totalInvited,
    totalJoined: joined.length,
    presentCount: present.length,
    partialCount: partial.length,
    absentCount: absent.length,
    attendanceRate,
    averageAttendanceDuration: avgDuration,
    participants: attendanceRecords.map(a => ({
      name: a.userName,
      rollNumber: a.userRollNumber || '',
      joinTime: a.firstJoinTime,
      leaveTime: a.lastLeaveTime,
      duration: a.totalDuration,
      durationFormatted: formatDuration(a.totalDuration),
      percentage: a.attendancePercentage,
      status: a.attendanceStatus,
    })),
  };
}
