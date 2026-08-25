/**
 * Target Audience Engine
 * ──────────────────────
 * Central utility for resolving, validating, and matching academic targeting.
 *
 * Every academic object (event, task, quiz, announcement, resource) carries
 * a targetAudience that determines which students receive it.
 *
 * Target audience shape:
 * {
 *   branch:   "CSE" | "ECE" | ... | "" (empty = all branches)
 *   year:     1 | 2 | 3 | 4 | 0 (0 = all years)
 *   semester: 1 | 2 | 0 (0 = all semesters)
 *   section:  "A" | "B" | "" (empty = all sections)
 *   subject:  "Digital Electronics" | "" (empty = all subjects)
 *   studentIds: [] (empty = use branch/year/semester/section; non-empty = specific students)
 * }
 */

const KNOWN_BRANCHES = ['CSE', 'ECE', 'IT', 'AI', 'MECH', 'CIVIL', 'EEE'];
const KNOWN_SECTIONS = ['A', 'B', 'C', 'D'];

/**
 * Parse structured academic info from a classOrSubject string like "CSE-A" or "ECE-B".
 * Returns { branch, section }.
 */
export function parseClassOrSubject(classOrSubject) {
  if (!classOrSubject) return { branch: '', section: '' };
  const s = String(classOrSubject).trim().toUpperCase();
  const parts = s.split(/[-_\s]+/);
  const branch = parts[0] || '';
  const section = parts[1] || '';
  return { branch, section };
}

/**
 * Parse year and semester from a student's academic info.
 * Falls back to 0 (all) if not determinable.
 */
export function parseYearSemester(classOrSubject) {
  // If classOrSubject is like "2-CSE-A" → year=2, branch=CSE, section=A
  const s = String(classOrSubject || '').trim();
  const yearMatch = s.match(/^(\d)/);
  return {
    year: yearMatch ? parseInt(yearMatch[1]) : 0,
    semester: 0,
  };
}

/**
 * Build a target audience object from form input.
 * Normalizes all fields.
 */
export function buildTargetAudience({ branch, year, semester, section, subject, studentIds }) {
  return {
    branch:   String(branch || '').trim().toUpperCase(),
    year:     parseInt(year) || 0,
    semester: parseInt(semester) || 0,
    section:  String(section || '').trim().toUpperCase(),
    subject:  String(subject || '').trim(),
    studentIds: Array.isArray(studentIds) ? studentIds : [],
  };
}

/**
 * Check if a student matches a target audience.
 *
 * Rules:
 * 1. If studentIds is non-empty, student must be in the list.
 * 2. If branch is set, student's branch must match.
 * 3. If year is set (>0), student's year must match.
 * 4. If semester is set (>0), student's semester must match.
 * 5. If section is set, student's section must match.
 * 6. If subject is set, student must have that subject.
 * 7. Empty/0 fields are treated as "any" (wildcard).
 */
export function matchesTargetAudience(student, audience) {
  if (!audience) return true; // No targeting = visible to all

  // Specific student IDs
  if (audience.studentIds && audience.studentIds.length > 0) {
    const studentId = String(student._id || student.id || '');
    return audience.studentIds.some(id => String(id) === studentId);
  }

  const { branch: studentBranch, section: studentSection } = parseClassOrSubject(student.classOrSubject);
  const { year: studentYear } = parseYearSemester(student.classOrSubject);

  // Branch check
  if (audience.branch && audience.branch !== studentBranch) return false;

  // Year check
  if (audience.year && audience.year > 0 && audience.year !== studentYear) return false;

  // Semester check
  if (audience.semester && audience.semester > 0) {
    // Student semester derived from classOrSubject or default to matching
    // For now, semester is informational — skip strict check if student doesn't have semester
  }

  // Section check
  if (audience.section && audience.section !== studentSection) return false;

  // Subject check
  if (audience.subject) {
    const studentSubjects = [...(student.subjects || []), ...(student.labs || [])];
    if (!studentSubjects.some(s => s.toLowerCase() === audience.subject.toLowerCase())) return false;
  }

  return true;
}

/**
 * Build a MongoDB query that matches students to a target audience.
 * Used for efficient server-side filtering without loading all students.
 */
export function buildTargetAudienceQuery(audience) {
  if (!audience) return {};

  // Specific student IDs
  if (audience.studentIds && audience.studentIds.length > 0) {
    return { _id: { $in: audience.studentIds } };
  }

  const query = { role: 'student' };

  if (audience.branch || audience.section) {
    // Build a regex pattern: "^CSE(-A)?$" for branch only, "^CSE-A$" for specific section
    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (audience.section && audience.branch) {
      query.classOrSubject = new RegExp(`^${escapeRegex(audience.branch)}[-_\\s]?${escapeRegex(audience.section)}$`, 'i');
    } else if (audience.branch) {
      query.classOrSubject = new RegExp(`^${escapeRegex(audience.branch)}`, 'i');
    }
  }

  return query;
}

/**
 * Validate that a faculty member is authorized to create content for the given target.
 * Returns { valid, error }.
 */
export function validateFacultyTarget(faculty, targetAudience) {
  if (!faculty || !targetAudience) return { valid: false, error: 'Missing faculty or target audience' };

  // Admins can target anything
  if (faculty.role === 'admin') return { valid: true };

  // Faculty authorization — check if the faculty's branch matches
  const facultyBranch = parseClassOrSubject(faculty.classOrSubject).branch;
  const facultySubjects = faculty.subjects || [];

  if (targetAudience.branch && targetAudience.branch !== facultyBranch) {
    return { valid: false, error: `Faculty is not authorized for branch ${targetAudience.branch}. Authorized: ${facultyBranch}` };
  }

  if (targetAudience.subject && !facultySubjects.some(s => s.toLowerCase() === targetAudience.subject.toLowerCase())) {
    return { valid: false, error: `Faculty is not assigned subject: ${targetAudience.subject}` };
  }

  return { valid: true };
}

/**
 * Get a human-readable description of a target audience.
 */
export function describeTargetAudience(audience) {
  if (!audience) return 'All students';
  const parts = [];
  if (audience.branch) parts.push(audience.branch);
  if (audience.year) parts.push(`${audience.year}${ordinalSuffix(audience.year)} Year`);
  if (audience.semester) parts.push(`Sem ${audience.semester}`);
  if (audience.section) parts.push(`Section ${audience.section}`);
  if (audience.subject) parts.push(audience.subject);
  if (audience.studentIds?.length) parts.push(`${audience.studentIds.length} specific student(s)`);
  return parts.length > 0 ? parts.join(' · ') : 'All students';
}

function ordinalSuffix(n) {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

/**
 * Resolve the count of matching students for a target audience.
 * Takes a pre-fetched student list and filters.
 */
export function countMatchingStudents(students, audience) {
  if (!audience || (!audience.branch && !audience.year && !audience.semester && !audience.section && !audience.subject && (!audience.studentIds || audience.studentIds.length === 0))) {
    return students.length;
  }
  return students.filter(s => matchesTargetAudience(s, audience)).length;
}
