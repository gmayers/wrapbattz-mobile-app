import { installRetryOnTransient } from '../retryOnTransient';

function makeClient() {
  const client = {
    interceptors: { response: { use: jest.fn() } },
    request: jest.fn().mockResolvedValue({ status: 200 }),
  };
  installRetryOnTransient(client as never);
  const onRejected = client.interceptors.response.use.mock.calls[0][1] as (
    error: unknown
  ) => Promise<unknown>;
  return { client, onRejected };
}

function transientGetError(config: Record<string, unknown>) {
  // No `response` → network error / timeout, the transient case.
  return { config, message: 'Network Error' };
}

describe('retryOnTransient', () => {
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(0);
  });

  afterEach(() => nowSpy.mockRestore());

  it('retries a transient GET failure', async () => {
    const { client, onRejected } = makeClient();
    await onRejected(transientGetError({ method: 'get', url: '/tools/' }));
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  it('stops retrying once the elapsed time since the first failure exceeds the budget', async () => {
    const { client, onRejected } = makeClient();
    const cfg = { method: 'get', url: '/tools/' };

    nowSpy.mockReturnValue(0);
    await onRejected(transientGetError(cfg));
    expect(client.request).toHaveBeenCalledTimes(1);

    // The retried attempt itself hangs until its own timeout, so the second
    // failure arrives well past the budget — do NOT compound another attempt.
    nowSpy.mockReturnValue(9_000);
    await expect(onRejected(transientGetError(cfg))).rejects.toBeTruthy();
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the request opts out via noTransientRetry', async () => {
    const { client, onRejected } = makeClient();
    await expect(
      onRejected(
        transientGetError({ method: 'get', url: '/account/', noTransientRetry: true })
      )
    ).rejects.toBeTruthy();
    expect(client.request).not.toHaveBeenCalled();
  });
});
