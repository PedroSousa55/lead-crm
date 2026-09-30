// Para um frontend servido por outro servidor HTTP local, informe a URL da API.
const API_BASE_URL = "";
const STATUS = {
  nao_contatado: "Não contatado",
  contatado: "Contatado / aguardando resposta",
  respondeu: "Respondeu",
  nao_contatar: "Não contatar",
  interessado: "Interessado",
  sem_resposta: "Contatado / aguardando resposta",
  negociacao: "Negociação",
  fechado: "Fechado",
  descartado: "Não interessado",
};
const ROTULOS = {
  nome_empresa: "Empresa",
  telefone: "Telefone",
  nicho: "Nicho",
  cidade: "Cidade",
  estado: "Estado",
  instagram: "Instagram",
  possui_site: "Possui site?",
  status: "Status",
  observacoes: "Observações",
  gancho_verificado: "Gancho verificado",
  id: "ID",
  ultima_data_contato: "Último contato",
  proximo_contato_em: "Próximo contato",
  proxima_acao: "Próxima ação",
  ultimo_resultado: "Resultado do último contato",
  created_at: "Cadastrado em",
  updated_at: "Atualizado em",
};
const formulario = document.getElementById("formulario");
const localidadesForm = criarSeletorLocalidades({document,estado:formulario.elements.namedItem('estado'),cidade:formulario.elements.namedItem('cidade'),busca:document.getElementById('cliente-cidade-busca'),aviso:document.getElementById('cliente-localidade-aviso')});
let editandoId = null;
let ocupado = false;

function feedback(texto, erro = false) {
  const mensagem = document.getElementById("mensagem");
  mensagem.textContent = texto;
  mensagem.className = erro ? "erro" : "sucesso";
}
async function requisitar(caminho = "", options = {}) {
  let response;
  try {
    response = await fetch(API_BASE_URL + "/api/clientes" + caminho, {
      ...options,
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error(
      "Não foi possível acessar a API. Verifique a conexão e atualize a lista antes de tentar novamente.",
    );
  }
  if (response.status === 204) return null;
  let dados;
  try {
    dados = await response.json();
  } catch {
    throw new Error("A API retornou uma resposta inválida.");
  }
  if (!response.ok) {
    const campos = Object.entries(dados.campos || {}).map(
      ([campo, erro]) => (ROTULOS[campo] || campo) + ": " + erro,
    );
    throw Object.assign(new Error([dados.erro || "Ocorreu um erro na API.", ...campos].join(" ")),{campos:dados.campos});
  }
  return dados;
}
async function executar(acao) {
  if (ocupado) return;
  ocupado = true;
  document.getElementById("filtros-campos").disabled = true;
  document.getElementById("campos").disabled = true;
  document.querySelectorAll("button:not(#area-dados button):not(#area-configuracoes button)").forEach((botao) => {
    botao.disabled = true;
  });
  try {
    await acao();
  } catch (error) {
    feedback(error.message, true);
    if(document.getElementById('cadastro-dialog').open){document.getElementById('cadastro-feedback').textContent=error.message;InterfaceCRM.errosFormulario(document,error.campos);}
  } finally {
    ocupado = false;
    document.getElementById("filtros-campos").disabled = false;
    document.getElementById("campos").disabled = false;
    document.querySelectorAll("button:not(#area-dados button):not(#area-configuracoes button)").forEach((botao) => {
      botao.disabled = false;
    });
    pipeline.atualizarBotoes();
  }
}
function limparFormulario() {
  editandoId = null;
  InterfaceCRM.fecharCadastro(document);InterfaceCRM.errosFormulario(document);document.getElementById('cadastro-feedback').textContent='';
  formulario.reset();
  localidadesForm.limpar();
  document.getElementById("titulo-formulario").textContent =
    "Cadastrar cliente";
  document.getElementById("salvar").textContent = "Cadastrar cliente";
  document.getElementById("cancelar").hidden = true;
}
function botao(texto, acao, classe = "secundario") {
  const elemento = document.createElement("button");
  elemento.type = "button";
  elemento.textContent = texto;
  elemento.className = classe;
  elemento.addEventListener("click", () => executar(acao));
  return elemento;
}
async function carregarClientes() { await pipeline.carregar(); }
function criarItemCliente(cliente, agora) {
      const item = document.createElement("li");
      const nome = document.createElement("strong");
      nome.textContent = cliente.nome_empresa;
      const resumo = document.createElement("p");
      resumo.textContent = [
        cliente.nicho,
        cliente.telefone,
        cliente.cidade,
        cliente.estado,

      ]
        .filter(Boolean)
        .join(" · ");
      const acoes = document.createElement("div");
      acoes.className = "acoes acoes-lead";
      acoes.append(
        botao("Visualizar", () => visualizar(cliente.id)),
        botao("Editar / status", () => editar(cliente.id)),
        botao("Excluir", () => excluir(cliente), "excluir"),
      );
      const status=document.createElement('span');status.className='lead-status '+(cliente.nao_contatar?'nao_contatar':cliente.status);status.textContent=cliente.nao_contatar?'Não contatar':STATUS[cliente.status]||cliente.status;resumo.append(document.createElement('br'),status);
      item.append(nome, resumo, acoes);
      if(cliente.ultima_data_contato){const ultimo=document.createElement('p');ultimo.textContent='Último contato: '+DataCRM.formatar(cliente.ultima_data_contato);ultimo.className='followup-lead';item.append(ultimo);}
      if (cliente.proximo_contato_em) {
        const followup = document.createElement('p');
        const ativo = !cliente.nao_contatar && !['fechado','nao_contatar'].includes(cliente.status);
        const atrasado = ativo && cliente.proximo_contato_em < agora;
        followup.textContent = (atrasado ? 'Follow-up atrasado · ' : 'Próximo contato: ') + DataCRM.formatar(cliente.proximo_contato_em) + (cliente.proxima_acao ? ' · '+cliente.proxima_acao : '');
        followup.className='followup-lead'+(atrasado?' erro':'');item.append(followup);
      }
      return item;
}
function renderizarDetalhes(cliente) {
  const dados = document.getElementById("dados-cliente");
  dados.replaceChildren();
  for (const [campo, rotulo] of Object.entries(ROTULOS)) {
    const termo = document.createElement("dt");
    const valor = document.createElement("dd");
    termo.textContent = rotulo;
    valor.textContent =
      campo === "possui_site"
        ? cliente[campo] === 1
          ? "Sim"
          : cliente[campo] === 0
            ? "Não"
            : "Não informado"
        : (campo === "status" ? (cliente.nao_contatar ? 'Não contatar' : STATUS[cliente[campo]]) : campo === 'ultimo_resultado' ? ({aguardando_resposta:'Aguardando resposta',respondeu:'Respondeu',interessado:'Interessado',nao_interessado:'Não interessado',negociacao:'Negociação',fechado:'Fechado',nao_contatar:'Não contatar'}[cliente[campo]]) : cliente[campo]) ||
          "Não informado";
    const perfil = campo === "instagram" ? urlInstagram(cliente[campo]) : null;
    if (perfil) {
      const link = document.createElement("a");
      link.href = perfil;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Abrir Instagram";
      link.title = perfil;
      valor.replaceChildren(link);
    }
    if(['ultima_data_contato','proximo_contato_em','created_at','updated_at'].includes(campo))valor.textContent=DataCRM.formatar(valor.textContent);
    dados.append(termo, valor);
  }
}
async function visualizar(id) {
  const cliente = await requisitar("/" + id);
  renderizarDetalhes(cliente);
  prospeccao.selecionarLead(cliente);
  document.getElementById("detalhes").showModal();
  await prospeccao.carregarHistorico();
}
async function editar(id) {
  const cliente = await requisitar("/" + id);
  limparFormulario();
  editandoId = id;
  for (const campo of Object.keys(ROTULOS)) {
    const input = formulario.elements.namedItem(campo);
    if (input && !['estado','cidade'].includes(campo)) input.value = campo === 'proximo_contato_em' ? (cliente[campo] || '').replace(' ','T').slice(0,16) : String(cliente[campo] ?? '');
  }
  localidadesForm.preencher(cliente.estado,cliente.cidade);
  document.getElementById("titulo-formulario").textContent = "Editar cliente";
  document.getElementById("salvar").textContent = "Salvar alterações";
  document.getElementById("cancelar").hidden = false;
  InterfaceCRM.abrirCadastro(document);
}
async function atualizarAposSalvar(texto) {
  feedback(texto);
  try {
    await carregarClientes();
  } catch {
    feedback(
      texto +
        " Porém, a lista não pôde ser atualizada. Clique em Atualizar lista.",
      true,
    );
  }
}
async function excluir(cliente) {
  if (
    !window.confirm(
      'Excluir o cliente "' +
        cliente.nome_empresa +
        '" e seu histórico de prospecção? Esta ação não pode ser desfeita.',
    )
  )
    return;
  await requisitar("/" + cliente.id, { method: "DELETE" });
  if (editandoId === cliente.id) limparFormulario();
  await atualizarAposSalvar("Cliente excluído com sucesso.");
}
formulario.addEventListener("submit", (event) => {
  event.preventDefault();
  if (ocupado || !formulario.reportValidity()) return;
  InterfaceCRM.errosFormulario(document);document.getElementById('cadastro-feedback').textContent='';
  // Captura antes de desabilitar o fieldset, pois campos desabilitados não entram no FormData.
  const dados = Object.fromEntries(new FormData(formulario));
  dados.possui_site =
    dados.possui_site === "" ? null : Number(dados.possui_site);
  return executar(async () => {
    const editando = editandoId !== null;
    await requisitar(editando ? "/" + editandoId : "", {
      method: editando ? "PUT" : "POST",
      body: JSON.stringify(dados),
    });
    limparFormulario();
    await atualizarAposSalvar(
      editando
        ? "Cliente atualizado com sucesso."
        : "Cliente cadastrado com sucesso.",
    );
  });
});
document.getElementById("cancelar").addEventListener("click", limparFormulario);
document.getElementById("atualizar").addEventListener("click", () =>
  executar(async () => {
    await carregarClientes();
    feedback("Lista atualizada.");
  }),
);
const pipeline = criarPipeline({ document, requisitar, executar, criarItem: criarItemCliente });
const prospeccao = criarProspeccao({
  document,
  gerarMensagem: (lead,estrategia,opcoes)=>{if(configuracoesCRM&&!configuracoesCRM.pronto())throw Error('Aguarde o carregamento das configurações.');return GeradorMensagens.gerar(lead,estrategia,{...opcoes,configuracao:configuracoesCRM?.obter()});},
  gerarLink: WhatsApp.gerarLink,
  abrirJanela: (...args) => window.open(...args),
  confirmar: (texto) => window.confirm(texto),
  consultarLead: (id) => requisitar('/' + id),
  listarHistorico: (id) => requisitar('/' + id + '/prospeccoes'),
  marcarContato: (id, dados) => requisitar('/' + id + '/contato', { method: 'POST', body: JSON.stringify(dados) }),
  atualizarResultado: (id, contatoId, resultado) => requisitar('/' + id + '/prospeccoes/' + contatoId, { method: 'PUT', body: JSON.stringify({ resultado }) }),
  salvarFollowup: (id,dados) => requisitar('/'+id+'/followup',{method:'PUT',body:JSON.stringify(dados)}),
  bloquearContato: (id) => requisitar('/' + id + '/nao-contatar', { method: 'POST' }),
  aoAtualizar: async (cliente) => {
    if (prospeccao.idSelecionado() === cliente.id) renderizarDetalhes(cliente);
    await carregarClientes();
  },
});
const configuracoesCRM=typeof criarConfiguracoes==='function'?criarConfiguracoes({document,fetch,base:API_BASE_URL,confirmar:msg=>window.confirm(msg),aoAplicar:async(c,salvo)=>{pipeline.definirPadrao(c.leads_por_pagina);if(salvo)await executar(carregarClientes);}}):null;
const inicializacao=configuracoesCRM?configuracoesCRM.carregar().then(()=>executar(carregarClientes)):executar(carregarClientes);

document.getElementById('novo-lead').addEventListener('click',()=>{limparFormulario();InterfaceCRM.abrirCadastro(document);});
document.getElementById('cadastro-fechar').addEventListener('click',()=>InterfaceCRM.fecharCadastro(document));
document.getElementById('importar-abrir').addEventListener('click',()=>{const p=document.getElementById('importacao-painel');p.open=true;p.scrollIntoView({block:'start'});document.getElementById('csv-arquivo').focus?.();});
