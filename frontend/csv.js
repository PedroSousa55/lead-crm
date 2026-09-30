(() => {
  const arquivo = document.getElementById('csv-arquivo');
  const mensagem = document.getElementById('csv-mensagem');
  const previa = document.getElementById('csv-previa');
  const resultado = document.getElementById('csv-resultado');
  const cancelar = document.getElementById('csv-cancelar');
  const importar = document.getElementById('csv-importar');
  const abaCampo = document.getElementById('csv-aba-campo');
  const abaSelect = document.getElementById('csv-aba');
  let abaAtual = null, pronto = false;
  let selecionado = null, geracao = 0, enviando = false, request = null;
  function avisar(texto, erro = false) {
    mensagem.textContent = texto;
    mensagem.className = erro ? 'erro' : '';
  }
  function limpar() {
    geracao++;
    request?.abort();
    selecionado = null;
    abaAtual = null;
    pronto = false;
    abaCampo.hidden = true;
    abaSelect.replaceChildren();
    arquivo.value = '';
    previa.hidden = true;
    cancelar.hidden = true;
    resultado.hidden = true;
    avisar('');
  }
  async function enviar(file, caminho, signal) {
    let response;
    try {
      const tipo = /\.xlsx$/i.test(file.name) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : /\.xlsm$/i.test(file.name) ? 'application/vnd.ms-excel.sheet.macroEnabled.12' : 'text/csv; charset=utf-8';
      const query = abaAtual === null ? '' : '?aba=' + encodeURIComponent(abaAtual);
      response = await fetch(API_BASE_URL + '/api/clientes/importacao' + caminho + query, {
        method: 'POST', headers: { 'Content-Type': tipo, 'X-CSV-Name': encodeURIComponent(file.name) },
        body: file, signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('Não foi possível acessar a API. Atualize a lista antes de tentar novamente.');
    }
    let data;
    try { data = await response.json(); } catch { throw new Error('A API retornou uma resposta inválida.'); }
    if (!response.ok) throw new Error(data.erro || 'Não foi possível importar o arquivo.');
    return data;
  }
  async function consultarPrevia(file) {
    pronto = false;
    previa.hidden = true;
    request?.abort();
    const atual = ++geracao;
    request = new AbortController();
    avisar('Validando ' + file.name + '…');
    try {
      const data = await enviar(file, '/previa', request.signal);
      if (atual !== geracao) return;
      selecionado = file;
      if (data.abas) {
        abaSelect.replaceChildren();
        const escolha = document.createElement('option');
        escolha.value = ''; escolha.textContent = 'Selecione a aba';
        abaSelect.append(escolha);
        for (const aba of data.abas) {
          const option = document.createElement('option');
          option.value = aba.nome;
          option.textContent = aba.nome + (aba.valida ? ' — ' + aba.registros + ' registro(s)' : ' — ' + aba.motivo);
          option.disabled = !aba.valida;
          abaSelect.append(option);
        }
        abaCampo.hidden = false;
        abaAtual = data.aba ?? null;
        abaSelect.value = abaAtual ?? '';
      }
      if (data.requerAba) { avisar('Escolha a aba que contém os leads para conferir a prévia.'); return; }
      mostrarPrevia(file, data);
      pronto = true;
    } catch (error) {
      if (atual === geracao && error.name !== 'AbortError') avisar(error.message, true);
    }
  }
  arquivo.addEventListener('change', async () => {
    if (enviando) return;
    const file = arquivo.files[0];
    limpar();
    if (!file) return;
    cancelar.hidden = false;
    const limite = /\.csv$/i.test(file.name) ? 1024 * 1024 : 5 * 1024 * 1024;
    if (!/\.(csv|xlsx|xlsm)$/i.test(file.name) || !file.size || file.size > limite) {
      avisar('Selecione CSV de até 1 MB ou XLSX/XLSM de até 5 MB, não vazio.', true);
      return;
    }
    await consultarPrevia(file);
  });
  abaSelect.addEventListener('change', async () => {
    if (enviando || !selecionado) return;
    abaAtual = abaSelect.value || null;
    pronto = false;
    previa.hidden = true;
    if (abaAtual === null) { geracao++; request?.abort(); return; }
    await consultarPrevia(selecionado);
  });
  function mostrarPrevia(file, data) {
      document.getElementById('csv-resumo').textContent = file.name + (data.aba ? ' / ' + data.aba : '') + ' — ' + data.processados +
        ' registro(s), ' + data.validos + ' válido(s), ' + data.invalidos + ' inválido(s), ' + data.descartados + ' ignorado(s) por possuir site.';
      const linhas = document.getElementById('csv-registros');
      linhas.replaceChildren();
      for (const registro of data.previa) {
        const tr = document.createElement('tr');
        for (const valor of [registro.linha, registro.dados.nome_empresa, registro.dados.telefone,
          registro.dados.possui_site === 1 ? 'Sim' : registro.dados.possui_site === 0 ? 'Não' : 'Não informado', registro.motivos.join(' ') || 'Válido']) {
          const td = document.createElement('td');
          td.textContent = valor ?? '';
          tr.append(td);
        }
        linhas.append(tr);
      }
      previa.hidden = false;
      avisar('Confira a prévia e confirme para importar.');
  }
  cancelar.addEventListener('click', () => { if (!enviando) limpar(); });
  importar.addEventListener('click', async () => {
    if (!selecionado || !pronto || enviando || ocupado) return;
    const file = selecionado;
    enviando = true;
    arquivo.disabled = true;
    abaSelect.disabled = true;
    await executar(async () => {
      avisar('Importando clientes…');
      try {
        const data = await enviar(file, '', AbortSignal.timeout(60000));
        selecionado = null;
        pronto = false;
        abaCampo.hidden = true;
        previa.hidden = true;
        cancelar.hidden = true;
        arquivo.value = '';
        document.getElementById('csv-totais').textContent =
          'Processados: ' + data.processados + '\nImportados: ' + data.importados +
          '\nDuplicados: ' + data.duplicados + '\nInválidos: ' + data.invalidos + '\nIgnorados (possui site): ' + data.descartados;
        const detalhes = document.getElementById('csv-ignorados');
        detalhes.replaceChildren();
        for (const registro of data.ignorados) {
          const li = document.createElement('li');
          li.textContent = 'Linha ' + registro.linha + ' — ' + ({ duplicado: 'Duplicado', invalido: 'Inválido', descartado: 'Ignorado' }[registro.tipo]) +
            ': ' + registro.motivos.join(' ');
          detalhes.append(li);
        }
        resultado.hidden = false;
        avisar('Importação concluída.');
        try { await carregarClientes(); }
        catch { avisar('Importação concluída. A lista não pôde ser atualizada; clique em Atualizar lista.', true); }
      } catch (error) {
        avisar(error.name === 'TimeoutError' || error.name === 'AbortError'
          ? 'A resposta demorou. Atualize a lista antes de tentar novamente; telefones já importados serão ignorados.'
          : error.message, true);
      }
    });
    enviando = false;
    arquivo.disabled = false;
    abaSelect.disabled = false;
  });
})();
