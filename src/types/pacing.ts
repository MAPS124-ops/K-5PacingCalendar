export type GradeLevel = 'K' | '1' | '2' | '3' | '4' | '5';

export type ViewTab = 'daily' | 'weekly' | 'pacing' | 'builder';

export type CardTheme = 'navy' | 'teal' | 'indigo' | 'plum' | 'slate';

export interface GradeMeta {
  id: GradeLevel;
  label: string;
  shortLabel: string;
}

export interface SubjectBlock {
  id: string;
  name: string;
  timeLabel: string;
  defaultTheme: CardTheme;
  visible: boolean;
  order: number;
}

export interface LessonItem {
  id: string;
  grade: GradeLevel;
  subjectId: string;
  date: string; // YYYY-MM-DD
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
  themeOverride?: CardTheme;
  isMaster?: boolean;
}

export interface NonSchoolDay {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  isMaster?: boolean;
}

export interface TeacherProfile {
  name: string;
  school: string;
  room: string;
  subNotes: string;
  roleMode: 'editor' | 'viewer';
}

export interface SchoolGovernance {
  schoolId: 'milford_grade_school';
  schoolName: string;
  lockTeacherSchedules: boolean;
  lockCurriculumUploads: boolean;
  requireAssignedRoster?: boolean;
}

export interface TeacherRosterAssignment {
  rosterId: string;
  teacherEmail: string;
  teacherName: string;
  assignedGrades: GradeLevel[];
  assignedSubjects: string[]; // `${grade}:${subjectId}`
}

export interface LessonProgressRecord {
  lessonId: string;
  completed: boolean;
  notes: string;
}

export interface PacingAppState {
  profile: TeacherProfile;
  schedulesByGrade: Record<GradeLevel, SubjectBlock[]>;
  lessons: LessonItem[];
  nonSchoolDays: NonSchoolDay[];
}
