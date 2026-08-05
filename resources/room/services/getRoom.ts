import { appClient } from '@/utils/app-client';
import { QueryFnCtx } from '@/shared/types/tanstack';
import { IRoomState } from '../models/RoomPlayer';

export const GET_ROOM_KEY = (code: string) => ['get-room', code];

export function getRoomService({ signal, code }: QueryFnCtx & { code: string }) {
  return appClient.get<IRoomState>(`/api/rooms/${code}`, { signal });
}
