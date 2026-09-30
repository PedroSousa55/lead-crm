const path = require("node:path");
const express = require("express");
const cors = require("cors");
const { port } = require("./config/env");
const clienteRoutes = require("./routes/clienteRoutes.js");

const app = express();
app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      const isLocal =
        !origin ||
        /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
      callback(null, isLocal);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposedHeaders: ['Content-Disposition', 'X-Restauracao-Token'],
    exposedHeaders: ['Content-Disposition', 'X-Restauracao-Token'],
  }),
);
app.use('/api', require('./routes/dadosRoutes'));
app.use('/api/metricas', require('./routes/metricasRoutes'));
app.use(express.json({ limit: "100kb" }));
app.use('/api/configuracoes', require('./routes/configuracaoRoutes'));
app.use("/api/clientes", clienteRoutes);
app.use("/api", (req, res) =>
  res.status(404).json({ erro: "Rota não encontrada." }),
);
app.use(express.static(path.resolve(__dirname, "../frontend")));
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ erro: "O JSON enviado é inválido." });
  }
  if (error.type === "entity.too.large") {
    return res
      .status(413)
      .json({ erro: "Os dados enviados excedem o tamanho permitido." });
  }
  console.error("Falha na API:", error.code || "ERRO_INTERNO");
  res.status(500).json({ erro: "Ocorreu um erro na API. Tente novamente." });
});

if (require.main === module) {
  const server = app.listen(port, "127.0.0.1", () => {
    console.log(`Lead CRM disponível em http://127.0.0.1:${port}`);
  });
  server.on("error", (error) => {
    console.error(
      "Não foi possível iniciar a API:",
      error.code || "ERRO_SERVIDOR",
    );
    process.exitCode = 1;
  });
}
module.exports = app;
