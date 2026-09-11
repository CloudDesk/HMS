import React, { useEffect, useId, useRef, useState } from 'react';
import type { ToothSurface } from '../../../api/opd';
import { getDentition, isAnteriorTooth, isUpperArch, TOOTH_SURFACES } from '../../../pages/dental-utils';
import { createToothRenderer, parseAnatomicalToothObj, type ToothRenderer } from './tooth-3d';
import styles from './DentalExamination.module.css';

interface ToothSurfaceSelectorProps {
  surfaces: ToothSurface[];
  onChange: (surfaces: ToothSurface[]) => void;
  disabled?: boolean;
  toothNumber?: number | null;
}

const SURFACE_COLORS: Record<ToothSurface, { solid: string; tint: string; border: string; text: string }> = {
  OCCLUSAL: { solid: '#0ea5e9', tint: '#f0f9ff', border: '#7dd3fc', text: '#0369a1' },
  MESIAL: { solid: '#3b82f6', tint: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
  DISTAL: { solid: '#1d4ed8', tint: '#eef2ff', border: '#a5b4fc', text: '#1e3a8a' },
  BUCCAL: { solid: '#14b8a6', tint: '#f0fdfa', border: '#5eead4', text: '#0f766e' },
  LINGUAL: { solid: '#8b5cf6', tint: '#f5f3ff', border: '#c4b5fd', text: '#6d28d9' },
};

export const ToothSurfaceSelector: React.FC<ToothSurfaceSelectorProps> = ({
  surfaces, onChange, disabled = false, toothNumber = null,
}) => {
  const isAnterior = toothNumber ? isAnteriorTooth(toothNumber) : false;
  const isUpper = toothNumber ? isUpperArch(toothNumber) : false;
  const position = toothNumber ? toothNumber % 10 : 6;
  const primary = toothNumber ? getDentition(toothNumber) === 'PRIMARY' : false;
  const modelIndex = position <= 2 ? 0 : position === 3 ? 1 : !primary && position <= 5 ? 2 : 3;
  const toothType = ['Incisor', 'Canine', 'Premolar', 'Molar'][modelIndex];
  const helpId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ToothRenderer | null>(null);
  const selectionRef = useRef(surfaces);
  const pointerRef = useRef<{ id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
  const [available, setAvailable] = useState(true);
  const [modelLoading, setModelLoading] = useState(false);
  const [identifiedSurface, setIdentifiedSurface] = useState<ToothSurface | null>(null);
  const [surfaceAnchor, setSurfaceAnchor] = useState<{ x: number; y: number } | null>(null);
  const [contextVersion, setContextVersion] = useState(0);
  const arrowId = `${helpId.replace(/:/g, '')}-surface-arrow`;
  const surfaceOverlays = surfaces.map((surface) => ({
    surface,
    anchor: surface === identifiedSurface && surfaceAnchor
      ? surfaceAnchor
      : rendererRef.current?.locate(surface) ?? null,
  })).filter((overlay): overlay is { surface: ToothSurface; anchor: { x: number; y: number } } => Boolean(overlay.anchor));

  const updateSurfaceAnchor = (surface = identifiedSurface) => {
    if (surface) setSurfaceAnchor(rendererRef.current?.locate(surface) ?? null);
  };

  useEffect(() => {
    selectionRef.current = surfaces;
    rendererRef.current?.setSurfaces(surfaces);
  }, [surfaces]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: ToothRenderer | null = null;
    let disposed = false;
    let observer: ResizeObserver | null = null;
    const resize = () => renderer?.resize();
    const initialize = async () => {
      setModelLoading(true);
      try {
        let anatomicalMesh;
        if (toothNumber) {
          const arch = isUpper ? 'upper' : 'lower';
          // Primary positions 4 and 5 are molars, so they must not use the
          // permanent premolar assets at the same numeric positions.
          const primaryAssetPositions = [1, 2, 3, 6, 7] as const;
          // Position 8 uses the second-molar representative because the source
          // collection has no separate third-molar mesh.
          const anatomicalPosition = primary
            ? primaryAssetPositions[position - 1]
            : Math.min(position, 7);
          if (!anatomicalPosition) throw new Error('Unsupported tooth position.');
          const response = await fetch(`/models/dental/${arch}-${anatomicalPosition}.obj`);
          if (!response.ok) throw new Error('Unable to load anatomical tooth model.');
          anatomicalMesh = parseAnatomicalToothObj(await response.text(), toothNumber ?? 11);
        }
        if (!disposed && typeof window.WebGLRenderingContext !== 'undefined') {
          renderer = createToothRenderer(canvas, toothNumber ?? 16, anatomicalMesh);
        }
      } catch {
        // Fall back to the built-in model if the anatomical asset is unavailable.
        if (!disposed && typeof window.WebGLRenderingContext !== 'undefined') {
          renderer = createToothRenderer(canvas, toothNumber ?? 16);
        }
      }
      if (disposed) {
        renderer?.dispose();
        return;
      }
      rendererRef.current = renderer;
      setAvailable(Boolean(renderer));
      setModelLoading(false);
      renderer?.setSurfaces(selectionRef.current);
      const recordedSurface = selectionRef.current[0];
      if (recordedSurface && renderer) {
        setIdentifiedSurface(recordedSurface);
        setSurfaceAnchor(renderer.locate(recordedSurface));
      }
      observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
      observer?.observe(canvas);
    };
    void initialize();
    window.addEventListener('resize', resize);
    const onLost = (event: Event) => {
      event.preventDefault();
      rendererRef.current = null;
      setAvailable(false);
    };
    const onRestored = () => setContextVersion((version) => version + 1);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      rendererRef.current = null;
      renderer?.dispose();
    };
  }, [toothNumber, contextVersion, isUpper, position, primary]);

  const toggleSurface = (surface: ToothSurface) => {
    if (disabled) return;
    onChange(surfaces.includes(surface)
      ? surfaces.filter((value) => value !== surface)
      : [...surfaces, surface]);
  };

  const getLabel = (surface: ToothSurface): [string, string] => {
    switch (surface) {
      case 'OCCLUSAL': return isAnterior ? ['I', 'Incisal'] : ['O', 'Occlusal'];
      case 'BUCCAL': return isAnterior ? ['La', 'Labial / Facial'] : ['B', 'Buccal'];
      case 'LINGUAL': return isUpper ? ['P', 'Palatal'] : ['L', 'Lingual'];
      case 'MESIAL': return ['M', 'Mesial'];
      case 'DISTAL': return ['D', 'Distal'];
    }
  };

  return (
    <div className={styles.surfaceSelectorBox}>
      <div className={styles.surfacePreviewHeader}>
        <span>{toothNumber ? `Tooth ${toothNumber}` : 'Tooth surfaces'}</span>
        <span>{toothType}</span>
      </div>
      <div className={styles.surfaceModelStage}>
        <canvas
          ref={canvasRef}
          className={styles.surfaceModelCanvas}
          tabIndex={available ? 0 : -1}
          role="img"
          aria-label={`Interactive 3D ${toothType?.toLowerCase()}. Move the mouse left or right, drag, or use arrow keys to rotate. Use the labelled buttons below to select surfaces.`}
          aria-describedby={helpId}
          onWheel={(event) => {
            if (!available) return;
            event.preventDefault();
            rendererRef.current?.zoom(event.deltaY < 0 ? 0.08 : -0.08);
            updateSurfaceAnchor();
          }}
          onPointerDown={(event) => {
            if (!available || event.button !== 0 || pointerRef.current) return;
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
          }}
          onPointerMove={(event) => {
            const pointer = pointerRef.current;
            if (!pointer || pointer.id !== event.pointerId) {
              if (event.pointerType === 'mouse' && event.buttons === 0) {
                const rect = event.currentTarget.getBoundingClientRect();
                const progress = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
                rendererRef.current?.previewTurn(progress);
                updateSurfaceAnchor();
              }
              return;
            }
            if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 5) pointer.moved = true;
            if (pointer.moved) {
              rendererRef.current?.rotate((event.clientX - pointer.x) * 0.012, (event.clientY - pointer.y) * 0.012);
              updateSurfaceAnchor();
            }
            pointer.x = event.clientX;
            pointer.y = event.clientY;
          }}
          onPointerUp={(event) => {
            const pointer = pointerRef.current;
            if (!pointer || pointer.id !== event.pointerId) return;
            pointerRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
            if (!pointer.moved) {
              const surface = rendererRef.current?.pick(event.clientX, event.clientY);
              if (surface && (!disabled || surfaces.includes(surface))) {
                setIdentifiedSurface(surface);
                const rect = event.currentTarget.getBoundingClientRect();
                setSurfaceAnchor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
                if (!disabled) toggleSurface(surface);
              }
            }
          }}
          onPointerCancel={() => { pointerRef.current = null; }}
          onLostPointerCapture={() => { pointerRef.current = null; }}
          onKeyDown={(event) => {
            const directions: Record<string, [number, number]> = {
              ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, 0.15], ArrowDown: [0, -0.15],
            };
            const direction = directions[event.key];
            if (direction) {
              event.preventDefault();
              rendererRef.current?.rotate(...direction);
              updateSurfaceAnchor();
            }
          }}
        />
        {modelLoading && <span className={styles.surfaceModelFallback} role="status">Loading anatomical tooth…</span>}
        {!modelLoading && !available && <span className={styles.surfaceModelFallback} role="status">3D view unavailable. Use the surface controls below.</span>}
        {!modelLoading && available && surfaceOverlays.map(({ surface }, index) => {
          const [short, label] = getLabel(surface);
          const color = SURFACE_COLORS[surface];
          return <button
            key={surface}
            type="button"
            className={styles.surfaceModelLabel}
            style={{ top: `${8 + index * 36}px`, borderColor: color.border, color: color.text }}
            aria-label={`Show ${label} surface`}
            onClick={() => {
              setIdentifiedSurface(surface);
              rendererRef.current?.face(surface);
              setSurfaceAnchor(rendererRef.current?.locate(surface) ?? null);
            }}
          ><strong style={{ backgroundColor: color.solid }}>{short}</strong>{label}</button>;
        })}
        {!modelLoading && available && surfaceOverlays.length > 0 && <svg className={styles.surfaceModelArrow} aria-hidden="true">
          <defs>{surfaceOverlays.map(({ surface }) => <marker key={surface} id={`${arrowId}-${surface.toLowerCase()}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" style={{ fill: SURFACE_COLORS[surface].solid }} /></marker>)}</defs>
          {surfaceOverlays.map(({ surface, anchor }, index) => {
            const startY = 27 + index * 36;
            const startX = 120;
            return <path key={surface} d={`M ${startX} ${startY} Q ${(startX + anchor.x) / 2} ${Math.max(startY + 10, anchor.y - 22)} ${anchor.x} ${anchor.y}`} markerEnd={`url(#${arrowId}-${surface.toLowerCase()})`} style={{ stroke: SURFACE_COLORS[surface].solid }} />;
          })}
        </svg>}
        {!modelLoading && available && <div className={styles.surfaceViewControls} role="group" aria-label="Tooth view">
          <button type="button" onClick={() => { rendererRef.current?.rotate(-Math.PI / 4, 0); updateSurfaceAnchor(); }} aria-label="Rotate tooth left">↶</button>
          <button type="button" onClick={() => { rendererRef.current?.zoom(-0.12); updateSurfaceAnchor(); }} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => { rendererRef.current?.face(null); updateSurfaceAnchor(); }}>Reset view</button>
          <button type="button" onClick={() => { rendererRef.current?.zoom(0.12); updateSurfaceAnchor(); }} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => { rendererRef.current?.rotate(Math.PI / 4, 0); updateSurfaceAnchor(); }} aria-label="Rotate tooth right">↷</button>
        </div>}
      </div>
      <p className={styles.surfaceSelectionHint} id={helpId}>Move across the viewer for a 360° turn · Drag for full control · Scroll to zoom · Coloured enamel areas are selected.</p>
      <div className={styles.surfaceSelectionHeader}>
        <span>{disabled ? 'Recorded surfaces' : 'Select affected surfaces'}</span>
        <span aria-live="polite">{surfaces.length} / 5 selected</span>
      </div>
      <div className={styles.surfaceButtonsRow} role="group" aria-label="Affected tooth surfaces">
        {TOOTH_SURFACES.map((surface) => {
          const active = surfaces.includes(surface.value);
          const [short, label] = getLabel(surface.value);
          const color = SURFACE_COLORS[surface.value];
          return (
            <button
              key={surface.value}
              type="button"
              disabled={disabled}
              aria-label={`${short} — ${label}`}
              aria-pressed={active}
              data-testid={`surface-${surface.value.toLowerCase()}`}
              className={`${styles.surfaceBtn} ${active ? styles.surfaceBtnActive : ''}`}
              style={active ? { backgroundColor: color.tint, borderColor: color.border, color: color.text } : undefined}
              onClick={() => {
                setIdentifiedSurface(surface.value);
                rendererRef.current?.face(surface.value);
                setSurfaceAnchor(rendererRef.current?.locate(surface.value) ?? null);
                toggleSurface(surface.value);
              }}
              title={`${label}: ${surface.desc}`}
            >
              <span className={styles.surfaceCode} style={active ? { backgroundColor: color.solid } : undefined} aria-hidden="true">{short}</span>
              <span className={styles.surfaceButtonCopy}><span>{label}</span><small>{surface.desc}</small></span>
              <span className={styles.surfaceCheck} style={active ? { backgroundColor: color.solid, borderColor: color.solid } : undefined} aria-hidden="true">{active ? '✓' : '+'}</span>
            </button>
          );
        })}
      </div>
      <p className={styles.surfaceSelectionHint}>
        {disabled ? 'This examination is read-only.' : 'Choose one or more surfaces. Select again to remove.'}
      </p>
    </div>
  );
};
