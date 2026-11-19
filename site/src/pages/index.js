import {useEffect, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

const RELEASES = 'https://github.com/geirfreysson/pptd/releases/latest';
const DOWNLOADS = {
  macos: {
    label: 'Download for macOS',
    name: 'macOS',
    spec: 'Apple Silicon · signed and notarized',
    href: `${RELEASES}/download/PPTD-mac-arm64.dmg`,
  },
  windows: {
    label: 'Download for Windows',
    name: 'Windows',
    spec: 'x64 installer · not yet code-signed',
    href: `${RELEASES}/download/PPTD-windows-x64-setup.exe`,
  },
  linux: {
    label: 'Download for Linux',
    name: 'Linux',
    spec: 'x64 AppImage · a .deb is on the releases page',
    href: `${RELEASES}/download/PPTD-linux-x86_64.AppImage`,
  },
};

function platformFor(ua) {
  if (/Windows/i.test(ua)) return 'windows';
  if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return 'linux';
  return 'macos';
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" className={styles.downloadIcon} fill="none" height="18" width="18"
      stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" />
    </svg>
  );
}

function DownloadAction() {
  // Server rendering has no user agent: start on macOS and correct once in the browser.
  const [platform, setPlatform] = useState('macos');
  useEffect(() => setPlatform(platformFor(navigator.userAgent)), []);
  const current = DOWNLOADS[platform];
  const others = Object.keys(DOWNLOADS).filter((k) => k !== platform);

  return (
    <div className={styles.downloadAction}>
      <Link className={styles.primaryButton} to={current.href}>
        <DownloadIcon />
        {current.label}
      </Link>
      <div className={styles.downloadSpec}>{current.spec}</div>
      <div className={styles.downloadAlternatives}>
        Also for{' '}
        {others.map((key, i) => (
          <span key={key}>
            {i > 0 && <span aria-hidden="true"> · </span>}
            <Link to={DOWNLOADS[key].href}>{DOWNLOADS[key].name}</Link>
          </span>
        ))}
        <span aria-hidden="true"> · </span>
        <Link to={RELEASES}>All releases</Link>
      </div>
    </div>
  );
}

function Hero() {
  const demo = useBaseUrl('/demo/pptd-demo.pptd.html');
  return (
    <header className={styles.hero}>
      <p className={styles.eyebrow}>PPTD · presentations by prompting</p>
      <Heading as="h1" className={styles.heroTitle}>
        PowerPoint is <span>Dead</span>
      </Heading>
      <div className={styles.heroSlogan}>Friends don't let friends drag and drop.</div>
      <p className={styles.heroBody}>
        Prompt your slides instead. Tell PPTD what you want to say and an AI agent builds the
        deck while you watch. Then keep prompting: every change appears straight away.
      </p>
      <DownloadAction />

      <div className={styles.demoFrame}>
        <div className={styles.demoBar}>
          <span className={styles.dots} aria-hidden="true"><i /><i /><i /></span>
          <span className={styles.demoName}>pptd-demo.pptd.html</span>
          <a className={styles.demoOpen} href={demo} target="_blank" rel="noopener">Open on its own ↗</a>
        </div>
        <iframe
          className={styles.demoDeck}
          src={demo}
          title="A live PPTD deck about PPTD"
          loading="lazy"
        />
      </div>
      <div className={styles.demoCaption}>
        That's a real PPTD deck, not a screenshot. Click the arrows to page through it.
      </div>
    </header>
  );
}

const PROMPTS = [
  {
    title: 'Ask for a deck',
    prompt: 'Make a 6-slide deck about our Q3 results.',
    body: 'The agent writes the deck and PPTD opens it the moment it is saved. No templates to pick, no boxes to drag.',
  },
  {
    title: 'Talk about what you see',
    prompt: 'Make this shorter and turn it into a chart.',
    body: 'Every message carries the slide on screen, so "this" means this slide. Changes appear in place, and you can keep typing while it works.',
  },
  {
    title: 'Keep your brand',
    prompt: 'Use our colours: #0e8c89 and charcoal.',
    body: 'The agent asks once how your decks should look and uses it from then on. Each deck keeps its own copy, so old decks never change under you.',
  },
];

function Prompts() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>How it works</p>
        <Heading as="h2">You prompt. It builds the slides.</Heading>
      </div>
      <div className={styles.promptGrid}>
        {PROMPTS.map((p, i) => (
          <article className={styles.promptCard} key={p.title}>
            <span className={styles.step}>{i + 1}</span>
            <h3>{p.title}</h3>
            <div className={styles.promptQuote}>
              <span aria-hidden="true">&gt;</span>
              <q>{p.prompt}</q>
            </div>
            <p>{p.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {icon: '⇅', title: 'Edit by hand too', body: 'Drag slides to reorder them. Drop in photos and video. The agent hears about it.'},
  {icon: '↺', title: 'Go back to any prompt', body: 'Optionally keep every prompt with the deck and rewind to any point. Nothing is lost.'},
  {icon: '▶', title: 'Present', body: 'Full screen or in the window, with the keyboard you already know.'},
  {icon: '⧉', title: 'Copy as an image', body: 'Paste a slide into an email or chat, or export every slide as a PNG.'},
];

function Features() {
  return (
    <section className={styles.section}>
      <div className={styles.featureGrid}>
        {FEATURES.map((f) => (
          <article className={styles.featureCard} key={f.title}>
            <span className={styles.featureIcon} aria-hidden="true">{f.icon}</span>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function FileFormat() {
  return (
    <section className={clsx(styles.section, styles.formatSection)}>
      <div className={styles.formatText}>
        <p className={styles.eyebrow}>One file</p>
        <Heading as="h2">Send it the way you'd send a PDF.</Heading>
        <p>
          A deck is a single HTML file with every image and video inside it. It opens in any
          browser, previews in Microsoft Teams and needs nothing installed to view.
        </p>
        <ul>
          <li>No scripts: safe to open anywhere</li>
          <li>Nothing loaded from the internet</li>
          <li>An open, documented format any tool can write</li>
        </ul>
        <Link className={styles.secondaryButton} to="/docs/file-format">Read about the format</Link>
      </div>
      <pre className={styles.formatCode} aria-label="Outline of a deck file">
{`q3-results.pptd.html
<main class="deck">
  <input type="radio" class="slide-radio" id="r1" checked>
  <input type="radio" class="slide-radio" id="r2">
  …
  <section class="slide" id="s1">…</section>
  <section class="slide" id="s2">…</section>
</main>

/* CSS shows the ticked slide */
#r1:checked ~ #s1 { display: flex; }`}
      </pre>
    </section>
  );
}

function Agents() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>The agent</p>
        <Heading as="h2">Nothing else to install.</Heading>
      </div>
      <div className={styles.agentRow}>
        <p>
          PPTD comes with <Link to="https://github.com/earendil-works/pi">Pi</Link>, an
          open-source coding agent, built in. Sign in once with your <strong>ChatGPT</strong> (Plus or
          Pro) or <strong>Claude</strong> (Pro or Max) account, or paste an{' '}
          <strong>Anthropic API key</strong>. Already use <strong>Claude Code</strong>? Choose it
          in View › Agent instead.
        </p>
        <p className={styles.agentMore}>
          <Link to="/docs/pi">More about Pi in PPTD</Link>
        </p>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className={styles.cta}>
      <Heading as="h2">Make your next deck with a prompt.</Heading>
      <p>Free and open source, for macOS, Windows and Linux.</p>
      <Link className={styles.primaryButton} to="/docs/getting-started">Get started</Link>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title="PowerPoint is Dead"
      description="PPTD is a desktop app where an AI agent builds your slides while you watch. Each deck is one HTML file that opens anywhere.">
      <main className={styles.page}>
        <Hero />
        <Prompts />
        <Features />
        <FileFormat />
        <Agents />
        <CTA />
      </main>
    </Layout>
  );
}
