# CREDI CEL — ERP / POS Multi-Sucursal

Sistema de punto de venta y ERP para sucursales (Navojoa, Huatabampo y Bodega Central): cobro, inventario con IMEI, cortes de caja, gastos, créditos, reparaciones y reportes.

Las etiquetas de producto (código, nombre, código de barras y precio) se imprimen desde **Inventario → Etiquetas**, no como un menú aparte. Los tickets de venta, gasto y corte salen en 58 mm.

Este repositorio adopta el código de trabajo actual para continuar el desarrollo.

Correcciones de lógica aplicadas: una sola sesión de caja abierta por sucursal, el corte ya no se reabre al recargar, el arqueo compara efectivo **contado** contra **esperado**, el inventario descuenta todas las líneas/IMEI, los abonos se ligan a una cartera por equipo, y el admin puede elegir sucursal (ya no entra forzado a Bodega).

## Recargar o usar otro dispositivo

- **Recargar la página:** pide de nuevo la contraseña. Las ventas ya cobradas, gastos y el turno de caja viven en la nube. El ticket que **aún no cobras** se recupera en ese mismo equipo.
- **Otra computadora o celular, misma sucursal:** se engancha al **mismo turno**. No abre una caja nueva. Lo que ya se cobró aparece en ambos. El carrito sin cobrar se queda solo en el equipo donde se armó.
- **Otra sucursal:** Navojoa y Huatabampo tienen turnos independientes.
- **Cierre 11:00 p.m. (hora Sonora):** si dejan la sesión abierta, a las 11:00 p.m. el sistema registra el corte, marca las ventas de esa caja y cierra la sesión. **Si ya pasaron las 11:00 p.m. y el corte no se guardó**, aún se puede cerrar el turno (Corte → Cerrar). No se abre una caja nueva de ventas hasta después de medianoche. Si la nube no responde, el corte queda en ese equipo y se sube al volver la conexión.
- Un turno de **hoy** no se marca cerrado antes de las 11:00 p.m. El sistema **ya no borra** cortes guardados.
- **Folio de ticket:** al cobrar se asigna un folio corto del día, por ejemplo `NAV-2708-042`. El id interno no se imprime.
- **Compras:** los pedidos se guardan en la nube. Al marcar **Entregado**, la mercancía entra a inventario de Bodega (si el código o nombre coincide con un producto).
- **Dirección:** solo muestra ventas, gastos, tickets e inventario reales. No inventa gerentes ni sucursales.

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

Roles: **Administrador** (todo el menú), **Encargado** (punto de venta, inventario, ventas y cortes) y **Cajero** (solo punto de venta).

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción
- `npm run preview` — previsualizar el build
- `npm run lint` — chequeo de TypeScript
- `npm test` — pruebas del día de caja y del modo híbrido (cola, folios, respaldo)

## Datos

El catálogo, operadores, ventas, gastos, cortes y kardex viven en **Firestore**, no en el código. Actualizar o publicar el frontend **no borra** esos registros.

Esta app usa el mismo proyecto Firebase que el sitio en producción (`https://erp-credicel.vercel.app/`):

- `projectId`: `effective-airline-9gtt6`
- base: `ai-studio-erpposmultisucur-e55719b2-0519-4116-8707-50042acb7fc7`

No hay botones de “lanzamiento oficial” ni limpiezas masivas. Tampoco se siembran productos de demo ni se purgan cortes o movimientos al abrir el sistema. Las colecciones nuevas (`creditAccounts`, `repairRecords`, `sesiones_caja`) se agregan sin tocar las existentes.

Las reparaciones en taller ahora también se sincronizan en la nube (`repairRecords`).

## Seguridad

Las reglas actuales de Firestore permiten lectura y escritura abiertas. Las contraseñas de operadores se guardan en texto plano. No uses esto en producción sin autenticación real y reglas por sucursal.
