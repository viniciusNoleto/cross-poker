import { appClient } from '@/utils/app-client';
import { PayloadBody } from '@/shared/types/api';

export type PlayDiscardServicePayload = {
  cards: string[];
};

export function playDiscardService({ gameId, body }: PayloadBody<PlayDiscardServicePayload> & { gameId: number }) {
  return appClient.post<null>(`/api/games/${gameId}/discard`, { body });
}
