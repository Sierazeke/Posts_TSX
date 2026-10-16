import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthPanel from './AuthPanel';
import { AppProvider, useApp } from '../AppContext';
import { api } from '../api';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, api: vi.fn() };
});

// AuthPanel reports results through the notice, so render it somewhere we can read.
function NoticeProbe() {
  const { notice } = useApp();
  return notice ? <p role="status">{notice.message}</p> : null;
}

function renderPanel(onAuthed = vi.fn()) {
  render(
    <AppProvider>
      <AuthPanel onAuthed={onAuthed} />
      <NoticeProbe />
    </AppProvider>,
  );
  return onAuthed;
}

const authResponse = { token: 'abc', user: { id: 1, name: 'Viktors', email: 'v@example.com' } };

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api).mockReset();
});

describe('AuthPanel', () => {
  it('logs in and stores the token', async () => {
    vi.mocked(api).mockResolvedValue(authResponse as never);
    const user = userEvent.setup();
    const onAuthed = renderPanel();

    await user.type(screen.getByLabelText('Email'), 'v@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Welcome back, Viktors.')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/login', {
      method: 'POST',
      body: { email: 'v@example.com', password: 'secret123' },
    });
    expect(onAuthed).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('token')).toBe('abc');
  });

  it('shows the API errors when the login has no token', async () => {
    vi.mocked(api).mockResolvedValue({
      errors: { email: ['These credentials do not match our records.'] },
    } as never);
    const user = userEvent.setup();
    const onAuthed = renderPanel();

    await user.type(screen.getByLabelText('Email'), 'v@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByText('These credentials do not match our records.'),
    ).toBeInTheDocument();
    expect(onAuthed).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('shows the error when the API cannot be reached', async () => {
    vi.mocked(api).mockRejectedValue(new Error('Cannot reach the API.'));
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText('Email'), 'v@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Cannot reach the API.')).toBeInTheDocument();
  });

  it('registers a new account from the Register tab', async () => {
    vi.mocked(api).mockResolvedValue(authResponse as never);
    const user = userEvent.setup();
    const onAuthed = renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Register' }));
    await user.type(screen.getByLabelText('Name'), 'Viktors');
    await user.type(screen.getByLabelText('Email'), 'v@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.type(screen.getByLabelText('Repeat password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('Account created. You are logged in as Viktors.'),
    ).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/register', {
      method: 'POST',
      body: {
        name: 'Viktors',
        email: 'v@example.com',
        password: 'secret123',
        password_confirmation: 'secret123',
      },
    });
    expect(onAuthed).toHaveBeenCalledTimes(1);
  });
});