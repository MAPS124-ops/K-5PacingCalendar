import { GradeLevel, LessonItem, NonSchoolDay, SubjectBlock } from '../types/pacing';
import { addSchoolDaysISO, isSchoolDayISO, toISODate } from './dateUtils';

export interface ParsedSpreadsheet {
  headers: string[];
  rows: string[][];
  delimiter: ',' | '\t' | ';';
}

export interface ColumnMapping {
  unitTitle: number | null;
  lessonTitle: number | null;
  date: number | null;
  subject: number | null;
  standards: number | null;
  bullets: number | null;
  slidesUrl: number | null;
  unitResourcesUrl: number | null;
  externalUrl: number | null;
  prepFlag: number | null;
  notes: number | null;
}

export type SchedulingMode = 'use-file-dates' | 'auto-pace';
export type CadencePattern = 'daily' | 'mwf' | 'tuth';

export interface DraftImportedLesson {
  tempId: string;
  included: boolean;
  grade: GradeLevel;
  subjectId: string;
  date: string;
  unitTitle: string;
  lessonTitle: string;
  bullets?: string[];
  standards?: string;
  slidesUrl?: string;
  unitResourcesLabel?: string;
  unitResourcesUrl?: string;
  externalUrl?: string;
  prepFlag: boolean;
  notes: string;
}

function detectDelimiter(sample: string): ',' | '\t' | ';' {
  const firstLine = sample.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  if (tabCount >= commaCount && tabCount >= semiCount && tabCount > 0) return '\t';
  if (semiCount > commaCount && semiCount > 0) return ';';
  return ',';
}

export function parseDelimitedText(rawText: string): ParsedSpreadsheet {
  const cleaned = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    return { headers: [], rows: [], delimiter: ',' };
  }

  const delimiter = detectDelimiter(cleaned);
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(cell.trim());
        cell = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(cell.trim());
        matrix.push(row);
        row = [];
        cell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(cell.trim());
        matrix.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    matrix.push(row);
  }

  const nonEmptyRows = matrix.filter((r) => r.some((val) => val.trim().length > 0));
  if (nonEmptyRows.length === 0) {
    return { headers: [], rows: [], delimiter };
  }

  const maxCols = Math.max(...nonEmptyRows.map((r) => r.length));
  const padded = nonEmptyRows.map((r) => {
    const copy = [...r];
    while (copy.length < maxCols) copy.push('');
    return copy;
  });

  const headers = padded[0].map((h, idx) => h || `Column ${idx + 1}`);
  const rows = padded.slice(1);

  return { headers, rows, delimiter };
}

export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase().trim());

  const findCol = (patterns: RegExp[]): number | null => {
    for (const pat of patterns) {
      const idx = lower.findIndex((h) => pat.test(h));
      if (idx !== -1) return idx;
    }
    return null;
  };

  const unitCol = findCol([
    /^(unit|module|week|chapter|section|unit\s*\/\s*module|unit\s*title)$/,
    /unit|module|week|chapter|lesson\s*#|lesson\s*num/,
  ]);

  let lessonCol = findCol([
    /^(lesson\s*title|lesson\s*focus|focus|topic|lesson|title|objective)$/,
    /lesson|topic|focus|title|skill|activity/,
  ]);
  if (lessonCol === unitCol) {
    const alt = lower.findIndex(
      (h, idx) => idx !== unitCol && /lesson|topic|focus|title|skill|objective/.test(h)
    );
    lessonCol = alt !== -1 ? alt : unitCol;
  }

  return {
    unitTitle: unitCol,
    lessonTitle: lessonCol,
    date: findCol([/^date$/, /teach\s*date|scheduled|day\s*date|date/]),
    subject: findCol([/^subject$/, /program|curriculum|course|subject/]),
    standards: findCol([/standard|ccss|teks|ngss|sel/]),
    bullets: findCol([/bullet|book|text|subtopic|detail/]),
    slidesUrl: findCol([/slide|deck|presentation/]),
    unitResourcesUrl: findCol([/resource|folder|drive/]),
    externalUrl: findCol([/portal|external|curriculum\s*url|^url$|^link$/]),
    prepFlag: findCol([/prep|printable|copies/]),
    notes: findCol([/note|instruction|material|comment/]),
  };
}

export function normalizeFlexibleDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // MM/DD/YYYY or M/D/YYYY or MM-DD-YYYY
  const slashMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const m = Number(slashMatch[1]);
    const d = Number(slashMatch[2]);
    let y = Number(slashMatch[3]);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Fallback JS Date parse for "Oct 21, 2026" etc.
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2100) {
    return toISODate(parsed);
  }

  return null;
}

export function resolveSubjectId(
  rawSubject: string,
  subjects: SubjectBlock[],
  fallbackSubjectId: string
): string {
  const val = rawSubject.trim().toLowerCase();
  if (!val) return fallbackSubjectId;

  const exact = subjects.find(
    (s) => s.id.toLowerCase() === val || s.name.toLowerCase() === val
  );
  if (exact) return exact.id;

  const aliasMap: Array<{ test: RegExp; targetIds: string[]; nameHint: string }> = [
    { test: /math|everyday/, targetIds: ['everyday-math'], nameHint: 'math' },
    { test: /arts|letters|ela|reading|wit|wisdom/, targetIds: ['arts-letters'], nameHint: 'arts' },
    { test: /ufli|phonics|word\s*study|foundations/, targetIds: ['ufli-foundations'], nameHint: 'ufli' },
    { test: /character|sel|social\s*emotional/, targetIds: ['character-strong'], nameHint: 'character' },
    { test: /science|ngss|stem/, targetIds: ['science'], nameHint: 'science' },
    { test: /social\s*studies|history|civics/, targetIds: ['social-studies'], nameHint: 'social' },
  ];

  for (const entry of aliasMap) {
    if (entry.test.test(val)) {
      const match = subjects.find(
        (s) =>
          entry.targetIds.includes(s.id) ||
          s.name.toLowerCase().includes(entry.nameHint)
      );
      if (match) return match.id;
    }
  }

  const partial = subjects.find(
    (s) =>
      s.name.toLowerCase().includes(val) || val.includes(s.name.toLowerCase())
  );
  return partial ? partial.id : fallbackSubjectId;
}

function getNextCadenceDate(
  startDateISO: string,
  stepIndex: number,
  cadence: CadencePattern,
  nonSchoolDays: NonSchoolDay[]
): string {
  if (cadence === 'daily') {
    return addSchoolDaysISO(startDateISO, stepIndex, nonSchoolDays);
  }

  const allowedDows = cadence === 'mwf' ? [1, 3, 5] : [2, 4];
  let current = startDateISO;
  let found = 0;
  let guard = 0;

  while (guard < 400) {
    const dt = new Date(`${current}T12:00:00`);
    const dow = dt.getDay();
    if (allowedDows.includes(dow) && isSchoolDayISO(current, nonSchoolDays)) {
      if (found === stepIndex) return current;
      found++;
    }
    const nextDt = new Date(dt);
    nextDt.setDate(nextDt.getDate() + 1);
    current = toISODate(nextDt);
    guard++;
  }
  return startDateISO;
}

export function buildDraftLessonsFromSpreadsheet(params: {
  rows: string[][];
  mapping: ColumnMapping;
  grade: GradeLevel;
  defaultSubjectId: string;
  subjects: SubjectBlock[];
  schedulingMode: SchedulingMode;
  startDate: string;
  cadence: CadencePattern;
  nonSchoolDays: NonSchoolDay[];
}): DraftImportedLesson[] {
  const {
    rows,
    mapping,
    grade,
    defaultSubjectId,
    subjects,
    schedulingMode,
    startDate,
    cadence,
    nonSchoolDays,
  } = params;

  const subjectStepCounter = new Map<string, number>();
  const drafts: DraftImportedLesson[] = [];

  rows.forEach((row, idx) => {
    const rawUnit =
      mapping.unitTitle !== null ? (row[mapping.unitTitle] ?? '').trim() : '';
    const rawLesson =
      mapping.lessonTitle !== null ? (row[mapping.lessonTitle] ?? '').trim() : '';

    if (!rawUnit && !rawLesson) return;

    const unitTitle = (rawUnit || rawLesson).slice(0, 140);
    const lessonTitle = (rawLesson || rawUnit).slice(0, 180);

    const rawSubject =
      mapping.subject !== null ? (row[mapping.subject] ?? '').trim() : '';
    const subjectId = rawSubject
      ? resolveSubjectId(rawSubject, subjects, defaultSubjectId)
      : defaultSubjectId;

    const step = subjectStepCounter.get(subjectId) ?? 0;
    let resolvedDate: string | null = null;
    if (schedulingMode === 'use-file-dates' && mapping.date !== null) {
      resolvedDate = normalizeFlexibleDate(row[mapping.date] ?? '');
    }
    if (!resolvedDate) {
      resolvedDate = getNextCadenceDate(startDate, step, cadence, nonSchoolDays);
      subjectStepCounter.set(subjectId, step + 1);
    }

    const rawBullets =
      mapping.bullets !== null ? (row[mapping.bullets] ?? '').trim() : '';
    const bullets = rawBullets
      ? rawBullets
          .split(/[|;\n]/)
          .map((b) => b.trim().slice(0, 200))
          .filter(Boolean)
          .slice(0, 10)
      : undefined;

    const rawPrep =
      mapping.prepFlag !== null ? (row[mapping.prepFlag] ?? '').trim().toLowerCase() : '';
    const prepFlag = ['true', 'yes', 'y', '1', 'p', 'x'].includes(rawPrep);

    const unitResourcesUrl =
      mapping.unitResourcesUrl !== null
        ? (row[mapping.unitResourcesUrl] ?? '').trim().slice(0, 500) || undefined
        : undefined;

    drafts.push({
      tempId: `draft-${idx}-${Date.now()}`,
      included: true,
      grade,
      subjectId,
      date: resolvedDate,
      unitTitle,
      lessonTitle,
      bullets,
      standards:
        mapping.standards !== null
          ? (row[mapping.standards] ?? '').trim().slice(0, 160) || undefined
          : undefined,
      slidesUrl:
        mapping.slidesUrl !== null
          ? (row[mapping.slidesUrl] ?? '').trim().slice(0, 500) || undefined
          : undefined,
      unitResourcesLabel: unitResourcesUrl ? 'UNIT RESOURCES' : undefined,
      unitResourcesUrl,
      externalUrl:
        mapping.externalUrl !== null
          ? (row[mapping.externalUrl] ?? '').trim().slice(0, 500) || undefined
          : undefined,
      prepFlag,
      notes:
        mapping.notes !== null
          ? (row[mapping.notes] ?? '').trim().slice(0, 2000)
          : '',
    });
  });

  return drafts;
}

export function draftsToLessonItems(drafts: DraftImportedLesson[]): LessonItem[] {
  const stamp = Date.now();
  return drafts
    .filter((d) => d.included && d.unitTitle.trim() && d.lessonTitle.trim())
    .map((d, idx) => ({
      id: `imp-${d.grade}-${stamp}-${idx}`,
      grade: d.grade,
      subjectId: d.subjectId,
      date: d.date,
      unitTitle: d.unitTitle.trim().slice(0, 140),
      lessonTitle: d.lessonTitle.trim().slice(0, 180),
      bullets: d.bullets,
      standards: d.standards,
      slidesUrl: d.slidesUrl,
      unitResourcesLabel: d.unitResourcesLabel,
      unitResourcesUrl: d.unitResourcesUrl,
      externalUrl: d.externalUrl,
      prepFlag: d.prepFlag,
      notes: d.notes.slice(0, 2000),
      completed: false,
    }));
}

export const SAMPLE_TEMPLATES: Record<
  'everyday-math' | 'arts-letters' | 'ufli' | 'multi-subject',
  { label: string; defaultSubjectId: string; csv: string }
> = {
  'everyday-math': {
    label: 'Everyday Math Unit CSV',
    defaultSubjectId: 'everyday-math',
    csv: [
      'Unit/Lesson,Lesson Focus,Standards,Prep,Notes',
      'Lesson 3-1,Visualizing Number Stories,CCSS.MATH.1.OA.1,No,Use part-part-total mats on back shelf',
      'Lesson 3-2,Solving Change-to-More Stories,CCSS.MATH.1.OA.1,Yes,Print Exit Ticket p. 54',
      'Lesson 3-3,Counting On with Number Grids,CCSS.MATH.1.NBT.1,No,Partner dry-erase boards',
      'Lesson 3-4,Unit 3 Open Response,CCSS.MATH.1.OA.6,Yes,Privacy folders required',
    ].join('\n'),
  },
  'arts-letters': {
    label: 'Arts & Letters Module CSV',
    defaultSubjectId: 'arts-letters',
    csv: [
      'Module/Lesson,Stage,Anchor Text,Standards,Prep,Slides URL,Notes',
      'Module 2 Lesson 1,Wonder,Creature Features,ELA.1.RI.1,Yes,https://docs.google.com/presentation,Introduce Notice & Wonder chart',
      'Module 2 Lesson 2,Organize,Creature Features,ELA.1.RI.2,No,https://docs.google.com/presentation,Record key animal traits',
      'Module 2 Lesson 3,Reveal,Creature Features,ELA.1.RI.4,Yes,https://docs.google.com/presentation,Vocabulary cards: camouflage',
      'Module 2 Lesson 4,Distill,Creature Features,ELA.1.W.2,No,https://docs.google.com/presentation,Shared informative paragraph',
    ].join('\n'),
  },
  ufli: {
    label: 'UFLI Foundations CSV',
    defaultSubjectId: 'ufli-foundations',
    csv: [
      'Lesson,Phonics Focus,Standards,Slides URL,Notes',
      'UFLI Lesson 48 Day 1,ch /ch/,RF.1.3a,https://ufli.education.ufl.edu/foundations/toolbox/,Blending drill with magnetic tiles',
      'UFLI Lesson 48 Day 2,ch /ch/ Connected Text,RF.1.3a,https://ufli.education.ufl.edu/foundations/toolbox/,Decodable passage & dictation',
      'UFLI Lesson 49 Day 1,wh /w/,RF.1.3a,https://ufli.education.ufl.edu/foundations/toolbox/,Heart word review: where & when',
      'UFLI Lesson 49 Day 2,wh /w/ Connected Text,RF.1.3a,https://ufli.education.ufl.edu/foundations/toolbox/,Partner fluency read',
    ].join('\n'),
  },
  'multi-subject': {
    label: 'Multi-Subject Master CSV',
    defaultSubjectId: 'arts-letters',
    csv: [
      'Date,Subject,Unit/Module,Lesson Title,Standards,Prep,Notes',
      '2026-10-26,Character Strong,Responsibility - Week 3,Own Your Actions,SEL.1A,No,Morning circle prompt',
      '2026-10-26,Arts & Letters,Module 2 Lesson 1,Wonder,ELA.1.RI.1,Yes,Prep anchor chart',
      '2026-10-26,Everyday Math,Lesson 3-1,Visualizing Number Stories,CCSS.MATH.1.OA.1,No,Part-part-total mats',
      '2026-10-26,Science,Unit Hummingbirds,Day 4: Pollination Lab,NGSS.1.LS1,Yes,Set out nectar cups',
    ].join('\n'),
  },
};
