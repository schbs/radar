# Identidad visual: Pixel Patagonia · Radar (marca ficticia)

Herramienta interna de una agencia web ficticia de Neuquén para encontrar negocios con oportunidad de mejorar su web.
Estética "radar/datos" (lo pide el plan). Pie obligatorio: "Proyecto de demostración — marca ficticia". Skill
`design-identity-per-client`.

## Brief
- **Quién la usa:** el equipo comercial de la agencia, en la compu, varias veces por semana.
- **3 adjetivos:** preciso, rápido, sobrio.
- **Gustan:** pantallas de instrumentos, mapas de calor, planillas bien alineadas.
- **No gusta:** dashboards genéricos de tarjetas con degradés; "growth hacking" con emojis.
- **Conversión:** elegir en minutos a qué negocios conviene escribirles y por qué (con el dato que lo sostiene).

## Tres direcciones

| | A · Consola (recomendada) | B · Planilla de campo | C · Informe de auditoría |
|---|---|---|---|
| Concepto | Una consola de radar: cada negocio es un eco con su intensidad (score) y sus señales | La planilla del vendedor, densa y filtrable, con marcas de color por señal | Cada lead como una ficha de auditoría impresa, con sello de puntaje |
| Display / texto | Martian Mono / IBM Plex Sans | Archivo Narrow / Archivo | Fraunces / Source Sans 3 |
| Primario / acento | ámbar fósforo `oklch(0.80 0.14 75)` sobre tinta `oklch(0.20 0.02 260)` | magenta `oklch(0.50 0.18 330)` / gris papel | verde inglés `oklch(0.40 0.08 160)` / sello rojo |
| Layout | Panel oscuro: barra de consulta arriba, lista de ecos a la izquierda y ficha de señales a la derecha | Tabla a todo el ancho con columnas fijas y filtros en chips | Grilla de fichas A4 en miniatura |
| Movimiento | Barrido del radar al terminar una corrida (rotate, una vez) y barras de score que crecen (scaleX) | Ninguno; resaltado de fila | Sello que cae al calcular el score (transform) |
| Forma | Esquinas de 2 px, líneas de 1 px tipo retícula, números tabulares | Sin bordes, cebra suave | Bordes dobles, mucho blanco |
| Gesto propio | La intensidad del eco = score, y cada señal es un "pulso" con su dato medido | Las columnas de señales como semáforo con texto | El número de score como sello |

**Elegida: A · Consola** (Germán ya delegó la elección en Fojas: "hacé lo que recomiendes"; se mantiene el criterio).
Es la que mejor cuenta lo que hace el producto (barrer una ciudad y ver qué negocios "suenan") y la más distinta de los
proyectos anteriores: único tema oscuro, tipografía monoespaciada y tono ámbar. Contraste AA a medir en P5-G2 con los
tokens: ámbar sobre tinta para texto grande y números; el texto corrido va en gris claro sobre tinta.

## Control de diferencia (dirección A contra `taller/registro-visual.json`)

| Proyecto | Display | Hue (≥ 30°) | Layout | Movimiento | Forma | Difiere en |
|---|---|---|---|---|---|---|
| Propuesta inmobiliaria (no contratada) | ✓ Montserrat vs Martian Mono | ✓ 25° vs 75° (50°) | ✓ | ✓ | ✓ | 5/5 |
| Propuesta concesionaria (no contratada) | ✓ | ✓ 275° vs 75° | ✓ | ✓ | ✓ | 5/5 |
| turnolisto | ✓ Lexend vs Martian Mono | ✓ 188° vs 75° | ✓ | ✓ casi nulo vs barrido | ✓ fondo crema vs oscuro | 5/5 |
| embudo | ✓ Space Grotesk vs Martian Mono | ✓ 150° vs 75° | ✓ grilla 8/4 vs lista + ficha | ✓ barras que crecen vs barrido + barras: comparte barras | ✓ | 4/5 |
| fojas | ✓ Newsreader vs Martian Mono | ✓ 235° vs 75° | ✓ | ✓ | ✓ | 5/5 |

Con Embudo comparte las barras que crecen: en Radar son secundarias (la firma es el barrido) y van horizontales y
finas, sin números grandes.
