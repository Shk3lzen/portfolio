import { projects } from './projects';

// Lightweight, offline "assistant" that answers questions about Shkëlzen from
// curated facts + the projects data. No API key, works on static hosting.
//
// UPGRADE PATH: to make this a real LLM, deploy a serverless function that
// holds your API key and calls Claude/OpenAI, then replace the body of
// `answerQuestion` with a `fetch('/your-endpoint', ...)` call. Keep the local
// answers below as an offline fallback.

const skills = [
  'React', 'Next.js', 'Node.js', 'NestJS', 'TypeScript', 'JavaScript',
  'GraphQL', 'REST APIs', 'serverless', 'AWS (Lambda, S3, API Gateway)',
  'MongoDB', 'MySQL', 'PostgreSQL', 'D3.js', 'Web3 / blockchain',
];

const suggestions = [
  'What technologies does he use?',
  'Tell me about his experience',
  'What has he built?',
  'How can I contact him?',
];

export const chatSuggestions = suggestions;

// Per-technology confirmations for "do you know X?" style questions.
const techFacts: Record<string, string> = {
  react: 'Yes — React (and Next.js) is core to his front-end work across almost every project.',
  'next': 'Yes — Next.js is one of his primary frameworks, used at Asendio, Swifty and beyond.',
  nest: 'Yes — he builds scalable back-ends with NestJS, including REST and GraphQL APIs.',
  node: 'Yes — Node.js is central to his back-end services and API work.',
  typescript: 'Yes — TypeScript is his default language for both front-end and back-end.',
  aws: 'Yes — he builds tools and services on AWS using Lambda, S3 and API Gateway.',
  graphql: 'Yes — he designs and maintains GraphQL APIs alongside REST.',
  mongo: 'Yes — MongoDB is his go-to NoSQL database; he has also optimized it for performance.',
  sql: 'Yes — he works with relational databases including MySQL and PostgreSQL.',
  ai: 'Yes — at Asendio he builds an AI-powered Learning Experience Platform with adaptive learning and real-time feedback.',
  web3: 'Yes — he worked on the Swifty Wallet, a crypto wallet with an integrated NFT strategy.',
  blockchain: 'Yes — he worked on the Swifty Wallet, a crypto wallet with an integrated NFT strategy.',
};

export function answerQuestion(raw: string): string {
  const q = raw.toLowerCase().trim();

  if (!q) return "Ask me anything about Shkëlzen's experience, skills or projects.";

  if (/^(hi|hey|hello|yo|hiya)\b/.test(q)) {
    return "Hi! I'm a small assistant for Shkëlzen's portfolio. Ask me about his experience, skills, or the things he's built.";
  }

  // Contact
  if (/(contact|reach|email|hire|available|get in touch|connect)/.test(q)) {
    return 'The best way to reach Shkëlzen is LinkedIn: https://www.linkedin.com/in/shkelzen-berisha/ — or via GitHub: https://github.com/Shk3lzen';
  }

  // Experience / years
  if (/(experience|years|how long|background|seniority|career)/.test(q)) {
    return 'Shkëlzen has 5+ years as a full-stack developer. He is currently at Asendio (since May 2025) building an AI-powered Learning Experience Platform, and spent Jan 2020–Apr 2025 at Swifty Global. He also mentors junior developers.';
  }

  // Current role
  if (/(current|now|where.*work|company|job)/.test(q)) {
    return 'He currently works at Asendio as a Software Developer, designing scalable architecture with NestJS and Next.js and shipping serverless tooling on AWS.';
  }

  // Named project match
  const matchedProject = projects.find((p) =>
    q.includes(p.title.toLowerCase()) ||
    p.title.toLowerCase().split(' ').every((word) => word.length > 3 && q.includes(word))
  );
  if (matchedProject) {
    return `${matchedProject.title} (${matchedProject.year}) — ${matchedProject.description} Built with ${matchedProject.tech.join(', ')}.`;
  }

  // Specific technology question
  for (const key of Object.keys(techFacts)) {
    if (q.includes(key)) return techFacts[key];
  }

  // Skills / stack
  if (/(skill|tech|stack|language|framework|tool|know|use)/.test(q)) {
    return `His core stack: ${skills.join(', ')}. Ask about any specific one and I'll tell you how he's used it.`;
  }

  // Projects overview
  if (/(project|build|built|work|portfolio|made|app)/.test(q)) {
    const names = projects.map((p) => p.title).join(', ');
    return `He's built ${projects.length} projects listed here: ${names}. Ask about any of them by name for details, or open the Projects Archive.`;
  }

  // Education (not in the data)
  if (/(education|study|degree|university|school)/.test(q)) {
    return "His education isn't listed on this site — connect on LinkedIn for the full background: https://www.linkedin.com/in/shkelzen-berisha/";
  }

  return "I can help with Shkëlzen's experience, skills, or projects. Try: “What technologies does he use?”, “Tell me about his experience”, or “What has he built?”";
}
