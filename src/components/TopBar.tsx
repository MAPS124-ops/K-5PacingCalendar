import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Clock,
  Lock,
  LogOut,
  Shield,
  User,
} from 'lucide-react';
import { TeacherProfile } from '../types/pacing';

interface TopBarProps {
  profile: TeacherProfile;
  isAdmin: boolean;
  needsAdminEmailVerification: boolean;
  schedulesLocked: boolean;
  onOpenAdminConsole: () => void;
  onVerifyAdminEmail: () => void;
  onOpenSchedule: () => void;
  onOpenSubPlan: () => void;
  onOpenProfile: () => void;
  onToggleRoleMode: () => void;
  onLogout: () => void;
}

export function TopBar({
  profile,
  isAdmin,
  needsAdminEmailVerification,
  schedulesLocked,
  onOpenAdminConsole,
  onVerifyAdminEmail,
  onOpenSchedule,
  onOpenSubPlan,
  onOpenProfile,
  onToggleRoleMode,
  onLogout,
}: TopBarProps) {
  const isEditor = profile.roleMode === 'editor';

  return (
    <header className="no-print bg-[#182756] text-white border-b border-[#111D42]">
      <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarDays className="w-5 h-5 text-white/90 shrink-0" aria-hidden="true" />
          <span className="font-display font-bold text-lg tracking-tight text-white whitespace-nowrap shrink-0">
            K-5 Pacing Calendar
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenAdminConsole}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg bg-[#008678] text-white text-xs font-semibold shadow-sm hover:bg-[#007367] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Shield className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Admin Console</span>
              <span className="sm:hidden">Admin</span>
            </button>
          )}

          {needsAdminEmailVerification && !isAdmin && (
            <button
              type="button"
              onClick={onVerifyAdminEmail}
              title="Verify your admin email address to unlock Admin Console"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Verify Admin</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSchedule}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg bg-white text-[#182756] text-xs font-semibold shadow-sm hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {schedulesLocked && !isAdmin ? (
              <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            ) : (
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>My Schedule</span>
          </button>

          <button
            type="button"
            onClick={onOpenSubPlan}
            className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-lg bg-[#2A3F80] text-white text-xs font-semibold border border-white/15 hover:bg-[#334C96] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Generate Sub Plan</span>
            <span className="sm:hidden">Sub Plan</span>
          </button>

          <div className="hidden lg:block h-5 w-px bg-white/20 mx-0.5" aria-hidden="true" />

          <button
            type="button"
            onClick={onOpenProfile}
            title="Edit teacher profile and classroom defaults"
            className="hidden lg:inline-flex items-center gap-2 text-xs font-medium text-white/90 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer rounded-md px-2 py-1.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <User className="w-3.5 h-3.5 text-white/75" aria-hidden="true" />
            <span>Welcome, {profile.name}!</span>
          </button>

          <button
            type="button"
            onClick={onToggleRoleMode}
            title={
              isEditor
                ? 'Editor Mode active — click to switch to View-Only mode'
                : 'Viewer Mode active — click to switch to Editor mode'
            }
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              isEditor
                ? 'bg-[#314A92] text-white border border-white/20 hover:bg-[#3B57AA]'
                : 'bg-slate-700 text-slate-200 border border-white/10 hover:bg-slate-600'
            }`}
          >
            {isEditor ? 'EDITOR' : 'VIEWER'}
          </button>

          <button
            type="button"
            onClick={onLogout}
            title="Log out of your account"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white/85 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
