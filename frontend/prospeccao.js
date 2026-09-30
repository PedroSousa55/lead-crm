function criarProspeccao({ document, gerarMensagem, gerarLink, abrirJanela, marcarContato, aoAtualizar,
  confirmar, consultarLead, listarHistorico, atualizarResultado, bloquearContato, salvarFollowup }) {
  const dataBR=typeof module!=='undefined'&&module.exports?require('./datas').formatar:DataCRM.formatar;
  const el = id => document.getElementById(id);
  const estrategia = el('prospeccao-estrategia'), mensagem = el('prospeccao-mensagem');
  const gerar = el('prospeccao-gerar'), marcar = el('prospeccao-contatado');
  const usarGancho = el('prospeccao-usar-gancho');
  const rotulos = { curiosidade: 'Curiosidade', beneficio: 'Benefício (anterior)', problema: 'Problema (anterior)', oportunidade: 'Oportunidade', problema_sutil: 'Problema sutil', visualizacao: 'Benefício / Visualização', demonstracao: 'Demonstração', autoridade: 'Autoridade leve', direta: 'Direta', pergunta: 'Pergunta', manual: 'Manual' };
  const resultados = { aguardando_resposta: 'Aguardando resposta', respondeu: 'Respondeu', interessado: 'Interessado', nao_interessado: 'Não interessado', negociacao: 'Negociação', fechado: 'Fechado', nao_contatar: 'Não contatar' };
  let lead = null, anterior = null, salvando = false, abrindo = false, leitura = 0;
  const bloqueado = cliente => [1, '1', true].includes(cliente?.nao_contatar);
  function contar() { el('prospeccao-contador').textContent = Array.from(mensagem.value).length + ' caracteres'; }
  function feedback(texto, erro = false) { el('prospeccao-aviso').textContent = texto; el('prospeccao-aviso').className = erro ? 'erro' : 'sucesso'; }
  function selecionarLead(cliente) {
    if (!lead || lead.id !== cliente.id) {
      mensagem.value = ''; anterior = null; estrategia.value = 'automatica';
      gerar.textContent = 'Gerar mensagem'; el('prospeccao-usada').textContent = '';
      el('historico-lista').replaceChildren(); leitura++;
      feedback(''); contar();
    }
    if (!lead || lead.id !== cliente.id || lead.gancho_verificado !== cliente.gancho_verificado) usarGancho.checked = false;
    if (!lead || lead.id !== cliente.id || lead.proximo_contato_em !== cliente.proximo_contato_em || lead.proxima_acao !== cliente.proxima_acao) {
      el('followup-data').value = (cliente.proximo_contato_em || '').replace(' ','T').slice(0,16);
      el('followup-acao').value = cliente.proxima_acao || '';
      el('prospeccao-agendar').checked = false;
    }
    lead = { ...cliente };
    el('prospeccao-gancho-campo').hidden = !cliente.gancho_verificado;
    el('prospeccao-gancho-texto').textContent = cliente.gancho_verificado || '';
    el('prospeccao-bloqueio').hidden = !bloqueado(lead);
    gerar.disabled = bloqueado(lead);
  }
  mensagem.addEventListener('input', contar);
  gerar.addEventListener('click', () => {
    if (!lead) return;
    if (bloqueado(lead)) return feedback('Cliente marcado como não contatar. Nova abordagem bloqueada.', true);
    try {
      const nova = gerarMensagem(lead, estrategia.value, { anterior, usarGancho: usarGancho.checked === true });
      anterior = nova; mensagem.value = nova.texto;
      gerar.textContent = estrategia.value === 'automatica' ? 'Gerar outra abordagem' : 'Gerar novamente';
      el('prospeccao-usada').textContent = 'Estratégia usada: ' + rotulos[nova.estrategia];
      contar(); feedback('Mensagem gerada. Revise o texto antes de abrir o WhatsApp.');
    } catch (error) { feedback(error.message, true); }
  });
  el('prospeccao-abrir').addEventListener('click', async () => {
    if (!lead || abrindo) return;
    const id = lead.id;
    abrindo = true;
    try {
      // Consulta atual evita ignorar um bloqueio registrado em outra aba do CRM.
      const atual = await consultarLead(id);
      if (lead?.id !== id) return;
      selecionarLead(atual);
      if (bloqueado(atual) && !confirmar('Este cliente está marcado como NÃO CONTATAR. Deseja abrir o WhatsApp excepcionalmente? O bloqueio continuará ativo.')) return;
      const link = gerarLink(atual.telefone, mensagem.value);
      abrirJanela(link, '_blank', 'noopener,noreferrer');
      feedback('O link foi aberto em nova aba. Envie manualmente no WhatsApp e depois marque o contato aqui.');
    } catch (error) { if (lead?.id === id) feedback(error.message, true); }
    finally { abrindo = false; }
  });
  async function carregarHistorico() {
    if (!lead) return false;
    const id = lead.id, tentativa = ++leitura;
    el('historico-aviso').textContent = 'Carregando histórico…';
    try {
      const contatos = await listarHistorico(id);
      if (lead?.id !== id || tentativa !== leitura) return false;
      if (!Array.isArray(contatos)) throw new Error('Histórico inválido.');
      el('historico-lista').replaceChildren();
      for (const contato of contatos) {
        const item = document.createElement('li');
        const titulo = document.createElement('p');
        titulo.textContent = dataBR(contato.data_contato) + ' · WhatsApp · ' + (rotulos[contato.estrategia] || contato.estrategia);
        const resposta = document.createElement('p');
        resposta.textContent = contato.data_resposta ? 'Resposta registrada em: ' + dataBR(contato.data_resposta) : 'Sem resposta registrada.';
        const detalhes = document.createElement('details'), resumo = document.createElement('summary'), texto = document.createElement('pre');
        resumo.textContent = 'Mensagem registrada'; texto.textContent = contato.mensagem;
        detalhes.append(resumo, texto);
        const label = document.createElement('label'), select = document.createElement('select');
        label.textContent = 'Resultado: ';
        for (const [valor, nome] of Object.entries(resultados)) {
          const option = document.createElement('option'); option.value = valor; option.textContent = nome; select.append(option);
        }
        select.value = contato.resultado; label.append(select);
        const salvar = document.createElement('button'); salvar.type = 'button'; salvar.textContent = 'Salvar resultado'; salvar.className = 'secundario';
        salvar.addEventListener('click', async () => {
          if (salvando || lead?.id !== id) return;
          salvando = true; salvar.disabled = true;
          try {
            const atualizado = await atualizarResultado(id, contato.id, select.value);
            if (lead?.id === id) selecionarLead(atualizado);
            await atualizarTela(atualizado, 'Resultado atualizado.', 'Resultado salvo, mas a lista não pôde ser atualizada.');
          } catch (error) { if (lead?.id === id) feedback(error.message, true); }
          finally { salvando = false; salvar.disabled = false; }
        });
        item.append(titulo, detalhes, resposta, label, salvar); el('historico-lista').append(item);
      }
      el('historico-aviso').textContent = contatos.length ? contatos.length + ' contato(s) registrado(s).' : 'Nenhum contato registrado ainda.';
      return true;
    } catch {
      if (lead?.id === id && tentativa === leitura) el('historico-aviso').textContent = 'Não foi possível atualizar o histórico. Clique em Atualizar histórico antes de repetir uma gravação.';
      return false;
    }
  }
  async function atualizarTela(atualizado, sucesso, falhaLista) {
    let listaOk = true;
    try { await aoAtualizar(atualizado); } catch { listaOk = false; }
    if (lead?.id !== atualizado.id) return;
    const historicoOk = await carregarHistorico();
    if (lead?.id !== atualizado.id) return;
    feedback(!listaOk ? falhaLista : !historicoOk ? sucesso + ' O histórico não pôde ser atualizado; confira antes de repetir.' : sucesso, !listaOk || !historicoOk);
  }
  marcar.addEventListener('click', async () => {
    if (!lead || salvando) return;
    if (!mensagem.value.trim() || Array.from(mensagem.value).length > 10000) return feedback('Informe a mensagem utilizada, com até 10.000 caracteres.', true);
    const id = lead.id;
    const confirmacao = bloqueado(lead) && confirmar('Cliente marcado como NÃO CONTATAR. Registrar excepcionalmente este contato manual? O bloqueio continuará ativo.');
    if (bloqueado(lead) && !confirmacao) return;
    // Captura no clique. Mudar o seletor não muda a origem da última geração.
    const dados = { mensagem: mensagem.value, estrategia: anterior?.estrategia || 'manual', variant_id: anterior?.variant_id || null, confirmar_nao_contatar: Boolean(confirmacao) };
    if (el('prospeccao-agendar').checked) Object.assign(dados, {proximo_contato_em:el('followup-data').value || null,proxima_acao:el('followup-acao').value || null});
    salvando = true; marcar.disabled = true; feedback('Registrando contato…');
    try {
      const atualizado = await marcarContato(id, dados);
      if (lead?.id === id) selecionarLead(atualizado);
      await atualizarTela(atualizado, 'Cliente marcado como contatado. Mensagem e data registradas no histórico.', 'Contato registrado, mas a lista não pôde ser atualizada. Clique em Atualizar lista.');
    } catch (error) { if (lead?.id === id) feedback(error.message, true); }
    finally { salvando = false; marcar.disabled = false; }
  });
  el('prospeccao-nao-contatar').addEventListener('click', async () => {
    if (!lead || salvando || !confirmar('Marcar este cliente como NÃO CONTATAR e bloquear novas abordagens?')) return;
    const id = lead.id; salvando = true;
    try {
      const atualizado = await bloquearContato(id);
      if (lead?.id === id) selecionarLead(atualizado);
      await atualizarTela(atualizado, 'Cliente marcado como não contatar.', 'Bloqueio salvo, mas a lista não pôde ser atualizada.');
    } catch (error) { if (lead?.id === id) feedback(error.message, true); }
    finally { salvando = false; }
  });
  el('followup-salvar').addEventListener('click', async () => {
    if(!lead || salvando)return;
    const id=lead.id;salvando=true;el('followup-salvar').disabled=true;
    try {
      const atualizado=await salvarFollowup(id,{proximo_contato_em:el('followup-data').value || null,proxima_acao:el('followup-acao').value || null});
      if(lead?.id===id)selecionarLead(atualizado);
      await atualizarTela(atualizado,'Follow-up salvo. O envio continua manual.','Follow-up salvo, mas a lista não pôde ser atualizada.');
    }catch(error){if(lead?.id===id)feedback(error.message,true);}
    finally{salvando=false;el('followup-salvar').disabled=false;}
  });
  el('historico-atualizar').addEventListener('click', carregarHistorico);
  return { selecionarLead, carregarHistorico, idSelecionado: () => lead?.id };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { criarProspeccao };

