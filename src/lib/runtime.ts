import type { DevEnvironment } from './environment';

let environment: DevEnvironment | undefined;

export function initializeDevRuntime(config: DevEnvironment): void {
  if (environment) throw new Error('O ambiente DEV ja foi inicializado.');
  environment = Object.freeze({ ...config });
}

export function requireDevEnvironment(): DevEnvironment {
  if (!environment) throw new Error('Conexao bloqueada: ambiente DEV nao configurado e validado.');
  return environment;
}
