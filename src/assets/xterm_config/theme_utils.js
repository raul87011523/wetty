/**
 * [EN] Returns an array with the names of all JSON files in the 'theme' directory.
 * [ES] Devuelve un array con los nombres de todos los archivos JSON en el directorio 'theme'.
 */

export async function getThemeNames() {
  const response = await fetch('/api/themes');
  return await response.json();
}

/**
 * [EN] Given a filename, loads and parses its JSON content from the 'theme' directory.
 * [ES] Dado un nombre de archivo, carga y parsea su contenido JSON desde el directorio 'theme'.
 * @param {string} filename - The name of the JSON file (e.g., 'reader.json')
 */
export async function loadTheme(filename) {
    const response = await fetch(`/api/themes/${filename}`);
    return await response.json();
}
