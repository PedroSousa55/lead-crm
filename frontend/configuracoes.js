function criarConfiguracoes({
  document,
  fetch,
  base = "",
  confirmar,
  aoAplicar = () => {},
}) {
  const contrato =
    typeof module !== "undefined" && module.exports
      ? require("./configuracaoPadrao")
      : ConfiguracaoPadrao;
  const el = (id) => document.getElementById(id),
    keys = Object.keys(contrato.valores());
  let atual = contrato.valores(),
    pronto = false,
    ocupado = false;
  const aviso = (texto) => {
    el("config-feedback").textContent = texto;
  };
  function preencher() {
    for (const k of keys) el("config-" + k).value = String(atual[k]);
  }
  function erros(erros = {}) {
    for (const k of keys) {
      el("erro-config-" + k).textContent = erros[k] || "";
      el("config-" + k).setAttribute("aria-invalid", String(Boolean(erros[k])));
    }
  }
  function ler() {
    return Object.fromEntries(
      keys.map((k) => [
        k,
        k.endsWith("_disponivel")
          ? el("config-" + k).value === "true"
          : k === "leads_por_pagina"
            ? Number(el("config-" + k).value)
            : el("config-" + k).value,
      ]),
    );
  }
  async function requisitar(options) {
    const r = await fetch(base + "/api/configuracoes", {
        ...options,
        signal: AbortSignal.timeout(15000),
      }),
      data = await r.json();
    if (!r.ok) throw Object.assign(Error(data.erro), { campos: data.erros });
    const v = contrato.validar(data);
    if (Object.keys(v.erros).length) throw Error("Resposta inválida da API.");
    return v.dados;
  }
  async function carregar() {
    el("config-campos").disabled = true;
    try {
      atual = await requisitar();
      el("config-status-global").textContent = "";
      aviso("Configurações carregadas.");
    } catch {
      atual = contrato.valores();
      el("config-status-global").textContent =
        "Não foi possível carregar as configurações. Valores padrão seguros estão em uso. Confira a API/MySQL antes de salvar.";
      aviso("Valores padrão em uso por falha no carregamento.");
    } finally {
      preencher();
      pronto = true;
      el("config-campos").disabled = false;
      await aoAplicar({ ...atual });
    }
  }
  async function salvar(dados) {
    if (ocupado || !pronto) return;
    const v = contrato.validar(dados);
    erros(v.erros);
    if (Object.keys(v.erros).length) {
      aviso("Confira os campos indicados.");
      return;
    }
    ocupado = true;
    el("config-campos").disabled = true;
    try {
      atual = await requisitar({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v.dados),
      });
      preencher();
      await aoAplicar({ ...atual }, true);
      el("config-status-global").textContent = "";
      aviso("Configurações salvas.");
    } catch (e) {
      erros(e.campos);
      aviso("Não foi possível salvar as configurações. " + (e.message || ""));
    } finally {
      ocupado = false;
      el("config-campos").disabled = false;
    }
  }
  el("config-form").addEventListener("input", () =>
    aviso("Existem alterações não salvas."),
  );
  el("config-form").addEventListener("change", () =>
    aviso("Existem alterações não salvas."),
  );
  el("config-form").addEventListener("submit", (e) => {
    e.preventDefault();
    return salvar(ler());
  });
  el("config-padroes").addEventListener("click", () => {
    if (
      confirmar(
        "Restaurar e salvar os padrões comerciais e de preferências? Clientes e histórico não serão alterados.",
      )
    )
      return salvar(contrato.valores());
  });
  return { carregar, obter: () => ({ ...atual }), pronto: () => pronto };
}
if (typeof module !== "undefined" && module.exports)
  module.exports = { criarConfiguracoes };
