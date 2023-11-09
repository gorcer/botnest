process.env.TZ = 'Asia/Vladivostok';

const date = new Date();
console.log(date);

console.log(date.toLocaleTimeString());

console.log(date.toLocaleString());