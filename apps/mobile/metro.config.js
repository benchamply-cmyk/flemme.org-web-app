// Metro ne lit par défaut que apps/mobile : on lui ajoute packages/shared (règles, accès aux données, état de l’app),
// et on résout les dépendances (react…) depuis apps/mobile/node_modules, car packages/shared n’en a pas.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../../packages/shared')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
module.exports = config;
