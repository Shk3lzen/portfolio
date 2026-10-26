import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FiArrowUpRight, FiTrendingUp } from 'react-icons/fi';
import { find } from '../hunt/hunt';
import type { Project } from '../data/projects';
import ProjectMedia from './ProjectMedia';
import TechTags from './TechTags';

// A featured project: product shot on top, then what it is, what I did, what it achieved.
// The whole card is clickable through the title link (stretched over the card).
// Shift-click flips it over to a back side instead (a season 2 treasure-hunt fragment).
const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
  const [flipped, setFlipped] = useState(false);

  const onClickCapture = (e: React.MouseEvent) => {
    if (!e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();
    setFlipped((f) => !f);
    find('flip');
  };

  if (flipped) {
    return (
      <Card onClickCapture={onClickCapture}>
        <Back initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
          <Meta>The back of the card</Meta>
          <Title>{project.title}</Title>
          <Description>
            You found the other side. Built in {project.year} with {project.tech.length} technologies
            {project.role ? `, where my part was: ${project.role.toLowerCase()}` : ''}. Most visitors only ever see the
            front.
          </Description>
          <Description>
            <FlipBack type="button" onClick={() => setFlipped(false)}>
              Flip it back
            </FlipBack>
          </Description>
        </Back>
      </Card>
    );
  }

  return (
    <Card onClickCapture={onClickCapture}>
      {project.image && (
        <ProjectMedia url={project.url} image={project.image} alt={project.imageAlt ?? project.title} video={project.video} />
      )}
      <Body>
        <Meta>
          {project.year}
          {project.role && <> · {project.role}</>}
        </Meta>
        <Title>
          <StretchedLink href={project.url} target="_blank" rel="noopener noreferrer">
            {project.title}
            <FiArrowUpRight aria-hidden="true" />
          </StretchedLink>
        </Title>
        <Description>{project.description}</Description>
        {project.impact && project.impact.length > 0 && (
          <Impact>
            {project.impact.map((line) => (
              <li key={line}>
                <FiTrendingUp aria-hidden="true" />
                {line}
              </li>
            ))}
          </Impact>
        )}
        <TechTags tech={project.tech} />
      </Body>
    </Card>
  );
};

const Back = styled(motion.div)`
  padding: 24px 4px;
`;

const FlipBack = styled.button`
  font: inherit;
  color: var(--accent);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

const StretchedLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--heading);
  transition: color 0.2s;

  svg {
    transition: transform 0.2s ease;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: inherit;
  }

  &:focus-visible {
    outline: none;
  }
`;

const Card = styled.article`
  position: relative;
  border-radius: 14px;
  padding: 14px;
  margin: 0 -14px 28px;
  border: 1px solid transparent;
  transition: transform 0.25s ease, background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;

  &:hover,
  &:focus-within {
    transform: translateY(-4px);
    background-color: rgba(var(--accent-rgb), 0.04);
    border-color: rgba(var(--accent-rgb), 0.18);
    box-shadow: 0 24px 50px -30px var(--shadow);

    ${StretchedLink} {
      color: var(--accent);
    }

    ${StretchedLink} svg {
      transform: translate(2px, -2px);
    }

    img,
    video {
      transform: scale(1.03);
    }
  }

  &:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover,
    &:focus-within {
      transform: none;

      img,
      video {
        transform: none;
      }
    }
  }
`;

const Body = styled.div`
  padding: 18px 4px 4px;
`;

const Meta = styled.p`
  font: 12px/1.4 'SF Mono', monospace;
  letter-spacing: 0.5px;
  color: var(--accent);
  margin-bottom: 6px;
`;

const Title = styled.h3`
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 10px;
`;

const Description = styled.p`
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
  margin-bottom: 14px;
`;

const Impact = styled.ul`
  display: grid;
  gap: 6px;
  margin-bottom: 16px;

  li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--heading);
  }

  svg {
    flex: none;
    color: var(--accent);
    transform: translateY(2px);
  }
`;

export default ProjectCard;
