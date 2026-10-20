import { describe, expect, it } from 'vitest';
import { ophthalmologyReportCsv, reportCsvCell } from './ophthalmology-report-csv.js';
describe('Ophthalmology streamed CSV safety', () => {
  it('quotes cells, neutralizes spreadsheet formula prefixes and preserves missing values', () => {
    expect(reportCsvCell(' =SUM(1,2)')).toBe('"\' =SUM(1,2)"');
    expect(reportCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(reportCsvCell(null)).toBe('""');
  });
  it('streams every row from the server projection and excludes arbitrary/internal fields', async () => {
    async function* rows() { yield { task_id: 'first', test_code: 'OCT', comments: 'private' }; yield { task_id: 'second', test_code: 'VA' }; }
    let text = ''; for await (const chunk of ophthalmologyReportCsv('STATION_QUEUE', rows())) text += chunk;
    expect(text.split('\r\n').filter(Boolean)).toHaveLength(3); expect(text).toContain('"second"'); expect(text).not.toContain('private'); expect(text).not.toContain('comments');
  });
});
