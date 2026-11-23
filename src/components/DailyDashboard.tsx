import {
  Calendar as CalendarIcon,
  CalendarX2,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Folder,
  Link2,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LessonItem, NonSchoolDay, SubjectBlock } from '../types/pacing';
import {
  addDaysISO,
  formatLongDate,
  formatSlashDate,
  getMonthGridDates,
  isWeekendISO,
  parseISODate,
  stepSchoolDayISO,
} from '../utils/dateUtils';
import { CARD_THEMES } from '../utils/themeUtils';

interface DailyDashboardProps {
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  todayISO: string;
  subjects: SubjectBlock[];
  lessons: LessonItem[];
  nonSchoolDays: NonSchoolDay[];
  isEditor: boolean;
  onOpenLesson: (lesson: LessonItem) => void;
  onCreateLessonForSlot: (subjectId: string, date: string) => void;
  onToggleComplete: (lessonId: string) => void;
}

export function DailyDashboard({
  selectedDate,
  onSelectDate,
  todayISO,
  subjects,
  lessons,
  nonSchoolDays,
  isEditor,
  onOpenLesson,
  onCreateLessonForSlot,
  onToggleComplete,
}: DailyDashboardProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => parseISODate(selectedDate));
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPickerDate(parseISODate(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    if (!calendarOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [calendarOpen]);

  const nonSchoolDayInfo = nonSchoolDays.find((d) => d.date === selectedDate);
  const weekend = isWeekendISO(selectedDate);
  const visibleSubjects = [...subjects]
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const pickerYear = pickerDate.getFullYear();
  const pickerMonth = pickerDate.getMonth();
  const monthLabel = pickerDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const monthCells = getMonthGridDates(pickerYear, pickerMonth);

  const handleJumpWeek = (dir: -1 | 1) => {
    onSelectDate(addDaysISO(selectedDate, dir * 7));
  };

  const handleStepDay = (dir: -1 | 1) => {
    onSelectDate(stepSchoolDayISO(selectedDate, dir, nonSchoolDays, true));
  };

  return (
    <div>
      {/* Title & Day Status Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-[#182756]">
            Daily Dashboard
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5">
            Your schedule and lessons for today ·{' '}
            <span className="text-slate-700 font-medium">{formatLongDate(selectedDate)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedDate !== todayISO && (
            <button
              type="button"
              onClick={() => onSelectDate(todayISO)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#1D2F6F] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Jump to Today ({formatSlashDate(todayISO)})
            </button>
          )}
        </div>
      </div>

      {/* Centered Date Stepper */}
      <div className="flex justify-center mb-7 relative" ref={popoverRef}>
        <div className="inline-flex items-center gap-1 sm:gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-[#F9FAFC] shadow-xs">
          <button
            type="button"
            onClick={() => handleJumpWeek(-1)}
            aria-label="Previous week"
            title="Previous week (-7 days)"
            className="p-2 rounded-lg text-[#1D2F6F] hover:bg-slate-200/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D2F6F]"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleStepDay(-1)}
            aria-label="Previous school day"
            title="Previous school day"
            className="p-2 rounded-lg text-[#1D2F6F] hover:bg-slate-200/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D2F6F]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setCalendarOpen((prev) => !prev)}
            className="inline-flex items-center gap-3 px-3 py-1 mx-1 border-b-2 border-[#182756] text-[#182756] font-display font-bold text-lg tracking-tight tabular-nums hover:bg-white rounded-t-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D2F6F]"
          >
            <span>{formatSlashDate(selectedDate)}</span>
            <CalendarIcon className="w-4 h-4 text-[#182756]" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => handleStepDay(1)}
            aria-label="Next school day"
            title="Next school day"
            className="p-2 rounded-lg text-[#1D2F6F] hover:bg-slate-200/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D2F6F]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleJumpWeek(1)}
            aria-label="Next week"
            title="Next week (+7 days)"
            className="p-2 rounded-lg text-[#1D2F6F] hover:bg-slate-200/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D2F6F]"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Calendar Picker Popover */}
        {calendarOpen && (
          <div className="absolute top-full mt-2 z-30 w-72 rounded-xl border border-slate-200 bg-white shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setPickerDate(new Date(pickerYear, pickerMonth - 1, 1, 12))}
                aria-label="Previous month"
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-display font-semibold text-sm text-[#182756]">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() => setPickerDate(new Date(pickerYear, pickerMonth + 1, 1, 12))}
                aria-label="Next month"
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400 mb-1">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((cellISO, idx) => {
                if (!cellISO) {
                  return <div key={`empty-${idx}`} className="h-8" />;
                }
                const dayNum = Number(cellISO.split('-')[2]);
                const isSelected = cellISO === selectedDate;
                const isNsd = nonSchoolDays.some((d) => d.date === cellISO);
                const isWknd = isWeekendISO(cellISO);
                const hasLessons = lessons.some((l) => l.date === cellISO);
                return (
                  <button
                    key={cellISO}
                    type="button"
                    onClick={() => {
                      onSelectDate(cellISO);
                      setCalendarOpen(false);
                    }}
                    className={`h-8 rounded-lg text-xs font-medium tabular-nums relative flex items-center justify-center transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1D2F6F] text-white font-bold'
                        : isNsd
                        ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                        : isWknd
                        ? 'text-slate-300 hover:bg-slate-50'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {dayNum}
                    {hasLessons && !isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-1 w-1 h-1 rounded-full bg-[#1D2F6F]/60"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Non-School Day Banner */}
      {(nonSchoolDayInfo || weekend) && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-amber-900">
            <span className="font-semibold">
              {nonSchoolDayInfo ? nonSchoolDayInfo.label : 'Weekend'}
            </span>
            <span className="text-amber-700 ml-2">
              — Regular classes are not scheduled on this date.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleStepDay(1)}
            className="text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Next School Day
          </button>
        </div>
      )}

      {/* Subject Cards Grid */}
      {visibleSubjects.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-10 text-center">
          <p className="text-sm text-slate-600 font-medium">
            No subject blocks are currently visible in your schedule.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Open My Schedule in the top bar to enable or add subject blocks.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleSubjects.map((subject) => {
            const subjectLessons = lessons.filter(
              (l) => l.subjectId === subject.id && l.date === selectedDate
            );

            return (
              <section
                key={subject.id}
                aria-label={subject.name}
                className="rounded-xl border border-slate-200/90 bg-white overflow-hidden flex flex-col shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              >
                {/* Subject Header */}
                <div className="bg-[#EEF1F8] px-4 py-3 border-b border-slate-200/80 flex items-center justify-between gap-2">
                  <h2 className="font-display text-[13px] font-bold tracking-wide uppercase text-[#182756] truncate">
                    {subject.name}
                  </h2>
                  {subject.timeLabel ? (
                    <span className="text-xs font-medium text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                      {subject.timeLabel}
                    </span>
                  ) : isEditor ? (
                    <button
                      type="button"
                      onClick={() => onCreateLessonForSlot(subject.id, selectedDate)}
                      title={`Add lesson for ${subject.name}`}
                      className="text-[11px] font-semibold text-[#1D2F6F]/70 hover:text-[#1D2F6F] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  ) : null}
                </div>

                {/* Subject Body */}
                <div className="p-4 flex-1 flex flex-col justify-center gap-3 min-h-[146px]">
                  {subjectLessons.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <CalendarX2
                        className="w-6 h-6 text-slate-300 mb-2"
                        aria-hidden="true"
                      />
                      <p className="text-xs italic text-slate-400">
                        No lesson scheduled today
                      </p>
                      {isEditor && (
                        <button
                          type="button"
                          onClick={() => onCreateLessonForSlot(subject.id, selectedDate)}
                          className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-[11px] font-semibold text-[#1D2F6F] hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Schedule Lesson</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    subjectLessons.map((lesson) => {
                      const theme =
                        CARD_THEMES[lesson.themeOverride ?? subject.defaultTheme];

                      return (
                        <div
                          key={lesson.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpenLesson(lesson)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOpenLesson(lesson);
                            }
                          }}
                          className={`group rounded-lg overflow-hidden text-white shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D2F6F] ${
                            lesson.completed ? 'opacity-90' : ''
                          }`}
                        >
                          {/* Top Strip of Lesson Block */}
                          <div
                            className={`${theme.headerBg} px-3.5 py-2.5 flex items-center justify-between gap-2`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[13px] font-semibold truncate">
                                {lesson.unitTitle}
                              </span>
                              {lesson.externalUrl && (
                                <a
                                  href={lesson.externalUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Open curriculum link"
                                  className="text-white/80 hover:text-white shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {lesson.prepFlag && (
                                <span
                                  title="Prep / Printables required"
                                  className="w-4 h-4 rounded-full bg-white text-[#182756] text-[10px] font-extrabold flex items-center justify-center leading-none"
                                >
                                  P
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleComplete(lesson.id);
                                }}
                                title={
                                  lesson.completed
                                    ? 'Marked as taught (click to undo)'
                                    : 'Mark lesson as taught'
                                }
                                className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                                  lesson.completed
                                    ? 'bg-emerald-400 text-[#0F2A24]'
                                    : 'bg-white/10 text-white/75 hover:bg-white/25 hover:text-white'
                                }`}
                              >
                                <Check className="w-3 h-3" strokeWidth={2.75} />
                              </button>

                              <span
                                title={lesson.notes ? 'View or edit teacher notes' : 'Add teacher notes'}
                                className="relative p-0.5 text-white/85 group-hover:text-white"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>

                          {/* Body Strip of Lesson Block */}
                          <div className={`${theme.bodyBg} px-3.5 py-3 space-y-2`}>
                            {lesson.unitResourcesLabel && (
                              <div>
                                <a
                                  href={lesson.unitResourcesUrl || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => {
                                    if (!lesson.unitResourcesUrl) e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded ${theme.chipBg} text-[10px] font-bold tracking-wider uppercase text-white/95 hover:text-white`}
                                >
                                  <Folder className="w-3 h-3" aria-hidden="true" />
                                  <span>{lesson.unitResourcesLabel}</span>
                                </a>
                              </div>
                            )}

                            <div>
                              <p className="text-[13px] font-medium leading-snug text-white">
                                {lesson.lessonTitle}
                              </p>
                              {lesson.bullets && lesson.bullets.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {lesson.bullets.map((b, idx) => (
                                    <li
                                      key={idx}
                                      className="text-xs text-white/90 flex items-start gap-1.5"
                                    >
                                      <span aria-hidden="true">•</span>
                                      <span>{b}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {lesson.slidesUrl && (
                              <div>
                                <a
                                  href={lesson.slidesUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md ${theme.chipBg} text-[11px] font-semibold text-white/95 hover:text-white transition-colors`}
                                >
                                  <Link2 className="w-3 h-3" aria-hidden="true" />
                                  <span>Slides</span>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
