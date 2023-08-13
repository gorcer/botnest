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

    if (!lastRate) {
        return true;
    }

    const margin = divide(Math.abs(lastRate - rate), lastRate, 15);
    return compareTo(margin, needMargin) > 0;
}

/**
* 
* @param price Fix amount to limits
* @param amount1 
* @returns 
*/
export function checkLimits(minAmount: number, minCost: number, price: number, amount1: number=0) {

   if (compareTo(amount1, minAmount) < 0)
       amount1 = minAmount;

   const amount2 = multiply(price, amount1);
   if (compareTo(amount2, minCost) < 0) {
       amount1 = divide(minCost * 1.1, price, 6);
   }

   return amount1;
}

export function extractCurrency(pair:string):{currency1: string, currency2: string} {
    const symbols = pair.split('/');
    return {
      currency1: symbols[0],
      currency2: symbols[1]
    };
}