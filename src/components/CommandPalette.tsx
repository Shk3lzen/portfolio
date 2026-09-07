import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiHome,
  FiFolder,
  FiUser,
  FiBriefcase,
  FiGrid,
  FiSun,
  FiMoon,
  FiGithub,
  FiLinkedin,
  FiExternalLink,
  FiMessageSquare,
  FiSearch,
} from 'react-icons/fi';
import { useTheme } from '../theme/ThemeContext';
import { projects } from '../data/projects';

interface Command {
  id: string;
  title: string;
  group: string;
  keywords?: string;
  icon: React.ReactNode;
  action: () => void;
}

// Imperative opener so the toolbar button (and anything else) can trigger the
// palette without prop-drilling.
let openFn: () => void = () => {};
export const openCommandPalette = () => openFn();

const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    openFn = () => setOpen(true);
    return () => {
      openFn = () => {};
    };
  }, []);

  const goToSection = (id: string) => {
    navigate('/');
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  const commands: Command[] = useMemo(() => {
    const base: Command[] = [
      { id: 'home', title: 'Go to Home', group: 'Navigation', icon: <FiHome />, action: () => navigate('/') },
      { id: 'archive', title: 'Projects Archive', group: 'Navigation', keywords: 'all projects list', icon: <FiFolder />, action: () => navigate('/projects') },
      { id: 'about', title: 'Jump to About', group: 'Navigation', icon: <FiUser />, action: () => goToSection('about') },
      { id: 'experience', title: 'Jump to Experience', group: 'Navigation', keywords: 'work jobs', icon: <FiBriefcase />, action: () => goToSection('experience') },
      { id: 'projects', title: 'Jump to Projects', group: 'Navigation', icon: <FiGrid />, action: () => goToSection('projects') },
      {
        id: 'theme',
        title: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        group: 'Preferences',
        keywords: 'dark mode toggle appearance',
        icon: theme === 'dark' ? <FiSun /> : <FiMoon />,
        action: toggle,
      },
      { id: 'ai', title: 'Ask about my work (AI)', group: 'Preferences', keywords: 'chat assistant question', icon: <FiMessageSquare />, action: () => window.dispatchEvent(new CustomEvent('open-ai-chat')) },
      { id: 'github', title: 'Open GitHub', group: 'Social', keywords: 'code repos', icon: <FiGithub />, action: () => openExternal('https://github.com/Shk3lzen') },
      { id: 'linkedin', title: 'Open LinkedIn', group: 'Social', keywords: 'contact connect', icon: <FiLinkedin />, action: () => openExternal('https://www.linkedin.com/in/shkelzen-berisha/') },
    ];

    const projectCommands: Command[] = projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.title,
      group: 'Projects',
      keywords: project.tech.join(' '),
      icon: <FiExternalLink />,
      action: () => openExternal(project.url),
    }));

    return [...base, ...projectCommands];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.title} ${c.group} ${c.keywords ?? ''}`.toLowerCase().includes(q));
  }, [commands, query]);

  // Global ⌘K / Ctrl+K toggle + Escape close.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const runCommand = (command?: Command) => {
    if (!command) return;
    setOpen(false);
    command.action();
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(filtered[active]);
    }
  };

  // Keep the active item scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <AnimatePresence>
      {open && (
        <Overlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={() => setOpen(false)}
        >
          <Panel
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <SearchRow>
              <FiSearch />
              <SearchInput
                ref={inputRef}
                value={query}
                placeholder="Type a command or search…"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                aria-label="Command palette search"
              />
              <Kbd>esc</Kbd>
            </SearchRow>

            <List ref={listRef}>
              {filtered.length === 0 && <Empty>No results</Empty>}
              {filtered.map((command, index) => (
                <Item
                  key={command.id}
                  data-index={index}
                  className={index === active ? 'active' : ''}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => runCommand(command)}
                >
                  <ItemIcon>{command.icon}</ItemIcon>
                  <ItemTitle>{command.title}</ItemTitle>
                  <ItemGroup>{command.group}</ItemGroup>
                </Item>
              ))}
            </List>
          </Panel>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--overlay);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 20px 20px;
`;

const Panel = styled(motion.div)`
  width: 100%;
  max-width: 560px;
  background: var(--bg-elevated);
  border: 1px solid rgba(var(--accent-rgb), 0.2);
  border-radius: 14px;
  box-shadow: 0 24px 60px -12px var(--shadow);
  overflow: hidden;
`;

const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(var(--border-rgb), 0.18);
  color: var(--text);
  font-size: 18px;
`;

const SearchInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--heading);
  font-size: 15px;
  font-family: inherit;

  &::placeholder {
    color: var(--text);
  }
`;

const Kbd = styled.span`
  font-family: 'SF Mono', monospace;
  font-size: 11px;
  color: var(--text);
  border: 1px solid rgba(var(--border-rgb), 0.3);
  border-radius: 5px;
  padding: 2px 6px;
`;

const List = styled.div`
  max-height: 340px;
  overflow-y: auto;
  padding: 8px;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--heading);

  &.active {
    background: rgba(var(--accent-rgb), 0.12);
  }
`;

const ItemIcon = styled.span`
  display: grid;
  place-items: center;
  color: var(--accent);
  font-size: 16px;
`;

const ItemTitle = styled.span`
  flex: 1;
  font-size: 14px;
`;

const ItemGroup = styled.span`
  font-family: 'SF Mono', monospace;
  font-size: 11px;
  color: var(--text);
  letter-spacing: 0.5px;
`;

const Empty = styled.div`
  padding: 24px;
  text-align: center;
  color: var(--text);
  font-size: 14px;
`;

export default CommandPalette;
