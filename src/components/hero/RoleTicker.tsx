import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const INTERVAL_MS = 2600;

// "Full-Stack Developer — APIs", where the last part cycles through the focus areas.
// Screen readers get the whole line once; reduced-motion visitors see the full list, static.
const RoleTicker: React.FC<{ role: string; focus: string[] }> = ({ role, focus }) => {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion || focus.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % focus.length), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [reduceMotion, focus.length]);

  const fullText = `${role} — ${focus.join(', ')}`;

  return (
    <Title aria-label={fullText}>
      <span aria-hidden="true">{role}</span>
      <Dash aria-hidden="true"> — </Dash>
      {reduceMotion ? (
        <span aria-hidden="true">{focus.join(' · ')}</span>
      ) : (
        <Slot aria-hidden="true">
          {/* Invisible copies size the slot to the longest phrase, so rotating never reflows the line. */}
          {focus.map((item) => (
            <Sizer key={item}>{item}</Sizer>
          ))}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={focus[index]}
              initial={{ y: '60%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-60%', opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {focus[index]}
            </motion.span>
          </AnimatePresence>
        </Slot>
      )}
    </Title>
  );
};

const Title = styled.h2`
  font-size: 20px;
  font-weight: 400;
  color: var(--accent);
  margin-bottom: 20px;
  line-height: 1.3;

  @media (max-width: 768px) {
    font-size: 19px;
  }
`;

const Dash = styled.span`
  color: var(--text);
`;

const Slot = styled.span`
  display: inline-grid;
  vertical-align: bottom;
  overflow: hidden;

  > span {
    grid-area: 1 / 1;
  }
`;

const Sizer = styled.span`
  visibility: hidden;
`;

export default RoleTicker;
