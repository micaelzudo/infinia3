import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.infinia.marchingcubes',
  appName: 'Marching Cubes 13',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    buildOptions: {
      keystorePath: 'release.keystore',
      keystoreAlias: 'key0',
    },
  },
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*'],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#050510',
      showSpinner: true,
      spinnerColor: '#0078ff',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
