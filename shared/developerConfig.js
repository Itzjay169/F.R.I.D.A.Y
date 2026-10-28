/**
 * Centralized Configuration for Developer Identity, Vexora Technology Branding & Product Information
 * Edit this file to update profile details, links, branding, and company information.
 */

export const DEVELOPER_CONFIG = {
  developer: {
    name: 'Jaykishan Das',
    role: 'Software Developer | Full-Stack Developer | AI Enthusiast',
    subtitle: 'Creator of F.R.I.D.A.Y. – The Trading Desk',
    avatar: 'avatar_jaykishan', // Configurable avatar identifier or image path
    location: 'India',
    introduction:
      "I'm Jaykishan Das, a software developer passionate about building intelligent applications, modern digital experiences, and practical software solutions. Through Vexora Technology, I aim to turn ideas into useful products by combining software engineering, artificial intelligence, and user-focused design.",
    socialLinks: {
      github: 'https://github.com/Itz30jay',
      linkedin: 'https://linkedin.com/in/jaykishandas',
      email: null // Intentionally unexposed in client bundle; handled via secure contact form
    }
  },

  company: {
    name: 'VEXORA TECHNOLOGY',
    legalStatus: 'Independent Technology Studio & Brand',
    tagline: 'Building Intelligent Digital Experiences.',
    slogan: 'Innovating Today. Building Tomorrow.',
    logoPath: '/assets/vexora-logo.svg',
    vision:
      "To become a trusted global technology company that transforms ideas into innovative digital solutions, empowers businesses through technology, and makes people's lives simpler, smarter, and better.",
    extendedVision: [
      "At Vexora Technology, our vision is to build a future where technology creates opportunities, solves real-world problems, and drives meaningful progress. We aspire to deliver reliable, secure, scalable, and user-friendly software solutions through web development, mobile applications, artificial intelligence, and next-generation digital products.",
      "We aim to empower startups, small businesses, and enterprises with technology that helps them grow, innovate, and succeed in an increasingly digital world. By combining creativity, technical excellence, continuous learning, and customer-focused thinking, we strive to develop solutions that create lasting value.",
      "Our long-term vision is to grow from a team of passionate founders into a globally recognized technology company known for innovation, quality, trust, and impactful digital transformation."
    ],
    closingSlogan: 'Vexora Technology — Innovating Today. Building Tomorrow.',
    websiteUrl: null, // Configurable; hidden until verified URL is set
    companyEmail: null, // Configurable; hidden until verified email is set
    focusAreas: [
      {
        id: 'web-dev',
        title: 'Web Application Development',
        icon: 'Globe',
        description: 'Modern, high-performance web applications built with scalable component architectures, reactive state systems, and intuitive user experiences.'
      },
      {
        id: 'mobile-dev',
        title: 'Mobile Application Development',
        icon: 'Smartphone',
        description: 'Cross-platform mobile applications designed for fluid interactivity, offline-first reliability, and seamless multi-device continuity.'
      },
      {
        id: 'ai-solutions',
        title: 'AI-Powered Solutions',
        icon: 'Cpu',
        description: 'Intelligent automation, autonomous multi-agent orchestration, LLM synthesis workflows, and natural language interfaces tailored for real-world tasks.'
      },
      {
        id: 'custom-software',
        title: 'Custom Software & Digital Products',
        icon: 'Layers',
        description: 'Tailored desktop and cloud software products, financial intelligence tools, secure APIs, and modular enterprise platforms.'
      }
    ]
  },

  product: {
    name: 'F.R.I.D.A.Y. — THE TRADING DESK',
    subtitle: 'A PRODUCT BY VEXORA TECHNOLOGY',
    description:
      'A voice-driven AI trading research desk designed to bring market intelligence, specialist AI agents, risk analysis, and paper trading into one unified workspace.',
    disclaimer: 'Educational only. Not financial advice. Paper trading only.',
    architecture: [
      {
        feature: 'Master AI Orchestrator & 9 Specialist Seats',
        status: 'Operational',
        statusType: 'working',
        detail: 'Central synthesis engine routing across Chartist, Athena, Sentinel, Sentinel-X, Oracle, Atlas, Capitol, Scout, and Pilot.'
      },
      {
        feature: 'Market Research & Financial News Awareness',
        status: 'Operational',
        statusType: 'working',
        detail: 'Live Finnhub market quotes, breaking news wires, and SEC EDGAR disclosures with automated executive summaries.'
      },
      {
        feature: 'Chart Integrations & Technical Analysis',
        status: 'Operational',
        statusType: 'working',
        detail: 'Interactive TradingView candlestick charting with multi-agent indicator overlays and voice-driven symbol switching.'
      },
      {
        feature: 'Risk Assessment & SENTINEL-X Heat Engine',
        status: 'Operational',
        statusType: 'working',
        detail: 'Portfolio heat calculation, cross-asset correlation matrix, automated stress-testing scenarios, and hardware-level kill switch.'
      },
      {
        feature: 'Local Paper-Trading Ledger',
        status: 'Operational',
        statusType: 'working',
        detail: 'Mark-to-market position management, stop-loss / take-profit tracking, and cryptographically verified approval tokens.'
      },
      {
        feature: 'Trade Journaling & ARCHIVE Memory',
        status: 'Operational',
        statusType: 'working',
        detail: 'Execution history, R-multiple expectancy tracking, trade review post-mortems, and searchable strategy playbooks.'
      },
      {
        feature: 'Real-Broker Execution (Interactive Brokers / Alpaca)',
        status: 'Planned',
        statusType: 'planned',
        detail: 'Live broker execution is strictly disabled (LIVE_TRADING=false). Paper simulation only.'
      },
      {
        feature: 'Multi-User Cloud Sync & Webhook Alerts',
        status: 'Planned',
        statusType: 'planned',
        detail: 'Currently runs 100% locally on localhost for data privacy and speed. Cloud syncing is under research.'
      }
    ]
  },

  techStack: [
    {
      category: 'Desktop & Core Runtime',
      name: 'Electron 34 & Node.js',
      description: 'Hardened desktop shell with isolated contexts, secure preload bridges, and portable runtime auto-bootstrapper.',
      badge: 'Verified'
    },
    {
      category: 'Frontend & Build Tooling',
      name: 'React 18 & Vite 6',
      description: 'Declarative component architecture with sub-millisecond HMR, modular state management, and optimized asset bundling.',
      badge: 'Verified'
    },
    {
      category: 'AI Synthesis Engine',
      name: 'Google Gemini 2.0 Flash',
      description: 'High-throughput multimodal LLM synthesis for natural-language command dispatch and multi-agent consensus.',
      badge: 'Verified'
    },
    {
      category: 'Financial Market Feeds',
      name: 'Finnhub & SEC EDGAR',
      description: 'Real-time market quotes, corporate earnings calendar, and regulatory filing feeds.',
      badge: 'Verified'
    },
    {
      category: 'Technical Analysis',
      name: 'TradingView Advanced Charts',
      description: 'Professional-grade candlestick charting, volume profiles, and interactive multi-agent drawing projections.',
      badge: 'Verified'
    },
    {
      category: 'Voice & Speech Engine',
      name: 'Web Speech API & ElevenLabs',
      description: 'Zero-latency browser text-to-speech synthesis and continuous voice recognition.',
      badge: 'Verified'
    },
    {
      category: 'Quality Assurance',
      name: 'Vitest Test Suite',
      description: '225 automated unit, contract, integration, and performance tests verifying portfolio math and state machines.',
      badge: 'Verified'
    },
    {
      category: 'Validation & Security',
      name: 'Zod & Context Isolation',
      description: 'Strict runtime schema validation, input sanitization, and defense-in-depth IPC boundaries.',
      badge: 'Verified'
    }
  ],

  philosophy: [
    {
      id: 'security-first',
      title: 'Security First',
      tagline: 'Zero Exposure Architecture',
      description:
        'Protect credentials, strictly validate all user inputs, enforce isolated process contexts, and maintain immutable application boundaries without external leakages.',
      icon: 'ShieldCheck'
    },
    {
      id: 'honest-data',
      title: 'Honest Data',
      tagline: 'Truth Over Decoration',
      description:
        'Never fabricate market information, fake project capabilities, or pretend simulated features are live broker integrations. Clear transparency in every metric.',
      icon: 'CheckCircle'
    },
    {
      id: 'modular-engineering',
      title: 'Modular Engineering',
      tagline: 'Extensible & Maintainable',
      description:
        'Build decoupled components, self-healing background tasks, and independently testable services that scale cleanly as new specialist agents join the desk.',
      icon: 'Boxes'
    },
    {
      id: 'user-centered',
      title: 'User-Centered Design',
      tagline: 'Cyber-HUD Aesthetics',
      description:
        'Create intuitive, responsive, keyboard-navigable, and accessible digital experiences that empower traders with clarity under high-pressure decision making.',
      icon: 'Sparkles'
    }
  ]
};
