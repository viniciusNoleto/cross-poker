import { appClient } from '@/utils/app-client';
import { PayloadBody } from '@/shared/types/api';
import { ECombo } from '../enums/ECombo';
import type { ICard } from '../models/Card';

export type PlayMeldServicePayload = {
  cards: string[];
};

export type PlayMeldServiceResponse = {
  points_scored: number;
  combo: `${ECombo}`;
  melded_cards: ICard[];
  scoring_cards: ICard[];
  chips: number;
  multiplier: number;
};

export function playMeldService({ gameId, body }: PayloadBody<PlayMeldServicePayload> & { gameId: number }) {
  return appClient.post<PlayMeldServiceResponse>(`/api/games/${gameId}/meld`, { body });
}
