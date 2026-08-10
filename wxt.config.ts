import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'App/API Version to GitHub',
    version: '4.0.0',
    description:
      "Instantly jump from deployed version strings to their GitHub commits. Great for tracking what's running in production.",
    // Chrome accepts a string here; WXT's manifest type comes from Firefox's schema
    author: 'Aren Patel' as unknown as { email: string },
    homepage_url: 'https://github.com/aren55555/version-chrome-ext',
    permissions: ['activeTab', 'storage'],
    icons: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    action: {
      default_title: 'App/API Version to GitHub',
    },
  },
  zip: {
    artifactTemplate: 'version-chrome-ext-v{{version}}.zip',
  },
});
