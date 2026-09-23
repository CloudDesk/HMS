// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { ApiError } from '../api/api-error';

const mockAuth = vi.hoisted(() => ({
  status: 'unauthenticated' as string,
  authError: null as string | null,
  clearAuthError: vi.fn(),
  login: vi.fn(),
}));

const mockLocation = vi.hoisted(() => ({
  search: '',
  pathname: '/login',
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../routing/navigation', () => ({
  useAppLocation: () => mockLocation,
}));

describe('LoginPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // @ts-expect-error test env flag
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mockAuth.status = 'unauthenticated';
    mockAuth.authError = null;
    mockLocation.search = '';

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders login page without the unwanted startup authentication banner', async () => {
    await act(async () => {
      root.render(<LoginPage />);
    });

    expect(container.textContent).toContain('Welcome back');
    expect(container.textContent).toContain('Username or email');
    expect(container.textContent).toContain('Password');
    expect(container.textContent).toContain('Sign in');

    // Startup banner must NEVER be rendered
    expect(container.textContent).not.toContain('Starting the authentication service. This may take a moment...');
    expect(container.querySelector('.auth-alert--warning')).toBeNull();
  });

  it('validates empty inputs on submit', async () => {
    await act(async () => {
      root.render(<LoginPage />);
    });

    const submitBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    await act(async () => {
      submitBtn?.click();
    });

    expect(container.textContent).toContain('Enter your username or email and password.');
    expect(mockAuth.login).not.toHaveBeenCalled();
  });

  function setInputValue(input: HTMLInputElement, value: string) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('calls login on form submit and shows Signing in... state during submission', async () => {
    let resolveLogin: (value?: unknown) => void = () => {};
    mockAuth.login.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    await act(async () => {
      root.render(<LoginPage />);
    });

    const identifierInput = container.querySelector<HTMLInputElement>('input[name="identifier"]');
    const passwordInput = container.querySelector<HTMLInputElement>('input[name="password"]');
    const submitBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]');

    await act(async () => {
      if (identifierInput) setInputValue(identifierInput, 'admin');
      if (passwordInput) setInputValue(passwordInput, 'Admin@123');
    });

    await act(async () => {
      submitBtn?.click();
    });

    expect(mockAuth.login).toHaveBeenCalledWith('admin', 'Admin@123');
    expect(submitBtn?.textContent).toContain('Signing in...');
    expect(submitBtn?.disabled).toBe(true);
    // Startup banner must not appear during submission
    expect(container.textContent).not.toContain('Starting the authentication service. This may take a moment...');

    // Complete login
    await act(async () => {
      resolveLogin();
    });

    expect(submitBtn?.textContent).toContain('Sign in');
    expect(submitBtn?.disabled).toBe(false);
  });

  it('displays API error message on failed login', async () => {
    mockAuth.login.mockRejectedValue(new ApiError('Invalid username or password', 401));

    await act(async () => {
      root.render(<LoginPage />);
    });

    const identifierInput = container.querySelector<HTMLInputElement>('input[name="identifier"]');
    const passwordInput = container.querySelector<HTMLInputElement>('input[name="password"]');
    const submitBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]');

    await act(async () => {
      if (identifierInput) setInputValue(identifierInput, 'wrong_user');
      if (passwordInput) setInputValue(passwordInput, 'wrong_pass');
    });

    await act(async () => {
      submitBtn?.click();
    });

    expect(container.textContent).toContain('Invalid username or password');
    expect(submitBtn?.textContent).toContain('Sign in');
  });

  it('displays session expired notice when session is expired', async () => {
    mockAuth.status = 'session-expired';

    await act(async () => {
      root.render(<LoginPage />);
    });

    expect(container.textContent).toContain('Your session has expired');
    // Startup banner must not be present
    expect(container.textContent).not.toContain('Starting the authentication service. This may take a moment...');
  });
});
