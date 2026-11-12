export const defaults = { theme: 'clair', color: '#b8f0de', navigation: 'burger', features: { aide: true, premium: true } };
export type Variant = typeof defaults;
export function normalize(value: unknown): Variant {
  const v = value as Partial<Variant> | null;
  return { theme: ['clair', 'nuit', 'papier'].includes(v?.theme || '') ? v!.theme! : defaults.theme,
    color: /^#[0-9a-f]{6}$/i.test(v?.color || '') ? v!.color! : defaults.color,
    navigation: ['burger', 'visible', 'compacte'].includes(v?.navigation || '') ? v!.navigation! : defaults.navigation,
    features: { aide: typeof v?.features?.aide === 'boolean' ? v.features.aide : true, premium: typeof v?.features?.premium === 'boolean' ? v.features.premium : true } };
}
export function readVariant(): Variant {
  try { return normalize(JSON.parse(localStorage.getItem('flemme.beta.v1') || 'null')); } catch { return normalize(null); }
}
