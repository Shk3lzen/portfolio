import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../theme/ThemeContext';
import { profile } from '../data/profile';
import { projects } from '../data/projects';
import { experience } from '../data/experience';
import { find } from '../hunt/hunt';

// A tiny fake shell over the site's own data: ls, cd, cat, open… Opened from the ⌘K palette
// ("Open terminal") or with the backtick key. One hidden file belongs to the treasure hunt.

let openFn: () => void = () => {};
export const openTerminal = () => openFn();

type Line = { kind: 'in' | 'out' | 'err'; text: string };

const HOME = '~';
const PROJECTS_DIR = '~/projects';

const FILES: Record<string, () => string> = {
  'about.txt': () => `${profile.name}, ${profile.role}.\nFocus: ${profile.focus.join(', ')}.`,
  'experience.txt': () => experience.map((r) => `${r.dates.padEnd(20)} ${r.title} · ${r.company}`).join('\n'),
  'skills.txt': () => Array.from(new Set(experience.flatMap((r) => r.tech))).join('  '),
  'contact.txt': () => `GitHub    ${profile.github}\nLinkedIn  ${profile.linkedin}`,
};

const SECRET = '.secret';
const SECRET_TEXT = [
  'You found a hidden file.',
  '',
  '  Follow the white rabbit: /#/matrix',
  '',
  'And while you are here: the picture this site shows when shared is worth a closer look. Zoom into its corners.',
].join('\n');

const HELP = [
  'help              this list',
  'ls [-a] [dir]     list files (-a shows hidden ones)',
  'cd <dir>          change directory (projects, .., ~)',
  'cat <file>        print a file',
  'open <project>    open a project in a new tab',
  'theme [light|dark]',
  'whoami · pwd · date · echo · clear · exit',
].join('\n');

const Terminal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [cwd, setCwd] = useState(HOME);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  useEffect(() => {
    openFn = () => setOpen(true);
    return () => {
      openFn = () => {};
    };
  }, []);

  // Backtick opens it (outside text fields); Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === '`' && !typing) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (lines.length === 0) setLines([{ kind: 'out', text: "Welcome to shkelzzen.xyz. Type 'help' to get started." }]);
    window.setTimeout(() => inputRef.current?.focus(), 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const findProject = (name: string) => {
    const q = name.toLowerCase().replace(/\/$/, '');
    return projects.find((p) => p.id === q || p.title.toLowerCase() === q);
  };

  const list = (dir: string, all: boolean) => {
    if (dir === PROJECTS_DIR) return projects.map((p) => p.id).join('  ');
    const names = ['projects/', ...Object.keys(FILES)];
    return (all ? ['.', '..', SECRET, ...names] : names).join('  ');
  };

  const resolveDir = (arg: string) => {
    if (!arg || arg === '~' || arg === '/') return HOME;
    if (arg === '..') return HOME;
    if (arg.replace(/\/$/, '') === 'projects' || arg === PROJECTS_DIR) return cwd === HOME || arg === PROJECTS_DIR ? PROJECTS_DIR : null;
    return null;
  };

  const run = (raw: string): Line[] => {
    const [cmd = '', ...args] = raw.trim().split(/\s+/);
    const flags = args.filter((a) => a.startsWith('-'));
    const rest = args.filter((a) => !a.startsWith('-'));
    const out = (text: string): Line[] => [{ kind: 'out', text }];
    const err = (text: string): Line[] => [{ kind: 'err', text }];

    switch (cmd) {
      case '':
        return [];
      case 'help':
        return out(HELP);
      case 'ls': {
        const dir = rest[0] ? resolveDir(rest[0]) : cwd;
        if (!dir) return err(`ls: ${rest[0]}: No such file or directory`);
        return out(list(dir, flags.some((f) => f.includes('a'))));
      }
      case 'cd': {
        const dir = resolveDir(rest[0] ?? '~');
        if (!dir) return err(`cd: ${rest[0]}: No such directory`);
        setCwd(dir);
        return [];
      }
      case 'cat': {
        const name = rest[0];
        if (!name) return err('cat: which file?');
        if (cwd === HOME && name === SECRET) {
          find('terminal');
          return out(SECRET_TEXT);
        }
        if (cwd === HOME && FILES[name]) return out(FILES[name]());
        const project = cwd === PROJECTS_DIR ? findProject(name) : null;
        if (project) return out(`${project.title} (${project.year})\n${project.description}\n${project.tech.join(' · ')}\n${project.url}`);
        if (name === 'projects' || name === 'projects/') return err('cat: projects: Is a directory');
        return err(`cat: ${name}: No such file`);
      }
      case 'open': {
        const project = rest[0] ? findProject(rest[0]) : null;
        if (!project) return err(`open: ${rest[0] ?? ''}: no such project (try: ls projects)`);
        window.open(project.url, '_blank', 'noopener,noreferrer');
        return out(`Opening ${project.title}…`);
      }
      case 'theme': {
        if (rest[0] !== 'light' && rest[0] !== 'dark') return err('usage: theme light|dark');
        setTheme(rest[0]);
        return out(`Theme set to ${rest[0]}.`);
      }
      case 'whoami':
        return out('visitor (but you could be root…)');
      case 'pwd':
        return out(cwd.replace('~', '/home/visitor'));
      case 'date':
        return out(new Date().toUTCString());
      case 'echo':
        return out(rest.join(' '));
      case 'sudo':
        return err("visitor is not in the sudoers file. This incident will be reported. (The ⌘K palette is less strict.)");
      case 'rm':
        return err('rm: nice try.');
      case 'vim':
      case 'nano':
      case 'emacs':
        return err(`${cmd}: you'd never get out. Try cat.`);
      case 'play':
        setOpen(false);
        navigate('/');
        window.setTimeout(() => document.querySelector('[role="application"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
        return [];
      case 'clear':
        setLines([]);
        return [];
      case 'exit':
        setOpen(false);
        return [];
      default:
        return err(`${cmd}: command not found. Type 'help'.`);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input;
    const prompt: Line = { kind: 'in', text: `${cwd} $ ${raw}` };
    const result = run(raw);
    if (raw.trim() !== 'clear') setLines((cur) => [...cur, prompt, ...result]);
    if (raw.trim()) setHistory((h) => [...h, raw]);
    setHistoryIndex(-1);
    setInput('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      const i = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(i);
      setInput(history[i]);
    } else if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault();
      const i = historyIndex + 1;
      setHistoryIndex(i >= history.length ? -1 : i);
      setInput(i >= history.length ? '' : history[i]);
    } else if (e.key === 'Tab') {
      // Completes the last word from the files and projects in reach.
      e.preventDefault();
      const words = input.split(' ');
      const last = words[words.length - 1];
      if (!last) return;
      const options = cwd === PROJECTS_DIR ? projects.map((p) => p.id) : ['projects/', ...Object.keys(FILES), ...(last.startsWith('.') ? [SECRET] : [])];
      const match = options.find((o) => o.startsWith(last));
      if (match) setInput([...words.slice(0, -1), match].join(' '));
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

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
          <Window
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(e: React.MouseEvent) => {
              e.stopPropagation();
              inputRef.current?.focus();
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Terminal"
          >
            <TitleBar>
              <Dots aria-hidden="true">
                <i />
                <i />
                <i />
              </Dots>
              visitor@shkelzzen.xyz
            </TitleBar>
            <Output ref={scrollRef} aria-live="polite">
              {lines.map((line, i) => (
                <OutLine key={i} $kind={line.kind}>
                  {line.text}
                </OutLine>
              ))}
            </Output>
            <Prompt onSubmit={submit}>
              <span aria-hidden="true">{cwd} $</span>
              <PromptInput
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                aria-label="Terminal command"
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
              />
            </Prompt>
          </Window>
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
  padding: 12vh 16px 16px;
`;

const Window = styled(motion.div)`
  width: 100%;
  max-width: 680px;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  background: #0b1220;
  border: 1px solid rgba(var(--accent-rgb), 0.25);
  border-radius: 12px;
  box-shadow: 0 24px 60px -12px var(--shadow);
  overflow: hidden;
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 13px;
  color: #cbd5e1;
`;

const TitleBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  font-size: 12px;
  color: #94a3b8;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
`;

const Dots = styled.span`
  display: inline-flex;
  gap: 6px;

  i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ef4444;
  }
  i:nth-child(2) {
    background: #f59e0b;
  }
  i:nth-child(3) {
    background: #22c55e;
  }
`;

const Output = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px 4px;
`;

const OutLine = styled.pre<{ $kind: Line['kind'] }>`
  margin: 0 0 4px;
  font: inherit;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${({ $kind }) => ($kind === 'in' ? '#64ffda' : $kind === 'err' ? '#f87171' : '#cbd5e1')};
`;

const Prompt = styled.form`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 14px;
  color: #64ffda;
`;

const PromptInput = styled.input`
  flex: 1;
  min-width: 0;
  font: inherit;
  color: #e2e8f0;
  background: transparent;
  border: none;
  outline: none;
  caret-color: #64ffda;
`;

export default Terminal;
