import React from 'react';
import styled from 'styled-components';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useTheme } from '../theme/ThemeContext';

// Fixed top-right controls, available on every page.
const Toolbar: React.FC = () => {
  const { theme, toggle } = useTheme();

  return (
    <Bar>
      <IconButton
        onClick={toggle}
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

export default Toolbar;
