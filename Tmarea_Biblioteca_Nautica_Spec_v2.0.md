# TMAREA - Navega con Certeza
## Biblioteca Náutica
**Especificación Funcional · Capa 0 · v2.0**
*MisilUp SpA · Puerto Montt · Junio 2026*

---

## 1. Visión General
La Biblioteca Náutica es un módulo de consulta técnica offline integrado a Tmarea. Concentra el conocimiento práctico que un patrón necesita a bordo: protocolos de emergencia, normativa vigente, balizamiento, comunicaciones y seguridad. 

Todo el contenido funciona sin conexión a internet y muta dependiendo del perfil seleccionado en el onboarding: Comercial (Nave Menor, Pesca Artesanal) o Recreativo (Bahía, Costero, Alta Mar).

*   **CAPA:** Capa 0 — MVP · Se lanza junto al cotejador
*   **USUARIO:** Patrón comercial y deportivo · Corredor austral · Chile
*   **PLATAFORMA:** PWA · Android-first · Offline-first · Instalable en pantalla de inicio
*   **FUENTE LEGAL:** D.L. 2222, D.S. 87, D.S. 388, D.S. 270, LGPA, RIPA/COLREG OMI, IALA Región B

---

## 2. Alcance Capa 0 — 8 Módulos Prioritarios
De los módulos contemplados, la Capa 0 implementa los 8 de mayor impacto en seguridad y cumplimiento legal. (Meteorología, Mareas y Nudos se incorporan en Capa 1).

| Módulo | Prioridad | Justificación |
| :--- | :--- | :--- |
| 🆘 **Emergencias a bordo** | P0 — Crítico | Protocolo de vida. Mayor diferenciador de seguridad. |
| ☑️ **Equipamiento obligatorio** | P0 — Crítico | Checklist pre-zarpe normado DIRECTEMAR. Alta utilidad diaria. |
| 📻 **Radio VHF** | P0 — Crítico | Protocolo MAYDAY es conocimiento de emergencia fundamental. |
| 🏥 **Primeros Auxilios** | P0 — Crítico | Supervivencia (Hipotermia/Traumas) adaptado a botiquín reglamentario. |
| ⚖️ **Reglamentos y Normativa**| P0 — Crítico | Respaldo legal, responsabilidades del patrón y límites de la licencia. |
| 🔴 **Balizamiento IALA B** | P1 — Alta | Chile usa Región B. Error frecuente en patrones novatos. |
| ⚖️ **RIPA/COLREG práctico** | P1 — Alta | Reglas clave en formato situación → regla → acción. |
| ⛵ **Maniobras Náuticas** | P1 — Alta | Fondeo, atraque, remolque y operación según tipo de propulsión. |

---

## 3. Navegación y Estructura de Pantallas

### 3.1 Flujo de navegación
La Biblioteca se integra al menú lateral (hamburger) como entrada de primer nivel.

*   **BN-00 Menú principal:** Entrada 'Biblioteca Náutica'. Ícono: libro + ancla.
*   **BN-01 Home Biblioteca:** Grid de tarjetas. Ícono, título, descripción breve. Buscador superior.
*   **BN-02 Vista de módulo:** Header con título. Contenido desplazable. Botón ← volver. Índice de secciones.
*   **BN-03 Vista de sub-sección:** Detalle de sección. Navegación previa/siguiente.

### 3.2 Comportamiento offline
*   Todo el contenido se pre-carga en el bundle como JSON estático. Sin APIs externas.
*   Los SVGs e íconos van embebidos.
*   Service Worker cachea la sección en el primer acceso.
*   Buscador funciona offline con índice JSON pre-generado.

---

## 4. Especificación de Módulos

### 4.1 🆘 Emergencias a Bordo
Protocolos de actuación (Hombre al agua, Incendio, Varadura). Formato acordeón.
*   **Acción INMEDIATA:** Pasos numerados 1…N.
*   **Qué NO hacer:** Sección diferenciada (Fondo coral/rojo claro).
*   **Comunicación sugerida:** Canal VHF y mensaje tipo.

### 4.2 ☑️ Equipamiento Obligatorio
Checklist interactivo organizado por categoría de navegación y filtrado por perfil de usuario. Estado persistido en `localStorage`.

### 4.3 📻 Radio VHF
Guía práctica. Tabla de canales, protocolos MAYDAY, PAN-PAN, SÉCURITÉ y alfabeto fonético.

### 4.4 🔴 Balizamiento IALA Región B (Chile)
Guía visual de las marcas con color, forma, luz y significado. Tarjetas SVG interactivas.

### 4.5 ⚖️ RIPA/COLREG Práctico
Reglas clave en formato situación → regla → acción. Jerarquía de paso, cruces, visibilidad reducida y canales angostos.

### 4.6 🏥 Primeros Auxilios
Protocolos de acción médica inmediata orientados a la supervivencia en el corredor austral.
*   **Contenidos:** Hipotermia (estabilización y contraindicaciones), extracción de anzuelos y traumatismos.
*   **UX:** Uso estricto de listas numeradas cortas y bloque de "Qué NO hacer" para lectura bajo estrés.

### 4.7 ⛵ Maniobras Náuticas
Guías paso a paso para la ejecución segura de maniobras a bordo, adaptadas al perfil.
*   **Contenidos:** Fondeo Seguro (general), Operación con Artes de Pesca (comercial/artesanal), Reducción de Velamen (deportivo).

### 4.8 ⚖️ Reglamentos y Normativa
Compendio de los marcos legales que rigen la navegación, filtrados dinámicamente según la licencia del usuario.
*   **Contenidos:** D.S. 87 (Deportes Náuticos), LGPA / D.S. 270 (Pesca y Habitabilidad), D.S. 388 / D.L. 2222 (Naves Menores y Ley de Navegación).

---

## 5. Criterios de Diseño y UX

### 5.1 Profundidad Progresiva (Revelación Progresiva)
Componente **`ConceptoClave`** o **`NotaNovato`**: Bloque visualmente diferenciado (fondo Cream/Navy, ícono de "Faro") que traduce la jerga técnica/legal a lenguaje común o explica la lógica detrás de una maniobra para patrones con menos experiencia.

### 5.2 Legibilidad a bordo
*   Fuente del sistema (Inter / Roboto). Tamaño mínimo: 14px.
*   Alto contraste. Fondo claro con texto oscuro.
*   Botones con área táctil mínima de 44×44px. Scroll vertical únicamente.

### 5.3 Paleta de colores
*   **Navy (#042C53):** Header, textos principales.
*   **Electric Blue (#1A6EBD):** Acentos, enlaces, íconos.
*   **Coral (#E8512A):** Alertas críticas, emergencias, qué no hacer.
*   **Orange (#F57C00):** Avisos, advertencias.
*   **Teal (#5DCAA5):** Confirmación, checklist OK.
*   **Cream (#F1EFE8):** Fondo de tarjetas y Conceptos Clave.

---

## 6. Lineamientos de Implementación (Lovable / Bolt)

### 6.1 Arquitectura de datos
*   Contenido en JSON estáticos en `/data/biblioteca/` — un archivo por módulo.
*   **Estructura de seguridad:** Basada en bloques (arrays de strings) sin HTML crudo para prevenir XSS.
*   **Filtrado de Perfiles:** Cada sección de los JSON incluye un array `perfiles_permitidos` (ej. `["ALL"]`, `["pesca_artesanal", "nave_menor_comercial"]`).

### 6.2 Componentes clave
*   `BibliotecaHome`: Grid de tarjetas + buscador.
*   `ModuloView`: Vista con índice y secciones.
*   `ConceptoClave`: Tarjeta explicativa para novatos.
*   `ChecklistItem`: Ítem con estado persistido.
*   `ProtocoloMayday`: Tarjeta roja para leer en voz alta.

### 6.3 Prompt base para Lovable / Bolt
> Crea módulo "Biblioteca Náutica" para PWA Tmarea. Paleta: navy #042C53, blue #1A6EBD, coral #E8512A, teal #5DCAA5, cream #F1EFE8. **Arquitectura de Datos:** Contenido cargado desde JSON estáticos pre-cacheados (Offline-first). Cada objeto JSON incluye un array `perfiles_permitidos`. Crea un custom hook `useBiblioteca(perfilUsuario)` que lea el perfil en `localStorage` y filtre las secciones antes de renderizar. **Vistas:** Home (grid 2x3). Vista de Módulo (índice lateral + acordeón). **Componentes:** Crea `ConceptoClave` (fondo claro, ícono destacado) para explicaciones prácticas. **Módulos Capa 0 (8):** Emergencias, Equipamiento, Radio VHF, Balizamiento IALA B, RIPA Práctico, Primeros Auxilios, Maniobras, y Reglamentos. Fuente mínima 14px, botones 44px.

---

## 7. Criterios de Aceptación
1.  **Bloqueante:** Carga completa sin conexión a internet (modo avión).
2.  **Bloqueante:** Buscador filtra en <300ms en Android mid-range.
3.  **Bloqueante:** Checklist persiste estado entre sesiones (localStorage).
4.  **Bloqueante:** Protocolo MAYDAY visible completo sin scroll en pantalla 5".
5.  **Bloqueante:** Biblioteca accesible desde menú principal en máximo 2 toques.
6.  **Bloqueante:** El contenido se filtra correctamente según el perfil guardado en localStorage.
7.  **Alta:** SVGs de balizamiento renderizan en Chrome Android y Safari iOS.
8.  **Alta:** Ningún texto inferior a 14px.
9.  **Alta:** Fuente normativa visible al pie de los módulos legales.

---

## 8. Módulos para Capa 1
*   🌤 **Meteorología:** Escala Beaufort visual + señales locales del corredor austral.
*   🌊 **Mareas:** Regla de los doceavos + calculadora interactiva. Datos SHOA.
*   🪢 **Nudos marineros:** GIF animados propios. Sin videos de terceros para garantizar offline.
