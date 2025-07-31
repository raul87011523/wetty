const fs = require('fs');
const path = require('path');

const THEME_DIR = path.join(__dirname, 'themes');

/**
 * [EN] Returns an array with the names of all JSON files in the 'theme' directory.
 * [ES] Devuelve un array con los nombres de todos los archivos JSON en el directorio 'theme'.
 */
function getThemeNames() {
    return fs.readdirSync(THEME_DIR)
        .filter(file => file.endsWith('.json'))
	.map(file => file.replace(/\.json$/, ''));
}

/**
 * [EN] Given a filename, loads and parses its JSON content from the 'theme' directory.
 * [ES] Dado un nombre de archivo, carga y parsea su contenido JSON desde el directorio 'theme'.
 * @param {string} filename - The name of the JSON file (e.g., 'reader.json')
 */
function loadTheme(filename) {
    const filePath = path.join(THEME_DIR, filename);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
}

module.exports = {
    getThemeNames,
    loadTheme,
};
