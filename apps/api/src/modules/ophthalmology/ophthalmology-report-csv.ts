import type { OphthalmologyReportType } from './ophthalmology-phase10.types.js';
export function reportCsvCell(value: unknown): string {
  const text = value == null ? '' : value instanceof Date ? value.toISOString() : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return '"' + (/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
}
export async function* ophthalmologyReportCsv(type: OphthalmologyReportType, rows: AsyncIterable<Record<string, unknown>>, volumeBasis?: 'VISITS' | 'ORDERED_ENCOUNTERS') {
  const columns = type === 'CLINICAL_VOLUME' && volumeBasis === 'VISITS' ? ['visit_id', 'branch_id', 'department_id', 'doctor_id', 'doctor_name', 'visit_type', 'visit_date', 'status', 'scheduling_subtype', 'sub_speciality_code', 'sub_speciality_configuration_id'] : type === 'CLINICAL_VOLUME' ? ['_id', 'visit_id', 'first_ordered_at', 'tests']
    : type === 'DIAGNOSTIC_UTILIZATION' ? ['_id', 'ordered', 'completed']
      : type === 'TEST_TURNAROUND' ? ['task_id', 'test_code', 'station_id', 'status', 'order_to_start_ms', 'start_to_completion_ms', 'completion_to_review_ms']
        : ['task_id', 'visit_id', 'test_code', 'test_name', 'station_id', 'device_code', 'status', 'priority', 'ordered_at', 'waiting_since', 'started_at', 'completed_at', 'reviewed_at', ...(type === 'REPEAT_UNABLE' ? ['reason'] : [])];
  yield columns.map(reportCsvCell).join(',') + '\r\n';
  for await (const row of rows) yield columns.map((key) => reportCsvCell(row[key])).join(',') + '\r\n';
}
