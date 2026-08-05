import type { IRoom } from './Room';

export interface IRoomPlayer {
  id: number;
  room_id: number;
  name: string;
  seat: number;
  is_host: boolean;
  connected_at: string | null;
  created_at: string | null;
}

export interface IRoomState {
  room: IRoom;
  players: IRoomPlayer[];
  you: IRoomPlayer | null;
  game_id: number | null;
}
