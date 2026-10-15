export interface Role {
  id: string;
  dates: string;
  title: string;
  company: string;
  companyUrl: string;
  description: string;
  /** One or two real, measurable results, e.g. 'Cut p95 latency on the course API from 800ms to 200ms'. Shown when set. */
  highlights?: string[];
  tech: string[];
}

// Work history for the Experience section, newest first.
export const experience: Role[] = [
  {
    id: 'asendio',
    dates: 'MAY 2025 — PRESENT',
    title: 'Software Developer',
    company: 'Asendio',
    companyUrl: 'https://www.asendio.io/en',
    description:
      "Build and scale Asendio's AI-powered Learning Experience Platform with NestJS and Next.js — from adaptive learning modules to real-time feedback systems. Develop and maintain REST and GraphQL API frameworks, and ship serverless tooling on AWS Lambda, S3, and API Gateway.",
    tech: ['NestJS', 'Next.js', 'TypeScript', 'GraphQL', 'AWS', 'MongoDB'],
  },
  {
    id: 'swifty-global',
    dates: 'JAN 2021 — APR 2025 · 4 YRS 4 MOS',
    title: 'Software Developer',
    company: 'Swifty Global',
    companyUrl: 'https://www.swiftyglobal.com/',
    description:
      'Designed and implemented scalable architecture solutions using Node.js and React.js for a variety of clients. Developed and maintained API frameworks including REST, GraphQL, and Serverless. Utilized AWS services like Lambda, S3, and API Gateway to create tools and services for customers.',
    tech: ['Node.js', 'React.js', 'NestJS', 'GraphQL', 'AWS', 'MongoDB', 'MySQL'],
  },
];
