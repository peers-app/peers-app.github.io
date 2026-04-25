import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
  title: "Peers Docs",
  url: "https://peers-app.github.io",
  baseUrl: "/",
  favicon: "img/favicon.svg",
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
        blog: false,
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
        {
          href: "https://peers.app/download",
          label: "Download",
          position: "right",
        },
        {
          href: "https://peers.app/privacy",
          label: "Privacy",
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
      style: "dark",
      links: [
        {
          title: "Product",
          items: [
            {
              label: "Home",
              href: "https://peers.app/landing",
            },
            {
              label: "Download",
              href: "https://peers.app/download",
            },
            {
              label: "Privacy",
              href: "https://peers.app/privacy",
            },
            {
              label: "Open app",
              href: "https://peers.app/?app",
            },
          ],
        },
        {
          title: "Developers",
          items: [
            {
              label: "Documentation",
              to: "/",
            },
            {
              label: "GitHub",
              href: "https://github.com/peers-app",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Peers.`,
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
