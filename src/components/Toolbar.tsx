import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useTheme } from '../theme/ThemeContext';
import { activeSeason, find, fragmentsIn, useFound } from '../hunt/hunt';

// Toggling the theme this many times within the window finds a hunt fragment.
const INDECISIVE_TOGGLES = 10;
const INDECISIVE_MS = 5000;

// Fixed top-right controls, available on every page.
const Toolbar: React.FC = () => {
  const { theme, toggle } = useTheme();
  const found = useFound();
  const season = activeSeason(found);
  const seasonList = fragmentsIn(season);
  const seasonFound = seasonList.filter((f) => found.includes(f.id)).length;
  const toggles = useRef<number[]>([]);

  const onToggle = () => {
    toggle();
    const now = Date.now();
    toggles.current = [...toggles.current.filter((t) => now - t < INDECISIVE_MS), now];
    if (toggles.current.length >= INDECISIVE_TOGGLES) find('theme');
  };

  return (
    <Bar>
      {found.length > 0 && (
        <HuntLink
          to="/vault"
          aria-label={`Treasure hunt season ${season}: ${seasonFound} of ${seasonList.length} fragments found`}
        >
          <span aria-hidden="true">🗝</span>
          {season === 2 && 'S2 '}
          {seasonFound}/{seasonList.length}
        </HuntLink>
      )}
      <IconButton
        onClick={onToggle}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? <FiSun /> : <FiMoon />}
      </IconButton>
    </Bar>
  );
};

const Bar = styled.div`
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 10px;

  @media (max-width: 768px) {
    top: 16px;
    right: 16px;
  }
`;

const IconButton = styled.button`
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.08);
  border: 1px solid rgba(var(--accent-rgb), 0.25);
  border-radius: 10px;
  font-size: 18px;
  backdrop-filter: blur(8px);
  transition: background 0.2s, transform 0.2s, border-color 0.2s;

  &:hover {
    background: rgba(var(--accent-rgb), 0.15);
    transform: translateY(-2px);
    border-color: var(--accent);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

const HuntLink = styled(Link)`
  height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  font-family: 'SF Mono', monospace;
  font-size: 13px;
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.08);
  border: 1px solid rgba(var(--accent-rgb), 0.25);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  transition: background 0.2s, border-color 0.2s;

  &:hover {
    background: rgba(var(--accent-rgb), 0.15);
    border-color: var(--accent);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

export default Toolbar;
