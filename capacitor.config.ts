import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.kopamarket.schedulent',
  appName: 'Schedulent',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#6366f1',
    },
    BackgroundGeolocation: {
      // Android: keep alive in background
      disableStopOnTerminate: false,
      startOnBoot: false,
    },
  },
}

export default config
