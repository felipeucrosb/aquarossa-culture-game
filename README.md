# Aquarossa Culture Battle — Multiplayer

Versión para 3 jugadores simultáneos: Cris, Jessi y Felipe.

## Cómo funciona
Cada persona abre la misma URL desde su propia computadora, elige su personaje y responde en tiempo real. La partida tiene 3 rounds. Cada respuesta correcta suma 1 punto.

El scoreboard muestra:
- puntos de la semana
- puntos acumulados
- semanas ganadas

## Ejecutar localmente
Necesitas Node.js instalado.

1. Abre Terminal dentro de esta carpeta.
2. Ejecuta `npm install`
3. Ejecuta `npm start`
4. Abre `http://localhost:3000`

## Jugar desde 3 computadoras en la misma Wi‑Fi
En la computadora que corre el servidor, busca su IP local, por ejemplo `192.168.1.50`.
Los tres jugadores abren `http://192.168.1.50:3000`.

## Jugar desde cualquier lugar
Sube esta carpeta a un hosting que mantenga un proceso Node.js activo. La app usa Socket.IO para sincronizar la partida en tiempo real.

Importante: en esta primera versión el scoreboard vive en memoria del servidor. Si el servidor se reinicia, los acumulados se reinician. Para uso permanente conviene agregar una base de datos.
