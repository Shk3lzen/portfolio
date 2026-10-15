import React from 'react';
import styled from 'styled-components';
import { FiArrowRight, FiArrowUpRight, FiDownload } from 'react-icons/fi';
import { profile } from '../../data/profile';
import Avatar from './Avatar';
import RoleTicker from './RoleTicker';

// Top of the sticky left column: who, what, why hire me, and what to do next.
const Hero: React.FC<{ onViewProjects: () => void }> = ({ onViewProjects }) => (
  <Header>
    <Avatar src={profile.avatarUrl} alt={`Portrait of ${profile.name}`} />
    {profile.availability && (
      <Availability>
        <Pulse aria-hidden="true" />
        {profile.availability}
      </Availability>
    )}
    <Name>{profile.name}</Name>
    <RoleTicker role={profile.role} focus={profile.focus} />
    <ValueProp>
      I turn complex backend problems into <strong>fast, reliable products</strong>, from real-time
      betting odds to AI-powered learning.
    </ValueProp>

    <CtaRow>
      <PrimaryCta href={profile.contactUrl} target="_blank" rel="noopener noreferrer">
        Get in touch <FiArrowUpRight aria-hidden="true" />
      </PrimaryCta>
      <SecondaryCta type="button" onClick={onViewProjects}>
        View projects <FiArrowRight aria-hidden="true" />
      </SecondaryCta>
    </CtaRow>
    {profile.cvUrl && (
      <CvLink href={profile.cvUrl} download>
        <FiDownload aria-hidden="true" /> Download CV
      </CvLink>
    )}
  </Header>
);

const Header = styled.header`
  margin-bottom: 30px;

  @media (max-width: 768px) {
    margin-bottom: 20px;
  }
`;

const Availability = styled.p`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 4px 12px;
  border-radius: 999px;
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.08);
  border: 1px solid rgba(var(--accent-rgb), 0.25);
`;

const Pulse = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 2s ease-out infinite;

  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0.6); }
    70%, 100% { box-shadow: 0 0 0 7px rgba(var(--accent-rgb), 0); }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Name = styled.h1`
  font-size: 46px;
  font-weight: 700;
  color: var(--heading);
  margin-bottom: 8px;
  line-height: 1.1;
  letter-spacing: -0.5px;

  @media (max-width: 768px) {
    font-size: 36px;
  }
`;

const ValueProp = styled.p`
  font-size: 18px;
  color: var(--text);
  line-height: 1.6;
  max-width: 440px;
  font-weight: 400;

  strong {
    color: var(--heading);
    font-weight: 500;
  }
`;

const CtaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
`;

const ctaBase = `
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 6px;
  font: 500 14px/1 'SF Mono', monospace;
  letter-spacing: 0.3px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;

  svg {
    transition: transform 0.2s ease;
  }

  &:hover {
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover {
      transform: none;
    }
  }
`;

const PrimaryCta = styled.a`
  ${ctaBase}
  color: var(--bg);
  background: var(--accent);
  border: 1px solid var(--accent);
  box-shadow: 0 6px 20px -8px rgba(var(--accent-rgb), 0.7);

  &:hover {
    box-shadow: 0 10px 26px -8px rgba(var(--accent-rgb), 0.85);
  }

  &:hover svg {
    transform: translate(2px, -2px);
  }
`;

const SecondaryCta = styled.button`
  ${ctaBase}
  color: var(--accent);
  background: transparent;
  border: 1px solid rgba(var(--accent-rgb), 0.5);

  &:hover {
    background: rgba(var(--accent-rgb), 0.08);
  }

  &:hover svg {
    transform: translateX(3px);
  }
`;

const CvLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  font-size: 14px;
  color: var(--text);
  transition: color 0.2s;

  &:hover {
    color: var(--accent);
  }
`;

export default Hero;
