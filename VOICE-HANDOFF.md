# Voice Terminal — estado y continuación

Documento de traspaso. **Lee esto primero**: dice qué está hecho, qué está
probado de verdad, qué no, y las trampas del repo que ya han costado tiempo.

Actualizado el 2026-09-02 en la ASUS, tras poner el stack en marcha y cerrar los
siete puntos que quedaban sin verificar.

Manual de usuario: [`docs/voice-terminal.md`](docs/voice-terminal.md).
Propuesta original: `~/Development/asd2/propuesta_wetty_voice_terminal.md` (en la otra laptop).

---

## 1. Dónde está el código

| | |
|---|---|
| Repo | `/home/raul/projects/wetty2` (ASUS) — origen: `/home/raul/Development/wetty2` |
| Rama | `feat/voice-terminal` |
| Base | commit `6da8262` de `dev` |
| Remoto | `https://github.com/raul87011523/wetty.git` |

El traspaso ya está hecho: la rama está en la ASUS sobre el commit `9f81bfe`.

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
| `src/client/wetty/voice/hotkey.ts` | Registra los cuatro atajos: acordes y doble toque de Ctrl |
| `src/client/wetty/voice/api.ts` | `fetch` a los endpoints, resolviendo el base path |
| `src/server/voice/stt.ts` | Proxy al whisper-server (`POST /inference`) |
| `src/server/voice/correct.ts` | Diccionario, luego Ollama, con fallback al diccionario |
| `src/server/voice/dictionary.ts` | Sustituciones deterministas, longest-match-first |
| `src/server/socketServer/api/voice.ts` | Router de las dos rutas |
| `src/assets/scss/voice.scss` | Estilos, `position: fixed` como `#functions` |
| `conf/voice-dictionary.json5` | 36 entradas Odoo/Python/git editables sin recompilar |
| `docker/Dockerfile.local` | Build desde el working copy (`COPY`) en vez de `git clone` |
| `src/shared/hotkey.ts` | Gramática, parser y matcher de atajos. Puro, lo comparten servidor y cliente |
| `docker/Dockerfile.whisper-pascal` | whisper.cpp compilado para `sm_61` (Pascal), CUDA 12.6 |
| `docker/docker-compose.voice.yml` | wetty + whisper + ollama, construyendo aquí |
| `docker/docker-compose.registry.yml` | el mismo stack tirando de las imágenes del registry |

### Ficheros modificados

`src/shared/{interfaces,defaults,config}.ts` (config `Voice`), `src/main.ts` (flags),
`src/server.ts` y `src/server/socketServer.ts` (hilado y montaje de rutas),
`src/server/socketServer/html.ts` (marcado de la barra),
`src/client/wetty.ts` (arranque), `src/client/wetty/term.ts` (solo 4 líneas: declaraciones
de `window`), `src/assets/scss/styles.scss`, `conf/config.json5`.

Fuera del repo: `~/Development/nginx/html/wetty.html` (https + `allow="microphone"`).

---

## 3. Qué está probado y qué no

### Verificado en la laptop de origen

Arrancando `node build/main.js --base / --port 3001 …`:

- Diccionario: `busca en res partner … company type` -> `res.partner … company_type`
- Longest-match: `sale order line` -> `sale.order.line` (no `sale.order line`)
- `/api/stt` con whisper caído -> **HTTP 503**; cuerpo vacío -> **HTTP 400**
- Corrección con Ollama caído -> **HTTP 200 con el resultado del diccionario**
- La barra aparece en el HTML con `data-hotkey="double-ctrl"`
- `mocha`: 17 tests pasando. Lint y tipos limpios en los ficheros nuevos

### Verificado en la ASUS (2026-09-02), stack completo en Docker

Los siete puntos que quedaban pendientes están cerrados. Todo lo de abajo se
comprobó **ejecutándolo** contra `docker/docker-compose.voice.yml`, con Chrome
headless dirigido por puppeteer dentro de la red del compose.

1. **Micrófono y grabación — el WAV es correcto.** Fuente a 44100 Hz -> WAV
   **16000 Hz mono 16-bit**: `RIFF`/`WAVE`, subchunks `fmt `/`data`, PCM,
   byte rate 32000, block align 2, `RIFF size` = total-8, `data size` = total-44,
   y duración 10,98 s frente a 11,00 s del original. Whisper transcribió habla
   real desde ese WAV. La cadena `decodeAudioData` -> `OfflineAudioContext` ->
   `encodeWav` se ejecutó de verdad.
   **Lo único que sigue sin probarse es la línea `getUserMedia`**: en un
   contenedor no hay micrófono y ningún flag de Chrome crea uno falso
   (`enumerateDevices()` devuelve `[]`, `getUserMedia` da `NotFoundError`), así
   que esa llamada se sustituyó por un `MediaStream` sintético de Web Audio.
   Necesita un micro real para cerrarse del todo.
2. **Doble toque de Ctrl — los 7 casos.** Inicia y para; con el foco en la
   terminal y en el `<textarea>`; `Ctrl+C` dos veces no dispara; se ignora con
   `#onscreen-ctrl` armado; dos toques a más de 400 ms no disparan; el Ctrl
   mantenido (autorepeat) tampoco.
3. **whisper.cpp — en GPU con imagen propia.** El tag
   `ghcr.io/ggml-org/whisper.cpp:main-cuda` existe y su `entrypoint`
   `/app/build/bin/whisper-server` es correcto, pero **no sirve para una
   Pascal** (§4.8). Con `docker/Dockerfile.whisper-pascal`:
   `CUDA : ARCHS = 610`, backend CUDA0, y **1,06 s de extremo a extremo por
   `/api/stt`** para 11 s de audio, frente a 5,0 s del mismo modelo en CPU.
4. **GPU en Docker.** Funciona sin instalar nada: ver §6.1. Whisper y Ollama
   corren los dos en la tarjeta a la vez sin pelearse.
5. **El certificado.** Regenerado con SAN. Ver §6.2.
6. **Móvil.** En 390x844 la barra es `position: fixed`, `z-index: 21`, no
   desborda el ancho. Simulando un teclado virtual de 336 px, `followViewport`
   aplica `bottom: 336px` y el borde inferior de la barra queda exactamente en
   el límite visible; al cerrarse vuelve a `0px`. Abierta mide 149 px de alto y
   los tres botones son de 99x36.
   **La otra mitad de este punto era falsa**: no hay ninguna lógica de arrastre
   en el código (ni `pointerdown`, ni `touchstart`), así que no hay conflicto
   posible con el scroll.
7. **La prueba de seguridad — pasa end-to-end.** Con
   `"lista los ficheros\nrm -rf /\r\nid"` en el buffer, lo que llega a
   `term.paste` es `"lista los ficheros rm -rf / id"`.
   Y el riesgo **no era hipotético**: whisper devuelve saltos de línea reales en
   su salida (`"…para ti.\n Puedes preguntar…"`), así que la garantía depende
   enteramente de `singleLine()`. Residuo menor: `U+0085` (NEL) no lo cubre `\s`
   en JS y atraviesa la normalización intacto; no ejecuta nada, porque llega al
   PTY como UTF-8 `0xC2 0x85` y no como `0x0A`.

Sigue sin probarse, y necesita hardware real: dictado con un micrófono de
verdad, y la barra con el teclado virtual físico de un móvil.

---

## 3.bis Atajos de teclado (2026-09-02)

Las cuatro acciones de la barra tienen atajo configurable
(`hotkeyToggle`/`hotkeyDictate`/`hotkeyCorrect`/`hotkeySend`). Campos **planos**,
no anidados: `Voice` tiene index signature y `loadConfigFile` hace merge shallow,
así que un objeto anidado dejaría en `undefined` los atajos no configurados.

**La elección de teclas se midió, no se dedujo**, espiando `term.onData` contra
el stack real:

| Combinación | Byte al shell |
|---|---|
| `ctrl+shift+<letra>`, `ctrl+shift+space` | **nada** |
| `alt+shift+<letra>` | `ESC`+letra (en vim sale del modo inserción) |
| `ctrl+shift+enter` | `0x0d` CR — **ejecutaría el comando** |
| `ctrl+shift+-` | `0x1f` |
| `ctrl+shift+2` | NUL |
| `ctrl+shift+6` | nada (al contrario de lo que se suponía) |

De ahí la familia `Ctrl+Shift` pese a perder las iniciales mnemotécnicas: no se
fuga nada al shell ni aunque el manejador no llegue a montarse. Las tres últimas
están en la lista de rechazadas del validador.

**Configurables desde la interfaz** (engranaje -> *Voice Shortcuts*), no sólo
desde el fichero. El editor es `src/assets/xterm_config/`, un sistema declarativo
(`inflateOptions`) con opciones por `path`; la sección de voz vive en
`wetty_voice_options.js`. La validación **no se reimplementa ahí**: el padre le
inyecta `wetty_validate_hotkey` al iframe, igual que ya hacía con
`wetty_get_themes`, así que la gramática sigue estando sólo en `shared/hotkey.ts`.
El valor efectivo es el de `localStorage` si parsea, y si no el del servidor.

Trampa del editor que costó un rato: **el primer evento `input` sólo engancha
`saveConfig` a los controles** (`functionality.js` lo hace desde un listener de
`window`), así que hace falta un segundo evento para que guarde de verdad. Con
una persona tecleando es invisible; automatizándolo, no.

Detalles que conviene no perder:

- El matcher usa **`event.code`, no `event.key`**, y compara los modificadores de
  forma **exacta**. Eso es lo que impide que AltGr (que en Windows activa `ctrl`
  y `alt` a la vez) dispare un binding `alt+…`.
- Se consume con `preventDefault()` **y** `stopPropagation()`. El segundo es el
  que hace el trabajo: xterm escucha en su propio textarea y no consulta
  `defaultPrevented`, así que parar el evento en captura sobre `document` es lo
  que lo mantiene lejos del shell.
- El guard mira `#onscreen-ctrl` **y** `#onscreen-alt` armados. Lo segundo es
  necesario por el bug de §4.10.
- Validación **en el servidor al arrancar**: un valor inválido avisa y cae al
  default, nunca tumba el proceso ni muere en silencio en el navegador.
- `voice.hotkey` sigue aceptándose como alias obsoleto de `hotkeyDictate`.

**Sin tests automáticos**: se verificó ejecutándolo (los cuatro acordes disparan
su acción y no mandan un solo byte; `Ctrl+D` sigue dando `0x04` y `Ctrl+C`
`0x03`). Quedan pendientes los specs de mocha del parser.

---

## 4. Trampas del repo (esto ya costó tiempo)

1. **`objectAssign` en `src/shared/config.ts` descarta claves.** Itera sobre
   `Object.entries(source)`, así que **toda clave de la interfaz que no enumeres en
   `mergeCliConf` desaparece**. Así se perdió `llmTimeout` y la corrección caía siempre
   al diccionario. Si añades un campo a `Voice`, añádelo también ahí.
2. **Finales de línea: depende de la máquina, compruébalo.** En la laptop de origen
   `core.autocrlf=true` dejaba el working tree en **CRLF**. **En la ASUS no**:
   `core.autocrlf` no está definido en ningún scope y el checkout es LF. Verifica con
   `grep -c $'\r$' <fichero>` antes de editar, y si editas con Python/Node abre con
   `newline=''` para no reescribir el fichero entero. La regla `linebreak-style` de
   eslint exige LF; para lintar de verdad usa `--rule '{"linebreak-style":"off"}'`.
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
7. **El build de Docker falla sin `node-gyp`.** `node-pty@0.10.1` lanza el binario
   `node-gyp` **por PATH** desde su `scripts/install.js`. `npm` lo trae incorporado,
   pero el Dockerfile instala pnpm y usa `pnpm install`, y **pnpm no expone
   `node-gyp`**. Sin él el build muere con `spawn node-gyp ENOENT`, que despista
   porque parece un fallo de compilación. De ahí el `npm install -g pnpm node-gyp`
   en `Dockerfile.local`. Las dependencias de compilación (`python3`, `make`,
   `build-essential`) ya estaban bien.
8. **La imagen `whisper.cpp:main-cuda` no sirve para una Pascal.** Está compilada
   para archs `750/800/860/900` (Turing en adelante). En la GTX 1050 Ti (`6.1`)
   **carga el modelo y reserva los buffers sin quejarse**, y aborta en la primera
   inferencia:
   `ggml_cuda_compute_forward: IM2COL failed` / `CUDA error: no kernel image is
   available for execution on the device`. Que `ggml_cuda_init` encuentre la tarjeta
   **no prueba nada**; el fallo sólo aparece al lanzar el primer kernel. Por eso
   existe `docker/Dockerfile.whisper-pascal`, que compila con
   `CMAKE_CUDA_ARCHITECTURES=61`. Y tiene que ser **CUDA 12.x**: CUDA 13 retiró
   Pascal y su `nvcc` ya no sabe generar `sm_61`.
   Ese Dockerfile tropezó dos veces, y las dos están resueltas dentro:
   *(a)* `ggml-cuda` llama a la API **driver** (`cuGetErrorString`, VMM) pero no
   la enlaza, así que el enlazado muere con `undefined reference`. Se arregla
   apuntando a `/usr/local/cuda/lib64/stubs`; el stub tiene `SONAME
   libcuda.so.1`, de modo que **no se empotra**: queda la dependencia que
   satisface el driver real que inyecta `--gpus`.
   *(b)* Recolectar las librerías con `find -type f` **descarta los symlinks de
   los SONAME** y el binario muere con
   `libwhisper.so.1: cannot open shared object file`. De ahí el `ldconfig -n`
   en la etapa de runtime.
9. **`term.ts:167`: `simulateALTAndKey(e.key)` está FUERA del `if`.** Con el Alt
   del teclado en pantalla armado, cualquier tecla manda `ESC` + el nombre completo
   de la tecla al shell (`\x1bArrowLeft`, `\x1bShift`), y las alfanuméricas se
   mandan **dos veces**. Es corrupción hacia una shell, no cosmética. **No está
   arreglado** (fuera de alcance), y por eso el guard de los atajos tiene que
   mirar el Alt armado además del Ctrl.
10. **`node_modules` no está instalado en `wetty2`.** Para verificar usé temporalmente el
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
  persona. Y hace falta de verdad: whisper devuelve saltos de línea en su salida.
- **Imagen propia de whisper en vez de la oficial.** La de upstream no arranca kernels
  en Pascal. Como puente se usó `--no-gpu` en la misma imagen (funciona: 5,0 s por
  `/api/stt` para 11 s de audio con `small` y 8 hilos), y luego se compiló para `sm_61`,
  que baja a 1,06 s. El contrato no cambia: cualquier servidor con `POST /inference` que
  devuelva `{"text": "..."}` sigue valiendo, así que volver a CPU es sólo añadir `-ng` al
  `command` del servicio.

---

## 6. Puesta en marcha (verificado en la ASUS, 2026-09-02)

El entorno real resultó distinto de lo que se asumía. Lo de abajo está
comprobado en la máquina, no supuesto.

| | |
|---|---|
| GPU | **GTX 1050 Ti, 4096 MiB** (la suposición era correcta) |
| Driver | 582.28 (Windows), CUDA 13.0, `/usr/lib/wsl/lib/libcuda.so.1` presente |
| Docker | **Docker Desktop 4.88.1**, no Docker nativo en la distro |
| IP de la LAN | `192.168.1.58` (Windows). WSL2 está tras NAT en `172.17.100.147` |
| tmate | **`192.168.1.8:2200`** (Pi5), banner `SSH-2.0-tmate` |

### 6.1 GPU en contenedores: no hay nada que hacer

Con Docker Desktop el demonio **no corre en esta distro**, así que
`nvidia-ctk runtime configure` escribiría un `/etc/docker/daemon.json` que nadie
lee. **No instales el NVIDIA Container Toolkit.** El runtime ya viene
registrado; compruébalo así:

```bash
docker info | grep Runtimes           # -> io.containerd.runc.v2 nvidia runc
docker run --rm --gpus all ubuntu nvidia-smi
```

### 6.2 Certificado con SAN

`~/.ssl` no existía; se crea de cero. El compose monta `${HOME}/.ssl:/ssl:ro`,
así que tiene que existir **antes** del `up`.

```bash
mkdir -p ~/.ssl
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout ~/.ssl/wetty.key -out ~/.ssl/wetty.crt \
  -subj "/CN=wetty.local" \
  -addext "subjectAltName=DNS:wetty.local,DNS:localhost,IP:192.168.1.58,IP:172.17.100.147,IP:127.0.0.1"
```

El contenedor corre como root, así que lee la clave en 0600 sin problema.

### 6.3 Modelo de whisper

```bash
docker compose -f docker/docker-compose.voice.yml run --rm --entrypoint sh whisper -c \
  "wget -O /models/ggml-small.bin \
   https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
```

URL verificada: 487.601.967 bytes. La imagen trae `wget` y `curl`.

### 6.4 Levantar

```bash
cd wetty2
TMATE_HOST=192.168.1.8 TMATE_PORT=2200 \
  docker compose -f docker/docker-compose.voice.yml up -d --build
docker compose -f docker/docker-compose.voice.yml exec ollama ollama pull qwen2.5-coder:3b
```

El primer `--build` compila whisper.cpp desde fuente para `sm_61` y **tarda**
(descarga ~4 GB de bases CUDA 12.6 y compila los kernels). Después queda cacheado
en la imagen `whisper:pascal`.

Variables: `TMATE_HOST`, `TMATE_PORT`, `LLM_MODEL`, `WHISPER_MODEL`,
`WHISPER_LANG`, `WHISPER_THREADS`, `OLLAMA_KEEP_ALIVE`.

**Ojo con los puertos y la VRAM**: si tienes `open-webui` corriendo ocupa el
3000, y cualquier otro Ollama (el del host en `127.0.0.1:11434`, o el que trae
open-webui) compite por los mismos 4 GB.

### 6.5 Reparto de VRAM

Medido con whisper **y** Ollama los dos en la tarjeta: **2954 / 4096 MiB**, algo
más de 1 GB libre, y la transcripción sigue en 0,89 s con el LLM residente.
Whisper ocupa 837 MiB con `ggml-small`. `qwen2.5-coder:3b` entra con holgura; el
`7b` en Q4 (~4,7 GB) no cabe ni estando solo, de ahí el `3b` por defecto y
`OLLAMA_KEEP_ALIVE=30s`.

## 6.6 Imágenes publicadas en el registry del Pi5

Las tres imágenes están en `http://192.168.1.8:5000` (Registry v2, **HTTP
plano**, sin autenticación), así que no hay que reconstruirlas:

```
192.168.1.8:5000/wetty:voice       código del commit ca21291
192.168.1.8:5000/whisper:pascal    nuestra build para sm_61, la cara de rehacer
192.168.1.8:5000/ollama:voice      espejo de la oficial, sin modificar
```

Para levantar el stack desde ellas, sin repo ni compilador:

```bash
docker compose -f docker/docker-compose.registry.yml up -d
```

**Requisito en el cliente Docker**: al ser HTTP plano hay que declararlo como
inseguro o el demonio lo rechaza con
`http: server gave HTTP response to HTTPS client`. En Docker Desktop va en
*Settings → Docker Engine*:

```json
{ "insecure-registries": ["192.168.1.8:5000"] }
```

Si no quieres reiniciar Docker, `crane` empuja sin pasar por el demonio:
`docker run --rm -v /tmp:/data gcr.io/go-containerregistry/crane push --insecure /data/img.tar <destino>`.

### Qué NO va dentro de las imágenes, y por qué

- **El certificado TLS.** La clave privada acabaría en una imagen que cualquiera
  con acceso al registry puede descargar, y el SAN lleva una IP concreta, así
  que tampoco serviría en otra máquina. Se monta desde `~/.ssl`, o se regenera
  con el §6.2.
- **Los modelos.** Están sin modificar —el `ggml-small.bin` mide exactamente los
  487.601.967 bytes del publicado en HuggingFace, y el de Ollama es el
  `qwen2.5-coder:3b` oficial (`f72c60cabf62`)— así que no hay nada propio que
  preservar y mantenerlos fuera ahorra ~2,4 GB. Se recuperan con el §6.3 y con
  `ollama pull`.

### Una trampa si alguna vez piensas en `docker commit`

No sirve para este stack: **omite el contenido de las rutas montadas**, y
`/models` y `/root/.ollama` son volúmenes. Commitear los contenedores en marcha
daría imágenes con los modelos **vacíos**, más temporales de ejecución, y sin
ser reproducibles desde el repo.

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
