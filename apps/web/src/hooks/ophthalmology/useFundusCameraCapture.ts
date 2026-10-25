import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

type CameraStatus = 'idle' | 'connecting' | 'live' | 'error';
type CameraDevice = Pick<MediaDeviceInfo, 'deviceId' | 'label'>;
export type FundusCameraCapture = {
  videoRef: RefObject<HTMLVideoElement | null>;
  devices: CameraDevice[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  status: CameraStatus;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  capture: () => Promise<File | undefined>;
};

function cameraError(cause: unknown) {
  const name = typeof cause === 'object' && cause !== null && 'name' in cause && typeof cause.name === 'string' ? cause.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was denied. Allow camera access in your browser, or upload an image exported from the instrument.';
  if (name === 'NotFoundError') return 'No browser-compatible camera was found. Connect a camera or upload an image exported from the instrument.';
  if (name === 'NotReadableError') return 'The camera is unavailable or in use by another application. Close that application and reconnect.';
  if (name === 'OverconstrainedError') return 'The selected camera is no longer available. Select another camera and reconnect.';
  return 'The camera could not be started. Reconnect it or upload an image exported from the instrument.';
}

export function useFundusCameraCapture(enabled: boolean): FundusCameraCapture {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, selectDevice] = useState('');
  const lifecycle = useMemo(() => ({ active: true, generation: 0, pending: false, stream: null as MediaStream | null, detach: () => {} }), [enabled]);
  const [state, setState] = useState<{ lifecycle: typeof lifecycle; status: CameraStatus; error: string | null }>(() => ({ lifecycle, status: 'idle', error: null }));

  const release = () => {
    lifecycle.generation += 1;
    lifecycle.pending = false;
    lifecycle.detach();
    lifecycle.stream?.getTracks().forEach((track) => track.stop());
    lifecycle.stream = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };
  useLayoutEffect(() => {
    lifecycle.active = true;
    const video = videoRef.current;
    return () => {
      lifecycle.active = false;
      lifecycle.generation += 1;
      lifecycle.detach();
      lifecycle.stream?.getTracks().forEach((track) => track.stop());
      lifecycle.stream = null;
      if (video) video.srcObject = null;
    };
  }, [lifecycle]);

  const status = enabled && state.lifecycle === lifecycle ? state.status : 'idle';
  return {
    videoRef, devices: enabled ? devices : [], selectedDeviceId,
    status, error: enabled && state.lifecycle === lifecycle ? state.error : null,
    stop: () => { release(); if (lifecycle.active) setState({ lifecycle, status: 'idle', error: null }); },
    setSelectedDeviceId: (id) => {
      if (id && !devices.some((device) => device.deviceId === id)) return;
      release();
      selectDevice(id);
      if (lifecycle.active) setState({ lifecycle, status: 'idle', error: null });
    },
    start: async () => {
      if (!enabled || !lifecycle.active || lifecycle.pending) return;
      release();
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setState({ lifecycle, status: 'error', error: 'Camera access requires HTTPS (or localhost) and a browser with camera support. You can upload an image exported from the instrument instead.' });
        return;
      }
      const generation = lifecycle.generation;
      lifecycle.pending = true;
      setState({ lifecycle, status: 'connecting', error: null });
      let stream: MediaStream | undefined;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true });
        if (!lifecycle.active || generation !== lifecycle.generation) { stream.getTracks().forEach((track) => track.stop()); return; }
        lifecycle.stream = stream;
        const video = videoRef.current;
        if (!video) throw new Error('Camera preview unavailable');
        video.srcObject = stream;
        await video.play();
        if (!lifecycle.active || generation !== lifecycle.generation) return;
        const cameras = await navigator.mediaDevices.enumerateDevices();
        if (!lifecycle.active || generation !== lifecycle.generation) return;
        if (!stream.active || !stream.getVideoTracks().length) throw new Error('Camera stream ended');
        setDevices(cameras.filter((device) => device.kind === 'videoinput').map(({ deviceId, label }, index) => ({ deviceId, label: label || `Camera ${index + 1}` })));
        const disconnected = () => {
          if (!lifecycle.active || generation !== lifecycle.generation) return;
          release();
          setState({ lifecycle, status: 'error', error: 'The camera was disconnected. Reconnect it before capturing another image.' });
        };
        stream.getVideoTracks().forEach((track) => track.addEventListener('ended', disconnected));
        const tracks = stream.getVideoTracks();
        lifecycle.detach = () => tracks.forEach((track) => track.removeEventListener('ended', disconnected));
        lifecycle.pending = false;
        setState({ lifecycle, status: 'live', error: null });
      } catch (cause) {
        stream?.getTracks().forEach((track) => track.stop());
        if (!lifecycle.active || generation !== lifecycle.generation) return;
        release();
        setState({ lifecycle, status: 'error', error: cameraError(cause) });
      }
    },
    capture: async () => {
      if (!enabled || !lifecycle.active || status !== 'live' || !lifecycle.stream) return undefined;
      const video = videoRef.current;
      const generation = lifecycle.generation;
      if (!video || !lifecycle.stream?.active || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth <= 0 || video.videoHeight <= 0) {
        setState({ lifecycle, status, error: 'No camera frame is ready. Wait for the live preview, then capture again.' });
        return undefined;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
        if (!lifecycle.active || generation !== lifecycle.generation) return undefined;
        if (!blob?.size || blob.type !== 'image/jpeg') throw new Error('Capture encoding failed');
        setState({ lifecycle, status: 'live', error: null });
        return new File([blob], `fundus-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      } catch {
        if (lifecycle.active && generation === lifecycle.generation) setState({ lifecycle, status: 'live', error: 'The image could not be captured. Try again or upload an image exported from the instrument.' });
        return undefined;
      }
    },
  };
}
