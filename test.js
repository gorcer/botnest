const ccxt = require('ccxt').pro;
async function fn(){
// Пример использования
const symbol = 'BTC/USDT';
const side = 'buy'; 
const type ='limit';
const price = 50000; // Цена
const amount = 0.001; // Количество

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

const exchange = new ccxt.binance({
    apiKey: 'lvnfUN0uTMWEJrqDf0JgnUYar0aD0B8h6COfnPSmekFLJiZNl8hns5cyyww0LWHO',
    secret: 'C9xqgMBNer0gWUK5BvKAJSSsg73fztUxgAjWx9QCCIKNjGncbCG0bZHErEdtaPPr',    
});
exchange.setSandboxMode(true);   

try {
    console.log('Try to buy 1');
    // exchange.verbose = true;
const order = await exchange.createOrderWs(symbol, type, side, amount, price);
console.log('Ok', order.id);
console.log('Try to buy 2');
sleep(10);
const order2 = await exchange.createOrderWs(symbol, type, side, amount, price);
console.log('Ok', order2.id);

} catch (e) { 
    console.log('e', e);
  }
  
};

fn();