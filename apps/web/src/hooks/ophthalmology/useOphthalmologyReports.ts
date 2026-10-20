import { useMutation, useQuery } from '@tanstack/react-query';
import { ophthalmologyService as service } from '../../services/ophthalmology.service';
import type { OphthalmologyReportQuery, OphthalmologyReportType } from '../../api/ophthalmology-reports';
export function useOphthalmologyReport(type: OphthalmologyReportType, query: OphthalmologyReportQuery | null, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'reports', type, query], queryFn: ({ signal }) => { if (!query) throw new Error('Select valid report filters.'); return service.reports.report(type, query, signal); }, enabled: enabled && Boolean(query), retry: false });
}

export function useOphthalmologyReportExport() { return useMutation({ mutationFn: (input: { type: OphthalmologyReportType; query: OphthalmologyReportQuery }) => service.reports.exportReport(input.type, input.query) }); }
