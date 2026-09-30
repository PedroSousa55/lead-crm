const { test } = require('node:test');
const assert = require('node:assert/strict');
Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_USER: 'test_only', DB_PASSWORD: '', DB_NAME: 'test_only', PORT: '3000' });
const pool = require('../config/database');
const app = require('../server');
const campos = ['nome_empresa', 'telefone', 'nicho', 'cidade', 'estado', 'instagram', 'possui_site', 'status', 'observacoes', 'gancho_verificado'];
const valido = { nome_empresa: 'Empresa teste', telefone: '85999999999' };

test('API HTTP: CRUD, parâmetros SQL, validação e erros', async t => {
  const original = pool.execute;
  let rows = [], nextId = 1, calls = 0, falhar = false;
  pool.execute = async (sql, params = []) => {
    calls++;
    if (falhar) throw Object.assign(new Error('segredo'), { code: 'ECONNREFUSED' });
    assert.equal((sql.match(/\?/g) || []).length, params.length);
    if (sql.startsWith('SELECT')) return [sql.includes('FROM clientes WHERE id = ?') ? rows.filter(r => r.id === params[0]) : [...rows].reverse()];
    if (sql.startsWith('INSERT')) {
      assert.equal(params.length, campos.length);
      const id = nextId++;
      rows.push({ id, ...Object.fromEntries(campos.map((c, i) => [c, params[i]])) });
      return [{ insertId: id }];
    }
    const cliente = rows.find(r => r.id === params.at(-1));
    if (sql.startsWith('UPDATE')) {
      assert.doesNotMatch(sql, /ultima_data_contato|created_at/);
      if (cliente) Object.assign(cliente, Object.fromEntries(campos.map((c, i) => [c, params[i]])));
    } else if (sql.startsWith('DELETE')) rows = rows.filter(r => r.id !== params[0]);
    else assert.fail('SQL inesperado');
    return [{ affectedRows: cliente ? 1 : 0 }];
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const req = (method, suffix = '', body) => fetch(base + '/api/clientes' + suffix, {
    method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  try {
    await t.test('arquivos, CORS e listagem vazia', async () => {
      for (const p of ['/', '/style.css', '/script.js']) assert.equal((await fetch(base + p)).status, 200);
      assert.deepEqual(await (await req('GET')).json(), []);
      const r = await fetch(base + '/api/clientes', { method: 'OPTIONS', headers: {
        Origin: 'http://localhost:5500', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type',
      } });
      assert.equal(r.status, 204);
      assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5500');
      for (const m of ['GET', 'POST', 'PUT', 'DELETE']) assert.ok(r.headers.get('access-control-allow-methods').includes(m));
      const externo = await fetch(base + '/api/clientes', { headers: { Origin: 'https://example.com' } });
      assert.equal(externo.headers.get('access-control-allow-origin'), null);
    });
    await t.test('POST, normalização, GET individual e listagem', async () => {
      const r = await req('POST', '', { ...valido, nome_empresa: "  Empresa   D'Ávila  ", telefone: '  85  9999  ', estado: 'ce', observacoes: '  Linha  um \n  Linha dois  ', id: 999 });
      assert.equal(r.status, 201);
      assert.equal(r.headers.get('location'), '/api/clientes/1');
      const c = await r.json();
      assert.equal(c.id, 1);
      assert.equal(c.nome_empresa, "Empresa D'Ávila");
      assert.equal(c.telefone, '85 9999');
      assert.equal(c.estado, 'CE');
      assert.equal(c.status, 'nao_contatado');
      assert.equal(c.observacoes, 'Linha um\nLinha dois');
      assert.equal(Object.hasOwn(c, 'site'), false);
      assert.deepEqual(await (await req('GET', '/1')).json(), c);
      assert.equal((await (await req('GET')).json()).length, 1);
    });
    await t.test('PUT: sete status e salvar sem mudanças', async () => {
      for (const status of ['nao_contatado', 'contatado', 'interessado', 'sem_resposta', 'negociacao', 'fechado', 'descartado', 'descartado']) {
        const r = await req('PUT', '/1', { ...valido, status });
        assert.equal(r.status, 200);
        assert.equal((await r.json()).status, status);
      }
    });
    await t.test('validações POST e PUT antes de acessar o banco', async () => {
      const invalidos = [null, [], {}, { ...valido, nome_empresa: ' ' }, { ...valido, telefone: null }, { ...valido, telefone: 123 },
        { ...valido, status: null }, { ...valido, status: 'invalido' }, { ...valido, status: '' }, { ...valido, estado: '1A' }, { ...valido, nicho: {} }];
      const limites = { nome_empresa: 255, telefone: 30, nicho: 120, cidade: 120, estado: 2, instagram: 255, status: 50, observacoes: 10000, gancho_verificado: 1000 };
      for (const [c, n] of Object.entries(limites)) invalidos.push({ ...valido, [c]: 'a'.repeat(n + 1) });
      const antes = calls;
      for (const method of ['POST', 'PUT']) for (const body of invalidos) {
        const r = await req(method, method === 'PUT' ? '/1' : '', body);
        assert.equal(r.status, 400);
        assert.ok((await r.json()).erro);
      }
      assert.equal(calls, antes);
      assert.equal((await req('POST', '', { ...valido, nome_empresa: 'á'.repeat(255), telefone: '1'.repeat(30), nicho: 'x'.repeat(120),
        estado: 'MA', cidade: 'São Luís', instagram: 'x'.repeat(255), observacoes: '😀'.repeat(10000) })).status, 201);
    });
    await t.test('IDs inválidos, registros ausentes e JSON inválido', async () => {
      for (const m of ['GET', 'PUT', 'DELETE']) {
        for (const id of ['0', '-1', 'abc', '1abc', '1.5', '4294967296', '1%20OR%201=1']) {
          assert.equal((await req(m, '/' + id, m === 'PUT' ? valido : undefined)).status, 400);
        }
        assert.equal((await req(m, '/999', m === 'PUT' ? valido : undefined)).status, 404);
      }
      const r = await fetch(base + '/api/clientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
      assert.equal(r.status, 400);
      assert.ok((await r.json()).erro);
      assert.equal((await req('POST', '', { ...valido, observacoes: 'a'.repeat(110000) })).status, 413);
      assert.equal((await fetch(base + '/api/inexistente')).status, 404);
    });
    await t.test('falha do banco em todas as operações', async () => {
      falhar = true;
      for (const [m, p] of [['GET', ''], ['GET', '/1'], ['POST', ''], ['PUT', '/1'], ['DELETE', '/1']]) {
        const r = await req(m, p, ['POST', 'PUT'].includes(m) ? valido : undefined);
        assert.equal(r.status, 503);
        assert.doesNotMatch(await r.text(), /segredo/);
      }
      falhar = false;
    });
    await t.test('classificação e Instagram no POST/PUT; URL antiga ignorada', async () => {
      for (const method of ['POST', 'PUT']) {
        const suffix = method === 'PUT' ? '/1' : '';
        for (const escolha of [null, '', 0, '0', false, 1, '1', true]) {
          const r = await req(method, suffix, { ...valido, possui_site: escolha, instagram: ' @nomeempresa ', site: 'valor antigo' });
          assert.equal(r.status, method === 'POST' ? 201 : 200);
          const cliente = await r.json();
          assert.equal(cliente.possui_site, [1, '1', true].includes(escolha) ? 1 : [0, '0', false].includes(escolha) ? 0 : null);
          assert.equal(cliente.instagram, 'https://www.instagram.com/nomeempresa/');
          assert.equal(Object.hasOwn(cliente, 'site'), false);
          const saved = await (await req('GET', '/' + cliente.id)).json();
          assert.equal(saved.instagram, cliente.instagram);
          assert.equal(Object.hasOwn(saved, 'site'), false);
        }
        const r = await req(method, suffix, { ...valido, instagram: 'https://www.instagram.com/completo/' });
        assert.equal((await r.json()).instagram, 'https://www.instagram.com/completo/');
        for (const possui_site of [2, -1, 'Sim', [], {}]) assert.equal((await req(method, suffix, { ...valido, possui_site })).status, 400);
        assert.equal((await req(method, suffix, { ...valido, instagram: '@' + 'x'.repeat(255) })).status, 400);
      }
    });
    await t.test('DELETE e repetição', async () => {
      const r = await req('DELETE', '/1');
      assert.equal(r.status, 204);
      assert.equal(await r.text(), '');
      assert.equal((await req('GET', '/1')).status, 404);
      assert.equal((await req('DELETE', '/1')).status, 404);
    });
  } finally {
    pool.execute = original;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});

