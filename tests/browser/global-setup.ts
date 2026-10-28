import { createServer } from 'vite';

export default async function setup() {
  process.env.PORTARIA_OFFLINE = '1';
  process.env.PORTARIA_TEST_PORT='5273';
  const server = await createServer({ mode: 'devcloud' });
  try { await server.listen(); }
  catch (error) { await server.close(); throw error; }
  process.env.PORTARIA_DEMO_PORT='5274';
  const demo=await createServer({mode:'demo'});
  try { await demo.listen(); }catch(error){await demo.close();await server.close();throw error;}
  return async () => {
    server.ws.close();
    if (server.httpServer && 'closeAllConnections' in server.httpServer) {
      server.httpServer.closeAllConnections();
    }
    await server.close();
    demo.ws.close();
    if(demo.httpServer&&'closeAllConnections'in demo.httpServer)demo.httpServer.closeAllConnections();
    await demo.close();
  };
}
