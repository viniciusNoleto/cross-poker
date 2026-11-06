'use client';

import { useState } from 'react';
import { Modal } from '@mantine/core';
import { FormButton } from '@/components/form/Button';
import { UtilsFor } from '@/components/utils/For';
import { UtilsIf } from '@/components/utils/If';
import { Card } from './Card';
import type { ICard } from '../models/Card';

export type IComboInfo = {
  id: string;
  name: string;
  baseChips: number;
  multiplier: number;
  cards: ICard[];
  note?: string;
};

// Source of truth: .claude/rules/game-concept.md, section 2, "Combinações e pontuação".
// Don't change these values without updating that document too.
export const COMBOS: IComboInfo[] = [
  {
    id: 'high_card',
    name: 'Carta Alta',
    baseChips: 5,
    multiplier: 1,
    cards: [
      { id: 'spades-K-1', suit: 'spades', rank: 'K' },
    ],
  },
  {
    id: 'pair',
    name: 'Par',
    baseChips: 10,
    multiplier: 2,
    cards: [
      { id: 'hearts-K-1', suit: 'hearts', rank: 'K' },
      { id: 'spades-K-1', suit: 'spades', rank: 'K' },
    ],
  },
  {
    id: 'two_pair',
    name: 'Dois Pares',
    baseChips: 20,
    multiplier: 2,
    cards: [
      { id: 'hearts-K-1', suit: 'hearts', rank: 'K' },
      { id: 'spades-K-1', suit: 'spades', rank: 'K' },
      { id: 'hearts-Q-1', suit: 'hearts', rank: 'Q' },
      { id: 'spades-Q-1', suit: 'spades', rank: 'Q' },
    ],
  },
  {
    id: 'three_of_a_kind',
    name: 'Trinca',
    baseChips: 30,
    multiplier: 3,
    cards: [
      { id: 'hearts-K-1', suit: 'hearts', rank: 'K' },
      { id: 'spades-K-1', suit: 'spades', rank: 'K' },
      { id: 'clubs-K-1', suit: 'clubs', rank: 'K' },
    ],
  },
  {
    id: 'straight',
    name: 'Sequência',
    baseChips: 30,
    multiplier: 4,
    cards: [
      { id: 'clubs-9-1', suit: 'clubs', rank: '9' },
      { id: 'hearts-10-1', suit: 'hearts', rank: '10' },
      { id: 'spades-J-1', suit: 'spades', rank: 'J' },
      { id: 'diamonds-Q-1', suit: 'diamonds', rank: 'Q' },
      { id: 'clubs-K-1', suit: 'clubs', rank: 'K' },
    ],
    note: 'O Ás também pode formar a sequência baixa A-2-3-4-5.',
  },
  {
    id: 'flush',
    name: 'Flush',
    baseChips: 35,
    multiplier: 4,
    cards: [
      { id: 'clubs-2-1', suit: 'clubs', rank: '2' },
      { id: 'clubs-5-1', suit: 'clubs', rank: '5' },
      { id: 'clubs-9-1', suit: 'clubs', rank: '9' },
      { id: 'clubs-J-1', suit: 'clubs', rank: 'J' },
      { id: 'clubs-K-1', suit: 'clubs', rank: 'K' },
    ],
    note: 'Cinco cartas do mesmo naipe, não precisam estar em sequência.',
  },
  {
    id: 'full_house',
    name: 'Full House',
    baseChips: 40,
    multiplier: 4,
    cards: [
      { id: 'hearts-K-1', suit: 'hearts', rank: 'K' },
      { id: 'spades-K-1', suit: 'spades', rank: 'K' },
      { id: 'clubs-K-1', suit: 'clubs', rank: 'K' },
      { id: 'hearts-Q-1', suit: 'hearts', rank: 'Q' },
      { id: 'spades-Q-1', suit: 'spades', rank: 'Q' },
    ],
  },
  {
    id: 'four_of_a_kind',
    name: 'Quadra',
    baseChips: 60,
    multiplier: 7,
    cards: [
      { id: 'hearts-K-1', suit: 'hearts', rank: 'K' },
      { id: 'diamonds-K-1', suit: 'diamonds', rank: 'K' },
      { id: 'clubs-K-1', suit: 'clubs', rank: 'K' },
      { id: 'spades-K-1', suit: 'spades', rank: 'K' },
    ],
  },
  {
    id: 'straight_flush',
    name: 'Straight Flush',
    baseChips: 100,
    multiplier: 8,
    cards: [
      { id: 'spades-9-1', suit: 'spades', rank: '9' },
      { id: 'spades-10-1', suit: 'spades', rank: '10' },
      { id: 'spades-J-1', suit: 'spades', rank: 'J' },
      { id: 'spades-Q-1', suit: 'spades', rank: 'Q' },
      { id: 'spades-K-1', suit: 'spades', rank: 'K' },
    ],
  },
];

function ComboRow({ combo }: { combo: IComboInfo }) {
  return (
    <div className="flex flex-col gap-3 py-4 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <span className="font-semibold text-gray-900">
          {combo.name}
        </span>

        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
            {`${combo.baseChips} chips`}
          </span>

          <span className="px-2 py-0.5 rounded bg-primary-50 text-primary-700 font-medium">
            {`×${combo.multiplier}`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <UtilsFor
          each={combo.cards}
          eachKey={({ item }) => item.id}
        >
          {({ item }) => (
            <Card
              card={item}
              size="sm"
            />
          )}
        </UtilsFor>
      </div>

      <UtilsIf condition={!!combo.note}>
        {() => (
          <p className="text-xs text-gray-500">
            {combo.note}
          </p>
        )}
      </UtilsIf>
    </div>
  );
}

export function ComboReferenceLogicComponent({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Combinações e pontuação"
      size="lg"
      centered
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-900 pb-1">
            Combinações, do mais fraco ao mais forte
          </span>

          <UtilsFor
            each={COMBOS}
            eachKey={({ item }) => item.id}
          >
            {({ item }) => (
              <ComboRow combo={item} />
            )}
          </UtilsFor>
        </div>
      </div>
    </Modal>
  );
}

export function ComboHelpButton() {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <FormButton
        variant="subtle"
        color="gray.0"
        radius={0}
        leftIcon="lucide:circle-help"
        tooltip="Como pontuar"
        onClick={() => setOpened(true)}
      >
        <span className="hidden sm:inline">
          Como pontuar
        </span>
      </FormButton>

      <ComboReferenceLogicComponent
        opened={opened}
        onClose={() => setOpened(false)}
      />
    </>
  );
}
