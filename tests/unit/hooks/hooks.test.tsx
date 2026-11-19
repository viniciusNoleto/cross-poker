import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as yup from 'yup';
import { useAnimatedLastAction } from '@/resources/game/hooks/useAnimatedLastAction';
import {
  useBooleanRecordState,
  useImmediateState,
  useRecordState,
  useTrimmedStringState,
  useValidatedFormState,
} from '@/utils/state';
import { useDebouncedEffect, useNotFirstEffect, usePageTitle, useServerSentEvent, useStoppableEffect } from '@/utils/hooks';
import type { IPublicLastAction } from '@/resources/game/models/GameState';

const action = (id: number): IPublicLastAction => ({ id, seat: 0, type: 'meld', created_at: null });

describe('useAnimatedLastAction', () => {
  it('dispara só quando chega uma ação com id novo', () => {
    const { result, rerender } = renderHook(({ last }) => useAnimatedLastAction(last), {
      initialProps: { last: null as IPublicLastAction | null },
    });

    expect(result.current.newAction).toBeNull();

    rerender({ last: action(1) });
    expect(result.current.newAction?.id).toBe(1);

    act(() => result.current.clear());
    expect(result.current.newAction).toBeNull();

    // Mesmo id em um novo snapshot (objeto diferente): não dispara de novo.
    rerender({ last: { ...action(1) } });
    expect(result.current.newAction).toBeNull();

    rerender({ last: action(2) });
    expect(result.current.newAction?.id).toBe(2);
  });

  it('newAction fica preenchida até o clear()', () => {
    const { result, rerender } = renderHook(({ last }) => useAnimatedLastAction(last), {
      initialProps: { last: action(5) },
    });

    rerender({ last: action(5) });

    expect(result.current.newAction?.id).toBe(5);
  });
});

describe('utils/state', () => {
  it('useTrimmedStringState apara o valor', () => {
    const { result } = renderHook(() => useTrimmedStringState(''));

    act(() => result.current[1]('  Ana  '));
    expect(result.current[0]).toBe('Ana');

    act(() => result.current[1](''));
    expect(result.current[0]).toBe('');
  });

  it('useImmediateState atualiza de forma síncrona', () => {
    const { result } = renderHook(() => useImmediateState(1));

    act(() => result.current[1](2));

    expect(result.current[0]).toBe(2);
  });

  it('useRecordState: setValue e field por caminho', () => {
    const { result } = renderHook(() => useRecordState({ filters: { search: '' }, page: 1 }));

    act(() => result.current.setValue('filters.search', 'abc'));
    expect(result.current.state.filters.search).toBe('abc');

    expect(result.current.field('page').value).toBe(1);
    act(() => result.current.field('page').onChange(3));
    expect(result.current.state.page).toBe(3);
  });

  it('useBooleanRecordState', () => {
    const { result } = renderHook(() => useBooleanRecordState<'a' | 'b'>({ a: false, b: undefined }));

    act(() => result.current.setValue('a', true));

    expect(result.current.state).toEqual({ a: true, b: undefined });
  });

  describe('useValidatedFormState', () => {
    const schema = yup.object({
      name: yup.string().default('').required('obrigatório').max(5, 'longo'),
      code: yup.string().default('').required('código obrigatório'),
    });

    it('começa com o default do schema', () => {
      const { result } = renderHook(() => useValidatedFormState(schema));

      expect(result.current.state).toEqual({ name: '', code: '' });
    });

    it('validate() preenche os erros de todos os campos', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useValidatedFormState(schema));
      let valid = true;

      await act(async () => {
        valid = await result.current.validate();
      });

      expect(valid).toBe(false);
      expect(result.current.field('name').error).toBe('obrigatório');
      expect(result.current.field('code').error).toBe('código obrigatório');
    });

    it('validate() com tudo certo → true', async () => {
      const { result } = renderHook(() => useValidatedFormState(schema));

      act(() => {
        result.current.setValue('name', 'Ana');
        result.current.setValue('code', 'X');
      });

      await expect(result.current.validate()).resolves.toBe(true);
    });

    it('onValidate valida só o campo e limpa o erro antigo', async () => {
      const { result } = renderHook(() => useValidatedFormState(schema));

      act(() => result.current.field('name').onChange('nome comprido'));
      await act(async () => {
        result.current.field('name').onValidate();
      });

      await vi.waitFor(() => expect(result.current.field('name').error).toBe('longo'));
      expect(result.current.field('code').error).toBeUndefined();

      act(() => result.current.field('name').onChange('Ana'));
      await act(async () => {
        result.current.field('name').onValidate();
      });

      expect(result.current.field('name').error).toBeUndefined();
    });
  });
});

describe('utils/hooks', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('useServerSentEvent assina o evento state-changed e fecha ao desmontar', () => {
    const instances: any[] = [];

    vi.stubGlobal('EventSource', class {
      listeners: Record<string, () => void> = {};

      close = vi.fn();

      constructor(public url: string) {
        instances.push(this);
      }

      addEventListener(event: string, handler: () => void) {
        this.listeners[event] = handler;
      }
    });

    const onEvent = vi.fn();
    const { unmount, rerender } = renderHook(({ url }) => useServerSentEvent(url, onEvent), {
      initialProps: { url: '/api/games/1/stream' as string | null },
    });

    expect(instances[0].url).toBe('/api/games/1/stream');

    instances[0].listeners['state-changed']();
    expect(onEvent).toHaveBeenCalledTimes(1);

    rerender({ url: null });
    expect(instances[0].close).toHaveBeenCalled();
    expect(instances).toHaveLength(1);

    unmount();
  });

  it('usePageTitle monta o título com a marca e restaura ao sair', () => {
    document.title = 'antes';

    const { unmount } = renderHook(() => usePageTitle('Sala', 'ABC'));

    expect(document.title).toMatch(/^Sala \| ABC \| /);

    unmount();
    expect(document.title).toBe('antes');
  });

  it('useNotFirstEffect ignora a primeira execução', () => {
    const effect = vi.fn();
    const { rerender } = renderHook(({ dep }) => useNotFirstEffect(effect, [dep]), { initialProps: { dep: 1 } });

    expect(effect).not.toHaveBeenCalled();

    rerender({ dep: 2 });
    rerender({ dep: 3 });

    expect(effect).toHaveBeenCalled();
  });

  it('useDebouncedEffect agrupa mudanças dentro do intervalo', () => {
    vi.useFakeTimers();

    const effect = vi.fn();
    const { rerender } = renderHook(({ dep }) => useDebouncedEffect(effect, [dep], 500), { initialProps: { dep: 'a' } });

    rerender({ dep: 'ab' });
    rerender({ dep: 'abc' });
    rerender({ dep: 'abcd' });
    act(() => vi.advanceTimersByTime(600));

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('useStoppableEffect para de rodar depois do stop()', () => {
    const effect = vi.fn();
    const { result, rerender } = renderHook(({ dep }) => useStoppableEffect(effect, [dep]), { initialProps: { dep: 1 } });

    expect(effect).toHaveBeenCalledTimes(1);

    result.current();
    rerender({ dep: 2 });

    expect(effect).toHaveBeenCalledTimes(1);
  });
});
