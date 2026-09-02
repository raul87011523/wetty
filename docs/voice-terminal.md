# Wetty Voice Terminal — manual

Terminal web con dictado por voz. Abres Wetty desde cualquier dispositivo con navegador
y micrófono, hablas, revisas la transcripción y la escribes en la terminal.

El audio **no viaja por tmate**. El micrófono pertenece al dispositivo que abre el
navegador: ahí se captura y se convierte a texto, y a la terminal solo llega texto. tmate
sigue transportando únicamente la sesión.

```
PC / portátil / móvil / tablet
        |  HTTPS
        v
  Wetty  --- microfono -> STT -> [Dictar | Corregir | Enviar] -> xterm.js
        |
        v
     tmate -> tmux / shell / Neovim / Codex
```

---

## La regla que gobierna todo

```
voz -> texto -> revisión -> terminal
```

y **nunca**:

```
voz -> comando -> ejecución
```

**Enviar escribe, no ejecuta.** El texto queda en el prompt y el Enter lo pulsas tú.
Es deliberado: te deja leer un `rm`, un `git reset` o un `DROP` antes de que corra.
No hay ninguna ruta en la que la voz ejecute algo por su cuenta.

---

## Uso

La barra vive abajo. Se abre con el icono del micrófono, a la derecha.

### Dictar

**Ctrl+Shift+Space** (o el botón `Dictar`) empieza a grabar. **Otra pulsación de
Ctrl para.** La misma acción inicia y termina: la grabación nunca se corta sola, así que
nada se transcribe ni se envía sin que tú lo decidas.

Al parar, el audio va al servicio de voz y el texto aparece en el cuadro. Ahí **puedes
editarlo a mano**; es un `textarea` normal.

> `Ctrl+Shift+<tecla>` no envía nada a la shell, comprobado espiando `term.onData`,
> así que el atajo no interfiere con el tecleo ni aunque su manejador fallara.
> `Ctrl+C` dos veces seguidas **no** activa el dictado: si entre los dos toques se pulsa
> cualquier otra tecla, la secuencia se descarta.

Dictar otra vez **añade** al texto que ya haya, no lo reemplaza: puedes dictar por partes.

### Corregir

Pasa el texto por dos capas:

1. **Diccionario técnico** — sustituciones deterministas e instantáneas:
   `res partner` -> `res.partner`, `company type` -> `company_type`,
   `many to many` -> `Many2many`, `pos multi seller` -> `pos_multi_seller`…
2. **Modelo de lenguaje local** — puntuación, mayúsculas y errores de reconocimiento.

Ejemplo real:

```
dictado:   busca en res partner los que tengan company type company
corregido: Busca en res.partner los que tengan company_type 'company'
```

Es opcional. Si la transcripción ya está bien, ve directo a Enviar.

Si el modelo está caído o tarda demasiado, **Corregir no falla**: devuelve el resultado
del diccionario. La capa 1 nunca depende de la 2.

### Enviar

Escribe el texto en la terminal como si lo hubieras tecleado, **sin Enter**.

Los saltos de línea se convierten en espacios antes de escribir. Esto no es cosmético:
un `\n` suelto ejecutaría el comando, y es lo que garantiza que Enviar no ejecute.

Cuando la aplicación remota lo soporta se usa *bracketed paste*, así que Codex, Vim o
psql lo reciben como un pegado y no como tecleo.

### Flujo típico

```
Dictar -> Enviar                  cuando la transcripción sale bien
Dictar -> Corregir -> Enviar      cuando hace falta pulirla
```

Con Codex el valor es evidente: en vez de teclear una instrucción larga, la hablas.

---

## Requisitos

- **HTTPS obligatorio.** Los navegadores bloquean el micrófono en contextos no seguros.
  Por `http://` la barra aparece pero al dictar avisa de que hace falta HTTPS.
- Navegador con `MediaRecorder`: Chrome, Edge o Firefox de escritorio, y Chrome en
  Android. En iOS el soporte es irregular.
- Permiso de micrófono concedido al sitio.
- El dispositivo **no necesita** instalar tmate, whisper ni nada: solo el navegador.

---

## Configuración

Tres formas, de menos a más prioridad: variables de entorno, `conf/config.json5`, flags
de línea de comandos.

### Bloque de `conf/config.json5`

```json5
voice: {
  enabled:        true,
  hotkeyToggle:   'ctrl+shift+l',                // abrir/cerrar la barra
  hotkeyDictate:  'ctrl+shift+space',            // dictar
  hotkeyCorrect:  'ctrl+shift+f',                // corregir
  hotkeySend:     'ctrl+shift+x',                // enviar
  sttUrl:         'http://whisper:8080',
  correctorMode:  'both',                        // 'dictionary' | 'llm' | 'both'
  llmUrl:         'http://ollama:11434',
  llmModel:       'qwen2.5-coder:3b',
  dictionaryPath: 'conf/voice-dictionary.json5',
}
```

### Atajos de teclado

Se cambian **desde la propia interfaz**: pulsa el engranaje y busca la sección
**Voice Shortcuts**. Los cuatro campos validan mientras escribes y el cambio se
aplica **al instante**, sin recargar; el atajo activo aparece entre paréntesis en
los botones de la barra.

Lo que configures ahí se guarda en el navegador (`localStorage`) y **manda sobre
lo que traiga el servidor**, pero sólo si es válido: un atajo mal escrito vuelve
al del servidor en vez de dejar la acción sin forma de invocarla. Deja un campo
vacío para volver al valor del servidor.

Cada acción acepta un acorde (`ctrl+shift+f`), el valor especial `double-ctrl`
(doble toque de Ctrl) o `none` para desactivarla. No distingue mayúsculas ni el
orden de los modificadores, y admite alias (`control`, `cmd`, `option`, `esc`,
`return`). **Hace falta al menos un modificador**: una tecla suelta pertenece a
la terminal.

Las letras nombran **posiciones de un teclado US**, porque el emparejado usa
`event.code`. Es lo que hace que el atajo no cambie al cambiar de distribución.

Estas combinaciones se rechazan, y el motivo se midió contra la terminal real:

| Combinación | Por qué |
|---|---|
| `ctrl+shift+enter` | La terminal la lee como Enter (`0x0d`): ejecutaría el comando |
| `ctrl+shift+-` | La terminal la lee como `0x1f` |
| `ctrl+shift+2` | La terminal la lee como NUL |
| `ctrl+shift+c` | Ya es el atajo de copiar |

Evita también lo que se queda el navegador (`ctrl+shift+` t, n, w, i, j, p…) y la
familia `alt+shift`, que **sí se fuga** a la shell como `ESC`+letra: en vim eso
sale del modo inserción.

Un valor inválido no tumba el servidor: sale un aviso en el log y se usa el valor
por defecto.

### Referencia

| Opción | Flag | Variable | Por defecto |
|---|---|---|---|
| `enabled` | `--voice` / `--no-voice` | `VOICE_ENABLED` | `true` |
| `hotkeyToggle` | `--voice-hotkey-toggle` | `VOICE_HOTKEY_TOGGLE` | `ctrl+shift+l` |
| `hotkeyDictate` | `--voice-hotkey-dictate` | `VOICE_HOTKEY_DICTATE` | `ctrl+shift+space` |
| `hotkeyCorrect` | `--voice-hotkey-correct` | `VOICE_HOTKEY_CORRECT` | `ctrl+shift+f` |
| `hotkeySend` | `--voice-hotkey-send` | `VOICE_HOTKEY_SEND` | `ctrl+shift+x` |
| `sttUrl` | `--stt-url` | `STT_URL` | `http://whisper:8080` |
| `sttTimeout` | — | `STT_TIMEOUT` | `120000` |
| `correctorMode` | `--corrector-mode` | `CORRECTOR_MODE` | `both` |
| `llmUrl` | `--llm-url` | `LLM_URL` | `http://ollama:11434` |
| `llmModel` | `--llm-model` | `LLM_MODEL` | `qwen2.5-coder:3b` |
| `llmTimeout` | — | `LLM_TIMEOUT` | `30000` |
| `dictionaryPath` | `--voice-dictionary` | `VOICE_DICTIONARY` | `conf/voice-dictionary.json5` |

`correctorMode`:

- `dictionary` — solo sustituciones. Instantáneo, sin GPU, sin dependencias.
- `llm` — solo el modelo, sin pasar por el diccionario.
- `both` — diccionario y luego modelo. Recomendado.

`--no-voice` desactiva la función por completo: no se monta ninguna ruta ni se renderiza
la barra.

### El diccionario técnico

`conf/voice-dictionary.json5`, forma hablada -> forma escrita:

```json5
{
  'res partner':      'res.partner',
  'sale order line':  'sale.order.line',
  'many to many':     'Many2many',
  'pos multi seller': 'pos_multi_seller',
}
```

Reglas: no distingue mayúsculas, tolera espacios de más, y **las frases largas ganan a
las cortas** (`product template` gana a `product`). Es lo más rentable de personalizar:
añade tus modelos y tus módulos. Requiere reiniciar Wetty.

---

## Puesta en marcha

### Con Docker (recomendado)

Necesita el NVIDIA Container Toolkit dentro de WSL2 — en WSL2 el driver lo aporta
Windows, pero los contenedores no ven la GPU sin el toolkit:

```bash
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
docker run --rm --gpus all ubuntu nvidia-smi     # debe funcionar
```

Certificado con SAN (el micrófono lo exige; uno con `CN` suelto y sin SAN lo rechaza
Chrome de entrada):

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout ~/.ssl/wetty.key -out ~/.ssl/wetty.crt \
  -subj "/CN=wetty.local" \
  -addext "subjectAltName=DNS:wetty.local,IP:<TU-IP>,IP:127.0.0.1"
```

Arrancar:

```bash
docker compose -f docker/docker-compose.voice.yml up --build
docker compose -f docker/docker-compose.voice.yml exec ollama ollama pull qwen2.5-coder:3b
```

El volumen de whisper arranca vacío; hay que dejar el modelo dentro (ver
`VOICE-HANDOFF.md`, sección 6.3). Luego abre `https://<ip>:3000`, acepta el aviso del
certificado una vez por dispositivo, y concede el micrófono.

### Sin Docker

```bash
pnpm install && pnpm build
node build/main.js --base / --ssl-key ~/.ssl/wetty.key --ssl-cert ~/.ssl/wetty.crt \
  --stt-url http://localhost:8080 --llm-url http://localhost:11434
```

---

## Problemas frecuentes

**El botón Dictar avisa de que hace falta HTTPS.**
Estás por `http://`. Los navegadores solo dan micrófono en contexto seguro.

**Chrome no deja pasar del aviso de certificado.**
El certificado no tiene SAN. Regenéralo con `-addext "subjectAltName=…"` incluyendo la
IP con la que accedes.

**Concedí el micrófono pero no graba, y estoy usando la página de nginx.**
Un `<iframe>` necesita `allow="microphone"`, y un iframe `http` dentro de una página
`https` se bloquea como contenido mixto. Lo más simple es abrir Wetty directamente en el
móvil en vez de embebido.

**Dictar devuelve "speech to text service unavailable".**
whisper no responde. `docker compose … logs whisper`. Con el servicio caído la barra
sigue usable: puedes escribir a mano, Corregir y Enviar.

**Corregir no cambia la gramática, solo los identificadores.**
El modelo no respondió y se usó el diccionario. Mira el log de Wetty: aparece
`Text corrector fell back to the dictionary` con el motivo. Suele ser timeout, modelo sin
descargar (`ollama pull`) o falta de VRAM.

**Corregir tarda demasiado.**
Usa un modelo más pequeño (`--llm-model`) o sube `LLM_TIMEOUT`. whisper y Ollama comparten
GPU: un modelo de 7B en 4 GB de VRAM hace *offload* parcial y se arrastra.

**Un atajo no hace nada.**
Mira el log del servidor al arrancar: un valor mal escrito sale como aviso y cae al
valor por defecto. En el móvil los atajos **no funcionan por diseño** (no hay tecla
física y el Ctrl del teclado en pantalla está excluido a propósito); usa los iconos.
Si usas `double-ctrl`, los dos toques tienen que ir seguidos (menos de 400 ms)
y sin pulsar ninguna otra tecla en medio. El botón `Dictar` hace exactamente lo mismo.

**En el móvil la barra queda tapada por el teclado.**
Se ancla con la VisualViewport API. Si tu navegador no la soporta, cierra el teclado
virtual para ver la barra.
