import { useQuery } from '@tanstack/react-query';
import type { PhaseTwoReportParams } from '../../api/phase-two-reports';
import { phaseTwoReportsService } from '../../services/phase-two-reports.service';
export const phaseTwoReportKeys = { all: ['phase-two-reports'] as const, detail: (params: PhaseTwoReportParams) => [...phaseTwoReportKeys.all, params] as const };
export const usePhaseTwoReports = (params: PhaseTwoReportParams, enabled = true) => useQuery({ queryKey: phaseTwoReportKeys.detail(params), queryFn: () => phaseTwoReportsService.get(params), enabled });
