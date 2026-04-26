import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const VISIBLE_TEXT_FILES = [
  'index.html',
  'move-test.html',
  'shot-test.html',
  'rally-test.html',
  'src/js/hud.js',
  'src/js/main.js',
  'src/js/screens.js',
  'src/js/exercises.js',
  'src/js/evaluate.js',
  'src/js/logic/tactical-engine.js',
  'src/js/logic/feedback-engine.js',
  'data/positioning.json',
  'data/shots.json',
  'data/matches.json',
];

const FRENCH_VISIBLE_TEXT = /\b(Retour|Entraînement|Clique|Saisis|Défense|Attaque|Rejouer|Précision|Revers|Légende|Reprendre|TOUR|Ce tour|Tir|Malus|Mot de passe|Deconnexion|bonnes réponses|moitié|terrain|partenaire|adversaire|volant|Atelier|bientot|bientôt|défense|côte|Dégage|Bloque|réponses|près|loin)\b|[àâçéèêëîïôùûüÿœ’]/i;

function stripComments(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('visible user-facing text is English', async () => {
  const offenders = [];

  for (const file of VISIBLE_TEXT_FILES) {
    const source = stripComments(await readFile(path.join(process.cwd(), file), 'utf8'));
    if (FRENCH_VISIBLE_TEXT.test(source)) offenders.push(file);
  }

  assert.deepEqual(offenders, []);
});
