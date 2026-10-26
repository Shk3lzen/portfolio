import React, { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useMouseSpotlight } from '../hooks/useMouseSpotlight';
import { isComplete, useFound } from '../hunt/hunt';

// Build notes for the game and the hunt, unlocked by finishing season 1 of the treasure hunt.

interface Note {
  title: string;
  body: string[];
}

const NOTES: Note[] = [
  {
    title: 'One course a day, the same for everyone',
    body: [
      "The runner's course comes from a seeded PRNG (mulberry32) keyed on the UTC date, so every visitor gets the same obstacles all day.",
      "Speed is a function of distance travelled, not time, and obstacles are placed in course space. A 60 Hz laptop and a 120 Hz phone see the exact same run.",
      'Daily modifiers (low gravity, a tiny bot, turbo…) are part of the simulation and picked by weekday, so they stay fair too.',
    ],
  },
  {
    title: 'Scores you can replay',
    body: [
      'Every solo run is recorded as a "tape": frame times rounded to a tenth of a millisecond, plus jump presses and releases. The game steps with the rounded times, so replaying the tape reproduces the run bit for bit.',
      'A Cloudflare Worker with a D1 database replays each submitted tape through the same engine code and stores the score it gets, never the one the browser claims. It also refuses runs that arrive faster than they could have been played.',
      'The same tapes power ghosts: your best run of the day, or a leaderboard run, plays alongside yours.',
    ],
  },
  {
    title: 'Multiplayer without a server',
    body: [
      'Players find each other through a free public MQTT broker over secure WebSockets: presence by heartbeat, positions ten times a second, and smooth extrapolation in between.',
      "The daily board uses retained messages, one topic per device, so subscribing returns everyone's best. Everything from the public channel is validated before it can reach the page.",
      'If no broker is reachable it falls back to a BroadcastChannel (tabs on one machine), then to this device only.',
    ],
  },
  {
    title: 'Adding things without moving things',
    body: [
      'Coins and power-ups draw from their own PRNG streams, separate from the obstacle stream. Adding them left every existing course exactly where it was (checked against the old engine before shipping).',
      'New obstacle types only join the pool past a score threshold, so the early course of any day never changes when something new ships.',
    ],
  },
  {
    title: 'Drawing',
    body: [
      'One canvas per game. Colours come from the CSS theme variables and are re-read by a MutationObserver when the theme flips.',
      "Lights out is a radial gradient painted with destination-out, erasing everything outside a circle around your bot. The glitch copies strips of the canvas onto itself, shifted sideways. Mirror day flips the world's transform but keeps text readable.",
    ],
  },
  {
    title: 'The hunt',
    body: [
      'Fragments live in localStorage and announce themselves with a DOM event that the toolbar counter, the toast and the vault all listen for.',
      "Typed answers are compared as SHA-256 hashes, so they aren't sitting in the bundle in plain text. It's still an honour system: anyone determined can read the code, and that's one way to play.",
    ],
  },
  {
    title: 'Stack',
    body: [
      'React 19 and TypeScript, styled-components, Framer Motion, Create React App, hosted on GitHub Pages with a hash router. The score server is a Cloudflare Worker with D1.',
    ],
  },
];

const HowItWorks = () => {
  const spotlightRef = useMouseSpotlight();
  const found = useFound();
  const unlocked = isComplete(found, 1);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <PageContainer initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <MouseSpotlight ref={spotlightRef} />
      <Inner>
        <BackLink to="/vault">← The Vault</BackLink>
        <PageTitle>How I built this</PageTitle>
        {unlocked ? (
          <>
            <Subtitle>The engineering behind the runner game and the treasure hunt you just finished.</Subtitle>
            {NOTES.map((note) => (
              <Section key={note.title}>
                <SectionTitle>{note.title}</SectionTitle>
                {note.body.map((p) => (
                  <Paragraph key={p}>{p}</Paragraph>
                ))}
              </Section>
            ))}
          </>
        ) : (
          <Subtitle>
            Locked. Finish season 1 of the <RouterLink to="/vault">vault</RouterLink> to read these notes.
          </Subtitle>
        )}
      </Inner>
    </PageContainer>
  );
};

// Transparent: the page colour comes from <body>, so the background bots can show through.
const PageContainer = styled(motion.div)`
  min-height: 100vh;
  position: relative;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const MouseSpotlight = styled.div`
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 1;
  transition: background 0.2s ease;
`;

const Inner = styled.div`
  position: relative;
  z-index: 10;
  max-width: 720px;
  margin: 0 auto;
  padding: 100px 50px;

  @media (max-width: 768px) {
    padding: 60px 16px;
  }
`;

const BackLink = styled(RouterLink)`
  display: inline-block;
  color: var(--accent);
  font-family: 'SF Mono', monospace;
  font-size: 14px;
  letter-spacing: 0.5px;
  margin-bottom: 40px;
  transition: transform 0.2s;

  &:hover {
    transform: translateX(-4px);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: 2px;
  }
`;

const PageTitle = styled.h1`
  font-size: 48px;
  font-weight: 700;
  color: var(--heading);
  letter-spacing: -0.5px;
  margin-bottom: 10px;

  @media (max-width: 768px) {
    font-size: 36px;
  }
`;

const Subtitle = styled.p`
  margin-bottom: 40px;
  font-size: 16px;
  color: var(--text);

  a {
    color: var(--accent);
  }
`;

const Section = styled.section`
  margin-bottom: 36px;
`;

const SectionTitle = styled.h2`
  margin-bottom: 12px;
  font-size: 20px;
  color: var(--heading);
`;

const Paragraph = styled.p`
  margin-bottom: 12px;
  font-size: 16px;
  line-height: 1.7;
  color: var(--text);
`;

export default HowItWorks;
