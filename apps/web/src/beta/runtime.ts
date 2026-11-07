import { betaEnabled, readVariant } from './config.ts';
import './variants.css';
if (betaEnabled) {
  const apply = () => {
    const v = readVariant(), root = document.documentElement;
    root.dataset.betaTheme = v.theme; root.dataset.betaNav = v.navigation;
    document.querySelectorAll<HTMLDetailsElement>('details.burger').forEach(e => { if (v.navigation === 'visible') e.open = true; });
    root.style.setProperty('--beta-accent', v.color);
    document.querySelectorAll<HTMLElement>('a[href="premium.html"], [data-beta-feature="premium"]').forEach(e => e.hidden = !v.features.premium);
    document.querySelectorAll<HTMLElement>('a[href="#aide"], [data-beta-feature="aide"]').forEach(e => e.hidden = !v.features.aide);
  };
  apply(); addEventListener('storage', apply);
  new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
}
