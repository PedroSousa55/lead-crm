const GeradorMensagens = (() => {
  const templates =
    typeof module !== "undefined" && module.exports
      ? require("./mensagemTemplates")
      : MensagemTemplates;
  const instagramValido =
    typeof module !== "undefined" && module.exports
      ? require("./instagram").urlInstagram
      : urlInstagram;
  const estrategias = Object.keys(templates.mensagens);
  function texto(value) {
    return typeof value === "string" &&
      !["null", "undefined"].includes(value.trim())
      ? value.trim().replace(/\s+/g, " ")
      : "";
  }
  function normalizar(value) {
    return texto(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }
  function categoria(nicho) {
    const n = normalizar(nicho);
    if (/\b(academia|academias)\b/.test(n)) return "academia";
    if (/\b(clinica|clinicas|fisioterapia|fisioterapeuta)\b/.test(n))
      return "clinica";
    if (/\b(estetica|nail|salao|saloes|manicure)\b/.test(n)) return "estetica";
    return "outros";
  }
  function ganchoApto(value) {
    if (
      typeof value !== "string" ||
      /[<>\x00-\x1F]|https?:|www\.|senha|segredo|confidencial|nota interna/i.test(
        value,
      )
    )
      return "";
    const limpo = texto(value);
    return limpo.length <= 240 && limpo.split(/\s+/).length <= 35 ? limpo : "";
  }
  function adaptarGancho(value) {
    const gancho = ganchoApto(value);
    if (!gancho)
      throw new Error(
        "Revise o gancho: use uma frase factual curta, sem links, marcação ou notas internas. Você também pode editar a mensagem manualmente.",
      );
    const n = normalizar(gancho).replace(/[.!]+$/, "");
    if (
      /^horarios (nos|aparecem nos|sao apresentados nos) destaques( do instagram)?$/.test(
        n,
      )
    ) {
      return (
        " Vi que vocês apresentam os horários nos destaques" +
        (n.endsWith("instagram") ? " do Instagram" : "") +
        "."
      );
    }
    if (/^(perfil possui|ha um) botao (de )?whatsapp( no perfil)?$/.test(n))
      return " Vi que vocês disponibilizam um botão de WhatsApp no perfil.";
    if (/^servicos apresentados (pelo|no) instagram$/.test(n))
      return " Vi que vocês usam o Instagram para apresentar os serviços.";
    throw new Error(
      "Não foi possível adaptar este gancho com segurança. Edite o contexto manualmente ou desmarque o uso do gancho.",
    );
  }
  function gerar(
    lead = {},
    estrategia = "automatica",
    { anterior = null, random = Math.random, usarGancho = false, configuracao = null } = {},
  ) {
    if ([1, "1", true].includes(lead.nao_contatar))
      throw new Error(
        "Cliente marcado como não contatar. Nova abordagem bloqueada.",
      );
    if (estrategia !== "automatica" && !estrategias.includes(estrategia))
      throw new Error("Selecione uma estratégia válida.");
    const grupo = categoria(lead.nicho);
    const demo = configuracao ? configuracao['demo_'+grupo+'_disponivel'] === true : templates.demos[grupo].demoDisponivel === true;
    if (estrategia === "demonstracao" && !demo)
      throw new Error("Nenhuma demonstração está configurada para este nicho.");
    const aptas = estrategias.filter((e) => e !== "demonstracao" || demo);
    // Memória curta por lead/rascunho; não altera nem grava o histórico de contatos.
    const recentes = [
      ...new Set(
        [...(anterior?.recentes || []), anterior?.variant_id].filter(Boolean),
      ),
    ].slice(-(aptas.length - 1));
    const candidatas = aptas.filter((e) => !recentes.includes(e + "_01"));
    const opcoes = candidatas.length
      ? candidatas
      : aptas.filter((e) => e + "_01" !== anterior?.variant_id);
    const efetiva =
      estrategia === "automatica"
        ? opcoes[
            Math.min(
              opcoes.length - 1,
              Math.max(0, Math.floor(random() * opcoes.length)),
            )
          ]
        : estrategia;
    const nome = texto(lead.nome_empresa) || "sua empresa";
    const local = [texto(lead.cidade), texto(lead.estado)]
      .filter(Boolean)
      .join(" - ");
    const referencia = nome + (local ? " (" + local + ")" : "");
    const instagram = Boolean(instagramValido(lead.instagram));
    const semSite = [0, "0", false].includes(lead.possui_site);
    const remetente = configuracao ? {nome:configuracao.nome_remetente,profissao:configuracao.profissao_remetente,atividade:templates.remetente.atividade} : templates.remetente;
    const contexto = {
      remetente,
      instagram,
      demo,
      nicho:
        templates.nichos[
          /\b(salao|saloes)\b/.test(normalizar(lead.nicho)) ? "salao" : grupo
        ],
      encontro: instagram
        ? "Encontrei o perfil de " + referencia + " no Instagram."
        : "Entro em contato sobre " + referencia + ".",
      ausencia: semSite ? " Não localizei um site próprio." : "",
      gancho: usarGancho ? adaptarGancho(lead.gancho_verificado) : "",
      apresentacao:
        "Meu nome é " + remetente.nome + ", sou " + remetente.profissao + ".",
      apresentacaoAtividade: configuracao && remetente.profissao !== templates.remetente.profissao ? "Meu nome é " + remetente.nome + ", sou " + remetente.profissao + "." :
        "Meu nome é " +
        remetente.nome +
        " e trabalho com " +
        remetente.atividade +
        ".",
    };
    const variant_id = efetiva + "_01";
    return {
      estrategia: efetiva,
      variant_id,
      recentes: [
        ...recentes.filter((id) => id !== variant_id),
        variant_id,
      ].slice(-aptas.length),
      texto: templates.mensagens[efetiva](contexto),
    };
  }
  return { gerar, ganchoApto };
})();
if (typeof module !== "undefined" && module.exports)
  module.exports = GeradorMensagens;
