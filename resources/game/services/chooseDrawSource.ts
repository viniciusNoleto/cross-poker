import { appClient } from '@/utils/app-client';
import { PayloadBody } from '@/shared/types/api';
import { EDrawSource } from '../enums/EDrawSource';

export type ChooseDrawSourceServicePayload = {
  source: `${EDrawSource}`;
};

export function chooseDrawSourceService({ gameId, body }: PayloadBody<ChooseDrawSourceServicePayload> & { gameId: number }) {
  return appClient.post<null>(`/api/games/${gameId}/draw`, { body });
}
