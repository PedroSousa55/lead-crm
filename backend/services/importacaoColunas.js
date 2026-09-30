const COLUNAS = ['nome_empresa', 'telefone', 'nicho', 'cidade', 'estado', 'instagram', 'possui_site', 'status', 'observacoes', 'gancho_verificado'];
const equivalencias = {
  nome_empresa: ['nome empresa', 'nome da empresa', 'empresa'],
  telefone: ['telefone', 'whatsapp'], nicho: ['nicho', 'categoria'],
  cidade: ['cidade'], estado: ['estado'], instagram: ['instagram'],
  possui_site: ['possui site', 'tem site'], status: ['status'],
  observacoes: ['observacoes', 'observacao'],
  gancho_verificado: ['gancho verificado'],
};
function normalizar(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[_\s]+/g, ' ');
}
const aliases = new Map(Object.entries(equivalencias).flatMap(([campo, nomes]) => nomes.map(nome => [nome, campo])));
function mapearCabecalho(celulas) { return celulas.map(c => aliases.get(normalizar(c)) || normalizar(c)); }
function validarCabecalho(cabecalho) {
  if (!cabecalho.includes('nome_empresa') || !cabecalho.includes('telefone')) return 'O cabeçalho precisa de nome_empresa e telefone (ou Empresa e WhatsApp).';
  if (new Set(cabecalho).size !== cabecalho.length || cabecalho.some(c => !COLUNAS.includes(c))) {
    return 'O cabeçalho contém colunas repetidas ou não aceitas. Confira as colunas aceitas no README.';
  }
  return null;
}
module.exports = { COLUNAS, mapearCabecalho, validarCabecalho };
