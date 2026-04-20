import http from 'node:http';

/**
 * Polls `url` every 100 ms until it responds with HTTP 200 or `timeoutMs` elapses.
 * Resolves when the server is ready; rejects on timeout.
 */
export function waitFor(url: string, timeoutMs = 5_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const parsed = new URL(url);

    function attempt(): void {
      const req = http.get(
        {
          hostname: parsed.hostname,
          port: Number(parsed.port) || 80,
          path: parsed.pathname,
        },
        (res) => {
          res.resume(); // drain so the socket closes
          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
        },
      );

      req.on('error', retry);
      req.end();
    }

    function retry(): void {
      if (Date.now() + 100 <= deadline) {
        setTimeout(attempt, 100);
      } else {
        reject(new Error(`Timed out waiting for ${url} to become ready`));
      }
    }

    attempt();
  });
}
