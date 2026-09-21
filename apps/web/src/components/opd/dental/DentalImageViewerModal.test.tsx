import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImagingAttachment } from '../../../api/imaging';
import { DentalImageViewerModal, isBrowserViewableImage } from './DentalImageViewerModal';

let root: Root;
let container: HTMLDivElement;

const sampleImageAttachment: ImagingAttachment = {
  id: 'att-1',
  file_name: 'iopa_tooth_16.jpg',
  file_size_bytes: 524288,
  mime_type: 'image/jpeg',
  storage_key: 'patients/p1/iopa_tooth_16.jpg',
  file_url: null,
  uploaded_at: '2026-09-18T10:00:00Z',
  uploaded_by: 'user-doc-1',
};

const samplePngAttachment: ImagingAttachment = {
  id: 'att-2',
  file_name: 'cbct_slice_16.png',
  file_size_bytes: 2097152,
  mime_type: 'image/png',
  storage_key: 'patients/p1/cbct_slice_16.png',
  file_url: null,
  uploaded_at: '2026-09-18T10:05:00Z',
  uploaded_by: 'user-doc-1',
};

const samplePdfAttachment: ImagingAttachment = {
  id: 'att-3',
  file_name: 'radiology_scan_summary.pdf',
  file_size_bytes: 1048576,
  mime_type: 'application/pdf',
  storage_key: 'patients/p1/radiology_scan_summary.pdf',
  file_url: null,
  uploaded_at: '2026-09-18T10:10:00Z',
  uploaded_by: 'user-doc-1',
};

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

describe('Phase 4B: Dental Image Viewer Component Tests', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('1. Viewer helper isBrowserViewableImage detects viewable formats', () => {
    expect(isBrowserViewableImage('image/jpeg', 'test.jpg')).toBe(true);
    expect(isBrowserViewableImage('image/png', 'test.png')).toBe(true);
    expect(isBrowserViewableImage('image/webp', 'test.webp')).toBe(true);
    expect(isBrowserViewableImage('application/pdf', 'report.pdf')).toBe(false);
    expect(isBrowserViewableImage('application/dicom', 'study.dcm')).toBe(false);
    expect(isBrowserViewableImage(null, 'picture.PNG')).toBe(true);
  });

  it('2. Viewer opens when an image attachment is selected and displays file name and context', async () => {
    await act(async () => {
      root.render(
        <DentalImageViewerModal
          open={true}
          onClose={vi.fn()}
          attachment={sampleImageAttachment}
          orderId="order-99"
          investigationName="Intraoral Periapical Radiograph"
          toothNumber={16}
        />
      );
    });
    await settle();

    const title = document.getElementById('dental-image-viewer-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe('iopa_tooth_16.jpg');

    expect(document.body.textContent).toContain('Intraoral Periapical Radiograph');
    expect(document.body.textContent).toContain('Tooth #16');
    expect(document.body.textContent).toContain('512.0 KB');

    const img = document.querySelector<HTMLImageElement>('img[data-testid="dental-viewer-image"]');
    expect(img).not.toBeNull();
    expect(img?.src).toContain('/api/imaging/orders/order-99/attachments/att-1/download');
  });

  it('preserves a downloaded browser blob URL for protected patient-document previews', async () => {
    const blobUrl = 'blob:http://localhost/protected-study-image';
    await act(async () => {
      root.render(
        <DentalImageViewerModal
          open={true}
          onClose={vi.fn()}
          attachment={samplePngAttachment}
          directDownloadUrl={blobUrl}
          investigationName="Dental IOPA X-Ray"
        />
      );
    });
    await settle();

    const image = document.querySelector<HTMLImageElement>('img[data-testid="dental-viewer-image"]');
    expect(image?.getAttribute('src')).toBe(blobUrl);
    expect(document.querySelector<HTMLAnchorElement>('a[data-testid="toolbar-download-btn"]')?.getAttribute('href')).toBe(blobUrl);
  });

  it('3. Zoom controls work (Zoom In and Zoom Out update level and scale)', async () => {
    await act(async () => {
      root.render(
        <DentalImageViewerModal
          open={true}
          onClose={vi.fn()}
          attachment={sampleImageAttachment}
          orderId="order-99"
        />
      );
    });
    await settle();

    expect(document.body.textContent).toContain('100%');

    const zoomInBtn = document.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]');
    expect(zoomInBtn).not.toBeNull();

    await act(async () => {
      zoomInBtn?.click();
    });
    await settle();
    expect(document.body.textContent).toContain('125%');

    const canvas = document.querySelector<HTMLDivElement>('div[data-testid="dental-image-canvas"]');
    expect(canvas?.style.transform).toBe('scale(1.25)');

    const zoomOutBtn = document.querySelector<HTMLButtonElement>('button[aria-label="Zoom out"]');
    await act(async () => {
      zoomOutBtn?.click();
    });
    await settle();
    expect(document.body.textContent).toContain('100%');
    expect(canvas?.style.transform).toBe('scale(1)');
  });

  it('4. Reset and Fit-to-view controls restore default scale', async () => {
    await act(async () => {
      root.render(
        <DentalImageViewerModal
          open={true}
          onClose={vi.fn()}
          attachment={sampleImageAttachment}
          orderId="order-99"
        />
      );
    });
    await settle();

    const zoomInBtn = document.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]');
    await act(async () => {
      zoomInBtn?.click();
      zoomInBtn?.click();
    });
    await settle();
    expect(document.body.textContent).toContain('150%');

    const resetBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('1:1 Reset')
    );
    expect(resetBtn).not.toBeNull();

    await act(async () => {
      resetBtn?.click();
    });
    await settle();
    expect(document.body.textContent).toContain('100%');

    const fitBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Fit to View')
    );
    await act(async () => {
      fitBtn?.click();
    });
    await settle();
    expect(document.body.textContent).toContain('100%');
  });

  it('5. Download action uses the existing attachment download URL', async () => {
    await act(async () => {
      root.render(
        <DentalImageViewerModal
          open={true}
          onClose={vi.fn()}
          attachment={sampleImageAttachment}
          orderId="order-99"
          canDownload={true}
        />
      );
    });
    await settle();

    const downloadLink = document.querySelector<HTMLAnchorElement>('a[data-testid="toolbar-download-btn"]');
    expect(downloadLink).not.toBeNull();
    expect(downloadLink?.getAttribute('href')).toContain(
      '/api/imaging/orders/order-99/attachments/att-1/download'
    );
    expect(downloadLink?.getAttribute('download')).toBe('iopa_tooth_16.jpg');
  });

  it('6. Non-image attachment shows preview-unavailable fallback and preserves download action', async () => {
    await act(async () => {
      root.render(
        <DentalImageViewerModal
          open={true}
          onClose={vi.fn()}
          attachment={samplePdfAttachment}
          orderId="order-99"
          canDownload={true}
        />
      );
    });
    await settle();

    expect(document.querySelector('img[data-testid="dental-viewer-image"]')).toBeNull();

    const fallback = document.querySelector('div[data-testid="dental-viewer-fallback"]');
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain('Preview Not Available');
    expect(fallback?.textContent).toContain('application/pdf');

    const fallbackDownload = document.querySelector<HTMLAnchorElement>('a[data-testid="fallback-download-btn"]');
    expect(fallbackDownload).not.toBeNull();
    expect(fallbackDownload?.getAttribute('href')).toContain(
      '/api/imaging/orders/order-99/attachments/att-3/download'
    );
  });

  it('7. Multiple attachments can be switched individually via tab selector', async () => {
    const handleSelect = vi.fn();

    await act(async () => {
      root.render(
        <DentalImageViewerModal
          open={true}
          onClose={vi.fn()}
          attachment={sampleImageAttachment}
          attachments={[sampleImageAttachment, samplePngAttachment]}
          orderId="order-99"
          onSelectAttachment={handleSelect}
        />
      );
    });
    await settle();

    const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('button[role="tab"]'));
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.textContent).toBe('iopa_tooth_16.jpg');
    expect(tabs[1]?.textContent).toBe('cbct_slice_16.png');

    await act(async () => {
      tabs[1]?.click();
    });
    await settle();

    expect(handleSelect).toHaveBeenCalledWith(samplePngAttachment);
  });

  it('8. Unauthorized users cannot download when canDownload is false', async () => {
    await act(async () => {
      root.render(
        <DentalImageViewerModal
          open={true}
          onClose={vi.fn()}
          attachment={sampleImageAttachment}
          orderId="order-99"
          canDownload={false}
        />
      );
    });
    await settle();

    const downloadLink = document.querySelector('a[data-testid="toolbar-download-btn"]');
    expect(downloadLink).toBeNull();
  });

  it('9. Close button in header and toolbar trigger onClose', async () => {
    const handleClose = vi.fn();
    await act(async () => {
      root.render(
        <DentalImageViewerModal
          open={true}
          onClose={handleClose}
          attachment={sampleImageAttachment}
          orderId="order-99"
        />
      );
    });
    await settle();

    const closeBtn = document.querySelector<HTMLButtonElement>('button[aria-label="Close image viewer"]');
    expect(closeBtn).not.toBeNull();
    await act(async () => {
      closeBtn?.click();
    });
    await settle();
    expect(handleClose).toHaveBeenCalledTimes(1);

    const toolbarCloseBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Close'
    );
    expect(toolbarCloseBtn).not.toBeNull();
    await act(async () => {
      toolbarCloseBtn?.click();
    });
    await settle();
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('10. Clicking the backdrop overlay triggers onClose', async () => {
    const handleClose = vi.fn();
    await act(async () => {
      root.render(
        <DentalImageViewerModal
          open={true}
          onClose={handleClose}
          attachment={sampleImageAttachment}
          orderId="order-99"
        />
      );
    });
    await settle();

    const overlay = document.querySelector<HTMLDivElement>('div[data-testid="dental-image-viewer-overlay"]');
    expect(overlay).not.toBeNull();
    await act(async () => {
      overlay?.click();
    });
    await settle();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('11. Pressing Escape key triggers onClose', async () => {
    const handleClose = vi.fn();
    await act(async () => {
      root.render(
        <DentalImageViewerModal
          open={true}
          onClose={handleClose}
          attachment={sampleImageAttachment}
          orderId="order-99"
        />
      );
    });
    await settle();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await settle();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
