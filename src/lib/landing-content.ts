/** Kimchi marketing landing copy */

export const LANDING_NAV = [
  { label: "Pricing", href: "#pricing" },
  { label: "Features", href: "#features" },
] as const;

export const LANDING_HERO = {
  line1: "Land your",
  line2: "next role",
  subtitle:
    "Kimchi is your career workspace — AI job matching, expert coaching, and tailored applications in one place.",
  trustedLabel: "Trusted by",
  trustedStat: "job seekers building their next chapter",
  badges: ["92% match scores", "Live coaching"],
  newBadge: "Web app",
} as const;

export const LANDING_STATS = {
  heading: "Join thousands of job seekers",
  subheading: "who use Kimchi to run a smarter, faster job search.",
  items: [
    { value: 12, suffix: "k+", label: "Roles tracked" },
    { value: 8, suffix: "k+", label: "Applications sent" },
    { value: 400, suffix: "+", label: "Companies targeted" },
  ],
} as const;

export const LANDING_ANALYTICS = {
  heading: "Stay ahead with real-time insights",
  body: "Kimchi surfaces match scores, salary signals, and hiring trends so every application is intentional.",
  cards: [
    {
      title: "Trends & demand",
      body: "Track which industries and skills are heating up in your market.",
    },
    {
      title: "Company insights",
      body: "See fit scores and context before you spend time on an application.",
    },
  ],
  cta: "Explore more features",
} as const;

export const LANDING_TOP_FEATURES = {
  heading: "Top features of Kimchi",
  body: "Everything you need to search, apply, and get coached — without switching tools.",
  cards: [
    {
      emoji: "🎯",
      title: "AI job matching",
      body: "Ranked roles based on your resume, goals, and preferences.",
    },
    {
      emoji: "📋",
      title: "Tailored applications",
      body: "Resume and cover letter drafts tuned to each posting.",
    },
    {
      emoji: "⚡",
      title: "One workspace",
      body: "Track pipelines, notes, and follow-ups in a single dashboard.",
    },
    {
      emoji: "🧭",
      title: "Expert coaching",
      body: "Book sessions with coaches who know your target companies.",
    },
  ],
  cta: "Get started free",
} as const;

export const LANDING_STEPS = {
  heading: "Simple steps to get hired",
  body: "From profile to offer letter — Kimchi keeps the path clear.",
  steps: [
    {
      emoji: "✨",
      title: "Build your profile",
      body: "Upload your resume, set targets, and tell us what great looks like.",
    },
    {
      emoji: "🔍",
      title: "Discover & apply",
      body: "Browse matched roles, tailor materials, and track every application.",
    },
    {
      emoji: "🤝",
      title: "Coach & close",
      body: "Prep for interviews with coaching and land the role that fits.",
    },
  ],
} as const;

export const LANDING_WHY = {
  heading: "Why Kimchi? Your smartest career move.",
  cards: [
    {
      emoji: "🎯",
      title: "AI job matching",
      body: "Scores every role against your profile so you focus on high-fit opportunities.",
    },
    {
      emoji: "📡",
      title: "Real-time updates",
      body: "New listings and status changes surface as they happen — no stale spreadsheets.",
    },
    {
      emoji: "📝",
      title: "Tailored apply flow",
      body: "Generate role-specific resumes and cover letters without starting from scratch.",
    },
    {
      emoji: "📊",
      title: "Career insights",
      body: "Salary bands, company signals, and pipeline analytics in one view.",
    },
  ],
} as const;

export const LANDING_SKILL_SECTIONS = [
  {
    tabs: ["Trending skills", "Popular skills"],
    heading: "Discover in-demand skills in your industry",
    body: "Uncover the expertise hiring managers ask for — and close gaps before you apply.",
    cta: "Explore more features",
  },
  {
    heading: "Get notified when jobs match",
    body: "Real-time alerts when a role hits your threshold — straight to your Kimchi workspace.",
    cta: "Explore more features",
  },
] as const;

export const LANDING_TESTIMONIALS = {
  heading: "Real people, real stories",
  items: [
    {
      quote:
        "The match scores changed everything. I stopped spraying applications and focused on roles Kimchi flagged at 85%+. Three interview loops in two weeks.",
      name: "James Thompson",
      role: "Product Designer",
    },
    {
      quote:
        "Kimchi's salary insights helped me negotiate 20% higher. Having data on the role and company before the call gave me real leverage.",
      name: "Michael Bennett",
      role: "App Designer",
    },
    {
      quote:
        "Coaching inside the same workspace as my pipeline meant no more scattered notes. I went from stuck to offer in six weeks.",
      name: "Sarah Chen",
      role: "Program Manager",
    },
  ],
} as const;

export const LANDING_COMPANIES_LABEL = "Companies our members target";

export const LANDING_COMPANY_LOGOS = [
  "McKinsey",
  "BCG",
  "Google",
  "Amazon",
  "Microsoft",
  "Meta",
  "Stripe",
  "Figma",
] as const;

export const LANDING_PRICING = {
  label: "Pricing plans",
  heading: "Flexible pricing plans",
  body: "Start free, upgrade when you want coaching and premium matching.",
  plans: [
    {
      name: "Basic plan",
      tagline: "For casual job seekers",
      price: "Free",
      period: "",
      features: [
        "Track jobs and applications",
        "Basic search filters",
        "Real-time listing updates",
      ],
      cta: "Get this plan",
      popular: false,
    },
    {
      name: "Elite plan",
      tagline: "For professionals who want an edge",
      price: "$29.99",
      period: "/month",
      features: [
        "Live coaching sessions",
        "Priority match scoring",
        "Early access to new roles",
      ],
      cta: "Get this plan",
      popular: true,
      badge: "Popular",
    },
    {
      name: "Pro plan",
      tagline: "For serious job seekers",
      price: "$9.99",
      period: "/month",
      features: [
        "AI resume tailoring",
        "Cover letter drafts",
        "Advanced pipeline analytics",
      ],
      cta: "Get this plan",
      popular: false,
    },
  ],
} as const;

export const LANDING_FAQ = {
  heading: "Questions and answers",
  body: "Common questions about Kimchi, coaching, and how we help you land roles.",
  contactHeading: "Got more questions?",
  contactBody: "Reach out — we're happy to help.",
  contactCta: "Contact us",
  items: [
    {
      q: "How does Kimchi match me with jobs?",
      a: "We parse your resume and preferences, then score open roles on skills, seniority, and goals. High-match listings rise to the top of your dashboard.",
    },
    {
      q: "Is Kimchi free to use?",
      a: "Yes — the Basic plan is free. Pro and Elite add tailoring, analytics, and live coaching when you're ready.",
    },
    {
      q: "How do real-time job updates work?",
      a: "When a tracked company posts a role or a saved search hits your criteria, Kimchi surfaces it in your workspace and optional email alerts.",
    },
    {
      q: "Can I book a career coach on Kimchi?",
      a: "Elite members can book coaches directly in the app. Sessions sync with your pipeline so prep stays in context.",
    },
  ],
} as const;

export const LANDING_FINAL_CTA = {
  heading: "Take the next step in your career",
  body: "Open Kimchi in your browser — no download required. Match roles, tailor applications, and get coached.",
  bullets: ["Discover top opportunities", "Apply with tailored materials"],
} as const;

export const LANDING_FOOTER = {
  quickLinks: ["Home", "About", "Features", "Pricing", "Testimonials", "Blog"],
  categories: [
    "Technology & IT",
    "Marketing & Sales",
    "Design & Creative",
    "Product & Program",
    "Healthcare & Science",
    "Business & Finance",
  ],
  support: ["Help Center", "How It Works", "Changelog", "Terms & Conditions", "404"],
  address: "Second Ladder · Remote-first",
  email: "support@kimchi.so",
  phone: "",
  social: ["Twitter", "Linkedin", "Instagram"],
  legal: ["Support", "Terms of use"],
  copyright: "Kimchi © 2025",
} as const;
