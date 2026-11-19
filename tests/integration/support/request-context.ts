import { AsyncLocalStorage } from 'node:async_hooks';

export type CookieOptions = { httpOnly?: boolean; secure?: boolean; sameSite?: string; path?: string; maxAge?: number };

/** Cookies de um "navegador" (um jogador) entre requisições. */
export class CookieJar {
  values = new Map<string, string>();

  options = new Map<string, CookieOptions>();
}

export type RequestContext = { jar: CookieJar; headers: Headers };

/**
 * O `cookies()`/`headers()` do `next/headers` só funcionam dentro de uma requisição do Next. Nos
 * testes, cada chamada a um Route Handler roda dentro deste contexto (ver `api.ts`), e o mock de
 * `next/headers` (ver `setup.ts`) lê/escreve o cookie jar do jogador que fez a requisição — inclusive
 * com requisições concorrentes.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentContext(): RequestContext {
  const context = requestContext.getStore();

  if (!context) throw new Error('next/headers usado fora de uma requisição de teste');

  return context;
}
