import { compareTo, divide, multiply } from './bc';

const AsyncLock = require('async-lock');
const asynclock = new AsyncLock();

export const SEC_IN_HOUR = 60 * 60;
export const SEC_IN_DAY = SEC_IN_HOUR * 24;
export const SEC_IN_YEAR = SEC_IN_DAY * 365;
export const lock = asynclock;

export function clone(obj) {
  return {...obj};
}

/**
 *
 * @param n seconds to sleep
 */
export async function sleep(n) {
  await new Promise((r) => setTimeout(r, n * 1000));
}

export function updateModel(model, params) {
  for (const [key, value] of Object.entries(params)) {
    model[key] = value;
  }
}

export function elapsedSecondsFrom(sec, from) {
  return Date.now() / 1000 - from > sec;
}

export function isSuitableRate(
  rate: number,
  lastRate: number,
  needMargin: number,
) {
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
export function checkLimits(
  minAmount: number,
  minCost: number,
  price: number,
  amount1 = 0,
) {
  if (compareTo(amount1, minAmount) < 0) amount1 = minAmount;

  const amount2 = multiply(price, amount1);
  if (compareTo(amount2, minCost) < 0) {
    amount1 = divide(minCost * 1.2, price);
  }

  return amount1;
}

export function extractCurrency(pair: string): {
  currency1: string;
  currency2: string;
} {
  const symbols = pair.split('/');
  return {
    currency1: symbols[0],
    currency2: symbols[1],
  };
}

export function amountFormat(value, digits) {
  if (!value) {
    value = '0';
  }

  if (parseFloat(value) == 0) {
    return '0';
  }

  if (!digits) {
    digits = 8;
  } else {
    digits = parseInt(digits);
  }

  value = value.toString().replace(/(^0+)([1-9]\d*)/, (...val) => {
    return val[2];
  });

  let index = value.indexOf('.');
  if (index == -1) {
    value += '.';
    index = value.length + 1;
  }
  return (value + '0'.repeat(digits)).substr(0, index + digits + 1);
}

export function numberTrim(value, digits) {
  if (value) {
    if (!isNaN(value)) return value;

    if (digits) {
      value = amountFormat(value, digits);
    }

    if (value.match(/(\d+\.\d*)/g) != null) {
      value = value.replace(/0+$/, '');
      if (value.substr(-1) == '.') {
        value = value.substr(0, value.length - 1);
      }
    }

    //value = value.replace(/(^0+)([1-9]\d*)(\.)/, (...val) => { return val[2] + val[3] });
    value = value.replace(/(^0+)([1-9]\d*)/, (...val) => {
      return val[2];
    });
    value = value.replace(/(^0+)(0)(\.)/, (...val) => {
      return val[2] + val[3];
    });
  }

  return value;
}

export function roundUp(num, precision) {
  precision = Math.pow(10, precision);
  return Math.ceil(num * precision) / precision;
}
