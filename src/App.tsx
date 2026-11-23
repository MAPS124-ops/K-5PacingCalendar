import { onAuthStateChanged, sendEmailVerification, signOut, User } from 'firebase/auth';
import { AlertTriangle, Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminConsoleModal } from './components/AdminConsoleModal';
import { AuthView } from './components/AuthView';
import { CurriculumBuilderView } from './components/CurriculumBuilderView';
import { DailyDashboard } from './components/DailyDashboard';
import { GradeTabs } from './components/GradeTabs';
import { LessonModal } from './components/LessonModal';
import { PacingGuideView } from './components/PacingGuideView';
import { ProfileModal } from './components/ProfileModal';
import { ScheduleModal } from './components/ScheduleModal';
import { SubPlanModal } from './components/SubPlanModal';
import { TopBar } from './components/TopBar';
import { ViewSwitcher } from './components/ViewSwitcher';
import { WeeklyView } from './components/WeeklyView';
import {
  createInitialAppState,
  DEFAULT_ANCHOR_DATE,
  GRADES,
} from './data/seedData';
import { auth } from './firebase';
import {
  addNonSchoolDayRecord,
  addNonSchoolDaysBatch,
  BOOTSTRAP_ADMIN_EMAIL,
  checkIsAdminUser,
  clearAndReplaceWorkspace,
  DEFAULT_GOVERNANCE,
  deleteLessonRecord,
  deleteMasterCurriculumLesson,
  deleteMasterNonSchoolDay,
  deleteNonSchoolDayRecord,
  ensureSchoolGovernanceInitialized,
  ensureUserWorkspaceInitialized,
  grantAdminAccess,
  publishMasterCurriculumBatch,
  publishMasterNonSchoolDaysBatch,
  publishMasterSchedules,
  replaceLessonsBatch,
  revokeAdminAccess,
  saveGradeScheduleBlocks,
  saveLessonRecord,
  saveLessonsBatch,
  saveMultiGradeScheduleBlocks,
  saveProfileSettings,
  saveSchoolGovernance,
  saveTeacherLessonProgress,
  subscribeSchoolMasterData,
  subscribeUserWorkspace,
  updateLessonCompletion,
  updateLessonDatesBatch,
  updateLessonNotesOnly,
} from './services/firestorePacing';
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
  ViewTab,
} from './types/pacing';
import { addSchoolDaysISO, toISODate } from './utils/dateUtils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const [appState, setAppState] = useState<PacingAppState>(() => createInitialAppState());
  const [isAdmin, setIsAdmin] = useState(false);
  const [governance, setGovernance] = useState<SchoolGovernance>(DEFAULT_GOVERNANCE);
  const [masterSchedulesByGrade, setMasterSchedulesByGrade] = useState<
    Record<GradeLevel, SubjectBlock[]>
  >({
    K: [],
    '1': [],
    '2': [],
    '3': [],
    '4': [],
    '5': [],
  });
  const [hasMasterSchedules, setHasMasterSchedules] = useState(false);
  const [masterNonSchoolDays, setMasterNonSchoolDays] = useState<NonSchoolDay[]>([]);
  const [masterLessons, setMasterLessons] = useState<LessonItem[]>([]);
  const [lessonProgress, setLessonProgress] = useState<Record<string, LessonProgressRecord>>({});

  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>('1');
  const [selectedDate, setSelectedDate] = useState<string>(DEFAULT_ANCHOR_DATE);
  const [activeView, setActiveView] = useState<ViewTab>('daily');

  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null);
  const [draftSlot, setDraftSlot] = useState<{ subjectId: string; date: string } | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [subPlanModalOpen, setSubPlanModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [adminConsoleOpen, setAdminConsoleOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const todayISO = useMemo(() => toISODate(new Date()), []);
  const seedFallbackSchedules = useMemo(
    () => createInitialAppState().schedulesByGrade,
    []
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setAppState(createInitialAppState());
        setIsAdmin(false);
        setGovernance(DEFAULT_GOVERNANCE);
        setMasterSchedulesByGrade({
          K: [],
          '1': [],
          '2': [],
          '3': [],
          '4': [],
          '5': [],
        });
        setHasMasterSchedules(false);
        setMasterNonSchoolDays([]);
        setMasterLessons([]);
        setLessonProgress({});
        setAdminConsoleOpen(false);
        setWorkspaceLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    let unsubscribeMaster: (() => void) | undefined;
    let unsubscribeWorkspace: (() => void) | undefined;

    async function initAndSubscribe(currentUser: User) {
      setWorkspaceLoading(true);
      try {
        const adminStatus = await checkIsAdminUser(currentUser);
        if (cancelled) return;
        setIsAdmin(adminStatus);

        if (adminStatus) {
          await ensureSchoolGovernanceInitialized(currentUser.uid);
          if (cancelled) return;
        }

        await ensureUserWorkspaceInitialized(
          currentUser.uid,
          currentUser.email || '',
          currentUser.displayName,
          adminStatus
        );
        if (cancelled) return;

        unsubscribeMaster = subscribeSchoolMasterData({
          onGovernance: (gov) => {
            if (gov) setGovernance(gov);
          },
          onMasterSchedules: (schedules, hasData) => {
            setMasterSchedulesByGrade(schedules);
            setHasMasterSchedules(hasData);
          },
          onMasterNonSchoolDays: (days) => {
            setMasterNonSchoolDays(days);
          },
          onMasterLessons: (lessons) => {
            setMasterLessons(lessons);
          },
        });

        unsubscribeWorkspace = subscribeUserWorkspace(currentUser.uid, {
          onSettings: (profile) => {
            setAppState((prev) => ({ ...prev, profile }));
            setWorkspaceLoading(false);
          },
          onSchedules: (schedulesByGrade) => {
            setAppState((prev) => ({ ...prev, schedulesByGrade }));
          },
          onLessons: (lessons) => {
            setAppState((prev) => ({ ...prev, lessons }));
          },
          onNonSchoolDays: (nonSchoolDays) => {
            setAppState((prev) => ({ ...prev, nonSchoolDays }));
          },
          onLessonProgress: (progress) => {
            setLessonProgress(progress);
          },
        });
      } catch (err) {
        console.error('Failed to initialize workspace:', err);
        setWorkspaceLoading(false);
      }
    }

    void initAndSubscribe(user);

    return () => {
      cancelled = true;
      if (unsubscribeMaster) unsubscribeMaster();
      if (unsubscribeWorkspace) unsubscribeWorkspace();
    };
  }, [authReady, user]);

  const effectiveSchedulesByGrade = useMemo(() => {
    const result = {} as Record<GradeLevel, SubjectBlock[]>;
    for (const g of GRADES) {
      const gid = g.id;
      const masterBlocks = masterSchedulesByGrade[gid] ?? [];
      const userBlocks = appState.schedulesByGrade[gid] ?? [];
      if (masterBlocks.length > 0) {
        result[gid] = masterBlocks;
      } else if (userBlocks.length > 0) {
        result[gid] = userBlocks;
      } else {
        result[gid] = seedFallbackSchedules[gid];
      }
    }
    return result;
  }, [masterSchedulesByGrade, appState.schedulesByGrade, seedFallbackSchedules]);

  const effectiveNonSchoolDays = useMemo(() => {
    const byId = new Map<string, NonSchoolDay>();
    masterNonSchoolDays.forEach((d) => byId.set(d.id, d));
    appState.nonSchoolDays.forEach((d) => {
      if (!byId.has(d.id)) {
        byId.set(d.id, d);
      }
    });
    return Array.from(byId.values());
  }, [masterNonSchoolDays, appState.nonSchoolDays]);

  const effectiveLessons = useMemo(() => {
    const overlaidMaster = masterLessons.map((m) => {
      const prog = lessonProgress[m.id];
      if (!prog) return m;
      return {
        ...m,
        completed: prog.completed,
        notes: prog.notes,
      };
    });
    return [...overlaidMaster, ...appState.lessons];
  }, [masterLessons, lessonProgress, appState.lessons]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-[#1D2F6F] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">
            Checking session...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  const uid = user.uid;
  const isEditor = appState.profile.roleMode === 'editor';
  const schedulesLockedForTeacher = governance.lockTeacherSchedules && !isAdmin;
  const curriculumLockedForTeacher = governance.lockCurriculumUploads && !isAdmin;
  const effectiveCanEditLessons = isEditor && !curriculumLockedForTeacher;
  const needsAdminEmailVerification = Boolean(
    user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL &&
      !user.emailVerified &&
      !isAdmin
  );

  const gradeSubjects = effectiveSchedulesByGrade[selectedGrade] ?? [];
  const gradeLessons = effectiveLessons.filter((l) => l.grade === selectedGrade);
  const gradeLabel =
    GRADES.find((g) => g.id === selectedGrade)?.label ?? '1st Grade';

  const handleVerifyAdminEmail = async () => {
    try {
      await user.reload();
      if (user.emailVerified) {
        const adminNow = await checkIsAdminUser(user);
        setIsAdmin(adminNow);
        if (adminNow) {
          await ensureSchoolGovernanceInitialized(user.uid);
          showToast('Admin verification confirmed!');
        }
        return;
      }
      await sendEmailVerification(user);
      showToast(
        `Verification link sent to ${user.email}. Click the link or sign in with Google, then click Verify Admin again.`
      );
    } catch {
      showToast('Could not send verification email right now. You can also sign in with Google.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveLesson(null);
      setDraftSlot(null);
      setScheduleModalOpen(false);
      setSubPlanModalOpen(false);
      setProfileModalOpen(false);
      setAdminConsoleOpen(false);
    } catch {
      showToast('Failed to log out. Please try again.');
    }
  };

  const handleToggleRoleMode = async () => {
    const nextMode = appState.profile.roleMode === 'editor' ? 'viewer' : 'editor';
    const nextProfile: TeacherProfile = {
      ...appState.profile,
      roleMode: nextMode,
    };
    await saveProfileSettings(uid, nextProfile);
    showToast(
      nextMode === 'editor'
        ? 'Editor Mode enabled — you can edit schedules & lessons'
        : 'Viewer Mode enabled — accidental edits are locked'
    );
  };

  const handleSaveProfile = async (profile: TeacherProfile) => {
    await saveProfileSettings(uid, profile);
    showToast('Profile settings saved');
  };

  const handleSaveSchedule = async (updated: SubjectBlock[]) => {
    if (schedulesLockedForTeacher) {
      showToast('Schedules are locked by your Milford Grade School administrator');
      return;
    }
    if (isAdmin && (masterSchedulesByGrade[selectedGrade]?.length ?? 0) > 0) {
      await publishMasterSchedules(uid, masterSchedulesByGrade, {
        [selectedGrade]: updated,
      });
      showToast(`Published master ${gradeLabel} schedule school-wide`);
      return;
    }
    await saveGradeScheduleBlocks(uid, selectedGrade, gradeSubjects, updated);
    showToast(`${gradeLabel} schedule updated`);
  };

  const handleSaveLesson = async (saved: LessonItem) => {
    if (saved.isMaster) {
      if (isAdmin) {
        await publishMasterCurriculumBatch(uid, [saved], []);
        await saveTeacherLessonProgress(
          uid,
          saved.id,
          Boolean(saved.completed),
          saved.notes ?? ''
        );
        showToast('Master lesson updated school-wide');
      } else {
        await saveTeacherLessonProgress(
          uid,
          saved.id,
          Boolean(saved.completed),
          saved.notes ?? ''
        );
        showToast('Teacher notes & progress saved');
      }
      return;
    }

    const existing = appState.lessons.find((l) => l.id === saved.id);
    if (curriculumLockedForTeacher && existing) {
      if (Boolean(saved.completed) !== Boolean(existing.completed)) {
        await updateLessonCompletion(uid, saved.id, Boolean(saved.completed));
      }
      if ((saved.notes ?? '') !== (existing.notes ?? '')) {
        await updateLessonNotesOnly(uid, saved.id, saved.notes ?? '');
      }
      showToast('Teacher notes & progress saved');
      return;
    }

    await saveLessonRecord(uid, saved, Boolean(existing));
    showToast('Lesson saved');
  };

  const handleDeleteLesson = async (lessonId: string) => {
    const masterTarget = masterLessons.find((m) => m.id === lessonId);
    if (masterTarget) {
      if (!isAdmin) return;
      await deleteMasterCurriculumLesson(lessonId);
      showToast('Master lesson removed school-wide');
      return;
    }
    if (curriculumLockedForTeacher) return;
    await deleteLessonRecord(uid, lessonId);
    showToast('Lesson removed');
  };

  const handleToggleComplete = async (lessonId: string) => {
    const target = effectiveLessons.find((l) => l.id === lessonId);
    if (!target) return;
    if (target.isMaster) {
      await saveTeacherLessonProgress(
        uid,
        lessonId,
        !target.completed,
        target.notes ?? ''
      );
      return;
    }
    await updateLessonCompletion(uid, lessonId, !target.completed);
  };

  const handleShiftSingleLesson = async (lessonId: string, schoolDaysDelta: 1 | -1) => {
    if (curriculumLockedForTeacher) return;
    const target = effectiveLessons.find((l) => l.id === lessonId);
    if (!target) return;
    const nextDate = addSchoolDaysISO(
      target.date,
      schoolDaysDelta,
      effectiveNonSchoolDays
    );
    if (target.isMaster) {
      if (!isAdmin) return;
      await publishMasterCurriculumBatch(uid, [{ ...target, date: nextDate }], []);
    } else {
      await updateLessonDatesBatch(uid, [{ lessonId, date: nextDate }]);
    }
    showToast(
      schoolDaysDelta > 0
        ? 'Lesson moved forward 1 school day'
        : 'Lesson moved back 1 school day'
    );
  };

  const handleBulkShiftPacing = async (
    subjectId: string | 'all',
    fromDate: string,
    delta: 1 | -1
  ) => {
    if (curriculumLockedForTeacher) return;

    const matchingUser = appState.lessons.filter(
      (l) =>
        l.grade === selectedGrade &&
        l.date >= fromDate &&
        (subjectId === 'all' || l.subjectId === subjectId)
    );

    const matchingMaster = isAdmin
      ? masterLessons.filter(
          (l) =>
            l.grade === selectedGrade &&
            l.date >= fromDate &&
            (subjectId === 'all' || l.subjectId === subjectId)
        )
      : [];

    const totalCount = matchingUser.length + matchingMaster.length;
    if (totalCount === 0) {
      showToast('No matching lessons to shift');
      return;
    }

    if (matchingUser.length > 0) {
      await updateLessonDatesBatch(
        uid,
        matchingUser.map((l) => ({
          lessonId: l.id,
          date: addSchoolDaysISO(l.date, delta, effectiveNonSchoolDays),
        }))
      );
    }

    if (matchingMaster.length > 0 && isAdmin) {
      await publishMasterCurriculumBatch(
        uid,
        matchingMaster.map((l) => ({
          ...l,
          date: addSchoolDaysISO(l.date, delta, effectiveNonSchoolDays),
        })),
        []
      );
    }

    showToast(
      `Shifted ${totalCount} lesson${totalCount === 1 ? '' : 's'} ${
        delta > 0 ? '+1' : '-1'
      } school day`
    );
  };

  const handleAddLessonsBatch = async (batch: LessonItem[]) => {
    if (curriculumLockedForTeacher) return;
    await saveLessonsBatch(uid, batch);
    showToast(`Added ${batch.length} scheduled lesson${batch.length === 1 ? '' : 's'}`);
  };

  const handleImportCurriculumLessons = async (
    lessonsToInsert: LessonItem[],
    lessonIdsToDelete: string[]
  ) => {
    if (curriculumLockedForTeacher) return;
    if (lessonIdsToDelete.length > 0) {
      await replaceLessonsBatch(uid, lessonIdsToDelete, lessonsToInsert);
    } else {
      await saveLessonsBatch(uid, lessonsToInsert);
    }
    showToast(
      `Imported ${lessonsToInsert.length} lesson${
        lessonsToInsert.length === 1 ? '' : 's'
      } to ${gradeLabel}`
    );
  };

  const handleUpdateSubjectTheme = async (subjectId: string, theme: CardTheme) => {
    if (schedulesLockedForTeacher) return;
    const updated = gradeSubjects.map((s) =>
      s.id === subjectId ? { ...s, defaultTheme: theme } : s
    );
    if (isAdmin && (masterSchedulesByGrade[selectedGrade]?.length ?? 0) > 0) {
      await publishMasterSchedules(uid, masterSchedulesByGrade, {
        [selectedGrade]: updated,
      });
      return;
    }
    await saveGradeScheduleBlocks(uid, selectedGrade, gradeSubjects, updated);
  };

  const handleAddNonSchoolDay = async (date: string, label: string) => {
    if (schedulesLockedForTeacher) return;
    await addNonSchoolDayRecord(uid, {
      id: `nsd-${Date.now()}`,
      date,
      label,
    });
    showToast('Non-school day added');
  };

  const handleImportNonSchoolDaysBatch = async (days: NonSchoolDay[]) => {
    if (schedulesLockedForTeacher) return;
    await addNonSchoolDaysBatch(uid, days);
    showToast(`Imported ${days.length} non-school day${days.length === 1 ? '' : 's'}`);
  };

  const handleImportOneRosterSchedules = async (
    updatedByGrade: Partial<Record<GradeLevel, SubjectBlock[]>>
  ) => {
    if (schedulesLockedForTeacher) return;
    await saveMultiGradeScheduleBlocks(
      uid,
      appState.schedulesByGrade,
      updatedByGrade
    );
    const gradeCount = Object.keys(updatedByGrade).length;
    showToast(
      `Imported OneRoster schedule for ${gradeCount} grade level${
        gradeCount === 1 ? '' : 's'
      }`
    );
  };

  const handleDeleteNonSchoolDay = async (id: string) => {
    if (schedulesLockedForTeacher) return;
    await deleteNonSchoolDayRecord(uid, id);
    showToast('Non-school day removed');
  };

  const handleExportBackup = () => {
    const exportPayload: PacingAppState = {
      profile: appState.profile,
      schedulesByGrade: effectiveSchedulesByGrade,
      lessons: effectiveLessons,
      nonSchoolDays: effectiveNonSchoolDays,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `milford-k5-pacing-${todayISO}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported pacing calendar backup');
  };

  const handleImportBackup = async (jsonText: string) => {
    if (curriculumLockedForTeacher || schedulesLockedForTeacher) return;
    try {
      const parsed = JSON.parse(jsonText) as PacingAppState;
      if (parsed && parsed.profile && parsed.schedulesByGrade && Array.isArray(parsed.lessons)) {
        await clearAndReplaceWorkspace(uid, parsed);
        showToast('Imported pacing calendar backup');
      } else {
        showToast('Invalid pacing calendar JSON file');
      }
    } catch {
      showToast('Could not parse JSON file');
    }
  };

  const handleResetDefaults = async () => {
    if (curriculumLockedForTeacher || schedulesLockedForTeacher) return;
    const fresh = createInitialAppState();
    await clearAndReplaceWorkspace(uid, {
      ...fresh,
      profile: {
        ...fresh.profile,
        name: appState.profile.name,
      },
    });
    setSelectedGrade('1');
    setSelectedDate(DEFAULT_ANCHOR_DATE);
    showToast('Restored default K-5 curriculum data');
  };

  // Admin Console School-Wide Publishers
  const handleSaveGovernance = async (nextGov: SchoolGovernance) => {
    await saveSchoolGovernance(uid, nextGov);
    showToast('School governance & lock policy updated');
  };

  const handlePublishMasterSchedules = async (
    updatedByGrade: Partial<Record<GradeLevel, SubjectBlock[]>>
  ) => {
    await publishMasterSchedules(uid, masterSchedulesByGrade, updatedByGrade);
    const count = Object.keys(updatedByGrade).length;
    showToast(
      `Published Skyward master schedule for ${count} grade level${count === 1 ? '' : 's'}`
    );
  };

  const handlePublishMasterNonSchoolDays = async (days: NonSchoolDay[]) => {
    await publishMasterNonSchoolDaysBatch(uid, days);
    showToast(
      `Published ${days.length} school-wide non-school day${days.length === 1 ? '' : 's'}`
    );
  };

  const handleDeleteMasterNonSchoolDay = async (dayId: string) => {
    await deleteMasterNonSchoolDay(dayId);
    showToast('School-wide non-school day removed');
  };

  const handlePublishMasterCurriculum = async (
    lessonsToInsert: LessonItem[],
    lessonIdsToDelete: string[]
  ) => {
    await publishMasterCurriculumBatch(uid, lessonsToInsert, lessonIdsToDelete);
    showToast(
      `Published ${lessonsToInsert.length} master curriculum lesson${
        lessonsToInsert.length === 1 ? '' : 's'
      } school-wide`
    );
  };

  const handleGrantAdmin = async (targetUid: string, label: string) => {
    await grantAdminAccess(targetUid, uid, label);
    showToast('Administrator access granted');
  };

  const handleRevokeAdmin = async (targetUid: string) => {
    await revokeAdminAccess(targetUid);
    showToast('Administrator access revoked');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6FA]">
      <TopBar
        profile={appState.profile}
        isAdmin={isAdmin}
        needsAdminEmailVerification={needsAdminEmailVerification}
        schedulesLocked={governance.lockTeacherSchedules}
        onOpenAdminConsole={() => setAdminConsoleOpen(true)}
        onVerifyAdminEmail={handleVerifyAdminEmail}
        onOpenSchedule={() => setScheduleModalOpen(true)}
        onOpenSubPlan={() => setSubPlanModalOpen(true)}
        onOpenProfile={() => setProfileModalOpen(true)}
        onToggleRoleMode={handleToggleRoleMode}
        onLogout={handleLogout}
      />

      <GradeTabs
        selectedGrade={selectedGrade}
        onSelectGrade={setSelectedGrade}
      />

      <main className="no-print flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {needsAdminEmailVerification && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Verify Admin Email to Unlock Skyward Admin Console:</strong>{' '}
                Your account ({user.email}) is the designated Milford Grade School administrator, but email verification is still pending.
              </div>
            </div>
            <button
              type="button"
              onClick={handleVerifyAdminEmail}
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 shrink-0 cursor-pointer"
            >
              Verify Admin Email
            </button>
          </div>
        )}

        {(schedulesLockedForTeacher || curriculumLockedForTeacher) && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-slate-600 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="w-3.5 h-3.5 text-[#1D2F6F] shrink-0" />
              <span className="truncate">
                <strong className="text-[#182756]">{governance.schoolName}:</strong>{' '}
                {schedulesLockedForTeacher && curriculumLockedForTeacher
                  ? 'Bell schedules, holidays, and curriculum uploads are managed by your administrator.'
                  : schedulesLockedForTeacher
                    ? 'Bell schedules and non-school days are locked by your administrator.'
                    : 'Master curriculum uploads are locked by your administrator.'}
              </span>
            </div>
            <span className="hidden md:inline text-[11px] font-medium text-slate-400 shrink-0">
              {hasMasterSchedules ? 'Skyward Synced' : 'Admin Governed'}
            </span>
          </div>
        )}

        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-[0_2px_10px_rgba(15,23,42,0.03)] p-5 sm:p-8">
          <ViewSwitcher activeView={activeView} onChangeView={setActiveView} />

          {workspaceLoading ? (
            <div className="py-20 text-center space-y-2">
              <div className="w-7 h-7 rounded-full border-2 border-[#1D2F6F] border-t-transparent animate-spin mx-auto" />
              <p className="text-xs font-medium text-slate-500">
                Loading your K-5 pacing workspace...
              </p>
            </div>
          ) : (
            <>
              {activeView === 'daily' && (
                <DailyDashboard
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  todayISO={todayISO}
                  subjects={gradeSubjects}
                  lessons={gradeLessons}
                  nonSchoolDays={effectiveNonSchoolDays}
                  isEditor={effectiveCanEditLessons}
                  onOpenLesson={(lesson) => {
                    setDraftSlot(null);
                    setActiveLesson(lesson);
                  }}
                  onCreateLessonForSlot={(subjectId, date) => {
                    if (curriculumLockedForTeacher) return;
                    setActiveLesson(null);
                    setDraftSlot({ subjectId, date });
                  }}
                  onToggleComplete={handleToggleComplete}
                />
              )}

              {activeView === 'weekly' && (
                <WeeklyView
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onJumpToDaily={(iso) => {
                    setSelectedDate(iso);
                    setActiveView('daily');
                  }}
                  todayISO={todayISO}
                  subjects={gradeSubjects}
                  lessons={gradeLessons}
                  nonSchoolDays={effectiveNonSchoolDays}
                  isEditor={effectiveCanEditLessons}
                  onOpenLesson={(lesson) => {
                    setDraftSlot(null);
                    setActiveLesson(lesson);
                  }}
                  onCreateLessonForSlot={(subjectId, date) => {
                    if (curriculumLockedForTeacher) return;
                    setActiveLesson(null);
                    setDraftSlot({ subjectId, date });
                  }}
                  onShiftSingleLesson={handleShiftSingleLesson}
                />
              )}

              {activeView === 'pacing' && (
                <PacingGuideView
                  selectedDate={selectedDate}
                  subjects={gradeSubjects}
                  lessons={gradeLessons}
                  isEditor={effectiveCanEditLessons}
                  onOpenLesson={(lesson) => {
                    setDraftSlot(null);
                    setActiveLesson(lesson);
                  }}
                  onToggleComplete={handleToggleComplete}
                  onBulkShiftPacing={handleBulkShiftPacing}
                />
              )}

              {activeView === 'builder' && (
                <CurriculumBuilderView
                  selectedGrade={selectedGrade}
                  gradeLabel={gradeLabel}
                  selectedDate={selectedDate}
                  subjects={gradeSubjects}
                  lessons={gradeLessons}
                  nonSchoolDays={effectiveNonSchoolDays}
                  isEditor={isEditor}
                  isAdmin={isAdmin}
                  governance={governance}
                  onOpenAdminConsole={() => setAdminConsoleOpen(true)}
                  onEnableEditor={async () => {
                    await saveProfileSettings(uid, {
                      ...appState.profile,
                      roleMode: 'editor',
                    });
                    showToast('Editor Mode enabled');
                  }}
                  onAddLessonsBatch={handleAddLessonsBatch}
                  onImportCurriculumLessons={handleImportCurriculumLessons}
                  onDeleteLesson={handleDeleteLesson}
                  onOpenLesson={(lesson) => {
                    setDraftSlot(null);
                    setActiveLesson(lesson);
                  }}
                  onUpdateSubjectTheme={handleUpdateSubjectTheme}
                  onAddNonSchoolDay={handleAddNonSchoolDay}
                  onImportNonSchoolDaysBatch={handleImportNonSchoolDaysBatch}
                  onDeleteNonSchoolDay={handleDeleteNonSchoolDay}
                  onExportBackup={handleExportBackup}
                  onImportBackup={handleImportBackup}
                  onResetDefaults={handleResetDefaults}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      <LessonModal
        lesson={activeLesson}
        draftSlot={draftSlot}
        grade={selectedGrade}
        gradeLabel={gradeLabel}
        subjects={gradeSubjects}
        isEditor={isEditor}
        isAdmin={isAdmin}
        curriculumLocked={governance.lockCurriculumUploads}
        onClose={() => {
          setActiveLesson(null);
          setDraftSlot(null);
        }}
        onSave={handleSaveLesson}
        onDelete={handleDeleteLesson}
      />

      <ScheduleModal
        open={scheduleModalOpen}
        selectedGrade={selectedGrade}
        gradeLabel={gradeLabel}
        subjects={gradeSubjects}
        existingSchedulesByGrade={effectiveSchedulesByGrade}
        isAdmin={isAdmin}
        lockedByAdmin={governance.lockTeacherSchedules}
        onOpenAdminConsole={() => setAdminConsoleOpen(true)}
        onClose={() => setScheduleModalOpen(false)}
        onSaveSchedule={handleSaveSchedule}
        onImportOneRosterSchedules={handleImportOneRosterSchedules}
      />

      <SubPlanModal
        open={subPlanModalOpen}
        selectedDate={selectedDate}
        gradeLabel={gradeLabel}
        profile={appState.profile}
        subjects={gradeSubjects}
        lessons={gradeLessons}
        onClose={() => setSubPlanModalOpen(false)}
      />

      <ProfileModal
        open={profileModalOpen}
        userEmail={user.email}
        profile={appState.profile}
        onClose={() => setProfileModalOpen(false)}
        onSave={handleSaveProfile}
        onLogout={handleLogout}
      />

      {isAdmin && (
        <AdminConsoleModal
          open={adminConsoleOpen}
          currentUid={uid}
          currentEmail={user.email}
          selectedGrade={selectedGrade}
          selectedDate={selectedDate}
          governance={governance}
          masterSchedulesByGrade={effectiveSchedulesByGrade}
          masterNonSchoolDays={masterNonSchoolDays}
          masterLessons={masterLessons}
          onClose={() => setAdminConsoleOpen(false)}
          onSaveGovernance={handleSaveGovernance}
          onPublishMasterSchedules={handlePublishMasterSchedules}
          onPublishMasterNonSchoolDays={handlePublishMasterNonSchoolDays}
          onDeleteMasterNonSchoolDay={handleDeleteMasterNonSchoolDay}
          onPublishMasterCurriculum={handlePublishMasterCurriculum}
          onGrantAdmin={handleGrantAdmin}
          onRevokeAdmin={handleRevokeAdmin}
        />
      )}

      {/* Non-blocking Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-[#182756] text-white text-xs font-semibold shadow-lg border border-white/15"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
