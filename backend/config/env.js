const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

function readPort(name) {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Configure ${name} no .env com uma porta entre 1 e 65535.`);
  }
  return value;
}

for (const name of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
  if (!process.env[name]?.trim()) throw new Error(`Configure ${name} no .env.`);
}
if (process.env.DB_PASSWORD === undefined) {
  throw new Error('Defina DB_PASSWORD no .env (pode ficar vazio se o banco não exigir senha).');
}

module.exports = {
  port: readPort('PORT'),
  database: {
    host: process.env.DB_HOST,
    port: readPort('DB_PORT'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
    connectTimeout: 5000,
    dateStrings: true,
  },
};
