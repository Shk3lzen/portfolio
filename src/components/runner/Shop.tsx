import React from 'react';
import styled from 'styled-components';
import { ITEMS, ItemId, buy, equip, loadCosmetics } from './cosmetics';

type Cosmetics = ReturnType<typeof loadCosmetics>;

// Spend coins saved across runs on looks for your bot.
const Shop: React.FC<{ cosmetics: Cosmetics; onChange: (next: Cosmetics) => void }> = ({ cosmetics, onChange }) => {
  const act = (id: ItemId) => onChange(cosmetics.owned.includes(id) ? equip(id) : buy(id));

  return (
    <Panel aria-label="Shop">
      <Note>
        Coins you collect are saved here. Cosmetics only change how your bot looks to you.
      </Note>
      <Grid>
        {ITEMS.map((item) => {
          const owned = cosmetics.owned.includes(item.id);
          const on = cosmetics.hat === item.id || cosmetics.trail === item.id;
          const affordable = cosmetics.wallet >= item.cost;
          return (
            <ItemButton
              key={item.id}
              type="button"
              onClick={() => act(item.id)}
              disabled={!owned && !affordable}
              aria-pressed={owned ? on : undefined}
            >
              <span>{item.name}</span>
              <Price>{owned ? (on ? 'wearing' : 'wear') : `◆ ${item.cost}`}</Price>
            </ItemButton>
          );
        })}
      </Grid>
    </Panel>
  );
};

const Panel = styled.div`
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(var(--border-rgb), 0.18);
  background: rgba(var(--border-rgb), 0.04);
  font-family: 'SF Mono', monospace;
  font-size: 12px;
`;

const Note = styled.p`
  margin-bottom: 10px;
  color: var(--text);
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
`;

const ItemButton = styled.button`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  text-align: left;
  font: inherit;
  color: var(--heading);
  background: none;
  border: 1px solid rgba(var(--border-rgb), 0.3);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;

  &:hover:not(:disabled) {
    border-color: var(--accent);
  }

  &[aria-pressed='true'] {
    border-color: var(--accent);
    background: rgba(var(--accent-rgb), 0.08);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

const Price = styled.span`
  color: #f2b705;
  white-space: nowrap;
`;

export default Shop;
