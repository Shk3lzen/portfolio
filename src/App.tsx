import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const App = () => {
  const [activeSection, setActiveSection] = useState('about');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
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
    };

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    handleScroll(); // Call once to set initial state

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <AppContainer>
      <MouseSpotlight 
        style={{
          background: `radial-gradient(600px at ${mousePosition.x}px ${mousePosition.y}px, rgba(29, 78, 216, 0.15), transparent 80%)`
        }}
      />
      <LeftColumn>
        <Header>
          <Name>Shkëlzen Berisha</Name>
          <Title>Full-Stack Software Developer</Title>
          <Tagline>
            I build scalable, high-performing web applications and backend systems 
            that power modern digital experiences with cutting-edge technologies.
          </Tagline>
        </Header>

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
          <SocialLink href="https://github.com/Shk3lzen" target="_blank">GitHub</SocialLink>
          <SocialLink href="https://www.linkedin.com/in/shkelzen-berisha/" target="_blank">LinkedIn</SocialLink>
        </SocialLinks>
      </LeftColumn>

      <RightColumn>
        <Content>
          <Section id="about">
            <Paragraph>
              I have over five years of experience creating scalable, high-performing backend systems 
              and web applications, and I am an enthusiastic software developer. With a focus on React.js, 
              Node.js, and contemporary web development frameworks like Next.js and Nest.js, I specialize 
              in developing robust, user-focused solutions that guarantee seamless front-end interface 
              and back-end infrastructure integration.
            </Paragraph>

            <Paragraph>
              Currently, I'm a Software Developer at <Link href="https://www.speeex.com/" target="_blank">SPEEEX</Link> and 
              <Link href="https://www.asendio.io/en" target="_blank"> Asendio</Link>, where I design and implement 
              scalable architecture using NestJS and Next.js across multiple client projects. I develop and maintain 
              API frameworks, including REST, GraphQL, and serverless solutions, while building tools and services 
              using AWS technologies such as Lambda, S3, and API Gateway.
            </Paragraph>

            <Paragraph>
              I work best in cooperative settings, collaborating with multidisciplinary groups to produce 
              creative software solutions. I have demonstrated my ability to use cutting-edge technologies 
              like TypeScript, GraphQL, and serverless architectures to create applications that satisfy 
              both technical and business goals. Additionally, I mentor junior developers to improve team 
              productivity and code quality.
            </Paragraph>
          </Section>

          <Section id="experience">
            <ExperienceSection>
              <ExperienceItem>
                <ExperienceDate>MAY 2025 — PRESENT</ExperienceDate>
                <ExperienceTitle>
                  Software Developer · <Link href="https://www.asendio.io/en" target="_blank">Asendio</Link> ↗
                </ExperienceTitle>
                <ExperienceDescription>
                  Design and implement scalable architecture using NestJS and Next.js across multiple client projects. 
                  Develop and maintain API frameworks, including REST, GraphQL, and serverless. Build tools and services 
                  using AWS technologies such as Lambda, S3, and API Gateway.
                </ExperienceDescription>
                <TechList>
                  <TechItem>NestJS</TechItem>
                  <TechItem>Next.js</TechItem>
                  <TechItem>TypeScript</TechItem>
                  <TechItem>GraphQL</TechItem>
                  <TechItem>AWS</TechItem>
                  <TechItem>MongoDB</TechItem>
                </TechList>
              </ExperienceItem>

              <ExperienceItem>
                <ExperienceDate>MAY 2025 — PRESENT</ExperienceDate>
                <ExperienceTitle>
                  Software Developer · <Link href="https://www.speeex.com/" target="_blank">SPEEEX</Link> ↗
                </ExperienceTitle>
                <ExperienceDescription>
                  Design and implement scalable architecture using NestJS and Next.js across multiple client projects. 
                  Integrate third-party APIs utilizing JSON, XML, API routes, and token-based authentication. 
                  Mentor junior developers and optimize databases like MongoDB to enhance performance and reliability.
                </ExperienceDescription>
                <TechList>
                  <TechItem>NestJS</TechItem>
                  <TechItem>Next.js</TechItem>
                  <TechItem>Node.js</TechItem>
                  <TechItem>GraphQL</TechItem>
                  <TechItem>AWS</TechItem>
                  <TechItem>MongoDB</TechItem>
                </TechList>
              </ExperienceItem>

              <ExperienceItem>
                <ExperienceDate>JAN 2020 — APR 2025 · 5 YRS 4 MOS</ExperienceDate>
                <ExperienceTitle>
                  Software Developer · <Link href="https://www.swiftyglobal.com/" target="_blank">Swifty Global</Link> ↗
                </ExperienceTitle>
                <ExperienceDescription>
                  Designed and implemented scalable architecture solutions using Node.js and React.js for a variety of clients. 
                  Developed and maintained API frameworks including REST, GraphQL, and Serverless. Utilized AWS services 
                  like Lambda, S3, and API Gateway to create tools and services for customers.
                </ExperienceDescription>
                <TechList>
                  <TechItem>Node.js</TechItem>
                  <TechItem>React.js</TechItem>
                  <TechItem>NestJS</TechItem>
                  <TechItem>GraphQL</TechItem>
                  <TechItem>AWS</TechItem>
                  <TechItem>MongoDB</TechItem>
                  <TechItem>MySQL</TechItem>
                </TechList>
              </ExperienceItem>
            </ExperienceSection>
{/* 
            <ViewResumeLink href="/resume.pdf" target="_blank">
              View Full Résumé ↗
            </ViewResumeLink> */}
          </Section>

          <Section id="projects">
            <ProjectsSection>
              <ProjectItem>
                <ProjectContent>
                  <ProjectTitle>
                    <Link href="https://www.speeex.com/" target="_blank">SPEEEX Platform</Link> ↗
                  </ProjectTitle>
                  <ProjectDescription>
                    Enterprise-level CX and digital transformation platform empowering brands through excellence. 
                    Built scalable architecture with advanced accessibility features and maintained API frameworks 
                    for optimal performance across the entire product suite.
                  </ProjectDescription>
                  <TechList>
                    <TechItem>React</TechItem>
                    <TechItem>TypeScript</TechItem>
                    <TechItem>NestJS</TechItem>
                    <TechItem>GraphQL</TechItem>
                    <TechItem>AWS</TechItem>
                  </TechList>
                </ProjectContent>
                <ProjectImage>
                  <img src="/a.png" alt="SPEEEX Platform interface showing digital transformation dashboard" />
                </ProjectImage>
              </ProjectItem>

              <ProjectItem>
                <ProjectContent>
                  <ProjectTitle>
                    <Link href="https://www.swiftysports.co.uk/en" target="_blank">Swifty Sports</Link> ↗
                  </ProjectTitle>
                  <ProjectDescription>
                    Comprehensive sports betting platform with real-time horse racing data, live odds, and interactive betting interface. 
                    Features daily price boosts, BOG availability, and responsive design for optimal user experience across all devices.
                  </ProjectDescription>
                  <TechList>
                    <TechItem>React</TechItem>
                    <TechItem>Next.js</TechItem>
                    <TechItem>TypeScript</TechItem>
                    <TechItem>Real-time APIs</TechItem>
                    <TechItem>Node.js</TechItem>
                  </TechList>
                </ProjectContent>
                <ProjectImage>
                  <img src="/ba.png" alt="Swifty Sports betting interface with horse racing odds and live data" />
                </ProjectImage>
              </ProjectItem>

              <ProjectItem>
                <ProjectContent>
                  <ProjectTitle>
                    <Link href="https://toppredictor.com/" target="_blank">Top Predictor</Link> ↗
                  </ProjectTitle>
                  <ProjectDescription>
                    Advanced sports prediction platform with gamified experience. Users can predict smarter, score higher, 
                    and dominate leaderboards while competing with friends and showcasing expertise across multiple sports.
                  </ProjectDescription>
                  <TechList>
                    <TechItem>React</TechItem>
                    <TechItem>TypeScript</TechItem>
                    <TechItem>D3.js</TechItem>
                    <TechItem>Node.js</TechItem>
                    <TechItem>PostgreSQL</TechItem>
                  </TechList>
                </ProjectContent>
                <ProjectImage>
                  <img src="/d.png" alt="Top Predictor sports prediction interface with leaderboards and competitions" />
                </ProjectImage>
              </ProjectItem>

              <ProjectItem>
                <ProjectContent>
                  <ProjectTitle>
                    <Link href="https://www.swiftyglobal.com/" target="_blank">Swifty Global</Link> ↗
                  </ProjectTitle>
                  <ProjectDescription>
                    Global digital solutions platform delivering thrilling sports experiences and betting excitement. 
                    Architected scalable frontend solutions with extensive range of sports options and modern user interfaces.
                  </ProjectDescription>
                  <TechList>
                    <TechItem>JavaScript</TechItem>
                    <TechItem>React</TechItem>
                    <TechItem>Next.js</TechItem>
                    <TechItem>MongoDB</TechItem>
                    <TechItem>AWS</TechItem>
                  </TechList>
                </ProjectContent>
                <ProjectImage>
                  <img src="/c.png" alt="Swifty Global platform showing sports betting interface and mobile app" />
                </ProjectImage>
              </ProjectItem>

              <ProjectItem>
                <ProjectContent>
                  <ProjectTitle>
                    <Link href="https://www.asendio.io/en" target="_blank">Asendio LXP</Link> ↗
                  </ProjectTitle>
                  <ProjectDescription>
                    AI-Powered Learning Experience Platform revolutionizing corporate training. Features adaptive learning, 
                    targeted growth modules, and real-time feedback systems trusted by leading enterprises including SPEEEX.
                  </ProjectDescription>
                  <TechList>
                    <TechItem>React</TechItem>
                    <TechItem>NestJS</TechItem>
                    <TechItem>AI/ML</TechItem>
                    <TechItem>Node.js</TechItem>
                    <TechItem>TypeScript</TechItem>
                  </TechList>
                </ProjectContent>
                <ProjectImage>
                  <img src="/b.png" alt="Asendio LXP learning platform interface with AI-powered content creation" />
                </ProjectImage>
              </ProjectItem>
            </ProjectsSection>

            <ViewArchiveLink href="/archive" target="_blank">
              View Full Project Archive ↗
            </ViewArchiveLink>

            <Copyright>
              © 2025 Shkëlzen Berisha. All rights reserved.
            </Copyright>
          </Section>
        </Content>
      </RightColumn>
    </AppContainer>
  );
};

const AppContainer = styled.div`
  background-color: #0a192f;
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

  &::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #0a192f;
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

  @media (max-width: 768px) {
    width: 100%;
    position: static;
    height: auto;
    padding: 50px 0;
  }
`;

const Header = styled.header`
  margin-bottom: 30px;

  @media (max-width: 768px) {
    margin-bottom: 20px;
  }
`;

const Name = styled.h1`
  font-size: 46px;
  font-weight: 700;
  color: #ccd6f6;
  margin-bottom: 8px;
  line-height: 1.1;
  letter-spacing: -0.5px;

  @media (max-width: 768px) {
    font-size: 36px;
  }
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 400;
  color: #64ffda;
  margin-bottom: 20px;
  line-height: 1.2;

  @media (max-width: 768px) {
    font-size: 20px;
  }
`;

const Tagline = styled.p`
  font-size: 18px;
  color: #8892b0;
  line-height: 1.6;
  max-width: 450px;
  font-weight: 400;
`;

const Navigation = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 80px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const NavItem = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    .nav-text {
      color: #64ffda;
    }
    .nav-line {
      width: 60px;
      background-color: #64ffda;
    }
  }

  &.active {
    .nav-text {
      color: #64ffda;
    }
    .nav-line {
      width: 60px;
      background-color: #64ffda;
    }
  }
`;

const NavLine = styled.div.attrs({ className: 'nav-line' })`
  width: 30px;
  height: 1px;
  background-color: #8892b0;
  margin-right: 15px;
  transition: all 0.2s;
`;

const NavText = styled.span.attrs({ className: 'nav-text' })`
  font-family: "SF Mono", monospace;
  font-size: 13px;
  letter-spacing: 1px;
  color: #8892b0;
  transition: color 0.2s;
`;

const SocialLinks = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const SocialLink = styled.a`
  color: #8892b0;
  text-decoration: none;
  font-size: 14px;
  transition: color 0.2s;

  &:hover {
    color: #64ffda;
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
  color: #8892b0;
  margin-bottom: 24px;
`;

const Link = styled.a`
  color: #64ffda;
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ExperienceSection = styled.div`
  margin-top: 50px;
`;

const ExperienceItem = styled.div`
  margin-bottom: 50px;
  padding: 20px 0;
  transition: all 0.2s;
  border-radius: 4px;

  &:hover {
    background-color: rgba(100, 255, 218, 0.05);
    margin: 0 -20px;
    padding: 20px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    backdrop-filter: blur(16px);
  }
`;

const ExperienceDate = styled.div`
  font-family: "SF Mono", monospace;
  font-size: 13px;
  color: #64ffda;
  margin-bottom: 8px;
`;

const ExperienceTitle = styled.h3`
  font-size: 18px;
  font-weight: 500;
  color: #ccd6f6;
  line-height: 1.3;
  margin-bottom: 10px;
`;

const ExperienceDescription = styled.p`
  font-size: 14px;
  line-height: 1.5;
  color: #8892b0;
  margin-bottom: 15px;
`;

const TechList = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const TechItem = styled.span`
  font-size: 12px;
  color: #64ffda;
  background-color: rgba(100, 255, 218, 0.1);
  padding: 4px 8px;
  border-radius: 12px;
  font-family: "SF Mono", monospace;
`;

const ViewResumeLink = styled.a`
  display: inline-block;
  margin-top: 30px;
  margin-bottom: 50px;
  color: #64ffda;
  text-decoration: none;
  font-size: 16px;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`;

const ProjectsSection = styled.div`
  margin-top: 50px;
`;

const ProjectItem = styled.div`
  margin-bottom: 40px;
  padding: 20px 0;
  transition: all 0.2s;
  border-radius: 4px;
  display: flex;
  gap: 30px;
  align-items: flex-start;

  &:hover {
    background-color: rgba(100, 255, 218, 0.05);
    margin: 0 -20px;
    padding: 20px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    backdrop-filter: blur(16px);
  }

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 20px;
  }
`;

const ProjectContent = styled.div`
  flex: 2;
  min-width: 0;
`;

const ProjectTitle = styled.h3`
  font-size: 18px;
  font-weight: 500;
  color: #ccd6f6;
  line-height: 1.3;
  margin-bottom: 10px;
`;

const ProjectDescription = styled.p`
  font-size: 14px;
  line-height: 1.5;
  color: #8892b0;
  margin-bottom: 15px;
`;

const ProjectImage = styled.div`
  flex: 1;
  max-width: 300px;
  min-width: 200px;
  position: relative;
  order: -1;
  
  img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 4px;
    transition: all 0.25s cubic-bezier(0.645, 0.045, 0.355, 1);
    filter: grayscale(100%) contrast(1) brightness(90%);
    border: 2px solid rgba(100, 255, 218, 0.1);
    box-shadow: 0 10px 30px -15px rgba(2, 12, 27, 0.7);
  }

  &:hover img {
    filter: none;
    transform: translate(-10px, -10px);
    box-shadow: 0 20px 30px -15px rgba(2, 12, 27, 0.7);
    border-color: rgba(100, 255, 218, 0.3);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(100, 255, 218, 0.1);
    border-radius: 4px;
    transition: all 0.25s cubic-bezier(0.645, 0.045, 0.355, 1);
    z-index: 1;
    pointer-events: none;
  }

  &:hover::before {
    background-color: transparent;
  }

  @media (max-width: 768px) {
    max-width: 100%;
    order: 0;
    
    img {
      filter: none;
      border-color: rgba(100, 255, 218, 0.3);
    }
    
    &::before {
      display: none;
    }
  }
`;

const ViewArchiveLink = styled.a`
  display: inline-block;
  margin-top: 30px;
  color: #64ffda;
  text-decoration: none;
  font-size: 16px;
  font-weight: 500;

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
  color: #8892b0;
  text-align: center;
  margin-top: 100px;
  margin-bottom: 50px;
`;

export default App;
