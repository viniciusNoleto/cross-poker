import { appClient } from '@/utils/app-client';
import { PayloadBody } from '@/shared/types/api';
import { IRoomState } from '../models/RoomPlayer';

export type JoinRoomServicePayload = {
  name: string;
};

export function joinRoomService({ code, body }: PayloadBody<JoinRoomServicePayload> & { code: string }) {
  return appClient.post<IRoomState>(`/api/rooms/${code}/join`, { body });
}
