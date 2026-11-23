import { Check, Copy, Printer, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LessonItem, SubjectBlock, TeacherProfile } from '../types/pacing';
import { formatLongDate, formatSlashDate } from '../utils/dateUtils';

interface SubPlanModalProps {
  open: boolean;
  selectedDate: string;
  gradeLabel: string;
  profile: TeacherProfile;
  subjects: SubjectBlock[];
  lessons: LessonItem[];
  onClose: () => void;
}

export function SubPlanModal({
  open,
  selectedDate,
  gradeLabel,
  profile,
  subjects,
  lessons,
  onClose,
}: SubPlanModalProps) {
  const [planDate, setPlanDate] = useState(selectedDate);
  const [customNotes, setCustomNotes] = useState(profile.subNotes);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setPlanDate(selectedDate);
      setCustomNotes(profile.subNotes);
      setCopied(false);
    }
  }, [open, selectedDate, profile.subNotes]);

  if (!open) return null;

  const visibleSubjects = [...subjects]
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const dayLessons = lessons.filter((l) => l.date === planDate);

  const buildPlainTextPlan = () => {
    const lines: string[] = [
      `SUBSTITUTE TEACHER PLAN — ${gradeLabel.toUpperCase()}`,
      `Date: ${formatLongDate(planDate)} (${formatSlashDate(planDate)})`,
      `Teacher: ${profile.name} | ${profile.school} | ${profile.room}`,
      '',
      'MORNING & DISMISSAL ROUTINES:',
      customNotes,
      '',
      'DAILY INSTRUCTIONAL SCHEDULE:',
    ];

    visibleSubjects.forEach((subj) => {
      const subjLessons = dayLessons.filter((l) => l.subjectId === subj.id);
      const timeText = subj.timeLabel ? ` (${subj.timeLabel})` : '';
      lines.push(`\n• ${subj.name.toUpperCase()}${timeText}`);
      if (subjLessons.length === 0) {
        lines.push('  - No formal lesson scheduled. Use Independent Reading / Choice Board folder on front cart.');
      } else {
        subjLessons.forEach((l) => {
          lines.push(`  - ${l.unitTitle}: ${l.lessonTitle}`);
          if (l.bullets?.length) {
            lines.push(`    Focus: ${l.bullets.join(', ')}`);
          }
          if (l.notes) {
            lines.push(`    Notes: ${l.notes}`);
          }
          if (l.slidesUrl) {
            lines.push(`    Slides: ${l.slidesUrl}`);
          }
          if (l.unitResourcesUrl) {
            lines.push(`    Resources: ${l.unitResourcesUrl}`);
          }
        });
      }
    });

    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildPlainTextPlan());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Substitute Teacher Plan"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4 print:static print:bg-white print:p-0"
      onClick={onClose}
    >
      <div
        className="print-only-sheet w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Controls */}
        <div className="no-print bg-[#182756] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">
              Generate Substitute Plan
            </h2>
            <p className="text-xs text-white/75 mt-0.5">
              Auto-compiled from {gradeLabel} pacing and teacher notes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              aria-label="Sub plan date"
              className="px-2.5 py-1.5 rounded-lg bg-white/15 border border-white/20 text-xs text-white tabular-nums"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#182756] text-xs font-semibold hover:bg-slate-100 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D4383] text-white text-xs font-semibold hover:bg-[#3A54A1] cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sub plan"
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#1D2F6F]">
                Substitute Teacher Daily Plan
              </p>
              <h3 className="font-display text-2xl font-bold text-[#182756] mt-0.5">
                {gradeLabel} · {formatLongDate(planDate)}
              </h3>
            </div>
            <div className="text-xs text-slate-600 sm:text-right">
              <div className="font-semibold text-slate-800">{profile.name}</div>
              <div>
                {profile.school} · {profile.room}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Classroom Routines, Attendance & Dismissal Notes
            </label>
            <textarea
              rows={3}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              className="no-print w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F9FAFC] text-xs text-slate-800 leading-relaxed"
            />
            <p className="hidden print:block text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
              {customNotes}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Scheduled Blocks & Lesson Instructions
            </h4>

            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 overflow-hidden">
              {visibleSubjects.map((subj) => {
                const subjLessons = dayLessons.filter(
                  (l) => l.subjectId === subj.id
                );
                return (
                  <div key={subj.id} className="p-4 bg-white">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-display text-sm font-bold text-[#182756]">
                        {subj.name}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 tabular-nums">
                        {subj.timeLabel || 'Flexible Block'}
                      </span>
                    </div>

                    {subjLessons.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">
                        No formal lesson scheduled today — please lead Independent Reading or Enrichment Choice Board from the front counter.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {subjLessons.map((lesson) => (
                          <div key={lesson.id} className="text-xs text-slate-700 space-y-1">
                            <div className="font-semibold text-slate-900">
                              {lesson.unitTitle} — {lesson.lessonTitle}
                              {lesson.prepFlag && (
                                <span className="ml-2 text-[11px] font-bold text-amber-700">
                                  (Prep / Copies on Desk)
                                </span>
                              )}
                            </div>
                            {lesson.bullets && lesson.bullets.length > 0 && (
                              <div className="text-slate-600">
                                Focus: {lesson.bullets.join(' · ')}
                              </div>
                            )}
                            {lesson.notes && (
                              <div className="text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                                {lesson.notes}
                              </div>
                            )}
                            {(lesson.slidesUrl || lesson.unitResourcesUrl || lesson.externalUrl) && (
                              <div className="flex flex-wrap gap-3 pt-0.5 text-[11px] text-[#1D2F6F] font-medium">
                                {lesson.slidesUrl && <span>Slides: {lesson.slidesUrl}</span>}
                                {lesson.unitResourcesUrl && (
                                  <span>Resources: {lesson.unitResourcesUrl}</span>
                                )}
                                {lesson.externalUrl && (
                                  <span>Portal: {lesson.externalUrl}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
