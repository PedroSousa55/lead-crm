function criarSeletorLocalidades({ document, estado, cidade, busca, aviso }) {
  function option(valor, texto) {
    const o = document.createElement("option");
    o.value = valor;
    o.textContent = texto;
    return o;
  }
  estado.replaceChildren(
    option("", "Selecione o estado"),
    ...Localidades.estados.map((e) => option(e.uf, e.nome + " (" + e.uf + ")")),
  );
  let selecionada = "";
  function carregar() {
    const uf = Localidades.normalizarUF(estado.value);
    cidade.disabled = !uf;
    busca.disabled = !uf;
    const itens = Localidades.cidades(uf, busca.value);
    // A pesquisa não apaga uma seleção já feita: ela permanece identificada na lista.
    const atual = Localidades.cidades(uf).find((m) => m.nome === selecionada);
    const visiveis =
      atual && !itens.includes(atual) ? [atual, ...itens] : itens;
    cidade.replaceChildren(
      option("", uf ? "Selecione a cidade" : "Selecione primeiro o estado"),
      ...visiveis.map((m) => option(m.nome, m.nome)),
    );
    cidade.value = selecionada;
    if (uf && !itens.length)
      aviso.textContent = "Nenhum município encontrado para essa busca.";
    else aviso.textContent = "";
  }
  function limpar() {
    estado.value = "";
    selecionada = "";
    busca.value = "";
    estado.setCustomValidity("");
    cidade.setCustomValidity("");
    carregar();
  }
  function preencher(uf, nome) {
    limpar();
    const r = Localidades.normalizar(uf, nome);
    estado.value = r.dados.estado || "";
    selecionada = r.dados.cidade || "";
    carregar();
    if (Object.keys(r.erros).length) {
      aviso.textContent =
        "Localidade antiga precisa de revisão: " +
        String(uf || "sem estado") +
        " / " +
        String(nome || "sem cidade") +
        ". Os dados originais não foram alterados.";
      estado.setCustomValidity("Revise a localidade antiga antes de salvar.");
    }
  }
  estado.addEventListener("change", () => {
    selecionada = "";
    busca.value = "";
    estado.setCustomValidity("");
    cidade.setCustomValidity("");
    carregar();
  });
  cidade.addEventListener("change", () => {
    selecionada = cidade.value;
    cidade.setCustomValidity("");
    if (Localidades.normalizarUF(estado.value)) {
      estado.setCustomValidity("");
      aviso.textContent = "";
    }
  });
  busca.addEventListener("input", carregar);
  limpar();
  return { limpar, preencher };
}
if (typeof module !== "undefined" && module.exports)
  module.exports = { criarSeletorLocalidades };
