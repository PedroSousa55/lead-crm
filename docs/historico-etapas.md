# Lead CRM

## Etapa 6 — pipeline, filtros e follow-up manual

O fluxo é manual: gerar → revisar/editar → abrir WhatsApp → enviar manualmente → marcar como contatado → registrar resultado. Abrir WhatsApp consulta o bloqueio atual e abre o link; não grava contato, status ou data.

### Banco

A migração aditiva foi aplicada no banco local: `gancho_verificado TEXT NULL`, `nao_contatar TINYINT(1) NOT NULL DEFAULT 0` e tabela `prospeccoes`. Dados antigos e ultima_data_contato foram preservados; nenhum histórico passado foi inventado.

Para outra instalação existente, execute dentro de backend: `npm run migrate:prospeccao`. O comando verifica as colunas e pode ser reaplicado. SQL equivalente: `database/migrations/003_motor_prospeccao.sql`. Não repita os ALTER TABLE avulsos se as colunas já existirem. Para bancos novos, schema.sql já inclui a estrutura. Nenhum DROP é necessário; a coluna antiga site permanece sem uso.

### Mensagens e configuração

- Remetente: `MensagemTemplates.remetente` centraliza nome Pedro Henrique, profissão e atividade. Demos: `MensagemTemplates.demos`, em frontend/mensagemTemplates.js. Academia, clínica, estética e outros começam com demoDisponivel=false porque nenhuma demo foi fornecida/verificada. Ative somente os exemplos que você realmente possui. Cada demo tem também `url: null`. Para ativar um exemplo real, altere somente essa configuração: `demoDisponivel: true` e sua URL real. A URL fica reservada na configuração; não é anexada automaticamente à abordagem. Sem demo, o convite é explicar/mostrar a ideia, sem prometer exemplo pronto ou trabalho gratuito.
- Gancho opcional no cadastro, edição, visualização e CSV/XLSX/XLSM: `gancho_verificado` ou cabeçalho `Gancho verificado`, até 1.000 caracteres. Nunca é preenchido automaticamente.
- O gancho só entra após selecionar **Usar este gancho na mensagem** e gerar novamente. Confira pessoalmente a exatidão/adequação. O gerador aceita uma frase de até 240 caracteres/35 palavras, sem links, marcação, controles ou termos de notas confidenciais. Caso contrário, avisa e preserva o rascunho. Adapta fatos reconhecidos (horários nos destaques, botão de WhatsApp no perfil ou serviços apresentados pelo Instagram) para uma frase de contexto. Ganchos livres que não tenham adaptação segura pedem edição manual e preservam o rascunho, em vez de serem colados. Não verifica a veracidade do texto. Observações internas nunca entram.
- Contexto usa dados reais, Instagram válido e ausência de site com linguagem cautelosa. O texto usa três ou quatro blocos e aproximadamente 40–85 palavras. Nomes/ganchos longos podem exceder essa faixa, sem truncamento silencioso.
- A biblioteca contém oito mensagens completas: curiosidade_01, oportunidade_01, problema_sutil_01, visualizacao_01, demonstracao_01, pergunta_01, autoridade_01 e direta_01. Não há sorteio de trechos. Estratégias fixas usam “Gerar novamente”; Automática usa “Gerar outra abordagem”.
- IDs antigos das etapas 5 e 5.1 continuam aceitos, sem reescrever mensagens históricas. Os IDs curiosidade_01, pergunta_01 e direta_01 foram mantidos conforme a especificação 5.2 e também podem aparecer em contatos antigos; o texto/data do registro permite distinguir esses contatos.
- Edição manual mantém estratégia/variante de origem. Trocar o seletor sem gerar não altera essa origem. Texto escrito do zero usa estrategia=manual e variant_id=NULL.

### Histórico e bloqueio

Marcar como contatado exige mensagem não vazia (até 10.000 caracteres) e grava exatamente o textarea, inclusive espaços, quebras e edição manual. Histórico e atualização de status/data são uma única transação; falhas revertem ambos. O telefone não muda.

O histórico começa em aguardando_resposta. Salvar Respondeu, Interessado ou Não interessado registra/preserva a primeira data de resposta. Voltar a Aguardando resposta corrige o registro limpando a data. O resultado do contato mais recente também atualiza o estágio atual do cliente. Alterar um contato antigo preserva o estágio; Não contatar em qualquer contato mantém o bloqueio persistente.

Não contatar grava um bloqueio persistente, com prioridade sobre o estágio comercial. Pode ser marcado no resultado ou pelo botão próprio, mesmo sem histórico. Mostra aviso, bloqueia geração e exige confirmação em cada abertura do WhatsApp. Registrar contato excepcional também exige confirmação e não remove o bloqueio. Mudar resultado, editar ou alterar status não libera contato. Não há desbloqueio nesta etapa; futuras sequências devem excluir nao_contatar=1.

Não contatar não inventa data de resposta; preserva uma existente. A lista destaca NÃO CONTATAR. Excluir um cliente também exclui seu histórico por chave estrangeira; a confirmação de exclusão informa isso.

Se uma resposta da API se perder, atualize o histórico antes de registrar novamente. A interface impede cliques simultâneos; um segundo registro deliberado representa outro contato.

Endpoints:

- POST /api/clientes/:id/contato: JSON com mensagem, estrategia, variant_id e, somente para exceção confirmada, confirmar_nao_contatar=true. Para texto manual: estrategia=manual, variant_id=null. Retorna cliente atualizado.
- GET /api/clientes/:id/prospeccoes: histórico daquele cliente, mais recente primeiro.
- PUT /api/clientes/:id/prospeccoes/:contatoId: JSON com resultado: aguardando_resposta, respondeu, interessado, nao_interessado, negociacao, fechado ou nao_contatar.
- POST /api/clientes/:id/nao-contatar: bloqueia sem criar contato fictício.

Erros: 400 validação, 404 cliente/contato ausente, 409 cliente bloqueado sem confirmação, 503 falha do banco. Queries parametrizadas. Contatos de outro cliente não podem ser reclassificados pela URL.

`metricas()` em backend/models/prospeccaoModel.js prepara contagens totais, por estratégia e variante: contatos registrados, respostas com data e interessados. São registros manuais, não confirmação de entrega nem taxas de sucesso. Sem dashboard ou endpoint de métricas nesta etapa.

### Testar a Etapa 5.2

1. Cadastre/edite um gancho factual, como “Horários aparecem nos destaques”. Gere sem marcar o checkbox e depois marque-o e gere outra versão.
2. Experimente estratégias fixas e Gerar outra abordagem em Automática. Os IDs são internos, consultáveis no histórico da API; Automática também varia estratégia.
3. Edite com espaços e quebras. Troque o seletor sem gerar. Abra WhatsApp: o texto deve ser exato e a abertura não deve criar histórico. Envio manual.
4. Marque como contatado. Abra Mensagem registrada no histórico: confira texto e estratégia de origem. Reabra o lead para verificar persistência.
5. Salve Respondeu/Interessado/Não interessado no contato correto e confira a data.
6. Salve Não contatar. Confira aviso, bloqueio de geração e confirmação em Abrir WhatsApp. Cancele: nenhuma aba deve abrir. A exceção não desbloqueia o cliente.
7. Importe CSV/Excel com Gancho verificado. Duplicados e empresas com site continuam ignorados.

`npm test` executa regressões e casos do motor. `npm run test:db` verifica histórico, texto exato, resultados, bloqueio e métricas no MySQL com rollback. Interface verificada no navegador com dados isolados, sem envio. Nenhuma dependência nova. A Etapa 6 mantém o envio manual.

## Importação Excel e funcionalidades preservadas

A importação aceita CSV, XLSX e XLSM. O leitor xlsx 0.20.3 vem da distribuição oficial SheetJS; fflate 0.8.3 inspeciona o tamanho do pacote Excel antes da leitura. Macros/VBA não são extraídos nem executados. O arquivo original nunca é regravado.

O nome do remetente fica em `MensagemTemplates.remetente.nome`, em `frontend/mensagemTemplates.js` (padrão: Pedro Henrique). As mensagens apresentam desenvolvimento de sites/landing pages e variam por estratégia e nicho (academia, clínica/fisioterapia, estética/nail/salão ou genérico). Os benefícios são possibilidades, sem prometer vendas, Google ou resultados. Só afirmam ausência de site quando possui_site = 0.

## Prospecção manual pelo WhatsApp

Abra **Visualizar** em um cliente. Os dados continuam disponíveis, com **Abrir Instagram** para um perfil válido e a seção **Mensagem para WhatsApp** logo abaixo.

1. Escolha Automática, Curiosidade, Benefício, Problema, Direta ou Pergunta.
2. Clique em **Gerar mensagem** e revise o texto. **Gerar novamente** mantém a mensagem revisada da estratégia fixa. Em Automática, **Gerar outra abordagem** alterna entre mensagens completas adequadas.
3. Edite livremente no textarea. O contador acompanha a edição. Trocar o select não substitui o rascunho: a nova estratégia vale ao gerar novamente. Reabrir o mesmo lead preserva o texto durante a sessão; selecionar outro lead inicia um rascunho vazio. Não há armazenamento persistente dos rascunhos.
4. Clique em **Abrir WhatsApp**. O sistema abre um link wa.me em nova aba com exatamente o texto atual, incluindo acentos e quebras de linha. Você revisa e envia manualmente no WhatsApp. Se o navegador bloquear a nova aba, permita pop-ups para o CRM.
5. Volte ao CRM e clique em **Marcar como contatado** somente depois do contato. A API salva o histórico, registra status contatado e a data/hora atual do MySQL em ultima_data_contato; detalhes e lista são atualizados. O rascunho permanece intacto.

Abrir o WhatsApp nunca altera status nem data. O telefone não é modificado no banco: o link aceita telefone brasileiro com DDD (10 ou 11 dígitos), ou 12/13 dígitos iniciados em 55; a formatação é removida e o código do Brasil é acrescentado somente quando necessário. Um DDD nacional 55 é distinguido do código do país pelo comprimento. Telefones ou mensagens vazios/inválidos geram um aviso.

A geração é totalmente local e não faz chamadas de IA ou serviços externos. Os templates usam nome, nicho, cidade, estado, classificação possui_site e presença de Instagram válido. O gancho exige seleção explícita; observações internas e telefone não entram. A abordagem Problema descreve uma possibilidade geral, sem afirmar que o lead sofre daquele problema. Não há envio automático, disparo em massa ou automação do navegador.

Organização: templates em frontend/mensagemTemplates.js; geração em frontend/geradorMensagens.js; link/telefone em frontend/whatsapp.js; interface em frontend/prospeccao.js. O gerador retorna texto, estratégia utilizada e variação. A comunicação com a API permanece em frontend/script.js, separada do gerador e do link.

Endpoint adicional: **POST /api/clientes/:id/contato**, com mensagem e metadados de origem conforme a Etapa 5. Retorna o cliente atualizado; responde 400 para ID inválido, 404 para ausente e 503 para falha do banco. Insere o histórico e atualiza status e ultima_data_contato (e updated_at pelo comportamento da tabela).

O banco existente já possui ultima_data_contato DATETIME. A migração aditiva da Etapa 5 está descrita acima. O arquivo SQL opcional de remoção de site continua sem ser executado.

Testes: npm test inclui estratégias, variações, campos ausentes, telefone, codificação de mensagem, rascunho editado, abertura sem gravação, atualização explícita de contato e regressões das etapas anteriores. npm run test:db verifica persistência da data e status no MySQL real dentro de transação revertida, sem manter clientes fictícios.

CRM local em HTML, CSS e JavaScript puro, Node.js/Express e MySQL, com CRUD e importação CSV/Excel. Foco na prospecção de empresas sem site.

## Executar

Use Node.js 20 ou superior. Dentro de `backend`, execute `npm install`.
Copie `.env.example` para `.env` na raiz do projeto e configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` e `PORT` com os dados do MySQL local. Não publique credenciais.

No UniServer Zero, inicie o MySQL. Para uma instalação nova, crie o banco indicado em `DB_NAME`, com collation `utf8mb4_unicode_ci`, e importe `database/schema.sql` pelo phpMyAdmin. O usuário da API precisa de SELECT, INSERT, UPDATE e DELETE na tabela clientes.

Dentro de `backend`:

```powershell
npm run check:db
npm start
```

Abra http://127.0.0.1:3000 (ou a porta definida no .env). O Express serve o frontend; não abra o HTML como arquivo. Para recarregar o backend automaticamente durante desenvolvimento, use `npm run dev`. Reinicie a API quando mudar o código.

Para servir o frontend por outro servidor HTTP local, ajuste `API_BASE_URL` em `frontend/script.js`. O CORS permite origens HTTP locais.

## Classificação e Instagram

`possui_site` é somente uma classificação: Sim = 1 e Não = 0. O formulário manual oferece essas duas opções; Não é o padrão do cadastro. Registros antigos sem classificação continuam preservados e exigem uma escolha ao editar. Na importação, Sim/1 é descartado com o motivo exato **Empresa possui site**. Não/0 pode ser importado. Informação omitida permanece NULL e mantém a possibilidade de importação, sujeita às demais validações.

Não existe mais URL de site no formulário, na visualização, na API ou no CSV. Um campo JSON antigo chamado `site` é ignorado. O schema de novas instalações não cria essa coluna.

**Banco existente:** não é necessário executar ALTER TABLE para usar a aplicação. Se desejar remover fisicamente a coluna antiga, após aprovar a exclusão desses dados execute manualmente `ALTER TABLE clientes DROP COLUMN site;`. O comando está em `database/migrations/002_remover_site_manual.sql` e não é executado automaticamente. A coluna antiga `site`, se existir, permanece com os dados históricos; a aplicação não a consulta nem a altera. Não houve exclusão de dados. A coluna `possui_site` da etapa anterior continua necessária. Apenas para bancos ainda sem ela, use `npm run migrate:site`.

Instagram é o principal link externo: `@nomeempresa` e URLs de perfil em instagram.com/www.instagram.com são padronizados como `https://www.instagram.com/nomeempresa/`. Parâmetros de rastreamento são removidos. Ao visualizar, o perfil abre em nova aba. Campo vazio permanece NULL; textos antigos não reconhecidos como perfil ficam visíveis como texto, sem criar um link incorreto. Registros antigos não são reescritos em lote.

## CRUD

- GET /api/clientes: lista de clientes, ou [] quando vazia.
- GET /api/clientes/:id: dados do cliente.
- POST /api/clientes: cadastra, retorna 201 e os campos salvos.
- PUT /api/clientes/:id: substitui os campos editáveis; envie o formulário completo. Preserva datas de cadastro e último contato.
- DELETE /api/clientes/:id: exclui, retorna 204. A interface pede confirmação.

Nome da empresa e telefone são obrigatórios. Limites: empresa 255, telefone 30, nicho 120, Instagram 255 após normalização e observações 10000 caracteres. Estado e cidade usam a base oficial local: o estado é salvo como UF de duas letras e o município com a grafia oficial. A API também aceita o nome do estado. Espaços excedentes são removidos.

Status permitidos: nao_contatado, contatado, interessado, sem_resposta, negociacao, fechado, descartado. Erros retornam JSON com `erro`: 400 para validação, 404 para cliente inexistente, 413 para corpo excessivo e 503 para falha no banco.

## Importar leads (CSV, XLSX e XLSM)

Selecione um arquivo CSV, XLSX ou XLSM e confira nome, quantidade de registros e as cinco primeiras linhas. A prévia não grava dados. Clique em **Importar clientes** para confirmar ou **Cancelar** para descartar a seleção.

Em Excel, se houver apenas uma aba válida, ela é selecionada automaticamente. Havendo várias, escolha uma em **Aba do Excel**; a prévia é refeita e só essa aba será importada. Abas vazias ou com cabeçalho incompatível aparecem desabilitadas com o motivo. Trocar de aba invalida a confirmação anterior.

Cabeçalho final:

```csv
nome_empresa,telefone,nicho,cidade,estado,instagram,possui_site,status,observacoes,gancho_verificado
```

Empresa e telefone são obrigatórios. Demais colunas podem ser omitidas. Cabeçalhos humanizados são aceitos em todos os formatos: Nome da empresa/Empresa, Telefone/WhatsApp, Nicho/Categoria, Cidade, Estado, Instagram, Possui site/Tem site, Status e Observações/Observacao. Acentos, maiúsculas, espaços e sublinhados são normalizados. O mapeamento está centralizado em backend/services/importacaoColunas.js; colunas desconhecidas ou dois cabeçalhos para o mesmo campo são rejeitados. A coluna antiga `site` não é aceita; remova-a dos CSVs antigos.

- CSV UTF-8, com ou sem BOM, separado por vírgula ou ponto e vírgula. Aspas, vírgulas dentro de campos e campos com múltiplas linhas são aceitos.
- Excel: cabeçalho na primeira linha e dados como valores fixos, sem células mescladas na tabela. Até 5 MiB por arquivo, 20 MiB descompactado, 30 abas e 1.000 linhas de dados por aba (até a linha 1001). Linhas vazias são ignoradas, mantendo o número original no relatório. Linhas com fórmula ou erro de célula são ignoradas com explicação; copie/cole como valores no Excel se necessário. Planilhas protegidas por senha e arquivos XLS antigos não são aceitos. Formatação além desses limites também pode exigir limpar a área excedente.
- CSV: limite de 1 MiB (1.048.576 bytes) e 1.000 registros, além do cabeçalho. Linhas vazias são ignoradas. A linha do relatório é a linha física final do registro.
- Telefone: somente números, de 10 a 15 dígitos, sem adicionar 55. Números de um único dígito repetido são inválidos.
- possui_site: aceita sim, nao, não, 1 e 0, ignorando maiúsculas e espaços externos. Sim/1 nunca é inserido, mesmo que haja outros problemas nos dados da linha; o motivo informado é **Empresa possui site**.
- Status vazio vira nao_contatado. Instagram é normalizado pela mesma validação usada no cadastro.
- Telefones duplicados no banco ou no próprio lote são ignorados; a comparação também remove a formatação dos telefones antigos. Nenhum registro existente é sobrescrito.
- Linhas inválidas ou descartadas não reservam o telefone. Uma linha posterior elegível pode ser importada.
- Registros inválidos são ignorados individualmente. CSV estruturalmente ilegível, binário, com cabeçalho incorreto ou codificação inválida é rejeitado antes da gravação.

O relatório separa **Processados**, **Importados**, **Duplicados**, **Inválidos** e **Ignorados (possui site)**, com detalhes por linha. A soma dos quatro resultados corresponde ao total processado.

Endpoints: POST /api/clientes/importacao/previa e POST /api/clientes/importacao. Recebem o arquivo bruto com X-CSV-Name codificado com encodeURIComponent (nome preservado para compatibilidade). Content-Type: text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet ou application/vnd.ms-excel.sheet.macroenabled.12. Para Excel, a prévia retorna abas, aba e requerAba. Envie ?aba=NOME (encodeURIComponent) na prévia e confirmação. Não confirmar sem escolher quando requerAba=true. Extensão sozinha não é suficiente: o pacote Excel e o conteúdo também são verificados. CSV e Excel passam por backend/services/importacaoRegistros.js, com as mesmas regras. A API revalida os dados na confirmação. Duplicidade é conferida na importação, com transação e bloqueio entre importações concorrentes. Falhas do banco revertem o lote. Se a resposta se perder, confira a lista antes de repetir.

O arquivo `frontend/clientes-teste.csv` tem seis registros: se os telefones ainda não existirem, espere **6 processados, 2 importados, 1 duplicado, 2 inválidos e 1 ignorado por possuir site**.

## Testes

Dentro de backend:

```powershell
npm test
npm run test:db
```

Os testes automatizados cobrem CRUD, validações, classificação, Instagram, CSV, descarte de empresas com site, duplicidade, prévia e cancelamento. O frontend é testado com DOM simulado. O teste MySQL usa uma transação revertida, sem manter clientes de teste; o contador de IDs pode avançar.

Manualmente: cadastre com @nomeempresa e visualize a URL normalizada; edite a classificação; importe o CSV de teste e confira o descarte. Repita o arquivo para conferir duplicidade, e confirme/cancele uma exclusão para verificar o fluxo existente.

### Testar XLSM manualmente

1. Salve uma cópia da sua planilha em XLSM com cabeçalho na primeira linha, usando as colunas acima. Não precisa habilitar macros.
2. Em Importar leads, selecione o arquivo. Se necessário, escolha a aba com os leads. Confira nome, aba, quantidade e primeiras linhas.
3. Cancele para testar a limpeza da seleção ou confirme em Importar clientes. Confira os totais e os motivos por linha.
4. Reimporte a mesma aba: telefones já cadastrados devem aparecer como duplicados, sem sobrescrever clientes.
5. Visualize um lead e gere versões nas estratégias disponíveis. Edite o texto e abra o WhatsApp: o rascunho deve ser preservado e o contato só será registrado ao clicar no botão separado.

Não houve mudança de schema nem necessidade de SQL manual na Etapa 4.1. Testes Excel geram arquivos em memória, inclusive XLSM com conteúdo VBA opaco para assegurar que seja ignorado. O teste MySQL verifica duplicidade entre CSV/XLSX/XLSM e reverte todos os dados de teste.

### Arquivos da Etapa 5

Criados:

- database/migrations/003_motor_prospeccao.sql
- backend/scripts/migrateProspeccao.js
- backend/controllers/prospeccaoValidation.js
- backend/controllers/prospeccaoController.js
- backend/models/prospeccaoModel.js

Alterados:

- database/schema.sql
- backend/package.json
- backend/models/clienteModel.js
- backend/models/importacaoModel.js
- backend/controllers/clienteValidation.js
- backend/controllers/clienteController.js
- backend/routes/clienteRoutes.js
- backend/services/importacaoColunas.js
- backend/scripts/checkCrud.js
- backend/tests/contato.test.js
- backend/tests/foundation.test.js
- backend/tests/frontend.test.js
- backend/tests/mensagens.test.js
- backend/tests/excel.test.js
- frontend/index.html
- frontend/style.css
- frontend/script.js
- frontend/prospeccao.js
- frontend/mensagemTemplates.js
- frontend/geradorMensagens.js
- README.md


### Biblioteca 5.2

Automática escolhe apenas abordagens adequadas ao nicho e exclui Demonstração quando demoDisponivel=false. Evita os últimos seis IDs gerados (sete quando há demo), usando memória do rascunho atual. Trocar de lead ou recarregar a página reinicia essa memória. Não consulta resultados para escolher mensagens.

Demonstração selecionada sem demo mostra “Nenhuma demonstração está configurada para este nicho.” e preserva rascunho, contador e origem. Pergunta, Autoridade e Direta usam ideia quando não há exemplo real. Sem Instagram, o contexto é neutro; o gerador não inventa uma pesquisa.

Teste manual: visualize um lead; selecione cada estratégia e gere; experimente Demonstração sem demo; edite o texto e troque o seletor para confirmar que o rascunho permanece; registre contato somente após envio manual e confira o texto exato no histórico. Em Automática, gere sete abordagens consecutivas sem demo e confira a rotação.

Nenhuma alteração no banco, SQL manual ou dependência adicional nesta etapa. Execute `npm test` e `npm run test:db` dentro de backend. O teste de banco usa transação revertida. A migração da Etapa 6 está descrita abaixo.

## Uso diário — Etapa 6

`clientes.status` é o estágio atual; `prospeccoes.resultado` pertence ao contato específico. Não existe terceiro campo de estágio. Status antigos permanecem: contatado e sem_resposta aparecem juntos em Aguardando resposta; descartado aparece como Não interessado. Respondeu usa o valor respondeu na coluna VARCHAR já existente. O bloqueio nao_contatar tem prioridade absoluta.

Registrar contato coloca o lead em contatado, preservando fechado e não contatar. Resultados do contato mais recente atualizam o estágio: respondeu, interessado, negociacao, fechado; nao_interessado mapeia para descartado. Editar um contato antigo não regride o estágio. Não contatar bloqueia mesmo em contato antigo. Não há reescrita automática do histórico ou dos status antigos.

### Banco

Migração 004: proximo_contato_em DATETIME NULL, proxima_acao VARCHAR(1000) NULL e índice idx_clientes_proximo_contato. Já aplicada no banco local. Para outra instalação, execute `npm run migrate:pipeline` dentro de backend. O comando é reaplicável; não repita os ALTER avulsos. Nenhum DROP foi executado. Não há SQL manual pendente nesta instalação.

### Follow-up

Data/hora e ação são opcionais no cadastro, edição e detalhes. Datas usam o horário local do MySQL: YYYY-MM-DDTHH:mm ou YYYY-MM-DD HH:mm:ss, sem conversão de fuso. Confira o relógio local do UniServer. Salvar com data vazia remove o agendamento; a ação pode continuar preenchida.

O checkbox nos detalhes permite salvar esses campos junto com Marcar como contatado, numa única transação. Desmarcado, o plano existente permanece. Depois de cumprir uma ação, limpe ou reagende a data manualmente. Nenhum follow-up é criado automaticamente.

- Hoje: qualquer horário do dia local atual, inclusive horários já vencidos.
- Atrasados: data/hora anterior a NOW(), inclusive hoje mais cedo.
- Próximos: a partir de amanhã. Horários futuros de hoje permanecem em Hoje.
- Sem follow-up: sem data agendada.
- Preciso contatar: vencidos e todos os horários de hoje, ordenados pela data mais antiga primeiro. O botão rápido limpa os demais filtros para mostrar a fila completa; depois é possível combinar filtros.

Todos os filtros de follow-up e seu contador excluem fechado e nao_contatar. Outros estágios permanecem ativos se houver um plano manual. Nenhum aviso externo, scheduler, abertura automática do WhatsApp ou envio é realizado. Atualize a lista ao retomar o CRM para renovar datas e contadores.

### Listagem e pipeline

Busca consulta empresa, telefone, cidade, estado e nicho. Filtros são combinados com AND. Nichos vêm dos dados existentes; estados vêm da base oficial local. Escolher estado restringe as opções às localidades daquela UF; sem estado, aparecem cidades dos leads existentes. Instagram Sim/Não considera o campo preenchido/vazio. Ordenações usam lista permitida; filtros usam parâmetros SQL.

25, 50 ou 100 leads por página, preservando filtros. Próximo contato é a ordem inicial, com datas vazias por último. Último contato e cadastro mostram os mais recentes primeiro; nome é crescente. Preciso contatar sempre prioriza as datas vencidas.

Os sete indicadores mostram o CRM inteiro, independentemente dos filtros. As oito seções do pipeline mostram os leads da página atual; o total no título de cada estágio considera toda a seleção filtrada. Não é um dashboard analítico.

### API

GET /api/clientes sem parâmetros continua retornando um array. Com parâmetros retorna { clientes, total, page, limit, pipeline, indicadores, opcoes, agora }. Uma página além do final é ajustada para a última disponível.

Exemplos:

- GET /api/clientes?estado=SP&nicho=Academia&status=nao_contatado&page=1&limit=25
- GET /api/clientes?status=contatado&followup=atrasados&sort=proximo_contato
- GET /api/clientes?followup=preciso_contatar&page=1&limit=50
- GET /api/clientes?search=Alpha&instagram=sim&sort=nome

Parâmetros: search, status, nicho, estado, cidade, followup, instagram (sim/nao), page, limit (25/50/100), sort (nome/cadastro/ultimo_contato/proximo_contato). Aliases de status: sem_resposta e aguardando_resposta para contatado; nao_interessado para descartado.

PUT /api/clientes/:id/followup aceita proximo_contato_em e/ou proxima_acao, com null para limpar. Campos omitidos são preservados. POST /api/clientes/:id/contato também aceita os campos opcionais; uma data inválida rejeita toda a operação antes de gravar o contato. Cadastro/edição aceitam ambos; chamadas antigas que os omitem preservam o plano na edição.

### Teste manual e regressão

1. Confira indicadores e combine Estado, Nicho e Status. Use Buscar para texto livre.
2. Alterne Lista/Pipeline, troque limite e página e confira os filtros. Limpar filtros volta a todos os leads.
3. Visualize um lead, informe próximo contato e próxima ação e salve. Data passada mostra Follow-up atrasado.
4. Clique Preciso contatar: vencidos e hoje entram; fechado/não contatar ficam fora.
5. Após contato manual, registre a mensagem e opcionalmente um novo agendamento. No histórico, registre Negociação ou Fechado e confira o estágio.
6. Execute `npm test` e `npm run test:db` dentro de backend. O teste MySQL inclui 450 leads temporários, filtros, paginação e follow-up com rollback. A interface também foi verificada em transação temporária. Nenhuma dependência nova naquela etapa. A Etapa 7 está descrita abaixo.

## Padronização de estados e localidades

Fonte: [API de Localidades do IBGE](https://servicodados.ibge.gov.br/api/docs/localidades), endpoints `/api/v1/localidades/estados` e `/api/v1/localidades/municipios`. A base consultada em 23/09/2026 contém **27 UFs e 5.571 registros territoriais: 5.569 municípios + Brasília/DF + Fernando de Noronha/PE**, com código IBGE, UF e nome. Brasília representa o Distrito Federal nesse endpoint; Fernando de Noronha é um distrito estadual de Pernambuco. São registros especiais, não municípios comuns. Regiões administrativas do DF não foram acrescentadas. Boa Esperança do Norte (MT) está incluída entre os municípios. A auditoria confirmou códigos únicos, ausência de duplicidades e nenhuma divergência com a resposta da API consultada.

A base está em `frontend/data/municipios.js`. O nome interno do arquivo e a coleção `municipios` seguem o endpoint da API e incluem os dois registros especiais, sem implicar que todos sejam municípios. `frontend/localidades.js` centraliza a normalização compartilhada pelo navegador, API e importadores CSV/XLSX/XLSM. Não há consulta à internet durante cadastro, edição, filtros ou importação, nem dependência nova. As oito mensagens e regras comerciais permanecem iguais.

Estado e cidade continuam opcionais; uma cidade informada exige estado para identificação segura. Caixa, acentos e espaços extras são normalizados, sem adivinhar localidades: `maranhao` + `Sao Luis` vira `MA` + `São Luís`; `MA` + `Belo Horizonte` é inválido. Dados antigos não identificados são sinalizados na edição e exigem revisão explícita antes de salvar. Nenhuma correção automática é feita nesses casos.

Comandos dentro de `backend`:

```powershell
npm run normalizar:localidades
npm run normalizar:localidades -- --aplicar
npm run atualizar:municipios
npm test
npm run test:db
```

O primeiro comando é uma simulação: mostra IDs, valores anteriores/propostos e pendências, sem escrever no banco. `--aplicar` altera somente correspondências seguras, em transação, preservando `updated_at` e demais campos. Se um registro mudar durante a revisão, a operação é revertida. Pendências nunca são alteradas pelo script. Nenhum registro é apagado.

`atualizar:municipios` é opcional e exige internet apenas ao atualizar a base. Verifica integridade antes de substituir o arquivo local; reinicie a API após atualizar e execute os testes. O teste de contagem registra a versão atual (5.571 registros territoriais, incluindo as duas unidades especiais); se o IBGE modificar a quantidade oficial, revise essa expectativa junto com a nova base.

**Banco atual:** nenhuma alteração no schema, nenhum ALTER TABLE ou SQL manual necessário. Revisão dos cinco leads existentes: cinco já padronizados, zero alterações, zero pendências.

**Validação:** 131 testes automatizados aprovados (114 anteriores e 17 novos). Também passaram os testes no MySQL real de CRUD, CSV/XLSX/XLSM, duplicados, filtros e normalização, sempre com rollback. No navegador foram verificados cadastro, edição, busca sem acentos, troca de UF, prévia/importação CSV, relatório e filtros. Nenhum lead fictício foi mantido; o contador de IDs pode avançar durante testes revertidos.

Teste manual:

1. Inicie a API com `npm start` em `backend` e abra `http://127.0.0.1:3000`. Cidade começa desabilitada.
2. Selecione Maranhão (MA), pesquise `sao luis`, escolha São Luís e cadastre. Edite e confira a restauração dos campos.
3. Mude para Minas Gerais (MG): a cidade deve ficar vazia. Pesquise e escolha Belo Horizonte antes de salvar.
4. Importe CSV, XLSX ou XLSM com colunas `nome_empresa,telefone,estado,cidade,possui_site`. Use telefones distintos: uma linha `Maranhão,Sao Luis,0` deve importar; uma `MA,Belo Horizonte,0` deve informar cidade incompatível. Empresas com site continuam ignoradas e telefones repetidos continuam duplicados.
5. Nos filtros, selecione MA e São Luís. Troque para MG: a cidade anterior deve ser limpa. Limpar filtros restaura a listagem completa.

## Etapa 7 — Dados e backup

Na área **DADOS E BACKUP**, escolha CSV ou XLSX e clique em **Exportar leads**. **Exportar todos os leads** ignora os filtros; **Exportar resultados atuais** usa a última consulta aplicada com sucesso na listagem, incluindo todas as páginas. Uma busca digitada precisa ser aplicada com Buscar. Exportar histórico inclui todos os contatos, com empresa, cliente, estratégia, variant_id, mensagem, resultado e datas. Downloads não limpam filtros, página, seleção ou rascunhos.

Os cabeçalhos são legíveis; os valores vêm das colunas reais, incluindo `created_at` e `updated_at`. Localidades não são renormalizadas na exportação. CSV usa UTF-8 com BOM, separador `;`, aspas escapadas e suporte a quebras de linha. Textos que poderiam ser executados como fórmula recebem um apóstrofo de proteção no CSV. XLSX mantém textos como células de texto, inclusive telefone e mensagem; se um texto ultrapassar 32.767 unidades de texto por célula, a exportação pede CSV em vez de truncá-lo. Exportação não é um formato de restauração.

**Fazer backup completo** baixa um JSON com nome datado pelo navegador. A aplicação não escolhe uma pasta nem mantém cópias em diretórios arbitrários. Guarde o arquivo no local escolhido por você. O backup contém dados comerciais, inclusive mensagens e observações, mas não lê nem inclui `.env`, credenciais, tokens de restauração ou dependências.

Formato legado JSON versão **1** (a Etapa 9 passa a gerar versão 2, descrita abaixo):

```json
{
  "backup": {
    "aplicacao": "lead-crm",
    "versao_backup": 1,
    "schema_version": "lead-crm-etapa6-v1",
    "criado_em": "2026-09-28T12:00:00.000Z",
    "site_legado": true
  },
  "resumo": {"quantidade_clientes": 0, "quantidade_prospeccoes": 0},
  "dados": {"clientes": [], "prospeccoes": []},
  "checksum": {"algoritmo": "SHA-256", "valor": "calculado pelo sistema"}
}
```

Exemplo ilustrativo: o checksum acima não é válido para restauração. SHA-256, calculado com `crypto` nativo, cobre metadados, resumo e dados usando ordenação estável das chaves. Detecta alterações acidentais; não é assinatura digital nem criptografia. O formato preserva IDs, relacionamentos, valores nulos, datas locais do MySQL e texto exato, sem aplicar regras de importação, deduplicação ou normalização. `criado_em` é UTC; datas comerciais permanecem strings locais `YYYY-MM-DD HH:mm:ss`.

O banco contém `clientes`, `prospeccoes` e, a partir da Etapa 9, `configuracoes`. A coluna antiga `clientes.site` ainda existe nesta instalação: é preservada no backup quando presente, sem voltar ao formulário ou à exportação de leads. Um backup que contém essa coluna não pode ser restaurado em banco sem ela, evitando perda silenciosa. Um backup sem a coluna pode ser restaurado no banco que ainda a possui, preenchendo-a com NULL. A Etapa 7 não introduziu migração; a Etapa 9 adiciona somente a tabela de configurações.

`schema_version` identifica o contrato das colunas da Etapa 6; não representa um registro de migrations executadas, pois o projeto não tem essa tabela de controle. O sistema confere as tabelas comerciais e colunas esperadas e exige InnoDB. Tabelas persistentes ou colunas desconhecidas bloqueiam backup/restauração para não omitir dados silenciosamente.

### Validar e restaurar

1. Selecione um JSON em **Restaurar backup**. A seleção só valida; não grava nada.
2. Confira data, versão, quantidade de clientes e prospecções. O limite é **20 MB** tanto no navegador como no backend. Versão, estrutura, tipos, datas, IDs únicos, referências, contagens e checksum são conferidos.
3. Clique em **Baixar backup dos dados atuais** e guarde o arquivo.
4. Marque a confirmação de que salvou essa cópia, digite **RESTAURAR** e clique em **Confirmar restauração**. Cancelar ou escolher outro arquivo invalida a confirmação da interface.
5. Após sucesso, a página é recarregada para descartar seleções e rascunhos que poderiam se referir aos dados anteriores.

A autorização de restauração fica apenas na memória da API, dura dez minutos, é vinculada ao arquivo escolhido e à cópia dos dados atuais e só pode ser usada uma vez. Reiniciar a API exige repetir a cópia de segurança. Se qualquer dado comercial mudar após essa cópia, a restauração é bloqueada e pede novo download. O navegador não consegue garantir que o usuário guardou o arquivo; por isso a confirmação de salvamento é explícita.

A substituição usa uma transação SERIALIZABLE com bloqueio dos dados, limpa prospecções antes de clientes e insere clientes antes do histórico. SQL é fixo com valores parametrizados: nenhum comando do JSON é executado. Não usa TRUNCATE, ALTER TABLE nem desativa foreign keys. Os IDs explícitos são mantidos; InnoDB ajusta AUTO_INCREMENT para que os próximos IDs não colidam, sem prometer sequência sem lacunas. Antes do COMMIT, os dados reconstruídos são comparados com o backup. Erros durante a operação provocam ROLLBACK. Se a conexão falhar durante a confirmação do COMMIT, o sistema informa resultado incerto e pede conferir o CRM antes de repetir.

### API e testes

- `GET /api/exportacao/clientes?formato=csv|xlsx&escopo=todos|filtrados`: aceita os filtros existentes; a paginação não limita o arquivo.
- `GET /api/exportacao/prospeccoes?formato=csv|xlsx`: histórico completo.
- `GET /api/backup`: download completo.
- `POST /api/backup/validar`: arquivo JSON bruto, Content-Type `application/octet-stream` ou `application/json`.
- `POST /api/backup/seguranca`: recebe o arquivo validado e baixa o backup atual, com autorização no cabeçalho `X-Restauracao-Token`.
- `POST /api/backup/restaurar`: reenvia o arquivo, o token e `X-Confirmacao: RESTAURAR`.

Execute `npm test` e `npm run test:db` em `backend`. `checkBackup.js` usa tabelas TEMPORARY que ocultam as reais apenas na conexão de teste: alterações de restauração nunca atingem os dados comerciais reais. Faz round-trip, confere IDs e relacionamentos, testa AUTO_INCREMENT, simula falha SQL no meio com rollback e compara os dados reais antes/depois. As tabelas temporárias usam as definições originais, sem foreign keys (limitação de tabelas temporárias do MySQL); as referências são conferidas pela validação e comparação dos dados, enquanto as foreign keys originais continuam ativas na aplicação. Nenhuma dependência foi adicionada na Etapa 7.

Validação final da Etapa 7: **174 testes automatizados aprovados** (131 anteriores e 43 novos), 68 arquivos JavaScript sem erros de sintaxe e todos os testes MySQL aprovados. No navegador foram exercitados exportação CSV/XLSX, histórico, backup, prévia, confirmação forte e restauração exclusivamente nas tabelas temporárias. A exportação incluiu 52 leads filtrados quando a tela mostrava 25 por página; o teste de banco também conferiu 101 filtrados. Os dados reais permaneceram intactos.

## Etapa 8 — Dashboard e métricas comerciais

A navegação oferece Dashboard, Lista, Pipeline e Dados e Backup. O dashboard usa uma chamada `GET /api/metricas/dashboard`, com agregações SQL parametrizadas e leitura consistente. Não há dependências novas, migração ou SQL manual. Os índices existentes foram suficientes na validação local com 450 leads; não foram adicionados índices sem benefício demonstrado.

### Definições

- Estoque: total de leads, pipeline atual e follow-ups ignoram o período. Nicho, UF e cidade filtram todas as métricas pelos dados atuais do lead.
- Contatados: IDs distintos com pelo menos uma prospecção com data_contato no período. Três contatos contam como um lead e três Contatos realizados.
- Responderam: leads desse grupo com evidência de resposta no mesmo contato. Em períodos delimitados, data_resposta também precisa estar no intervalo. Em Todo o período, vale uma data de resposta existente ou resultado respondeu, não interessado, interessado, negociação ou fechado.
- Funil acumulado: maior estágio evidenciado nos contatos elegíveis. Fechado implica negociação, interesse e resposta; negociação implica interesse e resposta. Somente em Todo o período, o estágio atual também completa essas etapas, desde que haja histórico de contato. Estágio avançado sem histórico aparece apenas no estoque/pipeline e em um aviso.
- Taxa de resposta = respondidos únicos / contatados únicos × 100.
- Taxa de interesse = interessados acumulados únicos / respondidos únicos × 100.
- Taxa de fechamento = fechados únicos / contatados únicos × 100.
- Taxas mostram numerador/denominador, uma casa decimal e 0% quando o denominador é zero.
- Estratégias/variantes: atribuição somente aos resultados dos respectivos contatos. Um lead pode participar de várias abordagens; suas linhas não são somáveis. As oito estratégias aparecem mesmo vazias, além das manuais/legadas presentes. Menos de dez leads contatados: “Amostra pequena”, sem ranking definitivo.
- Evolução: contatos por data_contato; respostas por data_resposta, únicas por faixa, inclusive de contatos anteriores ao período. Portanto, a série de respostas pode diferir do card que exige contato no período. Até 45 dias usa dias; intervalos maiores e Todo o período usam meses. Até 36 faixas recentes com atividade, sem inventar pontos vazios.
- Limitação: não existe data própria de fechamento nem data de cada mudança de estágio. “Fechados por contato” agrupa resultados atualmente Fechado pela data do contato; NÃO representa fechamentos ocorridos naquela data. Os cards de interesse/negociação/fechamento indicam evidências conhecidas nos registros elegíveis, não datas comprovadas das transições. O histórico editável não permite reconstruir perfeitamente todos os estágios passados. Nenhuma data foi fabricada.
- Follow-ups: hoje inclui todo o dia; atrasados inclui horários anteriores ao momento atual (pode sobrepor hoje); próximos sete dias vai de amanhã até o sétimo dia seguinte, inclusive. Fechados e Não contatar são excluídos conforme a regra existente. Hoje/Atrasados abrem a Lista com nicho/UF/cidade aplicados; não transferem o período comercial para pendências de estoque.

### Períodos e teste manual

Usam o relógio local do MySQL: início inclusivo às 00:00 e fim exclusivo às 00:00 do dia seguinte. Hoje inclui o dia atual; 7 dias inclui hoje e seis anteriores; 30 dias inclui hoje e 29 anteriores; Este mês começa no primeiro dia; Personalizado inclui ambas as datas escolhidas. Todo o período não limita datas.

1. Inicie MySQL e API (`cd backend`, `npm start`) e abra `http://127.0.0.1:3000/`.
2. No Dashboard, escolha período/nicho/Estado/Cidade e clique em Atualizar dashboard. Trocar a UF limpa a cidade. Uma seleção sem leads mostra zeros e aviso.
3. Confira números absolutos das taxas, oito estratégias, amostra pequena e variantes.
4. Clique em Hoje ou Atrasados e confira os filtros na Lista. Navegue também para Pipeline e Dados e Backup.
5. Em registros de teste próprios, três contatos para um lead contam como um Contatado e três Contatos realizados.

`npm test` cobre regressões e dashboard. `npm run test:db` inclui checkMetricas.js: 450 fixtures em transação, contagens únicas, curiosidade 3/10 = 30%, variantes, períodos, filtros, séries e vazio. Executa rollback e compara conteúdo real antes/depois. IDs AUTO_INCREMENT podem ter lacunas após rollback, sem perda de registros. Execute sem editar dados simultaneamente. A primeira consulta agregada local levou 203 ms. A interface real usa apenas dados existentes.

Resultado da validação da Etapa 8: 186 testes aprovados, 76 arquivos JavaScript com sintaxe válida e todos os cinco scripts de MySQL aprovados. Última medição com 450 leads: 218 ms. Navegador: filtros combinados/personalizados, vazio, oito estratégias, atalho de follow-up, navegação e tela móvel sem rolagem horizontal validados.

## Etapa 9 — Configurações do CRM

O CRM continua local, de usuário único e sem login. A navegação tem uma área Configurações, com salvamento explícito, aviso de alterações pendentes e confirmação para Restaurar padrões. Não há editor de templates, preços, envio automático nem acesso ao .env pela interface.

### Persistência e migração

A tabela InnoDB `configuracoes` contém uma única linha (id=1, sem user_id): nome_remetente, profissao_remetente, disponibilidade/URL de demos academia/clinica/estetica, leads_por_pagina, tela_inicial e atualizado_em. O contrato comercial fica em `frontend/configuracaoPadrao.js` e é compartilhado pelo backend. Valores iniciais: Pedro Henrique, desenvolvedor web, demos desabilitadas e URLs vazias, 25 leads por página, Dashboard.

Para uma instalação existente, com MySQL ligado, execute em backend:

```powershell
npm run migrate:configuracoes
npm start
```

A migration `database/migrations/005_configuracoes.sql` é aditiva e pode ser repetida: não sobrescreve configurações já salvas nem modifica clientes/prospecções. Também foi incorporada ao schema.sql para instalações novas. Nenhuma dependência foi adicionada. Na instalação local de desenvolvimento a migração já foi aplicada e testada.

`GET /api/configuracoes` retorna as preferências; `PUT /api/configuracoes` valida e salva o conjunto completo, com query parametrizada. Nome/profissão exigem texto de 1 a 100 caracteres, sem HTML, com espaços normalizados. URLs aceitam apenas HTTP/HTTPS válidos, até 2048 caracteres, sem credenciais; demo ativa exige URL. URLs não vazias continuam sendo validadas mesmo com demo desativada. Paginação aceita apenas 25/50/100; tela inicial aceita dashboard/lista/pipeline. Campos técnicos extras são rejeitados.

Tabela vazia usa padrões seguros. O frontend aguarda o carregamento antes da geração; em falha de rede usa padrões e mostra aviso. Salvar novamente exige API/MySQL disponíveis. Não há dependência de localStorage; os valores persistem no MySQL após reiniciar navegador, API ou computador.

### Mensagens, demonstrações e preferências

As oito copies e seus variant_id foram preservados. Dados salvos alimentam a próxima geração, sem alterar rascunhos ou histórico já registrado. Para profissões personalizadas, a apresentação usa “sou [profissão]”; com a profissão padrão, os trechos originais “trabalho com desenvolvimento web” permanecem iguais.

Em Configurações → Demonstrações, selecione Sim no nicho, informe uma URL real HTTP/HTTPS e salve. Demonstração passa a participar da seleção Automática para aquela categoria; desativar a exclui e impede sua seleção explícita. Os agrupamentos comerciais existentes continuam: fisioterapia usa clínica; salão/nail usam estética; demais nichos continuam genéricos. A URL NUNCA entra na primeira mensagem. Seu envio segue manual após resposta.

A paginação salva vira padrão da Lista e da limpeza de filtros; o seletor da Lista permite mudança temporária sem gravar a configuração. Ao abrir/recarregar, a aplicação carrega as preferências e abre Dashboard, Lista ou Pipeline conforme salvo. Alterar a tela inicial não navega para outra área durante o salvamento. Datas visíveis usam dia/mês/ano, sem mudar o armazenamento ou converter o fuso do MySQL.

### Backup versão 2 e compatibilidade

Novos backups completos incluem `dados.configuracoes`, com zero ou uma linha, além de clientes/prospeccoes; `versao_backup` é 2 e `schema_version` é `lead-crm-etapa9-v2`. A ausência de linha significa usar padrões seguros. SHA-256 cobre também as configurações, inclusive atualizado_em. As configurações são verificadas quanto a campos permitidos, tipos, perfil, URLs e preferências antes da restauração.

Backups versão 1 (`lead-crm-etapa6-v1`) continuam aceitos e **mantêm as configurações atuais**; não redefinem perfil/demos/preferências. Ao restaurar versão 2, as configurações do arquivo substituem as atuais na mesma transação dos dados comerciais. Falhas revertem o conjunto inteiro. A cópia de segurança e a detecção de alterações concorrentes também abrangem configurações. Após restaurar, a página recarrega para obter as preferências restauradas. CSV/XLSX de leads não recebem configurações.

Restaurar padrões afeta apenas preferências comerciais e de uso, após confirmação. Não altera clientes, contatos, histórico ou backups existentes.

### Como testar

1. Abra Configurações, altere nome/profissão e salve. Recarregue e confirme persistência.
2. Ative uma demo sem URL ou com javascript: para ver o erro ao lado do campo; informe HTTP/HTTPS válido e salve.
3. Visualize um lead da categoria e gere Demonstração: a apresentação deve usar o perfil salvo, sem URL no texto. Não é necessário abrir WhatsApp nem registrar contato para esse teste.
4. Salve paginação 50/100 e tela inicial Lista/Pipeline; recarregue. Uma mudança temporária de paginação na Lista não deve alterar a preferência salva.
5. Use Restaurar padrões: cancelar mantém os valores; confirmar salva os padrões.
6. Gere um backup completo v2. Para testar restauração com dados reais, continue usando a prévia, cópia de segurança e confirmação forte existentes. Os testes automatizados de restauração usam tabelas temporárias, sem sobrescrever dados comerciais reais.

`npm test` inclui os testes anteriores, validação, API, perfil nas oito mensagens, demos, preferências, fallback de rede, confirmação, datas e checksum v1/v2. `npm run test:db` inclui checkConfiguracoes.js, com migration repetível, persistência no MySQL, padrões, backup v2, compatibilidade v1 e rollback. Não avance para a Etapa 10.

Validação final da Etapa 9: **219 testes aprovados** (186 anteriores + 33 novos), 88 arquivos JavaScript com sintaxe válida e todos os seis scripts MySQL aprovados. Navegador: editar perfil, erro de URL, ativar demo, salvar/recarregar, mensagem personalizada sem link, paginação 50/100, início Lista/Pipeline e retorno aos padrões conferidos. Os valores originais foram restaurados: Pedro Henrique, desenvolvedor web, demos desabilitadas, 25 leads e Dashboard. Clientes e histórico foram preservados.

Arquivos criados nesta etapa:

- frontend/configuracaoPadrao.js, frontend/configuracoes.js, frontend/datas.js.
- backend/routes/configuracaoRoutes.js, backend/controllers/configuracaoController.js, backend/models/configuracaoModel.js, backend/services/configuracaoValidation.js.
- backend/scripts/migrateConfiguracoes.js, backend/scripts/checkConfiguracoes.js.
- backend/tests/configuracoes.test.js, backend/tests/configuracoesFrontend.test.js, backend/tests/backupV2.test.js.
- database/migrations/005_configuracoes.sql.

Arquivos alterados nesta etapa:

- frontend/index.html, frontend/script.js, frontend/pipeline.js, frontend/dashboard.js, frontend/mensagemTemplates.js, frontend/geradorMensagens.js, frontend/prospeccao.js, frontend/dadosBackup.js.
- backend/server.js, backend/package.json, backend/models/dadosModel.js, backend/services/backupService.js, backend/services/backupValidation.js.
- backend/test-support/tabelasBackupTemporarias.js, backend/scripts/checkBackup.js, backend/tests/frontend.test.js.
- database/schema.sql e README.md.
