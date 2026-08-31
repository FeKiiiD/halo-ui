/**
 * The single Node global this browser library touches: bundlers replace
 * `process.env.NODE_ENV` at build time so development-only warnings drop out of
 * production output. Declaring it here rather than pulling in @types/node keeps
 * Node's globals (Buffer, __dirname, fs) out of a library that must not use
 * them.
 */
declare const process: { env: { NODE_ENV?: string } };
