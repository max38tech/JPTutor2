import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.voicetutor',
  appName: 'JP Tutor',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  }
};

export default config;
