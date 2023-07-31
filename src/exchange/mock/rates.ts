import https from 'https';
import fs from 'fs';


function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';

            // При получении данных от сервера
            response.on('data', (chunk) => {
                data += chunk;
            });

            // По окончании получения данных
            response.on('end', () => {
                resolve(data);
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

async function makeRequest(url) {
    try {
        const response = await httpGet(url);
        return response;
    } catch (error) {
        console.error(error);
    }
}


// Сохранение объекта в файл
function saveObjectToFile(filePath, object) {
    const data = JSON.stringify(object);
    fs.writeFileSync(filePath, data);
}

// Чтение объекта из файла
function readObjectFromFile(filePath) {
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } else {
        return [];
    }
}


export function getRatesFromFile(fn){
    return readObjectFromFile(fn);
}

export async function loadRates()
{
    const fn = 'data.json';

    const rates = readObjectFromFile(fn);

    if (rates.length == 0) {
        let itime = Date.now();

        console.log('Load rates ...');
        for (let i = 0; i < 10; i++) {
            const data = JSON.parse(String(await makeRequest('https://api.binance.com/api/v3/klines?endTime=' + itime + '&symbol=BTCUSDT&interval=1h&limit=1000')));

            if (data[0][0] == itime) {
                break;
            }
            itime = data[0][0];
            for (const item of data) {
                const [time, open, high, low, close, volume] = item;
                rates.push({
                    time, open, high, low, close, volume
                });
            }

            console.log(itime, (new Date(itime)), rates.length);
        }

        rates.sort((a, b) => a.time - b.time);

        saveObjectToFile(fn, rates);
    }


    return rates;
}
