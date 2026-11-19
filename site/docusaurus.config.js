// @ts-check

import {themes as prismThemes} from 'prism-react-renderer';

const repo = 'https://github.com/geirfreysson/pptd';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'PPTD',
  tagline: 'Presentations you make by asking',
  favicon: 'img/pptd-icon.png',

  future: {
    // Not v4: true. Its CSS cascade layers polyfill boosts Infima's :root above the theme
    // in src/css/custom.css, so the teal and fonts never apply.
    v4: {
      removeLegacyPostBuildHeadAttribute: true,
      useCssCascadeLayers: false,
    },
  },

  // GitHub Pages project site. For a custom domain, set url to it, baseUrl to '/',
  // and add static/CNAME.
  url: 'https://geirfreysson.github.io',
  baseUrl: '/pptd/',
  organizationName: 'geirfreysson',
  projectName: 'pptd',
  trailingSlash: false,
  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'PPTD',
        logo: {
          alt: 'PPTD',
          src: 'img/pptd-icon.png',
        },
        items: [
          {type: 'docSidebar', sidebarId: 'docsSidebar', position: 'right', label: 'Docs'},
          {to: '/docs/file-format', label: 'File format', position: 'right'},
          {href: repo, label: 'GitHub', position: 'right'},
          {
            to: '/docs/getting-started',
            label: 'Download',
            position: 'right',
            className: 'navbar-download',
          },
        ],
      },
      footer: {
        style: 'light',
        links: [
          {
            title: 'Documentation',
            items: [
              {label: 'Overview', to: '/docs/intro'},
              {label: 'Getting started', to: '/docs/getting-started'},
              {label: 'Making decks', to: '/docs/making-decks'},
              {label: 'Presenting', to: '/docs/presenting'},
              {label: 'The agent (Pi)', to: '/docs/pi'},
            ],
          },
          {
            title: 'For developers',
            items: [
              {label: 'File format', to: '/docs/file-format'},
              {label: 'Building from source', href: `${repo}/blob/main/docs/development.md`},
            ],
          },
          {
            title: 'Project',
            items: [
              {label: 'GitHub', href: repo},
              {label: 'Releases', href: `${repo}/releases`},
              {label: 'Issues', href: `${repo}/issues`},
            ],
          },
        ],
        copyright: `PPTD is free software under GPL-3.0-or-later.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.nightOwl,
      },
    }),
};

export default config;
