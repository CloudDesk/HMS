import { describe, expect, it } from 'vitest';
import { canAccessRoute, getAccessibleSidebarModules } from './access-control';
const permission = (screen: string, action = 'View') => ({ code: `${screen}.${action}`, module: 'OPD', screen, action });
describe('B6 report route permission', () => {
  it('requires exact Reports View even for queue/consultation/publication users', () => { for (const screen of ['Ophthalmology Test Queue', 'Ophthalmology Consultation', 'Ophthalmology Portal Publication']) expect(canAccessRoute('/opd/ophthalmology/reports', [permission(screen)])).toBe(false); expect(canAccessRoute('/opd/ophthalmology/reports', [permission('Ophthalmology Reports', 'Export')])).toBe(false); });
  it('allows a report-only user without Intake or OPD Visits grants', () => { expect(canAccessRoute('/opd/ophthalmology/reports?report_type=PENDING_REVIEW', [permission('Ophthalmology Reports')])).toBe(true); const modules = getAccessibleSidebarModules([permission('Ophthalmology Reports')]); const links = modules.flatMap((row) => row.links); expect(links.some((row) => row.href === '/opd/ophthalmology/reports')).toBe(true); expect(links.some((row) => row.href === '/opd/ophthalmology/queue')).toBe(false); });
});
