import React from 'react';
import toast from 'react-hot-toast';
import {
  createComplianceReport,
  deleteComplianceReport,
  listComplianceReports,
  type ComplianceReportInput,
  type ComplianceReportRecord,
  type ComplianceReportStatus,
  updateComplianceReport,
} from '@/lib/adminComplianceReportsApi';

const ZERO_NOTE = 'No grievances were received during this reporting month.';
const NIL_VALUE = 'Nil';
const WEBSITE_URL = 'https://www.newspulse.co.in';
const GRIEVANCE_EMAIL = 'grievance@newspulse.co.in';

const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

type FormValues = {
  month: string;
  year: string;
  label: string;
  publishedDate: string;
  complaintsReceived: string;
  complaintsResolved: string;
  averageResponseTime: string;
  complaintsPending: string;
  actionTakenOnOrdersDirections: string;
  note: string;
  status: ComplianceReportStatus;
};

function formatDate(value: string | null): string {
  if (!value) return 'Not published';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not published';
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function toDateInputValue(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function toNumericString(value: number): string {
  return Number.isFinite(value) ? String(value) : '0';
}

function currentMonth(): string {
  return MONTH_OPTIONS[new Date().getMonth()] || MONTH_OPTIONS[0];
}

function currentYear(): string {
  return String(new Date().getFullYear());
}

function buildDefaultLabel(month: string, year: string): string {
  const safeMonth = month.trim();
  const safeYear = year.trim();
  return [safeMonth, safeYear].filter(Boolean).join(' ').trim()
    ? `${[safeMonth, safeYear].filter(Boolean).join(' ')} Compliance Report`
    : '';
}

function emptyForm(): FormValues {
  const month = currentMonth();
  const year = currentYear();
  return {
    month,
    year,
    label: buildDefaultLabel(month, year),
    publishedDate: '',
    complaintsReceived: '0',
    complaintsResolved: '0',
    averageResponseTime: NIL_VALUE,
    complaintsPending: '0',
    actionTakenOnOrdersDirections: NIL_VALUE,
    note: ZERO_NOTE,
    status: 'draft',
  };
}

function reportToForm(report: ComplianceReportRecord): FormValues {
  const month = report.month || currentMonth();
  const year = report.year ? String(report.year) : currentYear();
  const complaintsReceived = toNumericString(report.complaintsReceived);
  const complaintsResolved = toNumericString(report.complaintsResolved);
  const complaintsPending = toNumericString(report.complaintsPending);
  const allZero = [complaintsReceived, complaintsResolved, complaintsPending]
    .map(parseCount)
    .every((value) => value === 0);

  return {
    month,
    year,
    label: report.label || buildDefaultLabel(month, year),
    publishedDate: toDateInputValue(report.publishedDate),
    complaintsReceived,
    complaintsResolved,
    averageResponseTime: report.averageResponseTime || (allZero ? NIL_VALUE : ''),
    complaintsPending,
    actionTakenOnOrdersDirections: report.actionTakenOnOrdersDirections || (allZero ? NIL_VALUE : ''),
    note: report.note || (allZero ? ZERO_NOTE : ''),
    status: report.status,
  };
}

function parseCount(value: string): number {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : 0;
}

function buildPayload(values: FormValues, status: ComplianceReportStatus): ComplianceReportInput {
  const complaintsReceived = parseCount(values.complaintsReceived);
  const complaintsResolved = parseCount(values.complaintsResolved);
  const complaintsPending = parseCount(values.complaintsPending);
  const allZero = complaintsReceived === 0 && complaintsResolved === 0 && complaintsPending === 0;
  const publishedDate = status === 'published'
    ? (values.publishedDate || new Date().toISOString().slice(0, 10))
    : values.publishedDate || null;
  const averageResponseTime = values.averageResponseTime.trim() || (allZero ? NIL_VALUE : '');
  const actionTakenOnOrdersDirections = values.actionTakenOnOrdersDirections.trim()
    || (status === 'published' || allZero ? NIL_VALUE : '');

  return {
    month: values.month,
    year: Number(values.year) || new Date().getFullYear(),
    label: values.label.trim() || buildDefaultLabel(values.month, values.year),
    publishedDate,
    complaintsReceived,
    complaintsResolved,
    averageResponseTime,
    complaintsPending,
    actionTakenOnOrdersDirections,
    note: values.note.trim() || (allZero ? ZERO_NOTE : ''),
    status,
  };
}

function getReportId(report: Pick<ComplianceReportRecord, 'id' | '_id'>): string {
  return report.id || report._id || '';
}

function slugifyReportPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildReportFilename(report: ComplianceReportRecord, prefix: string, extension: 'pdf' | 'xlsx'): string {
  const month = slugifyReportPart(report.month || 'report');
  const year = String(report.year || '').trim() || String(new Date().getFullYear());
  return `${prefix}-${month}-${year}.${extension}`;
}

function reportStatusLabel(status: ComplianceReportStatus): string {
  return status === 'published' ? 'Published' : 'Draft';
}

export default function ComplianceReportsPage() {
  const [reports, setReports] = React.useState<ComplianceReportRecord[]>([]);
  const [formValues, setFormValues] = React.useState<FormValues>(() => emptyForm());
  const [isLabelManuallyEdited, setIsLabelManuallyEdited] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [exportingKey, setExportingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const summary = React.useMemo(() => {
    const published = reports.filter((report) => report.status === 'published').length;
    const draft = reports.length - published;
    return { total: reports.length, published, draft };
  }, [reports]);

  const loadReports = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await listComplianceReports();
      setReports(next);
    } catch (err: any) {
      const message = err?.message || 'Failed to load compliance reports';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadReports();
  }, [loadReports]);

  React.useEffect(() => {
    setFormValues((current) => {
      const allZero = [current.complaintsReceived, current.complaintsResolved, current.complaintsPending]
        .map(parseCount)
        .every((value) => value === 0);

      const nextAverageResponseTime = allZero && !current.averageResponseTime.trim()
        ? NIL_VALUE
        : current.averageResponseTime;
      const nextActionTaken = allZero && !current.actionTakenOnOrdersDirections.trim()
        ? NIL_VALUE
        : current.actionTakenOnOrdersDirections;
      const nextNote = allZero && (!current.note.trim() || current.note === ZERO_NOTE)
        ? ZERO_NOTE
        : (!allZero && current.note === ZERO_NOTE ? '' : current.note);

      if (
        nextAverageResponseTime === current.averageResponseTime
        && nextActionTaken === current.actionTakenOnOrdersDirections
        && nextNote === current.note
      ) {
        return current;
      }

      return {
        ...current,
        averageResponseTime: nextAverageResponseTime,
        actionTakenOnOrdersDirections: nextActionTaken,
        note: nextNote,
      };
    });
  }, [
    formValues.actionTakenOnOrdersDirections,
    formValues.averageResponseTime,
    formValues.complaintsPending,
    formValues.complaintsReceived,
    formValues.complaintsResolved,
    formValues.note,
  ]);

  React.useEffect(() => {
    if (isLabelManuallyEdited) return;

    setFormValues((current) => {
      const nextLabel = buildDefaultLabel(current.month, current.year);
      return current.label === nextLabel ? current : { ...current, label: nextLabel };
    });
  }, [formValues.month, formValues.year, isLabelManuallyEdited]);

  const resetForm = React.useCallback(() => {
    setEditingId(null);
    setFormValues(emptyForm());
    setIsLabelManuallyEdited(false);
  }, []);

  const handleFieldChange = React.useCallback(
    (field: keyof FormValues) =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        if (field === 'label') {
          setIsLabelManuallyEdited(true);
        }
        setFormValues((current) => ({ ...current, [field]: value }));
      },
    [],
  );

  const handleEdit = React.useCallback((report: ComplianceReportRecord) => {
    const reportId = getReportId(report);
    if (!reportId) return;

    const nextForm = reportToForm(report);
    setEditingId(reportId);
    setFormValues(nextForm);
    setIsLabelManuallyEdited(nextForm.label.trim() !== buildDefaultLabel(nextForm.month, nextForm.year));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleDelete = React.useCallback(async (report: ComplianceReportRecord) => {
    const reportId = getReportId(report);
    if (!reportId) {
      toast.error('This report cannot be deleted because it is missing an id');
      return;
    }
    const confirmed = window.confirm(`Delete compliance report "${report.label || `${report.month} ${report.year}`}"?`);
    if (!confirmed) return;

    setDeletingId(reportId);
    try {
      await deleteComplianceReport(reportId);
      if (editingId === reportId) {
        resetForm();
      }
      await loadReports();
      toast.success('Compliance report deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete compliance report');
    } finally {
      setDeletingId(null);
    }
  }, [editingId, loadReports, resetForm]);

  const submit = React.useCallback(async (status: ComplianceReportStatus) => {
    if (!formValues.month || !formValues.year) {
      toast.error('Month and year are required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildPayload(formValues, status);
      const saved = editingId
        ? await updateComplianceReport(editingId, payload)
        : await createComplianceReport(payload);
      const savedId = getReportId(saved);

      if (savedId) {
        setReports((current) => {
          const next = current.filter((item) => getReportId(item) !== savedId);
          return [saved, ...next].sort((left, right) => {
            if (left.year !== right.year) return right.year - left.year;
            return MONTH_OPTIONS.indexOf(right.month as (typeof MONTH_OPTIONS)[number]) - MONTH_OPTIONS.indexOf(left.month as (typeof MONTH_OPTIONS)[number]);
          });
        });

        setEditingId(savedId);
        const nextForm = reportToForm(saved);
        setFormValues(nextForm);
        setIsLabelManuallyEdited(nextForm.label.trim() !== buildDefaultLabel(nextForm.month, nextForm.year));
      } else {
        await loadReports();
        if (!editingId) {
          resetForm();
        }
      }

      toast.success(status === 'published' ? 'Compliance report published' : 'Compliance report saved as draft');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save compliance report');
    } finally {
      setIsSaving(false);
    }
  }, [editingId, formValues, loadReports, resetForm]);

  const exportPdf = React.useCallback(async (report: ComplianceReportRecord) => {
    const reportId = getReportId(report);
    if (!reportId) {
      toast.error('Refresh records. This temporary draft has no saved ID.');
      return;
    }

    setExportingKey(`pdf:${reportId}`);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const left = 48;
      const maxWidth = 500;
      let cursorY = 56;

      const writeBlock = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, left, cursorY);
        cursorY += 16;
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(value || NIL_VALUE, maxWidth);
        doc.text(lines, left, cursorY);
        cursorY += lines.length * 14 + 10;
      };

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('News Pulse Media', left, cursorY);
      cursorY += 26;

      doc.setFontSize(16);
      doc.text('Monthly Compliance Report', left, cursorY);
      cursorY += 28;

      doc.setFontSize(11);
      writeBlock('Report Label', report.label || buildDefaultLabel(report.month, String(report.year)));
      writeBlock('Website', WEBSITE_URL);
      writeBlock('Grievance Email', GRIEVANCE_EMAIL);
      writeBlock('Published Date', formatDate(report.publishedDate));
      writeBlock('Status', reportStatusLabel(report.status));
      writeBlock('Grievances Received', String(report.complaintsReceived));
      writeBlock('Grievances Resolved', String(report.complaintsResolved));
      writeBlock('Grievances Pending', String(report.complaintsPending));
      writeBlock('Average Response Time', report.averageResponseTime || NIL_VALUE);
      writeBlock('Action Taken on Orders/Directions', report.actionTakenOnOrdersDirections || NIL_VALUE);
      writeBlock('Note', report.note || ZERO_NOTE);

      doc.setDrawColor(203, 213, 225);
      doc.line(left, cursorY + 8, left + maxWidth, cursorY + 8);
      cursorY += 28;
      doc.setFont('helvetica', 'italic');
      doc.text('This PDF is an internal compliance proof copy generated from News Pulse Admin Panel.', left, cursorY);

      doc.save(buildReportFilename(report, 'news-pulse-compliance-report', 'pdf'));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export PDF');
    } finally {
      setExportingKey(null);
    }
  }, []);

  const exportExcel = React.useCallback(async (report: ComplianceReportRecord) => {
    const reportId = getReportId(report);
    if (!reportId) {
      toast.error('Refresh records. This temporary draft has no saved ID.');
      return;
    }

    setExportingKey(`excel:${reportId}`);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      const summarySheet = XLSX.utils.aoa_to_sheet([
        ['Field', 'Value'],
        ['Organization', 'News Pulse Media'],
        ['Report Title', 'Monthly Compliance Report'],
        ['Report Label', report.label || buildDefaultLabel(report.month, String(report.year))],
        ['Website', WEBSITE_URL],
        ['Grievance Email', GRIEVANCE_EMAIL],
        ['Published Date', formatDate(report.publishedDate)],
        ['Status', reportStatusLabel(report.status)],
        ['Grievances Received', report.complaintsReceived],
        ['Grievances Resolved', report.complaintsResolved],
        ['Grievances Pending', report.complaintsPending],
        ['Average Response Time', report.averageResponseTime || NIL_VALUE],
        ['Action Taken on Orders/Directions', report.actionTakenOnOrdersDirections || NIL_VALUE],
        ['Note', report.note || ZERO_NOTE],
      ]);

      const registerRows = [
        [
          'Case ID',
          'Received Date',
          'Complainant Name',
          'Complainant Email',
          'Article/Page URL',
          'Complaint Summary',
          'Acknowledged Date',
          'Action Taken',
          'Resolved Date',
          'Status',
          'Proof Notes',
        ],
      ];

      if (report.complaintsReceived === 0) {
        registerRows.push(['', '', '', '', '', ZERO_NOTE, '', '', '', '', '']);
      } else {
        registerRows.push([
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          'Detailed grievance register data is maintained separately from this monthly summary record.',
        ]);
      }

      const registerSheet = XLSX.utils.aoa_to_sheet(registerRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Monthly Summary');
      XLSX.utils.book_append_sheet(workbook, registerSheet, 'Grievance Register');
      XLSX.writeFile(workbook, buildReportFilename(report, 'news-pulse-grievance-register', 'xlsx'));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export Excel');
    } finally {
      setExportingKey(null);
    }
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Admin Compliance Desk</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Monthly Compliance Reports</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Draft, publish, and maintain monthly grievance compliance reports without affecting other protected admin modules.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-950 p-3 text-white shadow-lg shadow-slate-200/60">
            <div className="min-w-[96px] rounded-2xl bg-white/10 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-300">Total</div>
              <div className="mt-2 text-2xl font-semibold">{summary.total}</div>
            </div>
            <div className="min-w-[96px] rounded-2xl bg-emerald-400/15 px-4 py-3 text-emerald-100">
              <div className="text-xs uppercase tracking-wide text-emerald-200">Published</div>
              <div className="mt-2 text-2xl font-semibold text-white">{summary.published}</div>
            </div>
            <div className="min-w-[96px] rounded-2xl bg-amber-400/15 px-4 py-3 text-amber-100">
              <div className="text-xs uppercase tracking-wide text-amber-200">Drafts</div>
              <div className="mt-2 text-2xl font-semibold text-white">{summary.draft}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.6fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{editingId ? 'Edit report' : 'Add new report'}</h2>
              <p className="mt-1 text-sm text-slate-500">Use Save Draft for in-progress work or Publish when the report is ready.</p>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                New report
              </button>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Month</span>
              <select
                value={formValues.month}
                onChange={handleFieldChange('month')}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              >
                {MONTH_OPTIONS.map((month) => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Year</span>
              <input
                type="number"
                min="2000"
                max="2100"
                value={formValues.year}
                onChange={handleFieldChange('year')}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
              <span className="font-medium">Label</span>
              <input
                type="text"
                value={formValues.label}
                onChange={handleFieldChange('label')}
                placeholder="May 2026 Compliance Report"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Published Date</span>
              <input
                type="date"
                value={formValues.publishedDate}
                onChange={handleFieldChange('publishedDate')}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Status</span>
              <select
                value={formValues.status}
                onChange={handleFieldChange('status')}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Grievances Received</span>
              <input
                type="number"
                min="0"
                value={formValues.complaintsReceived}
                onChange={handleFieldChange('complaintsReceived')}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Grievances Resolved</span>
              <input
                type="number"
                min="0"
                value={formValues.complaintsResolved}
                onChange={handleFieldChange('complaintsResolved')}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Grievances Pending</span>
              <input
                type="number"
                min="0"
                value={formValues.complaintsPending}
                onChange={handleFieldChange('complaintsPending')}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
              <span className="font-medium">Average Response Time</span>
              <input
                type="text"
                value={formValues.averageResponseTime}
                onChange={handleFieldChange('averageResponseTime')}
                placeholder="e.g. 48 hours"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
              <span className="font-medium">Action Taken on Orders/Directions</span>
              <textarea
                rows={4}
                value={formValues.actionTakenOnOrdersDirections}
                onChange={handleFieldChange('actionTakenOnOrdersDirections')}
                placeholder="Describe actions taken for regulator orders or directions"
                className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
              <span className="font-medium">Note</span>
              <textarea
                rows={4}
                value={formValues.note}
                onChange={handleFieldChange('note')}
                className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void submit('draft')}
              className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving && formValues.status === 'draft' ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void submit('published')}
              className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving && formValues.status === 'published' ? 'Publishing…' : 'Publish'}
            </button>
            <span className="text-sm text-slate-500">
              Publishing will make this monthly summary visible on the public Monthly Compliance Report page.
            </span>
            {editingId ? (
              <span className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Editing existing report</span>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Internal Report Records</h2>
              <p className="mt-1 text-sm text-slate-500">
                These records are for admin management and private compliance proof. The public website shows only the latest published monthly report.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadReports()}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="pb-3 pr-4 font-semibold">Month &amp; Year</th>
                  <th className="pb-3 pr-4 font-semibold">Received</th>
                  <th className="pb-3 pr-4 font-semibold">Resolved</th>
                  <th className="pb-3 pr-4 font-semibold">Pending</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 pr-4 font-semibold">Updated</th>
                  <th className="pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-500">Loading compliance reports…</td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-500">No monthly compliance reports found yet.</td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={getReportId(report) || `${report.month}-${report.year}`} className="align-top text-slate-700">
                      {(() => {
                        const reportId = getReportId(report);
                        const isExportingPdf = exportingKey === `pdf:${reportId}`;
                        const isExportingExcel = exportingKey === `excel:${reportId}`;
                        const isActionDisabled = !reportId;

                        return (
                          <>
                      <td className="py-4 pr-4">
                        <div className="font-medium text-slate-900">{report.month} {report.year}</div>
                        <div className="mt-1 text-xs text-slate-500">{report.label || 'Untitled report'}</div>
                      </td>
                      <td className="py-4 pr-4">{report.complaintsReceived}</td>
                      <td className="py-4 pr-4">{report.complaintsResolved}</td>
                      <td className="py-4 pr-4">{report.complaintsPending}</td>
                      <td className="py-4 pr-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${report.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {report.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-slate-500">{formatDate(report.updatedAt || report.publishedDate)}</td>
                      <td className="py-4">
                        {reportId ? null : (
                          <div className="mb-2 text-xs text-amber-700">
                            Refresh records. This temporary draft has no saved ID.
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isActionDisabled}
                            onClick={() => handleEdit(report)}
                            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={isActionDisabled || isExportingExcel || isExportingPdf}
                            onClick={() => void exportPdf(report)}
                            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isExportingPdf ? 'Exporting PDF…' : 'Export PDF'}
                          </button>
                          <button
                            type="button"
                            disabled={isActionDisabled || isExportingExcel || isExportingPdf}
                            onClick={() => void exportExcel(report)}
                            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isExportingExcel ? 'Exporting Excel…' : 'Export Excel'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(report)}
                            disabled={isActionDisabled || deletingId === reportId || isExportingExcel || isExportingPdf}
                            className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === reportId ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                          </>
                        );
                      })()}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm ring-1 ring-amber-100">
        Private grievance records, proof files, and authority communication should be stored separately and must not be published publicly.
      </section>
    </div>
  );
}