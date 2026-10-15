import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useReducedMotion } from 'framer-motion';
import { SPRITE_FRAMES } from '../runner/sprite';
import { colorFor, getDeviceId } from '../runner/net';

// Photo with an accent ring; hovering it swaps in the runner's pixel invader, in this
// visitor's own colour. With no photo set, the invader is the avatar.
//
// The invader is alive: its legs shuffle, it blinks, its pupils follow the cursor (or glance
// around on touch screens) and it hops when hovered or clicked. Reduced-motion visitors get a
// still invader whose eyes still follow the cursor.

const ROWS = SPRITE_FRAMES[0].length;
const COLS = SPRITE_FRAMES[0][0].length;
// The two holes in the sprite's face (row 2: 'XX.XXXX.XX').
const EYES = [
  { x: 2, y: 2 },
  { x: 7, y: 2 },
];
const SHUFFLE_MS = 420;
const NEAR_PX = 24; // cursor this close to the face: look straight ahead

type Look = { dx: number; dy: number }; // each -1, 0 or 1

const lookToward = (fromX: number, fromY: number, toX: number, toY: number): Look => {
  const vx = toX - fromX;
  const vy = toY - fromY;
  if (Math.hypot(vx, vy) < NEAR_PX) return { dx: 0, dy: 0 };
  const angle = Math.atan2(vy, vx);
  return { dx: Math.round(Math.cos(angle)), dy: Math.round(Math.sin(angle)) };
};

const Invader: React.FC<{ color: string; hopping: boolean; onHopEnd: () => void }> = ({ color, hopping, onHopEnd }) => {
  const reduceMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const [frame, setFrame] = useState(0);
  const [blink, setBlink] = useState(false);
  const [look, setLook] = useState<Look>({ dx: 0, dy: 0 });

  // Leg shuffle.
  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => setFrame((f) => 1 - f), SHUFFLE_MS);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  // Eyes follow the cursor; without one, they glance around now and then. Blinks are random.
  useEffect(() => {
    let raf = 0;
    let lastMove = 0;
    const timers: number[] = [];
    const update = (next: Look) => setLook((cur) => (cur.dx === next.dx && cur.dy === next.dy ? cur : next));

    const onMove = (e: MouseEvent) => {
      lastMove = performance.now();
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const box = svgRef.current?.getBoundingClientRect();
        if (box) update(lookToward(box.left + box.width / 2, box.top + box.height / 2, e.clientX, e.clientY));
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    const idle = () => {
      if (performance.now() - lastMove > 4000) {
        const glances: Look[] = [{ dx: 0, dy: 0 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }];
        update(glances[Math.floor(Math.random() * glances.length)]);
      }
      if (!reduceMotion) {
        setBlink(true);
        timers.push(window.setTimeout(() => setBlink(false), 130));
      }
      timers.push(window.setTimeout(idle, 2200 + Math.random() * 3000));
    };
    timers.push(window.setTimeout(idle, 1800));

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
      timers.forEach(window.clearTimeout);
    };
  }, [reduceMotion]);

  const rows = SPRITE_FRAMES[frame];
  const size = COLS + 2;

  return (
    <svg ref={svgRef} viewBox={`-1 -2 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden="true">
      <Shadow cx={COLS / 2} cy={ROWS + 1.4} rx={COLS / 2.6} ry={0.55} className={hopping ? 'hopping' : ''} />
      <Body className={hopping ? 'hopping' : ''} onAnimationEnd={onHopEnd}>
        {rows.flatMap((row, y) =>
          Array.from(row, (cell, x) => (cell === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null))
        )}
        {EYES.map(({ x, y }) =>
          blink ? (
            <rect key={`eye-${x}`} x={x} y={y} width={1} height={1} fill={color} />
          ) : (
            <g key={`eye-${x}`}>
              <rect x={x} y={y} width={1} height={1} fill="#f8fafc" />
              <rect x={x + 0.25 + look.dx * 0.25} y={y + 0.25 + look.dy * 0.25} width={0.5} height={0.5} fill="#0b1220" />
            </g>
          )
        )}
      </Body>
    </svg>
  );
};

const Avatar: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const reduceMotion = useReducedMotion();
  const [color] = useState(() => colorFor(getDeviceId()));
  const [hopping, setHopping] = useState(false);
  const hop = () => {
    if (!reduceMotion) setHopping(true);
  };

  return (
    <Frame
      className={src ? 'has-photo' : ''}
      style={{ '--bot': color } as React.CSSProperties}
      onMouseEnter={hop}
      onClick={hop}
    >
      {src && <img src={src} alt={alt} width={72} height={72} decoding="async" />}
      <InvaderLayer>
        <Invader color={color} hopping={hopping} onHopEnd={() => setHopping(false)} />
      </InvaderLayer>
    </Frame>
  );
};

const Body = styled.g`
  transform-box: fill-box;
  transform-origin: 50% 100%;

  &.hopping {
    animation: hop 0.55s cubic-bezier(0.3, 0.7, 0.4, 1);
  }

  @keyframes hop {
    0% { transform: translateY(0) scale(1, 1); }
    15% { transform: translateY(0) scale(1.12, 0.82); }
    45% { transform: translateY(-38%) scale(0.92, 1.1); }
    80% { transform: translateY(0) scale(1.08, 0.9); }
    100% { transform: translateY(0) scale(1, 1); }
  }
`;

const Shadow = styled.ellipse`
  fill: rgba(2, 12, 27, 0.28);
  transform-box: fill-box;
  transform-origin: center;

  &.hopping {
    animation: shadow 0.55s cubic-bezier(0.3, 0.7, 0.4, 1);
  }

  @keyframes shadow {
    45% { transform: scale(0.55); opacity: 0.5; }
  }
`;

const InvaderLayer = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 12px;
  /* A soft glow in the invader's own colour, plus faint arcade scanlines. */
  background:
    radial-gradient(circle at 50% 62%, color-mix(in srgb, var(--bot) 30%, transparent), transparent 62%),
    var(--bg-elevated);
  transition: opacity 0.25s ease;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(to bottom, rgba(2, 12, 27, 0.06) 0 1px, transparent 1px 3px);
  }

  svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
`;

const Frame = styled.div`
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 22px;
  cursor: pointer;
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px rgba(var(--accent-rgb), 0.55);
  transition: transform 0.25s ease, box-shadow 0.25s ease;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &.has-photo ${InvaderLayer} {
    opacity: 0;
  }

  &:hover {
    transform: translateY(-2px) rotate(-3deg);
    box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent), 0 0 22px 2px color-mix(in srgb, var(--bot) 45%, transparent);
  }

  &.has-photo:hover ${InvaderLayer} {
    opacity: 1;
  }

  @media (max-width: 768px) {
    width: 64px;
    height: 64px;
  }
`;

export default Avatar;
