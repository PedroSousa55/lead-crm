const pool = require('../config/database');
const { normalizarTelefone } = require('../services/csvService');
const CAMPOS = ['nome_empresa', 'telefone', 'nicho', 'cidade', 'estado', 'instagram', 'possui_site', 'status', 'observacoes', 'gancho_verificado'];

// Separada para testar o mesmo fluxo numa transação revertida no MySQL real.
async function inserirSemDuplicados(connection, registros) {
  const [existentes] = await connection.execute('SELECT telefone FROM clientes FOR UPDATE');
  const telefones = new Set(existentes.map(c => normalizarTelefone(c.telefone)));
  const ignorados = [];
  let importados = 0;
  for (const { linha, dados } of registros) {
    if (telefones.has(dados.telefone)) {
      ignorados.push({ linha, tipo: 'duplicado', motivos: ['Telefone já cadastrado ou repetido em uma linha anterior deste arquivo.'] });
      continue;
    }
    const campos = dados.status === 'nao_contatar' ? [...CAMPOS, 'nao_contatar'] : CAMPOS;
    await connection.execute(
      `INSERT INTO clientes (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`,
      campos.map(c => c === 'nao_contatar' ? 1 : dados[c])
    );
    telefones.add(dados.telefone);
    importados++;
  }
  return { importados, duplicados: ignorados.length, ignorados };
}
async function importar(registros) {
  if (!registros.length) return { importados: 0, duplicados: 0, ignorados: [] };
  const connection = await pool.getConnection();
  let bloqueado = false, transacao = false;
  try {
    // Serializa importações concorrentes. O lock pertence à conexão.
    const [[lock]] = await connection.execute("SELECT GET_LOCK(CONCAT('lead_crm_csv_', LEFT(SHA2(DATABASE(), 256), 32)), 10) AS adquirido");
    if (lock.adquirido !== 1) throw new Error('IMPORTACAO_OCUPADA');
    bloqueado = true;
    await connection.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    await connection.beginTransaction();
    transacao = true;
    const resultado = await inserirSemDuplicados(connection, registros);
    await connection.commit();
    transacao = false;
    return resultado;
  } catch (error) {
    if (transacao) await connection.rollback();
    throw error;
  } finally {
    try {
      if (bloqueado) await connection.execute("SELECT RELEASE_LOCK(CONCAT('lead_crm_csv_', LEFT(SHA2(DATABASE(), 256), 32)))");
    } finally { connection.release(); }
  }
}
module.exports = { importar, inserirSemDuplicados };
