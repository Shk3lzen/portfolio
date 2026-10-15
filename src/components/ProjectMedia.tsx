import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useReducedMotion } from 'framer-motion';

// A screenshot (or short looping clip) in a minimal browser window, so product shots read as
// real products. Clips only play while on screen, and never for reduced-motion visitors —
// they see the screenshot instead.
const ProjectMedia: React.FC<{ url: string; image: string; alt: string; video?: string }> = ({ url, image, alt, video }) => {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideo = Boolean(video) && !reduceMotion;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !showVideo) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [showVideo]);

  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* keep the raw url */
  }

  return (
    <Window>
      <Chrome aria-hidden="true">
        <Dots>
          <i />
          <i />
          <i />
        </Dots>
        <Address>{host}</Address>
      </Chrome>
      <Viewport>
        {showVideo ? (
          <video ref={videoRef} src={video} poster={image} muted loop playsInline preload="none" aria-label={alt} />
        ) : (
          <img src={image} alt={alt} loading="lazy" decoding="async" />
        )}
      </Viewport>
    </Window>
  );
};

const Window = styled.div`
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-elevated);
  border: 1px solid rgba(var(--border-rgb), 0.18);
  box-shadow: 0 18px 40px -24px var(--shadow);
`;

const Chrome = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  height: 28px;
  padding: 0 12px;
  border-bottom: 1px solid rgba(var(--border-rgb), 0.14);
`;

const Dots = styled.span`
  display: flex;
  gap: 6px;

  i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(var(--border-rgb), 0.35);
  }
`;

const Address = styled.span`
  flex: 1;
  max-width: 260px;
  margin: 0 auto;
  padding: 2px 10px;
  border-radius: 6px;
  text-align: center;
  font: 11px/1.4 'SF Mono', monospace;
  color: var(--text);
  background: rgba(var(--border-rgb), 0.1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transform: translateX(-20px); /* centre in the bar, not in the space after the dots */
`;

const Viewport = styled.div`
  aspect-ratio: 16 / 7;
  overflow: hidden;

  img,
  video {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: top center;
    transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
`;

export default ProjectMedia;
