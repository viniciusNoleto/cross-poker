import { appClient } from '@/utils/app-client';
import { PayloadBody } from '@/shared/types/api';
import { EDrawSource } from '../enums/EDrawSource';

export type PlayMeldServicePayload = {
  cards: string[];
  // Where the replacement cards come from — chosen together with the play (single step).
  source: `${EDrawSource}`;
};

export function playMeldService({ gameId, body }: PayloadBody<PlayMeldServicePayload> & { gameId: number }) {
  return appClient.post<null>(`/api/games/${gameId}/meld`, { body });
}
