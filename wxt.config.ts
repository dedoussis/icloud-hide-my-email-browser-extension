import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'dist',
  srcDir: '.',
  vite: () => ({
    build: {
      cssMinify: false,
    },
  }),
  manifest: {
    name: 'iCloud Hide My Email',
    description: "Use iCloud's Hide My Email service on Chrome.",
    permissions: [
      'declarativeNetRequest',
      'storage',
      'tabs',
      'contextMenus',
      'webRequest',
      'notifications',
    ],
    host_permissions: [
      'https://*.icloud.com/*',
      'https://*.icloud.com.cn/*',
    ],
    declarative_net_request: {
      rule_resources: [
        {
          id: 'icloud_com_simulation_headers',
          enabled: true,
          path: 'rules.json',
        },
      ],
    },
    icons: {
      '16': '/icon-16.png',
      '32': '/icon-32.png',
      '48': '/icon-48.png',
      '128': '/icon-128.png',
    },
    action: {
      default_icon: '/icon-32.png',
    },
  },
  webExt: {
    disabled: true,
  },
});
