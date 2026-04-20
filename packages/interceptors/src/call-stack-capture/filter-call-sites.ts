import type { StackFrame } from '@tapwire/shared';

/**
 * Filters raw V8 CallSite objects into clean StackFrame[].
 *
 * Removes:
 * - Node internals (node:* paths)
 * - Tapwire's own frames (packages/interceptors, @tapwire)
 * - node_modules frames (except the topmost library frame, kept as context)
 *
 * Keeps:
 * - The first library frame (e.g. axios, stripe) — shown in amber in the UI
 * - All user code frames — shown in indigo in the UI
 */
export function filterCallSites(sites: NodeJS.CallSite[]): StackFrame[] {
  let firstLibraryFrame: StackFrame | null = null;
  const userFrames: StackFrame[] = [];

  for (const site of sites) {
    const file = site.getFileName() ?? '';
    if (!file || file.startsWith('node:')) {
      continue;
    }

    const isNodeModules = file.includes('node_modules');
    const isTapwire = file.includes('packages/interceptors') || file.includes('@tapwire');

    if (isTapwire) {
      continue;
    }

    if (isNodeModules) {
      if (!firstLibraryFrame) {
        firstLibraryFrame = {
          file,
          line: site.getLineNumber() ?? 0,
          column: site.getColumnNumber() ?? 0,
          fn: site.getFunctionName() ?? site.getMethodName() ?? '(anonymous)',
        };
      }
      continue;
    }

    userFrames.push({
      file,
      line: site.getLineNumber() ?? 0,
      column: site.getColumnNumber() ?? 0,
      fn: site.getFunctionName() ?? site.getMethodName() ?? '(anonymous)',
    });
  }

  if (firstLibraryFrame) {
    return [firstLibraryFrame, ...userFrames];
  }
  return userFrames;
}
