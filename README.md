# CREDI CEL — ERP / POS Multi-Sucursal

Sistema de punto de venta y ERP para sucursales (Navojoa, Huatabampo y Bodega Central): cobro, inventario con IMEI, cortes de caja, gastos, créditos, reparaciones y reportes.

Este repositorio adopta el código de trabajo actual para continuar el desarrollo. La lógica de caja, inventario y créditos aún tiene defectos conocidos; no se asume que los cortes o el stock coincidan al 100 % con el negocio real hasta que se corrijan.

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

El catálogo, operadores, ventas, gastos y cortes se sincronizan con Firestore. Las reparaciones en taller se guardan hoy en `localStorage` por sucursal (no en la nube).

## Seguridad

Las reglas actuales de Firestore permiten lectura y escritura abiertas. Las contraseñas de operadores se guardan en texto plano. No uses esto en producción sin autenticación real y reglas por sucursal.
