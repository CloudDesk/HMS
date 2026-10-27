import { useLayoutEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { useSaveOpdConsultationDraft } from '../opd/useOpd';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import type { OpdConsultationResponse } from '../../api/opd';

export const diagnosisEditSchema = z.object({
  assessment: z.string().nullable().optional(),
  diagnoses: z
    .array(
      z.object({
        code: z.string().trim().min(1, 'ICD-10 code is required'),
        display: z.string().trim().min(1, 'Diagnosis display name is required'),
        codingSystem: z.string().trim().min(1),
        type: z.string().min(1).pipe(z.enum(['PRIMARY', 'SECONDARY'])),
        laterality: z.string().min(1, 'Laterality is required').pipe(z.enum(['OD', 'OS', 'OU', 'NOT_APPLICABLE'])),
        status: z.string().min(1).pipe(z.enum(['SUSPECTED', 'CONFIRMED', 'RULED_OUT'])),
        severity: z.string().max(120).nullable().optional(),
        stage: z.string().max(120).nullable().optional(),
        differential: z.boolean(),
        notes: z.string().nullable().optional(),
      }),
    )
    .refine(
      (items) => {
        if (items.length === 0) return true;
        return items.filter((d) => d.type === 'PRIMARY').length === 1;
      },
      {
        message: 'Exactly one diagnosis must be designated as PRIMARY.',
      },
    ),
});
export type DiagnosisForm = z.input<typeof diagnosisEditSchema>;
export type DiagnosisEdit = z.infer<typeof diagnosisEditSchema>;
export function useOphthalmologyDiagnosisEditor(record: Pick<OpdConsultationResponse, 'visit_id' | 'patient_id' | 'version' | 'status'>, canEdit: boolean) {
  const mutation = useSaveOpdConsultationDraft({ notifyOnError: false });
  const scope = useMemo(() => ({ active: true, pending: false }), [record.visit_id, record.patient_id, canEdit]);
  useLayoutEffect(() => { scope.active = true; return () => { scope.active = false; }; }, [scope]);
  const [failure, setFailure] = useState<{ scope: typeof scope; message: string } | null>(null);
  return { busy: mutation.isPending, error: failure?.scope === scope ? failure.message : null,
    save: async (version: number, form: DiagnosisEdit) => {
      if (!canEdit || scope.pending || record.status !== 'DRAFT' || record.version !== version) return undefined;
      scope.pending = true; setFailure(null);
      try {
        const saved = await mutation.mutateAsync({ visitId: record.visit_id, payload: { ...diagnosisEditSchema.parse(form), expected_version: version, expected_status: 'DRAFT' } });
        if (saved.visit_id !== record.visit_id || saved.patient_id !== record.patient_id) throw new Error('Saved diagnosis scope does not match this encounter. Reload before retrying.');
        if (!scope.active) return undefined; toast.success('Structured assessment saved.'); return saved;
      } catch (error) {
        if (scope.active) {
          const message = getOpdErrorMessage(error);
          setFailure({ scope, message });
          toast.error(message);
        }
        return undefined;
      }
      finally { scope.pending = false; }
    },
  };
}
