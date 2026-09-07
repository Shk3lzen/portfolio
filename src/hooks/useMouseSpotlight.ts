import { useEffect, useRef } from 'react';

// Attach a cursor-following radial glow to a fixed, full-screen element.
// Updates the DOM directly (throttled to one animation frame) so mouse
// movement never triggers a React re-render.
export function useMouseSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (frame) return;
      const { clientX, clientY } = e;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = ref.current;
        if (el) {
          el.style.background = `radial-gradient(600px at ${clientX}px ${clientY}px, var(--spotlight), transparent 80%)`;
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}
