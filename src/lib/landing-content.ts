/** Kimchi marketing landing copy */

export const LANDING_WAITLIST_URL = "https://mrqz.to/kimchi" as const;

export const LANDING_JOIN_WAITLIST_LABEL = "Join Waitlist" as const;

export const LANDING_NAV = [
  { label: "Pricing", href: "#pricing" },
  { label: "Features", href: "#features" },
  { label: "Coaching", href: "/coaching" },
] as const;

export const LANDING_HERO = {
  line1: "Get in.",
  line2: "Get out. Get up.",
  subtitle:
    "The AI-powered career platform for people changing trajectories. Powered by real jobs, real coaches, and people who've already made the move.",
  trustedLabel: "Built for",
  trustedStat: "ambitious people making a specific career move",
  badges: ["Live hiring intel", "Expert coaches"],
  newBadge: "Web app",
} as const;

export const LANDING_STATS = {
  heading: "Built for trajectory changes, not endless browsing",
  subheading:
    "Kimchi is not a job board and not a coaching directory. It's where live hiring intelligence meets people who've already broken in.",
  items: [
    { value: 12, suffix: "k+", label: "Roles tracked" },
    { value: 500, suffix: "+", label: "Coaches who've made the move" },
    { value: 3, suffix: "", label: "Core destinations" },
  ],
} as const;

export const LANDING_ANALYTICS = {
  heading: "Hiring intelligence you can't get on LinkedIn",
  body: "See which roles are actually opening, what skills they require, and how your trajectory compares — before you commit months to the wrong path.",
  cards: [
    {
      title: "Live role signals",
      body: "Track openings, hiring velocity, and fit scores across the companies and paths you're targeting.",
    },
    {
      title: "Move-specific context",
      body: "Understand what MBB exits, PM transitions, and MBA pipelines look like from people who've done it.",
    },
  ],
  cta: "See how it works",
} as const;

export const LANDING_TOP_FEATURES = {
  heading: "Three pillars for your move",
  body: "Match to the right opportunities, learn from people who've made your exact transition, and close the gaps holding you back.",
  cards: [
    {
      emoji: "🎯",
      title: "Get Matched",
      body: "AI-curated jobs and coaches that fit your trajectory — not a firehose of irrelevant listings.",
    },
    {
      emoji: "🤝",
      title: "Get Coached",
      body: "1-on-1 with people who've made your exact move: MBB to tech, analyst to PM, operator to founder.",
    },
    {
      emoji: "📈",
      title: "Get Skilled",
      body: "Close the skill gaps blocking your trajectory with targeted prep, not generic career advice.",
    },
    {
      emoji: "🧭",
      title: "One trajectory",
      body: "Break into PM, exit consulting, land a top MBA — map your from → to in a single workspace.",
    },
  ],
  cta: LANDING_JOIN_WAITLIST_LABEL,
} as const;

export const LANDING_STEPS = {
  heading: "How Kimchi works",
  body: "Define where you are and where you're going. Kimchi connects the intelligence, coaching, and skills to get you there.",
  steps: [
    {
      emoji: "🎯",
      title: "Get Matched",
      body: "Tell us your trajectory. Kimchi surfaces jobs and coaches aligned to your specific move — not generic search results.",
    },
    {
      emoji: "🤝",
      title: "Get Coached",
      body: "Book 1-on-1 sessions with people who've made your exact transition and know what hiring managers actually look for.",
    },
    {
      emoji: "📈",
      title: "Get Skilled",
      body: "Identify and close the gaps between where you are and where you're going — before you apply or interview.",
    },
  ],
} as const;

export const LANDING_WHY = {
  heading: "The platform for people changing trajectories",
  cards: [
    {
      emoji: "🚪",
      title: "Get in",
      body: "Break into PM, MBB, IB, PE, top MBA programs, and big tech — with a map, not a prayer.",
    },
    {
      emoji: "↗",
      title: "Get out",
      body: "Exit consulting, banking, big tech, academia, or dead-end roles into something that fits your next chapter.",
    },
    {
      emoji: "⬆",
      title: "Get up",
      body: "Level up to first-time exec, Chief of Staff, founder, VP, or C-suite with coaches who've sat in those seats.",
    },
    {
      emoji: "🔍",
      title: "Not another job board",
      body: "Live hiring intelligence plus people who've broken in — the combination no listing site or coach directory offers.",
    },
  ],
} as const;

export const LANDING_SKILL_SECTIONS = [
  {
    tabs: ["Skill gaps", "In-demand skills"],
    heading: "Close the gaps blocking your trajectory",
    body: "Kimchi shows what hiring managers actually ask for on your target path — product sense for PM, case prep for consulting, GMAT for MBA — so you prep with intent.",
    cta: "Explore skill tracking",
  },
  {
    heading: "Know the moment a role fits your move",
    body: "Get alerted when a posting matches your trajectory threshold — PM at a Series B, post-MBB strategy role, MBA feeder internship — straight to your workspace.",
    cta: "Join the waitlist",
  },
] as const;

export const LANDING_TESTIMONIALS = {
  heading: "People who changed trajectories",
  items: [
    {
      quote:
        "I was two years into Big 4 and couldn't see the exit. Kimchi matched me to a strategy role at a growth-stage company and connected me with a coach who'd made the same jump. Offer in eight weeks.",
      name: "Priya K.",
      role: "Ex–Big 4 → Strategy, Series C",
    },
    {
      quote:
        "Breaking into PM from banking felt impossible until I stopped applying everywhere. Kimchi narrowed it to high-fit roles and a coach who'd done IB → PM at a top tech company. Three loops, one offer.",
      name: "Marcus L.",
      role: "Ex–Investment Banking → Product Manager",
    },
    {
      quote:
        "The MBA prep wasn't generic — Kimchi showed me which programs fit my background and paired me with someone who'd gone consulting → HBS. I knew exactly what to fix before I applied.",
      name: "Elena R.",
      role: "Ex–MBB → HBS '27",
    },
  ],
} as const;

export const LANDING_COMPANIES_LABEL = "Where our members are headed";

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
  heading: "Start free. Invest when you're ready to move.",
  body: "Explore your trajectory at no cost. Upgrade when you want coaching, priority matching, and hands-on support for your specific move.",
  plans: [
    {
      name: "Basic plan",
      tagline: "Map your trajectory",
      price: "Free",
      period: "",
      features: [
        "Track jobs and trajectory fit",
        "Browse matched roles and coaches",
        "Real-time hiring signals",
      ],
      cta: LANDING_JOIN_WAITLIST_LABEL,
      popular: false,
    },
    {
      name: "Elite plan",
      tagline: "Move with an edge",
      price: "$29.99",
      period: "/month",
      features: [
        "Live coaching sessions",
        "Priority trajectory matching",
        "Early access to new roles",
      ],
      cta: LANDING_JOIN_WAITLIST_LABEL,
      popular: true,
      badge: "Popular",
    },
    {
      name: "Pro plan",
      tagline: "Sharpen your application",
      price: "$9.99",
      period: "/month",
      features: [
        "AI resume tailoring",
        "Cover letter drafts",
        "Skill gap tracking",
      ],
      cta: LANDING_JOIN_WAITLIST_LABEL,
      popular: false,
    },
  ],
} as const;

export const LANDING_FAQ = {
  heading: "Questions and answers",
  body: "Common questions about Kimchi, coaching, and how we help you change trajectories.",
  contactHeading: "Got more questions?",
  contactBody: "Reach out — we're happy to help.",
  contactCta: "Contact us",
  items: [
    {
      q: "Who is Kimchi for?",
      a: "Ambitious people making a specific career move — breaking into PM or MBB, exiting consulting or banking, leveling up to exec, or getting into a top MBA. Not casual browsers or generic job seekers.",
    },
    {
      q: "How is Kimchi different from a job board?",
      a: "Job boards show listings. Kimchi connects live hiring intelligence with coaches and members who've already made your move — so you know what's actually opening and how to get there.",
    },
    {
      q: "How does Get Matched work?",
      a: "We parse your background and target trajectory, then score open roles and surface coaches who've made your exact transition. High-fit opportunities rise to the top — no spraying applications.",
    },
    {
      q: "Can I book a coach who's made my specific move?",
      a: "Yes. Kimchi coaches are vetted for trajectory fit — MBB to tech, banking to PM, consulting to MBA, and more. Sessions sync with your pipeline so prep stays in context.",
    },
  ],
} as const;

export const LANDING_FINAL_CTA = {
  heading: "Ready to change trajectories?",
  body: "Join the waitlist for early access. Match to roles and coaches built for your move — PM, MBA, MBB exit, and beyond.",
  bullets: ["Get Matched to your trajectory", "Get Coached by people who've made the move"],
} as const;

export const LANDING_FOOTER = {
  quickLinks: ["Home", "About", "Features", "Pricing", "Testimonials", "Blog"],
  categories: [
    "Exit MBB / Big 4",
    "Break into PM",
    "Top MBA programs",
    "Investment banking",
    "Private equity",
    "Executive & CoS",
  ],
  support: ["Help Center", "How It Works", "Changelog", "Terms & Conditions", "404"],
  address: "Second Ladder · Remote-first",
  email: "support@kimchi.so",
  phone: "",
  social: ["Twitter", "Linkedin", "Instagram"],
  legal: ["Support", "Terms of use"],
  copyright: "Kimchi © 2025",
} as const;
