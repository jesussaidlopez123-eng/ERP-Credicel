# CREDI CEL — ERP / POS Multi-Sucursal

Sistema de punto de venta y ERP para sucursales (Matriz, Navojoa y Huatabampo): cobro, inventario con IMEI, cortes de caja, gastos, créditos, reparaciones y reportes.

Las etiquetas de producto se imprimen desde **Inventario → Etiquetas**. En la **Ribetec RT420BE** Chrome **no lista** 35 × 25 mm; si imprimes desde ahí salen verticales y con huecos. Usa **Enviar a RT420BE**: descarga `CREDI-CEL-RT420BE.bat` y ábrelo. Eso manda TSPL 35 × 25 mm, una etiqueta tras otra. En el driver (Dispositivos e impresoras → Preferencias → Stock) **escribe** ancho 35 mm, alto 25 mm y hueco 2 mm; no busques una opción con ese nombre. El rollo **58 mm** sigue para ticket térmico.

Este repositorio adopta el código de trabajo actual para continuar el desarrollo.

Correcciones de lógica aplicadas: una sola sesión de caja abierta por sucursal, el corte ya no se reabre al recargar, el arqueo compara efectivo **contado** contra **esperado**, el inventario descuenta todas las líneas/IMEI, los abonos se ligan a una cartera por equipo, y el admin puede elegir sucursal (ya no entra forzado a una caja).

## Recargar o usar otro dispositivo

- **Recargar la página:** pide de nuevo la contraseña. Las ventas ya cobradas, gastos y el turno de caja viven en la nube. El ticket que **aún no cobras** se recupera en ese mismo equipo.
- **Otra computadora o celular, misma sucursal:** se engancha al **mismo turno**. No abre una caja nueva. Lo que ya se cobró aparece en ambos. El carrito sin cobrar se queda solo en el equipo donde se armó.
- **Otra sucursal:** Matriz, Navojoa y Huatabampo tienen turnos independientes.
- **Cierre 11:00 p.m. (hora Sonora):** si dejan la sesión abierta, a las 11:00 p.m. el sistema registra el corte, marca las ventas de esa caja y cierra la sesión. **Si ya pasaron las 11:00 p.m. y el corte no se guardó**, aún se puede cerrar el turno (Corte → Cerrar). No se abre una caja nueva de ventas hasta después de medianoche. Si la nube no responde, el corte queda en ese equipo y se sube al volver la conexión. El cierre automático **no cambia el fondo de caja**. El ticket de corte se imprime con las ventas y gastos del día (no en ceros).
- **Fondo de caja:** es solo el monto que el cajero escribe al finalizar el turno (“Fondo que dejas para el siguiente turno”). Ese valor se guarda en la nube y es el fondo de apertura del día siguiente. No se inventa $1000 ni se borra al cambiar el día. Al abrir esta versión, el fondo actual se deja en $0 para que cada sucursal lo ponga de nuevo en el próximo corte.
- Un turno de **hoy** no se marca cerrado antes de las 11:00 p.m. El sistema **ya no borra** cortes guardados.
- **Folio de ticket:** al cobrar se asigna un folio corto del día, por ejemplo `NAV-2708-042`. El id interno no se imprime.
- **Compras:** los pedidos se guardan en la nube. Al marcar **Entregado**, la mercancía entra a inventario de Matriz (si el código o nombre coincide con un producto).
- **Taller:** el equipo del cliente queda registrado con folio en cuanto se guarda, aunque no haya internet. Un equipo con saldo se marca **entregado solo cuando el cobro se completa**, así un cobro cancelado no deja el celular como entregado.
- **Reparaciones (admin):** el cajero recibe el equipo en el punto de venta. En **Reparaciones → Pendientes** se abre la orden y se cargan los **gastos** (refacción, mano de obra u otro). Al entregar en caja, el folio pasa al **Historial**: se elige la semana (lunes a domingo, hora Sonora) y al abrirla aparece el registro administrativo con los equipos de esa semana, la suma de gastos y la utilidad (precio al cliente menos gastos). Desde Historial se puede **generar un Excel** de tal fecha a tal fecha (resumen, operaciones, gastos y bajas). El efectivo de anticipo o liquidación sigue en caja y en el Corte X.
- **Notas:** (admin y encargado) primer módulo del menú. Notas al estilo Keep: se pueden **Fijar** o **No fijar**, o convertir en **lista de tareas** (lo marcado baja al final). Los archivos van abajo, en lista, con una miniatura pequeña.
- **IMEI de equipos:** un celular solo puede estar en Matriz, Navojoa o Huatabampo. Al venderse sale de las tres. Un guardado de una sucursal no mueve ni borra los IMEI de las otras. Si un IMEI quedó en la lista plana sin sucursal, se muestra como *sin sucursal asignada*. Lo que estaba en Bodega se lee como Matriz. En Inventario → **Trazar IMEI** se ve sucursal, venta y movimientos. El catálogo en vivo ya no oculta IMEI de Huatabampo o Navojoa solo porque aparezcan en tickets recientes; eso hacía ver la sucursal vacía. Si faltan piezas de verdad, Inventario → **Kardex sucursales** compara la nube contra el historial y puede devolver lo que falte (no baja stock si hoy hay más).
- **Accesorios:** el stock vive en Matriz, Navojoa o Huatabampo. Al venderse se descuenta solo de la sucursal de la venta. Un guardado viejo de otra caja no puede bajar el stock de las demás. En **ingreso** y **traspaso** el destino empieza vacío: hay que elegir sucursal. Traspasos y ajustes piden la contraseña del operador en sesión; si está mal, no se aplica el cambio.
- **Borrar una venta:** en **Ventas → Tickets** y en el **historial de un corte**, Eliminar pide la **contraseña de un administrador**. La de cajero o encargado no vale. El stock e IMEI vuelven a la sucursal y el corte se recalcula.
- **Venta atrasada (admin):** desde el punto de venta de Administración se arma el ticket y, al cobrar, se elige sucursal (Matriz, Navojoa o Huatabampo) y fecha. Si ese corte ya cerró, la venta entra a ese día.

## Sistema híbrido: primero el equipo, luego la nube

El objetivo es simple: **no perder ninguna venta del día**, aunque se caiga el internet o la nube llegue a su límite.

**Cómo se guarda una venta**

1. Al cobrar, el ticket se escribe en el **disco de esa computadora** (IndexedDB). Si esto funcionó, la venta ya está a salvo.
2. El ticket entra a una **cola de envío**. Ahí espera su turno.
3. Un trabajador va subiendo la cola a Firestore: en orden, con reintentos y esperas crecientes.
4. Nada se borra de la cola hasta que la nube confirma. Reintentar es inofensivo porque cada documento sube con su id fijo.

**Orden de los datos.** La cola respeta el orden **por sucursal**: si un ticket de Navojoa no sube, su corte espera. Nunca se guarda un corte sin sus ventas. Huatabampo sigue subiendo aparte, sin trabarse.

**Folios únicos sin internet.** Cada caja aparta un bloque de folios del contador de la nube (por ejemplo del 41 al 65) y va gastando ese bloque. Dos cajas nunca repiten número aunque una pierda la señal. Si un equipo nunca alcanzó a apartar bloque, emite un folio provisional con la clave de esa caja (`NAV-2808-K3M07`), que también es único y se distingue a simple vista.

**Respaldo diario.** Cada sucursal arma una foto del día (ventas, gastos, corte, totales y una firma de verificación). Queda en el equipo, se sube a `dailyBackups` y se puede **descargar como archivo** desde el indicador del encabezado.

**Blindajes**

- **Reloj:** si la fecha de la computadora se atrasa, el sistema usa la última hora buena y avisa. Un equipo mal configurado no manda ventas al día equivocado.
- **La nube vacía no borra la pantalla:** si Firestore no responde, se conserva lo del equipo.
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

Los operadores y contraseñas viven en **Usuarios** (Firestore). No hay usuarios de demostración en producción.

Roles: **Administrador** (todo el menú), **Encargado** (notas, punto de venta, inventario, ventas y cortes) y **Cajero** (solo punto de venta).

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción
- `npm run preview` — previsualizar el build
- `npm run lint` — chequeo de TypeScript
- `npm test` — pruebas del día de caja, del modo híbrido y la simulación completa
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

No hay botones de “lanzamiento oficial” ni limpiezas masivas. Tampoco se siembran productos de demo ni se purgan cortes o movimientos al abrir el sistema. Las colecciones nuevas (`creditAccounts`, `repairRecords`, `sesiones_caja`) se agregan sin tocar las existentes.

Las reparaciones en taller ahora también se sincronizan en la nube (`repairRecords`).

## Seguridad

Las reglas actuales de Firestore permiten lectura y escritura abiertas. Las contraseñas de operadores se guardan en texto plano. No uses esto en producción sin autenticación real y reglas por sucursal.
