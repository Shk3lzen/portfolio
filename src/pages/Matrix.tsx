import React, { useEffect, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import styled from 'styled-components';
import { find } from '../hunt/hunt';

// The hidden page a hidden file in the terminal points to: falling green code and a note.
// Visiting it is a season 2 treasure-hunt fragment.

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF<>/{}';
const FONT_SIZE = 16;

const Matrix = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    find('matrix');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let drops: number[] = [];
    let frame = 0;
    let last = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drops = Array.from({ length: Math.ceil(canvas.width / FONT_SIZE) }, () => Math.random() * -50);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const paint = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#39ff14';
      ctx.font = `${FONT_SIZE}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], i * FONT_SIZE, y * FONT_SIZE);
        drops[i] = y * FONT_SIZE > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
      });
    };

    const loop = (now: number) => {
      if (now - last > 50) {
        last = now;
        paint();
      }
      frame = requestAnimationFrame(loop);
    };

    resize();
    if (still) for (let i = 0; i < 60; i++) paint();
    else frame = requestAnimationFrame(loop);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <Page>
      <Canvas ref={canvasRef} aria-hidden="true" />
      <Message>
        <p>Wake up, visitor…</p>
        <p>You followed the white rabbit all the way down.</p>
        <p>A fragment is yours.</p>
        <Back to="/vault">← back to the vault</Back>
      </Message>
    </Page>
  );
};

const Page = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  background: #000;
  display: grid;
  place-items: center;
`;

const Canvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;

const Message = styled.div`
  position: relative;
  max-width: calc(100% - 32px);
  padding: 24px 28px;
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 15px;
  line-height: 1.8;
  color: #b6ffa8;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid #39ff14;
  border-radius: 8px;
  box-shadow: 0 0 40px rgba(57, 255, 20, 0.25);
`;

const Back = styled(RouterLink)`
  display: inline-block;
  margin-top: 12px;
  color: #39ff14;

  &:focus-visible {
    outline: 2px solid #39ff14;
    outline-offset: 3px;
  }
`;

export default Matrix;
