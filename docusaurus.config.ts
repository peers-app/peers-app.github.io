import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'Peers App Docs',
  url: 'https://peers-app.github.io',
  baseUrl: '/',
  favicon: 'img/favicon.svg',
  organizationName: 'peers-app', // GitHub org
  projectName: 'peers-app.github.io', // repo
  deploymentBranch: 'gh-pages',
  onBrokenLinks: 'warn',

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.ts'),
          editUrl: undefined
        },
        blog: false,
        theme: {}
      }
    ]
  ],

  themeConfig: {
    navbar: {
      title: 'Peers App',
      items: [
        { to: '/', label: 'Docs', position: 'left' },
        { href: 'https://github.com/peers-app', label: 'GitHub', position: 'right' }
      ]
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula
    }
  }
};

export default config;