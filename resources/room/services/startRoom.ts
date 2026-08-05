import { appClient } from '@/utils/app-client';

export function startRoomService({ code }: { code: string }) {
  return appClient.post<{ game_id: number }>(`/api/rooms/${code}/start`, { body: {} });
}
