/**
 * Captures raw V8 CallSite objects from the current call stack.
 *
 * Uses V8's structured stack trace API: temporarily overrides
 * Error.prepareStackTrace to intercept the raw CallSite array
 * before V8 formats it into a string.
 *
 * @param belowFn — frames from this function and below are excluded
 *                   from the trace (only callers above it are captured)
 */
export function captureRawCallSites(belowFn: Function): NodeJS.CallSite[] {
  const originalPrepare = Error.prepareStackTrace;
  const originalLimit = Error.stackTraceLimit;
  const sites: NodeJS.CallSite[] = [];

  Error.stackTraceLimit = 50;
  Error.prepareStackTrace = (_err, callSites) => {
    sites.push(...callSites);
    return '';
  };

  const err = {} as Error;
  Error.captureStackTrace(err, belowFn);
  err.stack; // triggers prepareStackTrace

  Error.prepareStackTrace = originalPrepare;
  Error.stackTraceLimit = originalLimit;

  return sites;
}
