const pool = require('./database');

async function check() {
  try {
    await pool.query('SELECT 1');
    await pool.query('SELECT id FROM clientes LIMIT 1');
    console.log('Conexão MySQL e tabela clientes verificadas com sucesso.');
  } catch (error) {
    console.error('Não foi possível verificar o banco. Confira o MySQL, o .env e a importação do schema.', error.code || 'ERRO_BANCO');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
check();
