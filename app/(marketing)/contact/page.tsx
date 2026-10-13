"use client";

import { useState } from "react";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { MarketingButton } from "@/components/marketing/MarketingButton";
import { homepageConfig } from "@/components/marketing/home/homepage-config";
import { trackEvent } from "@/lib/analytics";
import styles from "./ContactPage.module.css";

function MailIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 17.25V6.75z" /><path strokeLinecap="round" strokeLinejoin="round" d="m3.75 6 7.02 5.07a2.1 2.1 0 002.46 0L20.25 6" /></svg>;
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M7 3v3m10-3v3M4.75 9.25h14.5M6.25 4.5h11.5A2.25 2.25 0 0120 6.75v11A2.25 2.25 0 0117.75 20H6.25A2.25 2.25 0 014 17.75v-11A2.25 2.25 0 016.25 4.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" /></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h13m-5-5 5 5-5 5" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.2 4.2L19 7" /></svg>;
}

function SparkIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5c.55 3.28 2.72 5.45 6 6-3.28.55-5.45 2.72-6 6-.55-3.28-2.72-5.45-6-6 3.28-.55 5.45-2.72 6-6Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M18.5 15.5c.28 1.66 1.34 2.72 3 3-1.66.28-2.72 1.34-3 3-.28-1.66-1.34-2.72-3-3 1.66-.28 2.72-1.34 3-3Z" /></svg>;
}

function HelpIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.8 9.25a2.45 2.45 0 014.66 1.07c0 1.78-1.9 2.15-2.46 3.38M12 17.2h.01" /></svg>;
}

function MessageIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5.5 4.5h13A2.5 2.5 0 0121 7v8a2.5 2.5 0 01-2.5 2.5H11L6.25 21v-3.5H5.5A2.5 2.5 0 013 15V7a2.5 2.5 0 012.5-2.5Z" /><path strokeLinecap="round" d="M7.5 9h9M7.5 13h6" /></svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 1.8" /></svg>;
}

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const bookingHref = homepageConfig.bookingHref || "#contact-form";

  return (
    <>
      <BlogHeader theme="dark" />
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="contact-title">
          <div className={styles.container}>
            <div className={styles.heroTop}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>Contact QuoteCore+</p>
                <h1 id="contact-title" className={styles.title}>How can we <span>help?</span></h1>
                <p className={styles.lead}>Get an answer, book time with our team, or send us a message. Start with the option that gets you where you need to go fastest.</p>
                <div className={styles.heroActions}>
                  <MarketingButton href={bookingHref} variant="primary" size="large" icon={<CalendarIcon />} onClick={() => trackEvent("book_call_click", { source: "contact_hero" })}>Book a demo with our team</MarketingButton>
                  <MarketingButton href="#contact-form" variant="glass" size="large" icon={<MessageIcon />}>Send a message</MarketingButton>
                </div>
              </div>

              <aside className={styles.heroAside} aria-label="Direct contact option">
                <span className={styles.asideIcon}><MailIcon /></span>
                <p className={styles.asideLabel}>Prefer email?</p>
                <a className={styles.directEmail} href="mailto:info@quote-core.com" onClick={() => trackEvent("contact_email_click", { source: "contact_hero" })}>info@quote-core.com</a>
                <p>Copy the address or open it in your email app. No form required.</p>
              </aside>
            </div>

            <nav className={styles.routeGrid} aria-label="Contact options">
              <article className={styles.routeCard}>
                <span className={styles.routeIcon}><CalendarIcon /></span>
                <span className={styles.routeNumber}>01</span>
                <h2>Book a demo</h2>
                <p>See QuoteCore+ in action and ask questions about how it fits your business.</p>
                <span className={styles.routeLinks}>
                  <a className={styles.routeLink} href={bookingHref} target={bookingHref.startsWith("#") ? undefined : "_blank"} rel={bookingHref.startsWith("#") ? undefined : "noopener noreferrer"} onClick={() => trackEvent("book_call_click", { source: "contact_route_demo" })}>Choose a time <ArrowIcon /></a>
                  <a className={styles.routeLink} href="/demo" target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("contact_demo_click", { source: "contact_route_demo" })}>Try the demo yourself <ArrowIcon /></a>
                </span>
              </article>
              <a className={styles.routeCard} href="/done-for-you-setup" target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("contact_setup_click", { source: "contact_route_setup" })}>
                <span className={styles.routeIcon}><SparkIcon /></span>
                <span className={styles.routeNumber}>02</span>
                <h2>Done-for-you setup</h2>
                <p>Want help setting up pricing, components or your workflow? Book time with the team.</p>
                <span className={styles.routeLink}>Get setup help <ArrowIcon /></span>
              </a>
              <a className={styles.routeCard} href="/#questions" target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("contact_faq_click", { source: "contact_route_faq" })}>
                <span className={styles.routeIcon}><HelpIcon /></span>
                <span className={styles.routeNumber}>03</span>
                <h2>Find a quick answer</h2>
                <p>For common questions about the app, pricing and how QuoteCore+ works, start with the FAQs.</p>
                <span className={styles.routeLink}>Browse FAQs <ArrowIcon /></span>
              </a>
              <a className={styles.routeCard} href="#contact-form">
                <span className={styles.routeIcon}><MessageIcon /></span>
                <span className={styles.routeNumber}>04</span>
                <h2>Talk to our team</h2>
                <p>Questions, account help, partnerships, feedback or something else. Send us the details.</p>
                <span className={styles.routeLink}>Contact us <ArrowIcon /></span>
              </a>
            </nav>
          </div>
        </section>

        <section className={styles.answers} aria-labelledby="answers-title">
          <div className={`${styles.container} ${styles.answersGrid}`}>
            <div className={styles.answersIntro}>
              <p className={styles.lightEyebrow}>Before you contact us</p>
              <h2 id="answers-title">You might already be one click from the answer.</h2>
              <p>Some questions are quicker to solve without waiting for a reply. Here are the most common places to start.</p>
              <MarketingButton href="/#questions" variant="glass" icon={<HelpIcon />} target="_blank" onClick={() => trackEvent("contact_faq_click", { source: "contact_answers" })}>View all FAQs</MarketingButton>
            </div>

            <div className={styles.questionList}>
              <details className={styles.question}>
                <summary>Can I see QuoteCore+ before I speak to anyone?<span><ArrowIcon /></span></summary>
                <p>Yes. You can explore the demo first, then book a call if you want help applying it to your own workflow.</p>
              </details>
              <details className={styles.question}>
                <summary>Can you help set up my pricing and components?<span><ArrowIcon /></span></summary>
                <p>Yes. The done-for-you route is for businesses that want help getting their pricing, components and workflow into a usable starting point.</p>
              </details>
              <details className={styles.question}>
                <summary>I have a product or account question. Where should I start?<span><ArrowIcon /></span></summary>
                <p>Check the FAQ first for common questions. If it is specific to your account or you still need help, use the form or email us directly.</p>
              </details>
              <details className={styles.question}>
                <summary>Can I send feedback or suggest a feature?<span><ArrowIcon /></span></summary>
                <p>Absolutely. We want to hear what would make the app more useful. Send your idea through the form or email it to info@quote-core.com.</p>
              </details>
            </div>
          </div>
        </section>

        <section className={styles.contactSection} aria-labelledby="form-title">
          <div className={`${styles.container} ${styles.contactGrid}`}>
            <div className={styles.contactCopy}>
              <p className={styles.eyebrow}>Still need a hand?</p>
              <h2>Talk to a real person.</h2>
              <p>Send us what you need and give us as much context as you like. We will point you in the right direction, answer the question, or tell you the best next step.</p>

              <div className={styles.contactFacts}>
                <div><span><MailIcon /></span><div><strong>Email works too</strong><a href="mailto:info@quote-core.com">info@quote-core.com</a></div></div>
                <div><span><ClockIcon /></span><div><strong>We reply within 24 hours</strong><p>Usually sooner during the working day.</p></div></div>
                <div><span><CheckIcon /></span><div><strong>A person reads your message</strong><p>No automated support loop. Your enquiry goes to the team.</p></div></div>
              </div>
            </div>

            <div id="contact-form" className={styles.formCard}>
              <div className={styles.formIntro}>
                <p className={styles.formKicker}>Send a message</p>
                <h2 id="form-title">Tell us what you need.</h2>
                <p>Prefer your own email app? Write to <a href="mailto:info@quote-core.com">info@quote-core.com</a>. Otherwise, use the form below.</p>
              </div>

              <form
                className={styles.form}
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = Object.fromEntries(new FormData(form));
                  setStatus("sending");
                  trackEvent("contact_form_submit", { source: "contact_page" });
                  try {
                    const response = await fetch("/api/contact", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(data),
                    });
                    setStatus(response.ok ? "success" : "error");
                  } catch {
                    setStatus("error");
                  }
                }}
              >
                {status === "success" ? (
                  <div className={styles.success} role="status" aria-live="polite">
                    <span className={styles.successIcon} aria-hidden="true"><CheckIcon /></span>
                    <strong>Message sent.</strong>
                    <p>Thanks. We have your message and will get back to you within 24 hours.</p>
                  </div>
                ) : (
                  <>
                    <div className={styles.fieldRow}>
                      <div className={styles.field}>
                        <label htmlFor="name">Your name <span aria-hidden="true">*</span></label>
                        <input className={styles.input} id="name" name="name" type="text" required placeholder="First name or full name" />
                      </div>
                      <div className={styles.field}>
                        <label htmlFor="email">Email address <span aria-hidden="true">*</span></label>
                        <input className={styles.input} id="email" name="email" type="email" required placeholder="you@company.com" />
                      </div>
                    </div>
                    <div className={styles.fieldRow}>
                      <div className={styles.field}>
                        <label htmlFor="company">Company name <span className={styles.optional}>(optional)</span></label>
                        <input className={styles.input} id="company" name="company" type="text" placeholder="Your business name" />
                      </div>
                      <div className={styles.field}>
                        <label htmlFor="subject">Subject <span className={styles.optional}>(optional)</span></label>
                        <input className={styles.input} id="subject" name="subject" type="text" placeholder="What can we help with?" />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="message">Your message <span aria-hidden="true">*</span></label>
                      <textarea className={styles.textarea} id="message" name="message" rows={6} required placeholder="Tell us what you need help with, what you are trying to do, or what you would like us to know." />
                    </div>
                    <div>
                      <button className={styles.submit} type="submit" disabled={status === "sending"}>
                        {status === "sending" ? "Sending..." : "Send message"}
                        {status !== "sending" && <ArrowIcon />}
                      </button>
                      <p className={styles.note}>We only use these details to respond to your enquiry.</p>
                    </div>
                    {status === "error" && <p className={styles.error} role="alert">Something went wrong. Please email us directly at <a href="mailto:info@quote-core.com">info@quote-core.com</a>.</p>}
                  </>
                )}
              </form>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
