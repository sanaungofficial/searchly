const JOBS = [
  {
    role: 'Senior PM — Revenue Recognition', company: 'Stripe',
    location: 'San Francisco, CA · Hybrid', salary: '$185–230k + equity',
    fitScore: 91, fitLabel: 'Strong match',
    fitSummary: "Stripe is hiring for a Senior PM to own its revenue recognition product — squarely in your wheelhouse. Your background in data-driven decisions and cross-functional leadership aligns well with how Stripe builds. Eight years in SaaS gives you the pattern recognition they value.",
    fitWorks: ["Strong SaaS product background with measurable revenue impact", "Experience collaborating with engineering on API-adjacent surfaces", "Data literacy and comfort with financial product metrics"],
    fitWatches: ["Payments domain depth isn't explicit on your resume — worth surfacing adjacent experience", "Stripe values technical PMs — your engineering framing will matter here"],
    keywords: [
      { kw: 'Revenue recognition', matched: false }, { kw: 'API-first', matched: true },
      { kw: 'Financial infrastructure', matched: false }, { kw: 'Cross-functional leadership', matched: true },
      { kw: 'B2B SaaS', matched: true }, { kw: 'Data-driven decisions', matched: true },
      { kw: 'Payments infrastructure', matched: false }, { kw: 'Stakeholder alignment', matched: true },
    ],
    bullets: [
      { original: "Led product development for core payment flows across three platform teams", tailored: "Owned payments infrastructure product strategy across three platform teams, driving API-first decisions that increased transaction reliability by 34%" },
      { original: "Collaborated with engineering on API design and developer experience", tailored: "Partnered with engineering to deliver API-first product changes, reducing integration time for B2B SaaS customers by 40%" },
    ],
    coverLetter: "Dear Hiring Manager,\n\nWhen I look at what Stripe is building with revenue recognition, I see a problem I've spent years thinking about from the other side — the product manager trying to understand why revenue looks the way it does, and working backward to fix it.\n\nMy eight years in SaaS product have been shaped by a conviction that financial data should make decisions easier, not harder. At my most recent role, I led a cross-functional team of twelve to rebuild our reporting infrastructure — the kind of unglamorous, load-bearing work that Stripe does exceptionally well.\n\nI'm drawn to Stripe not just because of the scale, but because of the discipline. The way your team thinks about API design, about the long-term cost of technical decisions — that's how I try to think about product.\n\nI'd love to talk about what this role is trying to solve in the next twelve months.\n\nWarm regards,\nSarah Chen",
    gaps: [
      { title: 'Payments domain depth', body: "Your resume doesn't surface direct payments experience. Even adjacent exposure — reconciliation, billing, financial reporting — would be worth pulling forward explicitly.", fix: "Add a line to your summary naming financial or revenue surface areas you've touched. One sentence signals literacy to a Stripe recruiter." },
      { title: 'Technical PM framing', body: "Stripe PMs are expected to have strong technical instincts. Your resume reads business-forward rather than technically curious.", fix: "Revise 1–2 bullets to name specific technical choices you influenced — API design decisions, infrastructure tradeoffs, architecture reviews you participated in." },
    ],
  },
  {
    role: 'Product Lead', company: 'Linear',
    location: 'Remote (US)', salary: '$170–210k + equity',
    fitScore: 87, fitLabel: 'Strong match',
    fitSummary: "Linear is a focused team that builds for a demanding audience — developers who care deeply about craft. Your cross-functional leadership and product strategy experience translate well. The challenge: Linear PMs are expected to be genuinely opinionated about developer workflow.",
    fitWorks: ["Strategic product thinking aligned with Linear's long-horizon approach", "Experience leading without authority across engineering-heavy organizations", "Clear writer — Linear's async writing culture will value this"],
    fitWatches: ["No developer tools background on record — harder to fake with this audience", "Linear is small and flat; big-company coordination skills may not map directly"],
    keywords: [
      { kw: 'Developer tools', matched: false }, { kw: 'Product-led growth', matched: true },
      { kw: 'Opinionated UX', matched: false }, { kw: 'Async-first', matched: false },
      { kw: 'Cross-functional', matched: true }, { kw: 'Product strategy', matched: true },
      { kw: 'Roadmap planning', matched: true }, { kw: 'Engineering collaboration', matched: true },
    ],
    bullets: [
      { original: "Defined and executed quarterly product roadmaps across three product lines", tailored: "Owned product strategy and roadmap planning for three core surfaces, operating async-first with a cross-functional team of engineers and designers" },
      { original: "Improved user onboarding flow resulting in 28% better activation", tailored: "Redesigned onboarding with opinionated UX principles — 28% activation improvement among product-led growth cohorts" },
    ],
    coverLetter: "Dear Linear team,\n\nI've been a Linear user for two years. I use it daily, I notice when things change, and I have opinions about why those changes were right or wrong — which I suspect is exactly the kind of candidate you're looking for.\n\nAs a Product Lead, I've spent my career in the uncomfortable middle: between what engineers want to build and what customers actually need, between long-term vision and quarterly reality. Linear's bet — that you can do both by being ruthlessly opinionated — is one I share.\n\nWhat I'd bring is eight years of practice saying no to the right things. Of keeping products coherent under pressure.\n\nI'd love to talk about what this role is working on in the next six months.\n\nBest,\nSarah Chen",
    gaps: [
      { title: 'Developer tools experience', body: "Linear's users are developers. Without surfacing experience building for technical users, this application will feel generic next to candidates who have it.", fix: "Surface any product work aimed at developers, engineers, or technical workflows — internal tools count. If none, lead your cover letter with a clear POV on developer UX." },
    ],
  },
  {
    role: 'Design Systems PM', company: 'Figma',
    location: 'New York, NY · Hybrid', salary: '$175–215k + equity',
    fitScore: 84, fitLabel: 'Good fit',
    fitSummary: "Figma's design systems PM role sits at the intersection of design tooling and developer infrastructure. Your cross-functional experience is genuinely relevant, but the role requires depth in design systems thinking that isn't yet visible in your profile.",
    fitWorks: ["Strong stakeholder alignment — design systems work is mostly internal adoption", "Cross-functional leadership across design and engineering is precisely what this needs", "Product strategy chops will help navigate the complexity of platform PM work"],
    fitWatches: ["Design systems domain depth isn't evident — this is a specialized discipline", "Figma values design craft; your resume skews toward business outcomes over design quality"],
    keywords: [
      { kw: 'Design systems', matched: false }, { kw: 'Component libraries', matched: false },
      { kw: 'Design tokens', matched: false }, { kw: 'Internal adoption', matched: false },
      { kw: 'Cross-functional', matched: true }, { kw: 'Platform PM', matched: false },
      { kw: 'Stakeholder alignment', matched: true },
    ],
    bullets: [
      { original: "Partnered with design team on product UI improvements", tailored: "Drove cross-functional alignment between design and engineering to establish component library adoption across four product surfaces, reducing design debt by 30%" },
    ],
    coverLetter: "Dear Figma team,\n\nDesign systems are the quiet infrastructure that makes great products possible — and one of the hardest things to get right, because the people who need them most rarely own the roadmap.\n\nI've spent years sitting at the intersection of design and engineering, often as the person translating between them. I've seen what happens when that translation breaks — the inconsistencies that accumulate, the one-off components, the designer-developer friction that slows everything down.\n\nI'd bring that understanding to Figma's design systems work: not just as a user of the tools, but as someone who has lived the problem the tools are trying to solve.\n\nBest,\nSarah Chen",
    gaps: [
      { title: 'Design systems domain knowledge', body: "Without explicit design systems experience — tokens, component governance, adoption metrics — your application will struggle against specialists.", fix: "If you've worked with a design system in any capacity, name it explicitly. Otherwise, lead your cover letter with a sharp POV on design systems strategy." },
      { title: 'Design craft signal', body: "Figma hires people who genuinely care about design quality. Your resume is outcomes-focused — but here you need to signal design sensibility too.", fix: "Add one bullet about a visual consistency or design quality decision you influenced — not just shipping velocity or revenue impact." },
    ],
  },
];

const COMPANIES = [
  { id:0, name:'Stripe', initials:'ST', industry:'Fintech', stage:'Late-stage private', size:'8,000+', fit:91, suggestedBy:'scout', fitReason:"Your API-first product experience and financial data background are a strong signal for Stripe's PM roles.", description:"Stripe builds economic infrastructure for the internet — tools that help millions of businesses accept payments and scale globally.", openRoles:[{ id:0, title:'Senior PM — Revenue Recognition', dept:'Product', posted:'2 days ago', match:91, jobRef:0 }] },
  { id:1, name:'Linear', initials:'LN', industry:'Developer Tools', stage:'Series C', size:'80', fit:87, suggestedBy:'scout', fitReason:"Linear builds for opinionated, craft-focused teams — exactly the environment your async-first leadership style thrives in.", description:"Linear is a purpose-built software project management tool used by the world's best product teams. Focused, fast, and opinionated.", openRoles:[{ id:0, title:'Product Lead', dept:'Product', posted:'5 days ago', match:87, jobRef:1 }] },
  { id:2, name:'Figma', initials:'FG', industry:'Design Tools', stage:'Public', size:'1,400+', fit:84, suggestedBy:'user', fitReason:"Your cross-functional leadership between design and engineering maps well to Figma's internal platform work.", description:"Figma is a collaborative design platform used by teams to create, prototype, and develop products together in real time.", openRoles:[{ id:0, title:'Design Systems PM', dept:'Platform', posted:'1 week ago', match:84, jobRef:2 }] },
  { id:3, name:'Notion', initials:'NO', industry:'Productivity', stage:'Series C', size:'600+', fit:82, suggestedBy:'scout', fitReason:"Notion values PMs who think about knowledge infrastructure at scale — your systems thinking is a natural fit.", description:"Notion is an all-in-one workspace for notes, tasks, wikis, and databases — used by over 30 million people worldwide.", openRoles:[] },
  { id:4, name:'Vercel', initials:'VC', industry:'Dev Infrastructure', stage:'Series D', size:'400+', fit:79, suggestedBy:'scout', fitReason:"Vercel is expanding its PM team for developer-facing infrastructure — your technical positioning could translate well here.", description:"Vercel provides the frontend cloud infrastructure and the Next.js framework — powering teams at Netflix, Uber, and thousands of startups.", openRoles:[{ id:0, title:'Platform PM — Edge Network', dept:'Infrastructure', posted:'3 days ago', match:79, jobRef:null }] },
];

const UPSKILL_CATEGORIES = [
  { title:'Fill your gaps', subtitle:'Based on what your target companies screen for right now', items:[
    { id:0, platform:'Coursera', platformInitial:'C', platformColor:'#0056D2', name:'AI for Product Managers', duration:'6 weeks', credential:'Certificate', scoutPick:true, why:'AI product literacy is now expected in PM interviews at Stripe, Figma, and Notion.' },
    { id:1, platform:'LinkedIn Learning', platformInitial:'in', platformColor:'#0A66C2', name:'Managing & Influencing Teams', duration:'4h 20m', credential:'Badge', scoutPick:true, why:'Builds the direct-reports narrative that is currently thin on your resume.' },
  ]},
  { title:'Get certified', subtitle:'Credentials that signal technical depth to engineering-forward companies', items:[
    { id:2, platform:'AWS', platformInitial:'aws', platformColor:'#FF9900', name:'Cloud Practitioner Essentials', duration:'6h', credential:'Certification', scoutPick:false, why:'Stripe and Vercel value PMs who can reason about infrastructure tradeoffs and costs.' },
    { id:3, platform:'Google', platformInitial:'G', platformColor:'#4285F4', name:'Project Management Certificate', duration:'6 months', credential:'Certificate', scoutPick:true, why:'Recognized across all your target companies — strong baseline credentialing.' },
  ]},
  { title:'Strengthen your presence', subtitle:'Quick wins that increase recruiter visibility and inbound interest', items:[
    { id:4, platform:'Scout', platformInitial:'S', platformColor:'#1A3A2F', name:'LinkedIn Profile Audit', duration:'20 min', credential:'Recommendations', scoutPick:true, why:'Scout identified 4 specific improvements that could double your inbound recruiter reach.' },
    { id:5, platform:'Scout', platformInitial:'S', platformColor:'#1A3A2F', name:'Portfolio Case Study Guide', duration:'1 week', credential:'Project', scoutPick:true, why:'Figma and Linear both value candidates with visible, written product thinking.' },
  ]},
];

const INSIDERS = [
  { id:0, name:'Jamie Chen', initials:'JC', role:'Senior PM', company:'Stripe', rate:150, available:true, bio:'Led Stripe Billing for 3 years. Happy to talk positioning, interview prep, and what the team actually values in candidates.' },
  { id:1, name:'Marcus Webb', initials:'MW', role:'Engineering Lead', company:'Stripe', rate:200, available:false, bio:'Built Stripe\'s revenue recognition engine. Great for understanding the technical bar and what PM-engineer partnership looks like there.' },
  { id:2, name:'Priya Nair', initials:'PN', role:'Director of Product', company:'Linear', rate:180, available:true, bio:'Part of Linear\'s founding product team. Knows exactly what they screen for and what gets people hired.' },
  { id:3, name:'Alex Kim', initials:'AK', role:'Design Systems Lead', company:'Figma', rate:160, available:true, bio:'Runs design systems at Figma. Can walk you through the PM role expectations, hiring bar, and team culture.' },
  { id:4, name:'Sofia Park', initials:'SP', role:'VP Product', company:'Notion', rate:240, available:false, bio:'Former PM at Google, now VP at Notion. Specializes in helping senior ICs make the leap to director-track roles.' },
];

const MY_CONTACTS = [
  { id:0, initials:'TL', name:'Tom Liu', role:'VP Product', company:'Notion', degree:'1st', mutual:5, warmth:'hot', lastTouched:'2 weeks ago', note:'Worked together at DataFlow. Tom leads the creator product suite. Strong referral path into Notion PM roles.', hiveMind:true, hmOpenRoles:1, hmFee:'$2,200', hmSuccessRate:88, hmVerified:true },
  { id:1, initials:'MR', name:'Maya Rodriguez', role:'Head of Product', company:'Stripe', degree:'2nd', mutual:3, warmth:'warm', lastTouched:'3 months ago', note:'3 mutual connections. Maya oversees Stripe\'s payments PM team — direct path into open roles.', hiveMind:true, hmOpenRoles:2, hmFee:'$2,800', hmSuccessRate:91, hmVerified:true },
  { id:2, initials:'JP', name:'James Park', role:'Staff Engineer', company:'Linear', degree:'1st', mutual:2, warmth:'warm', lastTouched:'1 month ago', note:'Former colleague. Now at Linear. Not recruiting but could make a warm intro to the PM team.', hiveMind:false, hmOpenRoles:0, hmFee:null, hmSuccessRate:0, hmVerified:false },
  { id:3, initials:'AO', name:'Aisha Okafor', role:'Director of Product', company:'Vercel', degree:'2nd', mutual:4, warmth:'cool', lastTouched:'6 months ago', note:'4 mutual connections. Aisha recently moved to Vercel as a Director — cold but reachable.', hiveMind:false, hmOpenRoles:0, hmFee:null, hmSuccessRate:0, hmVerified:false },
];
const DISCOVERED_MEMBERS = [
  { id:10, initials:'SK', name:'Sarah K.', role:'Senior PM', company:'Stripe', degree:'platform', warmth:'discovered', lastTouched:'New', note:'Second Ladder platform member. 3 mutual connections.', hiveMind:true, hmOpenRoles:2, hmFee:'$2,400', hmSuccessRate:87, hmVerified:true },
  { id:11, initials:'BJ', name:'Ben J.', role:'Engineering Manager', company:'Notion', degree:'platform', warmth:'discovered', lastTouched:'New', note:'Second Ladder platform member. Referred 4 people into Notion.', hiveMind:true, hmOpenRoles:1, hmFee:'$1,800', hmSuccessRate:92, hmVerified:true },
  { id:12, initials:'PT', name:'Priya T.', role:'Product Lead', company:'Figma', degree:'platform', warmth:'discovered', lastTouched:'New', note:'Second Ladder platform member. 2 open slots at Figma.', hiveMind:true, hmOpenRoles:2, hmFee:'$2,100', hmSuccessRate:79, hmVerified:false },
  { id:13, initials:'RW', name:'Ryan W.', role:'Group PM', company:'Vercel', degree:'platform', warmth:'discovered', lastTouched:'New', note:'Second Ladder platform member. Specializes in PM→Director referrals.', hiveMind:true, hmOpenRoles:1, hmFee:'$3,000', hmSuccessRate:94, hmVerified:true },
];

const HIVE_MIND = [
  { id:0, initials:'SK', name:'Sarah K.', role:'PM', company:'Stripe', openRoles:2, referralFee:'$2,400', successRate:87, verified:true },
  { id:1, initials:'BJ', name:'Ben J.', role:'Engineering Manager', company:'Notion', openRoles:1, referralFee:'$1,800', successRate:92, verified:true },
  { id:2, initials:'LM', name:'Laura M.', role:'Head of Design', company:'Figma', openRoles:3, referralFee:'$3,100', successRate:78, verified:false },
  { id:3, initials:'RC', name:'Ryan C.', role:'Staff PM', company:'Linear', openRoles:1, referralFee:'$2,200', successRate:95, verified:true },
];

const COACHES = [
  { id:0, name:'Jeremy Scharf', initials:'JS', role:'ex-Bain Interviewer · MBB Case Expert', workedAt:['Bain & Company'], studiedAt:'MIT Sloan', rate:429, reviewCount:160, rating:5.0, minutes:70665, available:'Jun 22', featured:true, specialties:['Case Interviews','Executive Presence','Director Track'], bio:'Part of Bain\'s interview team for 4 years. 150+ MBB offers. Specializes in helping senior PMs build the exec presence for Director+ transitions.', companies:['Bain','McKinsey','BCG','Deloitte'] },
  { id:1, name:'Ian G.', initials:'IG', role:'Top 10 Global · 95% Success Rate', workedAt:['Boston Consulting Group'], studiedAt:'NYU Stern MBA', rate:399, reviewCount:65, rating:5.0, minutes:28200, available:'Jun 22', featured:true, specialties:['PM Interviews','Behavioral','Comp Negotiation'], bio:'Passed all 8 consulting interviews during MBA. BCG consultant turned coach. $2,556 in free prep materials included.', companies:['BCG','Stripe','Notion'] },
  { id:2, name:'Rachel Torres', initials:'RT', role:'PM Career Specialist · ex-Meta', workedAt:['Meta','Second Ladder'], studiedAt:'Stanford MBA', rate:95, reviewCount:48, rating:4.9, minutes:12400, available:'Today', featured:false, specialties:['Senior PM','Director Transition','Resume'], bio:'Former Meta PM turned full-time coach. Specializes in mid-career PMs landing Director-track roles at top-tier companies.', companies:['Meta','Stripe','Linear','Figma'] },
  { id:3, name:'Michael Chen', initials:'MC', role:'Tech Recruiter · ex-Google', workedAt:['Google','Stripe'], studiedAt:'UC Berkeley', rate:80, reviewCount:31, rating:4.8, minutes:8900, available:'Jun 24', featured:false, specialties:['Resume ATS','Recruiter POV','Offer Negotiation'], bio:'8 years recruiting for Google and Stripe. Shows you exactly what recruiters screen for and how to get past ATS filters.', companies:['Google','Stripe','Vercel'] },
];

const LIVE_SESSIONS = [
  { id:0, isMiraWeekly:true, isLive:false, startsIn:'Tomorrow · 12:00 PM EDT', date:'Jun 25, 2026', time:'12:00 PM – 1:00 PM EDT', registered:124, host:'Mira Singh', hostInitials:'MS', hostRole:'Career Coach · Second Ladder', hostRating:4.9, hostReviews:142, title:'Job Search Strategy: Weekly Q&A', description:'Open Q&A on job search tactics, positioning, and getting in front of the right people. Mira covers what\'s actually working right now — from resume framing to outreach scripts to navigating the ATS.', category:'Job Search', bgColor:'#1A3A2F', accentColor:'#E8D5A3' },
  { id:1, isMiraWeekly:false, isLive:false, startsIn:'In 2 days', date:'Jun 26, 2026', time:'3:00 PM – 4:00 PM EDT', registered:89, host:'Rachel Torres', hostInitials:'RT', hostRole:'PM Career Specialist · ex-Meta', hostRating:4.9, hostReviews:48, title:'Senior PM → Director: What Actually Changes', description:'The jump from Senior PM to Director isn\'t about doing more — it\'s about doing different. Rachel breaks down exactly what hiring managers screen for at this level.', category:'Career Transition', bgColor:'#2D1F52', accentColor:'#C4B8E8' },
  { id:2, isMiraWeekly:false, isLive:false, startsIn:'In 3 days', date:'Jun 27, 2026', time:'11:00 AM – 11:45 AM EDT', registered:203, host:'Michael Chen', hostInitials:'MC', hostRole:'Tech Recruiter · ex-Google', hostRating:4.8, hostReviews:31, title:'How Stripe and Linear Actually Read Your Resume', description:'An insider look at how top-tier tech companies parse resumes before a human ever sees them — and what you can change this week to get through.', category:'Resume', bgColor:'#1A2E4A', accentColor:'#B8D4E8' },
  { id:3, isMiraWeekly:false, isLive:false, startsIn:'In 4 days', date:'Jun 28, 2026', time:'2:00 PM – 3:00 PM EDT', registered:67, host:'Jeremy Scharf', hostInitials:'JS', hostRole:'ex-Bain Interviewer · MBB Case Expert', hostRating:5.0, hostReviews:160, title:'Director-Track Interviews: What MBB Actually Looks For', description:'Live mock interview debrief. Jeremy walks through the most common failure modes for senior candidates transitioning to Director-level and how to avoid them.', category:'Interviews', bgColor:'#3A1A1A', accentColor:'#E8C4B8' },
  { id:4, isMiraWeekly:false, isLive:true, startsIn:'Live now', date:'Jun 19, 2026', time:'2:30 PM – 3:15 PM EDT', registered:341, host:'Mira Singh', hostInitials:'MS', hostRole:'Career Coach · Second Ladder', hostRating:4.9, hostReviews:142, title:'The Offer Negotiation Playbook: Getting to Yes', description:'A live walkthrough of the exact scripts and frameworks Mira uses with clients to negotiate compensation packages — including base, equity, and signing.', category:'Negotiation', bgColor:'#1A3A2F', accentColor:'#E8D5A3' },
];

const PROFILE_SUGGESTIONS = [
  { id:0, priority:'high', category:'LinkedIn', title:'Sharpen your headline', detail:'Current: "Senior PM at TechCorp" → Try: "Senior PM · Revenue · API-first · SaaS | Open to Director-track"', impact:'High recruiter visibility' },
  { id:1, priority:'high', category:'Resume', title:'Add metrics to 3 bullets', detail:'Your Work Experience reads well but runs thin on numbers. Recruiters at Stripe and Linear scan for quantified impact first.', impact:'Stronger first impression' },
  { id:2, priority:'medium', category:'Skills', title:'Add API-first + Revenue Ops', detail:'These exact terms appear in 4 of your 5 target role descriptions. Neither is on your current resume or LinkedIn skills.', impact:'Better ATS keyword matching' },
  { id:3, priority:'medium', category:'LinkedIn', title:'Rewrite your About hook', detail:'Your first two lines don\'t grab. Recruiters decide in 2 sentences before tapping "See more" — make them count.', impact:'Better profile engagement' },
  { id:4, priority:'low', category:'Resume', title:'Add a technical skills bar', detail:'Even a brief line (SQL, Amplitude, Figma, JIRA) signals PM-engineer fluency to Stripe and Vercel.', impact:'Technical credibility signal' },
];

const WORK_EXP = [
  { company:'TechCorp', role:'Senior Product Manager, Revenue Products', period:'2021 → Present', bullets:['Led cross-functional team of 12 to rebuild revenue reporting infrastructure, reducing time-to-insight by 60%','Drove API-first product decisions resulting in 34% platform reliability improvement','Owned roadmap for 3 core product surfaces serving 40k+ enterprise customers'] },
  { company:'DataFlow Inc', role:'Product Manager', period:'2018 → 2021', bullets:['Launched 4 new product features 0→1, each reaching $1M+ ARR within 12 months','Partnered with engineering on API redesign reducing customer integration time by 40%'] },
  { company:'StartupXYZ', role:'Associate Product Manager', period:'2016 → 2018', bullets:['Built core analytics dashboard used by 500+ customers across 3 verticals','Managed product backlog and sprint planning for 6-person engineering team'] },
];

const EDUCATION_LIST = [
  { school:'Stanford Graduate School of Business', degree:'MBA', period:'2014 → 2016' },
  { school:'UC Berkeley', degree:'B.S. Computer Science', period:'2010 → 2014' },
];

const SKILLS_LIST = ['Product Strategy','Data Analysis','Cross-functional Leadership','Stakeholder Management','Roadmap Planning','SaaS','UX Research','SQL','Amplitude','A/B Testing'];
const SKILLS_SUGGESTED = ['API-first','Revenue Operations','Payments Infrastructure'];

const NETWORK_PEOPLE = [
  { id:0, name:'Tom Liu', initials:'TL', role:'VP Product', company:'Notion', degree:'1st', mutual:5, warmth:'hot', note:'You worked together at DataFlow. Tom moved to Notion 2 years ago and leads their PM org.', draft:"Hi Tom! It's been a while since DataFlow — hope things are going well at Notion. I've been doing a lot of work on knowledge infrastructure products and keep coming back to how well Notion approaches this. I'm exploring PM roles and Notion is high on my list. Would love to grab 20 minutes to hear how it's been on your end." },
  { id:1, name:'Maya Rodriguez', initials:'MR', role:'Head of Product', company:'Stripe', degree:'2nd', mutual:3, warmth:'warm', note:'3 mutual connections including your Stanford classmate James Park.', draft:"Hi Maya, I came across your work on Stripe's revenue product team through a mutual connection (James Park). I'm actively exploring senior PM roles and Stripe is at the top of my list. Would you be open to a 20-minute conversation? I'd love to hear your perspective on what makes a strong candidate for the team." },
  { id:2, name:'Kevin Zhang', initials:'KZ', role:'Senior PM', company:'Linear', degree:'2nd', mutual:1, warmth:'warm', note:'1 mutual: Sarah Kim, who you met at ProductCon 2023.', draft:"Hi Kevin — Sarah Kim mentioned you'd be a great person to talk to about Linear. I'm a huge fan and have been doing PM work in async-first environments for a few years. Exploring opportunities and would love to learn more about the culture. 15 minutes would be amazing if you're open." },
  { id:3, name:'Aisha Johnson', initials:'AJ', role:'Product Director', company:'Figma', degree:'3rd', mutual:0, warmth:'cold', note:'No direct path — but Scout can draft a warm cold note that stands out.', draft:"Hi Aisha, I came across your work at Figma and have been thinking deeply about the design systems PM space. I'm a Senior PM exploring director-track opportunities and Figma's platform work resonates with where I want to go. I know this is a cold message — I'd genuinely just love 15 minutes if you're open to it." },
];

const ROLE_ARCHETYPES = {
  'VP of Product': {
    color: '#4A8B6A',
    description: 'Leads the entire product org, owns product strategy and roadmap across multiple product lines. Typically reports to CEO.',
    openRolesLabel: '12 open roles match this path',
    requires: ['Product Strategy', 'Roadmap Planning', 'Cross-functional Leadership', 'Stakeholder Management', 'Team Management', 'P&L Ownership', 'Executive Communication', 'Org Design'],
  },
  'Chief Product Officer': {
    color: '#C4574A',
    description: 'C-suite executive responsible for all product decisions, company vision alignment, and full product org leadership.',
    openRolesLabel: '4 open roles match this path',
    requires: ['Product Strategy', 'Executive Leadership', 'P&L Ownership', 'Board Communication', 'Company Strategy', 'Team Building', 'GTM Strategy', 'Investor Relations'],
  },
  'Head of Product Operations': {
    color: '#C4A86A',
    description: 'Enables the product team through systems, analytics, processes, and cross-functional coordination.',
    openRolesLabel: '8 open roles match this path',
    requires: ['Data Analysis', 'Cross-functional Leadership', 'Roadmap Planning', 'SQL', 'Amplitude', 'Process Design', 'OKR Frameworks', 'PM Enablement'],
  },
  'Director of Product': {
    color: '#5B7FA6',
    description: 'Senior PM leader owning a major product area or platform, managing a team of PMs.',
    openRolesLabel: '18 open roles match this path',
    requires: ['Product Strategy', 'Roadmap Planning', 'Stakeholder Management', 'Cross-functional Leadership', 'Data Analysis', 'Team Management', 'Mentorship'],
  },
  'Group Product Manager': {
    color: '#7A5BA6',
    description: 'Senior IC PM managing a group of related products, often mentoring junior PMs.',
    openRolesLabel: '24 open roles match this path',
    requires: ['Product Strategy', 'Roadmap Planning', 'Stakeholder Management', 'Cross-functional Leadership', 'Data Analysis', 'A/B Testing', 'UX Research'],
  },
};
const AVAILABLE_ROLES = Object.keys(ROLE_ARCHETYPES);

const KANBAN_STAGES = ['saved','applied','interview','offer','closed'];
const STAGE_LABELS = { saved:'Saved', applied:'Applied', interview:'Interviewing', offer:'Offer', closed:'Closed' };
const STAGE_COLORS = { saved:'#8A8278', applied:'#5B7FA6', interview:'#C4A86A', offer:'#4A8B6A', closed:'rgba(26,26,26,0.4)' };

const NOTIFICATIONS = [
  { id:0, type:'role', company:'Notion', title:'New matching role found', body:'Head of Product Operations — 82% match. Scout surfaced this 2 minutes ago.', time:'Just now', unread:true, section:'opportunities' },
  { id:1, type:'deadline', company:'Stripe', title:'Application window closing', body:'Revenue recognition role closes in 5 days. Your application package is ready.', time:'1h ago', unread:true, section:'opportunities' },
  { id:2, type:'insight', company:'Scout', title:'Profile strength increased', body:'Your LinkedIn profile strength went from 65% → 72% based on recent updates.', time:'3h ago', unread:false, section:'profile' },
  { id:3, type:'update', company:'Linear', title:'Compensation updated', body:'Linear bumped their Product Lead salary range to $170–220k + equity.', time:'Yesterday', unread:false, section:'opportunities' },
];

const CANNED = {
  0: ["For Stripe, lead with experience making financial data legible to decision-makers — that's the core of what a revenue recognition PM does.", "The biggest unlock is framing 1–2 bullets around technical decisions you influenced, even indirectly. Stripe screens hard for PM-engineer trust.", "Your reliability improvement metric is strong. Be ready to go deep on how you measured it and who you partnered with on the engineering side."],
  1: ["For Linear, authenticity wins over polish. They want genuine opinions about how developer tools should work — lean into that in everything you write.", "The async-first framing is right. If you've championed written specs or async practices, name specific examples.", "Linear hires for multiplier effect. Frame your leadership around how you made others faster, not just what you shipped."],
  2: ["Figma's design systems role is mostly an internal influence game — getting design and eng to adopt components they didn't build. That's your wheelhouse.", "Open the cover letter with a specific observation about Figma's own design system — what you'd prioritize. It signals you've done the homework.", "One bullet about a design quality or consistency decision you influenced would move this application significantly."],
};

class Component extends DCLogic {
  state = {
    activeSection: 'opportunities',
    liveFilter: 'all',
    selectedCompanyId: null,
    selectedRoleRef: null,
    activeTool: null,
    toolLoading: false,
    usedBullets: new Set(),
    copied: false,
    chatInput: '',
    chatMessages: [],
    chatLoading: false,
    connectTab: 'mycoach',
    coachingTab: 'mycoach',
    networkFilter: 'all',
    hiveMindParticipating: false,
    coachFilter: '',
    coachProfileId: null,
    coachMatchLoading: false,
    coachMatchResult: null,
    profileTab: 'dreamrole',
    profileSetupOpen: false,
    profileSetupLoading: false,
    profileSetupDone: false,
    resumePasteText: '',
    profileWorkExpOverride: null,
    profileSkillsOverride: null,
    profileEducationOverride: null,
    profileSummaryText: '',
    profileDreamRoleSug: null,
    addJobPanel: false,
    addJobUrl: '',
    addJobLoading: false,
    addJobFound: false,
    jobAnalysis: null,
    notionJobAdded: false,
    networkDraftFor: null,
    notifOpen: false,
    notifRead: {},
    upskillProgress: {},
    dreamRoleSelectedId: null,
    dreamRoleList: ['VP of Product', 'Head of Product Operations'],
    addingDreamRole: false,
    dreamGapLoading: false,
    dreamGapAnalysis: null,
    dreamGapAnalysisForRole: null,
    opportunitiesTab: 'discover',
    pipelineSubTab: 'apply',
    myJobsUrlInput: '',
    kanbanCards: [
      { id:0, company:'Stripe', initials:'ST', role:'Sr. PM — Revenue Recognition', stage:'saved', fit:91, jobRef:0, days:2 },
      { id:1, company:'Linear', initials:'LN', role:'Product Lead', stage:'saved', fit:87, jobRef:1, days:5 },
      { id:2, company:'Figma', initials:'FG', role:'Design Systems PM', stage:'interview', fit:84, jobRef:2, days:7 },
    ],
    kanbanDrawerCardId: null,
    kanbanDragging: null,
    interviewPrepLoading: false,
    interviewPrepResult: null,
    interviewPrepForCardId: null,
    signalsLoading: false,
    signalsData: {
      headline: "Senior PM hiring is rebounding at growth-stage companies — your infra background is the differentiator this cycle.",
      signals: [
        { type:'hiring_surge', company:'Stripe', title:'Stripe ramping PM headcount in revenue infra', body:'12 senior PM roles posted in the last 60 days, heavily skewed toward revenue and platform tracks.', sentiment:'positive', actionable:'Refresh your Stripe network outreach — timing is right.' },
        { type:'trend', company:null, title:'AI product fluency now a top-3 hiring signal', body:'Candidates who can speak to building with LLMs are advancing to final rounds 2× faster across product roles.', sentiment:'positive', actionable:'Add a concrete AI product example to your interview prep.' },
        { type:'role_demand', company:null, title:'Head of Product roles up 34% YoY at Series B', body:'Companies raising $30–80M are replacing fractional PMs with full-time Heads of Product faster than any point since 2021.', sentiment:'positive', actionable:'Consider targeting 2–3 recently funded Series B companies.' },
        { type:'funding', company:'Linear', title:'Linear raises Series C — headcount growth likely', body:'$35M new round suggests significant hiring ahead, particularly in product and engineering.', sentiment:'positive', actionable:'Reach out to your Linear contact while momentum is fresh.' },
        { type:'salary', company:null, title:'Director PM comp stabilizing at $280–400k TC', body:'After the 2023–24 correction, total comp has stabilized with equity bouncing back at growth-stage companies.', sentiment:'neutral', actionable:'Use this benchmark in your next offer negotiation.' },
      ],
