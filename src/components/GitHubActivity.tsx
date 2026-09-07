import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { FiStar, FiGitBranch } from 'react-icons/fi';

const GITHUB_USER = 'Shk3lzen';
// The section only renders when there are at least this many showcase-worthy
// public repos — otherwise a lone card looks sparser than showing nothing.
const MIN_REPOS = 3;

interface Repo {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
}

// Shows the most recently pushed public repos. Uses the unauthenticated GitHub
// API (60 req/hr per IP) and renders nothing on error / empty so it never
// leaves a broken-looking section behind.
const GitHubActivity: React.FC = () => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&direction=desc&per_page=12`)
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        return res.json();
      })
      .then((data: Repo[]) => {
        if (cancelled) return;
        const top = data.filter((r) => !r.fork && !r.archived).slice(0, 4);
        setRepos(top);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Render nothing until we know there are enough repos to look substantial.
  if (state !== 'ready' || repos.length < MIN_REPOS) return null;

  return (
    <Wrapper>
      <Heading>
        <FiGitBranch />
        Latest on GitHub
      </Heading>

      <Grid>
        {repos.map((repo) => (
          <RepoCard key={repo.id} href={repo.html_url} target="_blank" rel="noopener noreferrer">
            <RepoName>{repo.name}</RepoName>
            {repo.description && <RepoDesc>{repo.description}</RepoDesc>}
            <RepoMeta>
              {repo.language && <span>{repo.language}</span>}
              {repo.stargazers_count > 0 && (
                <span>
                  <FiStar /> {repo.stargazers_count}
                </span>
              )}
            </RepoMeta>
          </RepoCard>
        ))}
      </Grid>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  margin-top: 60px;
`;

const Heading = styled.h3`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-family: 'SF Mono', monospace;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 20px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const RepoCard = styled.a`
  display: block;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid rgba(var(--border-rgb), 0.18);
  background: rgba(var(--border-rgb), 0.05);
  transition: transform 0.2s, border-color 0.2s;

  &:hover {
    transform: translateY(-3px);
    border-color: rgba(var(--accent-rgb), 0.4);
  }
`;

const RepoName = styled.div`
  color: var(--heading);
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 6px;
  word-break: break-word;
`;

const RepoDesc = styled.div`
  color: var(--text);
  font-size: 12.5px;
  line-height: 1.5;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const RepoMeta = styled.div`
  display: flex;
  gap: 16px;
  font-family: 'SF Mono', monospace;
  font-size: 11px;
  color: var(--text);

  span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
`;

export default GitHubActivity;
