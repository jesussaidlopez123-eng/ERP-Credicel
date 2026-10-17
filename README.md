# CREDI CEL — ERP / POS Multi-Sucursal

Sistema de punto de venta y ERP para sucursales (Matriz, Navojoa y Huatabampo): cobro, inventario con IMEI, cortes de caja, gastos, créditos, reparaciones y reportes.

Las etiquetas de producto se imprimen desde **Inventario → Etiquetas**. En una **Ribetec RT420BE** el programa manda un PDF **3.5 × 2.5 cm** (35 × 25 mm, horizontal), una etiqueta por avance. En **ajustes de impresión** debe quedar: impresora RT420BE, papel **35 × 25 mm**, orientación **Horizontal**, escala **100%** (no ajustar), márgenes **Ninguno**, 1 página por hoja. No uses Carta ni 4 × 6. Puedes **Descargar PDF** y imprimirlo igual. El rollo **58 mm** sigue disponible para ticket térmico. En **tablet** el ticket no se manda solo: hay que tocar **Imprimir** y elegir la térmica en el diálogo del sistema (Bluetooth ya emparejado). Un iPad casi no ve térmicas baratas (no son AirPrint).

Este repositorio adopta el código de trabajo actual para continuar el desarrollo.

Correcciones de lógica aplicadas: una sola sesión de caja abierta por sucursal, el corte ya no se reabre al recargar, el arqueo compara efectivo **contado** contra **esperado**, el inventario descuenta todas las líneas/IMEI, los abonos se ligan a una cartera por equipo, y el admin puede elegir sucursal (ya no entra forzado a una caja).

## Recargar o usar otro dispositivo

- **Recargar la página:** pide de nuevo la contraseña. Las ventas ya cobradas, gastos y el turno de caja viven en la nube. El ticket que **aún no cobras** se recupera en ese mismo equipo.
- **Otra computadora o celular, misma sucursal:** se engancha al **mismo turno**. No abre una caja nueva. Lo que ya se cobró aparece en ambos. El carrito sin cobrar se queda solo en el equipo donde se armó.
- **Otra sucursal:** Matriz, Navojoa y Huatabampo tienen turnos independientes.
- **Cierre 11:00 p.m. (hora Sonora):** si dejan la sesión abierta, a las 11:00 p.m. el sistema registra el corte, marca las ventas de esa caja y cierra la sesión. **Si ya pasaron las 11:00 p.m. y el corte no se guardó**, aún se puede cerrar el turno (Corte → Cerrar). No se abre una caja nueva de ventas hasta después de medianoche. Si la nube no responde, el corte queda en ese equipo y se sube al volver la conexión. El cierre automático **no cambia el fondo de caja**. El ticket de corte se imprime con las ventas y gastos del día (no en ceros).
- **Fondo de caja:** entra al arqueo (fondo inicial + efectivo − gastos del cajón). Al cerrar, el recuadro propone **el mismo fondo con el que abrió el turno**; si confirman sin cambiarlo, **mañana abre con ese monto**. El cierre automático de las 11:00 p.m. no lo borra. No se inventa $1000.
- Un turno de **hoy** no se marca cerrado antes de las 11:00 p.m. El sistema **ya no borra** cortes guardados.
- **Folio de ticket:** al cobrar se asigna un folio corto del día, por ejemplo `NAV-2708-042`. El id interno no se imprime.
- **Compras:** los pedidos se guardan en la nube. Al marcar **Entregado**, la mercancía entra a inventario de Matriz (si el código o nombre coincide con un producto).
- **Taller:** el **punto de venta** registra el equipo (queda En taller, se puede entregar). En **Recepción** hay un **buscador de pantallas**: se escribe el modelo y se carga el precio. El tarifario (precio de venta × 2.7) ya viene cargado: al escribir el modelo salen las variantes (original, OLED, incell) con su tarifa. Si hay que actualizar la lista, el admin lo hace en **Lista de precios** (Excel o pegar tabla), no en el alta. En **Reparaciones** cada celular muestra el **valor de la reparación** (lo cobrado al cliente) sin abrir la ficha; se toca **Abrir orden** para cargar el costo de la pieza. **Dar de baja** (en caja, pestaña Entrega, o en Reparaciones) saca el equipo de taller: pide motivo, queda en el historial y no borra el registro. Un equipo ya entregado no se da de baja. Si hubo anticipo, sigue en caja; un reembolso se registra como gasto. **Eliminar** (solo el perfil de administrador, con su contraseña) quita la ficha de taller, de caja y del historial; un ticket viejo no la vuelve a armar. El anticipo tampoco se revierte: si hay que devolverlo, se registra como gasto. Si caja entrega sin costo de pieza, la orden **parpadea y sube al inicio** hasta que taller lo capture (o marque “sin costo”). Esa compra de refacción **no aparece en el Corte X** ni mueve el cajón (en un corte ya cerrado tampoco sale el aviso). En **Dirección**, al armar el reporte, sí cuenta como **inversión (repuesto)**; lo cobrado menos el costo interno es **utilidad**. El mismo celular (teléfono + modelo + día) no se da de alta dos veces.
- **Notas:** (admin y encargado) primer módulo del menú. Notas al estilo Keep: se pueden **Fijar** o **No fijar**, o convertir en **lista de tareas** (lo marcado baja al final). Los archivos van abajo, en lista, con una miniatura pequeña. La **agenda** está en el icono de calendario, al lado de la campana de avisos: se abre emergente, se toca un día para agregar recordatorios o marcarlos listos, y el día de cada tarea pendiente aparece en avisos.
- **Dirección:** (admin) segundo módulo. Arriba hay **un solo tramo** de ingresos (como la barra de almacenamiento del iPhone), dividido en verde **utilidad** (caja: accesorios + margen de taller), violeta **comisiones** (depósito aparte, no entra al cajón), azul **inversión**, rojo **gastos** y amarillo **retorno**. **Semanal**, **Mensual** o **Rango** abierto (del–al). En el mismo recuadro hay un **contador de equipos vendidos** (celulares de contado y crédito; no abonos) con el mismo periodo y sucursal; al tocarlo se abre la **lista** de esas ventas (fecha, equipo, IMEI, cliente, número y vendedor). Se elige **Todas** o una sucursal. La semana lunes a domingo sigue el desglose del Corte X. La utilidad de reparaciones es lo cobrado menos el costo interno; la refacción es inversión (repuesto), no gasto rojo.
- **Cierre de caja:** si un ticket se cobró con la nube caída y subió sin turno, el Corte X del día igual lo cuenta (misma sucursal, mismo día, sin otro corte). No se abre caja nueva después de las 11:00 p.m.; se cierra el turno que ya estaba. Si a media mañana se cierra y se sigue cobrando, **Hoy** sigue en **turno en curso** con todas las ventas del día; no se queda pegado al corte vacío.
- **Ventas y cortes:** al abrir no se descargan 6 meses de tickets de golpe. El calendario va de hoy al corte más viejo ya cargado, **sin saltarse días** (si no se laboró, la sucursal sale en cero). En pantalla se ven 31 días; **Ver más días** amplia lo que ya está en memoria; **Cargar meses anteriores** pide más cortes a la nube. Tickets y gastos se cargan solo si se pide. En cada sucursal el nombre del turno abierto es **quién está cobrando ahora** (si Teresa entra en Matriz, deja de verse a quien abrió la caja o vendió antes). No se copia el login de otra computadora.
- **11 oct 2026 (Geraldín / Teresa):** Geraldín abrió en Huatabampo y Teresa en Matriz, pero los usuarios aún no estaban cambiados. Los 3 tickets que salieron en Matriz (`MTZ-1110-001` a `003`) se pasaron al turno abierto de Huatabampo y se revirtió el corte falso de Matriz. Los folios impresos no se cambian.
- **Paquete de ingreso:** en Inventario, **Accesorios** y **Equipos** tienen cada uno su botón **Paquete de ingreso**. Entra un lote a **una** sucursal: varios renglones de accesorios (cantidad) o varios modelos de celular con IMEI (escáner + Enter). No se mezclan accesorios con equipos. El kardex guarda un movimiento por renglón. Antes de guardar, **Revisar ingreso** abre un último paso con **Aceptar** y la sucursal destino (**Van a Matriz / Navojoa / Huatabampo**). El ingreso suelto de un accesorio y la captura de IMEI de un equipo piden el mismo Aceptar.
- **IMEI de equipos:** al guardar no se cambia un dígito por sí solo. El lector a veces manda un prefijo (`]C1`) o un 0/1 de más; el sistema lo quita y deja los **15 dígitos del celular**. Si se pegan dos IMEI (30 dígitos) no se recorta el primero a ciegas: pide volver a escanear. Un IMEI ya de 15 no se recorta ni se reescribe. El ticket guarda el IMEI del anaquel, no el prefijo del lector. Un celular solo puede estar en Matriz, Navojoa o Huatabampo. Al venderse sale de las tres. Un guardado de una sucursal no mueve ni borra los IMEI de las otras. El alta nueva **siempre** guarda el IMEI en la sucursal elegida (nunca en una lista suelta). Un merge de otra caja no puede pegar IMEI nuevos sin sucursal ni mandarlos a Matriz por defecto. Si un IMEI viejo quedó en la lista plana, se muestra como *sin sucursal asignada* y **no se puede vender** hasta que el encargado lo asigne en Inventario a la tienda donde está el equipo físico. El aviso ámbar lista esos IMEI; en la ficha del modelo hay botones MTZ / NAV / HUA. Lo que estaba en Bodega se lee como Matriz. En Inventario → **Trazar IMEI** se ve sucursal, venta y movimientos. En **Equipos** el recuadro de salud dice si el descuadre es **humano** (alta en tienda equivocada, duplicado, IMEI sin asignar) o **sistema** (IMEI vendido que sigue listado, stock ≠ cantidad de IMEI). Un ticket **CANCELADA** ya no baja el IMEI. **Quitar ya vendidos** (con contraseña) limpia los que siguen en anaquel habiendo ticket o movimiento de venta. Si faltan piezas de verdad, Inventario → **Kardex sucursales** compara la nube contra el historial y puede devolver lo que falte (no baja stock si hoy hay más).
- **Accesorios:** el stock vive en Matriz, Navojoa o Huatabampo. Al venderse se descuenta solo de la sucursal de la venta. Un guardado viejo de otra caja no puede bajar el stock de las demás. En **ingreso** y **traspaso** el destino empieza vacío: hay que elegir sucursal. El ingreso pide **Aceptar** mostrando a qué tienda van las piezas. Traspasos y ajustes piden la contraseña del operador en sesión; si está mal, no se aplica el cambio.
- **Borrar una venta:** en **Ventas → Tickets**, en el **historial de un corte** y en el **corte del turno en curso**, Eliminar pide la **contraseña de un administrador**. La de cajero o encargado no vale. El stock e IMEI vuelven a la sucursal y el corte se recalcula.
- **Borrar un gasto del turno abierto:** en **Ventas → Gastos** (solo los que aún no tienen corte) y en el **corte del turno en curso**, Eliminar pide la misma contraseña de administrador. El gasto sale de la nube, del equipo y de la caja esperada. Un gasto ya sellado en un corte cerrado no se borra desde ahí.
- **Venta atrasada (admin):** desde el punto de venta de Administración se arma el ticket y, al cobrar, se elige sucursal (Matriz, Navojoa o Huatabampo) y fecha. Si ese corte ya cerró, la venta entra a ese día.

## Sistema híbrido: primero el equipo, luego la nube

El objetivo es simple: **no perder ninguna venta del día**, aunque se caiga el internet o la nube llegue a su límite.

**Cómo se guarda una venta**

1. Al cobrar, el ticket se escribe en el **disco de esa computadora** (IndexedDB). Si esto funcionó, la venta ya está a salvo.
2. El ticket entra a una **cola de envío**. Ahí espera su turno.
3. Un trabajador va subiendo la cola a Firestore: en orden, con reintentos y esperas crecientes.
4. Nada se borra de la cola hasta que la nube confirma. Reintentar es inofensivo porque cada documento sube con su id fijo.

**Cuota de Firebase:** la base de CREDI CEL nació en Google AI Studio. Aunque el proyecto ya esté en **Blaze**, esa base sigue en un cupo gratis compartido (50 mil lecturas al día) hasta que se actualice **la base**, no solo el plan. Google lo dice así: *Linking a Cloud Billing account doesn't automatically remove the shared quota caps.*

Para quitar el tope (hace falta estar en Blaze):

1. Abre [Firestore](https://console.firebase.google.com/project/effective-airline-9gtt6/firestore) en el proyecto `effective-airline-9gtt6`.
2. Elige la base `ai-studio-erpposmultisucur-e55719b2-0519-4116-8707-50042acb7fc7` (no hace falta crear `(default)`).
3. En el aviso de *AI shared quota*, pulsa **Upgrade database** → **Upgrade to pay-as-you-go**.
4. Espera unos minutos. Recarga el POS en **el mismo Chrome** de cada caja. No borres datos del navegador: ventas, notas y usuarios pendientes se suben solos.

Sin ese clic, al llegar al tope del día la nube se pausa hasta ~medianoche (hora del Pacífico). El POS **no borra** ventas ni notas; siguen en esa computadora. Tres cajas CREDI CEL suelen costar centavos al día. En el POS, al recargar se usa caché en disco y **Notas no pide ventas ni inventario** hasta abrir esos módulos.

**Orden de los datos.** La cola respeta el orden **por sucursal**: si un ticket de Navojoa no sube, su corte espera. Nunca se guarda un corte sin sus ventas. Huatabampo sigue subiendo aparte, sin trabarse.

**Folios únicos sin internet.** Cada caja aparta un bloque de folios del contador de la nube (por ejemplo del 41 al 65) y va gastando ese bloque. Dos cajas nunca repiten número aunque una pierda la señal. Si un equipo nunca alcanzó a apartar bloque, emite un folio provisional con la clave de esa caja (`NAV-2808-K3M07`), que también es único y se distingue a simple vista.

**Respaldo diario.** Cada sucursal arma una foto del día (ventas, gastos, corte, totales y una firma de verificación). Queda en el equipo, se sube a `dailyBackups` y se puede **descargar como archivo** desde el indicador del encabezado.

**Blindajes**

- **Reloj:** si la fecha de la computadora se atrasa, el sistema usa la última hora buena y avisa. Un equipo mal configurado no manda ventas al día equivocado.
- **La nube vacía no borra la pantalla:** si Firestore no responde, se conserva lo del equipo.
- **Usuarios:** la nube no sustituye la lista de la caja. Cada equipo reescribe en Firestore a los operadores que todavía tiene.
- **Cortes:** el sistema ya no borra cortes guardados; si hay que revertir uno, se marca como `reverted`.
- **Navegador sin IndexedDB:** cae a un modo reducido y avisa que conviene subir el día antes de cerrar.

**Indicador del encabezado.** Muestra `Respaldado`, `N por subir` o `Sin internet`. Al abrirlo se ve qué falta, cuántos folios quedan apartados, el botón **Subir ahora** y **Descargar** el respaldo del día.

## Requisitos

- Node.js 20 o superior
- Cuenta Firebase (Firestore) con el proyecto configurado en `firebase-applet-config.json`

## Cómo correrlo

```bash
npm install
npm run dev
```

La app queda en `http://127.0.0.1:43127`.

Los operadores y contraseñas viven en **Usuarios** (Firestore) y también en cada caja. Si la nube vuelve incompleta (cuota o un recorte), **esa computadora no borra a nadie del inicio de sesión**: junta la lista local con la de Firestore y **vuelve a subir** a quien le falte. No borres datos del navegador: ahí está el respaldo de usuarios de esa tienda. Un alta de baja hecha por el admin queda marcada y no se resucita sola. No hay usuarios de demostración en producción.

Roles: **Administrador** (todo el menú), **Encargado** (notas, punto de venta, inventario, ventas y cortes) y **Cajero** (solo punto de venta). Un administrador puede **cambiar la sucursal** de un usuario y **marcar a qué módulos entra**. Si no se eligen módulos, se usan los del rol. Usuarios queda solo para administradores. Si el usuario tiene más de una sucursal, la elige al iniciar sesión.

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción
- `npm run preview` — previsualizar el build
- `npm run lint` — chequeo de TypeScript
- `npm test` — pruebas del día de caja, cotidianidad de inventario, modo híbrido y la simulación completa
- `npm run simulate` — simula un día de operación con la nube cayéndose a media tarde
- `npx tsx scripts/restore-branch-inventory.ts` — compara existencias vs kardex (añade `--apply` para devolver faltantes)

### Simulación del día

`npm run simulate` corre el código real de captura (almacén local, cola, folios y
respaldo) contra una nube de mentiras que imita a Firestore, incluido su tope de
1 MB por documento y el error de cuota agotada. El día simulado incluye: venta
normal por la mañana, caída de la nube a las 13:00, 16 registros capturados sin
red, recarga de la página, doble cobro del mismo ticket, reloj del equipo
atrasado 3 horas, cierre de turno sin nube, agotamiento del bloque de folios y
la reconexión a las 23:10.

Verifica que no se pierda ninguna venta, que el corte cuadre con las ventas
reales, que ningún folio se repita, que reintentar el corte no lo duplique y
que el cobro no espere a la red cuando no hay señal.

## Datos

El catálogo, operadores, ventas, gastos, cortes y kardex viven en **Firestore**, no en el código. Actualizar o publicar el frontend **no borra** esos registros.

Esta app usa el mismo proyecto Firebase que el sitio en producción (`https://erp-credicel.vercel.app/`):

- `projectId`: `effective-airline-9gtt6`
- base: `ai-studio-erpposmultisucur-e55719b2-0519-4116-8707-50042acb7fc7`

No hay botones de “lanzamiento oficial” ni limpiezas masivas. Tampoco se siembran productos de demo ni se purgan cortes o movimientos al abrir el sistema. Las colecciones nuevas (`creditAccounts`, `repairRecords`, `repairDeletions`, `sesiones_caja`) se agregan sin tocar las existentes.

Las reparaciones en taller ahora también se sincronizan en la nube (`repairRecords`).

## Seguridad

Las reglas actuales de Firestore permiten lectura y escritura abiertas. Las contraseñas de operadores se guardan en texto plano. No uses esto en producción sin autenticación real y reglas por sucursal.
