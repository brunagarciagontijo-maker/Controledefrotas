// Perfil mais restritivo: ignora arquivos de ambiente e nao habilita o cliente.
process.env.PORTARIA_OFFLINE = '1';
const { createServer } = await import('vite');
const server = await createServer({ mode: 'devcloud' });
await server.listen();
server.printUrls();
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async () => {
  server.ws.close(); server.httpServer?.closeAllConnections();
  await server.close(); process.exit(0);
});
