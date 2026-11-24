import { GRADES } from '../data/seedData';
import { GradeLevel } from '../types/pacing';

interface GradeTabsProps {
  selectedGrade: GradeLevel;
  onSelectGrade: (grade: GradeLevel) => void;
  visibleGrades?: GradeLevel[];
  assignedLabel?: string | null;
}

export function GradeTabs({
  selectedGrade,
  onSelectGrade,
  visibleGrades,
  assignedLabel,
}: GradeTabsProps) {
  const gradesToRender =
    visibleGrades && visibleGrades.length > 0
      ? GRADES.filter((g) => visibleGrades.includes(g.id))
      : GRADES;

  return (
    <nav
      aria-label="Grade Level Navigation"
      className="no-print max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 pt-4"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/90 overflow-x-auto">
        <div className="flex items-center gap-1 sm:gap-2">
          {gradesToRender.map((grade) => {
            const active = grade.id === selectedGrade;
            return (
              <button
                key={grade.id}
                type="button"
                onClick={() => onSelectGrade(grade.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D2F6F] rounded-t-md ${
                  active
                    ? 'text-[#182756] font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {grade.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D2F6F] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>
        {assignedLabel && (
          <span className="hidden sm:inline-block text-[11px] font-semibold text-[#1D2F6F] bg-[#EEF1F8] px-2.5 py-1 rounded-md whitespace-nowrap shrink-0">
            {assignedLabel}
          </span>
        )}
      </div>
    </nav>
  );
}
