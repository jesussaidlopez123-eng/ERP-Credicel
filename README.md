# CREDI CEL — ERP / POS Multi-Sucursal

Sistema de punto de venta y ERP para sucursales (Navojoa, Huatabampo y Bodega Central): cobro, inventario con IMEI, cortes de caja, gastos, créditos, reparaciones y reportes.

Las etiquetas de producto (código, nombre, código de barras y precio) se imprimen desde **Inventario → Etiquetas**, no como un menú aparte. Los tickets de venta, gasto y corte salen en 58 mm.

Este repositorio adopta el código de trabajo actual para continuar el desarrollo.

Correcciones de lógica aplicadas: una sola sesión de caja abierta por sucursal, el corte ya no se reabre al recargar, el arqueo compara efectivo **contado** contra **esperado**, el inventario descuenta todas las líneas/IMEI, los abonos se ligan a una cartera por equipo, y el admin puede elegir sucursal (ya no entra forzado a Bodega).

## Recargar o usar otro dispositivo

- **Recargar la página:** pide de nuevo la contraseña. Las ventas ya cobradas, gastos y el turno de caja viven en la nube. El ticket que **aún no cobras** se recupera en ese mismo equipo.
- **Otra computadora o celular, misma sucursal:** se engancha al **mismo turno**. No abre una caja nueva. Lo que ya se cobró aparece en ambos. El carrito sin cobrar se queda solo en el equipo donde se armó.
- **Otra sucursal:** Navojoa y Huatabampo tienen turnos independientes.
- **Cierre 11:00 p.m. (hora Sonora):** si dejan la sesión abierta, a las 11:00 p.m. el sistema registra el corte, marca las ventas de esa caja y cierra la sesión. El siguiente turno abre después de medianoche. Un turno de **hoy** no se marca cerrado antes de las 11:00 p.m.; si eso llegó a pasar, al entrar de nuevo se reabre el mismo turno.
- Si internet falla al cobrar, el ticket **no se borra**: inténtalo de nuevo; no se duplica el folio.

## Requisitos

- Node.js 20 o superior
- Cuenta Firebase (Firestore) con el proyecto configurado en `firebase-applet-config.json`

## Cómo correrlo

```bash
npm install
npm run dev
```

La app queda en `http://127.0.0.1:43127`.

Usuarios de demostración (cambiar en producción):

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `123` | Administrador |
| `juan` | `123` | Encargado Navojoa |
| `maria` | `123` | Cajero Huatabampo |
| `carlos` | `123` | Cajero Bodega |

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción
- `npm run preview` — previsualizar el build
- `npm run lint` — chequeo de TypeScript

## Datos

El catálogo, operadores, ventas, gastos, cortes y kardex viven en **Firestore**, no en el código. Actualizar o publicar el frontend **no borra** esos registros.

Esta app usa el mismo proyecto Firebase que el sitio en producción (`https://erp-credicel.vercel.app/`):

- `projectId`: `effective-airline-9gtt6`
- base: `ai-studio-erpposmultisucur-e55719b2-0519-4116-8707-50042acb7fc7`

No hay botones de “lanzamiento oficial” ni limpiezas masivas. Tampoco se siembran productos de demo ni se purgan cortes o movimientos al abrir el sistema. Las colecciones nuevas (`creditAccounts`, `repairRecords`, `sesiones_caja`) se agregan sin tocar las existentes.

Las reparaciones en taller ahora también se sincronizan en la nube (`repairRecords`).

## Seguridad

Las reglas actuales de Firestore permiten lectura y escritura abiertas. Las contraseñas de operadores se guardan en texto plano. No uses esto en producción sin autenticación real y reglas por sucursal.
