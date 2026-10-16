import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, API_URL, errorText, formatDate } from './api';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('errorText', () => {
  it('joins Laravel validation errors into one sentence', () => {
    const data = { errors: { email: ['Taken.'], password: ['Too short.', 'Needs a number.'] } };
    expect(errorText(422, data)).toBe('Taken. Too short. Needs a number.');
  });

  it('uses the message when there are no errors', () => {
    expect(errorText(401, { message: 'Unauthenticated.' })).toBe('Unauthenticated.');
  });

  it('falls back to the HTTP status', () => {
    expect(errorText(500, null)).toBe('Request failed (HTTP 500).');
  });
});

describe('api', () => {
  it('sends a plain GET without token or body', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 1 }]));

    const result = await api('/posts');

    expect(result).toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/posts`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      body: undefined,
    });
  });

  it('adds the Bearer token from localStorage', async () => {
    localStorage.setItem('token', 'abc123');
    fetchMock.mockResolvedValue(jsonResponse({}));

    await api('/user');

    const options = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(options.headers.Authorization).toBe('Bearer abc123');
  });

  it('sends a JSON body with a Content-Type header', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await api('/posts', { method: 'POST', body: { title: 'Hi' } });

    const options = fetchMock.mock.calls[0][1] as {
      method: string;
      body: string;
      headers: Record<string, string>;
    };
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ title: 'Hi' }));
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('returns null for a 204 response', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) } as Response);
    expect(await api('/posts/1', { method: 'DELETE' })).toBeNull();
  });

  it('throws the API message on an error response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Unauthenticated.' }, 401));
    await expect(api('/user')).rejects.toThrow('Unauthenticated.');
  });

  it('throws a generic message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);
    await expect(api('/posts')).rejects.toThrow('Request failed (HTTP 500).');
  });

  it('throws a friendly message when the API is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api('/posts')).rejects.toThrow('Cannot reach the API');
  });
});

describe('formatDate', () => {
  it('returns an empty string for missing dates', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  it('formats an ISO date as day, short month, year', () => {
    expect(formatDate('2024-03-05T12:00:00Z')).toBe('5 Mar 2024');
  });
});