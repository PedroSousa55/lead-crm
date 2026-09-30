const WhatsApp = (() => {
  // O prefixo é ajustado só para o link; não modifica o telefone do lead.
  function telefoneParaLink(value) {
    const original = String(value ?? '');
    if (!original.trim() || /[^\d\s()+.\-]/.test(original)) throw new Error('Informe um telefone brasileiro válido com DDD.');
    const digitos = original.replace(/\D/g, '');
    let nacional;
    if ([10, 11].includes(digitos.length)) nacional = digitos;
    else if ([12, 13].includes(digitos.length) && digitos.startsWith('55')) nacional = digitos.slice(2);
    else throw new Error('Informe um telefone brasileiro válido com DDD, com ou sem o código 55.');
    // DDD de dois dígitos; celular começa com 9 e fixo com 2 a 5.
    if (!/^[1-9][1-9](?:9\d{8}|[2-5]\d{7})$/.test(nacional) || /^(\d)\1+$/.test(nacional)) {
      throw new Error('Informe um telefone brasileiro válido com DDD.');
    }
    return '55' + nacional;
  }
  function gerarLink(telefone, mensagem) {
    const numero = telefoneParaLink(telefone);
    if (typeof mensagem !== 'string' || !mensagem.trim()) throw new Error('Gere ou escreva uma mensagem antes de abrir o WhatsApp.');
    return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem);
  }
  return { telefoneParaLink, gerarLink };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = WhatsApp;
