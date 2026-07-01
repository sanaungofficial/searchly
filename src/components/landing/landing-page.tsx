"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KimchiBySecondLadder } from "@/components/scout/scout-box";
import {
  LANDING_ANALYTICS,
  LANDING_COMPANIES_LABEL,
  LANDING_COMPANY_LOGOS,
  LANDING_FAQ,
  LANDING_FINAL_CTA,
  LANDING_FOOTER,
  LANDING_HERO,
  LANDING_JOIN_WAITLIST_LABEL,
  LANDING_PRICING,
  LANDING_SKILL_SECTIONS,
  LANDING_STATS,
  LANDING_STEPS,
  LANDING_TESTIMONIALS,
  LANDING_TOP_FEATURES,
  LANDING_WAITLIST_URL,
  LANDING_WHY,
} from "@/lib/landing-content";
import { MarketingTopNav } from "@/components/landing/marketing-top-nav";
import { useAppEntryHref } from "@/hooks/use-app-entry-href";
import { hasValidClientSession } from "@/lib/client-auth-session";
import { APP_HOME_PATH } from "@/lib/site-host";
import "./landing.css";

function KimchiWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`landing-wordmark${compact ? " landing-wordmark--compact" : ""}`}>
      <span className="landing-wordmark__title">Kimchi</span>
      {!compact && (
        <KimchiBySecondLadder fontSize={11} color="var(--landing-muted)" marginTop={2} />
      )}
    </span>
  );
}

function useReveal() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);
  return value;
}

function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const count = useCountUp(value, active);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="landing-stat-card landing-card-hover">
      <p className="landing-stat-card__value">
        <span>{count}</span>
        <strong>{suffix}</strong>
      </p>
      <p className="landing-stat-card__label">{label}</p>
    </div>
  );
}

function WebAppMockup() {
  return (
    <div className="landing-browser-wrap" aria-hidden>
      <span className="landing-float-badge landing-float-badge--new">{LANDING_HERO.newBadge}</span>
      <span className="landing-float-badge landing-float-badge--left">{LANDING_HERO.badges[0]}</span>
      <span className="landing-float-badge landing-float-badge--right">{LANDING_HERO.badges[1]}</span>
      <div className="landing-browser landing-card-hover landing-card-hover--static">
        <div className="landing-browser__chrome">
          <span className="landing-browser__dot landing-browser__dot--red" />
          <span className="landing-browser__dot landing-browser__dot--yellow" />
          <span className="landing-browser__dot landing-browser__dot--green" />
          <span className="landing-browser__url">kimchi.so/dashboard</span>
        </div>
        <div className="landing-browser__body">
          <aside className="landing-browser__sidebar">
            <span className="landing-browser__logo">K</span>
            <span className="landing-browser__nav-item is-active" />
            <span className="landing-browser__nav-item" />
            <span className="landing-browser__nav-item" />
            <span className="landing-browser__nav-item" />
          </aside>
          <main className="landing-browser__main">
            <div className="landing-browser__header">
              <div>
                <p className="landing-browser__greet">Good morning, Alex</p>
                <p className="landing-browser__sub">3 trajectory matches today</p>
              </div>
              <span className="landing-browser__pill">Live coaching</span>
            </div>
            <div className="landing-browser__jobs">
              <div className="landing-browser__job">
                <div>
                  <strong>Product Manager</strong>
                  <span>Stripe · Remote</span>
                </div>
                <span className="landing-browser__score landing-browser__score--high">92%</span>
              </div>
              <div className="landing-browser__job">
                <div>
                  <strong>Strategy &amp; Ops</strong>
                  <span>Series C · Hybrid</span>
                </div>
                <span className="landing-browser__score">87%</span>
              </div>
              <div className="landing-browser__job landing-browser__job--muted">
                <div>
                  <strong>Associate PM</strong>
                  <span>Google · On-site</span>
                </div>
                <span className="landing-browser__score">81%</span>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SectionIntro({
  label,
  heading,
  body,
  id,
}: {
  label?: string;
  heading: string;
  body?: string;
  id?: string;
}) {
  return (
    <div className="landing-section-intro" id={id}>
      {label ? <p className="landing-eyebrow">{label}</p> : null}
      <h2 className="landing-h2">{heading}</h2>
      {body ? <p className="landing-body-lg landing-muted">{body}</p> : null}
    </div>
  );
}

export function LandingPage() {
  const router = useRouter();
  const loginHref = useAppEntryHref("/login");
  const signupHref = useAppEntryHref("/signup");
  const [faqOpen, setFaqOpen] = useState(0);
  const [testimonial, setTestimonial] = useState(0);
  const t = LANDING_TESTIMONIALS.items[testimonial]!;

  // Domain-migration fallback: only enter the app when the server accepts the session.
  useEffect(() => {
    hasValidClientSession().then((valid) => {
      if (valid) router.replace(APP_HOME_PATH);
    });
  }, [router]);

  const nextTestimonial = useCallback(() => {
    setTestimonial((n) => (n + 1) % LANDING_TESTIMONIALS.items.length);
  }, []);

  const prevTestimonial = useCallback(() => {
    setTestimonial((n) => (n - 1 + LANDING_TESTIMONIALS.items.length) % LANDING_TESTIMONIALS.items.length);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(nextTestimonial, 7000);
    return () => window.clearInterval(timer);
  }, [nextTestimonial]);

  const statsRef = useReveal();
  const featuresRef = useReveal();
  const stepsRef = useReveal();
  const pricingRef = useReveal();

  return (
    <div className="landing bruddle">
      <MarketingTopNav />

      <section className="landing-hero">
        <div className="landing-hero__grid-bg" aria-hidden />
        <div className="landing-container landing-hero__inner">
          <div className="landing-hero__head">
            <h1 className="landing-hero__title">
              {LANDING_HERO.line1}
              <span className="landing-hero__title-accent">{LANDING_HERO.line2}</span>
            </h1>
            <p className="landing-hero__subtitle">{LANDING_HERO.subtitle}</p>
          </div>

          <WebAppMockup />

          <div className="landing-hero__footer">
            <div className="landing-trust">
              <div className="landing-trust__avatars" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="landing-trust__avatar" />
                ))}
              </div>
              <div>
                <p className="landing-trust__label">{LANDING_HERO.trustedLabel}</p>
                <p className="landing-trust__stat">{LANDING_HERO.trustedStat}</p>
              </div>
            </div>
            <div className="landing-hero__actions">
              <a
                href={LANDING_WAITLIST_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn landing-btn--gold landing-btn--bruddle"
              >
                {LANDING_JOIN_WAITLIST_LABEL} →
              </a>
              <Link href={loginHref} className="landing-btn landing-btn--ghost landing-btn--bruddle landing-btn--ghost-on-dark">
                Log In
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section ref={statsRef as React.RefObject<HTMLElement>} className="landing-section landing-section--cream landing-reveal">
        <div className="landing-container">
          <div className="landing-stats-head">
            <h4 className="landing-h4">{LANDING_STATS.heading}</h4>
            <p className="landing-body landing-muted">{LANDING_STATS.subheading}</p>
          </div>
          <div className="landing-stats-grid">
            {LANDING_STATS.items.map((item) => (
              <StatCard key={item.label} value={item.value} suffix={item.suffix} label={item.label} />
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="landing-container landing-split">
          <div>
            <SectionIntro heading={LANDING_ANALYTICS.heading} body={LANDING_ANALYTICS.body} />
            <div className="landing-feature-list">
              {LANDING_ANALYTICS.cards.map((card) => (
                <div key={card.title} className="landing-feature-list__item landing-card-hover landing-card-hover--subtle">
                  <h5 className="landing-h5">{card.title}</h5>
                  <p className="landing-body landing-muted">{card.body}</p>
                </div>
              ))}
            </div>
            <Link href={signupHref} className="landing-link-cta">
              {LANDING_ANALYTICS.cta} →
            </Link>
          </div>
          <div className="landing-mock-panel landing-card-hover" aria-hidden>
            <div className="landing-mock-chart">
              <div className="landing-mock-bars">
                {[68, 82, 55, 91, 74, 88].map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={featuresRef as React.RefObject<HTMLElement>} className="landing-section landing-section--inset landing-reveal">
        <div className="landing-container">
          <SectionIntro heading={LANDING_TOP_FEATURES.heading} body={LANDING_TOP_FEATURES.body} />
          <div className="landing-card-grid landing-card-grid--4">
            {LANDING_TOP_FEATURES.cards.map((card) => (
              <div key={card.title} className="landing-card landing-card-hover">
                <span className="landing-card__emoji" aria-hidden>
                  {card.emoji}
                </span>
                <h5 className="landing-h5">{card.title}</h5>
                <p className="landing-body-sm landing-muted">{card.body}</p>
              </div>
            ))}
          </div>
          <div className="landing-center-cta">
            <a
              href={LANDING_WAITLIST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="landing-btn landing-btn--primary landing-btn--bruddle"
            >
              {LANDING_TOP_FEATURES.cta}
            </a>
          </div>
        </div>
      </section>

      <section ref={stepsRef as React.RefObject<HTMLElement>} className="landing-section landing-reveal">
        <div className="landing-container">
          <SectionIntro heading={LANDING_STEPS.heading} body={LANDING_STEPS.body} />
          <div className="landing-steps">
            {LANDING_STEPS.steps.map((step, i) => (
              <div key={step.title} className="landing-step landing-card-hover">
                <span className="landing-step__num">{String(i + 1).padStart(2, "0")}</span>
                <span className="landing-step__emoji" aria-hidden>
                  {step.emoji}
                </span>
                <h5 className="landing-h5">{step.title}</h5>
                <p className="landing-body-sm landing-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--forest">
        <div className="landing-container">
          <h2 className="landing-h2 landing-h2--light landing-center">{LANDING_WHY.heading}</h2>
          <div className="landing-card-grid landing-card-grid--4">
            {LANDING_WHY.cards.map((card) => (
              <div key={card.title} className="landing-card landing-card--on-dark landing-card-hover landing-card-hover--on-dark">
                <span className="landing-card__emoji" aria-hidden>
                  {card.emoji}
                </span>
                <h5 className="landing-h5 landing-h5--light">{card.title}</h5>
                <p className="landing-body-sm landing-text-light">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {LANDING_SKILL_SECTIONS.map((section, idx) => (
        <section key={idx} className="landing-section landing-section--cream">
          <div className="landing-container landing-split">
            <div>
              {"tabs" in section && section.tabs ? (
                <div className="landing-tabs" role="tablist" aria-label="Skills">
                  {section.tabs.map((tab, ti) => (
                    <button key={tab} type="button" className={ti === 0 ? "is-active" : ""} role="tab">
                      {tab}
                    </button>
                  ))}
                </div>
              ) : null}
              <h3 className="landing-h3">{section.heading}</h3>
              <p className="landing-body landing-muted">{section.body}</p>
              <Link href={signupHref} className="landing-link-cta">
                {section.cta} →
              </Link>
            </div>
            <div className="landing-mock-panel landing-mock-panel--skills landing-card-hover" aria-hidden>
              <div className="landing-mock-skills">
                {["Product sense", "Case prep", "SQL", "GTM"].map((skill, si) => (
                  <span key={skill} className={si === 0 ? "is-hot" : ""}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}

      <section className="landing-section">
        <div className="landing-container">
          <h2 className="landing-h2 landing-center">{LANDING_TESTIMONIALS.heading}</h2>
          <div className="landing-testimonial landing-card-hover">
            <blockquote className="landing-testimonial__quote">&ldquo;{t.quote}&rdquo;</blockquote>
            <p className="landing-testimonial__name">{t.name}</p>
            <p className="landing-testimonial__role">{t.role}</p>
            <div className="landing-testimonial__dots">
              {LANDING_TESTIMONIALS.items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to testimonial ${i + 1}`}
                  className={i === testimonial ? "is-active" : ""}
                  onClick={() => setTestimonial(i)}
                />
              ))}
            </div>
            <div className="landing-testimonial__nav">
              <button type="button" aria-label="Previous" onClick={prevTestimonial}>
                ←
              </button>
              <button type="button" aria-label="Next" onClick={nextTestimonial}>
                →
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--inset">
        <div className="landing-container">
          <p className="landing-eyebrow landing-center">{LANDING_COMPANIES_LABEL}</p>
          <div className="landing-logo-marquee">
            {[...LANDING_COMPANY_LOGOS, ...LANDING_COMPANY_LOGOS].map((name, i) => (
              <span key={`${name}-${i}`} className="landing-card-hover landing-card-hover--subtle">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section ref={pricingRef as React.RefObject<HTMLElement>} className="landing-section landing-reveal" id="pricing">
        <div className="landing-container">
          <SectionIntro label={LANDING_PRICING.label} heading={LANDING_PRICING.heading} body={LANDING_PRICING.body} />
          <div className="landing-pricing-grid">
            {LANDING_PRICING.plans.map((plan) => (
              <div
                key={plan.name}
                className={`landing-pricing-card landing-card-hover${plan.popular ? " landing-pricing-card--popular" : ""}`}
              >
                {"badge" in plan && plan.badge ? (
                  <span className="landing-pricing-card__badge">{plan.badge}</span>
                ) : null}
                <p className="landing-eyebrow">{plan.name}</p>
                <p className="landing-body-sm landing-muted">{plan.tagline}</p>
                <p className="landing-pricing-card__price">
                  {plan.price}
                  {plan.period ? <span>{plan.period}</span> : null}
                </p>
                <ul className="landing-pricing-card__features">
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a
                  href={LANDING_WAITLIST_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-btn landing-btn--primary landing-btn--block landing-btn--bruddle"
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--cream">
        <div className="landing-container landing-faq">
          <div>
            <SectionIntro heading={LANDING_FAQ.heading} body={LANDING_FAQ.body} />
            <p className="landing-h5">{LANDING_FAQ.contactHeading}</p>
            <p className="landing-body landing-muted">{LANDING_FAQ.contactBody}</p>
            <a href={`mailto:${LANDING_FOOTER.email}`} className="landing-link-cta">
              {LANDING_FAQ.contactCta} →
            </a>
          </div>
          <div className="landing-accordion">
            {LANDING_FAQ.items.map((item, i) => (
              <div key={item.q} className="landing-accordion__item landing-card-hover landing-card-hover--accordion">
                <button
                  type="button"
                  className="landing-accordion__trigger"
                  aria-expanded={faqOpen === i}
                  onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}
                >
                  {item.q}
                  <span aria-hidden>{faqOpen === i ? "−" : "+"}</span>
                </button>
                {faqOpen === i && item.a ? (
                  <p className="landing-accordion__body">{item.a}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-final-cta">
        <div className="landing-container landing-final-cta__inner">
          <div>
            <h2 className="landing-h2 landing-h2--light">{LANDING_FINAL_CTA.heading}</h2>
            <p className="landing-body-lg landing-text-light">{LANDING_FINAL_CTA.body}</p>
            <ul className="landing-final-cta__list">
              {LANDING_FINAL_CTA.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <div className="landing-hero__actions">
              <a
                href={LANDING_WAITLIST_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn landing-btn--gold landing-btn--bruddle"
              >
                {LANDING_JOIN_WAITLIST_LABEL} →
              </a>
              <Link href={loginHref} className="landing-btn landing-btn--ghost landing-btn--bruddle landing-btn--ghost-on-dark">
                Log In
              </Link>
            </div>
          </div>
          <div className="landing-final-cta__visual landing-card-hover landing-card-hover--on-dark" aria-hidden>
            <div className="landing-final-cta__mini-browser">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container landing-footer__grid">
          <div>
            <KimchiWordmark />
            <p className="landing-body-sm landing-muted landing-footer__contact">
              {LANDING_FOOTER.address}
              <br />
              Email:{" "}
              <a href={`mailto:${LANDING_FOOTER.email}`}>{LANDING_FOOTER.email}</a>
            </p>
          </div>
          <div>
            <p className="landing-footer__heading">Quick links</p>
            <ul className="landing-footer__links">
              {LANDING_FOOTER.quickLinks.map((l) => (
                <li key={l}>
                  <a href="#">{l}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="landing-footer__heading">Job categories</p>
            <ul className="landing-footer__links">
              {LANDING_FOOTER.categories.map((l) => (
                <li key={l}>
                  <a href="#">{l}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="landing-footer__heading">Support &amp; resources</p>
            <ul className="landing-footer__links">
              {LANDING_FOOTER.support.map((l) => (
                <li key={l}>
                  <a href="#">{l}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="landing-container landing-footer__bottom">
          <div className="landing-footer__social">
            {LANDING_FOOTER.social.map((s) => (
              <a key={s} href="#" className="landing-card-hover landing-card-hover--subtle">
                {s}
              </a>
            ))}
          </div>
          <div className="landing-footer__legal">
            {LANDING_FOOTER.legal.map((l) => (
              <a key={l} href="#">
                {l}
              </a>
            ))}
            <span>{LANDING_FOOTER.copyright}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
