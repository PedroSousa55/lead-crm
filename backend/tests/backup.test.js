const { test } = require("node:test");
const assert = require("node:assert/strict");
const v = require("../services/backupValidation");
const { backup } = require("../test-support/backupFixtures");
test("Backup: versão, metadados, contagens, datas e caracteres preservados no JSON", () => {
  const b = backup();
  assert.equal(b.backup.versao_backup, 1);
  assert.equal(b.backup.aplicacao, "lead-crm");
  assert.equal(b.backup.schema_version, v.SCHEMA);
  assert.deepEqual(v.ler(v.serializar(b)), b);
  assert.equal(b.resumo.quantidade_clientes, 1);
  assert.equal(b.resumo.quantidade_prospeccoes, 1);
  assert.equal(b.checksum.algoritmo, "SHA-256");
  assert.equal(b.checksum.valor.length, 64);
  assert.ok(!v.serializar(b).includes("DB_PASSWORD"));
});
test("Backup: vazio é válido; não exige regras atuais de importação ou normalização", () => {
  assert.deepEqual(
    v.validar(v.criar({ clientes: [], prospeccoes: [] })).dados,
    { clientes: [], prospeccoes: [] },
  );
  const b = backup();
  b.dados.clientes[0].possui_site = 1;
  b.dados.clientes[0].cidade = "São Luis";
  b.dados.clientes[0].estado = "ma";
  b.dados.clientes.push({ ...b.dados.clientes[0], id: 8 });
  assert.equal(v.validar(v.criar(b.dados)).dados.clientes.length, 2);
});
test("Backup: site legado preservado apenas quando declarado", () => {
  const b = backup();
  b.dados.clientes[0].site = "https://antigo.example";
  assert.equal(
    v.validar(v.criar(b.dados, true)).dados.clientes[0].site,
    "https://antigo.example",
  );
  assert.throws(() => v.validar(v.criar(b.dados, false)), /campos/);
});
for (const [nome, alterar, padrao] of [
  ["aplicação", (b) => (b.backup.aplicacao = "outra"), /aplicação/],
  ["versão", (b) => (b.backup.versao_backup = 2), /Versão/],
  ["schema", (b) => (b.backup.schema_version = "futuro"), /Versão/],
  [
    "data metadados",
    (b) => (b.backup.criado_em = "2026-02-30T10:00:00.000Z"),
    /metadados/,
  ],
  ["estrutura", (b) => delete b.dados, /estrutura/],
  ["tabela extra", (b) => (b.dados.tokens = []), /tabelas/],
  ["array", (b) => (b.dados.clientes = {}), /quantidade/],
  ["quantidade", (b) => (b.resumo.quantidade_clientes = 5), /quantidade/],
  ["checksum", (b) => (b.checksum.valor = "a".repeat(64)), /Checksum/],
  [
    "alteração de mensagem",
    (b) => (b.dados.prospeccoes[0].mensagem = "alterada"),
    /Checksum/,
  ],
  ["ID inválido", (b) => (b.dados.clientes[0].id = -1), /clientes.id/],
  [
    "ID duplicado",
    (b) => {
      b.dados.clientes.push({ ...b.dados.clientes[0] });
      b.resumo.quantidade_clientes++;
    },
    /duplicado/,
  ],
  [
    "cliente inválido",
    (b) => (b.dados.clientes[0].nome_empresa = 123),
    /nome_empresa/,
  ],
  [
    "data inválida",
    (b) => (b.dados.clientes[0].created_at = "2026-02-30 10:00:00"),
    /created_at/,
  ],
  [
    "prospecção inválida",
    (b) => (b.dados.prospeccoes[0].mensagem = null),
    /mensagem/,
  ],
  [
    "relacionamento",
    (b) => (b.dados.prospeccoes[0].cliente_id = 999),
    /referenciado/,
  ],
  [
    "campo inesperado",
    (b) => (b.dados.clientes[0].sql = "DROP TABLE clientes"),
    /campos/,
  ],
  [
    "limite de texto SQL",
    (b) => (b.dados.prospeccoes[0].mensagem = "👋".repeat(17000)),
    /mensagem/,
  ],
])
  test("Backup rejeita " + nome, () => {
    const b = backup();
    alterar(b);
    assert.throws(() => v.validar(b), padrao);
  });
test("Backup: JSON inválido, UTF-8 inválido e limite 20 MB", () => {
  assert.throws(() => v.ler(Buffer.from("{")), /JSON/);
  assert.throws(() => v.ler(Buffer.from([255])), /codificação/);
  assert.throws(
    () => v.ler(Buffer.alloc(v.LIMITE + 1)),
    (e) =>
      e.status === 413 &&
      e.message === "Arquivo de backup excede o limite de 20 MB.",
  );
});
test("Backup: checksum independe da ordem de chaves e detecta metadados alterados", () => {
  const b = backup();
  const r = Object.fromEntries(Object.entries(b).reverse());
  assert.deepEqual(v.validar(r), b);
  b.backup.criado_em = "2026-09-22T10:00:00.000Z";
  assert.throws(() => v.validar(b), /Checksum/);
});
