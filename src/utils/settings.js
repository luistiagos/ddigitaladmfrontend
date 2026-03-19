const SETTINGS_KEY = 'adminProviderSettings';

const DEFAULTS = {
  meta_access_token: '',
  meta_ad_account_id: '',
  mp_access_token: '',
  stripe_api_key: '',
};

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function hasProvider(provider) {
  const s = getSettings();
  if (provider === 'meta') return !!(s.meta_access_token?.trim() && s.meta_ad_account_id?.trim());
  if (provider === 'mp') return !!s.mp_access_token?.trim();
  if (provider === 'stripe') return !!s.stripe_api_key?.trim();
  return false;
}
