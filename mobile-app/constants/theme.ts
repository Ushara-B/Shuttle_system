/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#111827',
    background: '#FFFFFF',
    tint: '#4F46E5',
    icon: '#6B7280',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#4F46E5',
    primary: '#4F46E5',
    secondary: '#10B981',
    border: '#E5E7EB',
    error: '#EF4444',
    card: '#F9FAFB',
  },
  dark: {
    text: '#F9FAFB',
    background: '#111827',
    tint: '#818CF8',
    icon: '#94A3B8',
    tabIconDefault: '#4B5563',
    tabIconSelected: '#818CF8',
    primary: '#818CF8',
    secondary: '#34D399',
    border: '#374151',
    error: '#F87171',
    card: '#1F2937',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
