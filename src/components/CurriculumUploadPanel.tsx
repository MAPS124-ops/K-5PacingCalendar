import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Trash2,
  Upload,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  GradeLevel,
  LessonItem,
  NonSchoolDay,
  SubjectBlock,
} from '../types/pacing';
import {
  autoDetectColumnMapping,
  buildDraftLessonsFromSpreadsheet,
  CadencePattern,
  ColumnMapping,
  DraftImportedLesson,
  draftsToLessonItems,
  parseDelimitedText,
  SAMPLE_TEMPLATES,
  SchedulingMode,
} from '../utils/curriculumParser';
import { CARD_THEMES } from '../utils/themeUtils';

interface CurriculumUploadPanelProps {
  selectedGrade: GradeLevel;
  gradeLabel: string;
  selectedDate: string;
  subjects: SubjectBlock[];
  existingLessons: LessonItem[];
  nonSchoolDays: NonSchoolDay[];
  isEditor: boolean;
  onImportLessons: (
    lessonsToInsert: LessonItem[],
    lessonIdsToDelete: string[]
  ) => Promise<void>;
}

type ConflictMode = 'append' | 'replace';

export function CurriculumUploadPanel({
  selectedGrade,
  gradeLabel,
  selectedDate,
  subjects,
  existingLessons,
  nonSchoolDays,
  isEditor,
  onImportLessons,
}: CurriculumUploadPanelProps) {
  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.order - b.order),
    [subjects]
  );

  const [rawText, setRawText] = useState('');
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [defaultSubjectId, setDefaultSubjectId] = useState(
    sortedSubjects[0]?.id ?? 'everyday-math'
  );
  const [schedulingMode, setSchedulingMode] =
    useState<SchedulingMode>('auto-pace');
  const [startDate, setStartDate] = useState(selectedDate);
  const [cadence, setCadence] = useState<CadencePattern>('daily');
  const [conflictMode, setConflictMode] = useState<ConflictMode>('append');

  const [mapping, setMapping] = useState<ColumnMapping>({
    unitTitle: null,
    lessonTitle: null,
    date: null,
    subject: null,
    standards: null,
    bullets: null,
    slidesUrl: null,
    unitResourcesUrl: null,
    externalUrl: null,
    prepFlag: null,
    notes: null,
  });

  const [drafts, setDrafts] = useState<DraftImportedLesson[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseDelimitedText(rawText), [rawText]);

  // Auto-detect mapping whenever headers change from a new upload/paste
  useEffect(() => {
    if (parsed.headers.length === 0) return;
    const detected = autoDetectColumnMapping(parsed.headers);
    setMapping(detected);
    if (detected.date !== null) {
      setSchedulingMode('use-file-dates');
    } else {
      setSchedulingMode('auto-pace');
    }
    setImportSuccessCount(null);
  }, [parsed.headers]);

  // Rebuild preview rows when mapping or scheduling parameters change
  useEffect(() => {
    if (parsed.rows.length === 0) {
      setDrafts([]);
      return;
    }
    const nextDrafts = buildDraftLessonsFromSpreadsheet({
      rows: parsed.rows,
      mapping,
      grade: selectedGrade,
      defaultSubjectId,
      subjects: sortedSubjects,
      schedulingMode,
      startDate,
      cadence,
      nonSchoolDays,
    });
    setDrafts(nextDrafts);
  }, [
    parsed.rows,
    mapping,
    selectedGrade,
    defaultSubjectId,
    sortedSubjects,
    schedulingMode,
    startDate,
    cadence,
    nonSchoolDays,
  ]);

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawText(reader.result);
        setSourceLabel(file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const handleLoadSample = (
    key: keyof typeof SAMPLE_TEMPLATES
  ) => {
    const sample = SAMPLE_TEMPLATES[key];
    setRawText(sample.csv);
    setSourceLabel(sample.label);
    const matchedSubj = sortedSubjects.find((s) => s.id === sample.defaultSubjectId);
    if (matchedSubj) setDefaultSubjectId(matchedSubj.id);
  };

  const handleDownloadSample = (key: keyof typeof SAMPLE_TEMPLATES) => {
    const sample = SAMPLE_TEMPLATES[key];
    const blob = new Blob([sample.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${key}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const includedDrafts = drafts.filter((d) => d.included);

  const conflictingLessonIds = useMemo(() => {
    if (conflictMode !== 'replace') return [];
    const slotKeys = new Set(
      includedDrafts.map((d) => `${d.subjectId}::${d.date}`)
    );
    return existingLessons
      .filter((l) => slotKeys.has(`${l.subjectId}::${l.date}`))
      .map((l) => l.id);
  }, [conflictMode, includedDrafts, existingLessons]);

  const handleConfirmImport = async () => {
    if (!isEditor || includedDrafts.length === 0) return;
    setImporting(true);
    try {
      const items = draftsToLessonItems(includedDrafts);
      await onImportLessons(items, conflictingLessonIds);
      setImportSuccessCount(items.length);
      setRawText('');
      setSourceLabel(null);
      setDrafts([]);
    } finally {
      setImporting(false);
    }
  };

  const updateDraft = (
    tempId: string,
    patch: Partial<DraftImportedLesson>
  ) => {
    setDrafts((prev) =>
      prev.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d))
    );
  };

  const renderMappingSelect = (
    label: string,
    field: keyof ColumnMapping,
    required = false
  ) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={mapping[field] === null ? '' : String(mapping[field])}
        onChange={(e) => {
          const val = e.target.value;
          setMapping((prev) => ({
            ...prev,
            [field]: val === '' ? null : Number(val),
          }));
        }}
        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
      >
        <option value="">— Skip / Not in file —</option>
        {parsed.headers.map((header, idx) => (
          <option key={`${header}-${idx}`} value={idx}>
            {header}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      {importSuccessCount !== null && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>{importSuccessCount} lessons</strong> imported into{' '}
              <strong>{gradeLabel}</strong>. Upload another program guide below or switch to Daily / Weekly / Pacing Guide to inspect them.
            </span>
          </div>
        </div>
      )}

      {/* Step 1: Upload File or Paste Spreadsheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-[#F9FAFC] p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#1D2F6F]" />
                <h2 className="font-display text-sm font-bold text-[#182756]">
                  1. Upload Guide or Paste Table
                </h2>
              </div>
              {sourceLabel && (
                <button
                  type="button"
                  onClick={() => {
                    setRawText('');
                    setSourceLabel(null);
                    setDrafts([]);
                  }}
                  className="text-[11px] font-semibold text-slate-500 hover:text-red-600 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                isDragging
                  ? 'border-[#1D2F6F] bg-[#EEF2FA]'
                  : 'border-slate-300 bg-white'
              }`}
            >
              <Upload
                className="w-6 h-6 text-[#1D2F6F]/75 mx-auto mb-2"
                aria-hidden="true"
              />
              <p className="text-xs font-semibold text-[#182756]">
                {sourceLabel
                  ? `Loaded: ${sourceLabel}`
                  : 'Drag & drop a CSV or TSV pacing guide here'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Supports CSV exports from Google Sheets, Excel, Everyday Math, Arts & Letters, and UFLI
              </p>
              <button
                type="button"
                disabled={!isEditor}
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 px-4 py-1.5 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] disabled:opacity-45 cursor-pointer"
              >
                Choose CSV / TSV File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Sample Templates */}
          <div className="pt-1 border-t border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 mb-2">
              Quick-load or download a program template:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(
                Object.keys(SAMPLE_TEMPLATES) as Array<
                  keyof typeof SAMPLE_TEMPLATES
                >
              ).map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                >
                  <button
                    type="button"
                    disabled={!isEditor}
                    onClick={() => handleLoadSample(key)}
                    className="font-semibold text-[#1D2F6F] hover:underline truncate text-left cursor-pointer disabled:opacity-45"
                  >
                    {SAMPLE_TEMPLATES[key].label}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSample(key)}
                    title={`Download ${SAMPLE_TEMPLATES[key].label}`}
                    className="p-1 text-slate-400 hover:text-[#1D2F6F] shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Paste directly from Google Sheets / Excel */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2">
            <label
              htmlFor="paste-curriculum-box"
              className="font-display text-sm font-bold text-[#182756]"
            >
              Or Paste Directly From Google Sheets / Excel
            </label>
            <span className="text-[11px] text-slate-400">
              First row = column headers
            </span>
          </div>
          <textarea
            id="paste-curriculum-box"
            disabled={!isEditor}
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setSourceLabel('Pasted Spreadsheet Data');
            }}
            placeholder={`Unit/Lesson\tLesson Focus\tStandards\tNotes\nLesson 3-1\tVisualizing Number Stories\tCCSS.MATH.1.OA.1\tUse number mats`}
            className="flex-1 min-h-[210px] w-full p-3 rounded-xl border border-slate-200 bg-[#F9FAFC] font-mono text-[11px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D2F6F]/25"
          />
          {parsed.rows.length > 0 && (
            <p className="text-[11px] font-semibold text-emerald-700 mt-2 tabular-nums">
              Detected {parsed.headers.length} columns and {parsed.rows.length} lesson rows.
            </p>
          )}
        </div>
      </div>

      {/* Step 2: Column Mapping & Scheduling Rules (visible once rows exist) */}
      {parsed.headers.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-[#F9FAFC] p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <h2 className="font-display text-sm font-bold text-[#182756]">
              2. Map Columns & Scheduling Cadence ({gradeLabel})
            </h2>
            <span className="text-[11px] text-slate-500">
              Auto-matched columns can be adjusted below
            </span>
          </div>

          {/* Target Subject & Dating Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Default Target Subject
              </label>
              <select
                value={defaultSubjectId}
                onChange={(e) => setDefaultSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#182756]"
              >
                {sortedSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Used when no Subject column is mapped
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Date Scheduling Mode
              </label>
              <select
                value={schedulingMode}
                onChange={(e) =>
                  setSchedulingMode(e.target.value as SchedulingMode)
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
              >
                <option value="auto-pace">Auto-Pace Across School Days</option>
                <option value="use-file-dates">
                  Use Date Column From File
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {schedulingMode === 'auto-pace'
                  ? 'Pacing Start Date'
                  : 'Fallback Start Date'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Pacing Cadence
              </label>
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value as CadencePattern)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
              >
                <option value="daily">Every School Day (Mon–Fri)</option>
                <option value="mwf">Mon / Wed / Fri</option>
                <option value="tuth">Tue / Thu</option>
              </select>
            </div>
          </div>

          {/* Column Mapper Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            {renderMappingSelect('Unit / Module', 'unitTitle', true)}
            {renderMappingSelect('Lesson Focus', 'lessonTitle', true)}
            {renderMappingSelect('Subject (Multi-Program)', 'subject')}
            {renderMappingSelect('Date', 'date')}
            {renderMappingSelect('Standards', 'standards')}
            {renderMappingSelect('Prep Flag (P)', 'prepFlag')}
            {renderMappingSelect('Sub-Bullets / Anchor Text', 'bullets')}
            {renderMappingSelect('Slides URL', 'slidesUrl')}
            {renderMappingSelect('Resources URL', 'unitResourcesUrl')}
            {renderMappingSelect('Curriculum Link', 'externalUrl')}
            {renderMappingSelect('Teacher Notes', 'notes')}

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Existing Slot Conflict
              </label>
              <select
                value={conflictMode}
                onChange={(e) => setConflictMode(e.target.value as ConflictMode)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
              >
                <option value="append">Add Alongside Existing</option>
                <option value="replace">Replace Matching Subject+Date</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Confirm Import */}
      {drafts.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 bg-[#EEF1F8] border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-bold text-[#182756]">
                3. Preview & Edit Lessons ({includedDrafts.length} selected)
              </h2>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Review dates, subjects, and titles before saving to {gradeLabel}.
                {conflictMode === 'replace' && conflictingLessonIds.length > 0 && (
                  <span className="ml-1.5 font-semibold text-amber-800">
                    ({conflictingLessonIds.length} existing lesson
                    {conflictingLessonIds.length === 1 ? '' : 's'} on matching slots will be replaced)
                  </span>
                )}
              </p>
            </div>

            <button
              type="button"
              disabled={!isEditor || importing || includedDrafts.length === 0}
              onClick={handleConfirmImport}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] disabled:opacity-45 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                {importing
                  ? 'Importing...'
                  : `Import ${includedDrafts.length} Lesson${
                      includedDrafts.length === 1 ? '' : 's'
                    }`}
              </span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-[380px]">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      aria-label="Toggle all rows"
                      checked={
                        drafts.length > 0 && drafts.every((d) => d.included)
                      }
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setDrafts((prev) =>
                          prev.map((d) => ({ ...d, included: checked }))
                        );
                      }}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="py-2.5 px-3 w-36">Date</th>
                  <th className="py-2.5 px-3 w-44">Subject</th>
                  <th className="py-2.5 px-3 w-48">Unit / Header</th>
                  <th className="py-2.5 px-3">Lesson Focus</th>
                  <th className="py-2.5 px-3 w-36">Standards</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drafts.map((row) => {
                  const subj = sortedSubjects.find((s) => s.id === row.subjectId);
                  const theme =
                    CARD_THEMES[subj?.defaultTheme ?? 'navy'];

                  return (
                    <tr
                      key={row.tempId}
                      className={row.included ? 'bg-white' : 'bg-slate-50/70 opacity-55'}
                    >
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.included}
                          onChange={(e) =>
                            updateDraft(row.tempId, {
                              included: e.target.checked,
                            })
                          }
                          aria-label={`Include ${row.unitTitle}`}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) =>
                            updateDraft(row.tempId, { date: e.target.value })
                          }
                          className="px-2 py-1 rounded border border-slate-200 text-xs tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={row.subjectId}
                          onChange={(e) =>
                            updateDraft(row.tempId, {
                              subjectId: e.target.value,
                            })
                          }
                          className={`w-full px-2 py-1 rounded text-[11px] font-semibold border border-slate-200 ${theme.badgeBg} ${theme.badgeText}`}
                        >
                          {sortedSubjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={row.unitTitle}
                          maxLength={140}
                          onChange={(e) =>
                            updateDraft(row.tempId, {
                              unitTitle: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-semibold text-[#182756]"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={row.lessonTitle}
                          maxLength={180}
                          onChange={(e) =>
                            updateDraft(row.tempId, {
                              lessonTitle: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1 rounded border border-slate-200 text-xs text-slate-800"
                        />
                      </td>
                      <td className="py-2 px-3 text-[11px] text-slate-500 truncate max-w-[160px]">
                        {row.standards || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
