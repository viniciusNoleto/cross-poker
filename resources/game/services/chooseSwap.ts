import { appClient } from '@/utils/app-client';
import { PayloadBody } from '@/shared/types/api';

export type ChooseSwapServicePayload = {
  cards: string[];
};

export type ChooseSwapServiceResponse = {
  waiting_for_partner: boolean;
};

export function chooseSwapService({ gameId, body }: PayloadBody<ChooseSwapServicePayload> & { gameId: number }) {
  return appClient.post<ChooseSwapServiceResponse>(`/api/games/${gameId}/swap/choose`, { body });
}
