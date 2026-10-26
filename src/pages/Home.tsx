import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { projects } from '../data/projects';
import { useMouseSpotlight } from '../hooks/useMouseSpotlight';
import Reveal from '../components/Reveal';
import GitHubActivity from '../components/GitHubActivity';
import RunnerGame from '../components/RunnerGame';
import InvaderGame from '../components/InvaderGame';
import { INVADERS_ENABLED } from '../features';
import Hero from '../components/hero/Hero';
import { profile } from '../data/profile';
import { experience } from '../data/experience';
import ExperienceCard from '../components/ExperienceCard';
import ProjectCard from '../components/ProjectCard';

const Home = () => {
  const [activeSection, setActiveSection] = useState('about');
  const spotlightRef = useMouseSpotlight();

  const featuredProjects = projects.filter((project) => project.featured);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    let scrollFrame = 0;

    const handleScroll = () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const sections = ['about', 'experience', 'projects'];
        const scrollPosition = window.scrollY + 100;

        for (const section of sections) {
          const element = document.getElementById(section);
          if (element) {
            const offsetTop = element.offsetTop;
            const offsetBottom = offsetTop + element.offsetHeight;

            if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
              setActiveSection(section);
              break;
            }
          }
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Call once to set initial state

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(scrollFrame);
    };
  }, []);

  return (
    <AppContainer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <MouseSpotlight ref={spotlightRef} />
      <LeftColumn>
        <Hero onViewProjects={() => scrollToSection('projects')} />

        <Navigation>
          <NavItem
            className={activeSection === 'about' ? 'active' : ''}
            onClick={() => scrollToSection('about')}
          >
            <NavLine />
            <NavText>ABOUT</NavText>
          </NavItem>
          <NavItem
            className={activeSection === 'experience' ? 'active' : ''}
            onClick={() => scrollToSection('experience')}
          >
            <NavLine />
            <NavText>EXPERIENCE</NavText>
          </NavItem>
          <NavItem
            className={activeSection === 'projects' ? 'active' : ''}
            onClick={() => scrollToSection('projects')}
          >
            <NavLine />
            <NavText>PROJECTS</NavText>
          </NavItem>
        </Navigation>

        <SocialLinks>
          <SocialLink href={profile.github} target="_blank" rel="noopener noreferrer">GitHub</SocialLink>
          <SocialLink href={profile.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</SocialLink>
        </SocialLinks>
      </LeftColumn>

      <RightColumn>
        <Content>
          <Section id="about">
            <Paragraph>
              I&apos;m a full-stack developer with over five years of building the backend systems and web
              applications behind products people use every day. I&apos;m happiest where the hard problems
              are: APIs that need to stay fast under load, data that has to be right in real time, and
              infrastructure that scales without anyone noticing.
            </Paragraph>

            <Paragraph>
              Right now I&apos;m at <Link href="https://www.asendio.io/en" target="_blank" rel="noopener noreferrer">Asendio</Link>,
              building an AI-powered learning platform with NestJS and Next.js: REST and GraphQL APIs, plus
              serverless tooling on AWS Lambda, S3 and API Gateway. Before that I spent four years at Swifty
              Global shipping sports betting products, where live odds and race data had to be both fast and
              correct.
            </Paragraph>

            <Paragraph>
              I work best on small, collaborative teams that ship often, and I mentor junior developers so
              the whole team writes better code.
            </Paragraph>
          </Section>

          <Section id="experience">
            <ExperienceSection>
              {experience.map((role, index) => (
                <Reveal key={role.id} delay={index * 0.05}>
                  <ExperienceCard role={role} />
                </Reveal>
              ))}
            </ExperienceSection>
          </Section>

          <Section id="projects">
            <ProjectsSection>
              {featuredProjects.map((project, index) => (
                <Reveal key={project.id} delay={index * 0.05}>
                  <ProjectCard project={project} />
                </Reveal>
              ))}
            </ProjectsSection>

            <ViewArchiveLink to="/projects">
              View Full Project Archive ↗
            </ViewArchiveLink>

            <GitHubActivity />

            <RunnerGame />

            {INVADERS_ENABLED && <InvaderGame />}

            <Copyright>
              © 2025 Shkëlzen Berisha. All rights reserved.
            </Copyright>
          </Section>
        </Content>
      </RightColumn>
    </AppContainer>
  );
};

// Transparent: the page colour comes from <body>, so the background bots can show through.
const AppContainer = styled(motion.div)`
  min-height: 100vh;
  display: flex;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 50px;
  position: relative;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  @media (max-width: 768px) {
    flex-direction: column;
    padding: 0 25px;
  }
`;

const MouseSpotlight = styled.div`
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 1;
  transition: background 0.2s ease;
`;

const LeftColumn = styled.div`
  width: 40%;
  padding: 100px 50px 100px 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 10;

  /* The hero, nav and links must fit one screen, so tighten up on short laptop displays. */
  @media (min-width: 769px) and (max-height: 820px) {
    padding: 56px 50px 40px 0;
  }

  @media (max-width: 768px) {
    width: 100%;
    position: static;
    height: auto;
    padding: 50px 0;
  }
`;





const Navigation = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 64px;

  @media (max-height: 820px) {
    gap: 14px;
    margin-bottom: 32px;
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const NavItem = styled.button`
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  text-align: left;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: 2px;
  }

  &:hover {
    .nav-text {
      color: var(--accent);
    }
    .nav-line {
      width: 60px;
      background-color: var(--accent);
    }
  }

  &.active {
    .nav-text {
      color: var(--accent);
    }
    .nav-line {
      width: 60px;
      background-color: var(--accent);
    }
  }
`;

const NavLine = styled.div.attrs({ className: 'nav-line' })`
  width: 30px;
  height: 1px;
  background-color: var(--text);
  margin-right: 15px;
  transition: all 0.2s;
`;

const NavText = styled.span.attrs({ className: 'nav-text' })`
  font-family: "SF Mono", monospace;
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--text);
  transition: color 0.2s;
`;

const SocialLinks = styled.div`
  display: flex;
  gap: 24px;
`;

const SocialLink = styled.a`
  color: var(--text);
  text-decoration: none;
  font-size: 14px;
  transition: color 0.2s;

  &:hover {
    color: var(--accent);
  }
`;

const RightColumn = styled.div`
  width: 60%;
  padding: 100px 0 100px 50px;
  z-index: 10;
  position: relative;

  @media (max-width: 768px) {
    width: 100%;
    padding: 0;
  }
`;

const Content = styled.div`
  max-width: 700px;
`;

const Paragraph = styled.p`
  font-size: 16px;
  line-height: 1.6;
  color: var(--text);
  margin-bottom: 24px;
`;

const Link = styled.a`
  color: var(--accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;


const ExperienceSection = styled.div`
  margin-top: 50px;
`;







const ProjectsSection = styled.div`
  margin-top: 50px;
`;






const ViewArchiveLink = styled(RouterLink)`
  display: inline-block;
  margin-top: 10px;
  color: var(--accent);
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  font-family: "SF Mono", monospace;

  &:hover {
    text-decoration: underline;
  }
`;

const Section = styled.section`
  margin-bottom: 80px;

  &#about {
    margin-bottom: 50px;
  }
`;

const Copyright = styled.div`
  font-size: 12px;
  color: var(--text);
  text-align: center;
  margin-top: 100px;
  margin-bottom: 50px;
`;

export default Home;
