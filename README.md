# Aquarossa Culture Game V7

## Participar
1. El host abre el lobby de 30 segundos.
2. Cada participante escribe un nombre de 1 a 30 caracteres y pulsa Join antes de que cierre. Los nombres no se pueden repetir dentro del lobby.
3. Quien no pulse Join puede ver la partida como espectador. El host también debe pulsar Join si quiere jugar.
4. Se juegan cinco preguntas de 30 segundos. Cada respuesta correcta suma un punto.
5. El leaderboard de la derecha se actualiza después de cada pregunta; las puntuaciones iguales comparten puesto.

## Mata-mata
- Solo participan quienes empatan en el primer lugar, incluso si son más de dos.
- Pantalla de reglas: 8 segundos. Después, cuenta regresiva: 5, 4, 3, 2, 1.
- Luego aparece una pregunta con 5 segundos para responder.
- Gana la primera respuesta correcta recibida por el servidor. El orden de llegada puede depender de la conexión.
- Una respuesta incorrecta elimina al jugador de esa pregunta y no puede cambiarse.
- Si nadie acierta, se muestra un aviso de 3.5 segundos, otra cuenta regresiva y una nueva pregunta. Todos los empatados que sigan conectados vuelven a participar.
- Los espectadores y los jugadores fuera del empate no pueden contestar.
- El desempate decide la victoria, sin alterar los puntos de las cinco rondas.
- Al desconectarse, el jugador sale de la partida. Si solo queda un finalista, también debe acertar para ganar. Si no queda ninguno, termina sin ganador.

## Actualizar el juego existente
Sube `questions.json`, `server.js` y `public/index.html` a sus mismas ubicaciones en GitHub, en el repositorio conectado al servicio del juego en Render. Guarda todos los cambios antes de desplegar. No subas el ZIP directamente ni borres `data.json`.

Si subes todo el contenido, conserva cualquier `data.json` existente. `package.json` solo actualiza el nombre, la versión y el comando de pruebas; las dependencias siguen iguales.

Después vuelve a desplegar el servicio y recarga todas las pestañas del juego para cargar el cliente nuevo. La actualización reinicia cualquier partida en curso.

El historial usa `data.json` del servidor: su conservación entre despliegues depende del almacenamiento persistente que tenga configurado el servicio.

## Ejecutar y verificar
```bash
npm install
npm start
npm test
```
La prueba usa conexiones y reloj simulados para comprobar ingreso, puntuación, desempates, espectadores y registro de una única victoria, sin modificar los datos guardados.

## Nuevo valor: Hazlo simple
Buscamos siempre el camino más simple para llegar a la meta. Evitamos procesos, reportes y fórmulas más complicados de lo necesario: si algo se puede hacer en menos pasos, lo hacemos en menos pasos.

El banco ahora incluye seis valores y 15 preguntas en español e inglés, con cinco preguntas sobre el nuevo valor (significado, reportes, pasos, fórmulas y seguimiento de tareas). Cada partida conserva cinco preguntas; las nuevas entran en la selección habitual y también pueden aparecer en el mata-mata.
