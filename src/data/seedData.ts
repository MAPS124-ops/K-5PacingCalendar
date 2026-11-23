import {
  GradeLevel,
  GradeMeta,
  LessonItem,
  NonSchoolDay,
  PacingAppState,
  SubjectBlock,
} from '../types/pacing';
import { addSchoolDaysISO } from '../utils/dateUtils';

export const GRADES: GradeMeta[] = [
  { id: 'K', label: 'Kindergarten', shortLabel: 'K' },
  { id: '1', label: '1st Grade', shortLabel: '1st' },
  { id: '2', label: '2nd Grade', shortLabel: '2nd' },
  { id: '3', label: '3rd Grade', shortLabel: '3rd' },
  { id: '4', label: '4th Grade', shortLabel: '4th' },
  { id: '5', label: '5th Grade', shortLabel: '5th' },
];

export const DEFAULT_ANCHOR_DATE = '2026-10-21';

export const INITIAL_NON_SCHOOL_DAYS: NonSchoolDay[] = [
  { id: 'nsd-1', date: '2026-10-30', label: 'District PD Day (No Students)' },
  { id: 'nsd-2', date: '2026-11-11', label: 'Veterans Day' },
  { id: 'nsd-3', date: '2026-11-26', label: 'Thanksgiving Break' },
  { id: 'nsd-4', date: '2026-11-27', label: 'Thanksgiving Break' },
];

function createDefaultSchedule(grade: GradeLevel): SubjectBlock[] {
  const isFirst = grade === '1';
  return [
    {
      id: 'character-strong',
      name: 'Character Strong',
      timeLabel: isFirst ? '9:10-9:40' : '8:45-9:15',
      defaultTheme: 'navy',
      visible: true,
      order: 0,
    },
    {
      id: 'arts-letters',
      name: 'Arts & Letters',
      timeLabel: isFirst ? '9:45-10:45' : '9:20-10:25',
      defaultTheme: 'navy',
      visible: true,
      order: 1,
    },
    {
      id: 'science',
      name: 'Science',
      timeLabel: isFirst ? '' : '1:10-1:50',
      defaultTheme: 'navy',
      visible: true,
      order: 2,
    },
    {
      id: 'social-studies',
      name: 'Social Studies',
      timeLabel: isFirst ? '' : '1:55-2:30',
      defaultTheme: 'navy',
      visible: true,
      order: 3,
    },
    {
      id: 'everyday-math',
      name: 'Everyday Math',
      timeLabel: isFirst ? '' : '10:35-11:35',
      defaultTheme: 'teal',
      visible: true,
      order: 4,
    },
    {
      id: 'ufli-foundations',
      name: grade === '3' || grade === '4' || grade === '5' ? 'Word Study & Fluency' : 'UFLI Foundations',
      timeLabel: isFirst ? '' : '12:30-1:05',
      defaultTheme: 'navy',
      visible: true,
      order: 5,
    },
  ];
}

interface LessonTemplate {
  subjectId: string;
  unitTitle: string;
  lessonTitle: string;
  bullets?: string[];
  standards?: string;
  externalUrl?: string;
  prepFlag?: boolean;
  unitResourcesLabel?: string;
  unitResourcesUrl?: string;
  slidesUrl?: string;
  notes: string;
  completed?: boolean;
}

function generateGradeSequence(
  grade: GradeLevel,
  startDate: string,
  nonSchoolDays: NonSchoolDay[]
): LessonItem[] {
  const lessons: LessonItem[] = [];

  const gradeSpecs: Record<
    GradeLevel,
    {
      charTopic: string;
      elaModule: string;
      elaBook: string;
      scienceUnit: string;
      ssUnit: string;
      mathUnit: string;
      phonicsStart: number;
      phonicsFocuses: string[];
    }
  > = {
    K: {
      charTopic: 'Kindness',
      elaModule: 'Module 1',
      elaBook: 'The Little Red Hen',
      scienceUnit: 'Unit Weather & Seasons',
      ssUnit: 'My Community Helpers',
      mathUnit: 'Section 2',
      phonicsStart: 12,
      phonicsFocuses: ['m /m/', 's /s/', 'a /ă/', 't /t/', 'p /p/', 'n /n/', 'i /ĭ/', 'c /k/'],
    },
    '1': {
      charTopic: 'Responsibility',
      elaModule: 'Module 1',
      elaBook: 'The Book Rescuer',
      scienceUnit: 'Unit Hummingbirds',
      ssUnit: 'Rules & Citizenship',
      mathUnit: 'Unit 2',
      phonicsStart: 43,
      phonicsFocuses: [
        'digraph ck /k/',
        'digraph ck review',
        'sh /sh/',
        'sh /sh/ Day 2',
        'th /th/',
        'ch /ch/',
        'wh /w/',
        'digraphs review',
      ],
    },
    '2': {
      charTopic: 'Respect',
      elaModule: 'Module 1',
      elaBook: 'A Season of Change',
      scienceUnit: 'Unit Matter & Properties',
      ssUnit: 'Maps & Landforms',
      mathUnit: 'Unit 3',
      phonicsStart: 68,
      phonicsFocuses: [
        'ai /ā/',
        'ay /ā/',
        'ee /ē/',
        'ea /ē/',
        'oa /ō/',
        'ow /ō/',
        'igh /ī/',
        'Vowel Teams Review',
      ],
    },
    '3': {
      charTopic: 'Perseverance',
      elaModule: 'Module 2',
      elaBook: 'Ocean Sunlight',
      scienceUnit: 'Unit Force & Motion',
      ssUnit: 'Regions of North America',
      mathUnit: 'Unit 3',
      phonicsStart: 94,
      phonicsFocuses: [
        'Prefix un- & re-',
        'Prefix pre- & dis-',
        'Suffix -ful & -less',
        'Suffix -ment & -ness',
        'Multisyllabic VCV',
        'Multisyllabic VCCV',
        'Root struct',
        'Morphology Check',
      ],
    },
    '4': {
      charTopic: 'Empathy',
      elaModule: 'Module 2',
      elaBook: 'Hatchet Excerpts',
      scienceUnit: 'Unit Earth Processes',
      ssUnit: 'State History & Civics',
      mathUnit: 'Unit 3',
      phonicsStart: 108,
      phonicsFocuses: [
        'Greek Root geo',
        'Greek Root bio',
        'Latin Root port',
        'Latin Root rupt',
        'Suffix -tion / -sion',
        'Affix Mastery Lab',
        'Context Clues Study',
        'Morphology Assessment',
      ],
    },
    '5': {
      charTopic: 'Leadership',
      elaModule: 'Module 2',
      elaBook: 'Phantom Tollbooth',
      scienceUnit: 'Unit Ecosystems & Energy',
      ssUnit: 'Early American Colonies',
      mathUnit: 'Unit 3',
      phonicsStart: 118,
      phonicsFocuses: [
        'Root spec / dict',
        'Root cred / aud',
        'Prefix inter- / trans-',
        'Suffix -ology / -graph',
        'Academic Word Families',
        'Figurative Idioms',
        'Syntax & Clauses',
        'Word Study Synthesis',
      ],
    },
  };

  const spec = gradeSpecs[grade];
  const totalSchoolDays = 34; // Covers mid-Oct through early Dec 2026

  for (let i = 0; i < totalSchoolDays; i++) {
    const dateISO = addSchoolDaysISO(startDate, i, nonSchoolDays);
    const isExactTargetDay = dateISO === '2026-10-21';

    // 1. Character Strong (Mon/Wed/Fri or daily)
    if (i % 2 === 0 || isExactTargetDay) {
      const weekNum = Math.floor(i / 5) + 1;
      const charActions = [
        'Mindful Listening',
        'Distraction Action',
        'Keeping Promises',
        'Teamwork Circle',
        'Goal Check-In',
      ];
      const actionTitle =
        grade === '1' && isExactTargetDay
          ? 'Distraction Action'
          : charActions[i % charActions.length];
      const unitTitle =
        grade === '1' && isExactTargetDay
          ? 'Responsibility - Week 2'
          : `${spec.charTopic} - Week ${weekNum}`;

      lessons.push({
        id: `${grade}-cs-${i}`,
        grade,
        subjectId: 'character-strong',
        date: dateISO,
        unitTitle,
        lessonTitle: actionTitle,
        standards: 'SEL.1A · Self-Management & Focus',
        notes:
          grade === '1' && isExactTargetDay
            ? 'Read morning scenario card on managing classroom distractions. Have students practice two-minute quiet partner share.'
            : `Morning circle discussion on ${spec.charTopic.toLowerCase()}. Keep reflection journals ready on front table.`,
        completed: dateISO < '2026-10-21',
      });
    }

    // 2. Arts & Letters (Daily)
    const elaLessonNum = 23 + i;
    const elaSteps = ['Wonder', 'Organize', 'Reveal', 'Distill', 'Know'];
    const stepName =
      grade === '1' && isExactTargetDay ? 'Organize' : elaSteps[i % elaSteps.length];

    lessons.push({
      id: `${grade}-ela-${i}`,
      grade,
      subjectId: 'arts-letters',
      date: dateISO,
      unitTitle: `${spec.elaModule} Lesson ${elaLessonNum}`,
      lessonTitle: stepName,
      bullets: [spec.elaBook],
      standards: `ELA.${grade}.RL.2 · Key Ideas & Story Structure`,
      externalUrl: 'https://curriculum.greatminds.org',
      prepFlag: i % 3 === 1 || (grade === '1' && isExactTargetDay),
      slidesUrl: 'https://docs.google.com/presentation',
      notes:
        grade === '1' && isExactTargetDay
          ? `Prep chart paper for ${spec.elaBook} story sequence map. Print graphic organizer p. 42 for small group table.`
          : `Focus on ${stepName.toLowerCase()} stage with ${spec.elaBook}. Check vocabulary cards prior to read-aloud.`,
      completed: dateISO < '2026-10-21',
    });

    // 3. Science (Mon/Wed/Thu/Fri)
    if (i % 5 !== 1 || isExactTargetDay) {
      const sciDayNum = grade === '1' && isExactTargetDay ? 3 : (i % 6) + 1;
      lessons.push({
        id: `${grade}-sci-${i}`,
        grade,
        subjectId: 'science',
        date: dateISO,
        unitTitle: spec.scienceUnit,
        lessonTitle:
          grade === '1' && isExactTargetDay
            ? 'Day 3: Hummingbirds'
            : `Day ${sciDayNum}: ${spec.scienceUnit.replace('Unit ', '')}`,
        standards: `NGSS.${grade}.LS1 · Structure & Function`,
        unitResourcesLabel: 'UNIT RESOURCES',
        unitResourcesUrl: 'https://drive.google.com',
        slidesUrl: 'https://docs.google.com/presentation',
        notes:
          grade === '1' && isExactTargetDay
            ? 'Show hummingbird slow-motion wingbeat video from Unit Resources folder before observation journals.'
            : 'Distribute science observation notebooks and review anchor vocabulary before investigation.',
        completed: dateISO < '2026-10-21',
      });
    }

    // 4. Social Studies (Tue/Thu — intentionally unscheduled on Wed 10/21 for 1st Grade!)
    const dayOfWeek = new Date(`${dateISO}T12:00:00`).getDay();
    if (dayOfWeek === 2 || dayOfWeek === 4) {
      lessons.push({
        id: `${grade}-ss-${i}`,
        grade,
        subjectId: 'social-studies',
        date: dateISO,
        unitTitle: spec.ssUnit,
        lessonTitle: `Lesson ${Math.floor(i / 2) + 1}: Primary Sources & Discussion`,
        standards: `SS.${grade}.C.1 · Civic Engagement`,
        slidesUrl: 'https://docs.google.com/presentation',
        notes: 'Use turn-and-talk prompts on slide 4. Collect exit slips in blue basket.',
        completed: dateISO < '2026-10-21',
      });
    }

    // 5. Everyday Math (Daily, teal theme)
    const mathUnitNum = grade === '1' ? 2 : 3;
    const mathLessonNum = grade === '1' ? 5 + i : 1 + i;
    const isMathProgressCheck =
      (grade === '1' && isExactTargetDay) || mathLessonNum % 12 === 0;
    const mathDisplayLesson =
      grade === '1' && isExactTargetDay ? '2-12' : `${mathUnitNum}-${mathLessonNum}`;

    lessons.push({
      id: `${grade}-math-${i}`,
      grade,
      subjectId: 'everyday-math',
      date: dateISO,
      unitTitle: `Lesson ${mathDisplayLesson}`,
      lessonTitle: isMathProgressCheck
        ? `Unit ${mathUnitNum} Progress Check`
        : `Fluency & Problem Solving (${mathDisplayLesson})`,
      standards: `CCSS.MATH.${grade}.OA · Operations & Algebraic Thinking`,
      externalUrl: 'https://connected.mcgraw-hill.com',
      notes: isMathProgressCheck
        ? 'Administer Unit Progress Check independently. Privacy folders up; read directions aloud for Part A.'
        : 'Warm up with 5-minute mental math fluency slate practice before guided math stations.',
      completed: dateISO < '2026-10-21',
    });

    // 6. UFLI Foundations / Word Study (Daily)
    const ufliLessonNum =
      grade === '1' && isExactTargetDay ? 45 : spec.phonicsStart + Math.floor(i / 2);
    const ufliDay = grade === '1' && isExactTargetDay ? 1 : (i % 2) + 1;
    const phonicsFocus =
      grade === '1' && isExactTargetDay
        ? 'sh /sh/'
        : spec.phonicsFocuses[i % spec.phonicsFocuses.length];

    lessons.push({
      id: `${grade}-ufli-${i}`,
      grade,
      subjectId: 'ufli-foundations',
      date: dateISO,
      unitTitle:
        grade === '3' || grade === '4' || grade === '5'
          ? `Word Study Lesson ${ufliLessonNum} Day ${ufliDay}`
          : `UFLI Lesson ${ufliLessonNum} Day ${ufliDay}`,
      lessonTitle: phonicsFocus,
      standards: `RF.${grade}.3 · Phonics & Word Recognition`,
      externalUrl: 'https://ufli.education.ufl.edu/foundations/toolbox/',
      slidesUrl: 'https://ufli.education.ufl.edu/foundations/toolbox/',
      notes:
        grade === '1' && isExactTargetDay
          ? 'Use magnetic letter tiles for blending drill (sh-i-p, sh-o-p, f-i-sh). Irregular word review: said, what.'
          : `Follow 8-step UFLI routine: visual drill, auditory drill, blending, and connected text decodable passage.`,
      completed: dateISO < '2026-10-21',
    });
  }

  return lessons;
}

export function createInitialAppState(): PacingAppState {
  const nonSchoolDays = INITIAL_NON_SCHOOL_DAYS;
  const grades: GradeLevel[] = ['K', '1', '2', '3', '4', '5'];

  // Start sequence on Monday 2026-10-12 so 2026-10-21 is exact day index 7
  const startDate = '2026-10-12';
  const allLessons: LessonItem[] = [];

  for (const grade of grades) {
    allLessons.push(...generateGradeSequence(grade, startDate, nonSchoolDays));
  }

  return {
    profile: {
      name: 'Spartan Teacher',
      school: 'Milford Grade School',
      room: 'Room 104',
      subNotes:
        'Morning attendance is submitted by 9:05 AM via desktop portal. Lunch count magnets are on the whiteboard. Bus & parent pick-up tags are clipped inside the red Emergency Binder on the desk.',
      roleMode: 'editor',
    },
    schedulesByGrade: {
      K: createDefaultSchedule('K'),
      '1': createDefaultSchedule('1'),
      '2': createDefaultSchedule('2'),
      '3': createDefaultSchedule('3'),
      '4': createDefaultSchedule('4'),
      '5': createDefaultSchedule('5'),
    },
    lessons: allLessons,
    nonSchoolDays,
  };
}
