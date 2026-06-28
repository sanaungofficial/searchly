/** Upwize template copy — verbatim for v1; swap to Kimchi copy later. */

export const LANDING_NAV = [
  { label: "Pricing", href: "#pricing" },
  { label: "Features", href: "#features" },
] as const;

export const LANDING_HERO = {
  line1: "Get Hired",
  line2: "TodaY",
  leftSub:
    "AI-powered algorithm to recommend the best job opportunities, saving you time and effort.",
  trustedLabel: "Trusted by",
  trustedStat: "250,000+ users worldwide",
  rightSub:
    "Discover opportunities that match your skills and ambitions. Get your dream job fast.",
  badges: ["Smart Job Matching", "Skill-Based Job Search"],
  newBadge: "New!",
} as const;

export const LANDING_STATS = {
  heading: "Join thousands of job seekers",
  subheading: "employers who rely on Upwize for career success.",
  items: [
    { value: "0", suffix: "k+", label: "Total jobs listed" },
    { value: "0", suffix: "k+", label: "Successful hires" },
    { value: "0", suffix: "k+", label: "Companies hiring" },
  ],
} as const;

export const LANDING_ANALYTICS = {
  heading: "Stay ahead with real time data",
  body: "With Upwize Job Analytics, you're always one step ahead in your job search to make informed job decisions.!",
  cards: [
    {
      title: "Trends & demand",
      body: "Track which industries and skills are in demand.",
    },
    {
      title: "Insights & ratings",
      body: "Get a deeper look into potential employers",
    },
  ],
  cta: "Explore more features",
} as const;

export const LANDING_TOP_FEATURES = {
  heading: "Top features of upwize",
  body: "AI-powered algorithm to recommend the best job opportunities, saving you time and effort.",
  cards: Array.from({ length: 4 }, () => ({
    title: "Apply in seconds, no Hassle",
    body: "One-Tap Apply saves time and effort",
  })),
  cta: "Get started",
} as const;

export const LANDING_STEPS = {
  heading: "Simple steps to get hired",
  body: "AI-powered algorithm to recommend the best job opportunities, saving you time and effort.",
  steps: [
    {
      title: "Sign up for free",
      body: "Sign up, add your skills, experience, and preferences for recommendations.",
    },
    {
      title: "Sign up for free",
      body: "Browse jobs, filter opportunities, and apply instantly with one tap.",
    },
    {
      title: "Get hired",
      body: "Connect with recruiters, schedule interviews, and land your job!",
    },
  ],
} as const;

export const LANDING_WHY = {
  heading: "Why Upwize? Your Smartest Career Move!",
  cards: [
    {
      title: "AI Job Matching",
      body: "Sign up, add your skills, experience, and preferences for recommendations.",
    },
    {
      title: "Real-Time Updates",
      body: '"Sign up, list your skills, Mand preferences for the best job suggestions."',
    },
    {
      title: "One-Tap Easy Apply",
      body: '"Sign up, share skills, and preferences to get personalized job alerts."',
    },
    {
      title: "Career Insights",
      body: '"Create an account, fill in your skills, and preferences for matches."',
    },
  ],
} as const;

export const LANDING_SKILL_SECTIONS = [
  {
    tabs: ["Trending skills", "Popular skills"],
    heading: "Discover demand skills in your industry",
    body: "Uncover the most sought-after expertise in your field through comprehensive market analysis and industry trends.",
    cta: "Explore more features",
  },
  {
    heading: "Get instant notification when jobs match",
    body: "Never miss your dream opportunity again with our real-time alert system that delivers matching job openings directly to your inbox or mobile device.",
    cta: "Explore more features",
  },
] as const;

export const LANDING_TESTIMONIALS = {
  heading: "Real people, real stories",
  items: [
    {
      quote:
        "The job matching feature is a game-changer! I was applying to jobs randomly before, but Upwize suggested roles that truly aligned with my skills. I got multiple interview calls in just days!",
      name: "James Thompson",
      role: "product Designer",
    },
    {
      quote:
        "Upwize's job analytics feature helped me understand salary trends, and I used that insight to negotiate a 20% higher salary. The data-driven approach really works!",
      name: "Michael Bennett",
      role: "App Designer",
    },
    {
      quote:
        "Using Upwize's job analytics, I gained insight into market trends, which helped me secure a 15% salary increase. The data really makes a difference!",
      name: "Top Clofen",
      role: "product Designer",
    },
  ],
} as const;

export const LANDING_COMPANIES_LABEL = "Companies hiring at upwize";

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
  body: "AI-powered algorithm to recommend the best job opportunities, saving you time and effort.",
  plans: [
    {
      name: "Basic plan",
      tagline: "For casual job seekers",
      price: "Free",
      period: "",
      features: [
        "Apply to limited job postings",
        "Access to basic job search filters",
        "Receive real-time job updates",
      ],
      cta: "Get this plan",
      popular: false,
    },
    {
      name: "Elite plan",
      tagline: "For professionals premium access",
      price: "$29.99",
      period: "/month",
      features: [
        "Exclusive roles for members.",
        "Early access to listings.",
        "Priority access to hidden jobs.",
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
        "Limited-time access to roles.",
        "Early job access for users.",
        "Special roles for subscribers.",
      ],
      cta: "Get this plan",
      popular: false,
    },
  ],
} as const;

export const LANDING_FAQ = {
  heading: "Questions and answers",
  body: "We have answers to your questions about services and approach.",
  contactHeading: "Got more questions?",
  contactBody: "Contact us for more information.",
  contactCta: "Contact us",
  items: [
    {
      q: "How does upwize match me with jobs?",
      a: "Based on the inspection, we provide a tailored plan with clear pricing and timelines. Our team then carries.",
    },
    { q: "Is upwize free to use?", a: "" },
    { q: "How do real-time job updates work?", a: "" },
    { q: "How do I find jobs based on location?", a: "" },
  ],
} as const;

export const LANDING_FINAL_CTA = {
  heading: "Take the next step in your career!",
  body: "Find the right job faster with AI-powered matching, real-time updates, and powerful insights.",
  bullets: ["Discover top opportunities", "Apply with one tap"],
} as const;

export const LANDING_FOOTER = {
  quickLinks: ["Home", "About", "Features", "Pricing", "Testimonials", "Blog"],
  categories: [
    "Technology & IT",
    "Marketing & Sales",
    "Design & Creative",
    "Real Estate",
    "Healthcare & Science",
    "Business & Finance",
  ],
  support: ["Help Center", "How It Works", "Changelog", "Terms & Conditions", "404"],
  address: "123 Job Street, New York, NY 10001",
  email: "support@upwize.com",
  phone: "+1 (123) 456-7890",
  social: ["Twitter", "Linkedin", "Instagram"],
  legal: ["Support", "Terms of use"],
  copyright: "upwize © 2025",
} as const;
