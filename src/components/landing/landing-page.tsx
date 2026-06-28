"use client";

import Link from "next/link";
import { useState } from "react";
import {
  LANDING_ANALYTICS,
  LANDING_COMPANIES_LABEL,
  LANDING_COMPANY_LOGOS,
  LANDING_FAQ,
  LANDING_FINAL_CTA,
  LANDING_FOOTER,
  LANDING_HERO,
  LANDING_NAV,
  LANDING_PRICING,
  LANDING_SKILL_SECTIONS,
  LANDING_STATS,
  LANDING_STEPS,
  LANDING_TESTIMONIALS,
  LANDING_TOP_FEATURES,
  LANDING_WHY,
} from "@/lib/landing-content";
import "./landing.css";

function UpwizeLogo() {
  return (
    <span className="landing-logo">
      <span className="landing-logo__mark" aria-hidden />
      upwize
    </span>
  );
}

function StoreButton({ label, icon }: { label: string; icon: "apple" | "play" }) {
  return (
    <Link href="/signup" className="landing-store-btn">
      {icon === "apple" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M3.609 1.814L13.792 12 3.61 22.186a1.003 1.003 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z" />
        </svg>
      )}
      {label}
    </Link>
  );
}

function PhoneMockup() {
  return (
    <div className="landing-phone-wrap" aria-hidden>
      <span className="landing-float-badge landing-float-badge--new">{LANDING_HERO.newBadge}</span>
      <span className="landing-float-badge landing-float-badge--left">{LANDING_HERO.badges[0]}</span>
      <span className="landing-float-badge landing-float-badge--right">{LANDING_HERO.badges[1]}</span>
      <div className="landing-phone">
        <div className="landing-phone__screen">
          <div className="landing-phone__header">
            <div>
              <p className="landing-phone__greet">Hello, John Wick</p>
              <p className="landing-phone__sub">Good Morning</p>
            </div>
            <span className="landing-phone__bell">🔔</span>
          </div>
          <p className="landing-phone__section-title">Find a Job</p>
          <div className="landing-phone__chips">
            <span>UX Researcher</span>
            <span className="is-active">Motion Designer</span>
            <span>Framer</span>
            <span>Creative</span>
          </div>
          <div className="landing-phone__match-row">
            <strong>28 Best Matching</strong>
            <span>View All</span>
          </div>
          <div className="landing-phone__job landing-phone__job--blue">
            <strong>UX Researcher</strong>
            <span>Figma Inc.</span>
            <small>Full Time · Remote · $120K+/year</small>
          </div>
          <div className="landing-phone__job landing-phone__job--red">
            <strong>Web Engineer</strong>
            <span>Goofy Inc.</span>
            <small>Full Time · Remote · $130K+/year</small>
          </div>
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
  const [faqOpen, setFaqOpen] = useState(0);
  const [testimonial, setTestimonial] = useState(0);
  const t = LANDING_TESTIMONIALS.items[testimonial]!;

  return (
    <div className="landing bruddle">
      <header className="landing-nav">
        <div className="landing-nav__inner">
          <Link href="/" className="landing-nav__logo">
            <UpwizeLogo />
          </Link>
          <nav className="landing-nav__links" aria-label="Primary">
            {LANDING_NAV.map((item) => (
              <a key={item.href} href={item.href} className="landing-nav__link">
                {item.label}
              </a>
            ))}
          </nav>
          <Link href="/signup" className="landing-btn landing-btn--light">
            Get the App Now
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__grid-bg" aria-hidden />
        <div className="landing-container landing-hero__inner">
          <div className="landing-hero__title-row">
            <h1 className="landing-hero__title">{LANDING_HERO.line1}</h1>
            <h1 className="landing-hero__title landing-hero__title--right">{LANDING_HERO.line2}</h1>
          </div>

          <div className="landing-hero__content">
            <div className="landing-hero__col">
              <p className="landing-body-lg">{LANDING_HERO.leftSub}</p>
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
            </div>

            <PhoneMockup />

            <div className="landing-hero__col landing-hero__col--right">
              <p className="landing-body-lg">{LANDING_HERO.rightSub}</p>
              <div className="landing-store-row">
                <StoreButton label="Apple Store" icon="apple" />
                <StoreButton label="Play Store" icon="play" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--cream">
        <div className="landing-container">
          <div className="landing-stats-head">
            <h4 className="landing-h4">{LANDING_STATS.heading}</h4>
            <p className="landing-body landing-muted">{LANDING_STATS.subheading}</p>
          </div>
          <div className="landing-stats-grid">
            {LANDING_STATS.items.map((item) => (
              <div key={item.label} className="landing-stat-card">
                <p className="landing-stat-card__value">
                  <span>{item.value}</span>
                  <strong>{item.suffix}</strong>
                </p>
                <p className="landing-stat-card__label">{item.label}</p>
              </div>
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
                <div key={card.title} className="landing-feature-list__item">
                  <h5 className="landing-h5">{card.title}</h5>
                  <p className="landing-body landing-muted">{card.body}</p>
                </div>
              ))}
            </div>
            <Link href="/signup" className="landing-link-cta">
              {LANDING_ANALYTICS.cta} →
            </Link>
          </div>
          <div className="landing-mock-panel" aria-hidden>
            <div className="landing-mock-chart" />
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--inset">
        <div className="landing-container">
          <SectionIntro heading={LANDING_TOP_FEATURES.heading} body={LANDING_TOP_FEATURES.body} />
          <div className="landing-card-grid landing-card-grid--4">
            {LANDING_TOP_FEATURES.cards.map((card, i) => (
              <div key={i} className="landing-card">
                <div className="landing-card__icon" aria-hidden />
                <h5 className="landing-h5">{card.title}</h5>
                <p className="landing-body-sm landing-muted">{card.body}</p>
              </div>
            ))}
          </div>
          <div className="landing-center-cta">
            <Link href="/signup" className="landing-btn landing-btn--primary">
              {LANDING_TOP_FEATURES.cta}
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <SectionIntro heading={LANDING_STEPS.heading} body={LANDING_STEPS.body} />
          <div className="landing-steps">
            {LANDING_STEPS.steps.map((step, i) => (
              <div key={i} className="landing-step">
                <span className="landing-step__num">{String(i + 1).padStart(2, "0")}</span>
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
              <div key={card.title} className="landing-card landing-card--on-dark">
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
              <Link href="/signup" className="landing-link-cta">
                {section.cta} →
              </Link>
            </div>
            <div className="landing-mock-panel landing-mock-panel--skills" aria-hidden />
          </div>
        </section>
      ))}

      <section className="landing-section">
        <div className="landing-container">
          <h2 className="landing-h2 landing-center">{LANDING_TESTIMONIALS.heading}</h2>
          <div className="landing-testimonial">
            <blockquote className="landing-testimonial__quote">&ldquo;{t.quote}&rdquo;</blockquote>
            <p className="landing-testimonial__name">{t.name}</p>
            <p className="landing-testimonial__role">{t.role}</p>
            <div className="landing-testimonial__nav">
              <button
                type="button"
                aria-label="Previous"
                onClick={() =>
                  setTestimonial((n) => (n - 1 + LANDING_TESTIMONIALS.items.length) % LANDING_TESTIMONIALS.items.length)
                }
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => setTestimonial((n) => (n + 1) % LANDING_TESTIMONIALS.items.length)}
              >
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
              <span key={`${name}-${i}`}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section" id="pricing">
        <div className="landing-container">
          <SectionIntro label={LANDING_PRICING.label} heading={LANDING_PRICING.heading} body={LANDING_PRICING.body} />
          <div className="landing-pricing-grid">
            {LANDING_PRICING.plans.map((plan) => (
              <div
                key={plan.name}
                className={`landing-pricing-card${plan.popular ? " landing-pricing-card--popular" : ""}`}
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
                <Link href="/signup" className="landing-btn landing-btn--primary landing-btn--block">
                  {plan.cta}
                </Link>
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
              <div key={item.q} className="landing-accordion__item">
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
            <div className="landing-store-row">
              <StoreButton label="Get on Apple store" icon="apple" />
              <StoreButton label="Get on Play Store" icon="play" />
            </div>
          </div>
          <div className="landing-final-cta__visual" aria-hidden />
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container landing-footer__grid">
          <div>
            <UpwizeLogo />
            <p className="landing-body-sm landing-muted landing-footer__contact">
              Address: {LANDING_FOOTER.address}
              <br />
              Email:{" "}
              <a href={`mailto:${LANDING_FOOTER.email}`}>{LANDING_FOOTER.email}</a>
              <br />
              Phone:{" "}
              <a href={`tel:${LANDING_FOOTER.phone.replace(/\D/g, "")}`}>{LANDING_FOOTER.phone}</a>
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
              <a key={s} href="#">
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
