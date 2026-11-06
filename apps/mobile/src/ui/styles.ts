import { Platform, StyleSheet } from 'react-native';

// Habillage V0.4 retenu par Ben pour le site (5 novembre 2026), repris de apps/web/src/site/site.css et styles.css :
// fond blanc et rubans chromés en haut, en-tête encre et menthe, titres en casse normale,
// boutons glacier et menthe, cartes contour noir, accent bleu acier, pied de page nuit.
export const v04 = {
  encre: '#16131f', texteDoux: '#3f3a55', violet: '#3a2fa0', vertLogo: '#57d68d', menthe: '#b8f0de',
  glacier: '#d2e4ff', glacierClair: '#e6efff', ciel: '#a5ccff', peche: '#ffd9c2', nuit: '#0f0d18', acier: '#3a4f7a',
  blanc: '#ffffff', doux: '#f3f7ff', erreur: '#f8e9e4',
} as const;
const c = v04;
// Archivo dans le navigateur (chargée par la page) ; police système grasse sur iOS et Android.
const police = Platform.OS === 'web' ? 'Archivo, "Helvetica Neue", Arial, sans-serif' : undefined;
const mono = Platform.OS === 'ios' ? 'Menlo' : Platform.OS === 'android' ? 'monospace' : 'ui-monospace, Menlo, monospace';
// Ombre des boutons et cartes : bleu glacier (demande de Ben, 6 novembre 2026), plus la violette du site.
const ombre = '4px 5px 0 #a5ccff';

export const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: c.blanc },
  // En-tête : bandeau blanc à rubans chromés, logo, Déléguer, menu.
  bandeau: { backgroundColor: c.blanc, overflow: 'hidden', position: 'relative', zIndex: 10 },
  rubanHaut: { position: 'absolute', top: -46, left: -60, width: '78%', height: 92, transform: [{ rotate: '-8deg' }], backgroundImage: 'linear-gradient(100deg, #e5edf5 0%, #ffffff 25%, #a9c9e8 43%, #ffffff 51%, #d8e1ee 70%, #ffffff 87%)', boxShadow: '0 14px 26px rgba(100,128,155,.15)' },
  rubanBas: { position: 'absolute', bottom: -40, right: -50, width: '62%', height: 70, transform: [{ rotate: '-10deg' }], backgroundImage: 'linear-gradient(100deg, #ffffff 0%, #d4e3f4 22%, #ffffff 40%, #a4c7e7 67%, #ffffff 83%, #cad8e8 100%)', boxShadow: '0 -12px 26px rgba(100,128,155,.15)' },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 22 },
  logo: { height: 40, paddingHorizontal: 9, flexShrink: 0, borderRadius: 12, borderWidth: 2.5, borderColor: c.encre, backgroundColor: c.vertLogo, justifyContent: 'center' },
  logoTexte: { fontFamily: police, fontWeight: '900', fontSize: 18, letterSpacing: -1, color: c.encre },
  pastille: { height: 40, paddingHorizontal: 12, flexShrink: 1, borderRadius: 999, borderWidth: 2, borderColor: c.encre, backgroundColor: c.glacier, boxShadow: '3px 4px 0 #a5ccff', flexDirection: 'row', alignItems: 'center', gap: 6 },
  pastilleTexte: { fontFamily: police, fontWeight: '800', fontSize: 14, color: c.encre },
  pastilleIcone: { fontSize: 18, fontWeight: '700', color: c.encre, lineHeight: 20 },
  burger: { width: 40, height: 40, flexShrink: 0, borderRadius: 20, borderWidth: 2, borderColor: c.encre, backgroundColor: c.menthe, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  // Loupe à côté du menu ; le menu garde marginLeft auto, la loupe le précède.
  loupe: { backgroundColor: c.blanc, marginLeft: 'auto' },
  recherche: { backgroundColor: c.menthe, gap: 10 },
  rechercheBarre: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.blanc, borderWidth: 2, borderColor: c.encre, borderRadius: 999, paddingHorizontal: 14, minHeight: 42 },
  rechercheChamp: { flex: 1, color: c.encre, fontFamily: police, fontSize: 15, paddingVertical: 8, outlineWidth: 0 },
  carres: { width: 18, height: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  carre: { width: 7, height: 7, borderRadius: 2.5, borderWidth: 2, borderColor: c.encre },
  menu: { position: 'absolute', right: 16, top: 66, minWidth: 220, backgroundColor: c.blanc, borderWidth: 2, borderColor: c.encre, borderRadius: 18, padding: 8, boxShadow: '0 18px 40px rgba(22,19,31,.25)', zIndex: 20 },
  menuLien: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  menuLienActif: { backgroundColor: c.glacierClair },
  menuTexte: { fontFamily: police, fontWeight: '700', fontSize: 15, color: c.encre },
  // Contenu
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center', flexGrow: 1 },
  home: { flex: 1, justifyContent: 'center', gap: 30, paddingVertical: 24 },
  homeIntro: { gap: 8 }, homeChoices: { gap: 18, paddingRight: 6, paddingBottom: 8 },
  homeChoice: { backgroundColor: c.glacier, borderColor: c.encre, borderWidth: 2.5, boxShadow: ombre, borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18, minHeight: 96, justifyContent: 'center', gap: 6 },
  homeChoiceSecondary: { backgroundColor: c.menthe },
  homeIcon: { color: c.encre, fontSize: 20 },
  homeChoiceTitle: { color: c.encre, fontFamily: police, fontSize: 18, fontWeight: '900', lineHeight: 22, letterSpacing: .3, textTransform: 'uppercase' },
  homeChoiceHint: { color: c.encre, fontFamily: police, fontSize: 13, lineHeight: 18 },
  heading: { color: c.encre, fontFamily: police, fontWeight: '900', fontSize: 27, lineHeight: 31, letterSpacing: -.8, marginVertical: 6 },
  body: { color: c.encre, fontFamily: police, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  muted: { color: c.texteDoux, fontFamily: police, fontSize: 13, lineHeight: 19 },
  strong: { color: c.encre, fontFamily: police, fontWeight: '700', fontSize: 14, flexShrink: 1 },
  price: { color: c.encre, fontFamily: police, fontSize: 18, fontWeight: '700' },
  eyebrow: { color: c.acier, fontFamily: mono, fontSize: 11, letterSpacing: 1.4, fontWeight: '700', textTransform: 'uppercase' },
  // Boutons pilules : glacier (principal) ou blanc (secondaire), contour encre, texte encre en capitales.
  button: { backgroundColor: c.glacier, borderColor: c.encre, borderWidth: 2, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center', marginVertical: 2, boxShadow: '2px 3px 0 #a5ccff' },
  buttonText: { color: c.encre, fontFamily: police, textTransform: 'uppercase', letterSpacing: .4, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  secondary: { backgroundColor: c.blanc }, secondaryText: { color: c.encre },
  small: { minHeight: 34, paddingVertical: 6, paddingHorizontal: 12, flexGrow: 1 }, smallText: { fontSize: 12 },
  card: { borderRadius: 18, borderColor: c.encre, borderWidth: 2, backgroundColor: c.blanc, padding: 17, gap: 12 },
  propose: { backgroundColor: c.menthe, borderWidth: 2.5, boxShadow: ombre },
  cardTitle: { fontSize: 16, fontWeight: '700', fontFamily: police, color: c.encre, lineHeight: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '800', fontFamily: police, textTransform: 'uppercase', color: c.encre, marginTop: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  tag: { fontSize: 11, fontWeight: '800', fontFamily: police, textTransform: 'uppercase', backgroundColor: c.glacierClair, color: c.encre, borderWidth: 2, borderColor: c.encre, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, alignSelf: 'flex-start', overflow: 'hidden' },
  tagWarn: { backgroundColor: c.peche },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  link: { color: c.encre, fontFamily: police, fontWeight: '600', fontSize: 14, paddingVertical: 4 },
  inlineLink: { color: c.encre, fontWeight: '600', textDecorationLine: 'underline' },
  field: { gap: 7, marginTop: 6 }, label: { color: c.encre, fontFamily: police, fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: c.doux, borderRadius: 14, borderColor: c.encre, borderWidth: 2, padding: 11, color: c.encre, fontFamily: police, fontSize: 15, minHeight: 44 },
  inputOnMint: { backgroundColor: c.blanc },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  note: { color: c.texteDoux, fontFamily: police, fontSize: 12, lineHeight: 18 },
  divider: { height: 1, backgroundColor: c.encre },
  bubble: { backgroundColor: c.doux, borderRadius: 15, padding: 16, gap: 6 },
  history: { borderLeftWidth: 2, borderColor: c.ciel, paddingLeft: 14 },
  option: { borderRadius: 16, borderWidth: 2, borderColor: c.encre, paddingVertical: 10, paddingHorizontal: 12, minHeight: 38, justifyContent: 'center', backgroundColor: c.blanc },
  optionSelected: { backgroundColor: c.glacier, boxShadow: '2px 3px 0 #a5ccff' },
  check: { flexDirection: 'row', gap: 10, alignItems: 'center', marginVertical: 8 },
  checkBox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: c.encre, backgroundColor: c.blanc, alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: c.menthe },
  error: { padding: 14, backgroundColor: c.erreur, borderRadius: 12 },
  notice: { padding: 14, backgroundColor: c.ciel, borderColor: c.encre, borderWidth: 1, borderRadius: 12 },
  profileHead: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatarPhoto: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.encre, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarLettre: { color: c.ciel, fontWeight: '800', fontSize: 26 },
  // Pied de page nuit
  pied: { backgroundColor: c.nuit, paddingVertical: 10, paddingHorizontal: 16 },
  piedTexte: { textAlign: 'center', fontSize: 11, color: c.glacier, fontFamily: police },
});
