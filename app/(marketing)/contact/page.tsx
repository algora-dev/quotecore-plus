"use client";

import { useState } from "react";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { homepageConfig } from "@/components/marketing/home/homepage-config";
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

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const bookingHref = homepageConfig.bookingHref || "https://calendly.com/quote-core-info/meeting";

  return (
    <>
      <BlogHeader />
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="contact-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.copy}>
              <p className={styles.eyebrow}>Talk to QuoteCore+</p>
              <h1 id="contact-title" className={styles.title}>Let&apos;s make quoting <span className={styles.titleAccent}>feel easier.</span></h1>
              <p className={styles.lead}>Have a question, a workflow to improve, or a better way you think we should build? Send it over. A real person will read it and get back to you within 24 hours.</p>

              <div className={styles.quickLinks}>
                <a className={styles.quickLink} href="mailto:info@quote-core.com"><MailIcon />Email us directly</a>
                <a className={styles.quickLink} href={bookingHref} target="_blank" rel="noopener noreferrer"><CalendarIcon />Book a free 15-minute call <ArrowIcon /></a>
              </div>

              <div className={styles.reassurance} aria-label="Contact promises">
                <span><CheckIcon />No pressure</span>
                <span><CheckIcon />Useful answers</span>
                <span><CheckIcon />Usually same day</span>
              </div>
            </div>

            <div className={styles.formCard}>
              <div className={styles.formIntro}>
                <h2>Send us a message</h2>
                <p>Tell us what you need. Keep it brief or give us the full picture. We only need your name, email, and message to get started.</p>
              </div>

              <form
                className={styles.form}
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = Object.fromEntries(new FormData(form));
                  setStatus("sending");
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
                    <span className={styles.successIcon} aria-hidden="true">✓</span>
                    <strong>Message sent.</strong>
                    <p>We&apos;ll be in touch within 24 hours. Check your inbox for a copy of your message.</p>
                  </div>
                ) : (
                  <>
                    <div className={styles.field}>
                      <label htmlFor="name">Your name <span aria-hidden="true">*</span></label>
                      <input className={styles.input} id="name" name="name" type="text" required placeholder="First name or full name" />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="email">Email address <span aria-hidden="true">*</span></label>
                      <input className={styles.input} id="email" name="email" type="email" required placeholder="you@company.com" />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="company">Company name <span className={styles.optional}>(optional)</span></label>
                      <input className={styles.input} id="company" name="company" type="text" placeholder="Your business name" />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="subject">Subject <span className={styles.optional}>(optional)</span></label>
                      <input className={styles.input} id="subject" name="subject" type="text" placeholder="What can we help with?" />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="message">Your message <span aria-hidden="true">*</span></label>
                      <textarea className={styles.textarea} id="message" name="message" rows={5} required placeholder="Tell us what you need help with or what you would like to know..." />
                    </div>
                    <div>
                      <button className={styles.submit} type="submit" disabled={status === "sending"}>
                        {status === "sending" ? "Sending..." : "Send message"}
                        {status !== "sending" && <ArrowIcon />}
                      </button>
                      <p className={styles.note}>We reply within 24 hours. No spam, ever.</p>
                    </div>
                    {status === "error" && <p className={styles.error} role="alert">Something went wrong. Please email us directly at <a href="mailto:info@quote-core.com">info@quote-core.com</a>.</p>}
                  </>
                )}
              </form>
            </div>
          </div>
        </section>

        <section className={styles.bottomStrip} aria-label="What to expect">
          <div className={`${styles.container} ${styles.bottomInner}`}>
            <article className={styles.promise}>
              <span className={styles.promiseIcon}><CheckIcon /></span>
              <div><h3>A real person reads it</h3><p>Your message goes to the team, not an automated funnel.</p></div>
            </article>
            <article className={styles.promise}>
              <span className={styles.promiseIcon}><CalendarIcon /></span>
              <div><h3>Clear next steps</h3><p>We will answer the question you actually asked.</p></div>
            </article>
            <article className={styles.promise}>
              <span className={styles.promiseIcon}><ArrowIcon /></span>
              <div><h3>Reply within 24 hours</h3><p>Often sooner, especially during the working day.</p></div>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
