const fs = require('node:fs');
const path = require('node:path');
const pool = require('../config/database');
async function migrate() {
  try {
    const [cols] = await pool.execute('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', ['clientes']);
    if (!cols.length) throw new Error('Crie a tabela clientes primeiro com database/schema.sql.');
    const existentes = new Set(cols.map(c => c.COLUMN_NAME));
    for (const [nome, tipo] of [['gancho_verificado', 'TEXT NULL'], ['nao_contatar', 'TINYINT(1) NOT NULL DEFAULT 0']]) {
      if (!existentes.has(nome)) await pool.query(`ALTER TABLE clientes ADD COLUMN ${nome} ${tipo}`);
    }
    const sql = fs.readFileSync(path.resolve(__dirname, '../../database/migrations/003_motor_prospeccao.sql'), 'utf8');
    await pool.query(sql.slice(sql.indexOf('CREATE TABLE')));
    console.log('Migração de prospecção concluída. Dados existentes preservados; nenhum histórico foi inventado.');
  } catch (error) {
    console.error('Falha na migração de prospecção:', error.code || error.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
}
migrate();
