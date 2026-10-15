import React, { useState } from 'react';
import styled from 'styled-components';
import { SPRITE_FRAMES } from '../runner/sprite';
import { colorFor, getDeviceId } from '../runner/net';

// Photo with an accent ring; hovering it swaps in the runner's pixel invader, in this
// visitor's own colour. With no photo set, the invader is the avatar.
const Invader: React.FC<{ color: string }> = ({ color }) => {
  const rows = SPRITE_FRAMES[0];
  return (
    <svg viewBox={`-1 ${(rows.length - rows[0].length - 2) / 2} ${rows[0].length + 2} ${rows[0].length + 2}`} shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) =>
        Array.from(row, (cell, x) => (cell === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null))
      )}
    </svg>
  );
};

const Avatar: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [color] = useState(() => colorFor(getDeviceId()));

  return (
    <Frame className={src ? 'has-photo' : ''}>
      {src && <img src={src} alt={alt} width={72} height={72} decoding="async" />}
      <InvaderLayer>
        <Invader color={color} />
      </InvaderLayer>
    </Frame>
  );
};

const InvaderLayer = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 14px;
  background: var(--bg-elevated);
  transition: opacity 0.25s ease;

  svg {
    width: 100%;
    height: 100%;
  }
`;

const Frame = styled.div`
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 22px;
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
    box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
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
