import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import { SPRITE_FRAMES } from './runner/sprite';
import { colorFor, getDeviceId } from './runner/net';

// Opening animation: the runner game's invader (in this visitor's own colour) runs in,
// jumps and head-bumps the name, which decodes from scrambled glyphs; then the overlay
// wipes away. Plays once per browser session, any click or key skips it, and it never
// plays for visitors who prefer reduced motion.

const NAME = 'Shkëlzen Berisha';
const ROLE = 'Full-Stack Software Developer';
const SEEN_KEY = 'intro-seen';
const PIXEL = 6;
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>/';

// Timeline, in seconds from mount.
const RUN_START = 0.15;
const RUN_END = 0.85;
const JUMP_PEAK = 1.05;
const LAND = 1.25;
const DECODE_START = 1.0;
const DECODE_DURATION = 0.6;
const ROLE_IN = 1.55;
const EXIT_AT = 2.5;

const shouldPlay = () => {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return !sessionStorage.getItem(SEEN_KEY);
  } catch {
    return true;
  }
};

const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

// Text that starts as random glyphs and resolves left to right.
const ScrambleText: React.FC<{ text: string; delay: number; duration: number }> = ({ text, delay, duration }) => {
  const [shown, setShown] = useState(() => text.replace(/\S/g, ' '));

  useEffect(() => {
    const start = performance.now() + delay * 1000;
    let frame = 0;
    const tick = (now: number) => {
      const p = (now - start) / (duration * 1000);
      if (p < 0) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const resolved = Math.floor(Math.min(1, p) * text.length);
      setShown(
        Array.from(text, (ch, i) => (i < resolved || ch === ' ' ? ch : randomGlyph())).join('')
      );
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, delay, duration]);

  return <>{shown}</>;
};

const Invader: React.FC<{ color: string }> = ({ color }) => {
  const [frame, setFrame] = useState(0);

  // Shuffle the legs while running; stand still once landed.
  useEffect(() => {
    const interval = window.setInterval(() => setFrame((f) => 1 - f), 90);
    const stop = window.setTimeout(() => {
      window.clearInterval(interval);
      setFrame(0);
    }, LAND * 1000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, []);

  const rows = SPRITE_FRAMES[frame];
  return (
    <svg
      width={rows[0].length * PIXEL}
      height={rows.length * PIXEL}
      viewBox={`0 0 ${rows[0].length} ${rows.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rows.flatMap((row, y) =>
        Array.from(row, (cell, x) => (cell === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null))
      )}
    </svg>
  );
};

const Intro: React.FC = () => {
  const [show, setShow] = useState(shouldPlay);
  const [color] = useState(() => colorFor(getDeviceId()));

  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const skip = () => setShow(false);
    const timer = window.setTimeout(skip, EXIT_AT * 1000);
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    window.addEventListener('wheel', skip, { passive: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('wheel', skip);
    };
  }, [show]);

  const jumpTimes = [0, (JUMP_PEAK - RUN_END) / (LAND - RUN_END), 1];

  return (
    <AnimatePresence>
      {show && (
        <Overlay
          key="intro"
          aria-hidden="true"
          initial={{ clipPath: 'inset(0% 0% 0% 0%)' }}
          exit={{ clipPath: 'inset(0% 0% 100% 0%)' }}
          transition={{ duration: 0.65, ease: [0.76, 0, 0.24, 1] }}
        >
          <Center>
            <Name
              initial={{ y: 0 }}
              animate={{ y: [0, -10, 0] }}
              transition={{ delay: JUMP_PEAK - 0.04, duration: 0.28, ease: 'easeOut' }}
            >
              <ScrambleText text={NAME} delay={DECODE_START} duration={DECODE_DURATION} />
            </Name>

            <Track>
              <motion.div
                style={{ position: 'absolute', bottom: 2, left: '50%' }}
                initial={{ x: '-50vw' }}
                animate={{ x: `-${(SPRITE_FRAMES[0][0].length * PIXEL) / 2}px` }}
                transition={{ delay: RUN_START, duration: RUN_END - RUN_START, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.div
                  animate={{ y: [0, -34, 0] }}
                  transition={{ delay: RUN_END, duration: LAND - RUN_END, times: jumpTimes, ease: ['easeOut', 'easeIn'] }}
                >
                  <Invader color={color} />
                </motion.div>
              </motion.div>
              <Ground
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
              <Impact
                style={{ background: color }}
                initial={{ opacity: 0, scaleX: 0.2 }}
                animate={{ opacity: [0, 0.9, 0], scaleX: [0.2, 1.6, 2.2] }}
                transition={{ delay: LAND - 0.02, duration: 0.45, ease: 'easeOut' }}
              />
            </Track>

            <Role
              initial={{ opacity: 0, y: 8, letterSpacing: '0.5em' }}
              animate={{ opacity: 1, y: 0, letterSpacing: '0.18em' }}
              transition={{ delay: ROLE_IN, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {ROLE}
            </Role>
          </Center>

          <SkipHint initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 0.5, duration: 0.4 }}>
            click or press any key to skip
          </SkipHint>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  overflow: hidden;
  cursor: pointer;
`;

const Center = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 16px;
  width: 100%;
`;

const Name = styled(motion.div)`
  font-size: clamp(30px, 7vw, 64px);
  font-weight: 700;
  letter-spacing: -0.5px;
  line-height: 1.1;
  color: var(--heading);
  white-space: pre;
  text-align: center;
  font-variant-ligatures: none;
`;

const Track = styled.div`
  position: relative;
  width: min(420px, 80vw);
  height: 64px;
`;

const Ground = styled(motion.div)`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: rgba(var(--border-rgb), 0.45);
  transform-origin: center;
`;

const Impact = styled(motion.div)`
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 60px;
  height: 2px;
  margin-left: -30px;
  border-radius: 2px;
`;

const Role = styled(motion.p)`
  margin-top: 20px;
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: clamp(11px, 2.6vw, 14px);
  text-transform: uppercase;
  color: var(--accent);
  text-align: center;
`;

const SkipHint = styled(motion.p)`
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  text-align: center;
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 11px;
  color: var(--text);
`;

export default Intro;
