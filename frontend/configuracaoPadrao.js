// Contrato comercial compartilhado pelo frontend e backend. Nunca contém credenciais.
const ConfiguracaoPadrao = (() => {
  const padrao = {
    nome_remetente: "Pedro Henrique",
    profissao_remetente: "desenvolvedor web",
    demo_academia_disponivel: false,
    demo_academia_url: "",
    demo_clinica_disponivel: false,
    demo_clinica_url: "",
    demo_estetica_disponivel: false,
    demo_estetica_url: "",
    leads_por_pagina: 25,
    tela_inicial: "dashboard",
  };
  function validar(entrada) {
    const erros = {},
      dados = {};
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada))
      return { dados, erros: { geral: "Informe as configurações." } };
    if (Object.keys(entrada).some((k) => !Object.hasOwn(padrao, k)))
      erros.geral = "Campo de configuração não permitido.";
    for (const k of ["nome_remetente", "profissao_remetente"]) {
      const v =
        typeof entrada[k] === "string"
          ? entrada[k].trim().replace(/\s+/g, " ")
          : "";
      if (
        !v ||
        v.length > 100 ||
        /[<>\x00-\x1f]/.test(v) ||
        /^(undefined|null)$/i.test(v)
      )
        erros[k] = "Informe um texto sem HTML, de 1 a 100 caracteres.";
      dados[k] = v;
    }
    for (const nicho of ["academia", "clinica", "estetica"]) {
      const flag = "demo_" + nicho + "_disponivel",
        url = "demo_" + nicho + "_url";
      if (typeof entrada[flag] !== "boolean")
        erros[flag] = "Escolha Sim ou Não.";
      dados[flag] = entrada[flag];
      dados[url] = typeof entrada[url] === "string" ? entrada[url].trim() : "";
      let valida = false;
      try {
        const u = new URL(dados[url]);
        valida =
          /^https?:\/\//i.test(dados[url]) &&
          ["http:", "https:"].includes(u.protocol) &&
          Boolean(u.hostname) &&
          !u.username &&
          !u.password &&
          !/[<>\s]/.test(dados[url]) &&
          dados[url].length <= 2048;
      } catch {}
      if (
        typeof entrada[url] !== "string" ||
        ((dados[url] || dados[flag]) && !valida)
      )
        erros[url] =
          "Informe uma URL válida começando com http:// ou https://.";
    }
    if (![25, 50, 100].includes(entrada.leads_por_pagina))
      erros.leads_por_pagina = "Escolha 25, 50 ou 100.";
    if (!["dashboard", "lista", "pipeline"].includes(entrada.tela_inicial))
      erros.tela_inicial = "Escolha Dashboard, Lista ou Pipeline.";
    dados.leads_por_pagina = entrada.leads_por_pagina;
    dados.tela_inicial = entrada.tela_inicial;
    return { dados, erros };
  }
  return { valores: () => ({ ...padrao }), validar };
})();
if (typeof module !== "undefined" && module.exports)
  module.exports = ConfiguracaoPadrao;
