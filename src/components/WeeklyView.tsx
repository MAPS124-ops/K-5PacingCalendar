import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { LessonItem, NonSchoolDay, SubjectBlock } from '../types/pacing';
import {
  addDaysISO,
  formatShortWeekday,
  formatSlashDate,
  getWeekDatesMonToFri,
} from '../utils/dateUtils';
import { CARD_THEMES } from '../utils/themeUtils';

interface WeeklyViewProps {
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  onJumpToDaily: (iso: string) => void;
  todayISO: string;
  subjects: SubjectBlock[];
  lessons: LessonItem[];
  nonSchoolDays: NonSchoolDay[];
  isEditor: boolean;
  onOpenLesson: (lesson: LessonItem) => void;
  onCreateLessonForSlot: (subjectId: string, date: string) => void;
  onShiftSingleLesson: (lessonId: string, schoolDaysDelta: 1 | -1) => void;
}

export function WeeklyView({
  selectedDate,
  onSelectDate,
  onJumpToDaily,
  todayISO,
  subjects,
  lessons,
  nonSchoolDays,
  isEditor,
  onOpenLesson,
  onCreateLessonForSlot,
  onShiftSingleLesson,
}: WeeklyViewProps) {
  const weekDates = getWeekDatesMonToFri(selectedDate);
  const visibleSubjects = [...subjects]
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const mondayLabel = formatSlashDate(weekDates[0]);
  const fridayLabel = formatSlashDate(weekDates[4]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-[#182756]">
            Weekly Pacing Grid
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5">
            Monday – Friday overview · Click any date header to open its Daily Dashboard.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl border border-slate-200 bg-[#F9FAFC]">
            <button
              type="button"
              onClick={() => onSelectDate(addDaysISO(weekDates[0], -7))}
              aria-label="Previous week"
              className="p-1.5 rounded-lg text-[#1D2F6F] hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs sm:text-[13px] font-bold text-[#182756] tabular-nums whitespace-nowrap">
              {mondayLabel} – {fridayLabel}
            </span>
            <button
              type="button"
              onClick={() => onSelectDate(addDaysISO(weekDates[0], 7))}
              aria-label="Next week"
              className="p-1.5 rounded-lg text-[#1D2F6F] hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onSelectDate(todayISO)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#1D2F6F] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            This Week
          </button>
        </div>
      </div>

      {/* Horizontal scroll guard for narrower screens */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[920px] border-collapse table-fixed">
          <thead>
            <tr className="bg-[#EEF1F8] border-b border-slate-200">
              <th className="w-44 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#182756] border-r border-slate-200">
                Subject & Time
              </th>
              {weekDates.map((dateISO) => {
                const { weekday, monthDay } = formatShortWeekday(dateISO);
                const isSelected = dateISO === selectedDate;
                const nsd = nonSchoolDays.find((d) => d.date === dateISO);
                return (
                  <th
                    key={dateISO}
                    className={`px-3 py-2.5 text-left border-r last:border-r-0 border-slate-200 transition-colors ${
                      isSelected ? 'bg-[#DFE6F6]' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onJumpToDaily(dateISO)}
                      className="w-full text-left group cursor-pointer focus-visible:outline-none"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-display text-xs font-bold text-[#182756] group-hover:underline">
                          {weekday}
                        </span>
                        <span className="text-xs font-semibold text-slate-600 tabular-nums">
                          {monthDay}
                        </span>
                      </div>
                      {nsd && (
                        <p className="text-[10px] font-semibold text-amber-800 truncate mt-0.5">
                          {nsd.label}
                        </p>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {visibleSubjects.map((subject) => (
              <tr key={subject.id} className="align-top">
                <td className="px-4 py-3.5 bg-[#F8FAFC] border-r border-slate-200">
                  <div className="font-display text-xs font-bold uppercase tracking-wide text-[#182756]">
                    {subject.name}
                  </div>
                  {subject.timeLabel && (
                    <div className="text-[11px] font-medium text-slate-500 tabular-nums mt-1">
                      {subject.timeLabel}
                    </div>
                  )}
                </td>

                {weekDates.map((dateISO) => {
                  const nsd = nonSchoolDays.find((d) => d.date === dateISO);
                  const cellLessons = lessons.filter(
                    (l) => l.subjectId === subject.id && l.date === dateISO
                  );
                  const isSelected = dateISO === selectedDate;

                  return (
                    <td
                      key={dateISO}
                      className={`p-2.5 border-r last:border-r-0 border-slate-200 min-h-[104px] ${
                        nsd
                          ? 'bg-amber-50/45'
                          : isSelected
                          ? 'bg-[#F6F8FD]'
                          : 'bg-white'
                      }`}
                    >
                      <div className="space-y-2">
                        {cellLessons.map((lesson) => {
                          const theme =
                            CARD_THEMES[lesson.themeOverride ?? subject.defaultTheme];
                          return (
                            <div
                              key={lesson.id}
                              onClick={() => onOpenLesson(lesson)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onOpenLesson(lesson);
                                }
                              }}
                              className="rounded-lg overflow-hidden text-white shadow-xs hover:shadow-sm transition-shadow cursor-pointer"
                            >
                              <div
                                className={`${theme.headerBg} px-2.5 py-1.5 flex items-center justify-between gap-1`}
                              >
                                <span className="text-[11px] font-semibold truncate">
                                  {lesson.unitTitle}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {lesson.completed && (
                                    <Check className="w-3 h-3 text-emerald-300" />
                                  )}
                                  {lesson.notes && (
                                    <MessageSquare className="w-3 h-3 text-white/80" />
                                  )}
                                </div>
                              </div>
                              <div className={`${theme.bodyBg} px-2.5 py-2`}>
                                <p className="text-[11px] leading-snug font-medium line-clamp-2">
                                  {lesson.lessonTitle}
                                </p>
                                {isEditor && (
                                  <div className="flex items-center justify-end gap-1 mt-1.5 pt-1 border-t border-white/15">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onShiftSingleLesson(lesson.id, -1);
                                      }}
                                      title="Move lesson back 1 school day"
                                      className="p-0.5 rounded hover:bg-white/20 text-white/85 hover:text-white cursor-pointer"
                                    >
                                      <ArrowLeft className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onShiftSingleLesson(lesson.id, 1);
                                      }}
                                      title="Move lesson forward 1 school day"
                                      className="p-0.5 rounded hover:bg-white/20 text-white/85 hover:text-white cursor-pointer"
                                    >
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {cellLessons.length === 0 && !nsd && isEditor && (
                          <button
                            type="button"
                            onClick={() => onCreateLessonForSlot(subject.id, dateISO)}
                            className="w-full py-5 rounded-lg border border-dashed border-slate-200 text-slate-400 hover:text-[#1D2F6F] hover:border-[#1D2F6F]/40 hover:bg-slate-50/80 transition-colors flex items-center justify-center gap-1 text-[11px] font-medium cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        )}

                        {cellLessons.length === 0 && nsd && (
                          <div className="py-5 text-center text-[11px] text-amber-800/75 italic">
                            No School
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
