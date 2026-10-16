import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TextApiWidget from './TextApiWidget';

const fetchMock = vi.fn();
const extractText = (data: unknown) => (data as { text: string }).text;

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function renderWidget() {
  return render(
    <TextApiWidget
      title="Fact"
      url="https://example.test/fact"
      extractText={extractText}
      buttonLabel="New fact"
    />,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TextApiWidget', () => {
  it('shows Loading, then the fetched text', async () => {
    fetchMock.mockResolvedValue(ok({ text: 'Cats purr' }));

    renderWidget();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByText('Cats purr')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/fact', {
      headers: { Accept: 'application/json' },
    });
  });

  it('fetches new text when the button is clicked', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ text: 'First' }))
      .mockResolvedValueOnce(ok({ text: 'Second' }));
    const user = userEvent.setup();

    renderWidget();
    expect(await screen.findByText('First')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New fact' }));

    expect(await screen.findByText('Second')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows an error message on a non-OK response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response);

    renderWidget();

    expect(await screen.findByText('Could not load this. Try again.')).toBeInTheDocument();
  });

  it('shows an error message when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    renderWidget();

    expect(await screen.findByText('Could not load this. Try again.')).toBeInTheDocument();
  });
});