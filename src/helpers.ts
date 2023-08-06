const AsyncLock = require('async-lock');
const asynclock = new AsyncLock();

const { divide, subtract, multiply, compareTo, add } = require("js-big-decimal");

export const SEC_IN_HOUR = 60 * 60;
export const SEC_IN_DAY = SEC_IN_HOUR * 24; 
export const SEC_IN_YEAR = SEC_IN_DAY * 365;

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
   return (Date.now()/1000 - from) > sec;
}

export function isSuitableRate(rate: number, lastRate: number, needMargin:number) {
    const margin = divide(Math.abs(lastRate - rate), lastRate, 15);
    return compareTo(margin, needMargin) > 0;
}