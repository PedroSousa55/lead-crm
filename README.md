# Lead CRM — versão 1.0

CRM local para prospecção de empresas sem site. HTML, CSS e JavaScript puro, Node.js/Express e MySQL (UniServer Zero). Uso individual em localhost.

## Iniciar

1. Inicie o MySQL no UniServer Zero. Use Node.js 20 ou superior.
2. Copie .env.example para .env na raiz e configure DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME e PORT. Não compartilhe credenciais.
3. Em uma instalação nova, crie o banco indicado em DB_NAME com utf8mb4_unicode_ci e importe database/schema.sql pelo phpMyAdmin. Não reimporte o schema sobre uma base existente.
4. No terminal, entre na pasta backend e execute:

```powershell
npm install
npm run check:db
npm start
```

5. Abra http://127.0.0.1:3000/ (ou a porta definida em PORT). A API serve o frontend; não é necessário abrir index.html separadamente.

A instalação local atual já possui as migrações anteriores. **A Etapa 10 não exige SQL nem ALTER TABLE.** Para atualizar outra instalação antiga, consulte o histórico técnico e as migrações em database/migrations antes de executá-las. A remoção opcional da coluna legada site não foi executada.

## Funcionalidades

- **Leads:** cadastro, edição, detalhes, exclusão confirmada, status, busca, filtros e paginação; localidades brasileiras padronizadas.
- **Importação:** CSV, XLSX e XLSM, seleção de aba, prévia, validação por linha e relatório. Telefones duplicados não sobrescrevem dados; empresas com site são ignoradas. Macros não são executadas.
- **Prospecção:** oito abordagens comerciais, revisão da mensagem, Instagram e abertura manual do WhatsApp por wa.me. Abrir o link não envia nem registra contato; marque como contatado após realizar o contato.
- **Acompanhamento:** histórico, resultados, bloqueio Não contatar, pipeline e follow-up manual. Nenhuma mensagem automática.
- **Dashboard:** métricas e filtros existentes, com explicações de amostra e período.
- **Dados e backup:** exportação de leads/histórico, backup completo v2 e restauração com prévia, cópia de segurança e confirmação. Backups v1 preservam as configurações atuais.
- **Configurações:** perfil comercial, demos reais por nicho, paginação e tela inicial; persistência no MySQL.

## Interface

A navegação separa Dashboard, Leads, Pipeline, Dados e backup e Configurações. Novo lead abre um formulário em janela; detalhes ficam em painel lateral. Filtros secundários são expansíveis, status usam badges e históricos ficam agrupados.

Modo claro/escuro pelo botão do cabeçalho, com preferência salva apenas no navegador. Sem escolha salva, acompanha o tema do sistema. No celular, o menu é recolhível, leads viram cards e o pipeline permite rolagem horizontal. Fontes e ícones locais, foco visível e respeito à preferência por movimento reduzido.

## Testes

Dentro de backend:

```powershell
npm test
npm run test:db
```

O segundo comando exige MySQL ligado e permissão para tabelas temporárias; usa transações revertidas e tabelas temporárias nos testes de restauração. Não restaura backups sobre dados reais.

Para revisão visual reversível, backend/scripts/previewV1.js fornece uma sessão em 127.0.0.1:3110, com restauração bloqueada e rollback ao encerrar/expirar. É exclusivamente um apoio de teste, não o servidor habitual. Use apenas leads com prefixo QA V1 para alterações nessa sessão, sem uso concorrente da base. Encerre por POST /__qa/finalizar antes de executar test:db.

## Limites de uso

Aplicação local, sem autenticação ou multiusuário: não publique a API na internet. Rascunhos de mensagens não persistem após fechar a sessão. Links externos dependem do navegador e nenhum teste envia mensagens. Métricas refletem registros manuais; não comprovam entrega, venda ou data real de fechamento. Guarde backups em local seguro.

O [histórico técnico das etapas](docs/historico-etapas.md) preserva detalhes de migrações e contratos anteriores; descrições antigas representam o estado de cada etapa. As instruções atuais de uso estão neste README.

Validação da versão 1.0 (29/09/2026): **227 testes aprovados**, seis verificações MySQL aprovadas e 93 arquivos JavaScript com sintaxe válida. Confira o [relatório da revisão](docs/revisao-v1.md).
