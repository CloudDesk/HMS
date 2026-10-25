import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFundusCameraCapture, type FundusCameraCapture } from './useFundusCameraCapture';

describe('real browser fundus capture', () => {
  let root: Root;
  let element: HTMLDivElement;
  let feature: FundusCameraCapture;
  let enabled: boolean;
  let mounted: boolean;
  const getUserMedia = vi.fn();
  const enumerateDevices = vi.fn();
  const drawImage = vi.fn();
  const stopTrack = vi.fn();
  const getContextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
  let track: EventTarget;
  let stream: { active: boolean; getTracks: () => { stop: typeof stopTrack }[]; getVideoTracks: () => EventTarget[] };
  let encoded: Blob | null;
  function Harness() {
    feature = useFundusCameraCapture(enabled);
    return <video ref={feature.videoRef} muted playsInline />;
  }
  const render = () => act(async () => { root.render(<Harness />); });
  const readyFrame = () => {
    const video = element.querySelector('video');
    if (!video) throw new Error('Missing video element');
    Object.defineProperties(video, { videoWidth: { configurable: true, value: 640 }, videoHeight: { configurable: true, value: 480 }, readyState: { configurable: true, value: HTMLMediaElement.HAVE_CURRENT_DATA } });
    return video;
  };
  beforeEach(() => {
    enabled = true;
    mounted = true;
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    getUserMedia.mockReset(); enumerateDevices.mockReset(); drawImage.mockReset(); stopTrack.mockReset();
    track = new EventTarget();
    stream = { active: true, getTracks: () => [{ stop: stopTrack }], getVideoTracks: () => [track] };
    encoded = new Blob(['real-frame-jpeg'], { type: 'image/jpeg' });
    getUserMedia.mockResolvedValue(stream);
    enumerateDevices.mockResolvedValue([{ kind: 'videoinput', deviceId: 'camera-1', label: 'USB Camera' }, { kind: 'audioinput', deviceId: 'microphone', label: 'Microphone' }]);
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia, enumerateDevices } });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(encoded));
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: vi.fn(() => ({ drawImage })) });
    element = document.createElement('div'); document.body.append(element); root = createRoot(element);
  });
  afterEach(async () => { if (mounted) await act(async () => root.unmount()); element.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); if (getContextDescriptor) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', getContextDescriptor); });

  it('does not access cameras automatically or when disabled', async () => {
    await render(); expect(getUserMedia).not.toHaveBeenCalled(); expect(enumerateDevices).not.toHaveBeenCalled();
    enabled = false; await render(); await act(async () => feature.start());
    expect(getUserMedia).not.toHaveBeenCalled(); expect(await feature.capture()).toBeUndefined();
  });
  it('connects only video, lists actual cameras and encodes the actual preview frame', async () => {
    await render(); await act(async () => feature.start());
    expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: true });
    expect(feature.status).toBe('live'); expect(feature.devices).toEqual([{ deviceId: 'camera-1', label: 'USB Camera' }]);
    const video = readyFrame();
    let file: File | undefined;
    await act(async () => { file = await feature.capture(); });
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 480);
    expect(file).toBeInstanceOf(File); expect(file?.type).toBe('image/jpeg'); expect(file?.size).toBe(encoded?.size);
    expect(feature.error).toBeNull();
  });
  it('does not synthesize an image when a frame is not ready or encoding is empty', async () => {
    await render(); await act(async () => feature.start());
    await act(async () => { expect(await feature.capture()).toBeUndefined(); });
    expect(drawImage).not.toHaveBeenCalled(); expect(feature.error).toContain('No camera frame');
    readyFrame(); encoded = null;
    await act(async () => { expect(await feature.capture()).toBeUndefined(); });
    expect(feature.error).toContain('could not be captured');
    encoded = new Blob([], { type: 'image/jpeg' });
    await act(async () => { expect(await feature.capture()).toBeUndefined(); });
  });
  it('shows permission denial without claiming a live connection', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    await render(); await act(async () => feature.start());
    expect(feature.status).toBe('error'); expect(feature.error).toContain('Camera access was denied');
    expect(enumerateDevices).not.toHaveBeenCalled(); expect(await feature.capture()).toBeUndefined();
  });
  it('requires a secure context and handles a missing camera', async () => {
    vi.stubGlobal('isSecureContext', false); await render(); await act(async () => feature.start());
    expect(getUserMedia).not.toHaveBeenCalled(); expect(feature.error).toContain('HTTPS');
    vi.stubGlobal('isSecureContext', true); getUserMedia.mockRejectedValue(new DOMException('Missing', 'NotFoundError'));
    await act(async () => feature.start()); expect(feature.error).toContain('No browser-compatible camera');
  });
  it('stops a stream on explicit disconnect and on permission loss', async () => {
    await render(); await act(async () => feature.start());
    await act(async () => feature.stop()); expect(stopTrack).toHaveBeenCalledOnce(); expect(feature.status).toBe('idle');
    expect(element.querySelector('video')?.srcObject).toBeNull();
    await act(async () => feature.start()); enabled = false; await render();
    expect(stopTrack).toHaveBeenCalledTimes(2); expect(feature.status).toBe('idle');
    expect(await feature.capture()).toBeUndefined();
  });
  it('discards a late permission response after disconnect without duplicate requests', async () => {
    let resolve: ((value: typeof stream) => void) | undefined;
    getUserMedia.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await render(); let connecting: Promise<void> | undefined;
    await act(async () => { connecting = feature.start(); });
    await act(async () => feature.start()); expect(getUserMedia).toHaveBeenCalledOnce();
    await act(async () => feature.stop());
    await act(async () => { resolve?.(stream); await connecting; });
    expect(stopTrack).toHaveBeenCalledOnce(); expect(feature.status).toBe('idle'); expect(enumerateDevices).not.toHaveBeenCalled();
  });
  it('stops a late stream after unmount and never attaches it to the preview', async () => {
    let resolve: ((value: typeof stream) => void) | undefined;
    getUserMedia.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await render(); let connecting: Promise<void> | undefined;
    await act(async () => { connecting = feature.start(); });
    await act(async () => root.unmount()); mounted = false;
    await act(async () => { resolve?.(stream); await connecting; });
    expect(stopTrack).toHaveBeenCalledOnce(); expect(enumerateDevices).not.toHaveBeenCalled();
  });
  it('requires explicit reconnection after changing the selected device', async () => {
    await render(); await act(async () => feature.start());
    await act(async () => feature.setSelectedDeviceId('camera-1'));
    expect(stopTrack).toHaveBeenCalledOnce(); expect(feature.status).toBe('idle'); expect(getUserMedia).toHaveBeenCalledOnce();
    await act(async () => feature.start());
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: false, video: { deviceId: { exact: 'camera-1' } } });
    await act(async () => { track.dispatchEvent(new Event('ended')); });
    expect(feature.status).toBe('error'); expect(feature.error).toContain('disconnected');
  });
  it('does not release a captured file after its camera context changes', async () => {
    let finish: BlobCallback | undefined;
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((done) => { finish = done; });
    await render(); await act(async () => feature.start()); readyFrame();
    let capturing: Promise<File | undefined> | undefined;
    await act(async () => { capturing = feature.capture(); });
    await act(async () => feature.stop());
    await act(async () => { finish?.(encoded); expect(await capturing).toBeUndefined(); });
  });
});
