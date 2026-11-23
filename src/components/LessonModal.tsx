import {
  Check,
  ExternalLink,
  Folder,
  Link2,
  Lock,
  Trash2,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { CardTheme, GradeLevel, LessonItem, SubjectBlock } from '../types/pacing';
import { CARD_THEMES } from '../utils/themeUtils';

interface LessonModalProps {
  lesson: LessonItem | null;
  draftSlot: { subjectId: string; date: string } | null;
  grade: GradeLevel;
  gradeLabel: string;
  subjects: SubjectBlock[];
  isEditor: boolean;
  isAdmin?: boolean;
  curriculumLocked?: boolean;
  onClose: () => void;
  onSave: (lesson: LessonItem) => void;
  onDelete: (lessonId: string) => void;
}

export function LessonModal({
  lesson,
  draftSlot,
  grade,
  gradeLabel,
  subjects,
  isEditor,
  isAdmin = false,
  curriculumLocked = false,
  onClose,
  onSave,
  onDelete,
}: LessonModalProps) {
  const isOpen = Boolean(lesson || draftSlot);

  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState('');
  const [unitTitle, setUnitTitle] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [bulletsText, setBulletsText] = useState('');
  const [standards, setStandards] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [slidesUrl, setSlidesUrl] = useState('');
  const [unitResourcesLabel, setUnitResourcesLabel] = useState('');
  const [unitResourcesUrl, setUnitResourcesUrl] = useState('');
  const [prepFlag, setPrepFlag] = useState(false);
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState(false);
  const [themeOverride, setThemeOverride] = useState<CardTheme | ''>('');

  useEffect(() => {
    if (lesson) {
      setSubjectId(lesson.subjectId);
      setDate(lesson.date);
      setUnitTitle(lesson.unitTitle);
      setLessonTitle(lesson.lessonTitle);
      setBulletsText((lesson.bullets ?? []).join('\n'));
      setStandards(lesson.standards ?? '');
      setExternalUrl(lesson.externalUrl ?? '');
      setSlidesUrl(lesson.slidesUrl ?? '');
      setUnitResourcesLabel(lesson.unitResourcesLabel ?? '');
      setUnitResourcesUrl(lesson.unitResourcesUrl ?? '');
      setPrepFlag(Boolean(lesson.prepFlag));
      setNotes(lesson.notes ?? '');
      setCompleted(Boolean(lesson.completed));
      setThemeOverride(lesson.themeOverride ?? '');
    } else if (draftSlot) {
      setSubjectId(draftSlot.subjectId);
      setDate(draftSlot.date);
      setUnitTitle('');
      setLessonTitle('');
      setBulletsText('');
      setStandards('');
      setExternalUrl('');
      setSlidesUrl('');
      setUnitResourcesLabel('');
      setUnitResourcesUrl('');
      setPrepFlag(false);
      setNotes('');
      setCompleted(false);
      setThemeOverride('');
    }
  }, [lesson, draftSlot]);

  if (!isOpen) return null;

  const subject = subjects.find((s) => s.id === subjectId);
  const activeTheme =
    CARD_THEMES[
      (themeOverride || subject?.defaultTheme || 'navy') as CardTheme
    ];

  const isTeacherNotesOnlyMode =
    Boolean(lesson) &&
    isEditor &&
    !isAdmin &&
    (Boolean(lesson?.isMaster) || curriculumLocked);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (lesson && isTeacherNotesOnlyMode) {
      onSave({
        ...lesson,
        notes: notes.trim(),
        completed,
      });
      onClose();
      return;
    }

    if (!unitTitle.trim() || !lessonTitle.trim()) return;

    const bullets = bulletsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    onSave({
      id: lesson ? lesson.id : `lesson-${grade}-${Date.now()}`,
      grade,
      subjectId,
      date,
      unitTitle: unitTitle.trim(),
      lessonTitle: lessonTitle.trim(),
      bullets: bullets.length > 0 ? bullets : undefined,
      standards: standards.trim() || undefined,
      externalUrl: externalUrl.trim() || undefined,
      slidesUrl: slidesUrl.trim() || undefined,
      unitResourcesLabel: unitResourcesLabel.trim() || undefined,
      unitResourcesUrl: unitResourcesUrl.trim() || undefined,
      prepFlag,
      notes: notes.trim(),
      completed,
      themeOverride: themeOverride || undefined,
      isMaster: lesson?.isMaster,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Lesson Details"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colored Header */}
        <div
          className={`${activeTheme.headerBg} text-white px-6 py-4 flex items-center justify-between gap-4`}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
              {gradeLabel} · {subject?.name ?? subjectId}
            </p>
            <h2 className="font-display text-lg font-bold truncate mt-0.5">
              {lesson ? lesson.unitTitle : 'Schedule New Lesson'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form / Details Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {(!isEditor || isTeacherNotesOnlyMode) && lesson ? (
            /* Read-Only Curriculum View (with Teacher Notes & Taught toggle when Editor & Admin-Locked) */
            <div className="space-y-4">
              {isTeacherNotesOnlyMode && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 flex items-start gap-2 text-xs text-amber-900">
                  <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    Curriculum pacing is locked by your administrator. You can still update your personal notes and taught status below.
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Lesson Focus
                </h3>
                <p className="text-base font-semibold text-[#182756] mt-1">
                  {lesson.lessonTitle}
                </p>
                {lesson.bullets && lesson.bullets.length > 0 && (
                  <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
                    {lesson.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span>•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {lesson.standards && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Standards
                  </h3>
                  <p className="text-sm text-slate-700 mt-1">{lesson.standards}</p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Teacher Notes
                </h3>
                {isTeacherNotesOnlyMode ? (
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add classroom reminders, small group notes, or sub instructions..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800"
                  />
                ) : (
                  <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 whitespace-pre-wrap">
                    {lesson.notes || 'No teacher notes added for this lesson.'}
                  </p>
                )}
              </div>

              {(lesson.externalUrl || lesson.slidesUrl || lesson.unitResourcesUrl) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {lesson.unitResourcesUrl && (
                    <a
                      href={lesson.unitResourcesUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EEF1F8] text-[#182756] text-xs font-semibold hover:bg-slate-200"
                    >
                      <Folder className="w-3.5 h-3.5" />
                      <span>{lesson.unitResourcesLabel || 'Unit Resources'}</span>
                    </a>
                  )}
                  {lesson.slidesUrl && (
                    <a
                      href={lesson.slidesUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EEF1F8] text-[#182756] text-xs font-semibold hover:bg-slate-200"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Open Slides</span>
                    </a>
                  )}
                  {lesson.externalUrl && (
                    <a
                      href={lesson.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EEF1F8] text-[#182756] text-xs font-semibold hover:bg-slate-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Curriculum Portal</span>
                    </a>
                  )}
                </div>
              )}

              {isTeacherNotesOnlyMode ? (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={(e) => setCompleted(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span>Marked as Taught</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] cursor-pointer"
                    >
                      Save Notes & Progress
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      onSave({ ...lesson, completed: !lesson.completed });
                      onClose();
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                      lesson.completed
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{lesson.completed ? 'Marked as Taught' : 'Mark as Taught'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Editor Mode Full Form */
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-800"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit / Lesson Header *
                  </label>
                  <input
                    type="text"
                    required
                    value={unitTitle}
                    onChange={(e) => setUnitTitle(e.target.value)}
                    placeholder="e.g. Module 1 Lesson 30"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lesson Focus *
                  </label>
                  <input
                    type="text"
                    required
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    placeholder="e.g. Organize"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sub-Bullets (one per line)
                  </label>
                  <textarea
                    rows={2}
                    value={bulletsText}
                    onChange={(e) => setBulletsText(e.target.value)}
                    placeholder="The Book Rescuer"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Standards / Skill Tag
                  </label>
                  <input
                    type="text"
                    value={standards}
                    onChange={(e) => setStandards(e.target.value)}
                    placeholder="e.g. ELA.1.RL.2"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
                  />
                  <label className="block text-xs font-semibold text-slate-700 mt-2 mb-1">
                    Card Color Override
                  </label>
                  <select
                    value={themeOverride}
                    onChange={(e) => setThemeOverride(e.target.value as CardTheme | '')}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800"
                  >
                    <option value="">Use Subject Default</option>
                    {(Object.keys(CARD_THEMES) as CardTheme[]).map((t) => (
                      <option key={t} value={t}>
                        {CARD_THEMES[t].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Curriculum Portal URL
                  </label>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Slides URL
                  </label>
                  <input
                    type="url"
                    value={slidesUrl}
                    onChange={(e) => setSlidesUrl(e.target.value)}
                    placeholder="https://docs.google.com/..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Resources Label
                  </label>
                  <input
                    type="text"
                    value={unitResourcesLabel}
                    onChange={(e) => setUnitResourcesLabel(e.target.value)}
                    placeholder="e.g. UNIT RESOURCES"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Resources Folder URL
                  </label>
                  <input
                    type="url"
                    value={unitResourcesUrl}
                    onChange={(e) => setUnitResourcesUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teacher & Substitute Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Materials, prep reminders, or sub instructions..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prepFlag}
                    onChange={(e) => setPrepFlag(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Prep / Printables Required (P)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completed}
                    onChange={(e) => setCompleted(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Marked as Taught</span>
                </label>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                {lesson ? (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(lesson.id);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Lesson</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] cursor-pointer"
                  >
                    Save Lesson
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
