/**
 * @vitest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { PatientCardPrintView } from './PatientPrintHelper';

describe('H-004 - PatientPrintHelper XSS Security Tests', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('safely renders malicious payload as text and prevents XSS execution', async () => {
    const maliciousPayload = "<script>alert('xss')</script><img src=x onerror=alert(1)>";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maliciousPatient: any =  {
      id: 'malicious',
      first_name: maliciousPayload,
      last_name: '"><script>alert(1)</script>',
      patient_number: 'MRN-XSS-123',
      date_of_birth: '1990-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      status: 'ACTIVE',
      gender: 'MALE',
      blood_group: maliciousPayload,
      phone: maliciousPayload,
    };

    const targetWindow = { print: vi.fn() } as unknown as Window;

    const root = createRoot(container);
    await act(async () => {
      root.render(<PatientCardPrintView patient={maliciousPatient} targetWindow={targetWindow} />);
    });

    const html = container.innerHTML;

    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    
    expect(container.textContent).toContain("<script>alert('xss')</script>");
    expect(container.textContent).toContain('"><script>alert(1)</script>');
    
    root.unmount();
  });
});




