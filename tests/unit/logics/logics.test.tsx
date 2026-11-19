import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { gameState } from '../../support/factories';
import { hookWrapper, renderWithProviders } from '../../support/render';

const services = vi.hoisted(() => ({
  playMeld: vi.fn(),
  playDiscard: vi.fn(),
  startSwap: vi.fn(),
  chooseSwap: vi.fn(),
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
}));

vi.mock('@/resources/game/services/playMeld', () => ({ playMeldService: services.playMeld }));
vi.mock('@/resources/game/services/playDiscard', () => ({ playDiscardService: services.playDiscard }));
vi.mock('@/resources/game/services/startSwap', () => ({ startSwapService: services.startSwap }));
vi.mock('@/resources/game/services/chooseSwap', () => ({ chooseSwapService: services.chooseSwap }));
vi.mock('@/resources/room/services/createRoom', () => ({ createRoomService: services.createRoom }));
vi.mock('@/resources/room/services/joinRoom', () => ({ joinRoomService: services.joinRoom }));

const { PlayMeldLogicComponent, usePlayMeldLogicData } = await import('@/resources/game/logics/PlayMeld');
const { PlayDiscardLogicComponent, usePlayDiscardLogicData } = await import('@/resources/game/logics/PlayDiscard');
const {
  ChooseSwapLogicComponent,
  PendingSwapBanner,
  StartSwapLogicComponent,
  useChooseSwapLogicData,
  useStartSwapLogicData,
} = await import('@/resources/game/logics/PlaySwap');
const { CreateRoomLogicComponent, useCreateRoomLogicData } = await import('@/resources/room/logics/CreateRoom');
const { JoinRoomLogicComponent, useJoinRoomLogicData } = await import('@/resources/room/logics/JoinRoom');
const { sounds } = await import('@/utils/sound');

/**
 * O erro como o `appClient` (ofetch) realmente lança: `FetchError`, com `message` em texto
 * ("[POST] ...: 403 Forbidden") e o envelope da API (`{ success, message: {pt-br,...}, data }`) em `data`.
 */
function fetchError(status: number, ptMessage: string) {
  const error = new Error(`[POST] "/api": ${status}`);

  error.name = 'FetchError';

  Object.defineProperty(error, 'data', { value: { success: false, message: { 'pt-br': ptMessage, 'es-mx': ptMessage, 'en-us': ptMessage }, data: null } });
  Object.defineProperty(error, 'status', { value: status });

  return error;
}

const apiError = fetchError(403, 'Não é a sua vez de jogar.');

// BUG conhecido (documentado aqui, não corrigido): as logics fazem `resolveApiMessage(err.message)`
// esperando o objeto i18n, mas o `FetchError` traz `message` em texto e o envelope da API em
// `err.data`. Resultado: a notificação de erro sai só com o título "Erro", sem a explicação
// ("Não é a sua vez de jogar.", "Sala não encontrada."…). Os `it.fails` abaixo passam a acusar
// quando for corrigido — aí é só trocar por `it`.
const ok = <T,>(data: T) => ({ success: true, message: { 'pt-br': 'ok', 'es-mx': 'ok', 'en-us': 'ok' }, data });

beforeEach(() => {
  Object.values(services).forEach((service) => service.mockReset());
  vi.spyOn(notifications, 'show');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PlayMeld', () => {
  it('botão habilitado só com 1 a 5 cartas e na sua vez; o clique só abre a escolha da origem', async () => {
    const onChooseSource = vi.fn();
    const { user, rerender } = renderWithProviders(
      <PlayMeldLogicComponent
        selectedCards={[]}
        remaining={5}
        onChooseSource={onChooseSource}
      />,
    );

    expect(screen.getByRole('button', { name: 'Jogada' })).toBeDisabled();

    rerender(
      <PlayMeldLogicComponent
        selectedCards={['a', 'b', 'c', 'd', 'e', 'f']}
        remaining={5}
        onChooseSource={onChooseSource}
      />,
    );
    expect(screen.getByRole('button', { name: 'Jogada' })).toBeDisabled();

    rerender(
      <PlayMeldLogicComponent
        selectedCards={['a']}
        disabled
        remaining={5}
        onChooseSource={onChooseSource}
      />,
    );
    expect(screen.getByRole('button', { name: 'Jogada' })).toBeDisabled();

    rerender(
      <PlayMeldLogicComponent
        selectedCards={['a', 'b']}
        remaining={5}
        onChooseSource={onChooseSource}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Jogada' }));

    expect(onChooseSource).toHaveBeenCalledTimes(1);

    rerender(
      <PlayMeldLogicComponent
        selectedCards={['a', 'b']}
        remaining={0}
        onChooseSource={onChooseSource}
      />,
    );
    expect(screen.getByRole('button', { name: 'Jogada' })).toBeDisabled();
    expect(services.playMeld).not.toHaveBeenCalled();
  });

  it('mutação envia cartas + origem numa requisição só', async () => {
    services.playMeld.mockResolvedValue(ok(null));

    const onSuccess = vi.fn();
    const { result } = renderHook(() => usePlayMeldLogicData({ gameId: 4, onSuccess }), { wrapper: hookWrapper() });

    act(() => result.current.playMeldMutation.mutate({ cards: ['hearts-A-1'], source: 'deck' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(services.playMeld).toHaveBeenCalledWith({ gameId: 4, body: { cards: ['hearts-A-1'], source: 'deck' } });
  });

  it('erro da API mostra uma notificação vermelha de erro', async () => {
    services.playMeld.mockRejectedValue(apiError);

    const { result } = renderHook(() => usePlayMeldLogicData({ gameId: 4, onSuccess: vi.fn() }), { wrapper: hookWrapper() });

    act(() => result.current.playMeldMutation.mutate({ cards: ['x'], source: 'deck' }));

    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro', color: 'red' })));
  });

  it.fails('erro da API mostra a mensagem do servidor (bug conhecido)', async () => {
    services.playMeld.mockRejectedValue(apiError);

    const { result } = renderHook(() => usePlayMeldLogicData({ gameId: 4, onSuccess: vi.fn() }), { wrapper: hookWrapper() });

    act(() => result.current.playMeldMutation.mutate({ cards: ['x'], source: 'deck' }));

    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Não é a sua vez de jogar.', color: 'red' })));
  });

  it('erro sem mensagem usa o texto padrão', async () => {
    services.playMeld.mockRejectedValue(new Error());

    const { result } = renderHook(() => usePlayMeldLogicData({ gameId: 4, onSuccess: vi.fn() }), { wrapper: hookWrapper() });

    act(() => result.current.playMeldMutation.mutate({ cards: ['x'], source: 'deck' }));

    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/Jogada/) })));
  });
});

describe('PlayDiscard', () => {
  it('desabilitado fora da vez ou sem seleção válida', async () => {
    const onChooseSource = vi.fn();
    const { user, rerender } = renderWithProviders(
      <PlayDiscardLogicComponent
        selectedCards={['a']}
        canPlay={false}
        remaining={5}
        onChooseSource={onChooseSource}
      />,
    );

    expect(screen.getByRole('button', { name: 'Descarte' })).toBeDisabled();

    rerender(
      <PlayDiscardLogicComponent
        selectedCards={[]}
        canPlay
        remaining={5}
        onChooseSource={onChooseSource}
      />,
    );
    expect(screen.getByRole('button', { name: 'Descarte' })).toBeDisabled();

    rerender(
      <PlayDiscardLogicComponent
        selectedCards={['a', 'b', 'c']}
        canPlay
        remaining={5}
        onChooseSource={onChooseSource}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Descarte' }));

    expect(onChooseSource).toHaveBeenCalled();
  });

  it('mutação e erro', async () => {
    services.playDiscard.mockResolvedValueOnce(ok(null)).mockRejectedValueOnce(apiError);

    const onSuccess = vi.fn();
    const { result } = renderHook(() => usePlayDiscardLogicData({ gameId: 2, onSuccess }), { wrapper: hookWrapper() });

    act(() => result.current.playDiscardMutation.mutate({ cards: ['a'], source: 'discard' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(services.playDiscard).toHaveBeenCalledWith({ gameId: 2, body: { cards: ['a'], source: 'discard' } });

    act(() => result.current.playDiscardMutation.mutate({ cards: ['a'], source: 'discard' }));
    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red' })));
  });
});

describe('Troca — fase 1 (StartSwap)', () => {
  function StartSwapHarness({ onSuccess }: { onSuccess: () => void }) {
    const logicData = useStartSwapLogicData({ gameId: 8, onSuccess });

    return (
      <StartSwapLogicComponent
        logicData={logicData}
        disabled={false}
        partnerName="Carla"
      />
    );
  }

  it('abre o modal, ajusta a quantidade (1..5) e confirma', async () => {
    services.startSwap.mockResolvedValue(ok(null));

    const onSuccess = vi.fn();
    const { user } = renderWithProviders(<StartSwapHarness onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: 'Troca' }));
    expect(sounds.chooseSwap).toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog', { name: 'Troca' });

    expect(dialog).toHaveTextContent('Carla entrega');
    expect(dialog).toHaveTextContent('Cada um escolhe 1 carta(s) em segredo para trocar.');

    const quantity = screen.getByRole('textbox');

    await user.clear(quantity);
    await user.type(quantity, '3');
    expect(sounds.swapCardAppear).toHaveBeenCalled();
    expect(dialog).toHaveTextContent('Cada um escolhe 3 carta(s)');

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(services.startSwap).toHaveBeenCalledWith({ gameId: 8, body: { quantity: 3 } });
    expect(sounds.swapDeal).toHaveBeenCalled();
  });

  it('Cancelar fecha sem enviar', async () => {
    const { user } = renderWithProviders(<StartSwapHarness onSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Troca' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(services.startSwap).not.toHaveBeenCalled();
  });

  it.fails('erro da API mostra a mensagem do servidor (bug conhecido)', async () => {
    services.startSwap.mockRejectedValue(apiError);

    const { user } = renderWithProviders(<StartSwapHarness onSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Troca' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Não é a sua vez de jogar.' })));
  });
});

describe('Troca — fase 2 (ChooseSwap)', () => {
  const pending = (overrides = {}) => ({
    initiator_seat: 0,
    partner_seat: 2,
    quantity: 2,
    initiator_ready: false,
    partner_ready: false,
    ...overrides,
  });

  function ChooseHarness({ state, selected, setSelected }: { state: ReturnType<typeof gameState>; selected: string[]; setSelected: (v: string[]) => void }) {
    const logicData = useChooseSwapLogicData({ gameId: 8, onSuccess: vi.fn() });

    return (
      <ChooseSwapLogicComponent
        state={state}
        selectedCards={selected}
        setSelectedCards={setSelected}
        logicData={logicData}
      />
    );
  }

  it('pede exatamente N cartas e confirma; limpa a seleção ao concluir', async () => {
    services.chooseSwap.mockResolvedValue(ok({ waiting_for_partner: true }));

    const setSelected = vi.fn();
    const state = gameState({ pending_swap: pending() });
    const { user, rerender } = renderWithProviders(
      <ChooseHarness
        state={state}
        selected={['a']}
        setSelected={setSelected}
      />,
    );

    expect(screen.getByText('Escolha 2 carta(s) da sua mão para a troca (1/2)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar troca' })).toBeDisabled();

    rerender(
      <ChooseHarness
        state={state}
        selected={['a', 'b']}
        setSelected={setSelected}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar troca' }));

    await waitFor(() => expect(setSelected).toHaveBeenCalledWith([]));
    expect(services.chooseSwap).toHaveBeenCalledWith({ gameId: 8, body: { cards: ['a', 'b'] } });
    expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/Aguardando seu parceiro/) }));
  });

  it('quando a troca se completa, avisa "Troca concluída!"', async () => {
    services.chooseSwap.mockResolvedValue(ok({ waiting_for_partner: false }));

    const { user } = renderWithProviders(
      <ChooseHarness
        state={gameState({ pending_swap: pending({ initiator_ready: true }) }, 2)}
        selected={['a', 'b']}
        setSelected={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Confirmar troca' }));

    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Troca concluída!' })));
  });

  it('quem já escolheu só espera', () => {
    renderWithProviders(
      <ChooseHarness
        state={gameState({ pending_swap: pending({ initiator_ready: true }) })}
        selected={[]}
        setSelected={vi.fn()}
      />,
    );

    expect(screen.getByText('Aguardando seu parceiro escolher as cartas da troca...')).toBeInTheDocument();
  });

  it('quem não participa da troca não vê nada', () => {
    const { container } = renderWithProviders(
      <ChooseHarness
        state={gameState({ pending_swap: pending() }, 1)}
        selected={[]}
        setSelected={vi.fn()}
      />,
    );

    expect(container.querySelector('button')).toBeNull();
  });

  it('PendingSwapBanner anuncia a troca para todos', () => {
    renderWithProviders(<PendingSwapBanner state={gameState({ pending_swap: pending({ initiator_seat: 1, partner_seat: 3 }) })} />);

    expect(screen.getByText('Troca em andamento entre Bruno e Diego...')).toBeInTheDocument();
  });

  it('PendingSwapBanner sem troca → nada', () => {
    const { container } = renderWithProviders(<PendingSwapBanner state={gameState()} />);

    expect(container.querySelector('span')).toBeNull();
  });
});

describe('Sala — criar e entrar', () => {
  const roomState = { room: { id: 1, code: 'ABC234', status: 'waiting', created_at: null }, players: [], you: null, game_id: null };

  function CreateHarness({ onSuccess }: { onSuccess: (s: any) => void }) {
    return <CreateRoomLogicComponent logicData={useCreateRoomLogicData({ onSuccess })} />;
  }

  function JoinHarness({ onSuccess }: { onSuccess: (s: any) => void }) {
    return <JoinRoomLogicComponent logicData={useJoinRoomLogicData({ onSuccess })} />;
  }

  it('criar sala: nome obrigatório', async () => {
    const { user } = renderWithProviders(<CreateHarness onSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Criar sala' }));

    expect(services.createRoom).not.toHaveBeenCalled();
  });

  it('criar sala com nome', async () => {
    services.createRoom.mockResolvedValue(ok(roomState));

    const onSuccess = vi.fn();
    const { user } = renderWithProviders(<CreateHarness onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/Seu nome/), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Criar sala' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(roomState));
    expect(services.createRoom).toHaveBeenCalledWith({ body: { name: 'Ana' } });
  });

  it.fails('criar sala: erro da API mostra a mensagem do servidor (bug conhecido)', async () => {
    services.createRoom.mockRejectedValue(fetchError(500, 'Erro ao criar sala.'));

    const { user } = renderWithProviders(<CreateHarness onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/Seu nome/), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Criar sala' }));

    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Erro ao criar sala.' })));
  });

  it('entrar: o código vai em maiúsculas e sem espaços', async () => {
    services.joinRoom.mockResolvedValue(ok(roomState));

    const onSuccess = vi.fn();
    const { user } = renderWithProviders(<JoinHarness onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/Seu nome/), 'Bruno');
    await user.type(screen.getByLabelText(/Código da sala/), ' abc234 ');
    await user.click(screen.getByRole('button', { name: 'Entrar na sala' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(services.joinRoom).toHaveBeenCalledWith({ code: 'ABC234', body: { name: 'Bruno' } });
  });

  it('entrar: código obrigatório', async () => {
    const { user } = renderWithProviders(<JoinHarness onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/Seu nome/), 'Bruno');
    await user.click(screen.getByRole('button', { name: 'Entrar na sala' }));

    expect(services.joinRoom).not.toHaveBeenCalled();
  });

  it.fails('entrar: sala não encontrada mostra a mensagem do servidor (bug conhecido)', async () => {
    services.joinRoom.mockRejectedValue(fetchError(404, 'Sala não encontrada.'));

    const { user } = renderWithProviders(<JoinHarness onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/Seu nome/), 'Bruno');
    await user.type(screen.getByLabelText(/Código da sala/), 'ZZZZZZ');
    await user.click(screen.getByRole('button', { name: 'Entrar na sala' }));

    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Sala não encontrada.' })));
  });
});
