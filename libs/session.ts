import 'server-only';

import { cookies } from 'next/headers';

const COOKIE_PREFIX = 'cp_session_';

const MAX_AGE_SECONDS = 60 * 60 * 24;

export async function setRoomSessionCookie(roomCode: string, token: string) {
  const store = await cookies();

  store.set(`${COOKIE_PREFIX}${roomCode}`, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getRoomSessionToken(roomCode: string): Promise<string | null> {
  const store = await cookies();

  return store.get(`${COOKIE_PREFIX}${roomCode}`)?.value ?? null;
}
