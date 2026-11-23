import { CardTheme } from '../types/pacing';

export interface ThemeTokens {
  headerBg: string;
  bodyBg: string;
  hoverBorder: string;
  chipBg: string;
  badgeBg: string;
  badgeText: string;
  label: string;
}

export const CARD_THEMES: Record<CardTheme, ThemeTokens> = {
  navy: {
    headerBg: 'bg-[#283B73]',
    bodyBg: 'bg-[#354E96]',
    hoverBorder: 'hover:ring-[#283B73]/30',
    chipBg: 'bg-[#20305E]',
    badgeBg: 'bg-[#EEF2FA]',
    badgeText: 'text-[#283B73]',
    label: 'Classic Navy',
  },
  teal: {
    headerBg: 'bg-[#008678]',
    bodyBg: 'bg-[#009C8B]',
    hoverBorder: 'hover:ring-[#008678]/30',
    chipBg: 'bg-[#006B60]',
    badgeBg: 'bg-[#E6F7F5]',
    badgeText: 'text-[#006B60]',
    label: 'Emerald Teal',
  },
  indigo: {
    headerBg: 'bg-[#3730A3]',
    bodyBg: 'bg-[#4338CA]',
    hoverBorder: 'hover:ring-[#3730A3]/30',
    chipBg: 'bg-[#29237A]',
    badgeBg: 'bg-[#EEF2FF]',
    badgeText: 'text-[#3730A3]',
    label: 'Royal Indigo',
  },
  plum: {
    headerBg: 'bg-[#6B21A8]',
    bodyBg: 'bg-[#7E22CE]',
    hoverBorder: 'hover:ring-[#6B21A8]/30',
    chipBg: 'bg-[#521882]',
    badgeBg: 'bg-[#F5EEFD]',
    badgeText: 'text-[#6B21A8]',
    label: 'Deep Plum',
  },
  slate: {
    headerBg: 'bg-[#334155]',
    bodyBg: 'bg-[#475569]',
    hoverBorder: 'hover:ring-[#334155]/30',
    chipBg: 'bg-[#1E293B]',
    badgeBg: 'bg-[#F1F5F9]',
    badgeText: 'text-[#334155]',
    label: 'Warm Slate',
  },
};
