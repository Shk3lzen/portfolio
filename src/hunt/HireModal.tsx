import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import { FiGithub, FiLinkedin, FiX } from 'react-icons/fi';
import { profile } from '../data/profile';
import { find } from './hunt';

const WORD = 'hire';

// Typing "hire" anywhere on the page (outside a text field) opens a contact card.
// It's also a season 2 treasure-hunt fragment.
const HireModal: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let typed = '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
      typed = (typed + e.key.toLowerCase()).slice(-WORD.length);
      if (typed === WORD) {
        typed = '';
        setOpen(true);
        find('hire');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
          <Card
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hire-title"
          >
            <Close type="button" onClick={() => setOpen(false)} aria-label="Close">
              <FiX />
            </Close>
            <Emoji aria-hidden="true">👀</Emoji>
            <Title id="hire-title">You typed “hire”.</Title>
            <Text>
              I&apos;ll take that as a sign. I&apos;m {profile.name}, a {profile.role.toLowerCase()} who likes hard
              backend problems and fast, reliable products. Let&apos;s talk.
            </Text>
            <Actions>
              <Primary href={profile.contactUrl} target="_blank" rel="noopener noreferrer">
                <FiLinkedin /> Message me
              </Primary>
              <Secondary href={profile.github} target="_blank" rel="noopener noreferrer">
                <FiGithub /> See my code
              </Secondary>
            </Actions>
          </Card>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 210;
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--overlay);
  backdrop-filter: blur(4px);
`;

const Card = styled(motion.div)`
  position: relative;
  width: 100%;
  max-width: 420px;
  padding: 28px 24px 24px;
  text-align: center;
  background: var(--bg-elevated);
  border: 1px solid rgba(var(--accent-rgb), 0.3);
  border-radius: 14px;
  box-shadow: 0 24px 60px -12px var(--shadow);
`;

const Close = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  font-size: 16px;
  color: var(--text);
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: var(--accent);
  }
`;

const Emoji = styled.div`
  font-size: 40px;
  margin-bottom: 8px;
`;

const Title = styled.h2`
  margin-bottom: 8px;
  font-size: 22px;
  color: var(--heading);
`;

const Text = styled.p`
  margin-bottom: 20px;
  font-size: 15px;
  color: var(--text);
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
`;

const Primary = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  font-family: 'SF Mono', monospace;
  font-size: 13px;
  color: var(--bg);
  background: var(--accent);
  border-radius: 6px;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
`;

const Secondary = styled(Primary)`
  color: var(--accent);
  background: none;
  border: 1px solid var(--accent);
`;

export default HireModal;
