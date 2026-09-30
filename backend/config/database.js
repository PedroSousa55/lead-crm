const mysql = require('mysql2/promise');
const { database } = require('./env');
module.exports = mysql.createPool(database);
