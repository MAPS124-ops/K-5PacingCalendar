import {
  CalendarOff,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Lock,
  Plus,
  Shield,
  Trash2,
  Unlock,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { GRADES } from '../data/seedData';
import {
  CardTheme,
  GradeLevel,
  LessonItem,
  NonSchoolDay,
  SchoolGovernance,
  SubjectBlock,
} from '../types/pacing';
import { formatSlashDate } from '../utils/dateUtils';
import {
  OneRosterBundleResult,
  OneRosterParsedClass,
  oneRosterClassesToSubjectBlocks,
  ParsedICSEvent,
  parseICSNonSchoolDays,
  parseOneRosterBundle,
  SAMPLE_ONEROSTER_CLASSES_CSV,
} from '../utils/oneRosterParser';
import { CARD_THEMES } from '../utils/themeUtils';
import { CurriculumUploadPanel } from './CurriculumUploadPanel';

type AdminTab = 'governance' | 'oneroster' | 'calendar' | 'curriculum' | 'access';

interface AdminConsoleModalProps {
  open: boolean;
  currentUid: string;
  currentEmail: string | null;
  selectedGrade: GradeLevel;
  selectedDate: string;
  governance: SchoolGovernance;
  masterSchedulesByGrade: Record<GradeLevel, SubjectBlock[]>;
  masterNonSchoolDays: NonSchoolDay[];
  masterLessons: LessonItem[];
  onClose: () => void;
  onSaveGovernance: (nextGov: SchoolGovernance) => Promise<void>;
  onPublishMasterSchedules: (
    updatedByGrade: Partial<Record<GradeLevel, SubjectBlock[]>>
  ) => Promise<void>;
  onPublishMasterNonSchoolDays: (days: NonSchoolDay[]) => Promise<void>;
  onDeleteMasterNonSchoolDay: (dayId: string) => Promise<void>;
  onPublishMasterCurriculum: (
    lessonsToInsert: LessonItem[],
    lessonIdsToDelete: string[]
  ) => Promise<void>;
  onGrantAdmin: (uid: string, label: string) => Promise<void>;
  onRevokeAdmin: (uid: string) => Promise<void>;
}

export function AdminConsoleModal({
  open,
  currentUid,
  currentEmail,
  selectedGrade,
  selectedDate,
  governance,
  masterSchedulesByGrade,
  masterNonSchoolDays,
  masterLessons,
  onClose,
  onSaveGovernance,
  onPublishMasterSchedules,
  onPublishMasterNonSchoolDays,
  onDeleteMasterNonSchoolDay,
  onPublishMasterCurriculum,
  onGrantAdmin,
  onRevokeAdmin,
}: AdminConsoleModalProps) {
  const [tab, setTab] = useState<AdminTab>('governance');
  const [savingGov, setSavingGov] = useState(false);

  // OneRoster State
  const [orFiles, setOrFiles] = useState<Record<string, string>>({});
  const [orClasses, setOrClasses] = useState<OneRosterParsedClass[]>([]);
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState<GradeLevel | 'all'>('all');
  const [applyMode, setApplyMode] = useState<'merge' | 'replace'>('replace');
  const [publishingSchedules, setPublishingSchedules] = useState(false);
  const orInputRef = useRef<HTMLInputElement>(null);

  // Calendar (.ics & manual) State
  const [icsEvents, setIcsEvents] = useState<ParsedICSEvent[]>([]);
  const [manualDate, setManualDate] = useState('2026-11-06');
  const [manualLabel, setManualLabel] = useState('');
  const icsInputRef = useRef<HTMLInputElement>(null);

  // Master Curriculum Grade Selector
  const [curriculumGrade, setCurriculumGrade] = useState<GradeLevel>(selectedGrade);

  // Admin Access State
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminLabel, setNewAdminLabel] = useState('');
  const [copiedUid, setCopiedUid] = useState(false);

  useEffect(() => {
    if (open) {
      setCurriculumGrade(selectedGrade);
    }
  }, [open, selectedGrade]);

  const parsedBundle: OneRosterBundleResult | null = useMemo(() => {
    if (Object.keys(orFiles).length === 0) return null;
    return parseOneRosterBundle(orFiles, selectedGrade);
  }, [orFiles, selectedGrade]);

  useEffect(() => {
    if (parsedBundle) {
      setOrClasses(parsedBundle.classes);
      setTeacherFilter('all');
      setGradeFilter('all');
    } else {
      setOrClasses([]);
    }
  }, [parsedBundle]);

  const filteredClasses = useMemo(() => {
    return orClasses.filter((cls) => {
      if (teacherFilter !== 'all' && !cls.teacherIds.includes(teacherFilter)) {
        return false;
      }
      if (gradeFilter !== 'all' && cls.grade !== gradeFilter) {
        return false;
      }
      return true;
    });
  }, [orClasses, teacherFilter, gradeFilter]);

  if (!open) return null;

  const toggleGovFlag = async (
    key: 'lockTeacherSchedules' | 'lockCurriculumUploads'
  ) => {
    setSavingGov(true);
    try {
      await onSaveGovernance({
        ...governance,
        [key]: !governance[key],
      });
    } finally {
      setSavingGov(false);
    }
  };

  const handleOneRosterFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const loaded: Record<string, string> = {};
    await Promise.all(
      files.map(
        (file) =>
          new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                loaded[file.name] = reader.result;
              }
              resolve();
            };
            reader.readAsText(file);
          })
      )
    );
    setOrFiles((prev) => ({ ...prev, ...loaded }));
    e.target.value = '';
  };

  const handleDownloadSampleOneRoster = () => {
    const blob = new Blob([SAMPLE_ONEROSTER_CLASSES_CSV], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'classes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const includedClasses = filteredClasses.filter((c) => c.included);

  const handlePublishOneRoster = async () => {
    if (includedClasses.length === 0) return;
    setPublishingSchedules(true);
    try {
      const byGrade: Partial<Record<GradeLevel, SubjectBlock[]>> = {};
      const grouped = new Map<GradeLevel, OneRosterParsedClass[]>();
      includedClasses.forEach((cls) => {
        const list = grouped.get(cls.grade) ?? [];
        list.push(cls);
        grouped.set(cls.grade, list);
      });

      grouped.forEach((clsList, grade) => {
        const importedBlocks = oneRosterClassesToSubjectBlocks(clsList);
        if (applyMode === 'replace') {
          byGrade[grade] = importedBlocks;
        } else {
          const current = [...(masterSchedulesByGrade[grade] ?? [])];
          importedBlocks.forEach((imp) => {
            const idx = current.findIndex(
              (c) =>
                c.name.trim().toLowerCase() === imp.name.trim().toLowerCase() ||
                c.id === imp.id
            );
            if (idx !== -1) {
              current[idx] = {
                ...current[idx],
                timeLabel: imp.timeLabel || current[idx].timeLabel,
                visible: true,
              };
            } else {
              current.push({ ...imp, order: current.length });
            }
          });
          byGrade[grade] = current.map((item, idx) => ({ ...item, order: idx }));
        }
      });

      await onPublishMasterSchedules(byGrade);
      setOrFiles({});
    } finally {
      setPublishingSchedules(false);
    }
  };

  const handleICSChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setIcsEvents(parseICSNonSchoolDays(reader.result));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmICS = async () => {
    const selected = icsEvents.filter((ev) => ev.included);
    if (selected.length === 0) return;
    const existingKeys = new Set(
      masterNonSchoolDays.map((d) => `${d.date}::${d.label.toLowerCase()}`)
    );
    const stamp = Date.now();
    const toAdd: NonSchoolDay[] = selected
      .filter((ev) => !existingKeys.has(`${ev.date}::${ev.label.toLowerCase()}`))
      .map((ev, idx) => ({
        id: `mnsd-${stamp}-${idx}`,
        date: ev.date,
        label: ev.label,
      }));
    if (toAdd.length > 0) {
      await onPublishMasterNonSchoolDays(toAdd);
    }
    setIcsEvents([]);
  };

  const handleAddManualMasterDay = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualDate || !manualLabel.trim()) return;
    await onPublishMasterNonSchoolDays([
      {
        id: `mnsd-${Date.now()}`,
        date: manualDate,
        label: manualLabel.trim(),
      },
    ]);
    setManualLabel('');
  };

  const handleCopyUid = async () => {
    try {
      await navigator.clipboard.writeText(currentUid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleGrantAdminSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAdminUid.trim()) return;
    await onGrantAdmin(
      newAdminUid.trim(),
      newAdminLabel.trim() || 'Milford Administrator'
    );
    setNewAdminUid('');
    setNewAdminLabel('');
  };

  const masterSubjectsForGrade = masterSchedulesByGrade[curriculumGrade] ?? [];
  const masterLessonsForGrade = masterLessons.filter(
    (l) => l.grade === curriculumGrade
  );
  const curriculumGradeLabel =
    GRADES.find((g) => g.id === curriculumGrade)?.label ?? '1st Grade';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Milford Grade School Admin Console"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#182756] text-white px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold truncate">
                Skyward & School Admin Console
              </h2>
              <p className="text-xs text-white/75 truncate">
                {governance.schoolName} · Signed in as {currentEmail || currentUid}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close admin console"
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="px-6 py-3 border-b border-slate-200 bg-[#F9FAFC] flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'governance', label: 'Teacher Locks & Governance' },
              { id: 'oneroster', label: 'Skyward OneRoster Schedules' },
              { id: 'calendar', label: 'Skyward Bell & Holiday Calendar' },
              { id: 'curriculum', label: 'Master Curriculum Guides' },
              { id: 'access', label: 'Admin Access' },
            ] as Array<{ id: AdminTab; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                tab === item.id
                  ? 'bg-[#1D2F6F] text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {tab === 'governance' && (
            <div className="space-y-5">
              <div>
                <h3 className="font-display text-base font-bold text-[#182756]">
                  Teacher Permissions & Skyward Governance
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Control what teachers at {governance.schoolName} can upload or modify. Enforced in both the app interface and Firestore security rules.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-5 bg-white flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {governance.lockTeacherSchedules ? (
                        <Lock className="w-4 h-4 text-[#1D2F6F]" />
                      ) : (
                        <Unlock className="w-4 h-4 text-slate-500" />
                      )}
                      <h4 className="font-display text-sm font-bold text-[#182756]">
                        Lock Teacher Schedules & Bell Calendar
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      When locked, teachers automatically receive the Admin-published Skyward OneRoster schedules and non-school days, and cannot upload OneRoster files or edit schedule blocks or holidays.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={savingGov}
                    onClick={() => toggleGovFlag('lockTeacherSchedules')}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      governance.lockTeacherSchedules
                        ? 'bg-[#1D2F6F] text-white hover:bg-[#152459]'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {governance.lockTeacherSchedules
                      ? 'Locked (Teachers Read-Only)'
                      : 'Unlocked (Teachers May Edit)'}
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 p-5 bg-white flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {governance.lockCurriculumUploads ? (
                        <Lock className="w-4 h-4 text-[#1D2F6F]" />
                      ) : (
                        <Unlock className="w-4 h-4 text-slate-500" />
                      )}
                      <h4 className="font-display text-sm font-bold text-[#182756]">
                        Lock Teacher Curriculum Guide Uploads
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      When locked, teachers cannot upload CSV curriculum guides, create/delete lessons, or reset data. Teachers can still check off taught lessons and write personal notes & sub plans.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={savingGov}
                    onClick={() => toggleGovFlag('lockCurriculumUploads')}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      governance.lockCurriculumUploads
                        ? 'bg-[#1D2F6F] text-white hover:bg-[#152459]'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {governance.lockCurriculumUploads
                      ? 'Locked (Admin Publishes Guides)'
                      : 'Unlocked (Teachers May Upload)'}
                  </button>
                </div>
              </div>

              {/* Current School-Wide Summary */}
              <div className="rounded-xl border border-slate-200 bg-[#F9FAFC] p-5">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#182756] mb-3">
                  Published Master School Data Status
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 rounded-lg bg-white border border-slate-200">
                    <div className="text-slate-500">Master Schedule Blocks</div>
                    <div className="font-display text-lg font-bold text-[#182756] mt-0.5 tabular-nums">
                      {Object.values(masterSchedulesByGrade).reduce(
                        (sum, arr) => sum + arr.length,
                        0
                      )}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-white border border-slate-200">
                    <div className="text-slate-500">School Non-School Days</div>
                    <div className="font-display text-lg font-bold text-[#182756] mt-0.5 tabular-nums">
                      {masterNonSchoolDays.length}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-white border border-slate-200">
                    <div className="text-slate-500">Master Curriculum Lessons</div>
                    <div className="font-display text-lg font-bold text-[#182756] mt-0.5 tabular-nums">
                      {masterLessons.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'oneroster' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-[#F9FAFC] p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#182756]">
                      Publish Skyward OneRoster K–5 Schedules
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Upload <code className="font-mono">classes.csv</code> (required) and optional{' '}
                      <code className="font-mono">courses.csv</code>,{' '}
                      <code className="font-mono">users.csv</code>,{' '}
                      <code className="font-mono">enrollments.csv</code>, and{' '}
                      <code className="font-mono">academicSessions.csv</code>. Published blocks sync to all teachers.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => orInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] cursor-pointer shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload OneRoster CSVs</span>
                  </button>
                  <input
                    ref={orInputRef}
                    type="file"
                    multiple
                    accept=".csv,text/csv"
                    onChange={handleOneRosterFiles}
                    className="hidden"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setOrFiles({
                          'classes.csv': SAMPLE_ONEROSTER_CLASSES_CSV,
                        })
                      }
                      className="font-semibold text-[#1D2F6F] hover:underline cursor-pointer"
                    >
                      Load sample OneRoster classes.csv
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleDownloadSampleOneRoster}
                      className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-[#1D2F6F] cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download template</span>
                    </button>
                  </div>
                  {parsedBundle && (
                    <span className="font-semibold text-emerald-700">
                      Loaded: {parsedBundle.loadedFiles.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              {parsedBundle?.warnings && parsedBundle.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 space-y-1">
                  {parsedBundle.warnings.map((w, idx) => (
                    <p key={idx}>{w}</p>
                  ))}
                </div>
              )}

              {orClasses.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Filter by Teacher
                      </label>
                      <select
                        value={teacherFilter}
                        onChange={(e) => setTeacherFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                      >
                        <option value="all">
                          All Teachers ({parsedBundle?.teachers.length ?? 0})
                        </option>
                        {parsedBundle?.teachers.map((t) => (
                          <option key={t.sourcedId} value={t.sourcedId}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Filter by Grade
                      </label>
                      <select
                        value={gradeFilter}
                        onChange={(e) =>
                          setGradeFilter(e.target.value as GradeLevel | 'all')
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                      >
                        <option value="all">All K–5 Grades</option>
                        {GRADES.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Publish Mode
                      </label>
                      <select
                        value={applyMode}
                        onChange={(e) =>
                          setApplyMode(e.target.value as 'merge' | 'replace')
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                      >
                        <option value="replace">
                          Replace Master Grade Schedules
                        </option>
                        <option value="merge">
                          Merge & Update Bell Times
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 overflow-x-auto max-h-72">
                    <table className="w-full min-w-[600px] border-collapse text-left text-xs">
                      <thead className="bg-[#EEF1F8] border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-[#182756] sticky top-0">
                        <tr>
                          <th className="py-2 px-3 w-10 text-center">Use</th>
                          <th className="py-2 px-3 w-24">Grade</th>
                          <th className="py-2 px-3">Class / Subject Name</th>
                          <th className="py-2 px-3 w-36">Bell Time / Period</th>
                          <th className="py-2 px-3 w-32">Theme</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredClasses.map((cls) => (
                          <tr
                            key={cls.tempId}
                            className={cls.included ? 'bg-white' : 'bg-slate-50 opacity-50'}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={cls.included}
                                onChange={(e) =>
                                  setOrClasses((prev) =>
                                    prev.map((item) =>
                                      item.tempId === cls.tempId
                                        ? { ...item, included: e.target.checked }
                                        : item
                                    )
                                  )
                                }
                                className="rounded border-slate-300"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={cls.grade}
                                onChange={(e) =>
                                  setOrClasses((prev) =>
                                    prev.map((item) =>
                                      item.tempId === cls.tempId
                                        ? {
                                            ...item,
                                            grade: e.target.value as GradeLevel,
                                          }
                                        : item
                                    )
                                  )
                                }
                                className="px-2 py-1 rounded border border-slate-200 text-xs font-semibold text-[#182756]"
                              >
                                {GRADES.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.shortLabel}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={cls.title}
                                maxLength={80}
                                onChange={(e) =>
                                  setOrClasses((prev) =>
                                    prev.map((item) =>
                                      item.tempId === cls.tempId
                                        ? { ...item, title: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-semibold text-[#182756]"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={cls.timeLabel}
                                maxLength={40}
                                onChange={(e) =>
                                  setOrClasses((prev) =>
                                    prev.map((item) =>
                                      item.tempId === cls.tempId
                                        ? { ...item, timeLabel: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="w-full px-2 py-1 rounded border border-slate-200 text-xs tabular-nums"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={cls.defaultTheme}
                                onChange={(e) =>
                                  setOrClasses((prev) =>
                                    prev.map((item) =>
                                      item.tempId === cls.tempId
                                        ? {
                                            ...item,
                                            defaultTheme: e.target.value as CardTheme,
                                          }
                                        : item
                                    )
                                  )
                                }
                                className="w-full px-2 py-1 rounded border border-slate-200 text-xs"
                              >
                                {(Object.keys(CARD_THEMES) as CardTheme[]).map(
                                  (t) => (
                                    <option key={t} value={t}>
                                      {CARD_THEMES[t].label}
                                    </option>
                                  )
                                )}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500 tabular-nums">
                      {includedClasses.length} schedule blocks selected
                    </span>
                    <button
                      type="button"
                      disabled={publishingSchedules || includedClasses.length === 0}
                      onClick={handlePublishOneRoster}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] disabled:opacity-45 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>
                        {publishingSchedules
                          ? 'Publishing...'
                          : `Publish to ${governance.schoolName}`}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'calendar' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-[#F9FAFC] p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#182756]">
                      Upload Skyward Bell & Holiday Calendar (.ics)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Import district holidays, breaks, and institute days for all Milford Grade School teachers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => icsInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] cursor-pointer shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload .ics</span>
                  </button>
                  <input
                    ref={icsInputRef}
                    type="file"
                    accept=".ics,text/calendar"
                    onChange={handleICSChange}
                    className="hidden"
                  />
                </div>

                {icsEvents.length > 0 && (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#182756]">
                        Select non-school dates to publish:
                      </span>
                      <button
                        type="button"
                        onClick={() => setIcsEvents([])}
                        className="text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                      {icsEvents.map((ev) => (
                        <label
                          key={ev.tempId}
                          className="py-1.5 flex items-center gap-2 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={ev.included}
                            onChange={(e) =>
                              setIcsEvents((prev) =>
                                prev.map((item) =>
                                  item.tempId === ev.tempId
                                    ? { ...item, included: e.target.checked }
                                    : item
                                )
                              )
                            }
                            className="rounded border-slate-300"
                          />
                          <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                            {formatSlashDate(ev.date)}
                          </span>
                          <span className="text-slate-800 truncate">
                            {ev.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleConfirmICS}
                      className="w-full py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] cursor-pointer"
                    >
                      Publish {icsEvents.filter((e) => e.included).length} Dates to School Calendar
                    </button>
                  </div>
                )}

                <form
                  onSubmit={handleAddManualMasterDay}
                  className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs tabular-nums"
                  />
                  <input
                    type="text"
                    value={manualLabel}
                    onChange={(e) => setManualLabel(e.target.value)}
                    placeholder="Add holiday or institute day..."
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Date</span>
                  </button>
                </form>
              </div>

              <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-[#EEF1F8] border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarOff className="w-4 h-4 text-[#1D2F6F]" />
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-[#182756]">
                      Published School Non-School Days
                    </span>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {masterNonSchoolDays.length === 0 ? (
                    <li className="p-6 text-center text-xs text-slate-400">
                      No school-wide non-school days published yet.
                    </li>
                  ) : (
                    [...masterNonSchoolDays]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((nsd) => (
                        <li
                          key={nsd.id}
                          className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-[#182756] tabular-nums mr-2">
                              {formatSlashDate(nsd.date)}
                            </span>
                            <span className="text-slate-700 truncate">
                              {nsd.label}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onDeleteMasterNonSchoolDay(nsd.id)}
                            aria-label={`Delete ${nsd.label}`}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))
                  )}
                </ul>
              </div>
            </div>
          )}

          {tab === 'curriculum' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#F9FAFC] px-4 py-3">
                <div>
                  <h3 className="font-display text-sm font-bold text-[#182756]">
                    Publish Master Curriculum Guide to {governance.schoolName}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Lessons published here appear automatically for every teacher in the selected grade level.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="text-xs font-semibold text-slate-700">
                    Target Grade:
                  </label>
                  <select
                    value={curriculumGrade}
                    onChange={(e) =>
                      setCurriculumGrade(e.target.value as GradeLevel)
                    }
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#182756]"
                  >
                    {GRADES.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <CurriculumUploadPanel
                selectedGrade={curriculumGrade}
                gradeLabel={curriculumGradeLabel}
                selectedDate={selectedDate}
                subjects={masterSubjectsForGrade}
                existingLessons={masterLessonsForGrade}
                nonSchoolDays={masterNonSchoolDays}
                isEditor={true}
                onImportLessons={onPublishMasterCurriculum}
              />
            </div>
          )}

          {tab === 'access' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-200 bg-[#F9FAFC] p-5 space-y-3">
                <h3 className="font-display text-sm font-bold text-[#182756]">
                  Your Admin Identity
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Share your User UID if another district administrator needs to verify or manage permissions.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono text-[11px] text-slate-800 truncate">
                    {currentUid}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyUid}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#182756] hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    {copiedUid ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedUid ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleGrantAdminSubmit}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#1D2F6F]" />
                  <h3 className="font-display text-sm font-bold text-[#182756]">
                    Grant or Revoke School Admin Access
                  </h3>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Staff Firebase User UID *
                  </label>
                  <input
                    type="text"
                    required
                    value={newAdminUid}
                    onChange={(e) => setNewAdminUid(e.target.value)}
                    placeholder="Paste staff user UID"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Role / Name Label
                  </label>
                  <input
                    type="text"
                    value={newAdminLabel}
                    onChange={(e) => setNewAdminLabel(e.target.value)}
                    placeholder="e.g. Principal / Curriculum Lead"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] cursor-pointer"
                  >
                    Grant Admin Access
                  </button>
                  <button
                    type="button"
                    disabled={!newAdminUid.trim()}
                    onClick={async () => {
                      if (!newAdminUid.trim()) return;
                      await onRevokeAdmin(newAdminUid.trim());
                      setNewAdminUid('');
                    }}
                    className="px-3 py-2 rounded-lg border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-45 cursor-pointer"
                  >
                    Revoke UID
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
