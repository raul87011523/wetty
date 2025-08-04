function optionGenericGet() {
  return this.el.querySelector('input').value;
}
function optionGenericSet(value) {
  this.el.querySelector('input').value = value;
}
function optionEnumCreate(value) {
  const select = this.el.querySelector('select');
  if (select.options.length === 0) {
    for (const item of getThemes()) {
      const option = document.createElement('option');
      option.value = value;
      option.text = value;
      select.appendChild(option);
    }
  }
}
function optionEnumGet() {
  return this.el.querySelector('select').value;
}
function optionEnumSet(value) {
  optionEnumCreate(value);
  this.el.querySelector('select').value = value;
}
function optionBoolGet() {
  return this.el.querySelector('input').checked;
}
function optionBoolSet(value) {
  this.el.querySelector('input').checked = value;
}
function optionNumberGet() {
  let value = (this.float === true ? parseFloat : parseInt)(
    this.el.querySelector('input').value,
  );
  if (Number.isNaN(value) || typeof value !== 'number') value = 0;
  if (typeof this.min === 'number') value = Math.max(value, this.min);
  if (typeof this.max === 'number') value = Math.min(value, this.max);
  return value;
}
function optionNumberSet(value) {
  this.el.querySelector('input').value = value;
}

const allOptions = [];
/* eslint-disable @typescript-eslint/no-unused-vars */

function inflateOptions(optionsSchema) {
  const booleanOption = document.querySelector('#boolean_option.templ');
  const enumOption = document.querySelector('#enum_option.templ');
  const textOption = document.querySelector('#text_option.templ');
  const numberOption = document.querySelector('#number_option.templ');
  const colorOption = document.querySelector('#color_option.templ');

  function copyOver({ children }) {
    while (children.length > 0) document.body.append(children[0]);
  }

  optionsSchema.forEach(option => {
    let el;
    option.get = optionGenericGet.bind(option);
    option.set = optionGenericSet.bind(option);

    switch (option.type) {
      case 'boolean':
        el = booleanOption.cloneNode(true);
        option.get = optionBoolGet.bind(option);
        option.set = optionBoolSet.bind(option);
        break;

      case 'enum':
        el = enumOption.cloneNode(true);
        option.enum.forEach(varriant => {
          const optionEl = document.createElement('option');
          optionEl.innerText = varriant;
          optionEl.value = varriant;
          el.querySelector('select').appendChild(optionEl);
        });
        if (option.path[2] == 'theme'){
          el.querySelector('select').dataset.isTheme = 'true';
        }
        option.get = optionEnumGet.bind(option);
        option.set = optionEnumSet.bind(option);
        break;

      case 'text':
        el = textOption.cloneNode(true);
        break;

      case 'number':
        el = numberOption.cloneNode(true);
        if (option.float === true)
          el.querySelector('input').setAttribute('step', '0.001');
        option.get = optionNumberGet.bind(option);
        option.set = optionNumberSet.bind(option);
        if (typeof option.min === 'number')
          el.querySelector('input').setAttribute('min', option.min.toString());
        if (typeof option.max === 'number')
          el.querySelector('input').setAttribute('max', option.max.toString());
        break;

      case 'color':
        el = colorOption.cloneNode(true);
        break;

      default:
        throw new Error(`Unknown option type ${option.type}`);
    }

    el.querySelector('.title').innerText = option.name;
    el.querySelector('.desc').innerText = option.description;
    [option.el] = el.children;
    copyOver(el);
    allOptions.push(option);
  });
}

function getItem(json, path) {
  const mypath = path[0];
  if (path.length === 1) return json[mypath];
  if (json[mypath] != null) return getItem(json[mypath], path.slice(1));
  return null;
}
function setItem(json, path, item) {
  const mypath = path[0];
  if (path.length === 1) json[mypath] = item;
  else {
    if (json[mypath] == null) json[mypath] = {};
    setItem(json[mypath], path.slice(1), item);
  }
}

function getThemes(){
  const themes = window.wetty_get_themes?.() || {};
  return Object.keys(themes); 
}

window.loadOptions = config => {
  allOptions.forEach(option => {
    if (option.name === 'Theme') {
      option.enum = getThemes();
    }
    let value = getItem(config, option.path);
    if (option.nullable === true && option.type === 'text' && value == null)
      value = null;
    else if (
      option.nullable === true &&
      option.type === 'number' &&
      value == null
    )
      value = -1;
    else if (value == null) return;
    if (option.json === true && option.type === 'text')
      value = JSON.stringify(value);
    option.set(value);
    option.el.classList.remove('unbounded');
  });
};

if (window.top === window)
  // eslint-disable-next-line no-alert
  alert(
    'Error: Page is top level. This page is supposed to be accessed from inside WeTTY.',
  );

function saveConfig(ev) {
  const newConfig = {};
  allOptions.forEach(option => {
    let newValue = option.get();
    if (
      option.nullable === true &&
      ((option.type === 'text' && newValue === '') ||
        (option.type === 'number' && newValue < 0))
    )
      return;
    if (option.json === true && option.type === 'text')
      newValue = JSON.parse(newValue);
    setItem(newConfig, option.path, newValue);
  });
  if (ev.target.dataset.isTheme === 'true') {
    const name = ev.target.value;
    const themes = window.wetty_get_themes?.() || {};
    if (themes[name]) {
      newConfig.xterm.theme = themes[name];
    }
  }
  window.wetty_save_config(newConfig);
}

window.addEventListener('input', () => {
  const els = document.querySelectorAll('input, select');
  for (let i = 0; i < els.length; i += 1) {
    els[i].addEventListener('input', saveConfig);
  }
});
