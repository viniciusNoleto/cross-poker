import { appClient } from '@/utils/app-client';
import { PayloadBody } from '@/shared/types/api';
import { IRoomState } from '../models/RoomPlayer';

export type CreateRoomServicePayload = {
  name: string;
};

export function createRoomService({ body }: PayloadBody<CreateRoomServicePayload>) {
  return appClient.post<IRoomState>('/api/rooms', { body });
}
