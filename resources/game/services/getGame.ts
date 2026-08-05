import { appClient } from '@/utils/app-client';
import { QueryFnCtx } from '@/shared/types/tanstack';
import { IGameState } from '../models/GameState';

export const GET_GAME_KEY = (gameId: number) => ['get-game', gameId];

export function getGameService({ signal, gameId }: QueryFnCtx & { gameId: number }) {
  return appClient.get<IGameState>(`/api/games/${gameId}`, { signal });
}
