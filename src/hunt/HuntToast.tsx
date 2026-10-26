import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import { FRAGMENTS, FragmentId, fragmentsIn, onFound } from './hunt';
import { installEggs } from './eggs';

const SHOW_MS = 4500;

// Announces each new fragment at the bottom of the screen, and installs the site-wide eggs.
const HuntToast: React.FC = () => {
  const [toast, setToast] = useState<{ id: FragmentId; count: number; total: number } | null>(null);

  useEffect(() => installEggs(), []);

  useEffect(() => {
    let timer = 0;
    const off = onFound((id, found) => {
      const season = fragmentsIn(FRAGMENTS.find((f) => f.id === id)?.season ?? 1);
      setToast({ id, count: season.filter((f) => found.includes(f.id)).length, total: season.length });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setToast(null), SHOW_MS);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, []);

  const fragment = toast && FRAGMENTS.find((f) => f.id === toast.id);
  const complete = !!toast && toast.count === toast.total;
  const seasonLabel = fragment?.season === 2 ? 'Season 2 · ' : '';

  return (
    <Region role="status" aria-live="polite">
      <AnimatePresence>
        {toast && fragment && (
          <Toast
            key={toast.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
          >
            <Key aria-hidden="true">🗝</Key>
            <span>
              <strong>
                {seasonLabel}Fragment {toast.count}/{toast.total}
              </strong>{' '}
              {fragment.title}.{' '}
              <Link to="/vault" onClick={() => setToast(null)}>
                {complete ? 'Claim your prize →' : 'Open the vault →'}
              </Link>
            </span>
          </Toast>
        )}
      </AnimatePresence>
    </Region>
  );
};

const Region = styled.div`
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 24px;
  z-index: 150;
  display: flex;
  justify-content: center;
  pointer-events: none;
`;

const Toast = styled(motion.div)`
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 480px;
  padding: 12px 16px;
  border-radius: 10px;
  font-family: 'SF Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text);
  background: var(--bg-elevated);
  border: 1px solid rgba(var(--accent-rgb), 0.4);
  box-shadow: 0 16px 40px -12px var(--shadow);

  strong {
    color: var(--heading);
  }

  a {
    color: var(--accent);
    white-space: nowrap;
  }
`;

const Key = styled.span`
  font-size: 20px;
`;

export default HuntToast;
