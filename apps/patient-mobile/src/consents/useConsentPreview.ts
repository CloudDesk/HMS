import { useEffect, useMemo, useState } from 'react';
import { friendlyError } from '../api/errors';
import { useAuth } from '../ui/AuthContext';
import { ConsentsApi } from './consents-api';
import type { ConsentItem } from './contracts';

type ImageSource = Awaited<ReturnType<ConsentsApi['getDocumentSource']>>;
type Preview = {
  key: string;
  html: string | null;
  signature: ImageSource | null;
  formError: string | null;
  signatureError: string | null;
  formLoading: boolean;
  signatureLoading: boolean;
};

export function useConsentPreview(consent: ConsentItem | null, visible: boolean) {
  const { manager } = useAuth();
  const api = useMemo(() => new ConsentsApi(manager), [manager]);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const patientId = consent?.patient_id;
  const formId = consent?.id;
  const signatureId = consent?.signature_document_id;
  const isHtml = consent?.form_mime_type === 'text/html' || /\.html?$/i.test(consent?.form_file_name ?? '');
  const key = `${patientId}:${formId}:${signatureId}:${attempt}`;

  useEffect(() => {
    if (!visible || !patientId || !formId) { setPreview(null); return; }
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    setPreview({ key, html: null, signature: null, formError: null, signatureError: null,
      formLoading: isHtml, signatureLoading: Boolean(signatureId) });
    const update = (patch: Partial<Preview>) => {
      if (active) setPreview((prev) => prev?.key === key ? { ...prev, ...patch } : prev);
    };
    if (isHtml) {
      void api.getFormHtml(patientId, formId, controller.signal)
        .then((html) => update({ html }))
        .catch((err: unknown) => update({ formError: friendlyError(err) }))
        .finally(() => { clearTimeout(timer); update({ formLoading: false }); });
    } else {
      clearTimeout(timer);
      update({ formError: 'Please review this document format in Patient Portal.' });
    }
    if (signatureId) {
      void api.getDocumentSource(patientId, signatureId)
        .then((signature) => update({ signature }))
        .catch((err: unknown) => update({ signatureError: friendlyError(err), signatureLoading: false }));
    }
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [api, visible, patientId, formId, signatureId, isHtml, key]);

  return {
    preview: visible && preview?.key === key ? preview : null,
    retry: () => setAttempt((value) => value + 1),
    signatureLoaded: () => setPreview((prev) => prev?.key === key ? { ...prev, signatureLoading: false } : prev),
    signatureFailed: () => setPreview((prev) => prev?.key === key
      ? { ...prev, signatureLoading: false, signatureError: 'Unable to load the recorded signature. Please retry.' } : prev),
  };
}
