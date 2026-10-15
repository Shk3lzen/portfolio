import React from 'react';
import styled from 'styled-components';
import { FiArrowUpRight, FiCheck } from 'react-icons/fi';
import type { Role } from '../data/experience';
import TechTags from './TechTags';

const ExperienceCard: React.FC<{ role: Role }> = ({ role }) => (
  <Card>
    <Dates>{role.dates}</Dates>
    <Title>
      {role.title} ·{' '}
      <CompanyLink href={role.companyUrl} target="_blank" rel="noopener noreferrer">
        {role.company}
        <FiArrowUpRight aria-hidden="true" />
      </CompanyLink>
    </Title>
    <Description>{role.description}</Description>
    {role.highlights && role.highlights.length > 0 && (
      <Highlights>
        {role.highlights.map((line) => (
          <li key={line}>
            <FiCheck aria-hidden="true" />
            {line}
          </li>
        ))}
      </Highlights>
    )}
    <TechTags tech={role.tech} />
  </Card>
);

// Padding with a matching negative margin keeps the text aligned with the column, so the
// hover background can appear without anything shifting.
const Card = styled.article`
  margin: 0 -20px 30px;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid transparent;
  transition: transform 0.25s ease, background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;

  &:hover {
    transform: translateY(-3px);
    background-color: rgba(var(--accent-rgb), 0.04);
    border-color: rgba(var(--accent-rgb), 0.15);
    box-shadow: 0 20px 40px -28px var(--shadow);
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover {
      transform: none;
    }
  }
`;

const Dates = styled.p`
  font: 13px/1.4 'SF Mono', monospace;
  color: var(--accent);
  margin-bottom: 8px;
`;

const Title = styled.h3`
  font-size: 18px;
  font-weight: 500;
  color: var(--heading);
  line-height: 1.3;
  margin-bottom: 10px;
`;

const CompanyLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);

  svg {
    transition: transform 0.2s ease;
  }

  &:hover svg {
    transform: translate(2px, -2px);
  }
`;

const Description = styled.p`
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
  margin-bottom: 14px;
`;

const Highlights = styled.ul`
  display: grid;
  gap: 6px;
  margin-bottom: 16px;

  li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 14px;
    color: var(--heading);
  }

  svg {
    flex: none;
    color: var(--accent);
    transform: translateY(2px);
  }
`;

export default ExperienceCard;
