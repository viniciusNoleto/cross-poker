import { appClient } from '@/utils/app-client';
import { PayloadBody } from '@/shared/types/api';
import { EDrawSource } from '../enums/EDrawSource';

export type PlayDiscardServicePayload = {
  cards: string[];
  // Where the replacement cards come from — chosen together with the discard (single step).
  source: `${EDrawSource}`;
};

export function playDiscardService({ gameId, body }: PayloadBody<PlayDiscardServicePayload> & { gameId: number }) {
  return appClient.post<null>(`/api/games/${gameId}/discard`, { body });
}
