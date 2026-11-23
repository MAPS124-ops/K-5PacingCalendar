import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { LessonItem, SubjectBlock } from '../types/pacing';
import { formatShortWeekday, formatSlashDate } from '../utils/dateUtils';
import { CARD_THEMES } from '../utils/themeUtils';

interface PacingGuideViewProps {
  selectedDate: string;
  subjects: SubjectBlock[];
  lessons: LessonItem[];
  isEditor: boolean;
  onOpenLesson: (lesson: LessonItem) => void;
  onToggleComplete: (lessonId: string) => void;
  onBulkShiftPacing: (subjectId: string | 'all', fromDate: string, delta: 1 | -1) => void;
}

export function PacingGuideView({
  selectedDate,
  subjects,
  lessons,
  isEditor,
  onOpenLesson,
  onToggleComplete,
  onBulkShiftPacing,
}: PacingGuideViewProps) {
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFromDate, setShiftFromDate] = useState(selectedDate);

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.order - b.order),
    [subjects]
  );

  const subjectMap = useMemo(() => {
    const map = new Map<string, SubjectBlock>();
    sortedSubjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [sortedSubjects]);

  const filteredLessons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...lessons]
      .filter((l) => (subjectFilter === 'all' ? true : l.subjectId === subjectFilter))
      .filter((l) => {
        if (!q) return true;
        const subjName = subjectMap.get(l.subjectId)?.name ?? '';
        return (
          l.unitTitle.toLowerCase().includes(q) ||
          l.lessonTitle.toLowerCase().includes(q) ||
          (l.standards ?? '').toLowerCase().includes(q) ||
          (l.bullets ?? []).some((b) => b.toLowerCase().includes(q)) ||
          l.notes.toLowerCase().includes(q) ||
          subjName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const orderA = subjectMap.get(a.subjectId)?.order ?? 99;
        const orderB = subjectMap.get(b.subjectId)?.order ?? 99;
        return orderA - orderB;
      });
  }, [lessons, subjectFilter, searchQuery, subjectMap]);

  const completedCount = filteredLessons.filter((l) => l.completed).length;

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-[#182756]">
            Curriculum Pacing Guide
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5 tabular-nums">
            {filteredLessons.length} scheduled lessons · {completedCount} marked taught
          </p>
        </div>

        {/* Bulk Pacing Shift Toolbar (Editor Mode) */}
        {isEditor && (
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl border border-slate-200 bg-[#F8FAFC]">
            <span className="text-[11px] font-semibold text-slate-600 px-1.5">
              Shift pacing from:
            </span>
            <input
              type="date"
              value={shiftFromDate}
              onChange={(e) => setShiftFromDate(e.target.value)}
              aria-label="Shift pacing starting date"
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#182756] tabular-nums"
            />
            <button
              type="button"
              onClick={() => onBulkShiftPacing(subjectFilter, shiftFromDate, -1)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>-1 Day</span>
            </button>
            <button
              type="button"
              onClick={() => onBulkShiftPacing(subjectFilter, shiftFromDate, 1)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] transition-colors cursor-pointer"
            >
              <span>+1 School Day</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Filter & Search Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSubjectFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              subjectFilter === 'all'
                ? 'bg-[#1D2F6F] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            All Subjects
          </button>
          {sortedSubjects.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSubjectFilter(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                subjectFilter === s.id
                  ? 'bg-[#1D2F6F] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72 shrink-0">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search unit, lesson, standard..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D2F6F]/25 focus:border-[#1D2F6F]"
          />
        </div>
      </div>

      {/* Pacing Table */}
      {filteredLessons.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-12 text-center bg-slate-50/40">
          <p className="text-sm font-semibold text-slate-700">
            No lessons match your current filter.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Clear your search or switch to Curriculum Builder to schedule lessons.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="bg-[#EEF1F8] border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-[#182756]">
                <th className="py-3 px-4 w-36">Date</th>
                <th className="py-3 px-4 w-44">Subject</th>
                <th className="py-3 px-4 w-52">Unit / Module</th>
                <th className="py-3 px-4">Lesson & Focus</th>
                <th className="py-3 px-4 w-48">Standards</th>
                <th className="py-3 px-4 w-24 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredLessons.map((lesson) => {
                const subject = subjectMap.get(lesson.subjectId);
                const theme =
                  CARD_THEMES[
                    lesson.themeOverride ?? subject?.defaultTheme ?? 'navy'
                  ];
                const { weekday } = formatShortWeekday(lesson.date);
                const isSelectedDay = lesson.date === selectedDate;

                return (
                  <tr
                    key={lesson.id}
                    onClick={() => onOpenLesson(lesson)}
                    className={`hover:bg-slate-50/90 transition-colors cursor-pointer ${
                      isSelectedDay ? 'bg-[#F4F7FD]' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-medium text-slate-700 tabular-nums whitespace-nowrap">
                      <span className="text-slate-400 mr-1.5">{weekday}</span>
                      <span>{formatSlashDate(lesson.date)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${theme.badgeBg} ${theme.badgeText}`}
                      >
                        {subject?.name ?? lesson.subjectId}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#182756]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{lesson.unitTitle}</span>
                        {lesson.externalUrl && (
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <div className="font-medium">{lesson.lessonTitle}</div>
                      {lesson.bullets && lesson.bullets.length > 0 && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {lesson.bullets.join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500">
                      {lesson.standards || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete(lesson.id);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                          lesson.completed
                            ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {lesson.completed ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Taught</span>
                          </>
                        ) : (
                          <>
                            <Circle className="w-3.5 h-3.5" />
                            <span>Planned</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
