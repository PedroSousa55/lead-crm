const MensagemTemplates = {
  remetente: (()=>{const p=(typeof module!=='undefined'&&module.exports?require('./configuracaoPadrao'):ConfiguracaoPadrao).valores();return {nome:p.nome_remetente,profissao:p.profissao_remetente,atividade:'desenvolvimento web'};})(),
  // Valores iniciais do contrato central; configurações salvas são recebidas pelo gerador.
  demos: (()=>{const p=(typeof module!=='undefined'&&module.exports?require('./configuracaoPadrao'):ConfiguracaoPadrao).valores();return Object.fromEntries(['academia','clinica','estetica','outros'].map(n=>[n,{demoDisponivel:p['demo_'+n+'_disponivel']||false,url:p['demo_'+n+'_url']||null}]));})(),
  nichos: {
    academia: { tipo: 'a academia', de: 'da academia', para: 'uma academia', beneficio: 'as principais informações da academia', visual: 'encontrar informações como modalidades, horários e contato pelo WhatsApp' },
    clinica: { tipo: 'a clínica', de: 'da clínica', para: 'uma clínica', beneficio: 'as principais informações da clínica', visual: 'conhecer as informações da clínica e acessar o contato para agendamento' },
    estetica: { tipo: 'o studio', de: 'do studio', para: 'um negócio de estética', beneficio: 'os serviços do studio', visual: 'conhecer os principais serviços e, se quiser agendar, ir direto para o WhatsApp' },
    salao: { tipo: 'o salão', de: 'do salão', para: 'um salão', beneficio: 'os serviços do salão', visual: 'conhecer os principais serviços e, se quiser agendar, ir direto para o WhatsApp' },
    outros: { tipo: 'a empresa', de: 'da empresa', para: 'um negócio local', beneficio: 'as informações da empresa', visual: 'conhecer as principais informações da empresa e acessar o contato pelo WhatsApp' }
  },
  // Mensagens completas: nenhuma combinação aleatória de saudação, corpo ou CTA.
  mensagens: {
    curiosidade: c => `Oi! Tudo bem? ${c.encontro} Tive uma ideia simples para complementar a forma como vocês se apresentam online.${c.gancho}\n\n${c.apresentacaoAtividade}\n\nPosso te mostrar uma ideia de como ficaria?`,
    oportunidade: c => `Oi! Tudo certo? ${c.encontro}${c.ausencia}${c.gancho}\n\n${c.apresentacao} Pensei em uma forma simples de complementar ${c.instagram ? 'o Instagram' : 'a presença online de vocês'} com uma página própria.\n\nPosso te mostrar uma ideia de como ficaria?`,
    problema_sutil: c => `Oi! Tudo bem? ${c.encontro} Fiquei pensando em quem ${c.instagram ? 'abre o perfil' : 'encontra vocês na internet'} e quer saber um pouco mais sobre ${c.nicho.tipo} antes de chamar vocês.${c.gancho}\n\n${c.apresentacaoAtividade} Foi daí que surgiu uma ideia de página para ${c.nicho.tipo}.\n\nPosso te mostrar como ficaria?`,
    visualizacao: c => `Oi! Tudo bem? ${c.encontro}${c.gancho}\n\nImagine a pessoa abrir uma página ${c.nicho.de} e já conseguir ${c.nicho.visual}.\n\n${c.apresentacao}\n\nPosso te mostrar uma ideia de como ficaria?`,
    demonstracao: c => `Oi! Tudo bem? ${c.encontro}${c.gancho}\n\n${c.apresentacao} Tenho uma proposta de página para esse tipo de negócio e um exemplo que ajuda a visualizar bem a ideia.\n\nPosso te mandar?`,
    pergunta: c => `Oi! Tudo certo? ${c.encontro}${c.gancho}\n\nVocês já chegaram a pensar em ter uma página própria ${c.nicho.de}, ${c.instagram ? 'separada do Instagram, ' : ''}reunindo as principais informações e o contato pelo WhatsApp?\n\n${c.apresentacaoAtividade} ${c.demo ? 'Tenho um exemplo de como ficaria. Posso te mandar?' : 'Tenho uma ideia de como poderia ficar. Posso te mostrar?'}`,
    autoridade: c => `Olá! Tudo bem? ${c.encontro}${c.gancho}\n\nMeu nome é ${c.remetente.nome}, sou ${c.remetente.profissao} e trabalho criando sites e páginas para negócios locais.\n\nTive uma ideia de página para apresentar ${c.nicho.beneficio} de forma simples e facilitar o contato pelo WhatsApp.\n\n${c.demo ? 'Posso te mostrar um exemplo de como ficaria?' : 'Posso te mostrar uma ideia de como ficaria?'}`,
    direta: c => `Oi! Tudo bem? ${c.apresentacao}\n\n${c.encontro}${c.ausencia}${c.gancho} Trabalho criando páginas para negócios locais e tive uma ideia que pode se encaixar bem para ${c.nicho.para}.\n\n${c.demo ? 'Gostaria de te mostrar como poderia ficar. Posso te mandar um exemplo?' : 'Gostaria de te mostrar uma ideia de como poderia ficar. Posso te mostrar?'}`
  }
};
if (typeof module !== 'undefined' && module.exports) module.exports = MensagemTemplates;
