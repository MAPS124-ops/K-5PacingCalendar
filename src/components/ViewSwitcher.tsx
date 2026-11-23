import { Calendar, CalendarRange, Hammer, LayoutGrid } from 'lucide-react';
import { ViewTab } from '../types/pacing';

interface ViewSwitcherProps {
  activeView: ViewTab;
  onChangeView: (view: ViewTab) => void;
}

const TABS: { id: ViewTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'daily', label: 'Daily', icon: LayoutGrid },
  { id: 'weekly', label: 'Weekly', icon: Calendar },
  { id: 'pacing', label: 'Pacing Guide', icon: CalendarRange },
  { id: 'builder', label: 'Curriculum Builder', icon: Hammer },
];

export function ViewSwitcher({ activeView, onChangeView }: ViewSwitcherProps) {
  return (
    <div className="flex justify-center mb-7">
      <div
        role="tablist"
        aria-label="Workspace Views"
        className="inline-flex flex-wrap items-center gap-1 p-1.5 rounded-xl bg-[#EAEFF7] border border-slate-200/70"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChangeView(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-[13px] font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D2F6F] ${
                active
                  ? 'bg-[#1D2F6F] text-white shadow-sm'
                  : 'text-[#1D2F6F]/80 hover:text-[#1D2F6F] hover:bg-white/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
