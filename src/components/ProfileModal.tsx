import { LogOut, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { TeacherProfile } from '../types/pacing';

interface ProfileModalProps {
  open: boolean;
  userEmail: string | null;
  profile: TeacherProfile;
  onClose: () => void;
  onSave: (profile: TeacherProfile) => void;
  onLogout: () => void;
}

export function ProfileModal({
  open,
  userEmail,
  profile,
  onClose,
  onSave,
  onLogout,
}: ProfileModalProps) {
  const [name, setName] = useState(profile.name);
  const [school, setSchool] = useState(profile.school);
  const [room, setRoom] = useState(profile.room);
  const [subNotes, setSubNotes] = useState(profile.subNotes);
  const [roleMode, setRoleMode] = useState<'editor' | 'viewer'>(profile.roleMode);

  useEffect(() => {
    if (open) {
      setName(profile.name);
      setSchool(profile.school);
      setRoom(profile.room);
      setSubNotes(profile.subNotes);
      setRoleMode(profile.roleMode);
    }
  }, [open, profile]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim() || 'Spartan Teacher',
      school: school.trim() || 'Milford Grade School',
      room: room.trim() || 'Room 104',
      subNotes: subNotes.trim(),
      roleMode,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Teacher Profile Settings"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#182756] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold">
              Teacher Profile & Workspace Mode
            </h2>
            {userEmail && (
              <p className="text-[11px] text-white/75 mt-0.5">{userEmail}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile settings"
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/15 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                School
              </label>
              <input
                type="text"
                maxLength={120}
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Number
              </label>
              <input
                type="text"
                maxLength={40}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Default Sub Plan Classroom Routines
            </label>
            <textarea
              rows={3}
              maxLength={2000}
              value={subNotes}
              onChange={(e) => setSubNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Workspace Access Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRoleMode('editor')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                  roleMode === 'editor'
                    ? 'bg-[#1D2F6F] text-white border-[#1D2F6F]'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Editor Mode
              </button>
              <button
                type="button"
                onClick={() => setRoleMode('viewer')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                  roleMode === 'viewer'
                    ? 'bg-[#1D2F6F] text-white border-[#1D2F6F]'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Viewer Mode
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>

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
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
