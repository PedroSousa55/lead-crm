// Regra compartilhada pelo navegador e pela validação da API.
function urlInstagram(value) {
  if (typeof value !== "string") return null;
  const texto = value.trim();
  let usuario;
  if (texto.startsWith("@")) usuario = texto.slice(1);
  else {
    try {
      const url = new URL(texto);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        !["instagram.com", "www.instagram.com"].includes(
          url.hostname.toLowerCase(),
        ) ||
        url.username ||
        url.password ||
        url.port
      )
        return null;
      const perfil = url.pathname.match(/^\/([^/]+)\/?$/);
      if (!perfil) return null;
      usuario = decodeURIComponent(perfil[1]);
    } catch {
      return null;
    }
  }
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(usuario)) return null;
  return "https://www.instagram.com/" + usuario + "/";
}
if (typeof module !== "undefined" && module.exports)
  module.exports = { urlInstagram };
