const { test } = require('node:test');
const assert = require('node:assert/strict');
const { urlInstagram } = require('../../frontend/instagram');
const { validarCliente } = require('../controllers/clienteValidation');
const { lerCsv } = require('../services/csvService');

test('Instagram: normaliza usuário, domínio, protocolo e parâmetros sem inventar perfil', () => {
  for (const value of ['@nomeempresa', ' @nomeempresa ', 'http://instagram.com/nomeempresa',
    'https://www.instagram.com/nomeempresa/', 'https://instagram.com/nomeempresa/?igsh=abc#perfil']) {
    assert.equal(urlInstagram(value), 'https://www.instagram.com/nomeempresa/');
    assert.equal(validarCliente({ nome_empresa: 'Empresa', telefone: '31997150594', instagram: value }).dados.instagram,
      'https://www.instagram.com/nomeempresa/');
  }
  for (const value of ['', null, undefined]) {
    assert.equal(urlInstagram(value), null);
    assert.equal(validarCliente({ nome_empresa: 'Empresa', telefone: '31997150594', instagram: value }).dados.instagram, null);
  }
  for (const value of ['javascript:alert(1)', 'https://evil.test/empresa', 'https://instagram.com.evil.test/empresa',
    'https://user:password@instagram.com/empresa', 'https://instagram.com/', 'https://instagram.com/p/123']) {
    assert.equal(urlInstagram(value), null);
  }
});

test('CSV: Instagram @, URL e vazio; classificação Não e empresa com site ignorada', () => {
  const csv = 'nome_empresa,telefone,instagram,possui_site\nA,31997150594,@nomeempresa,não\nB,31997150595,https://instagram.com/empresa_b?igsh=abc,0\nC,31997150596,,0\nD,31997150597,@empresa_d,sim';
  const result = lerCsv(Buffer.from(csv), 'clientes.csv');
  assert.equal(result.validos.length, 3);
  assert.equal(result.validos[0].dados.instagram, 'https://www.instagram.com/nomeempresa/');
  assert.equal(result.validos[1].dados.instagram, 'https://www.instagram.com/empresa_b/');
  assert.equal(result.validos[2].dados.instagram, null);
  assert.equal(result.descartados, 1);
  assert.equal(result.invalidos, 0);
  assert.deepEqual(result.ignorados[0].motivos, ['Empresa possui site']);
});
