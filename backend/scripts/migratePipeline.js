const pool = require('../config/database');
async function migrate() {
  try {
    const [cols] = await pool.execute('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', ['clientes']);
    if (!cols.length) throw new Error('Crie a tabela clientes primeiro.');
    const existentes = new Set(cols.map(c => c.COLUMN_NAME));
    for (const [nome, tipo] of [['proximo_contato_em', 'DATETIME NULL'], ['proxima_acao', 'VARCHAR(1000) NULL']]) {
      if (!existentes.has(nome)) await pool.query(`ALTER TABLE clientes ADD COLUMN ${nome} ${tipo}`);
    }
    const [indices] = await pool.execute('SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?', ['clientes', 'idx_clientes_proximo_contato']);
    if (!indices.length) await pool.query('CREATE INDEX idx_clientes_proximo_contato ON clientes (proximo_contato_em)');
    console.log('Migração 004 concluída: próximo contato, próxima ação e índice. Dados existentes preservados.');
  } catch (error) { console.error('Falha na migração:', error.code || error.message); process.exitCode = 1; }
  finally { await pool.end(); }
}
migrate();
