// Kimchi Workspace — static data (ported faithfully from Kimchi Workspace.dc.html)
// All copy is preserved verbatim from the original prototype.

export interface Keyword {
  kw: string;
  matched: boolean;
}

export interface ResumeBullet {
  original: string;
  tailored: string;
}

export interface JobGap {
  title: string;
  body: string;
  fix: string;
}

export interface Job {
  role: string;
  company: string;
  location: string;
  salary: string;
  fitScore: number;
  fitLabel: string;
  fitSummary: string;
  fitWorks: string[];
  fitWatches: string[];
  keywords: Keyword[];
  bullets: ResumeBullet[];
  coverLetter: string;
  gaps: JobGap[];
}

export const JOBS: Job[] = [
  {
    role: "Senior PM — Revenue Recognition",
    company: "Stripe",
    location: "San Francisco, CA · Hybrid",
    salary: "$185–230k + equity",
    fitScore: 91,
    fitLabel: "Strong match",
    fitSummary:
      "Stripe is hiring for a Senior PM to own its revenue recognition product — squarely in your wheelhouse. Your background in data-driven decisions and cross-functional leadership aligns well with how Stripe builds. Eight years in SaaS gives you the pattern recognition they value.",
    fitWorks: [
      "Strong SaaS product background with measurable revenue impact",
      "Experience collaborating with engineering on API-adjacent surfaces",
      "Data literacy and comfort with financial product metrics",
    ],
    fitWatches: [
      "Payments domain depth isn't explicit on your resume — worth surfacing adjacent experience",
      "Stripe values technical PMs — your engineering framing will matter here",
    ],
    keywords: [
      { kw: "Revenue recognition", matched: false },
      { kw: "API-first", matched: true },
      { kw: "Financial infrastructure", matched: false },
      { kw: "Cross-functional leadership", matched: true },
      { kw: "B2B SaaS", matched: true },
      { kw: "Data-driven decisions", matched: true },
      { kw: "Payments infrastructure", matched: false },
      { kw: "Stakeholder alignment", matched: true },
    ],
    bullets: [
      {
        original: "Led product development for core payment flows across three platform teams",
        tailored:
          "Owned payments infrastructure product strategy across three platform teams, driving API-first decisions that increased transaction reliability by 34%",
      },
      {
        original: "Collaborated with engineering on API design and developer experience",
        tailored:
          "Partnered with engineering to deliver API-first product changes, reducing integration time for B2B SaaS customers by 40%",
      },
    ],
    coverLetter:
      "Dear Hiring Manager,\n\nWhen I look at what Stripe is building with revenue recognition, I see a problem I've spent years thinking about from the other side — the product manager trying to understand why revenue looks the way it does, and working backward to fix it.\n\nMy eight years in SaaS product have been shaped by a conviction that financial data should make decisions easier, not harder. At my most recent role, I led a cross-functional team of twelve to rebuild our reporting infrastructure — the kind of unglamorous, load-bearing work that Stripe does exceptionally well.\n\nI'm drawn to Stripe not just because of the scale, but because of the discipline. The way your team thinks about API design, about the long-term cost of technical decisions — that's how I try to think about product.\n\nI'd love to talk about what this role is trying to solve in the next twelve months.\n\nWarm regards,\nSarah Chen",
    gaps: [
      {
        title: "Payments domain depth",
        body: "Your resume doesn't surface direct payments experience. Even adjacent exposure — reconciliation, billing, financial reporting — would be worth pulling forward explicitly.",
        fix: "Add a line to your summary naming financial or revenue surface areas you've touched. One sentence signals literacy to a Stripe recruiter.",
      },
      {
        title: "Technical PM framing",
        body: "Stripe PMs are expected to have strong technical instincts. Your resume reads business-forward rather than technically curious.",
        fix: "Revise 1–2 bullets to name specific technical choices you influenced — API design decisions, infrastructure tradeoffs, architecture reviews you participated in.",
      },
    ],
  },
  {
    role: "Product Lead",
    company: "Linear",
    location: "Remote (US)",
    salary: "$170–210k + equity",
    fitScore: 87,
    fitLabel: "Strong match",
    fitSummary:
      "Linear is a focused team that builds for a demanding audience — developers who care deeply about craft. Your cross-functional leadership and product strategy experience translate well. The challenge: Linear PMs are expected to be genuinely opinionated about developer workflow.",
    fitWorks: [
      "Strategic product thinking aligned with Linear's long-horizon approach",
      "Experience leading without authority across engineering-heavy organizations",
      "Clear writer — Linear's async writing culture will value this",
    ],
    fitWatches: [
      "No developer tools background on record — harder to fake with this audience",
      "Linear is small and flat; big-company coordination skills may not map directly",
    ],
    keywords: [
      { kw: "Developer tools", matched: false },
      { kw: "Product-led growth", matched: true },
      { kw: "Opinionated UX", matched: false },
      { kw: "Async-first", matched: false },
      { kw: "Cross-functional", matched: true },
      { kw: "Product strategy", matched: true },
      { kw: "Roadmap planning", matched: true },
      { kw: "Engineering collaboration", matched: true },
    ],
    bullets: [
      {
        original: "Defined and executed quarterly product roadmaps across three product lines",
        tailored:
          "Owned product strategy and roadmap planning for three core surfaces, operating async-first with a cross-functional team of engineers and designers",
      },
      {
        original: "Improved user onboarding flow resulting in 28% better activation",
        tailored:
          "Redesigned onboarding with opinionated UX principles — 28% activation improvement among product-led growth cohorts",
      },
    ],
    coverLetter:
      "Dear Linear team,\n\nI've been a Linear user for two years. I use it daily, I notice when things change, and I have opinions about why those changes were right or wrong — which I suspect is exactly the kind of candidate you're looking for.\n\nAs a Product Lead, I've spent my career in the uncomfortable middle: between what engineers want to build and what customers actually need, between long-term vision and quarterly reality. Linear's bet — that you can do both by being ruthlessly opinionated — is one I share.\n\nWhat I'd bring is eight years of practice saying no to the right things. Of keeping products coherent under pressure.\n\nI'd love to talk about what this role is working on in the next six months.\n\nBest,\nSarah Chen",
    gaps: [
      {
        title: "Developer tools experience",
        body: "Linear's users are developers. Without surfacing experience building for technical users, this application will feel generic next to candidates who have it.",
        fix: "Surface any product work aimed at developers, engineers, or technical workflows — internal tools count. If none, lead your cover letter with a clear POV on developer UX.",
      },
    ],
  },
  {
    role: "Design Systems PM",
    company: "Figma",
    location: "New York, NY · Hybrid",
    salary: "$175–215k + equity",
    fitScore: 84,
    fitLabel: "Good fit",
    fitSummary:
      "Figma's design systems PM role sits at the intersection of design tooling and developer infrastructure. Your cross-functional experience is genuinely relevant, but the role requires depth in design systems thinking that isn't yet visible in your profile.",
    fitWorks: [
      "Strong stakeholder alignment — design systems work is mostly internal adoption",
      "Cross-functional leadership across design and engineering is precisely what this needs",
      "Product strategy chops will help navigate the complexity of platform PM work",
    ],
    fitWatches: [
      "Design systems domain depth isn't evident — this is a specialized discipline",
      "Figma values design craft; your resume skews toward business outcomes over design quality",
    ],
    keywords: [
      { kw: "Design systems", matched: false },
      { kw: "Component libraries", matched: false },
      { kw: "Design tokens", matched: false },
      { kw: "Internal adoption", matched: false },
      { kw: "Cross-functional", matched: true },
      { kw: "Platform PM", matched: false },
      { kw: "Stakeholder alignment", matched: true },
    ],
    bullets: [
      {
        original: "Partnered with design team on product UI improvements",
        tailored:
          "Drove cross-functional alignment between design and engineering to establish component library adoption across four product surfaces, reducing design debt by 30%",
      },
    ],
    coverLetter:
      "Dear Figma team,\n\nDesign systems are the quiet infrastructure that makes great products possible — and one of the hardest things to get right, because the people who need them most rarely own the roadmap.\n\nI've spent years sitting at the intersection of design and engineering, often as the person translating between them. I've seen what happens when that translation breaks — the inconsistencies that accumulate, the one-off components, the designer-developer friction that slows everything down.\n\nI'd bring that understanding to Figma's design systems work: not just as a user of the tools, but as someone who has lived the problem the tools are trying to solve.\n\nBest,\nSarah Chen",
    gaps: [
      {
        title: "Design systems domain knowledge",
        body: "Without explicit design systems experience — tokens, component governance, adoption metrics — your application will struggle against specialists.",
        fix: "If you've worked with a design system in any capacity, name it explicitly. Otherwise, lead your cover letter with a sharp POV on design systems strategy.",
      },
      {
        title: "Design craft signal",
        body: "Figma hires people who genuinely care about design quality. Your resume is outcomes-focused — but here you need to signal design sensibility too.",
        fix: "Add one bullet about a visual consistency or design quality decision you influenced — not just shipping velocity or revenue impact.",
      },
    ],
  },
];

/* ── Companies ─────────────────────────────────────────────── */
export interface CompanyRole {
  id: number;
  title: string;
  dept: string;
  posted: string;
  match: number;
  jobRef: number | null;
}

export interface Company {
  id: number;
  name: string;
  initials: string;
  industry: string;
  stage: string;
  size: string;
  fit: number;
  suggestedBy: "scout" | "user";
  fitReason: string;
  description: string;
  openRoles: CompanyRole[];
}

export const COMPANIES: Company[] = [
  {
    id: 0,
    name: "Stripe",
    initials: "ST",
    industry: "Fintech",
    stage: "Late-stage private",
    size: "8,000+",
    fit: 91,
    suggestedBy: "scout",
    fitReason:
      "Your API-first product experience and financial data background are a strong signal for Stripe's PM roles.",
    description:
      "Stripe builds economic infrastructure for the internet — tools that help millions of businesses accept payments and scale globally.",
    openRoles: [
      { id: 0, title: "Senior PM — Revenue Recognition", dept: "Product", posted: "2 days ago", match: 91, jobRef: 0 },
    ],
  },
  {
    id: 1,
    name: "Linear",
    initials: "LN",
    industry: "Developer Tools",
    stage: "Series C",
    size: "80",
    fit: 87,
    suggestedBy: "scout",
    fitReason:
      "Linear builds for opinionated, craft-focused teams — exactly the environment your async-first leadership style thrives in.",
    description:
      "Linear is a purpose-built software project management tool used by the world's best product teams. Focused, fast, and opinionated.",
    openRoles: [
      { id: 0, title: "Product Lead", dept: "Product", posted: "5 days ago", match: 87, jobRef: 1 },
    ],
  },
  {
    id: 2,
    name: "Figma",
    initials: "FG",
    industry: "Design Tools",
    stage: "Public",
    size: "1,400+",
    fit: 84,
    suggestedBy: "user",
    fitReason:
      "Your cross-functional leadership between design and engineering maps well to Figma's internal platform work.",
    description:
      "Figma is a collaborative design platform used by teams to create, prototype, and develop products together in real time.",
    openRoles: [
      { id: 0, title: "Design Systems PM", dept: "Platform", posted: "1 week ago", match: 84, jobRef: 2 },
    ],
  },
  {
    id: 3,
    name: "Notion",
    initials: "NO",
    industry: "Productivity",
    stage: "Series C",
    size: "600+",
    fit: 82,
    suggestedBy: "scout",
    fitReason:
      "Notion values PMs who think about knowledge infrastructure at scale — your systems thinking is a natural fit.",
    description:
      "Notion is an all-in-one workspace for notes, tasks, wikis, and databases — used by over 30 million people worldwide.",
    openRoles: [],
  },
  {
    id: 4,
    name: "Vercel",
    initials: "VC",
    industry: "Dev Infrastructure",
    stage: "Series D",
    size: "400+",
    fit: 79,
    suggestedBy: "scout",
    fitReason:
      "Vercel is expanding its PM team for developer-facing infrastructure — your technical positioning could translate well here.",
    description:
      "Vercel provides the frontend cloud infrastructure and the Next.js framework — powering teams at Netflix, Uber, and thousands of startups.",
    openRoles: [
      { id: 0, title: "Platform PM — Edge Network", dept: "Infrastructure", posted: "3 days ago", match: 79, jobRef: null },
    ],
  },
];

/* ── Kanban ────────────────────────────────────────────────── */
export type KanbanStage = "saved" | "applied" | "interview" | "offer" | "closed";

export const KANBAN_STAGES: KanbanStage[] = ["saved", "applied", "interview", "offer", "closed"];
export const STAGE_LABELS: Record<KanbanStage, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interviewing",
  offer: "Offer",
  closed: "Closed",
};
export const STAGE_COLORS: Record<KanbanStage, string> = {
  saved: "#8A8278",
  applied: "#5B7FA6",
  interview: "#C4A86A",
  offer: "#4A8B6A",
  closed: "rgba(26,26,26,0.4)",
};

export interface KanbanCard {
  id: number;
  company: string;
  initials: string;
  role: string;
  stage: KanbanStage;
  fit: number;
  jobRef: number | null;
  days: number;
}

export const INITIAL_KANBAN_CARDS: KanbanCard[] = [];

/* ── Market signals ────────────────────────────────────────── */
export interface SignalItem {
  type: "hiring_surge" | "hiring_freeze" | "trend" | "role_demand" | "funding" | "salary";
  company: string | null;
  title: string;
  body: string;
  sentiment: "positive" | "negative" | "neutral";
  actionable: string;
}

export interface SignalsData {
  headline: string;
  signals: SignalItem[];
  salaryBenchmark: { role: string; note: string };
  hotSkills: string[];
  coldSkills: string[];
}

export const INITIAL_SIGNALS: SignalsData = {
  headline:
    "Senior PM hiring is rebounding at growth-stage companies — your infra background is the differentiator this cycle.",
  signals: [
    {
      type: "hiring_surge",
      company: "Stripe",
      title: "Stripe ramping PM headcount in revenue infra",
      body: "12 senior PM roles posted in the last 60 days, heavily skewed toward revenue and platform tracks.",
      sentiment: "positive",
      actionable: "Refresh your Stripe network outreach — timing is right.",
    },
    {
      type: "trend",
      company: null,
      title: "AI product fluency now a top-3 hiring signal",
      body: "Candidates who can speak to building with LLMs are advancing to final rounds 2× faster across product roles.",
      sentiment: "positive",
      actionable: "Add a concrete AI product example to your interview prep.",
    },
    {
      type: "role_demand",
      company: null,
      title: "Head of Product roles up 34% YoY at Series B",
      body: "Companies raising $30–80M are replacing fractional PMs with full-time Heads of Product faster than any point since 2021.",
      sentiment: "positive",
      actionable: "Consider targeting 2–3 recently funded Series B companies.",
    },
    {
      type: "funding",
      company: "Linear",
      title: "Linear raises Series C — headcount growth likely",
      body: "$35M new round suggests significant hiring ahead, particularly in product and engineering.",
      sentiment: "positive",
      actionable: "Reach out to your Linear contact while momentum is fresh.",
    },
    {
      type: "salary",
      company: null,
      title: "Director PM comp stabilizing at $280–400k TC",
      body: "After the 2023–24 correction, total comp has stabilized with equity bouncing back at growth-stage companies.",
      sentiment: "neutral",
      actionable: "Use this benchmark in your next offer negotiation.",
    },
  ],
  salaryBenchmark: {
    role: "Director / Head of Product",
    note: "Total comp $300–450K post-correction; equity meaningful again at growth-stage.",
  },
  hotSkills: ["AI/ML product", "PLG", "Platform strategy", "Data products"],
  coldSkills: ["Waterfall PM", "Feature factory PM"],
};

/* ── Live sessions ─────────────────────────────────────────── */
export interface LiveSession {
  id: number;
  isMiraWeekly: boolean;
  isLive: boolean;
  startsIn: string;
  date: string;
  time: string;
  registered: number;
  host: string;
  hostInitials: string;
  hostRole: string;
  hostRating: number;
  hostReviews: number;
  title: string;
  description: string;
  category: string;
  bgColor: string;
  accentColor: string;
}

export const LIVE_SESSIONS: LiveSession[] = [
  {
    id: 0,
    isMiraWeekly: true,
    isLive: false,
    startsIn: "Tomorrow · 12:00 PM EDT",
    date: "Jun 25, 2026",
    time: "12:00 PM – 1:00 PM EDT",
    registered: 124,
    host: "Mira Singh",
    hostInitials: "MS",
    hostRole: "Career Coach · Second Ladder",
    hostRating: 4.9,
    hostReviews: 142,
    title: "Job Search Strategy: Weekly Q&A",
    description:
      "Open Q&A on job search tactics, positioning, and getting in front of the right people. Mira covers what's actually working right now — from resume framing to outreach scripts to navigating the ATS.",
    category: "Job Search",
    bgColor: "#1A3A2F",
    accentColor: "#E8D5A3",
  },
  {
    id: 1,
    isMiraWeekly: false,
    isLive: false,
    startsIn: "In 2 days",
    date: "Jun 26, 2026",
    time: "3:00 PM – 4:00 PM EDT",
    registered: 89,
    host: "Rachel Torres",
    hostInitials: "RT",
    hostRole: "PM Career Specialist · ex-Meta",
    hostRating: 4.9,
    hostReviews: 48,
    title: "Senior PM → Director: What Actually Changes",
    description:
      "The jump from Senior PM to Director isn't about doing more — it's about doing different. Rachel breaks down exactly what hiring managers screen for at this level.",
    category: "Career Transition",
    bgColor: "#2D1F52",
    accentColor: "#C4B8E8",
  },
  {
    id: 2,
    isMiraWeekly: false,
    isLive: false,
    startsIn: "In 3 days",
    date: "Jun 27, 2026",
    time: "11:00 AM – 11:45 AM EDT",
    registered: 203,
    host: "Michael Chen",
    hostInitials: "MC",
    hostRole: "Tech Recruiter · ex-Google",
    hostRating: 4.8,
    hostReviews: 31,
    title: "How Stripe and Linear Actually Read Your Resume",
    description:
      "An insider look at how top-tier tech companies parse resumes before a human ever sees them — and what you can change this week to get through.",
    category: "Resume",
    bgColor: "#1A2E4A",
    accentColor: "#B8D4E8",
  },
  {
    id: 3,
    isMiraWeekly: false,
    isLive: false,
    startsIn: "In 4 days",
    date: "Jun 28, 2026",
    time: "2:00 PM – 3:00 PM EDT",
    registered: 67,
    host: "Jeremy Scharf",
    hostInitials: "JS",
    hostRole: "ex-Bain Interviewer · MBB Case Expert",
    hostRating: 5.0,
    hostReviews: 160,
    title: "Director-Track Interviews: What MBB Actually Looks For",
    description:
      "Live mock interview debrief. Jeremy walks through the most common failure modes for senior candidates transitioning to Director-level and how to avoid them.",
    category: "Interviews",
    bgColor: "#3A1A1A",
    accentColor: "#E8C4B8",
  },
  {
    id: 4,
    isMiraWeekly: false,
    isLive: true,
    startsIn: "Live now",
    date: "Jun 19, 2026",
    time: "2:30 PM – 3:15 PM EDT",
    registered: 341,
    host: "Mira Singh",
    hostInitials: "MS",
    hostRole: "Career Coach · Second Ladder",
    hostRating: 4.9,
    hostReviews: 142,
    title: "The Offer Negotiation Playbook: Getting to Yes",
    description:
      "A live walkthrough of the exact scripts and frameworks Mira uses with clients to negotiate compensation packages — including base, equity, and signing.",
    category: "Negotiation",
    bgColor: "#1A3A2F",
    accentColor: "#E8D5A3",
  },
];

/* ── Coaches ───────────────────────────────────────────────── */
export interface Coach {
  id: number;
  name: string;
  initials: string;
  role: string;
  workedAt: string[];
  studiedAt: string;
  rate: number;
  reviewCount: number;
  rating: number;
  minutes: number;
  available: string;
  featured: boolean;
  specialties: string[];
  bio: string;
  companies: string[];
}

export const COACHES: Coach[] = [
  {
    id: 0,
    name: "Jeremy Scharf",
    initials: "JS",
    role: "ex-Bain Interviewer · MBB Case Expert",
    workedAt: ["Bain & Company"],
    studiedAt: "MIT Sloan",
    rate: 429,
    reviewCount: 160,
    rating: 5.0,
    minutes: 70665,
    available: "Jun 22",
    featured: true,
    specialties: ["Case Interviews", "Executive Presence", "Director Track"],
    bio: "Part of Bain's interview team for 4 years. 150+ MBB offers. Specializes in helping senior PMs build the exec presence for Director+ transitions.",
    companies: ["Bain", "McKinsey", "BCG", "Deloitte"],
  },
  {
    id: 1,
    name: "Ian G.",
    initials: "IG",
    role: "Top 10 Global · 95% Success Rate",
    workedAt: ["Boston Consulting Group"],
    studiedAt: "NYU Stern MBA",
    rate: 399,
    reviewCount: 65,
    rating: 5.0,
    minutes: 28200,
    available: "Jun 22",
    featured: true,
    specialties: ["PM Interviews", "Behavioral", "Comp Negotiation"],
    bio: "Passed all 8 consulting interviews during MBA. BCG consultant turned coach. $2,556 in free prep materials included.",
    companies: ["BCG", "Stripe", "Notion"],
  },
  {
    id: 2,
    name: "Rachel Torres",
    initials: "RT",
    role: "PM Career Specialist · ex-Meta",
    workedAt: ["Meta", "Second Ladder"],
    studiedAt: "Stanford MBA",
    rate: 95,
    reviewCount: 48,
    rating: 4.9,
    minutes: 12400,
    available: "Today",
    featured: false,
    specialties: ["Senior PM", "Director Transition", "Resume"],
    bio: "Former Meta PM turned full-time coach. Specializes in mid-career PMs landing Director-track roles at top-tier companies.",
    companies: ["Meta", "Stripe", "Linear", "Figma"],
  },
  {
    id: 3,
    name: "Michael Chen",
    initials: "MC",
    role: "Tech Recruiter · ex-Google",
    workedAt: ["Google", "Stripe"],
    studiedAt: "UC Berkeley",
    rate: 80,
    reviewCount: 31,
    rating: 4.8,
    minutes: 8900,
    available: "Jun 24",
    featured: false,
    specialties: ["Resume ATS", "Recruiter POV", "Offer Negotiation"],
    bio: "8 years recruiting for Google and Stripe. Shows you exactly what recruiters screen for and how to get past ATS filters.",
    companies: ["Google", "Stripe", "Vercel"],
  },
];

/* ── Network contacts ──────────────────────────────────────── */
export interface NetworkPerson {
  id: number;
  initials: string;
  name: string;
  role: string;
  company: string;
  degree: "1st" | "2nd" | "platform";
  mutual?: number;
  warmth: "hot" | "warm" | "cool" | "discovered";
  lastTouched: string;
  note: string;
  hiveMind: boolean;
  hmOpenRoles: number;
  hmFee: string | null;
  hmSuccessRate: number;
  hmVerified: boolean;
}

export const MY_CONTACTS: NetworkPerson[] = [
  {
    id: 0,
    initials: "TL",
    name: "Tom Liu",
    role: "VP Product",
    company: "Notion",
    degree: "1st",
    mutual: 5,
    warmth: "hot",
    lastTouched: "2 weeks ago",
    note: "Worked together at DataFlow. Tom leads the creator product suite. Strong referral path into Notion PM roles.",
    hiveMind: true,
    hmOpenRoles: 1,
    hmFee: "$2,200",
    hmSuccessRate: 88,
    hmVerified: true,
  },
  {
    id: 1,
    initials: "MR",
    name: "Maya Rodriguez",
    role: "Head of Product",
    company: "Stripe",
    degree: "2nd",
    mutual: 3,
    warmth: "warm",
    lastTouched: "3 months ago",
    note: "3 mutual connections. Maya oversees Stripe's payments PM team — direct path into open roles.",
    hiveMind: true,
    hmOpenRoles: 2,
    hmFee: "$2,800",
    hmSuccessRate: 91,
    hmVerified: true,
  },
  {
    id: 2,
    initials: "JP",
    name: "James Park",
    role: "Staff Engineer",
    company: "Linear",
    degree: "1st",
    mutual: 2,
    warmth: "warm",
    lastTouched: "1 month ago",
    note: "Former colleague. Now at Linear. Not recruiting but could make a warm intro to the PM team.",
    hiveMind: false,
    hmOpenRoles: 0,
    hmFee: null,
    hmSuccessRate: 0,
    hmVerified: false,
  },
  {
    id: 3,
    initials: "AO",
    name: "Aisha Okafor",
    role: "Director of Product",
    company: "Vercel",
    degree: "2nd",
    mutual: 4,
    warmth: "cool",
    lastTouched: "6 months ago",
    note: "4 mutual connections. Aisha recently moved to Vercel as a Director — cold but reachable.",
    hiveMind: false,
    hmOpenRoles: 0,
    hmFee: null,
    hmSuccessRate: 0,
    hmVerified: false,
  },
];

export const DISCOVERED_MEMBERS: NetworkPerson[] = [
  {
    id: 10,
    initials: "SK",
    name: "Sarah K.",
    role: "Senior PM",
    company: "Stripe",
    degree: "platform",
    warmth: "discovered",
    lastTouched: "New",
    note: "Second Ladder platform member. 3 mutual connections.",
    hiveMind: true,
    hmOpenRoles: 2,
    hmFee: "$2,400",
    hmSuccessRate: 87,
    hmVerified: true,
  },
  {
    id: 11,
    initials: "BJ",
    name: "Ben J.",
    role: "Engineering Manager",
    company: "Notion",
    degree: "platform",
    warmth: "discovered",
    lastTouched: "New",
    note: "Second Ladder platform member. Referred 4 people into Notion.",
    hiveMind: true,
    hmOpenRoles: 1,
    hmFee: "$1,800",
    hmSuccessRate: 92,
    hmVerified: true,
  },
  {
    id: 12,
    initials: "PT",
    name: "Priya T.",
    role: "Product Lead",
    company: "Figma",
    degree: "platform",
    warmth: "discovered",
    lastTouched: "New",
    note: "Second Ladder platform member. 2 open slots at Figma.",
    hiveMind: true,
    hmOpenRoles: 2,
    hmFee: "$2,100",
    hmSuccessRate: 79,
    hmVerified: false,
  },
  {
    id: 13,
    initials: "RW",
    name: "Ryan W.",
    role: "Group PM",
    company: "Vercel",
    degree: "platform",
    warmth: "discovered",
    lastTouched: "New",
    note: "Second Ladder platform member. Specializes in PM→Director referrals.",
    hiveMind: true,
    hmOpenRoles: 1,
    hmFee: "$3,000",
    hmSuccessRate: 94,
    hmVerified: true,
  },
];

/* ── Profile ───────────────────────────────────────────────── */
export interface WorkExp {
  company: string;
  role: string;
  period: string;
  bullets: string[];
}

export const WORK_EXP: WorkExp[] = [
  {
    company: "TechCorp",
    role: "Senior Product Manager, Revenue Products",
    period: "2021 → Present",
    bullets: [
      "Led cross-functional team of 12 to rebuild revenue reporting infrastructure, reducing time-to-insight by 60%",
      "Drove API-first product decisions resulting in 34% platform reliability improvement",
      "Owned roadmap for 3 core product surfaces serving 40k+ enterprise customers",
    ],
  },
  {
    company: "DataFlow Inc",
    role: "Product Manager",
    period: "2018 → 2021",
    bullets: [
      "Launched 4 new product features 0→1, each reaching $1M+ ARR within 12 months",
      "Partnered with engineering on API redesign reducing customer integration time by 40%",
    ],
  },
  {
    company: "StartupXYZ",
    role: "Associate Product Manager",
    period: "2016 → 2018",
    bullets: [
      "Built core analytics dashboard used by 500+ customers across 3 verticals",
      "Managed product backlog and sprint planning for 6-person engineering team",
    ],
  },
];

export const EDUCATION_LIST = [
  { school: "Stanford Graduate School of Business", degree: "MBA", period: "2014 → 2016" },
  { school: "UC Berkeley", degree: "B.S. Computer Science", period: "2010 → 2014" },
];

export const SKILLS_LIST = [
  "Product Strategy",
  "Data Analysis",
  "Cross-functional Leadership",
  "Stakeholder Management",
  "Roadmap Planning",
  "SaaS",
  "UX Research",
  "SQL",
  "Amplitude",
  "A/B Testing",
];

export const SKILLS_SUGGESTED = ["API-first", "Revenue Operations", "Payments Infrastructure"];

export interface ProfileSuggestion {
  id: number;
  priority: "high" | "medium" | "low";
  category: string;
  title: string;
  detail: string;
  impact: string;
}

export const PROFILE_SUGGESTIONS: ProfileSuggestion[] = [
  {
    id: 0,
    priority: "high",
    category: "LinkedIn",
    title: "Sharpen your headline",
    detail: 'Current: "Senior PM at TechCorp" → Try: "Senior PM · Revenue · API-first · SaaS | Open to Director-track"',
    impact: "High recruiter visibility",
  },
  {
    id: 1,
    priority: "high",
    category: "Resume",
    title: "Add metrics to 3 bullets",
    detail: "Your Work Experience reads well but runs thin on numbers. Recruiters at Stripe and Linear scan for quantified impact first.",
    impact: "Stronger first impression",
  },
  {
    id: 2,
    priority: "medium",
    category: "Skills",
    title: "Add API-first + Revenue Ops",
    detail: "These exact terms appear in 4 of your 5 target role descriptions. Neither is on your current resume or LinkedIn skills.",
    impact: "Better ATS keyword matching",
  },
  {
    id: 3,
    priority: "medium",
    category: "LinkedIn",
    title: "Rewrite your About hook",
    detail: "Your first two lines don't grab. Recruiters decide in 2 sentences before tapping \"See more\" — make them count.",
    impact: "Better profile engagement",
  },
  {
    id: 4,
    priority: "low",
    category: "Resume",
    title: "Add a technical skills bar",
    detail: "Even a brief line (SQL, Amplitude, Figma, JIRA) signals PM-engineer fluency to Stripe and Vercel.",
    impact: "Technical credibility signal",
  },
];

/* ── Dream Role archetypes ─────────────────────────────────── */
export interface RoleArchetype {
  color: string;
  description: string;
  openRolesLabel: string;
  requires: string[];
}

export const ROLE_ARCHETYPES: Record<string, RoleArchetype> = {
  /* ── Product Management Track ─────────────────────────────── */
  "Senior Product Manager": {
    color: "#4A8B6A",
    description: "Owns a product area end-to-end — strategy, roadmap, and execution — working closely with engineering, design, and data.",
    openRolesLabel: "210+ open roles match this path",
    requires: [
      "Product Strategy",
      "Roadmap Planning",
      "Stakeholder Management",
      "Data Analysis",
      "User Research",
      "A/B Testing",
      "GTM Strategy",
      "Cross-functional Leadership",
    ],
  },
  "Staff Product Manager": {
    color: "#3A7A5A",
    description: "Senior IC PM who drives product direction across a complex surface area, often setting standards for the PM org.",
    openRolesLabel: "45 open roles match this path",
    requires: [
      "Product Strategy",
      "Roadmap Planning",
      "Stakeholder Management",
      "Data Analysis",
      "A/B Testing",
      "Cross-functional Leadership",
      "Executive Communication",
      "Mentorship",
    ],
  },
  "Principal Product Manager": {
    color: "#2D6B4A",
    description: "Highest IC PM level — shapes multi-year product vision, influences org strategy, and mentors PM teams.",
    openRolesLabel: "18 open roles match this path",
    requires: [
      "Product Strategy",
      "Roadmap Planning",
      "Cross-functional Leadership",
      "Executive Communication",
      "Data Analysis",
      "Stakeholder Management",
      "Mentorship",
    ],
  },
  "Group Product Manager": {
    color: "#7A5BA6",
    description: "Senior IC PM managing a group of related products, often mentoring junior PMs.",
    openRolesLabel: "24 open roles match this path",
    requires: [
      "Product Strategy",
      "Roadmap Planning",
      "Stakeholder Management",
      "Cross-functional Leadership",
      "Data Analysis",
      "A/B Testing",
      "User Research",
    ],
  },
  "Director of Product": {
    color: "#5B7FA6",
    description: "Senior PM leader owning a major product area or platform, managing a team of PMs.",
    openRolesLabel: "80 open roles match this path",
    requires: [
      "Product Strategy",
      "Roadmap Planning",
      "Stakeholder Management",
      "Cross-functional Leadership",
      "Data Analysis",
      "Team Management",
      "Mentorship",
    ],
  },
  "VP of Product": {
    color: "#4A8B6A",
    description: "Leads the entire product org, owns product strategy and roadmap across multiple product lines. Typically reports to CEO.",
    openRolesLabel: "32 open roles match this path",
    requires: [
      "Product Strategy",
      "Roadmap Planning",
      "Cross-functional Leadership",
      "Stakeholder Management",
      "Team Management",
      "P&L Ownership",
      "Executive Communication",
      "OKR Frameworks",
    ],
  },
  "Chief Product Officer": {
    color: "#C4574A",
    description: "C-suite executive responsible for all product decisions, company vision alignment, and full product org leadership.",
    openRolesLabel: "8 open roles match this path",
    requires: [
      "Product Strategy",
      "P&L Ownership",
      "Board Communication",
      "GTM Strategy",
      "Team Management",
      "Executive Communication",
      "Cross-functional Leadership",
      "OKR Frameworks",
    ],
  },
  "Head of Product": {
    color: "#5A9E7A",
    description: "Owns product at a company where there's no separate VP/CPO — often a first PM leadership hire scaling the function.",
    openRolesLabel: "55 open roles match this path",
    requires: [
      "Product Strategy",
      "Roadmap Planning",
      "Cross-functional Leadership",
      "Stakeholder Management",
      "Team Management",
      "Executive Communication",
      "GTM Strategy",
    ],
  },
  "Head of Product Operations": {
    color: "#C4A86A",
    description: "Enables the product team through systems, analytics, processes, and cross-functional coordination.",
    openRolesLabel: "28 open roles match this path",
    requires: [
      "Data Analysis",
      "Cross-functional Leadership",
      "Roadmap Planning",
      "SQL",
      "Process Design",
      "OKR Frameworks",
      "Stakeholder Management",
    ],
  },
  "Technical Product Manager": {
    color: "#5A8E7A",
    description: "PM who owns developer tooling, APIs, or infrastructure products — bridges technical and business contexts.",
    openRolesLabel: "62 open roles match this path",
    requires: [
      "Product Strategy",
      "SQL",
      "Data Analysis",
      "Roadmap Planning",
      "Stakeholder Management",
      "User Research",
      "Cross-functional Leadership",
    ],
  },
  "Head of Platform Product": {
    color: "#3A6A5A",
    description: "Owns platform and infrastructure products that other product lines depend on — deep technical and strategic role.",
    openRolesLabel: "22 open roles match this path",
    requires: [
      "Product Strategy",
      "Roadmap Planning",
      "Cross-functional Leadership",
      "Stakeholder Management",
      "Team Management",
      "OKR Frameworks",
      "Executive Communication",
    ],
  },
  "Head of AI Product": {
    color: "#2A5A4A",
    description: "Leads AI/ML product strategy — works closely with research and engineering to ship AI-native features.",
    openRolesLabel: "40 open roles match this path",
    requires: [
      "Product Strategy",
      "Roadmap Planning",
      "Data Analysis",
      "SQL",
      "Cross-functional Leadership",
      "Stakeholder Management",
      "Executive Communication",
    ],
  },
  "Director of Product Growth": {
    color: "#6A9B8A",
    description: "Owns top-of-funnel, activation, and retention product loops — analytically rigorous and GTM-connected.",
    openRolesLabel: "35 open roles match this path",
    requires: [
      "Product Strategy",
      "A/B Testing",
      "Data Analysis",
      "GTM Strategy",
      "Cross-functional Leadership",
      "Stakeholder Management",
      "OKR Frameworks",
      "User Research",
    ],
  },
  /* ── Corporate Strategy / CorpDev Track ───────────────────── */
  "Senior Manager, Corporate Strategy": {
    color: "#5B7FA6",
    description: "Drives strategic planning initiatives, market analysis, and executive-level recommendations across business units.",
    openRolesLabel: "90 open roles match this path",
    requires: [
      "Strategic Analysis",
      "Financial Modeling",
      "Stakeholder Management",
      "Executive Communication",
      "Business Case Development",
      "Market Research",
      "Cross-functional Leadership",
      "Data Analysis",
    ],
  },
  "Director of Corporate Strategy": {
    color: "#4A6F96",
    description: "Leads multi-year strategic planning and special projects for C-suite — often the CEO's analytical right hand.",
    openRolesLabel: "48 open roles match this path",
    requires: [
      "Strategic Analysis",
      "Financial Modeling",
      "Stakeholder Management",
      "Executive Communication",
      "Business Case Development",
      "Cross-functional Leadership",
      "OKR Frameworks",
      "Team Management",
    ],
  },
  "VP of Corporate Strategy": {
    color: "#3A5F86",
    description: "Owns the company's strategic roadmap — runs annual planning, competitive analysis, and board strategy prep.",
    openRolesLabel: "20 open roles match this path",
    requires: [
      "Strategic Analysis",
      "Financial Modeling",
      "Executive Communication",
      "Cross-functional Leadership",
      "P&L Ownership",
      "Team Management",
      "Stakeholder Management",
      "Board Communication",
    ],
  },
  "Chief Strategy Officer": {
    color: "#2A4F76",
    description: "C-suite owner of long-term company direction — shapes where the company competes, how it wins, and what it stops doing.",
    openRolesLabel: "6 open roles match this path",
    requires: [
      "Strategic Analysis",
      "Executive Communication",
      "Board Communication",
      "P&L Ownership",
      "Cross-functional Leadership",
      "Team Management",
      "Stakeholder Management",
      "Market Research",
    ],
  },
  "Director of Corporate Development": {
    color: "#6A8FB6",
    description: "Sources, evaluates, and executes M&A and strategic partnerships — owns the deal lifecycle from thesis to close.",
    openRolesLabel: "38 open roles match this path",
    requires: [
      "M&A Diligence",
      "Financial Modeling",
      "Strategic Analysis",
      "Stakeholder Management",
      "Executive Communication",
      "Business Case Development",
      "Market Research",
    ],
  },
  "VP of Corporate Development": {
    color: "#5A7FA6",
    description: "Leads M&A strategy and executes complex deals — builds the corp dev team and owns the integration playbook.",
    openRolesLabel: "14 open roles match this path",
    requires: [
      "M&A Diligence",
      "Financial Modeling",
      "Strategic Analysis",
      "Executive Communication",
      "Board Communication",
      "Stakeholder Management",
      "Team Management",
      "P&L Ownership",
    ],
  },
  "Head of Corporate Development": {
    color: "#4A6F96",
    description: "First corp dev hire at a scaling company — builds the deal pipeline, partnership strategy, and M&A framework from scratch.",
    openRolesLabel: "22 open roles match this path",
    requires: [
      "M&A Diligence",
      "Financial Modeling",
      "Strategic Analysis",
      "Executive Communication",
      "Cross-functional Leadership",
      "Stakeholder Management",
      "Business Case Development",
    ],
  },
  "Director of Business Development": {
    color: "#7A9FC6",
    description: "Owns strategic partnerships, distribution deals, and new revenue channels — bridges external relationships to internal execution.",
    openRolesLabel: "60 open roles match this path",
    requires: [
      "Strategic Analysis",
      "Stakeholder Management",
      "GTM Strategy",
      "Financial Modeling",
      "Executive Communication",
      "Market Research",
      "Cross-functional Leadership",
    ],
  },
  "VP of Business Development": {
    color: "#6A8FB6",
    description: "Leads the BD org — builds high-value partnerships and pipeline that creates sustainable revenue growth.",
    openRolesLabel: "25 open roles match this path",
    requires: [
      "GTM Strategy",
      "Stakeholder Management",
      "Financial Modeling",
      "Executive Communication",
      "P&L Ownership",
      "Team Management",
      "Cross-functional Leadership",
    ],
  },
  "Head of Strategy & Operations": {
    color: "#5A7FA6",
    description: "Bridges strategic planning and operational execution — often a startup's most senior generalist leader.",
    openRolesLabel: "42 open roles match this path",
    requires: [
      "Strategic Analysis",
      "Process Design",
      "Stakeholder Management",
      "Cross-functional Leadership",
      "OKR Frameworks",
      "Data Analysis",
      "Executive Communication",
      "Team Management",
    ],
  },
  "Director of Strategy & Operations": {
    color: "#4A6F96",
    description: "Runs planning cycles, special strategic initiatives, and the operating cadence for a business unit or company.",
    openRolesLabel: "55 open roles match this path",
    requires: [
      "Strategic Analysis",
      "Process Design",
      "Stakeholder Management",
      "Data Analysis",
      "OKR Frameworks",
      "Cross-functional Leadership",
      "Executive Communication",
    ],
  },
  "Head of M&A": {
    color: "#3A5F86",
    description: "Owns M&A strategy end-to-end — sourcing through integration. May report to CFO or CEO at mid-market companies.",
    openRolesLabel: "10 open roles match this path",
    requires: [
      "M&A Diligence",
      "Financial Modeling",
      "Strategic Analysis",
      "Executive Communication",
      "Board Communication",
      "Stakeholder Management",
      "Cross-functional Leadership",
    ],
  },
  "Director of FP&A": {
    color: "#6A8FB6",
    description: "Owns financial planning, forecasting, and business performance analytics — partners closely with every function.",
    openRolesLabel: "70 open roles match this path",
    requires: [
      "Financial Modeling",
      "Data Analysis",
      "Budget Management",
      "Stakeholder Management",
      "Executive Communication",
      "Business Case Development",
      "P&L Ownership",
    ],
  },
  /* ── GM / Ops / BizOps Track ──────────────────────────────── */
  "Chief of Staff": {
    color: "#C4A86A",
    description: "Extends the CEO's or executive's reach — runs cross-functional initiatives, synthesizes information, and turns strategy into execution.",
    openRolesLabel: "95 open roles match this path",
    requires: [
      "Stakeholder Management",
      "Executive Communication",
      "Cross-functional Leadership",
      "Strategic Analysis",
      "OKR Frameworks",
      "Process Design",
      "Data Analysis",
    ],
  },
  "Senior Chief of Staff": {
    color: "#B4984A",
    description: "Elevated CoS scope — often running strategic programs, managing a small team, and acting as an internal GM.",
    openRolesLabel: "28 open roles match this path",
    requires: [
      "Stakeholder Management",
      "Executive Communication",
      "Cross-functional Leadership",
      "Strategic Analysis",
      "OKR Frameworks",
      "Process Design",
      "Data Analysis",
      "Team Management",
    ],
  },
  "Director of Business Operations": {
    color: "#C4B86A",
    description: "Builds and runs operational systems that let the business scale — owns planning, tooling, and cross-functional coordination.",
    openRolesLabel: "75 open roles match this path",
    requires: [
      "Process Design",
      "Stakeholder Management",
      "Data Analysis",
      "Cross-functional Leadership",
      "OKR Frameworks",
      "Executive Communication",
      "Operational Excellence",
      "Budget Management",
    ],
  },
  "VP of Business Operations": {
    color: "#A4983A",
    description: "Senior operator who owns the company's operating model — from headcount planning to the annual operating plan.",
    openRolesLabel: "30 open roles match this path",
    requires: [
      "Process Design",
      "Stakeholder Management",
      "Data Analysis",
      "Cross-functional Leadership",
      "OKR Frameworks",
      "P&L Ownership",
      "Team Management",
      "Executive Communication",
      "Operational Excellence",
    ],
  },
  "Head of Business Operations": {
    color: "#C4A85A",
    description: "Scales operational infrastructure at a fast-growing company — owns the systems that connect strategy to daily execution.",
    openRolesLabel: "48 open roles match this path",
    requires: [
      "Process Design",
      "Stakeholder Management",
      "Data Analysis",
      "Cross-functional Leadership",
      "OKR Frameworks",
      "Operational Excellence",
      "Executive Communication",
    ],
  },
  "Director of Revenue Operations": {
    color: "#D4A86A",
    description: "Aligns sales, marketing, and customer success operations to drive predictable revenue — owns the GTM tech stack and analytics.",
    openRolesLabel: "85 open roles match this path",
    requires: [
      "Revenue Operations",
      "Data Analysis",
      "Process Design",
      "Stakeholder Management",
      "SQL",
      "CRM Management",
      "Cross-functional Leadership",
      "OKR Frameworks",
    ],
  },
  "Head of Revenue Operations": {
    color: "#C4986A",
    description: "Builds RevOps from scratch or leads an established team — owns GTM systems, pipeline analytics, and forecasting.",
    openRolesLabel: "40 open roles match this path",
    requires: [
      "Revenue Operations",
      "Data Analysis",
      "Process Design",
      "Stakeholder Management",
      "SQL",
      "CRM Management",
      "Cross-functional Leadership",
      "Team Management",
    ],
  },
  "Director of Operations": {
    color: "#B49860",
    description: "Owns a company's operational engine — vendor management, process improvement, capacity planning, and team coordination.",
    openRolesLabel: "100 open roles match this path",
    requires: [
      "Operational Excellence",
      "Process Design",
      "Data Analysis",
      "Stakeholder Management",
      "Budget Management",
      "Cross-functional Leadership",
      "Team Management",
      "Change Management",
    ],
  },
  "VP of Operations": {
    color: "#A48850",
    description: "Senior ops leader — owns the P&L for operations, leads multiple teams, and drives scale efficiency across the company.",
    openRolesLabel: "42 open roles match this path",
    requires: [
      "Operational Excellence",
      "Process Design",
      "P&L Ownership",
      "Team Management",
      "Stakeholder Management",
      "Executive Communication",
      "Cross-functional Leadership",
      "Budget Management",
    ],
  },
  "General Manager": {
    color: "#C4574A",
    description: "Runs a P&L — owns revenue, cost, and all functions within a business unit, product line, or market.",
    openRolesLabel: "55 open roles match this path",
    requires: [
      "P&L Ownership",
      "Cross-functional Leadership",
      "Stakeholder Management",
      "Team Management",
      "Strategic Analysis",
      "Operational Excellence",
      "Executive Communication",
      "Budget Management",
    ],
  },
  "Chief Operating Officer": {
    color: "#A4473A",
    description: "Second-in-command — translates the CEO's vision into operational reality. Owns the company's execution engine.",
    openRolesLabel: "15 open roles match this path",
    requires: [
      "Operational Excellence",
      "P&L Ownership",
      "Cross-functional Leadership",
      "Team Management",
      "Executive Communication",
      "Strategic Analysis",
      "Process Design",
      "Board Communication",
    ],
  },
  "Head of Go-to-Market Strategy": {
    color: "#D4A870",
    description: "Defines and executes the GTM motion — market segmentation, pricing, launch strategy, and sales enablement.",
    openRolesLabel: "38 open roles match this path",
    requires: [
      "GTM Strategy",
      "Market Research",
      "Cross-functional Leadership",
      "Stakeholder Management",
      "Data Analysis",
      "Executive Communication",
      "Process Design",
    ],
  },
  "Director of Go-to-Market": {
    color: "#C4986A",
    description: "Owns the end-to-end launch and market entry playbook — partners with product, sales, and marketing.",
    openRolesLabel: "50 open roles match this path",
    requires: [
      "GTM Strategy",
      "Market Research",
      "Cross-functional Leadership",
      "Stakeholder Management",
      "Data Analysis",
      "Executive Communication",
    ],
  },
  "Head of Growth Operations": {
    color: "#B47860",
    description: "Analytical operator who runs growth experiments, scales what works, and builds the systems behind the growth engine.",
    openRolesLabel: "32 open roles match this path",
    requires: [
      "Data Analysis",
      "Process Design",
      "GTM Strategy",
      "Cross-functional Leadership",
      "Stakeholder Management",
      "OKR Frameworks",
      "A/B Testing",
    ],
  },
  "Head of Transformation": {
    color: "#A46850",
    description: "Leads large-scale change programs — org redesigns, technology overhauls, or culture initiatives that span years.",
    openRolesLabel: "22 open roles match this path",
    requires: [
      "Change Management",
      "Process Design",
      "Stakeholder Management",
      "Cross-functional Leadership",
      "Executive Communication",
      "Strategic Analysis",
      "OKR Frameworks",
    ],
  },
  /* ── PE / VC / Finance-Adjacent Track ─────────────────────── */
  "Operating Partner": {
    color: "#7A5BA6",
    description: "Partners with portfolio companies to accelerate value creation — typically a former operator brought in by a PE firm.",
    openRolesLabel: "12 open roles match this path",
    requires: [
      "Strategic Analysis",
      "Operational Excellence",
      "P&L Ownership",
      "Executive Communication",
      "Board Communication",
      "Team Management",
      "Cross-functional Leadership",
      "Financial Modeling",
    ],
  },
  "VP of Value Creation": {
    color: "#6A4B96",
    description: "PE platform role focused on driving growth and efficiency across the portfolio — hands-on operator inside a fund.",
    openRolesLabel: "8 open roles match this path",
    requires: [
      "Operational Excellence",
      "Strategic Analysis",
      "P&L Ownership",
      "Cross-functional Leadership",
      "Executive Communication",
      "Financial Modeling",
      "Board Communication",
    ],
  },
  "Head of Portfolio Operations": {
    color: "#8A6BB6",
    description: "Builds and runs the operational playbook across a PE firm's portfolio — improves execution at scale across companies.",
    openRolesLabel: "6 open roles match this path",
    requires: [
      "Operational Excellence",
      "Process Design",
      "Strategic Analysis",
      "Cross-functional Leadership",
      "Financial Modeling",
      "Stakeholder Management",
      "P&L Ownership",
    ],
  },
  "Chief of Staff, Private Equity": {
    color: "#5A3B86",
    description: "Supports a Managing Director or Partner — manages LP communications, deal flow coordination, and fund operations.",
    openRolesLabel: "10 open roles match this path",
    requires: [
      "Stakeholder Management",
      "Executive Communication",
      "Strategic Analysis",
      "Financial Modeling",
      "Cross-functional Leadership",
      "Process Design",
      "Board Communication",
    ],
  },
  "Principal, Strategy & Operations": {
    color: "#9A7BC6",
    description: "Senior consulting-adjacent or PE-adjacent role focused on complex strategy and operations mandates.",
    openRolesLabel: "18 open roles match this path",
    requires: [
      "Strategic Analysis",
      "Financial Modeling",
      "Data Analysis",
      "Stakeholder Management",
      "Executive Communication",
      "Cross-functional Leadership",
      "Process Design",
    ],
  },
};

export const AVAILABLE_ROLES = Object.keys(ROLE_ARCHETYPES);

/* ── Upskill categories ────────────────────────────────────── */
export interface UpskillItem {
  id: number;
  platform: string;
  platformInitial: string;
  platformColor: string;
  name: string;
  duration: string;
  credential: string;
  scoutPick: boolean;
  why: string;
  /** Skill from ROLE_ARCHETYPES that this course helps close.
   *  If the user is missing this skill for any of their dream roles, the
   *  Learning tab will show "Closes your gap: <skill>" on the card. */
  closesGap?: string;
}

export interface UpskillCategory {
  title: string;
  subtitle: string;
  items: UpskillItem[];
}

export const UPSKILL_CATEGORIES: UpskillCategory[] = [
  {
    title: "Fill your skill gaps",
    subtitle: "Targeted courses for the skills most commonly missing from senior candidates",
    items: [
      {
        id: 0,
        platform: "Coursera",
        platformInitial: "C",
        platformColor: "#0056D2",
        name: "Strategic Management & Planning",
        duration: "8 weeks",
        credential: "Certificate",
        scoutPick: true,
        why: "Covers competitive analysis, market entry, and executive decision-making frameworks used in Strategy roles at top companies.",
        closesGap: "Strategic Analysis",
      },
      {
        id: 1,
        platform: "Wall Street Prep",
        platformInitial: "W",
        platformColor: "#1B3A6B",
        name: "Financial Modeling & Valuation",
        duration: "60 hours",
        credential: "Certificate",
        scoutPick: true,
        why: "The industry standard for financial modeling — covers DCF, LBO, and M&A analysis used in CorpDev and FP&A roles.",
        closesGap: "Financial Modeling",
      },
      {
        id: 2,
        platform: "Reforge",
        platformInitial: "R",
        platformColor: "#000000",
        name: "Product Strategy",
        duration: "6 weeks",
        credential: "Certificate",
        scoutPick: true,
        why: "Built for senior PMs — covers bet-sizing, market strategy, and how to think about product direction at scale.",
        closesGap: "Product Strategy",
      },
      {
        id: 3,
        platform: "LinkedIn Learning",
        platformInitial: "in",
        platformColor: "#0A66C2",
        name: "Stakeholder Management & Influence",
        duration: "3h 45m",
        credential: "Badge",
        scoutPick: true,
        why: "Stakeholder management is the #1 competency gap in senior-level interviews across every role track.",
        closesGap: "Stakeholder Management",
      },
    ],
  },
  {
    title: "Get certified",
    subtitle: "Credentials that signal depth and show up on recruiter screens",
    items: [
      {
        id: 4,
        platform: "Google",
        platformInitial: "G",
        platformColor: "#4285F4",
        name: "Project Management Certificate",
        duration: "6 months",
        credential: "Certificate",
        scoutPick: true,
        why: "Covers OKR frameworks, project planning, and stakeholder communication — recognized across all major employers.",
        closesGap: "OKR Frameworks",
      },
      {
        id: 5,
        platform: "Coursera",
        platformInitial: "C",
        platformColor: "#0056D2",
        name: "Lean Six Sigma Green Belt",
        duration: "4 months",
        credential: "Certificate",
        scoutPick: false,
        why: "Process improvement certification with strong signal value in Ops, BizOps, and transformation roles.",
        closesGap: "Process Design",
      },
      {
        id: 6,
        platform: "HBX Online",
        platformInitial: "H",
        platformColor: "#A51C30",
        name: "Business Analytics",
        duration: "8 weeks",
        credential: "Certificate",
        scoutPick: true,
        why: "Harvard-backed credential covering data analysis, regression, and decision modeling for non-technical managers.",
        closesGap: "Data Analysis",
      },
      {
        id: 7,
        platform: "Prosci",
        platformInitial: "P",
        platformColor: "#E85D04",
        name: "Change Management Certification",
        duration: "3 days",
        credential: "Certification",
        scoutPick: false,
        why: "The ADKAR model from Prosci is a recognized standard in enterprise transformation and large-scale change programs.",
        closesGap: "Change Management",
      },
    ],
  },
  {
    title: "Build your execution edge",
    subtitle: "Skills that separate candidates who can talk strategy from those who can run it",
    items: [
      {
        id: 8,
        platform: "Mode Analytics",
        platformInitial: "M",
        platformColor: "#4E6AF6",
        name: "SQL for Analytics",
        duration: "10 hours",
        credential: "Badge",
        scoutPick: true,
        why: "SQL fluency is now expected at Senior Manager+ in Strategy, Ops, and PM roles — especially at data-forward companies.",
        closesGap: "SQL",
      },
      {
        id: 9,
        platform: "Coursera",
        platformInitial: "C",
        platformColor: "#0056D2",
        name: "Executive Communication & Presence",
        duration: "4 weeks",
        credential: "Certificate",
        scoutPick: false,
        why: "Board-ready communication and executive presence is consistently cited as a gap in promotion feedback for Director+ candidates.",
        closesGap: "Executive Communication",
      },
      {
        id: 10,
        platform: "Pragmatic Institute",
        platformInitial: "PI",
        platformColor: "#006BB6",
        name: "Market & Competitive Intelligence",
        duration: "2 days",
        credential: "Badge",
        scoutPick: false,
        why: "Covers customer research, competitive positioning, and market sizing — foundational for BD and corporate strategy roles.",
        closesGap: "Market Research",
      },
      {
        id: 11,
        platform: "LinkedIn Learning",
        platformInitial: "in",
        platformColor: "#0A66C2",
        name: "Managing Teams & Driving Results",
        duration: "4h 20m",
        credential: "Badge",
        scoutPick: false,
        why: "Director+ roles require demonstrated team management — covers delegation, performance management, and leading through change.",
        closesGap: "Team Management",
      },
    ],
  },
];

/* ── Notifications ─────────────────────────────────────────── */
export type Section = "opportunities" | "profile" | "coaching" | "network" | "live" | "admin" | "clients";

export interface Notification {
  id: number;
  type: "role" | "deadline" | "insight" | "update";
  company: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  section: Section;
}

export const NOTIFICATIONS: Notification[] = [];
