import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AppProvider, useApp } from './AppContext';

function Probe() {
  const { user, login, logout, notify, notice } = useApp();
  return (
    <div>
      <p data-testid="user">{user ? user.name : 'anonymous'}</p>
      {notice && <p role="status">{notice.message}</p>}
      <button
        onClick={() =>
          login({ token: 't1', user: { id: 1, name: 'Viktors', email: 'v@example.com' } } as never)
        }
      >
        login
      </button>
      <button onClick={logout}>logout</button>
      <button onClick={() => notify('Hello')}>notify</button>
    </div>
  );
}

function renderProbe() {
  render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AppProvider', () => {
  it('starts anonymous when nothing is stored', () => {
    renderProbe();
    expect(screen.getByTestId('user')).toHaveTextContent('anonymous');
  });

  it('restores the user from localStorage', () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Stored', email: 's@example.com' }));
    renderProbe();
    expect(screen.getByTestId('user')).toHaveTextContent('Stored');
  });

  it('ignores corrupt data in localStorage', () => {
    localStorage.setItem('user', '{not json');
    renderProbe();
    expect(screen.getByTestId('user')).toHaveTextContent('anonymous');
  });

  it('login stores token and user, logout clears them', () => {
    renderProbe();

    fireEvent.click(screen.getByText('login'));
    expect(screen.getByTestId('user')).toHaveTextContent('Viktors');
    expect(localStorage.getItem('token')).toBe('t1');

    fireEvent.click(screen.getByText('logout'));
    expect(screen.getByTestId('user')).toHaveTextContent('anonymous');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('hides the notice after 5 seconds', () => {
    vi.useFakeTimers();
    renderProbe();

    fireEvent.click(screen.getByText('notify'));
    expect(screen.getByRole('status')).toHaveTextContent('Hello');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});