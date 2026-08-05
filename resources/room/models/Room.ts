import type { ERoomStatus } from '../enums/ERoomStatus';

export interface IRoom {
  id: number;
  code: string;
  status: `${ERoomStatus}`;
  created_at: string | null;
}
