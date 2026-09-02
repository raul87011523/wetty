# Voice Terminal — estado y continuación

Documento de traspaso. Si abres una sesión nueva de Claude en la ASUS, **lee esto
primero**: dice qué está hecho, qué está probado de verdad, qué no, y las trampas
del repo que ya han costado tiempo una vez.

Manual de usuario: [`docs/voice-terminal.md`](docs/voice-terminal.md).
Propuesta original: `~/Development/asd2/propuesta_wetty_voice_terminal.md` (en la otra laptop).

---

## 1. Dónde está el código

| | |
|---|---|
| Repo | `/home/raul/Development/wetty2` (laptop de origen) |
| Rama | `feat/voice-terminal` |
| Base | commit `6da8262` de `dev` |
| Remoto | `https://github.com/raul87011523/wetty.git` |

**El trabajo puede estar aún sin commitear en la laptop de origen.** Si en la ASUS
no ves la rama, es que falta el traspaso: `git push -u origin feat/voice-terminal`
desde la laptop de origen, y aquí `git fetch && git checkout feat/voice-terminal`.

---

## 2. Qué se implementó

Los tres contratos de la propuesta, cada uno sustituible sin tocar los otros:

```
SpeechToText   audio  -> text            POST {base}/api/stt            -> whisper.cpp
TextCorrector  text   -> corrected_text  POST {base}/api/voice/correct  -> diccionario + Ollama
TerminalWriter text   -> xterm.js        term.paste(text)   (sin Enter, nunca)
```

### Ficheros nuevos

| Fichero | Qué hace |
|---|---|
| `src/client/wetty/voice/index.ts` | Orquestador: las tres etapas, expone `window.voice*`, ancla la barra al viewport |
| `src/client/wetty/voice/recorder.ts` | `getUserMedia` + `MediaRecorder`, y codifica **WAV 16 kHz mono en el navegador** |
| `src/client/wetty/voice/buffer.ts` | Máquina de estados y DOM de la barra |
| `src/client/wetty/voice/hotkey.ts` | Doble toque de Ctrl |
| `src/client/wetty/voice/api.ts` | `fetch` a los endpoints, resolviendo el base path |
| `src/server/voice/stt.ts` | Proxy al whisper-server (`POST /inference`) |
| `src/server/voice/correct.ts` | Diccionario, luego Ollama, con fallback al diccionario |
| `src/server/voice/dictionary.ts` | Sustituciones deterministas, longest-match-first |
| `src/server/socketServer/api/voice.ts` | Router de las dos rutas |
| `src/assets/scss/voice.scss` | Estilos, `position: fixed` como `#functions` |
| `conf/voice-dictionary.json5` | 36 entradas Odoo/Python/git editables sin recompilar |
| `docker/Dockerfile.local` | Build desde el working copy (`COPY`) en vez de `git clone` |
| `docker/docker-compose.voice.yml` | wetty + whisper + ollama |

### Ficheros modificados

`src/shared/{interfaces,defaults,config}.ts` (config `Voice`), `src/main.ts` (flags),
`src/server.ts` y `src/server/socketServer.ts` (hilado y montaje de rutas),
`src/server/socketServer/html.ts` (marcado de la barra),
`src/client/wetty.ts` (arranque), `src/client/wetty/term.ts` (solo 4 líneas: declaraciones
de `window`), `src/assets/scss/styles.scss`, `conf/config.json5`.

Fuera del repo: `~/Development/nginx/html/wetty.html` (https + `allow="microphone"`).

---

## 3. Qué está probado y qué no

### Verificado ejecutándolo

Arrancando `node build/main.js --base / --port 3001 …` en la laptop de origen:

- Diccionario: `busca en res partner … company type` -> `res.partner … company_type`
- Longest-match: `sale order line` -> `sale.order.line` (no `sale.order line`)
- `/api/stt` con whisper caído -> **HTTP 503**; cuerpo vacío -> **HTTP 400**
- Corrección con Ollama caído -> **HTTP 200 con el resultado del diccionario**, 72 ms
- Corrección con Ollama real (CPU, qwen2.5-coder:7b) -> `Busca en res.partner los que
  tengan company_type 'company'`, 4,9 s con el modelo ya cargado
- La barra aparece en el HTML con `data-hotkey="double-ctrl"`
- `mocha`: 17 tests pasando. Lint y tipos limpios en los ficheros nuevos

### NO verificado — esto es lo que hay que probar en la ASUS

1. **Micrófono y grabación.** Todo `recorder.ts` está sin ejecutar: `getUserMedia`,
   `MediaRecorder`, y sobre todo la conversión a WAV 16 kHz
   (`decodeAudioData` -> `OfflineAudioContext` -> cabecera WAV). Necesita HTTPS y un
   navegador real. **Es el punto de mayor riesgo de todo el cambio.**
2. **El doble toque de Ctrl.** Cuatro casos: que inicie y pare; que `Ctrl+C` dos veces
   **no** lo dispare; que funcione con el foco en la terminal y en el `<textarea>`; y
   que se ignore con el Ctrl del teclado en pantalla armado.
3. **whisper.cpp.** Nunca se ha ejecutado. El tag `ghcr.io/ggml-org/whisper.cpp:main-cuda`
   del compose **está sin confirmar** — verifícalo antes del primer `up`. Cualquier
   servidor que exponga `POST /inference` y devuelva `{"text": "..."}` sirve igual.
4. **GPU en Docker.** La laptop de origen no tiene driver NVIDIA, nada de la ruta CUDA
   se ha podido probar.
5. **El certificado.** Sigue siendo el viejo `CN=None` sin SAN, que Chrome rechaza.
6. **Móvil.** Que la barra siga visible con el teclado virtual abierto (usa la
   VisualViewport API) y que el arrastre no pelee con el scroll.
7. **La prueba de seguridad**: meter un salto de línea en el buffer y confirmar que al
   Enviar **no se ejecuta nada**.

---

## 4. Trampas del repo (esto ya costó tiempo)

1. **`objectAssign` en `src/shared/config.ts` descarta claves.** Itera sobre
   `Object.entries(source)`, así que **toda clave de la interfaz que no enumeres en
   `mergeCliConf` desaparece**. Así se perdió `llmTimeout` y la corrección caía siempre
   al diccionario. Si añades un campo a `Voice`, añádelo también ahí.
2. **`core.autocrlf=true`**: el working tree está en **CRLF** y el repo guarda LF. Si
   editas con Python/Node, abre con `newline=''` o convierte, o reescribirás el fichero
   entero. La regla `linebreak-style` de eslint exige LF y por eso **falla en todos los
   ficheros del repo**, no solo en los nuevos; para lintar de verdad usa
   `--rule '{"linebreak-style":"off"}'`.
3. **Errores de tipos preexistentes**: 40 en `src/client/wetty/term.ts`
   (`keepTerminalActive`, `_core`, nulls) y 2 en `src/shared/config.ts` (temas). **No son
   del cambio de voz.** El typechecker de `build.js` es un *warning*, no bloquea el build.
   No los arreglé: quedan fuera de alcance.
4. **Con `--base /`, `trim()` deja `basePath = ''`**, que `app.use()` no acepta como
   ruta de montaje; de ahí el `basePath || '/'` en `socketServer.ts`. Es el caso real
   del contenedor en producción, pruébalo así.
5. **`build.js` tiene los entry points fijos** (`src/client/wetty.ts`, `src/client/dev.ts`),
   sin globbing: un módulo de cliente nuevo solo entra si se importa desde `wetty.ts`.
6. **`voiceToolbar()` se llama en cada `socket.on('connect')`**, incluidas reconexiones;
   por eso es idempotente vía `root.dataset.mounted`.
7. **`node_modules` no está instalado en `wetty2`.** Para verificar usé temporalmente el
   del clon `wetty/` con un symlink, y lo retiré. Necesitas `pnpm install` (la ruta Docker
   no lo necesita, `Dockerfile.local` instala dentro de la imagen).

---

## 5. Decisiones de diseño y por qué

- **Doble Ctrl, no `Ctrl+Tab`.** Chrome y Firefox reservan `Ctrl+Tab` para cambiar de
  pestaña y no lo entregan de forma fiable a la página; `preventDefault()` no lo detiene.
  Ctrl a secas no está reservado y **no envía nada a la shell por sí solo**, así que no
  hace falta `preventDefault()` ni interfiere con el tecleo.
- **`term.paste()`, no `term.input()` con corchetes a mano.** xterm.js solo aplica
  *bracketed paste* si la aplicación remota activó el modo 2004, así que degrada bien
  solo. Los saltos de línea se normalizan a espacios **antes** de pasarlo: `paste()`
  convierte `\n` en `\r`, que ejecutaría el comando.
- **Sin multer.** `express.raw({type:'audio/wav'})` y el cliente sube el WAV como cuerpo
  crudo. Una dependencia menos, mismo contrato.
- **WAV en el navegador, no ffmpeg en el servidor.** whisper-server quiere WAV 16-bit y
  el navegador da webm/opus; convirtiendo en el cliente, ffmpeg no aparece en ningún sitio.
- **Diccionario antes del LLM, y el LLM nunca es obligatorio.** La capa 1 es determinista
  e instantánea y cubre el caso Odoo; la 2 solo pule. Si Ollama falla o expira se devuelve
  la capa 1 con HTTP 200, nunca un error.
- **Enviar no ejecuta.** No hay ningún `'\x0A'` en la ruta de voz. El Enter lo pulsa la
  persona.

---

## 6. Puesta en marcha en la ASUS

Asumo Windows + WSL2 con Docker nativo dentro de la distro (no Docker Desktop), como en
la laptop de origen.

### 6.1 GPU en contenedores (una sola vez)

En WSL2 el driver no se instala en Linux: lo aporta Windows y aparece como
`/usr/lib/wsl/lib/libcuda.so.1`. Para que los **contenedores** lo vean hace falta además
el NVIDIA Container Toolkit dentro de la distro:

```bash
nvidia-smi                      # debe responder dentro de WSL2
# instalar nvidia-container-toolkit desde el repo de NVIDIA, luego:
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
docker run --rm --gpus all ubuntu nvidia-smi    # comprobación
```

### 6.2 Certificado con SAN

El actual (`~/.ssl/wetty.crt`) tiene `CN=None` y **sin SAN**; Chrome lo rechaza de
entrada. Regénralo con la IP/hostname reales de la ASUS:

```bash
mkdir -p ~/.ssl
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout ~/.ssl/wetty.key -out ~/.ssl/wetty.crt \
  -subj "/CN=wetty.local" \
  -addext "subjectAltName=DNS:wetty.local,IP:<IP-DE-LA-ASUS>,IP:127.0.0.1"
```

### 6.3 Modelo de whisper

El volumen `whisper-models` arranca vacío; hay que dejar el `.bin` dentro:

```bash
docker compose -f docker/docker-compose.voice.yml run --rm --entrypoint sh whisper -c \
  "wget -O /models/ggml-small.bin \
   https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
```

(Confirma nombre de fichero y URL; también sirve `models/download-ggml-model.sh small`
del propio whisper.cpp.)

### 6.4 Levantar

```bash
cd wetty2
docker compose -f docker/docker-compose.voice.yml up --build
docker compose -f docker/docker-compose.voice.yml exec ollama ollama pull qwen2.5-coder:3b
```

Variables que acepta el compose: `TMATE_HOST`, `TMATE_PORT`, `LLM_MODEL`,
`WHISPER_MODEL`, `WHISPER_LANG`, `OLLAMA_KEEP_ALIVE`.

**Confirma el destino de tmate**: el contenedor en producción usa
`--ssh-host 192.168.1.4 --ssh-port 2200`, pero `~/.tmate.conf` de la laptop de origen
apunta a `192.168.1.3:2200`. Ajusta `TMATE_HOST` a lo que corresponda desde la ASUS.

### 6.5 Reparto de VRAM

whisper y Ollama comparten tarjeta. `qwen2.5-coder:7b` en Q4 son ~4,7 GB y no cabe en
4 GB ni estando solo. De ahí `qwen2.5-coder:3b` por defecto y `OLLAMA_KEEP_ALIVE=30s`,
para que libere la VRAM entre dictados. Si la GPU de la ASUS tiene más memoria de la que
supuse (asumí la GTX 1050 Ti de 4 GB del GL503GE), se puede subir el modelo: es una
opción de configuración, no un cambio de diseño.

---

## 7. Desarrollo sin Docker

```bash
pnpm install
pnpm build                                   # el typechecker avisa, no bloquea
node build/main.js --base / --port 3001 --conf conf/config.json5 \
  --corrector-mode dictionary --stt-url http://127.0.0.1:9
```

Comprobación rápida de los endpoints:

```bash
curl -s -X POST http://localhost:3001/api/voice/correct \
  -H 'Content-Type: application/json' \
  -d '{"text":"busca en res partner los que tengan company type company"}'
# -> {"text":"busca en res.partner los que tengan company_type company"}
```

Aviso al probar a mano: si lanzas el servidor en segundo plano desde una herramienta con
timeout, úsalo con `setsid` o morirá con el grupo de procesos.

---

## 8. Fuera de alcance (evolución futura, §11 de la propuesta)

Modos conversación/código/shell/agente, detección de la aplicación en ejecución
(vim/psql/codex), botón `Ejecutar` separado y traducción de lenguaje natural a comando.
La arquitectura de tres contratos los admite después sin rehacer nada.
