const AsyncLock = require('async-lock');
const asynclock = new AsyncLock();

export const lock = asynclock;

/**
 * 
 * @param n seconds to sleep
 */
export async function sleep(n) {
    await new Promise(r => setTimeout(r, n * 1000));
}

export function updateModel(model, params) {
    for (const [key, value] of Object.entries(params)) {
        model[key] = value;
    }
}

export function elapsedSecondsFrom(sec, from) {
   return (Date.now() - from) > sec;
}

export const HOUR = 60 * 60 * 1000;