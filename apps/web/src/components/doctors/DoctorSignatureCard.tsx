import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useUpdateDoctor } from '../../hooks/doctors/useDoctors';

interface DoctorSignatureCardProps {
  doctorId: string;
  signatureData?: string | null;
  canEdit: boolean;
}

export function DoctorSignatureCard({ doctorId, signatureData, canEdit }: DoctorSignatureCardProps) {
  const [isEditing, setIsEditing] = useState(!signatureData);
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateDoctorMutation = useUpdateDoctor();
  const isSaving = updateDoctorMutation.isPending;

  // Clear canvas helper
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  // Initialize or reset canvas
  useEffect(() => {
    if (isEditing && mode === 'draw' && canvasRef.current) {
      clearCanvas();
    }
  }, [isEditing, mode, clearCanvas]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canEdit || isSaving) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const coords = getCanvasCoords(e);
    lastPointRef.current = coords;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPointRef.current = coords;
    setHasDrawn(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, or WEBP).');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error('Signature file must be under 3 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedPreview(reader.result);
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read signature image.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSignature = async () => {
    let finalSignatureData: string | null = null;

    if (mode === 'draw') {
      if (!hasDrawn || !canvasRef.current) {
        toast.error('Please draw a signature before saving.');
        return;
      }
      finalSignatureData = canvasRef.current.toDataURL('image/png');
    } else {
      if (!uploadedPreview) {
        toast.error('Please select an image file to upload.');
        return;
      }
      finalSignatureData = uploadedPreview;
    }

    try {
      await updateDoctorMutation.mutateAsync({
        id: doctorId,
        payload: { signature_data: finalSignatureData },
      });
      toast.success('Clinical signature saved successfully.');
      setIsEditing(false);
      setUploadedPreview(null);
      setHasDrawn(false);
    } catch {
      // Error handled by mutation onError
    }
  };

  const handleRemoveSignature = async () => {
    if (!window.confirm('Are you sure you want to remove your stored signature? Automatic signing on patient consent forms will be disabled until a new signature is provided.')) {
      return;
    }

    try {
      await updateDoctorMutation.mutateAsync({
        id: doctorId,
        payload: { signature_data: null },
      });
      toast.success('Clinical signature removed.');
      setIsEditing(true);
      setUploadedPreview(null);
      clearCanvas();
    } catch {
      // Error handled by mutation onError
    }
  };

  return (
    <section className="doc-card doctor-signature-section" style={{ marginTop: '1rem' }}>
      <div className="doc-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="ph ph-pen-nib" aria-hidden="true" style={{ color: '#2563eb' }} />
            Clinical Digital Signature
          </h3>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Pre-registered signature automatically populated on patient consent forms and clinical authorisations.
          </p>
        </div>

        {signatureData && !isEditing && canEdit && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="doc-btn"
              onClick={() => {
                setIsEditing(true);
                setMode('draw');
                setUploadedPreview(null);
              }}
            >
              <i className="ph ph-pencil-simple" aria-hidden="true" />
              Update Signature
            </button>
            <button
              type="button"
              className="doc-btn danger-outline"
              onClick={handleRemoveSignature}
              disabled={isSaving}
            >
              <i className="ph ph-trash" aria-hidden="true" />
              Remove
            </button>
          </div>
        )}
      </div>

      {signatureData && !isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '140px',
            }}
          >
            <img
              src={signatureData}
              alt="Doctor Digital Signature"
              style={{
                maxHeight: '110px',
                maxWidth: '100%',
                objectFit: 'contain',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#16a34a', fontSize: '0.85rem' }}>
            <i className="ph ph-check-circle" style={{ fontSize: '1.1rem' }} aria-hidden="true" />
            <span>Active & ready: Automatically attached whenever patient consent forms are assigned or signed.</span>
          </div>
        </div>
      ) : canEdit ? (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Mode Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
            <button
              type="button"
              className={`doc-btn ${mode === 'draw' ? 'primary' : ''}`}
              onClick={() => {
                setMode('draw');
                setUploadedPreview(null);
              }}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
            >
              <i className="ph ph-pen" aria-hidden="true" /> Draw Signature
            </button>
            <button
              type="button"
              className={`doc-btn ${mode === 'upload' ? 'primary' : ''}`}
              onClick={() => {
                setMode('upload');
                clearCanvas();
              }}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
            >
              <i className="ph ph-upload-simple" aria-hidden="true" /> Upload Image
            </button>
          </div>

          {mode === 'draw' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.825rem', color: '#64748b' }}>
                  Use your mouse, stylus, or touch screen to draw your signature inside the box below:
                </span>
                <button
                  type="button"
                  className="doc-btn"
                  onClick={clearCanvas}
                  style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}
                >
                  <i className="ph ph-arrow-counter-clockwise" aria-hidden="true" /> Clear
                </button>
              </div>
              <div
                style={{
                  background: '#ffffff',
                  border: '1.5px dashed #94a3b8',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '4px',
                  cursor: 'crosshair',
                  touchAction: 'none',
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={150}
                  style={{
                    width: '100%',
                    maxWidth: '520px',
                    height: '150px',
                    touchAction: 'none',
                    display: 'block',
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                />
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.825rem', color: '#64748b' }}>
                  Upload a scanned or photographed signature (PNG, JPG, WEBP, or SVG, max 3MB):
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <div
                style={{
                  background: '#f8fafc',
                  border: '1.5px dashed #94a3b8',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadedPreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <img
                      src={uploadedPreview}
                      alt="Uploaded Signature Preview"
                      style={{ maxHeight: '110px', maxWidth: '100%', objectFit: 'contain' }}
                    />
                    <button
                      type="button"
                      className="doc-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      style={{ fontSize: '0.8rem' }}
                    >
                      Choose Different Image
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                    <i className="ph ph-cloud-arrow-up" style={{ fontSize: '2rem', color: '#3b82f6' }} aria-hidden="true" />
                    <p style={{ margin: 0, fontWeight: 500, color: '#1e293b' }}>Click to browse signature image</p>
                    <span style={{ fontSize: '0.78rem' }}>PNG with transparent background recommended</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            {signatureData && (
              <button
                type="button"
                className="doc-btn"
                onClick={() => {
                  setIsEditing(false);
                  setUploadedPreview(null);
                  clearCanvas();
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              className="doc-btn primary"
              onClick={handleSaveSignature}
              disabled={isSaving || (mode === 'draw' ? !hasDrawn : !uploadedPreview)}
            >
              <i className="ph ph-floppy-disk" aria-hidden="true" />
              {isSaving ? 'Saving Signature...' : 'Save Signature'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.875rem' }}>
          <em>No signature on file. Please contact your system administrator to configure clinical digital signing.</em>
        </div>
      )}
    </section>
  );
}
