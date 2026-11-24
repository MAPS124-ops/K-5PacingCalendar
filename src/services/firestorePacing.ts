import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { createInitialAppState } from '../data/seedData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  CardTheme,
  GradeLevel,
  LessonItem,
  LessonProgressRecord,
  NonSchoolDay,
  PacingAppState,
  SchoolGovernance,
  SubjectBlock,
  TeacherProfile,
  TeacherRosterAssignment,
} from '../types/pacing';

export const SCHOOL_ID = 'milford_grade_school' as const;
export const BOOTSTRAP_ADMIN_EMAIL = 'kclark@mpsk12.org';

const VALID_GRADES: GradeLevel[] = ['K', '1', '2', '3', '4', '5'];
const VALID_THEMES: CardTheme[] = ['navy', 'teal', 'indigo', 'plum', 'slate'];

export const DEFAULT_GOVERNANCE: SchoolGovernance = {
  schoolId: SCHOOL_ID,
  schoolName: 'Milford Grade School',
  lockTeacherSchedules: true,
  lockCurriculumUploads: true,
  requireAssignedRoster: false,
};

export function emailToRosterDocId(email: string): string {
  const cleaned = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : `teacher-${Date.now()}`;
}

function sanitizeId(raw: string, maxLen = 128): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : `id-${Date.now()}`;
}

function clampStr(val: string | undefined, maxLen: number): string {
  return (val ?? '').trim().slice(0, maxLen);
}

function sanitizeTheme(theme?: string): CardTheme {
  return VALID_THEMES.includes(theme as CardTheme) ? (theme as CardTheme) : 'navy';
}

function sanitizeGrade(grade?: string): GradeLevel {
  return VALID_GRADES.includes(grade as GradeLevel) ? (grade as GradeLevel) : '1';
}

function buildLessonPayload(uid: string, lesson: LessonItem, isCreate: boolean) {
  const base: Record<string, unknown> = {
    ownerId: uid,
    grade: sanitizeGrade(lesson.grade),
    subjectId: sanitizeId(lesson.subjectId, 64),
    date: clampStr(lesson.date, 10),
    unitTitle: clampStr(lesson.unitTitle, 140) || 'Untitled Unit',
    lessonTitle: clampStr(lesson.lessonTitle, 180) || 'Untitled Lesson',
    notes: (lesson.notes ?? '').slice(0, 2000),
    prepFlag: Boolean(lesson.prepFlag),
    completed: Boolean(lesson.completed),
    updatedAt: serverTimestamp(),
  };

  if (isCreate) {
    base.createdAt = serverTimestamp();
  }

  if (lesson.bullets && lesson.bullets.length > 0) {
    base.bullets = lesson.bullets
      .slice(0, 10)
      .map((b) => clampStr(b, 200))
      .filter(Boolean);
  } else {
    base.bullets = [];
  }

  base.standards = clampStr(lesson.standards, 160);
  base.externalUrl = clampStr(lesson.externalUrl, 500);
  base.unitResourcesLabel = clampStr(lesson.unitResourcesLabel, 60);
  base.unitResourcesUrl = clampStr(lesson.unitResourcesUrl, 500);
  base.slidesUrl = clampStr(lesson.slidesUrl, 500);

  if (lesson.themeOverride) {
    base.themeOverride = sanitizeTheme(lesson.themeOverride);
  }

  return base;
}

function buildMasterLessonPayload(uid: string, lesson: LessonItem, isCreate: boolean) {
  const base: Record<string, unknown> = {
    schoolId: SCHOOL_ID,
    grade: sanitizeGrade(lesson.grade),
    subjectId: sanitizeId(lesson.subjectId, 64),
    date: clampStr(lesson.date, 10),
    unitTitle: clampStr(lesson.unitTitle, 140) || 'Untitled Unit',
    lessonTitle: clampStr(lesson.lessonTitle, 180) || 'Untitled Lesson',
    notes: (lesson.notes ?? '').slice(0, 2000),
    prepFlag: Boolean(lesson.prepFlag),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  };

  if (isCreate) {
    base.createdAt = serverTimestamp();
  }

  if (lesson.bullets && lesson.bullets.length > 0) {
    base.bullets = lesson.bullets
      .slice(0, 10)
      .map((b) => clampStr(b, 200))
      .filter(Boolean);
  } else {
    base.bullets = [];
  }

  base.standards = clampStr(lesson.standards, 160);
  base.externalUrl = clampStr(lesson.externalUrl, 500);
  base.unitResourcesLabel = clampStr(lesson.unitResourcesLabel, 60);
  base.unitResourcesUrl = clampStr(lesson.unitResourcesUrl, 500);
  base.slidesUrl = clampStr(lesson.slidesUrl, 500);

  if (lesson.themeOverride) {
    base.themeOverride = sanitizeTheme(lesson.themeOverride);
  }

  return base;
}

async function commitOperationsInBatches(
  ops: Array<(batch: ReturnType<typeof writeBatch>) => void>,
  pathContext: string
) {
  const CHUNK_SIZE = 380;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((fn) => fn(batch));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, pathContext);
    }
  }
}

export async function checkIsAdminUser(user: User): Promise<boolean> {
  if (
    user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL &&
    user.emailVerified
  ) {
    return true;
  }

  const adminPath = `admins/${sanitizeId(user.uid, 128)}`;
  try {
    const snap = await getDoc(doc(db, adminPath));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function ensureSchoolGovernanceInitialized(
  uid: string
): Promise<void> {
  const path = `schools/${SCHOOL_ID}/config/governance`;
  try {
    const snap = await getDoc(doc(db, path));
    if (!snap.exists()) {
      await setDoc(doc(db, path), {
        schoolId: SCHOOL_ID,
        schoolName: 'Milford Grade School',
        lockTeacherSchedules: true,
        lockCurriculumUploads: true,
        requireAssignedRoster: false,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function ensureUserWorkspaceInitialized(
  uid: string,
  email: string,
  displayName?: string | null,
  isAdmin = false
): Promise<void> {
  const accountPath = `users/${uid}/private/account`;
  const settingsPath = `users/${uid}/workspace/settings`;

  // Read current school governance first to know if teacher schedules/uploads are locked
  let schedulesLocked = false;
  let curriculumLocked = false;
  try {
    const govSnap = await getDoc(doc(db, `schools/${SCHOOL_ID}/config/governance`));
    if (govSnap.exists()) {
      schedulesLocked = Boolean(govSnap.data()?.lockTeacherSchedules);
      curriculumLocked = Boolean(govSnap.data()?.lockCurriculumUploads);
    }
  } catch {
    // Governance might not exist yet
  }

  try {
    const settingsSnap = await getDoc(doc(db, settingsPath));
    if (settingsSnap.exists()) {
      const existingSchool = settingsSnap.data()?.school;
      if (existingSchool === 'Spartan Elementary School' || !existingSchool) {
        try {
          await updateDoc(doc(db, settingsPath), {
            school: 'Milford Grade School',
            updatedAt: serverTimestamp(),
          });
        } catch (updateErr) {
          handleFirestoreError(updateErr, OperationType.UPDATE, settingsPath);
        }
      }
      return;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, settingsPath);
  }

  try {
    const accountSnap = await getDoc(doc(db, accountPath));
    if (!accountSnap.exists()) {
      await setDoc(doc(db, accountPath), {
        ownerId: uid,
        email: clampStr(email, 254),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, accountPath);
  }

  const initial = createInitialAppState();
  const profileName =
    clampStr(displayName || '', 80) ||
    clampStr(email.split('@')[0], 80) ||
    initial.profile.name;

  await seedFullWorkspace(
    uid,
    {
      ...initial,
      profile: {
        ...initial.profile,
        name: profileName,
      },
    },
    {
      skipSchedulesAndDays: !isAdmin && schedulesLocked,
      skipLessons: !isAdmin && curriculumLocked,
    }
  );
}

export async function seedFullWorkspace(
  uid: string,
  state: PacingAppState,
  options?: { skipSchedulesAndDays?: boolean; skipLessons?: boolean }
): Promise<void> {
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  const settingsRef = doc(db, `users/${uid}/workspace/settings`);
  ops.push((batch) =>
    batch.set(settingsRef, {
      ownerId: uid,
      name: clampStr(state.profile.name, 80) || 'Spartan Teacher',
      school: clampStr(state.profile.school, 120) || 'Milford Grade School',
      room: clampStr(state.profile.room, 40),
      subNotes: (state.profile.subNotes ?? '').slice(0, 2000),
      roleMode: state.profile.roleMode === 'viewer' ? 'viewer' : 'editor',
      seeded: true,
      updatedAt: serverTimestamp(),
    })
  );

  if (!options?.skipSchedulesAndDays) {
    for (const grade of VALID_GRADES) {
      const blocks = state.schedulesByGrade[grade] ?? [];
      blocks.forEach((block, idx) => {
        const subjectId = sanitizeId(block.id, 64);
        const docId = sanitizeId(`${grade}_${subjectId}`, 128);
        const ref = doc(db, `users/${uid}/schedules/${docId}`);
        ops.push((batch) =>
          batch.set(ref, {
            ownerId: uid,
            grade,
            subjectId,
            name: clampStr(block.name, 80) || 'Subject',
            timeLabel: clampStr(block.timeLabel, 40),
            defaultTheme: sanitizeTheme(block.defaultTheme),
            visible: Boolean(block.visible),
            order: typeof block.order === 'number' ? block.order : idx,
            updatedAt: serverTimestamp(),
          })
        );
      });
    }

    state.nonSchoolDays.forEach((nsd) => {
      const dayId = sanitizeId(nsd.id, 128);
      const ref = doc(db, `users/${uid}/nonSchoolDays/${dayId}`);
      ops.push((batch) =>
        batch.set(ref, {
          ownerId: uid,
          date: clampStr(nsd.date, 10),
          label: clampStr(nsd.label, 120) || 'Non-School Day',
          createdAt: serverTimestamp(),
        })
      );
    });
  }

  if (!options?.skipLessons) {
    state.lessons.forEach((lesson) => {
      const lessonId = sanitizeId(lesson.id, 128);
      const ref = doc(db, `users/${uid}/lessons/${lessonId}`);
      ops.push((batch) => batch.set(ref, buildLessonPayload(uid, lesson, true)));
    });
  }

  await commitOperationsInBatches(ops, `users/${uid}`);
}

export async function clearAndReplaceWorkspace(
  uid: string,
  state: PacingAppState
): Promise<void> {
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  const collections = ['schedules', 'lessons', 'nonSchoolDays'] as const;
  for (const colName of collections) {
    const colPath = `users/${uid}/${colName}`;
    try {
      const snap = await getDocs(
        query(collection(db, colPath), where('ownerId', '==', uid))
      );
      snap.docs.forEach((d) => {
        ops.push((batch) => batch.delete(d.ref));
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, colPath);
    }
  }

  await commitOperationsInBatches(ops, `users/${uid}`);
  await seedFullWorkspace(uid, state);
}

export function subscribeSchoolMasterData(callbacks: {
  onGovernance: (gov: SchoolGovernance | null) => void;
  onMasterSchedules: (
    schedules: Record<GradeLevel, SubjectBlock[]>,
    hasMasterData: boolean
  ) => void;
  onMasterNonSchoolDays: (days: NonSchoolDay[]) => void;
  onMasterLessons: (lessons: LessonItem[]) => void;
}): () => void {
  const unsubs: Unsubscribe[] = [];

  const govPath = `schools/${SCHOOL_ID}/config/governance`;
  unsubs.push(
    onSnapshot(
      doc(db, govPath),
      (snap) => {
        if (!snap.exists()) {
          callbacks.onGovernance(null);
          return;
        }
        const d = snap.data();
        callbacks.onGovernance({
          schoolId: SCHOOL_ID,
          schoolName: String(d.schoolName ?? 'Milford Grade School'),
          lockTeacherSchedules: Boolean(d.lockTeacherSchedules),
          lockCurriculumUploads: Boolean(d.lockCurriculumUploads),
          requireAssignedRoster: Boolean(d.requireAssignedRoster),
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, govPath);
      }
    )
  );

  const masterSchedulesPath = `schools/${SCHOOL_ID}/schedules`;
  unsubs.push(
    onSnapshot(
      query(
        collection(db, masterSchedulesPath),
        where('schoolId', '==', SCHOOL_ID)
      ),
      (snap) => {
        const grouped: Record<GradeLevel, SubjectBlock[]> = {
          K: [],
          '1': [],
          '2': [],
          '3': [],
          '4': [],
          '5': [],
        };
        snap.docs.forEach((d) => {
          const data = d.data();
          const grade = sanitizeGrade(String(data.grade ?? '1'));
          grouped[grade].push({
            id: String(data.subjectId ?? d.id),
            name: String(data.name ?? 'Subject'),
            timeLabel: String(data.timeLabel ?? ''),
            defaultTheme: sanitizeTheme(String(data.defaultTheme ?? 'navy')),
            visible: Boolean(data.visible),
            order: Number(data.order ?? 0),
          });
        });
        for (const g of VALID_GRADES) {
          grouped[g].sort((a, b) => a.order - b.order);
        }
        callbacks.onMasterSchedules(grouped, !snap.empty);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, masterSchedulesPath);
      }
    )
  );

  const masterNsdPath = `schools/${SCHOOL_ID}/nonSchoolDays`;
  unsubs.push(
    onSnapshot(
      query(
        collection(db, masterNsdPath),
        where('schoolId', '==', SCHOOL_ID)
      ),
      (snap) => {
        const days: NonSchoolDay[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            date: String(data.date ?? ''),
            label: String(data.label ?? ''),
            isMaster: true,
          };
        });
        callbacks.onMasterNonSchoolDays(days);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, masterNsdPath);
      }
    )
  );

  const masterLessonsPath = `schools/${SCHOOL_ID}/curriculum`;
  unsubs.push(
    onSnapshot(
      query(
        collection(db, masterLessonsPath),
        where('schoolId', '==', SCHOOL_ID)
      ),
      (snap) => {
        const items: LessonItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            grade: sanitizeGrade(String(data.grade ?? '1')),
            subjectId: String(data.subjectId ?? ''),
            date: String(data.date ?? ''),
            unitTitle: String(data.unitTitle ?? ''),
            lessonTitle: String(data.lessonTitle ?? ''),
            bullets: Array.isArray(data.bullets)
              ? data.bullets.map(String).filter(Boolean)
              : undefined,
            standards: data.standards ? String(data.standards) : undefined,
            externalUrl: data.externalUrl ? String(data.externalUrl) : undefined,
            prepFlag: Boolean(data.prepFlag),
            unitResourcesLabel: data.unitResourcesLabel
              ? String(data.unitResourcesLabel)
              : undefined,
            unitResourcesUrl: data.unitResourcesUrl
              ? String(data.unitResourcesUrl)
              : undefined,
            slidesUrl: data.slidesUrl ? String(data.slidesUrl) : undefined,
            notes: String(data.notes ?? ''),
            completed: false,
            themeOverride: data.themeOverride
              ? sanitizeTheme(String(data.themeOverride))
              : undefined,
            isMaster: true,
          };
        });
        callbacks.onMasterLessons(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, masterLessonsPath);
      }
    )
  );

  return () => {
    unsubs.forEach((fn) => fn());
  };
}

export function subscribeUserWorkspace(
  uid: string,
  callbacks: {
    onSettings: (profile: TeacherProfile) => void;
    onSchedules: (schedules: Record<GradeLevel, SubjectBlock[]>) => void;
    onLessons: (lessons: LessonItem[]) => void;
    onNonSchoolDays: (days: NonSchoolDay[]) => void;
    onLessonProgress: (progress: Record<string, LessonProgressRecord>) => void;
  }
): () => void {
  const unsubs: Unsubscribe[] = [];

  const settingsPath = `users/${uid}/workspace/settings`;
  unsubs.push(
    onSnapshot(
      doc(db, settingsPath),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        callbacks.onSettings({
          name: String(d.name ?? 'Spartan Teacher'),
          school: String(d.school ?? 'Milford Grade School'),
          room: String(d.room ?? ''),
          subNotes: String(d.subNotes ?? ''),
          roleMode: d.roleMode === 'viewer' ? 'viewer' : 'editor',
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, settingsPath);
      }
    )
  );

  const schedulesPath = `users/${uid}/schedules`;
  unsubs.push(
    onSnapshot(
      query(collection(db, schedulesPath), where('ownerId', '==', uid)),
      (snap) => {
        const grouped: Record<GradeLevel, SubjectBlock[]> = {
          K: [],
          '1': [],
          '2': [],
          '3': [],
          '4': [],
          '5': [],
        };
        snap.docs.forEach((d) => {
          const data = d.data();
          const grade = sanitizeGrade(String(data.grade ?? '1'));
          grouped[grade].push({
            id: String(data.subjectId ?? d.id),
            name: String(data.name ?? 'Subject'),
            timeLabel: String(data.timeLabel ?? ''),
            defaultTheme: sanitizeTheme(String(data.defaultTheme ?? 'navy')),
            visible: Boolean(data.visible),
            order: Number(data.order ?? 0),
          });
        });
        for (const g of VALID_GRADES) {
          grouped[g].sort((a, b) => a.order - b.order);
        }
        callbacks.onSchedules(grouped);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, schedulesPath);
      }
    )
  );

  const lessonsPath = `users/${uid}/lessons`;
  unsubs.push(
    onSnapshot(
      query(collection(db, lessonsPath), where('ownerId', '==', uid)),
      (snap) => {
        const items: LessonItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            grade: sanitizeGrade(String(data.grade ?? '1')),
            subjectId: String(data.subjectId ?? ''),
            date: String(data.date ?? ''),
            unitTitle: String(data.unitTitle ?? ''),
            lessonTitle: String(data.lessonTitle ?? ''),
            bullets: Array.isArray(data.bullets)
              ? data.bullets.map(String).filter(Boolean)
              : undefined,
            standards: data.standards ? String(data.standards) : undefined,
            externalUrl: data.externalUrl ? String(data.externalUrl) : undefined,
            prepFlag: Boolean(data.prepFlag),
            unitResourcesLabel: data.unitResourcesLabel
              ? String(data.unitResourcesLabel)
              : undefined,
            unitResourcesUrl: data.unitResourcesUrl
              ? String(data.unitResourcesUrl)
              : undefined,
            slidesUrl: data.slidesUrl ? String(data.slidesUrl) : undefined,
            notes: String(data.notes ?? ''),
            completed: Boolean(data.completed),
            themeOverride: data.themeOverride
              ? sanitizeTheme(String(data.themeOverride))
              : undefined,
            isMaster: false,
          };
        });
        callbacks.onLessons(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, lessonsPath);
      }
    )
  );

  const nsdPath = `users/${uid}/nonSchoolDays`;
  unsubs.push(
    onSnapshot(
      query(collection(db, nsdPath), where('ownerId', '==', uid)),
      (snap) => {
        const days: NonSchoolDay[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            date: String(data.date ?? ''),
            label: String(data.label ?? ''),
            isMaster: false,
          };
        });
        callbacks.onNonSchoolDays(days);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, nsdPath);
      }
    )
  );

  const progressPath = `users/${uid}/lessonProgress`;
  unsubs.push(
    onSnapshot(
      query(collection(db, progressPath), where('ownerId', '==', uid)),
      (snap) => {
        const map: Record<string, LessonProgressRecord> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[d.id] = {
            lessonId: d.id,
            completed: Boolean(data.completed),
            notes: String(data.notes ?? ''),
          };
        });
        callbacks.onLessonProgress(map);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, progressPath);
      }
    )
  );

  return () => {
    unsubs.forEach((fn) => fn());
  };
}

export function subscribeTeacherRoster(
  email: string,
  onRoster: (roster: TeacherRosterAssignment | null) => void
): () => void {
  const rosterId = emailToRosterDocId(email);
  const path = `schools/${SCHOOL_ID}/teacherRosters/${rosterId}`;
  return onSnapshot(
    doc(db, path),
    (snap) => {
      if (!snap.exists()) {
        onRoster(null);
        return;
      }
      const d = snap.data();
      onRoster({
        rosterId: snap.id,
        teacherEmail: String(d.teacherEmail ?? email).toLowerCase(),
        teacherName: String(d.teacherName ?? ''),
        assignedGrades: Array.isArray(d.assignedGrades)
          ? (d.assignedGrades.filter((g) =>
              VALID_GRADES.includes(g as GradeLevel)
            ) as GradeLevel[])
          : [],
        assignedSubjects: Array.isArray(d.assignedSubjects)
          ? d.assignedSubjects.map(String).filter(Boolean)
          : [],
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// ==========================================
// Admin-Only School-Wide Publishing Helpers
// ==========================================

export async function fetchAllTeacherRosters(): Promise<TeacherRosterAssignment[]> {
  const dirPath = `schools/${SCHOOL_ID}/config/rosterDirectory`;
  let rosterIds: string[] = [];
  try {
    const dirSnap = await getDoc(doc(db, dirPath));
    if (!dirSnap.exists()) return [];
    const raw = dirSnap.data()?.rosterIds;
    rosterIds = Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, dirPath);
    return [];
  }

  const results: TeacherRosterAssignment[] = [];
  await Promise.all(
    rosterIds.map(async (rid) => {
      const itemPath = `schools/${SCHOOL_ID}/teacherRosters/${rid}`;
      try {
        const snap = await getDoc(doc(db, itemPath));
        if (snap.exists()) {
          const d = snap.data();
          results.push({
            rosterId: snap.id,
            teacherEmail: String(d.teacherEmail ?? '').toLowerCase(),
            teacherName: String(d.teacherName ?? ''),
            assignedGrades: Array.isArray(d.assignedGrades)
              ? (d.assignedGrades.filter((g) =>
                  VALID_GRADES.includes(g as GradeLevel)
                ) as GradeLevel[])
              : [],
            assignedSubjects: Array.isArray(d.assignedSubjects)
              ? d.assignedSubjects.map(String).filter(Boolean)
              : [],
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, itemPath);
      }
    })
  );

  return results.sort((a, b) => a.teacherName.localeCompare(b.teacherName));
}

export async function publishTeacherRostersBatch(
  uid: string,
  rosters: Array<Omit<TeacherRosterAssignment, 'rosterId'>>,
  replaceExisting = false
): Promise<TeacherRosterAssignment[]> {
  const dirPath = `schools/${SCHOOL_ID}/config/rosterDirectory`;
  let existingIds: string[] = [];
  try {
    const dirSnap = await getDoc(doc(db, dirPath));
    if (dirSnap.exists() && Array.isArray(dirSnap.data()?.rosterIds)) {
      existingIds = dirSnap.data()!.rosterIds.map(String).filter(Boolean);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, dirPath);
  }

  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  const nextIdSet = new Set<string>(replaceExisting ? [] : existingIds);
  const incomingIds = new Set<string>();
  const saved: TeacherRosterAssignment[] = [];

  rosters.forEach((item) => {
    const cleanEmail = clampStr(item.teacherEmail, 254).toLowerCase();
    if (!cleanEmail) return;
    const rosterId = emailToRosterDocId(cleanEmail);
    incomingIds.add(rosterId);
    nextIdSet.add(rosterId);

    const grades = item.assignedGrades
      .filter((g) => VALID_GRADES.includes(g))
      .slice(0, 6);
    const subjects = item.assignedSubjects
      .map((s) => clampStr(s, 80))
      .filter(Boolean)
      .slice(0, 60);
    const teacherName = clampStr(item.teacherName, 100) || cleanEmail;

    saved.push({
      rosterId,
      teacherEmail: cleanEmail,
      teacherName,
      assignedGrades: grades,
      assignedSubjects: subjects,
    });

    const ref = doc(db, `schools/${SCHOOL_ID}/teacherRosters/${rosterId}`);
    ops.push((batch) =>
      batch.set(ref, {
        schoolId: SCHOOL_ID,
        teacherEmail: cleanEmail,
        teacherName,
        assignedGrades: grades,
        assignedSubjects: subjects,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      })
    );
  });

  if (replaceExisting) {
    existingIds.forEach((oldId) => {
      if (!incomingIds.has(oldId)) {
        ops.push((batch) =>
          batch.delete(doc(db, `schools/${SCHOOL_ID}/teacherRosters/${oldId}`))
        );
      }
    });
  }

  const finalIds = Array.from(nextIdSet).slice(0, 500);
  ops.push((batch) =>
    batch.set(doc(db, dirPath), {
      schoolId: SCHOOL_ID,
      rosterIds: finalIds,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    })
  );

  await commitOperationsInBatches(ops, `schools/${SCHOOL_ID}/teacherRosters`);
  return saved;
}

export async function deleteTeacherRosterAssignment(
  uid: string,
  rosterId: string
): Promise<void> {
  const cleanId = sanitizeId(rosterId, 128);
  const dirPath = `schools/${SCHOOL_ID}/config/rosterDirectory`;
  let existingIds: string[] = [];
  try {
    const dirSnap = await getDoc(doc(db, dirPath));
    if (dirSnap.exists() && Array.isArray(dirSnap.data()?.rosterIds)) {
      existingIds = dirSnap.data()!.rosterIds.map(String).filter(Boolean);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, dirPath);
  }

  const nextIds = existingIds.filter((id) => id !== cleanId).slice(0, 500);
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [
    (batch) =>
      batch.delete(doc(db, `schools/${SCHOOL_ID}/teacherRosters/${cleanId}`)),
    (batch) =>
      batch.set(doc(db, dirPath), {
        schoolId: SCHOOL_ID,
        rosterIds: nextIds,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      }),
  ];

  await commitOperationsInBatches(ops, `schools/${SCHOOL_ID}/teacherRosters`);
}

export async function saveSchoolGovernance(
  uid: string,
  gov: SchoolGovernance
): Promise<void> {
  const path = `schools/${SCHOOL_ID}/config/governance`;
  try {
    await setDoc(doc(db, path), {
      schoolId: SCHOOL_ID,
      schoolName: clampStr(gov.schoolName, 120) || 'Milford Grade School',
      lockTeacherSchedules: Boolean(gov.lockTeacherSchedules),
      lockCurriculumUploads: Boolean(gov.lockCurriculumUploads),
      requireAssignedRoster: Boolean(gov.requireAssignedRoster),
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function publishMasterSchedules(
  uid: string,
  previousByGrade: Record<GradeLevel, SubjectBlock[]>,
  updatedByGrade: Partial<Record<GradeLevel, SubjectBlock[]>>
): Promise<void> {
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  (Object.keys(updatedByGrade) as GradeLevel[]).forEach((grade) => {
    const updatedBlocks = updatedByGrade[grade];
    if (!updatedBlocks) return;
    const prevBlocks = previousByGrade[grade] ?? [];
    const nextIds = new Set(updatedBlocks.map((b) => sanitizeId(b.id, 64)));

    prevBlocks.forEach((prevBlock) => {
      const sid = sanitizeId(prevBlock.id, 64);
      if (!nextIds.has(sid)) {
        const docId = sanitizeId(`${grade}_${sid}`, 128);
        ops.push((batch) =>
          batch.delete(doc(db, `schools/${SCHOOL_ID}/schedules/${docId}`))
        );
      }
    });

    updatedBlocks.forEach((block, idx) => {
      const sid = sanitizeId(block.id, 64);
      const docId = sanitizeId(`${grade}_${sid}`, 128);
      const ref = doc(db, `schools/${SCHOOL_ID}/schedules/${docId}`);
      ops.push((batch) =>
        batch.set(ref, {
          schoolId: SCHOOL_ID,
          grade,
          subjectId: sid,
          name: clampStr(block.name, 80) || 'Subject',
          timeLabel: clampStr(block.timeLabel, 40),
          defaultTheme: sanitizeTheme(block.defaultTheme),
          visible: Boolean(block.visible),
          order: typeof block.order === 'number' ? block.order : idx,
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        })
      );
    });
  });

  await commitOperationsInBatches(ops, `schools/${SCHOOL_ID}/schedules`);
}

export async function publishMasterNonSchoolDaysBatch(
  uid: string,
  days: NonSchoolDay[]
): Promise<void> {
  const ops = days.map((day) => {
    const cleanId = sanitizeId(day.id, 128);
    const ref = doc(db, `schools/${SCHOOL_ID}/nonSchoolDays/${cleanId}`);
    return (batch: ReturnType<typeof writeBatch>) =>
      batch.set(ref, {
        schoolId: SCHOOL_ID,
        date: clampStr(day.date, 10),
        label: clampStr(day.label, 120) || 'Non-School Day',
        updatedBy: uid,
        createdAt: serverTimestamp(),
      });
  });
  await commitOperationsInBatches(ops, `schools/${SCHOOL_ID}/nonSchoolDays`);
}

export async function deleteMasterNonSchoolDay(dayId: string): Promise<void> {
  const cleanId = sanitizeId(dayId, 128);
  const path = `schools/${SCHOOL_ID}/nonSchoolDays/${cleanId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function publishMasterCurriculumBatch(
  uid: string,
  lessonsToInsert: LessonItem[],
  lessonIdsToDelete: string[]
): Promise<void> {
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  lessonIdsToDelete.forEach((id) => {
    const cleanId = sanitizeId(id, 128);
    ops.push((batch) =>
      batch.delete(doc(db, `schools/${SCHOOL_ID}/curriculum/${cleanId}`))
    );
  });

  lessonsToInsert.forEach((lesson) => {
    const lessonId = sanitizeId(lesson.id, 128);
    const ref = doc(db, `schools/${SCHOOL_ID}/curriculum/${lessonId}`);
    ops.push((batch) =>
      batch.set(ref, buildMasterLessonPayload(uid, lesson, true))
    );
  });

  await commitOperationsInBatches(ops, `schools/${SCHOOL_ID}/curriculum`);
}

export async function deleteMasterCurriculumLesson(
  lessonId: string
): Promise<void> {
  const cleanId = sanitizeId(lessonId, 128);
  const path = `schools/${SCHOOL_ID}/curriculum/${cleanId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function grantAdminAccess(
  targetUid: string,
  grantedByUid: string,
  label: string
): Promise<void> {
  const cleanUid = sanitizeId(targetUid, 128);
  const path = `admins/${cleanUid}`;
  try {
    await setDoc(doc(db, path), {
      uid: cleanUid,
      label: clampStr(label, 80) || 'School Administrator',
      grantedBy: grantedByUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function revokeAdminAccess(targetUid: string): Promise<void> {
  const cleanUid = sanitizeId(targetUid, 128);
  const path = `admins/${cleanUid}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==========================================
// Teacher Personal Workspace Helpers
// ==========================================

export async function saveTeacherLessonProgress(
  uid: string,
  lessonId: string,
  completed: boolean,
  notes: string
): Promise<void> {
  const cleanId = sanitizeId(lessonId, 128);
  const path = `users/${uid}/lessonProgress/${cleanId}`;
  try {
    await setDoc(doc(db, path), {
      ownerId: uid,
      lessonId: cleanId,
      completed: Boolean(completed),
      notes: (notes ?? '').slice(0, 2000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveProfileSettings(
  uid: string,
  profile: TeacherProfile
): Promise<void> {
  const path = `users/${uid}/workspace/settings`;
  try {
    await updateDoc(doc(db, path), {
      name: clampStr(profile.name, 80) || 'Spartan Teacher',
      school: clampStr(profile.school, 120) || 'Milford Grade School',
      room: clampStr(profile.room, 40),
      subNotes: (profile.subNotes ?? '').slice(0, 2000),
      roleMode: profile.roleMode === 'viewer' ? 'viewer' : 'editor',
      seeded: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveGradeScheduleBlocks(
  uid: string,
  grade: GradeLevel,
  previousBlocks: SubjectBlock[],
  updatedBlocks: SubjectBlock[]
): Promise<void> {
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  const nextIds = new Set(updatedBlocks.map((b) => sanitizeId(b.id, 64)));

  previousBlocks.forEach((prevBlock) => {
    const sid = sanitizeId(prevBlock.id, 64);
    if (!nextIds.has(sid)) {
      const docId = sanitizeId(`${grade}_${sid}`, 128);
      ops.push((batch) =>
        batch.delete(doc(db, `users/${uid}/schedules/${docId}`))
      );
    }
  });

  updatedBlocks.forEach((block, idx) => {
    const sid = sanitizeId(block.id, 64);
    const docId = sanitizeId(`${grade}_${sid}`, 128);
    const ref = doc(db, `users/${uid}/schedules/${docId}`);
    ops.push((batch) =>
      batch.set(ref, {
        ownerId: uid,
        grade,
        subjectId: sid,
        name: clampStr(block.name, 80) || 'Subject',
        timeLabel: clampStr(block.timeLabel, 40),
        defaultTheme: sanitizeTheme(block.defaultTheme),
        visible: Boolean(block.visible),
        order: typeof block.order === 'number' ? block.order : idx,
        updatedAt: serverTimestamp(),
      })
    );
  });

  await commitOperationsInBatches(ops, `users/${uid}/schedules`);
}

export async function saveLessonRecord(
  uid: string,
  lesson: LessonItem,
  exists: boolean
): Promise<void> {
  const lessonId = sanitizeId(lesson.id, 128);
  const path = `users/${uid}/lessons/${lessonId}`;
  try {
    if (exists) {
      const payload = buildLessonPayload(uid, lesson, false);
      delete payload.ownerId;
      delete payload.createdAt;
      await updateDoc(doc(db, path), payload);
    } else {
      await setDoc(doc(db, path), buildLessonPayload(uid, lesson, true));
    }
  } catch (error) {
    handleFirestoreError(
      error,
      exists ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function saveLessonsBatch(
  uid: string,
  lessons: LessonItem[]
): Promise<void> {
  const ops = lessons.map((lesson) => {
    const lessonId = sanitizeId(lesson.id, 128);
    const ref = doc(db, `users/${uid}/lessons/${lessonId}`);
    return (batch: ReturnType<typeof writeBatch>) =>
      batch.set(ref, buildLessonPayload(uid, lesson, true));
  });
  await commitOperationsInBatches(ops, `users/${uid}/lessons`);
}

export async function replaceLessonsBatch(
  uid: string,
  lessonIdsToDelete: string[],
  lessonsToInsert: LessonItem[]
): Promise<void> {
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  lessonIdsToDelete.forEach((id) => {
    const cleanId = sanitizeId(id, 128);
    ops.push((batch) => batch.delete(doc(db, `users/${uid}/lessons/${cleanId}`)));
  });

  lessonsToInsert.forEach((lesson) => {
    const lessonId = sanitizeId(lesson.id, 128);
    const ref = doc(db, `users/${uid}/lessons/${lessonId}`);
    ops.push((batch) => batch.set(ref, buildLessonPayload(uid, lesson, true)));
  });

  await commitOperationsInBatches(ops, `users/${uid}/lessons`);
}

export async function deleteLessonRecord(
  uid: string,
  lessonId: string
): Promise<void> {
  const cleanId = sanitizeId(lessonId, 128);
  const path = `users/${uid}/lessons/${cleanId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateLessonCompletion(
  uid: string,
  lessonId: string,
  completed: boolean
): Promise<void> {
  const cleanId = sanitizeId(lessonId, 128);
  const path = `users/${uid}/lessons/${cleanId}`;
  try {
    await updateDoc(doc(db, path), {
      completed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateLessonNotesOnly(
  uid: string,
  lessonId: string,
  notes: string
): Promise<void> {
  const cleanId = sanitizeId(lessonId, 128);
  const path = `users/${uid}/lessons/${cleanId}`;
  try {
    await updateDoc(doc(db, path), {
      notes: (notes ?? '').slice(0, 2000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateLessonDatesBatch(
  uid: string,
  updates: Array<{ lessonId: string; date: string }>
): Promise<void> {
  const ops = updates.map(({ lessonId, date }) => {
    const cleanId = sanitizeId(lessonId, 128);
    const ref = doc(db, `users/${uid}/lessons/${cleanId}`);
    return (batch: ReturnType<typeof writeBatch>) =>
      batch.update(ref, {
        date: clampStr(date, 10),
        updatedAt: serverTimestamp(),
      });
  });
  await commitOperationsInBatches(ops, `users/${uid}/lessons`);
}

export async function addNonSchoolDayRecord(
  uid: string,
  day: NonSchoolDay
): Promise<void> {
  const cleanId = sanitizeId(day.id, 128);
  const path = `users/${uid}/nonSchoolDays/${cleanId}`;
  try {
    await setDoc(doc(db, path), {
      ownerId: uid,
      date: clampStr(day.date, 10),
      label: clampStr(day.label, 120) || 'Non-School Day',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function addNonSchoolDaysBatch(
  uid: string,
  days: NonSchoolDay[]
): Promise<void> {
  const ops = days.map((day) => {
    const cleanId = sanitizeId(day.id, 128);
    const ref = doc(db, `users/${uid}/nonSchoolDays/${cleanId}`);
    return (batch: ReturnType<typeof writeBatch>) =>
      batch.set(ref, {
        ownerId: uid,
        date: clampStr(day.date, 10),
        label: clampStr(day.label, 120) || 'Non-School Day',
        createdAt: serverTimestamp(),
      });
  });
  await commitOperationsInBatches(ops, `users/${uid}/nonSchoolDays`);
}

export async function saveMultiGradeScheduleBlocks(
  uid: string,
  previousByGrade: Record<GradeLevel, SubjectBlock[]>,
  updatedByGrade: Partial<Record<GradeLevel, SubjectBlock[]>>
): Promise<void> {
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  (Object.keys(updatedByGrade) as GradeLevel[]).forEach((grade) => {
    const updatedBlocks = updatedByGrade[grade];
    if (!updatedBlocks) return;
    const prevBlocks = previousByGrade[grade] ?? [];
    const nextIds = new Set(updatedBlocks.map((b) => sanitizeId(b.id, 64)));

    prevBlocks.forEach((prevBlock) => {
      const sid = sanitizeId(prevBlock.id, 64);
      if (!nextIds.has(sid)) {
        const docId = sanitizeId(`${grade}_${sid}`, 128);
        ops.push((batch) =>
          batch.delete(doc(db, `users/${uid}/schedules/${docId}`))
        );
      }
    });

    updatedBlocks.forEach((block, idx) => {
      const sid = sanitizeId(block.id, 64);
      const docId = sanitizeId(`${grade}_${sid}`, 128);
      const ref = doc(db, `users/${uid}/schedules/${docId}`);
      ops.push((batch) =>
        batch.set(ref, {
          ownerId: uid,
          grade,
          subjectId: sid,
          name: clampStr(block.name, 80) || 'Subject',
          timeLabel: clampStr(block.timeLabel, 40),
          defaultTheme: sanitizeTheme(block.defaultTheme),
          visible: Boolean(block.visible),
          order: typeof block.order === 'number' ? block.order : idx,
          updatedAt: serverTimestamp(),
        })
      );
    });
  });

  await commitOperationsInBatches(ops, `users/${uid}/schedules`);
}

export async function deleteNonSchoolDayRecord(
  uid: string,
  dayId: string
): Promise<void> {
  const cleanId = sanitizeId(dayId, 128);
  const path = `users/${uid}/nonSchoolDays/${cleanId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
