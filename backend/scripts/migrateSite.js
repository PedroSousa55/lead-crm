const fs = require('node:fs');
const path = require('node:path');
const pool = require('../config/database');

async function migrate() {
  try {
    const [columns] = await pool.execute(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      ['clientes', 'possui_site']
    );
    if (columns.length) {
      console.log('A coluna possui_site já existe. Nenhuma alteração necessária.');
      return;
    }
    const sql = fs.readFileSync(path.resolve(__dirname, '../../database/migrations/001_possui_site.sql'), 'utf8');
    await pool.query(sql);
    console.log('Coluna possui_site adicionada. Todos os dados antigos foram preservados.');
  } catch (error) {
    console.error('Não foi possível migrar o banco:', error.code || 'ERRO_MIGRACAO');
    process.exitCode = 1;
  } finally { await pool.end(); }
}
migrate();
