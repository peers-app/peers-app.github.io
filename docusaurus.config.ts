import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
  title: "Peers Docs",
  url: "https://peers-app.github.io",
  baseUrl: "/",
  favicon: "img/favicon.ico",
  organizationName: "peers-app", // GitHub org
  projectName: "peers-app.github.io", // repo
  deploymentBranch: "gh-pages",
  onBrokenLinks: "warn",

  markdown: {
    mermaid: true,
  },

  themes: ["@docusaurus/theme-mermaid"],

  presets: [
    [
      "classic",
      {
        docs: {
          path: "docs",
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.ts"),
          editUrl: undefined,
        },
        blog: {
          blogTitle: "Peers Blog",
          blogDescription: "Thoughts on local-first, peer-to-peer, and decentralized software",
          routeBasePath: "blog",
          showReadingTime: true,
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: "dark",
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "Peers",
      logo: {
        alt: "Peers",
        src: "img/peers-mark.png",
        href: "https://peers.app/landing",
        style: { borderRadius: "8px" },
      },
      items: [
        { to: "/", label: "Docs", position: "left" },
        { to: "/blog", label: "Blog", position: "left" },
        {
          href: "https://peers.app/download",
          label: "Download",
          position: "right",
        },
        {
          href: "https://peers.app/?app",
          label: "Open app",
          position: "right",
        },
        {
          href: "https://github.com/peers-app",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      copyright: `<div class="peers-footer-row">
  <span class="peers-footer-row__copy">&copy; ${new Date().getFullYear()} Peers. All rights reserved.</span>
  <nav class="peers-footer-row__nav" aria-label="Footer">
    <a href="https://peers.app/landing">Home</a>
    <a href="https://peers.app/download">Download</a>
    <a href="https://peers.app/?app">Open app</a>
    <a href="https://github.com/peers-app" target="_blank" rel="noopener noreferrer">GitHub</a>
  </nav>
</div>`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
    },
    mermaid: {
      theme: {
        light: "neutral",
        dark: "dark",
      },
    },
  },
};

export default config;
