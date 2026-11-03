import Link from "next/link";
import SocialIcons from "@/components/SocialIcons";
import { workflowCallHref } from "@/lib/booking";
import styles from "./SiteFooter.module.css";

const product = [
  ["All features", "/features"], ["Roof Scan Assist", "/features/ai-scan-assist"], ["Digital roof takeoff", "/features/digital-roof-takeoff"], ["Smart Assistant", "/features/smart-assistant"], ["Smart Components™", "/features/smart-components"], ["Offcut Optimiser", "/features/offcut-optimiser"], ["Material ordering", "/features/material-ordering"], ["Invoicing", "/features/invoicing"],
] as const;
const explore = [
  ["Roofing software", "/roofing-quoting-software"], ["Roofing estimating", "/roofing-estimating-software"], ["Roofing takeoff", "/roofing-takeoff-software"], ["Xero integration", "/integrations/xero"], ["Pricing", "/pricing"], ["Free tools", "/free-tools"], ["Resources and blog", "/blog"], ["AI in roofing hub", "/resources/ai"], ["Software comparisons", "/resources/comparisons"], ["Video tutorials", "/tutorials"], ["Documentation", "/docs"],
] as const;
const company = [
  ["Book 25 minutes with Shaun", workflowCallHref], ["Free Workspace", "/free-trial"], ["Company", "/company"], ["About", "/about"], ["Trust and security", "/trust"], ["Partner program", "/affiliate-program"], ["Contact", "/contact"],
] as const;
const legal = [["Privacy", "/privacy"], ["Terms", "/terms"], ["Cookie policy", "/cookie-policy"]] as const;

function FooterNav({ title, links }: { title: string; links: readonly (readonly [string,string])[] }) {
  return <nav aria-label={title}><h2 className={styles.navTitle}>{title}</h2><div className={styles.links}>{links.map(([label, href]) => <Link key={label} href={href} target={/^https?:\/\//.test(href) ? '_blank' : undefined} rel={/^https?:\/\//.test(href) ? 'noopener noreferrer' : undefined} className={styles.link}>{label}</Link>)}</div></nav>;
}

export default function SiteFooter() {
  return <footer className={styles.footer}>
    <div className={styles.inner}>
      <div className={styles.grid}>
        <div className={styles.brandCol}>
          <Link href="/" className={styles.logoLink} aria-label="QuoteCore+ home"><span className={styles.wordmark}>QuoteCore<span className={styles.plus}>+</span></span></Link>
          <p className={styles.description}>Roofing quoting, takeoff and job workflow software. Built for roofing first, flexible enough for every trade.</p>
          <SocialIcons className={styles.social} align="start" />
        </div>
        <FooterNav title="Product" links={product} />
        <FooterNav title="Explore" links={explore} />
        <FooterNav title="Company" links={company} />
        <nav aria-label="Legal"><h2 className={styles.navTitle}>Legal</h2><div className={styles.links}>{legal.map(([label, href]) => <Link key={label} href={href} className={styles.link}>{label}</Link>)}</div></nav>
      </div>
      <div className={styles.bottom}><p>&copy; 2026 QuoteCore+. Built by <a href="https://t3labs.tech">T3 Labs</a>.</p></div>
    </div>
  </footer>;
}
