import { appClient } from '@/utils/app-client';
import { PayloadBody } from '@/shared/types/api';

export type StartSwapServicePayload = {
  quantity: number;
};

export function startSwapService({ gameId, body }: PayloadBody<StartSwapServicePayload> & { gameId: number }) {
  return appClient.post<null>(`/api/games/${gameId}/swap/start`, { body });
}
