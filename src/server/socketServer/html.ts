import { isDev } from '../../shared/env.js';
import type { Request, Response, RequestHandler } from 'express';

const jsFiles = isDev ? ['dev.js', 'wetty.js'] : ['wetty.js'];

const render = (
  title: string,
  base: string,
): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <link rel="icon" type="image/x-icon" href="${base}/client/favicon.ico">
    <title>${title}</title>
    <link rel="stylesheet" href="${base}/client/wetty.css" />
  </head>
  <body>
    <div id="overlay">
      <div class="error">
        <div id="msg"></div>
        <input type="button" onclick="location.reload();" value="reconnect" />
      </div>
    </div>
    <div id="options">
      <a class="toggler"
         href="#"
         alt="Toggle options"
       ><i class="fas fa-cogs"></i></a>
      <iframe class="editor" src="${base}/client/xterm_config/index.html"></iframe>
    </div>
    <div id="functions">
      <a class="toggler"
         href="#"
         alt="Toggle options"
         onclick="window.toggleFunctions()"
       ><i class="fas fa-keyboard"></i></a>
      <div class="onscreen-buttons">
        <a
          href="#"
          alt="Esc"
          onclick="window.pressESC()"
        >
          <div>
	    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <text text-anchor="middle" dominant-baseline="middle" font-size="14" fill="#fff" font-family="monospace" font-weight="bold" y="57%" x="50%">Esc</text>
	    </svg>
          </div>
        </a>
        <a
          href="#"
          alt="Up"
          onclick="window.pressUP()"
        >
          <div>
	    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
	      <path d="M12 7.5l8 8-1.41 1.42L12 10.33l-6.59 6.59L4 15.5z"/>
	    </svg>
          </div>
        </a>
        <a
          href="#"
          alt="Tab"
          onclick="window.pressTAB()"
        >
          <div>
	    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <text text-anchor="middle" dominant-baseline="middle" font-size="14" fill="#fff" font-family="monospace" font-weight="bold" y="57%" x="50%">Tab</text>
	    </svg>
          </div>
        </a>
        <a
          href="#"
          alt="Left"
          onclick="window.pressLEFT()"
        >
          <div>
	    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7.5 12l8-8 1.42 1.41L10.33 12l6.59 6.59-1.42 1.41z"/>
	    </svg>
          </div>
        </a>
        <a
          hr ef="#"
          alt="Down"
          onclick="window.pressDOWN()"
        >
          <div>
	    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 16.5l-8-8 1.41-1.42L12 13.67l6.59-6.59L20 8.5z"/>
            </svg>
          </div>
        </a>
        <a
          href="#"
          alt="Right"
          onclick="window.pressRIGHT()"
        >
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
	      <path d="M16.5 12l-8-8-1.41 1.41L13.67 12l-6.58 6.59 1.41 1.41z"/>
            </svg>
          </div>
        </a>
        <a
          id="onscreen-ctrl"
          href="#"
          alt="Ctrl"
          onclick="window.toggleCTRL()"
        >
          <div>
	    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <text text-anchor="middle" dominant-baseline="middle" font-size="14" fill="#fff" font-family="monospace" font-weight="bold" y="57%" x="50%">Ctl</text>
	    </svg>
          </div>
        </a>
        <a
	  id="onscreen-alt"
          href="#"
          alt="Alt"
          onclick="window.toggleALT()"
        >
          <div>
	    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <text text-anchor="middle" dominant-baseline="middle" font-size="14" fill="#fff" font-family="monospace" font-weight="bold" y="57%" x="50%">Alt</text>
	    </svg>
          </div>
        </a>
        <a
          href="#"
          alt="Ent"
          onclick="window.pressENTER()"
        >
          <div>
	    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <text text-anchor="middle" dominant-baseline="middle" font-size="14" fill="#fff" font-family="monospace" font-weight="bold" y="57%" x="50%">Int</text>
	    </svg>
          </div>
        </a>
      </div>
    </div>
    <div id="terminal"></div>
    ${jsFiles
        .map(file => `    <script type="module" src="${base}/client/${file}"></script>`)
        .join('\n')
    }
  </body>
</html>`;

export const html = (base: string, title: string): RequestHandler => (
  _req: Request,
  res: Response,
): void => {
  res.send(
    render(
      title,
      base,
    ),
  );
};
