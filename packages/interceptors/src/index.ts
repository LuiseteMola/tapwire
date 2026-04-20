import { CallStackCapture } from './call-stack-capture';
import { HttpInterceptor } from './http/http-interceptor';

// Auto-setup when loaded via --require or NODE_OPTIONS.
// The interceptor instance is exported so tools (e.g. test suites) can
// call interceptor.dispose() for clean teardown.

const callStack = new CallStackCapture();

export const interceptor = new HttpInterceptor(
  `http://localhost:${process.env.TAPWIRE_PORT ?? '4000'}`,
  { getInitiator: () => callStack.getFrames() },
);

// Order matters: MSW patches globalThis.fetch by replacing it entirely,
// so CallStackCapture must wrap AFTER MSW to sit on top.
interceptor.apply();
callStack.apply();
