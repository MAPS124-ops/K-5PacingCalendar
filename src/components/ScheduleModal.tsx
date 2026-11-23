import {
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { GRADES } from '../data/seedData';
import { CardTheme, GradeLevel, SubjectBlock } from '../types/pacing';
import {
  OneRosterBundleResult,
  OneRosterParsedClass,
  oneRosterClassesToSubjectBlocks,
  parseOneRosterBundle,
  SAMPLE_ONEROSTER_CLASSES_CSV,
} from '../utils/oneRosterParser';
import { CARD_THEMES } from '../utils/themeUtils';

interface ScheduleModalProps {
  open: boolean;
  selectedGrade: GradeLevel;
  gradeLabel: string;
  subjects: SubjectBlock[];
  existingSchedulesByGrade: Record<GradeLevel, SubjectBlock[]>;
  isAdmin: boolean;
  lockedByAdmin: boolean;
  onOpenAdminConsole: () => void;
  onClose: () => void;
  onSaveSchedule: (updated: SubjectBlock[]) => void;
  onImportOneRosterSchedules: (
    updatedByGrade: Partial<Record<GradeLevel, SubjectBlock[]>>
  ) => Promise<void>;
}

type ModalTab = 'manual' | 'oneroster';
type ImportApplyMode = 'replace' | 'merge';

export function ScheduleModal({
  open,
  selectedGrade,
  gradeLabel,
  subjects,
  existingSchedulesByGrade,
  isAdmin,
  lockedByAdmin,
  onOpenAdminConsole,
  onClose,
  onSaveSchedule,
  onImportOneRosterSchedules,
}: ScheduleModalProps) {
  const isScheduleLocked = lockedByAdmin && !isAdmin;
  const [tab, setTab] = useState<ModalTab>('manual');
  const [draft, setDraft] = useState<SubjectBlock[]>([]);
  const [newName, setNewName] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newTheme, setNewTheme] = useState<CardTheme>('navy');

  // OneRoster Import State
  const [orFiles, setOrFiles] = useState<Record<string, string>>({});
  const [orClasses, setOrClasses] = useState<OneRosterParsedClass[]>([]);
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<GradeLevel | 'all'>('all');
  const [applyMode, setApplyMode] = useState<ImportApplyMode>('merge');
  const [importing, setImporting] = useState(false);

  const orInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft([...subjects].sort((a, b) => a.order - b.order));
      setTab('manual');
    }
  }, [open, subjects]);

  const parsedBundle: OneRosterBundleResult | null = useMemo(() => {
    if (Object.keys(orFiles).length === 0) return null;
    return parseOneRosterBundle(orFiles, selectedGrade);
  }, [orFiles, selectedGrade]);

  useEffect(() => {
    if (parsedBundle) {
      setOrClasses(parsedBundle.classes);
      setTeacherFilter('all');
      setGradeFilter('all');
    } else {
      setOrClasses([]);
    }
  }, [parsedBundle]);

  const filteredClasses = useMemo(() => {
    return orClasses.filter((cls) => {
      if (teacherFilter !== 'all' && !cls.teacherIds.includes(teacherFilter)) {
        return false;
      }
      if (gradeFilter !== 'all' && cls.grade !== gradeFilter) {
        return false;
      }
      return true;
    });
  }, [orClasses, teacherFilter, gradeFilter]);

  if (!open) return null;

  const moveBlock = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= draft.length) return;
    const copy = [...draft];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setDraft(copy.map((item, idx) => ({ ...item, order: idx })));
  };

  const handleAddBlock = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const id = `${newName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    setDraft((prev) => [
      ...prev,
      {
        id,
        name: newName.trim(),
        timeLabel: newTime.trim(),
        defaultTheme: newTheme,
        visible: true,
        order: prev.length,
      },
    ]);
    setNewName('');
    setNewTime('');
  };

  const handleSaveManual = () => {
    onSaveSchedule(draft.map((item, idx) => ({ ...item, order: idx })));
    onClose();
  };

  const handleOneRosterFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const loaded: Record<string, string> = {};
    await Promise.all(
      files.map(
        (file) =>
          new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                loaded[file.name] = reader.result;
              }
              resolve();
            };
            reader.readAsText(file);
          })
      )
    );
    setOrFiles((prev) => ({ ...prev, ...loaded }));
    e.target.value = '';
  };

  const handleDownloadSampleOneRoster = () => {
    const blob = new Blob([SAMPLE_ONEROSTER_CLASSES_CSV], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'classes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateOrClass = (
    tempId: string,
    patch: Partial<OneRosterParsedClass>
  ) => {
    setOrClasses((prev) =>
      prev.map((c) => (c.tempId === tempId ? { ...c, ...patch } : c))
    );
  };

  const includedClasses = filteredClasses.filter((c) => c.included);

  const handleApplyOneRoster = async () => {
    if (includedClasses.length === 0) return;
    setImporting(true);
    try {
      const byGrade: Partial<Record<GradeLevel, SubjectBlock[]>> = {};

      // Group included classes by grade
      const grouped = new Map<GradeLevel, OneRosterParsedClass[]>();
      includedClasses.forEach((cls) => {
        const list = grouped.get(cls.grade) ?? [];
        list.push(cls);
        grouped.set(cls.grade, list);
      });

      grouped.forEach((clsList, grade) => {
        const importedBlocks = oneRosterClassesToSubjectBlocks(clsList);
        if (applyMode === 'replace') {
          byGrade[grade] = importedBlocks;
        } else {
          // Merge: update matching subject names/IDs with OneRoster timeLabel, append new blocks
          const current = [...(existingSchedulesByGrade[grade] ?? [])];
          importedBlocks.forEach((imp) => {
            const matchIdx = current.findIndex(
              (cur) =>
                cur.name.trim().toLowerCase() === imp.name.trim().toLowerCase() ||
                cur.id === imp.id
            );
            if (matchIdx !== -1) {
              current[matchIdx] = {
                ...current[matchIdx],
                timeLabel: imp.timeLabel || current[matchIdx].timeLabel,
                visible: true,
              };
            } else {
              current.push({
                ...imp,
                order: current.length,
              });
            }
          });
          byGrade[grade] = current.map((item, idx) => ({ ...item, order: idx }));
        }
      });

      await onImportOneRosterSchedules(byGrade);
      setOrFiles({});
      onClose();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="My Daily Schedule"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#182756] text-white px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold">
              My Schedule — {gradeLabel}
            </h2>
            <p className="text-xs text-white/75 mt-0.5">
              Customize daily subject blocks or import teacher schedules & bell times from Skyward OneRoster.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close schedule editor"
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-200 bg-[#F9FAFC] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('manual')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                tab === 'manual'
                  ? 'bg-[#1D2F6F] text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {isScheduleLocked ? 'School Bell Schedule' : 'Edit Daily Blocks'}
            </button>
            {!isScheduleLocked && (
              <button
                type="button"
                onClick={() => setTab('oneroster')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  tab === 'oneroster'
                    ? 'bg-[#1D2F6F] text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Import Skyward OneRoster</span>
              </button>
            )}
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdminConsole();
              }}
              className="text-xs font-semibold text-[#008678] hover:underline cursor-pointer"
            >
              Publish School-Wide in Admin Console →
            </button>
          )}
        </div>

        {tab === 'manual' || isScheduleLocked ? (
          <>
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {isScheduleLocked && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  <strong>Managed by Administrator:</strong> Daily subject blocks and bell times are synced from Skyward and locked by your Milford Grade School Administrator.
                </div>
              )}

              <div className="space-y-2.5">
                {draft.map((block, index) => (
                  <div
                    key={block.id}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-3 ${
                      block.visible
                        ? 'border-slate-200 bg-white'
                        : 'border-slate-200/60 bg-slate-50 opacity-65'
                    }`}
                  >
                    {!isScheduleLocked && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveBlock(index, -1)}
                          disabled={index === 0}
                          aria-label="Move up"
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(index, 1)}
                          disabled={index === draft.length - 1}
                          aria-label="Move down"
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <input
                      type="text"
                      value={block.name}
                      disabled={isScheduleLocked}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev.map((item) =>
                            item.id === block.id
                              ? { ...item, name: e.target.value }
                              : item
                          )
                        )
                      }
                      aria-label="Subject name"
                      className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#182756] disabled:bg-slate-50"
                    />

                    <input
                      type="text"
                      value={block.timeLabel}
                      disabled={isScheduleLocked}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev.map((item) =>
                            item.id === block.id
                              ? { ...item, timeLabel: e.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="e.g. 9:10-9:40"
                      aria-label="Time block"
                      className="w-full sm:w-32 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 tabular-nums disabled:bg-slate-50"
                    />

                    {!isScheduleLocked && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) =>
                              prev.map((item) =>
                                item.id === block.id
                                  ? { ...item, visible: !item.visible }
                                  : item
                              )
                            )
                          }
                          title={
                            block.visible
                              ? 'Hide from dashboard'
                              : 'Show on dashboard'
                          }
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          {block.visible ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {draft.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((prev) =>
                                prev.filter((item) => item.id !== block.id)
                              )
                            }
                            title="Remove block"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Custom Subject Block */}
              {!isScheduleLocked && (
                <form
                  onSubmit={handleAddBlock}
                  className="p-4 rounded-xl border border-dashed border-slate-300 bg-[#F9FAFC] flex flex-col sm:flex-row gap-2.5"
                >
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="New block (e.g. Intervention, WIN Time)"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                  />
                  <input
                    type="text"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="Time (e.g. 2:30-3:00)"
                    className="w-full sm:w-36 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 tabular-nums"
                  />
                  <select
                    value={newTheme}
                    onChange={(e) => setNewTheme(e.target.value as CardTheme)}
                    className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
                  >
                    {(Object.keys(CARD_THEMES) as CardTheme[]).map((t) => (
                      <option key={t} value={t}>
                        {CARD_THEMES[t].label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </form>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                {isScheduleLocked ? 'Close' : 'Cancel'}
              </button>
              {!isScheduleLocked && (
                <button
                  type="button"
                  onClick={handleSaveManual}
                  className="px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] cursor-pointer"
                >
                  Save My Schedule
                </button>
              )}
            </div>
          </>
        ) : (
          /* OneRoster Import Tab */
          <>
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="rounded-xl border border-slate-200 bg-[#F9FAFC] p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#182756]">
                      Select Skyward OneRoster CSV Files
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Include <code className="font-mono">classes.csv</code> (required) plus optional{' '}
                      <code className="font-mono">courses.csv</code>,{' '}
                      <code className="font-mono">users.csv</code>,{' '}
                      <code className="font-mono">enrollments.csv</code>, and{' '}
                      <code className="font-mono">academicSessions.csv</code>.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => orInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload OneRoster CSVs</span>
                    </button>
                    <input
                      ref={orInputRef}
                      type="file"
                      multiple
                      accept=".csv,text/csv"
                      onChange={handleOneRosterFiles}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setOrFiles({
                          'classes.csv': SAMPLE_ONEROSTER_CLASSES_CSV,
                        })
                      }
                      className="font-semibold text-[#1D2F6F] hover:underline cursor-pointer"
                    >
                      Load sample OneRoster classes.csv
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleDownloadSampleOneRoster}
                      className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-[#1D2F6F] cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download template</span>
                    </button>
                  </div>

                  {parsedBundle && (
                    <span className="font-semibold text-emerald-700">
                      Loaded: {parsedBundle.loadedFiles.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              {parsedBundle?.warnings && parsedBundle.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 space-y-1">
                  {parsedBundle.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              )}

              {parsedBundle && parsedBundle.sessions.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
                  <p className="font-semibold text-[#182756] mb-1">
                    Academic Sessions Found ({parsedBundle.sessions.length}):
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 tabular-nums">
                    {parsedBundle.sessions.slice(0, 6).map((s) => (
                      <span key={s.sourcedId || s.title}>
                        <strong>{s.title}</strong> ({s.startDate} – {s.endDate})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {orClasses.length > 0 && (
                <>
                  {/* Filters & Apply Mode */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Filter by Teacher
                      </label>
                      <select
                        value={teacherFilter}
                        onChange={(e) => setTeacherFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                      >
                        <option value="all">
                          All Teachers ({parsedBundle?.teachers.length ?? 0})
                        </option>
                        {parsedBundle?.teachers.map((t) => (
                          <option key={t.sourcedId} value={t.sourcedId}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Filter by Grade
                      </label>
                      <select
                        value={gradeFilter}
                        onChange={(e) =>
                          setGradeFilter(e.target.value as GradeLevel | 'all')
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                      >
                        <option value="all">All K–5 Grades</option>
                        {GRADES.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Import Mode
                      </label>
                      <select
                        value={applyMode}
                        onChange={(e) =>
                          setApplyMode(e.target.value as ImportApplyMode)
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                      >
                        <option value="merge">
                          Merge & Update Bell Times
                        </option>
                        <option value="replace">
                          Replace Matching Grade Schedules
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="rounded-xl border border-slate-200 overflow-x-auto max-h-64">
                    <table className="w-full min-w-[600px] border-collapse text-left text-xs">
                      <thead className="bg-[#EEF1F8] border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-[#182756] sticky top-0">
                        <tr>
                          <th className="py-2 px-3 w-10 text-center">Use</th>
                          <th className="py-2 px-3 w-24">Grade</th>
                          <th className="py-2 px-3">Class / Subject Name</th>
                          <th className="py-2 px-3 w-36">Bell Time / Period</th>
                          <th className="py-2 px-3 w-32">Theme</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredClasses.map((cls) => (
                          <tr
                            key={cls.tempId}
                            className={cls.included ? 'bg-white' : 'bg-slate-50 opacity-50'}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={cls.included}
                                onChange={(e) =>
                                  updateOrClass(cls.tempId, {
                                    included: e.target.checked,
                                  })
                                }
                                className="rounded border-slate-300"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={cls.grade}
                                onChange={(e) =>
                                  updateOrClass(cls.tempId, {
                                    grade: e.target.value as GradeLevel,
                                  })
                                }
                                className="px-2 py-1 rounded border border-slate-200 text-xs font-semibold text-[#182756]"
                              >
                                {GRADES.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.shortLabel}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={cls.title}
                                maxLength={80}
                                onChange={(e) =>
                                  updateOrClass(cls.tempId, {
                                    title: e.target.value,
                                  })
                                }
                                className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-semibold text-[#182756]"
                              />
                              {cls.teacherNames.length > 0 && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  Teacher: {cls.teacherNames.join(', ')}
                                </p>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={cls.timeLabel}
                                maxLength={40}
                                placeholder="e.g. 9:10-9:40"
                                onChange={(e) =>
                                  updateOrClass(cls.tempId, {
                                    timeLabel: e.target.value,
                                  })
                                }
                                className="w-full px-2 py-1 rounded border border-slate-200 text-xs tabular-nums"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={cls.defaultTheme}
                                onChange={(e) =>
                                  updateOrClass(cls.tempId, {
                                    defaultTheme: e.target.value as CardTheme,
                                  })
                                }
                                className="w-full px-2 py-1 rounded border border-slate-200 text-xs"
                              >
                                {(Object.keys(CARD_THEMES) as CardTheme[]).map(
                                  (t) => (
                                    <option key={t} value={t}>
                                      {CARD_THEMES[t].label}
                                    </option>
                                  )
                                )}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 tabular-nums">
                {includedClasses.length} class block
                {includedClasses.length === 1 ? '' : 's'} ready to import
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importing || includedClasses.length === 0}
                  onClick={handleApplyOneRoster}
                  className="px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] disabled:opacity-45 cursor-pointer"
                >
                  {importing ? 'Importing...' : 'Apply OneRoster Schedule'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
