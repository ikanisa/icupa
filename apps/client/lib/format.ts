import type { MenuLocation } from '../data/menu';

export const centsToCurrency = (value: number, locale = 'en', currency: MenuLocation['currency'] = 'RWF') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(value / 100);
};

export const formatMinutes = (minutes: number) => {
  if (minutes < 1) {
    return '<1 min';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainder}m`;
};

export const percentageLabel = (value: number) => `${value}%`;
