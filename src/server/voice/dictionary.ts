import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import findUp from 'find-up';
import fs from 'fs-extra';
import JSON5 from 'json5';
import { logger } from '../../shared/logger.js';

const packageRoot = dirname(
  findUp.sync('package.json', {
    cwd: dirname(fileURLToPath(import.meta.url)),
  }) || process.cwd(),
);

/**
 * Spoken form -> written form. Kept in code so the corrector still does
 * something useful when no dictionary file is shipped with the container.
 * The file pointed at by `voice.dictionaryPath` is merged on top of this.
 */
const builtin: Record<string, string> = {
  'res partner': 'res.partner',
  'sale order': 'sale.order',
  'purchase order': 'purchase.order',
  'account move': 'account.move',
  'stock picking': 'stock.picking',
  'pos order': 'pos.order',
  'product template': 'product.template',
  'product product': 'product.product',
  'company type': 'company_type',
  'many to many': 'Many2many',
  'many to one': 'Many2one',
  'one to many': 'One2many',
  'guion bajo': '_',
  'punto py': '.py',
};

type Rule = { pattern: RegExp; replacement: string };

const escape = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build a case insensitive, whitespace tolerant matcher for a spoken phrase.
 * `res partner` matches `res  partner` and `Res Partner` alike.
 */
const toRule = (phrase: string, replacement: string): Rule => ({
  pattern: new RegExp(
    `\\b${phrase.trim().split(/\s+/).map(escape).join('\\s+')}\\b`,
    'giu',
  ),
  replacement,
});

const compile = (entries: Record<string, string>): Rule[] =>
  Object.entries(entries)
    // Longest phrases first so `product template` wins over `product`.
    .sort(([a], [b]) => b.length - a.length)
    .map(([phrase, replacement]) => toRule(phrase, replacement));

let rules: Rule[] = compile(builtin);

/**
 * Load the dictionary file and merge it over the builtin entries.
 * A missing or broken file is not fatal: the builtin rules keep working.
 *
 * @param dictionaryPath - path to a JSON5 file, relative paths resolve to the package root
 */
export async function loadDictionary(dictionaryPath: string): Promise<void> {
  const path = dictionaryPath
    ? resolve(packageRoot, dictionaryPath)
    : resolve(packageRoot, 'conf', 'voice-dictionary.json5');
  try {
    const content = await fs.readFile(path, 'utf-8');
    const parsed = JSON5.parse(content) as Record<string, string>;
    rules = compile({ ...builtin, ...parsed });
    logger().info('Voice dictionary loaded', {
      path,
      entries: Object.keys(parsed).length,
    });
  } catch (err) {
    logger().warn('Voice dictionary not loaded, using builtin entries only', {
      path,
      message: (err as Error)?.message,
    });
  }
}

/**
 * Replace spoken technical terms with their written form.
 * Deterministic and instant, so it works with the LLM stopped.
 *
 * @param text - raw transcript
 * @returns transcript with technical identifiers substituted
 */
export const applyDictionary = (text: string): string =>
  rules.reduce(
    // Function replacement so `$&` inside a replacement stays literal.
    (acc, { pattern, replacement }) => acc.replace(pattern, () => replacement),
    text,
  );
