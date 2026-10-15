import React from 'react';
import styled from 'styled-components';

const TechTags: React.FC<{ tech: string[] }> = ({ tech }) => (
  <List>
    {tech.map((t) => (
      <Tag key={t}>{t}</Tag>
    ))}
  </List>
);

const List = styled.ul`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  position: relative;
  z-index: 2;
`;

const Tag = styled.li`
  font-size: 12px;
  color: var(--accent);
  background-color: rgba(var(--accent-rgb), 0.1);
  padding: 4px 10px;
  border-radius: 12px;
  font-family: 'SF Mono', monospace;
  transition: transform 0.15s ease, background-color 0.15s ease;

  &:hover {
    transform: scale(1.06);
    background-color: rgba(var(--accent-rgb), 0.18);
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover {
      transform: none;
    }
  }
`;

export default TechTags;
