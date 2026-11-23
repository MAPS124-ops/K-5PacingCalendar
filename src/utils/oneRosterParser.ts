import { CardTheme, GradeLevel, SubjectBlock } from '../types/pacing';
import { parseDelimitedText } from './curriculumParser';

export interface OneRosterTeacherOption {
  sourcedId: string;
  name: string;
  email: string;
}

export interface OneRosterAcademicSession {
  sourcedId: string;
  title: string;
  type: string;
  startDate: string;
  endDate: string;
}

export interface OneRosterParsedClass {
  tempId: string;
  included: boolean;
  sourcedId: string;
  title: string;
  grade: GradeLevel;
  timeLabel: string;
  defaultTheme: CardTheme;
  teacherIds: string[];
  teacherNames: string[];
  schoolName?: string;
}

export interface OneRosterBundleResult {
  classes: OneRosterParsedClass[];
  teachers: OneRosterTeacherOption[];
  sessions: OneRosterAcademicSession[];
  loadedFiles: string[];
  warnings: string[];
}

export interface ParsedICSEvent {
  tempId: string;
  included: boolean;
  date: string; // YYYY-MM-DD
  label: string;
}

function toHeaderIndexMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, idx) => {
    map[h.trim().toLowerCase()] = idx;
  });
  return map;
}

function getField(row: string[], map: Record<string, number>, keys: string[]): string {
  for (const k of keys) {
    const idx = map[k.toLowerCase()];
    if (idx !== undefined && row[idx] !== undefined) {
      return row[idx].trim();
    }
  }
  return '';
}

export function normalizeOneRosterGrades(rawGrades: string): GradeLevel[] {
  if (!rawGrades.trim()) return [];
  const tokens = rawGrades
    .split(/[,;|/\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  const result: GradeLevel[] = [];
  for (const tok of tokens) {
    if (tok === 'KG' || tok === 'K' || tok === '00' || tok === '0' || tok === 'KINDERGARTEN') {
      if (!result.includes('K')) result.push('K');
    } else if (tok === '01' || tok === '1' || tok === '1ST') {
      if (!result.includes('1')) result.push('1');
    } else if (tok === '02' || tok === '2' || tok === '2ND') {
      if (!result.includes('2')) result.push('2');
    } else if (tok === '03' || tok === '3' || tok === '3RD') {
      if (!result.includes('3')) result.push('3');
    } else if (tok === '04' || tok === '4' || tok === '4TH') {
      if (!result.includes('4')) result.push('4');
    } else if (tok === '05' || tok === '5' || tok === '5TH') {
      if (!result.includes('5')) result.push('5');
    }
  }
  return result;
}

function guessThemeFromTitle(title: string, subjectsHint = ''): CardTheme {
  const combined = `${title} ${subjectsHint}`.toLowerCase();
  if (/math|algebra|geometry|arithmetic|everyday\s*math/.test(combined)) {
    return 'teal';
  }
  if (/science|stem|steam|biology|earth/.test(combined)) {
    return 'indigo';
  }
  if (/art|music|pe|physical|library|specials/.test(combined)) {
    return 'plum';
  }
  return 'navy';
}

function cleanPeriodLabel(rawPeriods: string): string {
  const trimmed = rawPeriods.trim();
  if (!trimmed) return '';
  // If Skyward exports period numbers like "1" or "P1" vs time ranges like "9:10-9:40"
  if (/^\d{1,2}$/.test(trimmed)) {
    return `Period ${trimmed}`;
  }
  return trimmed.slice(0, 40);
}

export function parseOneRosterBundle(
  filesByName: Record<string, string>,
  fallbackGrade: GradeLevel
): OneRosterBundleResult {
  const warnings: string[] = [];
  const loadedFiles: string[] = [];

  const normalizedFiles: Record<string, string> = {};
  Object.entries(filesByName).forEach(([fileName, content]) => {
    const base = fileName.toLowerCase().trim();
    loadedFiles.push(fileName);
    if (base.includes('classes')) normalizedFiles.classes = content;
    else if (base.includes('courses')) normalizedFiles.courses = content;
    else if (base.includes('users')) normalizedFiles.users = content;
    else if (base.includes('enrollments')) normalizedFiles.enrollments = content;
    else if (base.includes('academicsessions') || base.includes('sessions')) {
      normalizedFiles.academicSessions = content;
    } else if (base.includes('orgs')) normalizedFiles.orgs = content;
    else if (!normalizedFiles.classes) {
      // Fallback: treat single uploaded CSV as classes.csv if headers match
      normalizedFiles.classes = content;
    }
  });

  // 1. Optional orgs.csv
  const orgNameById = new Map<string, string>();
  if (normalizedFiles.orgs) {
    const parsed = parseDelimitedText(normalizedFiles.orgs);
    const map = toHeaderIndexMap(parsed.headers);
    parsed.rows.forEach((row) => {
      const id = getField(row, map, ['sourcedId']);
      const name = getField(row, map, ['name']);
      if (id && name) orgNameById.set(id, name);
    });
  }

  // 2. Optional courses.csv
  const courseById = new Map<
    string,
    { title: string; grades: string; subjects: string }
  >();
  if (normalizedFiles.courses) {
    const parsed = parseDelimitedText(normalizedFiles.courses);
    const map = toHeaderIndexMap(parsed.headers);
    parsed.rows.forEach((row) => {
      const id = getField(row, map, ['sourcedId']);
      if (!id) return;
      courseById.set(id, {
        title: getField(row, map, ['title']),
        grades: getField(row, map, ['grades']),
        subjects: getField(row, map, ['subjects']),
      });
    });
  }

  // 3. Optional users.csv (teachers)
  const teacherById = new Map<string, OneRosterTeacherOption>();
  if (normalizedFiles.users) {
    const parsed = parseDelimitedText(normalizedFiles.users);
    const map = toHeaderIndexMap(parsed.headers);
    parsed.rows.forEach((row) => {
      const id = getField(row, map, ['sourcedId']);
      const role = getField(row, map, ['role']).toLowerCase();
      const status = getField(row, map, ['status']).toLowerCase();
      if (!id || status === 'tobedeleted') return;
      if (role && role !== 'teacher' && role !== 'administrator') return;

      const given = getField(row, map, ['givenName', 'firstName']);
      const family = getField(row, map, ['familyName', 'lastName']);
      const email = getField(row, map, ['email']);
      const fullName = [given, family].filter(Boolean).join(' ').trim() || email || id;
      teacherById.set(id, { sourcedId: id, name: fullName, email });
    });
  }

  // 4. Optional enrollments.csv (teacher -> classSourcedId)
  const teachersForClass = new Map<string, string[]>();
  if (normalizedFiles.enrollments) {
    const parsed = parseDelimitedText(normalizedFiles.enrollments);
    const map = toHeaderIndexMap(parsed.headers);
    parsed.rows.forEach((row) => {
      const role = getField(row, map, ['role']).toLowerCase();
      const status = getField(row, map, ['status']).toLowerCase();
      if (status === 'tobedeleted') return;
      if (role !== 'teacher') return;

      const classId = getField(row, map, ['classSourcedId']);
      const userId = getField(row, map, ['userSourcedId']);
      if (!classId || !userId) return;
      const existing = teachersForClass.get(classId) ?? [];
      if (!existing.includes(userId)) {
        existing.push(userId);
        teachersForClass.set(classId, existing);
      }
    });
  }

  // 5. Optional academicSessions.csv
  const sessions: OneRosterAcademicSession[] = [];
  if (normalizedFiles.academicSessions) {
    const parsed = parseDelimitedText(normalizedFiles.academicSessions);
    const map = toHeaderIndexMap(parsed.headers);
    parsed.rows.forEach((row) => {
      const status = getField(row, map, ['status']).toLowerCase();
      if (status === 'tobedeleted') return;
      const sourcedId = getField(row, map, ['sourcedId']);
      const title = getField(row, map, ['title']);
      const type = getField(row, map, ['type']);
      const startDate = getField(row, map, ['startDate']);
      const endDate = getField(row, map, ['endDate']);
      if (title && startDate) {
        sessions.push({ sourcedId, title, type, startDate, endDate });
      }
    });
  }

  // 6. classes.csv (required for class schedule import)
  const classes: OneRosterParsedClass[] = [];
  if (!normalizedFiles.classes) {
    warnings.push(
      'Missing classes.csv. Please include OneRoster classes.csv to extract class schedules and bell periods.'
    );
  } else {
    const parsed = parseDelimitedText(normalizedFiles.classes);
    const map = toHeaderIndexMap(parsed.headers);

    if (map.title === undefined && map.classcode === undefined) {
      warnings.push(
        'classes.csv does not appear to contain a standard OneRoster "title" column.'
      );
    }

    parsed.rows.forEach((row, idx) => {
      const status = getField(row, map, ['status']).toLowerCase();
      if (status === 'tobedeleted') return;

      const sourcedId = getField(row, map, ['sourcedId']) || `cls-${idx}`;
      const courseId = getField(row, map, ['courseSourcedId']);
      const courseInfo = courseId ? courseById.get(courseId) : undefined;

      const rawTitle =
        getField(row, map, ['title']) ||
        courseInfo?.title ||
        getField(row, map, ['classCode']);
      if (!rawTitle) return;

      const rawGrades =
        getField(row, map, ['grades']) || courseInfo?.grades || '';
      const parsedGrades = normalizeOneRosterGrades(rawGrades);
      const targetGrades =
        parsedGrades.length > 0 ? parsedGrades : [fallbackGrade];

      const subjectsHint =
        getField(row, map, ['subjects']) || courseInfo?.subjects || '';
      const rawPeriods = getField(row, map, [
        'periods',
        'period',
        'bellTime',
        'time',
      ]);
      const schoolId = getField(row, map, ['schoolSourcedId']);
      const schoolName = schoolId ? orgNameById.get(schoolId) : undefined;

      const teacherIds = teachersForClass.get(sourcedId) ?? [];
      const teacherNames = teacherIds
        .map((tid) => teacherById.get(tid)?.name)
        .filter((n): n is string => Boolean(n));

      targetGrades.forEach((grade) => {
        classes.push({
          tempId: `or-${sourcedId}-${grade}-${idx}`,
          included: true,
          sourcedId,
          title: rawTitle.slice(0, 80),
          grade,
          timeLabel: cleanPeriodLabel(rawPeriods),
          defaultTheme: guessThemeFromTitle(rawTitle, subjectsHint),
          teacherIds,
          teacherNames,
          schoolName,
        });
      });
    });
  }

  const usedTeachers = Array.from(teacherById.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return {
    classes,
    teachers: usedTeachers,
    sessions,
    loadedFiles,
    warnings,
  };
}

export function oneRosterClassesToSubjectBlocks(
  parsedClasses: OneRosterParsedClass[]
): SubjectBlock[] {
  const seenNames = new Map<string, number>();

  return parsedClasses
    .filter((c) => c.included && c.title.trim())
    .map((c, idx) => {
      const slugBase = c.title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || `subject-${idx}`;

      const count = seenNames.get(slugBase) ?? 0;
      seenNames.set(slugBase, count + 1);
      const id = count === 0 ? slugBase : `${slugBase}-${count + 1}`;

      return {
        id,
        name: c.title.trim().slice(0, 80),
        timeLabel: c.timeLabel.trim().slice(0, 40),
        defaultTheme: c.defaultTheme,
        visible: true,
        order: idx,
      };
    });
}

export function parseICSNonSchoolDays(icsText: string): ParsedICSEvent[] {
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events: ParsedICSEvent[] = [];
  let inEvent = false;
  let dtStart = '';
  let summary = '';

  const nonSchoolRegex =
    /holiday|break|no\s*school|institute|in-?service|pd\s*day|professional|thanksgiving|winter|spring|veteran|mlk|president|memorial|labor|conference|closed/i;

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      dtStart = '';
      summary = '';
    } else if (line === 'END:VEVENT') {
      if (inEvent && dtStart && summary) {
        const match = dtStart.match(/^(\d{4})(\d{2})(\d{2})/);
        if (match) {
          const iso = `${match[1]}-${match[2]}-${match[3]}`;
          const label = summary
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';')
            .replace(/\\n/g, ' ')
            .trim()
            .slice(0, 120);
          if (label) {
            events.push({
              tempId: `ics-${iso}-${idx}`,
              included: nonSchoolRegex.test(label),
              date: iso,
              label,
            });
          }
        }
      }
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith('DTSTART')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) dtStart = line.slice(colonIdx + 1).trim();
      } else if (line.startsWith('SUMMARY')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) summary = line.slice(colonIdx + 1).trim();
      }
    }
  });

  // Deduplicate by date+label and sort chronologically
  const unique = new Map<string, ParsedICSEvent>();
  events.forEach((ev) => {
    const key = `${ev.date}::${ev.label.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, ev);
  });

  return Array.from(unique.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export const SAMPLE_ONEROSTER_CLASSES_CSV = [
  'sourcedId,status,title,grades,courseSourcedId,classCode,schoolSourcedId,termSourcedIds,subjects,periods',
  'cls-101,active,Character Strong,01,crs-sel-1,SEL-101,milford-gs,2026-27,SEL,9:10-9:40',
  'cls-102,active,Arts & Letters,01,crs-ela-1,ELA-101,milford-gs,2026-27,ELA,9:45-10:45',
  'cls-103,active,Everyday Math,01,crs-mth-1,MTH-101,milford-gs,2026-27,Mathematics,10:50-11:50',
  'cls-104,active,UFLI Foundations,01,crs-phn-1,PHN-101,milford-gs,2026-27,Phonics,12:35-1:10',
  'cls-105,active,Science,01,crs-sci-1,SCI-101,milford-gs,2026-27,Science,1:15-1:50',
  'cls-106,active,Social Studies,01,crs-ss-1,SS-101,milford-gs,2026-27,Social Studies,1:55-2:30',
].join('\n');
