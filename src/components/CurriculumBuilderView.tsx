import {
  CalendarOff,
  Download,
  FileSpreadsheet,
  Layers,
  Lock,
  Plus,
  RotateCcw,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import {
  CardTheme,
  GradeLevel,
  LessonItem,
  NonSchoolDay,
  SchoolGovernance,
  SubjectBlock,
} from '../types/pacing';
import { addSchoolDaysISO, formatSlashDate } from '../utils/dateUtils';
import { ParsedICSEvent, parseICSNonSchoolDays } from '../utils/oneRosterParser';
import { CARD_THEMES } from '../utils/themeUtils';
import { CurriculumUploadPanel } from './CurriculumUploadPanel';

type BuilderSection = 'upload' | 'sequence' | 'settings';

interface CurriculumBuilderViewProps {
  selectedGrade: GradeLevel;
  gradeLabel: string;
  selectedDate: string;
  subjects: SubjectBlock[];
  lessons: LessonItem[];
  nonSchoolDays: NonSchoolDay[];
  isEditor: boolean;
  isAdmin: boolean;
  governance: SchoolGovernance;
  onOpenAdminConsole: () => void;
  onEnableEditor: () => void;
  onAddLessonsBatch: (newLessons: LessonItem[]) => void;
  onImportCurriculumLessons: (
    lessonsToInsert: LessonItem[],
    lessonIdsToDelete: string[]
  ) => Promise<void>;
  onDeleteLesson: (lessonId: string) => void;
  onOpenLesson: (lesson: LessonItem) => void;
  onUpdateSubjectTheme: (subjectId: string, theme: CardTheme) => void;
  onAddNonSchoolDay: (date: string, label: string) => void;
  onImportNonSchoolDaysBatch: (days: NonSchoolDay[]) => Promise<void>;
  onDeleteNonSchoolDay: (id: string) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonText: string) => void;
  onResetDefaults: () => void;
}

export function CurriculumBuilderView({
  selectedGrade,
  gradeLabel,
  selectedDate,
  subjects,
  lessons,
  nonSchoolDays,
  isEditor,
  isAdmin,
  governance,
  onOpenAdminConsole,
  onEnableEditor,
  onAddLessonsBatch,
  onImportCurriculumLessons,
  onDeleteLesson,
  onOpenLesson,
  onUpdateSubjectTheme,
  onAddNonSchoolDay,
  onImportNonSchoolDaysBatch,
  onDeleteNonSchoolDay,
  onExportBackup,
  onImportBackup,
  onResetDefaults,
}: CurriculumBuilderViewProps) {
  const sortedSubjects = [...subjects].sort((a, b) => a.order - b.order);

  const curriculumLockedForUser = governance.lockCurriculumUploads && !isAdmin;
  const schedulesLockedForUser = governance.lockTeacherSchedules && !isAdmin;

  const [section, setSection] = useState<BuilderSection>(
    curriculumLockedForUser ? 'settings' : 'upload'
  );

  const [subjectId, setSubjectId] = useState(
    sortedSubjects[0]?.id ?? 'arts-letters'
  );
  const [unitTitle, setUnitTitle] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [startDate, setStartDate] = useState(selectedDate);
  const [dayCount, setDayCount] = useState(1);
  const [standards, setStandards] = useState('');
  const [slidesUrl, setSlidesUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [prepFlag, setPrepFlag] = useState(false);

  const [nsdDate, setNsdDate] = useState('2026-11-06');
  const [nsdLabel, setNsdLabel] = useState('');
  const [icsEvents, setIcsEvents] = useState<ParsedICSEvent[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);

  const handleCreateSequence = (e: FormEvent) => {
    e.preventDefault();
    if (!isEditor || curriculumLockedForUser) return;
    if (!unitTitle.trim() || !lessonTitle.trim()) return;

    const count = Math.max(1, Math.min(20, dayCount));
    const batch: LessonItem[] = [];
    for (let i = 0; i < count; i++) {
      const targetDate = addSchoolDaysISO(startDate, i, nonSchoolDays);
      batch.push({
        id: `custom-${selectedGrade}-${Date.now()}-${i}`,
        grade: selectedGrade,
        subjectId,
        date: targetDate,
        unitTitle:
          count > 1 ? `${unitTitle.trim()} (Day ${i + 1})` : unitTitle.trim(),
        lessonTitle: lessonTitle.trim(),
        standards: standards.trim() || undefined,
        slidesUrl: slidesUrl.trim() || undefined,
        prepFlag,
        notes: notes.trim(),
        completed: false,
      });
    }

    onAddLessonsBatch(batch);
    setUnitTitle('');
    setLessonTitle('');
    setStandards('');
    setSlidesUrl('');
    setNotes('');
    setDayCount(1);
    setPrepFlag(false);
  };

  const handleAddNsd = (e: FormEvent) => {
    e.preventDefault();
    if (!isEditor || schedulesLockedForUser || !nsdDate || !nsdLabel.trim()) return;
    onAddNonSchoolDay(nsdDate, nsdLabel.trim());
    setNsdLabel('');
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportBackup(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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

  const handleConfirmICSImport = async () => {
    const selected = icsEvents.filter((ev) => ev.included);
    if (selected.length === 0) return;
    const existingKeys = new Set(
      nonSchoolDays.map((d) => `${d.date}::${d.label.toLowerCase()}`)
    );
    const stamp = Date.now();
    const toAdd: NonSchoolDay[] = selected
      .filter((ev) => !existingKeys.has(`${ev.date}::${ev.label.toLowerCase()}`))
      .map((ev, idx) => ({
        id: `ics-${stamp}-${idx}`,
        date: ev.date,
        label: ev.label,
      }));
    if (toAdd.length > 0) {
      await onImportNonSchoolDaysBatch(toAdd);
    }
    setIcsEvents([]);
  };

  const recentGradeLessons = [...lessons]
    .filter((l) => l.date >= selectedDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 14);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-[#182756]">
            Curriculum Builder
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5">
            {curriculumLockedForUser
              ? `View ${governance.schoolName} curriculum configuration and export backups for ${gradeLabel}.`
              : `Upload multi-program pacing guides, build lesson sequences, and manage school holidays for ${gradeLabel}.`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenAdminConsole}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#008678] text-white text-xs font-semibold hover:bg-[#007367] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Publish School-Wide in Admin Console</span>
            </button>
          )}
          {!isEditor && !curriculumLockedForUser && (
            <button
              type="button"
              onClick={onEnableEditor}
              className="px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Switch to Editor Mode
            </button>
          )}
        </div>
      </div>

      {/* Sub-Navigation inside Curriculum Builder */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSection('upload')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            section === 'upload'
              ? 'bg-[#1D2F6F] text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
          }`}
        >
          {curriculumLockedForUser ? (
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>Upload Curriculum Guide</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('sequence')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            section === 'sequence'
              ? 'bg-[#1D2F6F] text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
          }`}
        >
          {curriculumLockedForUser ? (
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>Manual Sequence & Lessons</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('settings')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            section === 'settings'
              ? 'bg-[#1D2F6F] text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
          }`}
        >
          <CalendarOff className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Colors, Holidays & Backup</span>
        </button>
      </div>

      {section === 'upload' && (
        curriculumLockedForUser ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="font-display text-sm font-bold text-amber-950">
                Curriculum Uploads Are Managed by Your Administrator
              </h2>
              <p className="text-xs text-amber-900 leading-relaxed">
                {governance.schoolName} has locked curriculum guide uploads so master pacing stays aligned across every classroom. You can still view lessons, mark them as taught, add personal notes, and print substitute plans.
              </p>
            </div>
          </div>
        ) : (
          <CurriculumUploadPanel
            selectedGrade={selectedGrade}
            gradeLabel={gradeLabel}
            selectedDate={selectedDate}
            subjects={subjects}
            existingLessons={lessons}
            nonSchoolDays={nonSchoolDays}
            isEditor={isEditor}
            onImportLessons={onImportCurriculumLessons}
          />
        )
      )}

      {section === 'sequence' && (
        curriculumLockedForUser ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="font-display text-sm font-bold text-amber-950">
                  Lesson Sequencing Is Locked by Administrator
                </h2>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {governance.schoolName} manages lesson pacing centrally. Teachers cannot add or delete paced lessons, though you can click any scheduled lesson to mark it taught or add personal classroom notes.
                </p>
              </div>
            </div>

            {/* Right: Read-only Upcoming Scheduled Lessons */}
            <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3.5 bg-[#EEF1F8] border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-[#182756]">
                  Upcoming ({formatSlashDate(selectedDate)}+)
                </h2>
                <span className="text-[11px] font-medium text-slate-500">
                  Click row to view & add notes
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                {recentGradeLessons.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No upcoming lessons scheduled on or after{' '}
                    {formatSlashDate(selectedDate)}.
                  </div>
                ) : (
                  recentGradeLessons.map((lesson) => {
                    const subj = subjects.find((s) => s.id === lesson.subjectId);
                    return (
                      <div
                        key={lesson.id}
                        onClick={() => onOpenLesson(lesson)}
                        className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                              {formatSlashDate(lesson.date)}
                            </span>
                            <span className="font-semibold text-[#182756] truncate">
                              {subj?.name ?? lesson.subjectId}
                            </span>
                          </div>
                          <p className="text-slate-600 truncate mt-0.5">
                            {lesson.unitTitle} — {lesson.lessonTitle}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Auto-Paced Unit / Lesson Generator */}
            <form
              onSubmit={handleCreateSequence}
              className="lg:col-span-7 rounded-xl border border-slate-200 bg-[#F9FAFC] p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#1D2F6F]" aria-hidden="true" />
                  <h2 className="font-display text-sm font-bold text-[#182756]">
                    Add Lesson or Auto-Paced Unit Sequence
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  Skips weekends & holidays
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject Block
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    disabled={!isEditor}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1D2F6F]/25"
                  >
                    {sortedSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={!isEditor}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      School Days
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={dayCount}
                      onChange={(e) => setDayCount(Number(e.target.value) || 1)}
                      disabled={!isEditor}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit / Header Label *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isEditor}
                    value={unitTitle}
                    onChange={(e) => setUnitTitle(e.target.value)}
                    placeholder="e.g. Module 2 Lesson 4"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lesson Focus / Title *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isEditor}
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    placeholder="e.g. Comparing Fractions"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Standards Code (optional)
                  </label>
                  <input
                    type="text"
                    disabled={!isEditor}
                    value={standards}
                    onChange={(e) => setStandards(e.target.value)}
                    placeholder="e.g. CCSS.MATH.1.OA.3"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Slides / Resource URL (optional)
                  </label>
                  <input
                    type="url"
                    disabled={!isEditor}
                    value={slidesUrl}
                    onChange={(e) => setSlidesUrl(e.target.value)}
                    placeholder="https://docs.google.com/presentation/..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teacher & Sub Plan Notes
                </label>
                <textarea
                  rows={2}
                  disabled={!isEditor}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Materials, warm-up prompts, or small group reminders..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prepFlag}
                    onChange={(e) => setPrepFlag(e.target.checked)}
                    disabled={!isEditor}
                    className="rounded border-slate-300 text-[#1D2F6F]"
                  />
                  <span>Flag with Prep / Printables indicator (P)</span>
                </label>

                <button
                  type="submit"
                  disabled={!isEditor}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] disabled:opacity-45 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {dayCount > 1
                      ? `Pace ${dayCount} School Days`
                      : 'Add to Calendar'}
                  </span>
                </button>
              </div>
            </form>

            {/* Right: Upcoming Scheduled Lessons Quick Manager */}
            <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3.5 bg-[#EEF1F8] border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-[#182756]">
                  Upcoming ({formatSlashDate(selectedDate)}+)
                </h2>
                <span className="text-[11px] font-medium text-slate-500">
                  Click row to edit
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                {recentGradeLessons.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No upcoming lessons scheduled on or after{' '}
                    {formatSlashDate(selectedDate)}.
                  </div>
                ) : (
                  recentGradeLessons.map((lesson) => {
                    const subj = subjects.find((s) => s.id === lesson.subjectId);
                    return (
                      <div
                        key={lesson.id}
                        onClick={() => onOpenLesson(lesson)}
                        className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                              {formatSlashDate(lesson.date)}
                            </span>
                            <span className="font-semibold text-[#182756] truncate">
                              {subj?.name ?? lesson.subjectId}
                            </span>
                          </div>
                          <p className="text-slate-600 truncate mt-0.5">
                            {lesson.unitTitle} — {lesson.lessonTitle}
                          </p>
                        </div>
                        {isEditor && !lesson.isMaster && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteLesson(lesson.id);
                            }}
                            aria-label="Delete lesson"
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )
      )}

      {section === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Subject Color Themes */}
          <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-display text-sm font-bold text-[#182756]">
                Subject Card Colors ({gradeLabel})
              </h2>
              {schedulesLockedForUser && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  <Lock className="w-3 h-3" />
                  Admin Locked
                </span>
              )}
            </div>
            <div className="space-y-3">
              {sortedSubjects.map((subj) => (
                <div
                  key={subj.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-semibold text-slate-700 truncate">
                    {subj.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(Object.keys(CARD_THEMES) as CardTheme[]).map(
                      (themeKey) => {
                        const active = subj.defaultTheme === themeKey;
                        const disabled = !isEditor || schedulesLockedForUser;
                        return (
                          <button
                            key={themeKey}
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              onUpdateSubjectTheme(subj.id, themeKey)
                            }
                            title={CARD_THEMES[themeKey].label}
                            className={`w-5 h-5 rounded-full ${CARD_THEMES[themeKey].bodyBg} transition-transform ${
                              disabled
                                ? 'cursor-not-allowed opacity-60'
                                : 'cursor-pointer hover:opacity-100'
                            } ${
                              active
                                ? 'ring-2 ring-offset-2 ring-[#182756] scale-110 opacity-100'
                                : 'opacity-70'
                            }`}
                          />
                        );
                      }
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Non-School Days */}
          <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <CalendarOff
                  className="w-4 h-4 text-[#1D2F6F]"
                  aria-hidden="true"
                />
                <h2 className="font-display text-sm font-bold text-[#182756]">
                  Non-School Days & Holidays
                </h2>
              </div>
              {isEditor && !schedulesLockedForUser && (
                <>
                  <button
                    type="button"
                    onClick={() => icsInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-[#1D2F6F] hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Import .ics</span>
                  </button>
                  <input
                    ref={icsInputRef}
                    type="file"
                    accept=".ics,text/calendar"
                    onChange={handleICSChange}
                    className="hidden"
                  />
                </>
              )}
            </div>

            {schedulesLockedForUser && (
              <div className="mb-3 p-2.5 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2 text-[11px] text-amber-900">
                <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-800" />
                <span>
                  Non-school days and Skyward bell calendars are managed centrally by your administrator.
                </span>
              </div>
            )}

            {icsEvents.length > 0 && !schedulesLockedForUser && (
              <div className="mb-3 p-3 rounded-xl border border-slate-200 bg-[#F9FAFC] space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-[#182756]">
                    Select calendar events to mark as Non-School Days:
                  </span>
                  <button
                    type="button"
                    onClick={() => setIcsEvents([])}
                    className="text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-200/60">
                  {icsEvents.map((ev) => (
                    <label
                      key={ev.tempId}
                      className="py-1.5 flex items-center gap-2 text-[11px] cursor-pointer"
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
                      <span className="font-mono text-slate-500 tabular-nums shrink-0">
                        {formatSlashDate(ev.date)}
                      </span>
                      <span className="text-slate-800 truncate">{ev.label}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleConfirmICSImport}
                  className="w-full py-1.5 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] cursor-pointer"
                >
                  Import {icsEvents.filter((e) => e.included).length} Selected Dates
                </button>
              </div>
            )}

            {isEditor && !schedulesLockedForUser && (
              <form onSubmit={handleAddNsd} className="flex gap-2 mb-3">
                <input
                  type="date"
                  value={nsdDate}
                  onChange={(e) => setNsdDate(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs tabular-nums"
                />
                <input
                  type="text"
                  value={nsdLabel}
                  onChange={(e) => setNsdLabel(e.target.value)}
                  placeholder="Holiday or PD Day"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  Add
                </button>
              </form>
            )}

            <ul className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {[...nonSchoolDays]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((nsd) => (
                  <li
                    key={nsd.id}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-[#182756] tabular-nums mr-2">
                        {formatSlashDate(nsd.date)}
                      </span>
                      <span className="text-slate-600 truncate">
                        {nsd.label}
                      </span>
                    </div>
                    {isEditor && !schedulesLockedForUser && !nsd.isMaster && (
                      <button
                        type="button"
                        onClick={() => onDeleteNonSchoolDay(nsd.id)}
                        aria-label={`Remove ${nsd.label}`}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </div>

          {/* Backup & Reset */}
          <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-[#F9FAFC] p-5 space-y-3">
            <h2 className="font-display text-sm font-bold text-[#182756]">
              Data Backup & Restore
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {curriculumLockedForUser || schedulesLockedForUser
                ? 'Export a JSON snapshot of your current grade-level pacing calendar and notes.'
                : 'Changes save automatically to your account. Export a JSON copy to share your full K–5 workspace with grade-level teammates.'}
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={onExportBackup}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#182756] hover:bg-slate-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Pacing JSON</span>
              </button>
              {!curriculumLockedForUser && !schedulesLockedForUser && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Pacing JSON</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-white text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset to Default K-5 Data</span>
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-red-800">
                        Restore defaults?
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmReset(false)}
                          className="px-2 py-1 rounded bg-white text-[11px] font-medium text-slate-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onResetDefaults();
                            setConfirmReset(false);
                          }}
                          className="px-2 py-1 rounded bg-red-600 text-[11px] font-semibold text-white cursor-pointer"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
