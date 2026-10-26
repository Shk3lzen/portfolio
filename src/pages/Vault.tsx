import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiCheck, FiLock } from 'react-icons/fi';
import { useMouseSpotlight } from '../hooks/useMouseSpotlight';
import { profile } from '../data/profile';
import { Season, checkWord, claimCode, find, fragmentsIn, isComplete, useFound } from '../hunt/hunt';
import { getDeviceId } from '../components/runner/net';
import { grantAll } from '../components/runner/cosmetics';

const GOLD = 'hsl(45, 80%, 58%)';

// Fragments opened by typing a word here.
const WORD_FRAGMENTS = ['vault', 'morse', 'image'];

// The treasure hunt's home: progress for each season, the secret-word box, and the prizes.
const Vault = () => {
  const spotlightRef = useMouseSpotlight();
  const found = useFound();
  const done1 = isComplete(found, 1);
  const done2 = isComplete(found, 2);
  const [deviceId] = useState(getDeviceId);

  const [word, setWord] = useState('');
  const [wordState, setWordState] = useState<'idle' | 'wrong'>('idle');
  const [codes, setCodes] = useState<Record<Season, string>>({ 1: '', 2: '' });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (done1) claimCode(deviceId, 1).then((c) => setCodes((cur) => ({ ...cur, 1: c }))).catch(() => {});
    if (done2) claimCode(deviceId, 2).then((c) => setCodes((cur) => ({ ...cur, 2: c }))).catch(() => {});
    // Season 2's prize: everything in the runner's shop.
    if (done2) grantAll();
  }, [done1, done2, deviceId]);

  const visible = done1 ? [1, 2] : [1];
  const wordsLeft = visible.some((season) =>
    fragmentsIn(season as Season).some((f) => WORD_FRAGMENTS.includes(f.id) && !found.includes(f.id))
  );

  const submitWord = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = await checkWord(word);
    if (id && find(id)) {
      setWord('');
      setWordState('idle');
    } else {
      setWordState('wrong');
    }
  };

  const renderSeason = (season: Season) => {
    const list = fragmentsIn(season);
    const got = list.filter((f) => found.includes(f.id)).length;
    return (
      <SeasonSection aria-labelledby={`season-${season}`}>
        <SeasonHeader>
          <SeasonTitle id={`season-${season}`}>Season {season}</SeasonTitle>
          <SeasonCount>
            {got}/{list.length}
            {got === list.length && ' · complete ✓'}
          </SeasonCount>
        </SeasonHeader>
        <Progress aria-hidden="true">
          <ProgressFill style={{ width: `${(got / list.length) * 100}%` }} />
        </Progress>
        <Slots>
          {list.map((fragment, i) => {
            const has = found.includes(fragment.id);
            return (
              <Slot key={fragment.id} $found={has}>
                <SlotIcon aria-hidden="true">{has ? <FiCheck /> : <FiLock />}</SlotIcon>
                <div>
                  <SlotLabel>
                    Fragment {i + 1}
                    {has ? '' : ' · locked'}
                  </SlotLabel>
                  <SlotText>{has ? fragment.title : fragment.hint}</SlotText>
                </div>
              </Slot>
            );
          })}
        </Slots>
      </SeasonSection>
    );
  };

  const prize = (season: Season) => (
    <Panel $gold>
      <PanelTitle>{season === 1 ? 'Season 1 complete 🏆' : 'Season 2 complete 👑'}</PanelTitle>
      <Note>
        {season === 1
          ? 'Your runner bot is gold now (reload the game to see it), and the build notes below are unlocked. To claim a prize, send me this code with a line about how you found the last fragment:'
          : "Legend. Everything in the runner's shop is yours, free. Here's your season 2 code:"}
      </Note>
      <Code aria-label={`Your season ${season} claim code`}>{codes[season] || '…'}</Code>
      <Note>
        {season === 1
          ? 'First finishers get a shoutout, and anyone who sends a code can ask for a 15-minute portfolio or code review.'
          : 'Season 2 codes jump the queue for that review.'}
      </Note>
      <Row>
        <ButtonLink href={profile.contactUrl} target="_blank" rel="noopener noreferrer">
          Send me the code ↗
        </ButtonLink>
        {season === 1 && <ButtonRouterLink to="/how-it-works">Read how I built this →</ButtonRouterLink>}
      </Row>
    </Panel>
  );

  return (
    <PageContainer initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <MouseSpotlight ref={spotlightRef} />
      <Inner>
        <BackLink to="/">← Shkëlzen Berisha</BackLink>

        <PageHeader>
          <PageTitle>The Vault</PageTitle>
          <PageSubtitle>
            {done1
              ? 'Season 1 done. Season 2 is open: harder, and the fragments only count from here on.'
              : `${fragmentsIn(1).length} fragments are hidden around this site. Find them all to open season 2.`}
          </PageSubtitle>
        </PageHeader>

        {renderSeason(1)}
        {done1 ? prize(1) : (
          <Panel>
            <PanelTitle>What you win</PanelTitle>
            <Note>
              Find all {fragmentsIn(1).length} and you get a gold runner bot, a claim code to send me for a shoutout
              or a 15-minute portfolio/code review, the notes on how this site was built, and a second, harder season.
            </Note>
          </Panel>
        )}

        {wordsLeft && (
          <Panel as="form" onSubmit={submitWord}>
            <PanelTitle>Got a secret word?</PanelTitle>
            <Row>
              <TextInput
                value={word}
                onChange={(e) => {
                  setWord(e.target.value);
                  setWordState('idle');
                }}
                placeholder="type it here"
                aria-label="Secret word"
                aria-invalid={wordState === 'wrong'}
                spellCheck={false}
                autoComplete="off"
              />
              <Button type="submit" disabled={!word.trim()}>
                Try it
              </Button>
            </Row>
            {wordState === 'wrong' && <Note role="alert">Nope. The robots know more than they let on.</Note>}
          </Panel>
        )}

        {done1 && renderSeason(2)}
        {done2 && prize(2)}
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
  max-width: 760px;
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

const PageHeader = styled.header`
  margin-bottom: 32px;
`;

const SeasonSection = styled.section`
  margin-bottom: 24px;
`;

const SeasonHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
`;

const SeasonTitle = styled.h2`
  font-family: 'SF Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--heading);
`;

const SeasonCount = styled.span`
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  color: var(--text);
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

const PageSubtitle = styled.p`
  font-size: 16px;
  color: var(--text);

  strong {
    color: var(--heading);
  }
`;

const Progress = styled.div`
  height: 6px;
  margin: 10px 0 16px;
  border-radius: 3px;
  background: rgba(var(--border-rgb), 0.18);
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: var(--accent);
  transition: width 0.4s ease;
`;

const Slots = styled.ol`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 12px;
  margin-bottom: 32px;
`;

const Slot = styled.li<{ $found: boolean }>`
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid ${({ $found }) => ($found ? 'rgba(var(--accent-rgb), 0.4)' : 'rgba(var(--border-rgb), 0.18)')};
  background: ${({ $found }) => ($found ? 'rgba(var(--accent-rgb), 0.06)' : 'rgba(var(--border-rgb), 0.04)')};
`;

const SlotIcon = styled.span`
  padding-top: 2px;
  color: var(--accent);
`;

const SlotLabel = styled.div`
  font-family: 'SF Mono', monospace;
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text);
`;

const SlotText = styled.div`
  font-size: 14px;
  color: var(--heading);
`;

const Panel = styled.div<{ $gold?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid ${({ $gold }) => ($gold ? GOLD : 'rgba(var(--border-rgb), 0.18)')};
  background: rgba(var(--border-rgb), 0.04);
`;

const PanelTitle = styled.h2`
  font-family: 'SF Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--heading);
`;

const Note = styled.p`
  font-size: 14px;
  color: var(--text);
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const TextInput = styled.input`
  flex: 1 1 200px;
  min-width: 0;
  padding: 8px 12px;
  font-family: 'SF Mono', monospace;
  font-size: 14px;
  color: var(--heading);
  background: transparent;
  border: 1px solid rgba(var(--border-rgb), 0.35);
  border-radius: 6px;

  &:focus {
    outline: none;
    border-color: var(--accent);
  }

  &[aria-invalid='true'] {
    border-color: #f87171;
  }
`;

const Button = styled.button`
  padding: 8px 16px;
  font-family: 'SF Mono', monospace;
  font-size: 13px;
  color: var(--accent);
  background: none;
  border: 1px solid var(--accent);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background-color: rgba(var(--accent-rgb), 0.1);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

const ButtonLink = styled(Button).attrs({ as: 'a' })``;

const ButtonRouterLink = styled(Button).attrs({ as: RouterLink })``;

const Code = styled.code`
  align-self: flex-start;
  padding: 8px 14px;
  font-family: 'SF Mono', monospace;
  font-size: 20px;
  letter-spacing: 2px;
  color: ${GOLD};
  border: 1px dashed ${GOLD};
  border-radius: 6px;
  user-select: all;
`;

export default Vault;
