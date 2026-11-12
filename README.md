# Aquarossa Culture Game V6

## Cambios V6
- El primer jugador crea la sesión y se convierte en host.
- El lobby queda en **WAITING** hasta que el host presiona **START LOBBY · 30 SEC**.
- Al iniciar el lobby, todos los jugadores que entren comparten el mismo countdown de 30 segundos controlado por el servidor.
- Cada jugador puede elegir **Español** o **English** individualmente desde el lobby sin afectar la sincronización.
- Nuevo banco de 10 preguntas directas sobre Misión, Visión y Valores, en ambos idiomas.
- Cada pregunta tiene 3 opciones (A/B/C).
- Las opciones se mezclan una sola vez por partida en el servidor, por lo que todos ven el mismo orden y la respuesta correcta ya no queda siempre en B.
- El juego sigue usando 5 preguntas por partida, elegidas del banco de 10, para mantener sesiones cortas.

## Ejecutar
```bash
npm install
npm start
```

## Corrección de respuestas (12 de noviembre de 2026)
- Cada partida de cinco preguntas incluye respuestas correctas en A, B y C.
- Cada letra aparece una o dos veces, con posiciones aleatorias por partida.
- El servidor conserva la correspondencia entre la opción correcta y su nueva letra, en ambos idiomas.
- Todos los jugadores ven el mismo orden.
- Para aplicar: reemplaza los archivos del servidor y reinicia o vuelve a desplegar la aplicación. No es necesario borrar data.json.
