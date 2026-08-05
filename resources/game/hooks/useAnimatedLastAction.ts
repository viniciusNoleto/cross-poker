'use client';

import { useEffect, useRef, useState } from 'react';
import type { IPublicLastAction } from '../models/GameState';

// Only fires when a NEW action arrives in `lastAction` (id different from the last one seen).
// Each animation layer (Meld/Discard/Swap/Draw) uses this to know "what just happened"
// without duplicating the "have I seen this id" tracking — see game-concept.md, "Animações".
// `newAction` stays filled until the animation layer itself calls `clear()` once it's done
// playing (each animation decides its own duration; this only delivers the trigger).
export function useAnimatedLastAction(lastAction: IPublicLastAction | null) {
  const [newAction, setNewAction] = useState<IPublicLastAction | null>(null);
  const lastSeenId = useRef<number | null>(null);

  useEffect(() => {
    if (!lastAction || lastAction.id === lastSeenId.current) return;

    lastSeenId.current = lastAction.id;
    setNewAction(lastAction);
  }, [lastAction]);

  function clear() {
    setNewAction(null);
  }

  return { newAction, clear };
}
