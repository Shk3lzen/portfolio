export interface Project {
  id: string;
  title: string;
  url: string;
  description: string;
  tech: string[];
  image?: string;
  imageAlt?: string;
  /** Displayed in the archive table. Adjust to the real year. */
  year: string;
  /** When true, the project is shown on the home page. */
  featured?: boolean;
}

// Single source of truth for projects — the home page renders the `featured`
// ones as cards, and the /projects archive lists every entry with tech filters.
// Add new projects here and they appear in the archive automatically.
export const projects: Project[] = [
  {
    id: 'asendio-lxp',
    title: 'Asendio LXP',
    url: 'https://www.asendio.io/en',
    description:
      'AI-Powered Learning Experience Platform revolutionizing corporate training. Features adaptive learning, targeted growth modules, and real-time feedback systems trusted by leading enterprises.',
    tech: ['Next.js', 'NestJS', 'AI/ML', 'Node.js', 'TypeScript'],
    image: '/d.png',
    imageAlt: 'Asendio LXP learning platform interface with AI-powered content creation',
    year: '2025',
    featured: true,
  },
  {
    id: 'swifty-sports',
    title: 'Swifty Sports',
    url: 'https://www.swiftysports.co.uk/en',
    description:
      'Comprehensive sports betting platform with real-time horse racing data, live odds, and interactive betting interface. Features daily price boosts, BOG availability, and responsive design for optimal user experience across all devices.',
    tech: ['React', 'Next.js', 'TypeScript', 'Real-time APIs', 'Node.js'],
    image: '/b.png',
    imageAlt: 'Swifty Sports betting interface with horse racing odds and live data',
    year: '2024',
    featured: true,
  },
  {
    id: 'top-predictor',
    title: 'Top Predictor',
    url: 'https://toppredictor.com/',
    description:
      'Advanced sports prediction platform with gamified experience. Users can predict smarter, score higher, and dominate leaderboards while competing with friends and showcasing expertise across multiple sports.',
    tech: ['React', 'TypeScript', 'D3.js', 'Node.js', 'PostgreSQL'],
    image: '/ba.png',
    imageAlt: 'Top Predictor sports prediction interface with leaderboards and competitions',
    year: '2023',
    featured: true,
  },
  {
    id: 'swifty-global',
    title: 'Swifty Global',
    url: 'https://www.swiftyglobal.com/',
    description:
      'Global digital solutions platform delivering thrilling sports experiences and betting excitement. Architected scalable frontend solutions with extensive range of sports options and modern user interfaces.',
    tech: ['JavaScript', 'React', 'Next.js', 'MongoDB', 'AWS'],
    image: '/c.png',
    imageAlt: 'Swifty Global platform showing sports betting interface and mobile app',
    year: '2021',
    featured: true,
  },
  {
    id: 'swifty-wallet',
    title: 'Swifty Wallet',
    url: 'https://www.swiftyglobal.com/article/introduction-of-the-swifty-wallet-and-its-integrated-nft-strategy',
    description:
      "Integrated crypto wallet for the Swifty Global ecosystem, letting users store and manage digital assets alongside an NFT strategy that ties rewards and membership into the platform.",
    tech: ['React', 'Web3', 'Blockchain', 'NFT', 'Node.js'],
    year: '2023',
  },
  {
    id: 'studio-442',
    title: 'Studio 442',
    url: 'https://www.studio442.co/',
    description:
      'Brand site and online shop for an architecture and art studio, spanning architecture, furniture, art and events with an integrated store.',
    tech: ['Next.js', 'React', 'TypeScript', 'E-commerce'],
    year: '2025',
  },
  {
    id: 'cases-by-bardha',
    title: 'Cases by Bardha',
    url: 'https://casesbybardha.shop/',
    description:
      'E-commerce storefront for custom phone cases, with product browsing, cart and checkout built for a smooth mobile shopping experience.',
    tech: ['Shopify', 'E-commerce', 'JavaScript'],
    year: '2026',
  },
  {
    id: 'planet-accounting',
    title: 'Planet Accounting',
    url: 'https://www.planetaccounting.org/www/index',
    description:
      'Accounting-firm marketing website built during a software development internship — presenting services, team and contact information in a clean, professional layout.',
    tech: ['React', 'Next.js', 'TypeScript'],
    year: '2020',
  },
];
