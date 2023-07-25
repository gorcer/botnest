const AsyncLock = require('async-lock');
const asynclock = new AsyncLock();

export const lock = asynclock;