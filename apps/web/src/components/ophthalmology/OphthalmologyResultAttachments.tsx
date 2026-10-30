import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../ui/Modal';
import type { OphthalmologyResultFeature, OphthalmologyResultWorkspace } from '../../hooks/ophthalmology/useOphthalmologyResultFeature';
import { useFundusCameraCapture } from '../../hooks/ophthalmology/useFundusCameraCapture';
import { useOphthalmologyDraftGuard } from '../../hooks/ophthalmology/useOphthalmologyDraftGuard';
import { EditorErrors, inputInstant, localDateTime, useEditorLeaveGuard } from './OphthalmologyConfigurationEditor';

const schema = z.object({ title: z.string().trim().min(1).max(250), acquired_at: z.string().datetime({ offset: true }) });
type Values = z.infer<typeof schema>;
type Props = {
  feature: OphthalmologyResultFeature;
  workspace: OphthalmologyResultWorkspace;
  selectedIds?: string[];
  onSelection?: (ids: string[]) => void;
  disabled?: boolean;
  allowCamera?: boolean;
  alwaysShow?: boolean;
};

function SelectedImagePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return preview?.file === file ? <img src={preview.url} alt="Selected image — not yet uploaded" style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }} /> : null;
}

export function OphthalmologyResultAttachments({ feature: f, workspace, selectedIds = [], onSelection, disabled = false, allowCamera = false, alwaysShow = false }: Props) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [capturing, setCapturing] = useState(false);
  const attempt = useRef<{ file: File; signature: string; key: string } | null>(null);
  const { register, control, setValue, setError, clearErrors, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: '', acquired_at: '' } });
  const values = useWatch({ control });
  const leave = useEditorLeaveGuard(uploadOpen && (isDirty || Boolean(file)));
  useOphthalmologyDraftGuard(uploadOpen && (isDirty || Boolean(file)), ['fundus_task_id', 'task_page']);
  const camera = useFundusCameraCapture(allowCamera && uploadOpen && f.canAttach && !f.busy && !isSubmitting);
  const busy = f.busy || isSubmitting || capturing;
  const close = async () => {
    if (!busy && await leave()) {
      camera.stop(); setUploadOpen(false); setFile(null); attempt.current = null; reset();
    }
  };
  return <section className="doc-card">
    <h3>Images and reports</h3>
    <p>Files remain internal until the separate review/publication workflow approves them. File type and size limits are enforced by the server.</p>
    <div className="oph-toolbar">
      {!alwaysShow && <button className="doc-btn" type="button" onClick={() => workspace.setQuery('attachments', f.attachmentsOpen ? 'closed' : 'open')}>{f.attachmentsOpen ? 'Hide attachments' : 'Load task attachments'}</button>}
      {f.canAttach && <button type="button" className="doc-btn" disabled={f.busy} onClick={() => setUploadOpen(true)}>{allowCamera ? 'Upload / capture fundus image' : 'Upload image / report'}</button>}
    </div>
    {f.downloadError && <p role="alert" className="form-error-banner">Download failed. {f.downloadError} Retry using the file download action.</p>}
    {onSelection && selectedIds.map((id) => <p key={id}>Selected document {id} <button className="doc-btn" type="button" disabled={disabled} onClick={() => onSelection(selectedIds.filter((entry) => entry !== id))}>Remove result reference</button></p>)}
    {f.attachmentsOpen && <>
      {f.attachmentsQuery.isLoading && <p role="status">Loading attachments…</p>}
      {f.attachmentsQuery.isError && <p role="alert">Attachments could not be loaded. <button className="doc-btn" type="button" onClick={() => void f.attachmentsQuery.refetch()}>Retry attachments</button></p>}
      {!f.attachmentsQuery.isLoading && !f.attachmentsQuery.isError && !f.attachments.length && <p>No saved attachments on this page.</p>}
      {f.attachments.map((attachment) => <div className="doc-card" key={attachment.id}>
        <label className="oph-option">{onSelection && <input type="checkbox" disabled={disabled} checked={selectedIds.includes(attachment.patient_document_id)} onChange={(event) => onSelection(event.target.checked ? [...new Set([...selectedIds, attachment.patient_document_id])] : selectedIds.filter((entry) => entry !== attachment.patient_document_id))} />} {attachment.original_file_name} · {attachment.laterality} · {attachment.review_state} · {attachment.publication_state} · {new Date(attachment.acquired_at).toLocaleString()}</label>
        <p>Provenance: {attachment.provenance} · device {attachment.device_code ?? 'Not recorded'} · test {attachment.test_code} · task {attachment.task_id} · result {attachment.result_id ?? 'Not linked'} · {attachment.mime_type} · {attachment.file_size_bytes} bytes</p>
        <p className="oph-attachment-metadata">Uploader {attachment.uploaded_by} · SHA-256 {attachment.checksum_sha256}</p>
        {f.canDownload && <button className="doc-btn" type="button" disabled={f.downloading} onClick={() => void f.downloadAttachment(attachment.id)}>Download {attachment.original_file_name}</button>}
      </div>)}
      <div className="oph-toolbar"><button className="doc-btn" type="button" disabled={f.attachmentPage <= 1} onClick={() => workspace.setQuery('attachment_page', String(f.attachmentPage - 1))}>Previous attachments</button><span>Page {f.attachmentPage}</span><button className="doc-btn" type="button" disabled={f.attachmentPage >= (f.attachmentsQuery.data?.meta.totalPages ?? 0)} onClick={() => workspace.setQuery('attachment_page', String(f.attachmentPage + 1))}>Next attachments</button></div>
    </>}
    {uploadOpen && <Modal className="oph-workspace" open title={allowCamera ? 'Upload fundus image' : 'Upload ophthalmology attachment'} onClose={close} footer={<>
      <button type="button" className="doc-btn" disabled={busy} onClick={close}>Cancel</button>
      <button type="submit" form="oph-attachment-form" className="doc-btn primary" disabled={busy || !f.canAttach}>{isSubmitting ? 'Uploading…' : 'Upload internally'}</button>
    </>}>
      <form id="oph-attachment-form" onSubmit={(event) => {
        event.stopPropagation();
        void handleSubmit(async (form) => {
          if (!f.canAttach) { setError('root', { message: 'Uploading is unavailable for this task or your current permissions.' }); return; }
          if (!file?.size) { setError('root', { message: 'Choose a nonempty file or capture a real camera frame.' }); return; }
          if (allowCamera && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('root', { message: 'Choose an exported JPEG, PNG or WebP image. Direct DICOM import is not configured.' }); return; }
          const signature = JSON.stringify([f.taskId, f.result?.id ?? null, form.title, form.acquired_at]);
          if (attempt.current?.file !== file || attempt.current.signature !== signature) attempt.current = { file, signature, key: crypto.randomUUID() };
          const saved = await f.upload({ ...form, task_id: f.taskId, result_id: f.result?.id ?? null, file, key: attempt.current.key });
          if (saved) {
            if (!disabled && onSelection) onSelection([...new Set([...selectedIds, saved.patient_document_id])]);
            camera.stop(); attempt.current = null; setUploadOpen(false); setFile(null); reset();
            if (!alwaysShow) workspace.setQuery('attachments', 'open');
          }
        })(event);
      }}>
        <EditorErrors errors={errors} />
        <fieldset className="oph-fieldset" disabled={busy || !f.canAttach}>
          <label className="doc-field"><span>Title <span className="required-asterisk">*</span></span><input maxLength={250} {...register('title')} /></label>
          <label className="doc-field"><span>Acquired at <span className="required-asterisk">*</span></span><input type="datetime-local" value={localDateTime(values.acquired_at)} onChange={(event) => setValue('acquired_at', inputInstant(event.target.value) ?? '', { shouldDirty: true })} /></label>
          <label className="doc-field"><span>{allowCamera ? 'Exported image file' : 'Image / report file'} <span className="required-asterisk">*</span></span><input type="file" accept={allowCamera ? 'image/jpeg,image/png,image/webp' : undefined} onChange={(event) => { camera.stop(); setFile(event.target.files?.[0] ?? null); attempt.current = null; clearErrors('root'); }} /></label>
          {allowCamera && <section aria-label="Browser camera capture">
            <p>Only browser-accessible cameras are supported here. A browser camera is not a DICOM connection. If the fundus device is unavailable, upload its exported image instead.</p>
            <label className="doc-field">Camera<select value={camera.selectedDeviceId} onChange={(event) => camera.setSelectedDeviceId(event.target.value)}>
              <option value="">Browser default camera</option>{camera.devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera'}</option>)}
            </select></label>
            <video ref={camera.videoRef} autoPlay muted playsInline aria-label="Live camera preview" hidden={camera.status !== 'live'} style={{ width: '100%', maxHeight: 280, background: '#0f172a' }} />
            <p role="status">{camera.status === 'live' ? 'Camera connected — preview only, not uploaded.' : camera.status === 'connecting' ? 'Connecting camera…' : 'Camera not connected.'}</p>
            <div className="oph-toolbar">
              <button type="button" className="doc-btn" disabled={camera.status === 'connecting' || camera.status === 'live'} onClick={() => void camera.start()}>Connect camera</button>
              <button type="button" className="doc-btn" disabled={camera.status !== 'live'} onClick={async () => {
                setCapturing(true);
                try {
                  const captured = await camera.capture();
                  if (captured) {
                    setFile(captured); attempt.current = null; clearErrors('root');
                    setValue('acquired_at', new Date().toISOString(), { shouldDirty: true });
                    if (!values.title) setValue('title', 'Fundus image — ' + (f.task?.laterality ?? 'confirm eye'), { shouldDirty: true });
                    camera.stop();
                  }
                } finally { setCapturing(false); }
              }}>Capture image for review</button>
              <button type="button" className="doc-btn" disabled={camera.status !== 'live' && camera.status !== 'connecting'} onClick={camera.stop}>Disconnect camera</button>
            </div>
            {camera.error && <p className="form-error-banner" role="alert">{camera.error}</p>}
          </section>}
          {file && <div><p role="status">Selected: {file.name} — not uploaded yet. Review the image and confirm the patient and eye before Upload internally.</p><SelectedImagePreview file={file} /></div>}
        </fieldset>
        {f.error && <p className="form-error-banner" role="alert">{f.error} The same upload can be retried without creating a duplicate.</p>}
      </form>
    </Modal>}
  </section>;
}
