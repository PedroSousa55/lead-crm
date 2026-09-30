# Revisão da versão 1.0 — 29/09/2026

## Escopo

Redesign e organização da interface. Regras comerciais, oito mensagens, variant_id, histórico, contratos da API e schema preservados. Nenhuma dependência adicionada e nenhum SQL manual necessário.

## Arquivos

Criados: frontend/tema.js, frontend/navegacao.js, frontend/interface.js, frontend/favicon.svg, backend/tests/interfaceV1.test.js, backend/scripts/previewV1.js, docs/historico-etapas.md e docs/revisao-v1.md.

Alterados: frontend/index.html, frontend/style.css, frontend/script.js, frontend/pipeline.js, frontend/dashboard.js, backend/tests/frontend.test.js e README.md.

## Verificação

- npm test: 227 testes, 227 aprovados, zero falhas ou ignorados; 219 anteriores preservados e oito novos.
- npm run test:db: seis scripts aprovados (CRUD/importação, pipeline, localidades, backup, métricas, configurações).
- Sintaxe: 93 arquivos JavaScript válidos. Recursos locais da página: 21 respostas sem 404.
- Navegador Chromium integrado: cadastro, edição, detalhes, geração/revisão de mensagem, acionamento de links externos sem envio, registro de contato, follow-up, pipeline, dashboard, exportação, backup, configurações, tema e exclusão confirmada de lead temporário.
- CSV importado; XLSX com telefone repetido corretamente identificado como duplicado; XLSM com prévia válida. Testes MySQL também cobrem importação XLSX/XLSM e duplicidade entre formatos.
- Larguras 360, 390, 768, 1024 e 1440 px conferidas: página sem transbordamento horizontal, formulário/painel cabem na tela, menu móvel recolhível. Pipeline com rolagem própria.
- Claro e escuro conferidos, incluindo persistência após recarregar; fallback de sistema e armazenamento indisponível cobertos por testes.
- Nenhum erro/aviso no console da sessão final, nenhum ID duplicado ou campo sem rótulo. Sem TODO/FIXME ou console.log de depuração no frontend.
- Sessão visual encerrada com rollback e igualdade dos dados conferida por hash. Após a suíte MySQL: cinco clientes originais, zero prospecções e zero clientes QA V1.

## Ajustes encontrados na revisão

Expectativas antigas dos testes foram atualizadas somente para a nova apresentação de status, estado vazio e faixa da paginação. Títulos redundantes de Configurações e Dados e backup foram mantidos para acessibilidade, sem repetição visual. Nenhuma cobertura anterior foi removida.

## Limites

Não houve envio de mensagem. A renderização dos sites externos Instagram/WhatsApp não foi verificada; os links e seu acionamento foram conferidos. Restauração visual sobre dados reais foi bloqueada; restauração e rollback foram testados com tabelas temporárias. Revisão em Chromium no Windows, sem validação em aparelhos físicos, Safari ou leitor de tela. Mantidos os limites funcionais descritos no README.

Versão 1.0 concluída para o escopo local de uso individual. Nenhuma publicação externa ou etapa adicional realizada.
