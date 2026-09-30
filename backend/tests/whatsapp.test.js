const { test } = require("node:test");
const assert = require("node:assert/strict");
const { telefoneParaLink, gerarLink } = require("../../frontend/whatsapp");
test("WhatsApp: telefone brasileiro normal, formatado, fixo e prefixo existente", () => {
  for (const value of [
    "31997150594",
    "(31) 99715-0594",
    "+55 (31) 99715-0594",
    "5531997150594",
  ]) {
    assert.equal(telefoneParaLink(value), "5531997150594");
  }
  assert.equal(telefoneParaLink("3133334444"), "553133334444");
  assert.equal(telefoneParaLink("55997150594"), "5555997150594"); // DDD 55 nacional, não prefixo internacional.
  assert.equal(telefoneParaLink("5555997150594"), "5555997150594");
});
test("WhatsApp: telefones e mensagens inválidos são rejeitados", () => {
  for (const value of [
    "",
    null,
    "123",
    "00000000000",
    "11111111111",
    "31997150594abc",
    "1231997150594",
    "0031997150594",
    "31097150594",
  ]) {
    assert.throws(() => gerarLink(value, "Oi!"), /telefone brasileiro válido/);
  }
  for (const message of ["", " \n ", null])
    assert.throws(() => gerarLink("31997150594", message), /mensagem/);
});
test("WhatsApp: codifica exatamente espaços, acentos, quebras e caracteres especiais", () => {
  const mensagem = "  Olá! Tudo bem?\nIdeia para você: A&B + 10% #🙂  ";
  const link = gerarLink("31997150594", mensagem);
  assert.equal(
    link,
    "https://wa.me/5531997150594?text=" + encodeURIComponent(mensagem),
  );
  assert.equal(new URL(link).searchParams.get("text"), mensagem);
  assert.equal(new URL(link).hostname, "wa.me");
});
