import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.finance.app',
  appName: 'Finance App',
  webDir: 'dist',
  android: {
    path: 'android',
  },
};

export default config;
