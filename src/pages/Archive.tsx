import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { projects } from '../data/projects';
import { useMouseSpotlight } from '../hooks/useMouseSpotlight';

const Archive = () => {
  const spotlightRef = useMouseSpotlight();
  const [activeFilter, setActiveFilter] = useState('All');

  // Scroll to top when landing on the archive (e.g. from the home link).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Unique tech list across all projects, alphabetized, prefixed with "All".
  const filters = useMemo(() => {
    const techs = new Set<string>();
    projects.forEach((project) => project.tech.forEach((tech) => techs.add(tech)));
    return ['All', ...Array.from(techs).sort((a, b) => a.localeCompare(b))];
  }, []);

  const visibleProjects = useMemo(() => {
    const filtered =
      activeFilter === 'All'
        ? projects
        : projects.filter((project) => project.tech.includes(activeFilter));
    // Newest first.
    return [...filtered].sort((a, b) => b.year.localeCompare(a.year));
  }, [activeFilter]);

  return (
    <PageContainer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <MouseSpotlight ref={spotlightRef} />
      <Inner>
        <BackLink to="/">← Shkëlzen Berisha</BackLink>

        <PageHeader>
          <PageTitle>Projects Archive</PageTitle>
          <PageSubtitle>A comprehensive list of things I've designed and built.</PageSubtitle>
        </PageHeader>

        <Filters role="group" aria-label="Filter projects by technology">
          {filters.map((filter) => (
            <FilterChip
              key={filter}
              className={activeFilter === filter ? 'active' : ''}
              aria-pressed={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </FilterChip>
          ))}
        </Filters>

        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <Th>Year</Th>
                <Th>Project</Th>
                <ThTech>Built with</ThTech>
                <ThLink>Link</ThLink>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project) => (
                <Row key={project.id}>
                  <TdYear>{project.year}</TdYear>
                  <TdTitle>{project.title}</TdTitle>
                  <TdTech>
                    <TechRow>
                      {project.tech.map((tech) => (
                        <TechPill
                          key={tech}
                          onClick={() => setActiveFilter(tech)}
                          title={`Filter by ${tech}`}
                        >
                          {tech}
                        </TechPill>
                      ))}
                    </TechRow>
                  </TdTech>
                  <TdLink>
                    <ExternalLink
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit ${project.title}`}
                    >
                      ↗
                    </ExternalLink>
                  </TdLink>
                </Row>
              ))}
            </tbody>
          </Table>

          {visibleProjects.length === 0 && (
            <EmptyState>No projects match “{activeFilter}”.</EmptyState>
          )}
        </TableWrapper>
      </Inner>
    </PageContainer>
  );
};

const PageContainer = styled(motion.div)`
  background-color: var(--bg);
  min-height: 100vh;
  position: relative;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  &::before {
    content: '';
    position: fixed;
    inset: 0;
    background: var(--bg);
    z-index: -1;
  }
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
  max-width: 1000px;
  margin: 0 auto;
  padding: 100px 50px;

  @media (max-width: 768px) {
    padding: 60px 25px;
  }
`;

const BackLink = styled(RouterLink)`
  display: inline-block;
  color: var(--accent);
  text-decoration: none;
  font-family: "SF Mono", monospace;
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
  margin-bottom: 40px;
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
`;

const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 40px;
`;

const FilterChip = styled.button`
  cursor: pointer;
  font-family: "SF Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--text);
  background: transparent;
  border: 1px solid rgba(var(--border-rgb), 0.3);
  border-radius: 999px;
  padding: 6px 14px;
  transition: all 0.2s;

  &:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  &.active {
    color: var(--accent);
    border-color: var(--accent);
    background-color: rgba(var(--accent-rgb), 0.1);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

const TableWrapper = styled.div`
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  text-align: left;
  padding: 14px 16px;
  font-family: "SF Mono", monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
  letter-spacing: 0.5px;
  border-bottom: 1px solid rgba(var(--border-rgb), 0.2);
  position: sticky;
  top: 0;
  background-color: var(--bg);
`;

const ThTech = styled(Th)`
  @media (max-width: 640px) {
    display: none;
  }
`;

const ThLink = styled(Th)`
  width: 60px;
`;

const Row = styled.tr`
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(var(--accent-rgb), 0.04);
  }
`;

const Td = styled.td`
  padding: 16px;
  border-bottom: 1px solid rgba(var(--border-rgb), 0.1);
  vertical-align: top;
`;

const TdYear = styled(Td)`
  font-family: "SF Mono", monospace;
  font-size: 14px;
  color: var(--text);
  white-space: nowrap;
`;

const TdTitle = styled(Td)`
  font-size: 15px;
  font-weight: 500;
  color: var(--heading);
  white-space: nowrap;
`;

const TdTech = styled(Td)`
  @media (max-width: 640px) {
    display: none;
  }
`;

const TdLink = styled(Td)`
  text-align: center;
`;

const TechRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const TechPill = styled.button`
  cursor: pointer;
  font-family: "SF Mono", monospace;
  font-size: 11px;
  color: var(--accent);
  background-color: rgba(var(--accent-rgb), 0.1);
  border: none;
  padding: 3px 8px;
  border-radius: 10px;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(var(--accent-rgb), 0.2);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

const ExternalLink = styled.a`
  color: var(--text);
  text-decoration: none;
  font-size: 18px;
  transition: color 0.2s, transform 0.2s;
  display: inline-block;

  &:hover {
    color: var(--accent);
    transform: translate(2px, -2px);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: 2px;
  }
`;

const EmptyState = styled.div`
  padding: 40px 16px;
  color: var(--text);
  font-size: 14px;
`;

export default Archive;
