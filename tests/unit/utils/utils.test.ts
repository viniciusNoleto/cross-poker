import { describe, expect, it } from 'vitest';
import { resolveApiMessage } from '@/utils/apiMessage';
import { getter } from '@/utils/data';
import { formatCpf, formatPhone } from '@/utils/format';
import { chain, mapper } from '@/utils/chain';
import { cn } from '@/utils/ui';
import { cn as libsCn } from '@/libs/utils';
import { nFor } from '@/components/utils/For';

const message = { 'pt-br': 'Olá', 'es-mx': 'Hola', 'en-us': 'Hello' };

describe('resolveApiMessage', () => {
  it('escolhe a tradução do idioma pedido', () => {
    expect(resolveApiMessage(message, 'es-mx')).toBe('Hola');
    expect(resolveApiMessage(message, 'en-us')).toBe('Hello');
  });

  it('idioma desconhecido cai no pt-br', () => {
    expect(resolveApiMessage(message, 'fr-fr')).toBe('Olá');
  });
});

describe('getter', () => {
  const obj = { a: { b: [10, 20] }, name: 'x' };

  it('caminho em string (lodash get)', () => {
    expect(getter(obj, 'a.b[1]')).toBe(20);
  });

  it('função', () => {
    expect(getter(obj, (o: typeof obj) => o.name.toUpperCase())).toBe('X');
  });

  it('sem hook devolve o próprio objeto', () => {
    expect(getter(obj)).toBe(obj);
  });
});

describe('format', () => {
  it('formatCpf', () => {
    expect(formatCpf('12345678901')).toBe('123.456.789-01');
    expect(formatCpf('123')).toBe('123');
    expect(formatCpf(null)).toBe('—');
  });

  it('formatPhone', () => {
    expect(formatPhone('5511987654321')).toBe('+55 (11) 98765-4321');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(formatPhone('123')).toBe('123');
    expect(formatPhone(undefined)).toBe('—');
  });
});

describe('chain / mapper', () => {
  it('encadeia as transformações sobre a Promise', async () => {
    const result = await chain(Promise.resolve(2), (n: number) => n * 10, (n: number) => `${n}!`);

    expect(result).toBe('20!');
  });

  it('mapper troca o `data` mantendo o envelope', async () => {
    const response = { data: [1, 2], message };
    const result = await chain(Promise.resolve(response), mapper((res: typeof response) => res.data.length));

    expect(result).toEqual({ data: 2, message });
  });
});

describe('cn', () => {
  it('junta classes e resolve conflitos do Tailwind', () => {
    expect(cn('p-2', false && 'hidden', 'p-4')).toBe('p-4');
    expect(libsCn('text-sm', { 'font-bold': true })).toBe('text-sm font-bold');
  });
});

describe('nFor', () => {
  it('gera [0..n-1]', () => {
    expect(nFor(3)).toEqual([0, 1, 2]);
    expect(nFor(0)).toEqual([]);
  });
});
