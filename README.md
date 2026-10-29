# Candy's Market · Sistema de ventas

Sistema de ventas para minimarket que funciona **sin internet** en la PC de la tienda.

- `backend/`: API en NestJS + Prisma + PostgreSQL.
- `frontend/`: interfaz web en React + Vite.

## Qué incluye (fase 1, paso 1)

| Módulo | Qué hace |
| --- | --- |
| Productos | Código de barras (opcional), 3 precios con su margen, costo, stock, stock mínimo, IGV (exonerado por defecto, región San Martín), control de vencimiento opcional. |
| Importación SysVent | Carga el "Reporte de stock de producto" exportado a CSV. Marca para revisar los datos dudosos. |
| Compras | Registro de factura del proveedor (serie y número únicos), contado o crédito, lotes con vencimiento. Suma stock, guarda el último costo y **sugiere precios** según el margen. Anulación con reversión de stock. |
| Cuentas por pagar | Saldo por proveedor y por factura, pagos parciales con medio de pago y n.º de operación opcional. |
| Inventario | Movimientos de stock (base del kardex), mermas valorizadas al costo, ajustes por conteo físico. |
| Alertas | Lotes vencidos (con botón "Enviar a merma"), por vencer, stock bajo el mínimo, facturas por vencer. |
| Configuración | Datos de la tienda, márgenes por defecto, redondeo de precios, permitir venta sin stock, días de aviso de vencimiento, usuarios (administrador y cajeros). |

Siguientes pasos del plan: venta y caja, reportes y backup a Google Drive, y facturación electrónica SUNAT.

## Instalación en la PC de la tienda (Windows)

1. Instala [Node.js 22 LTS](https://nodejs.org) y [PostgreSQL 16](https://www.postgresql.org/download/windows/). Anota la contraseña del usuario `postgres`.
2. Crea la base de datos `candys` (con pgAdmin o `psql -U postgres -c "create database candys;"`).
3. Backend:
   ```bash
   cd backend
   copy .env.example .env      # edita DATABASE_URL y JWT_SECRET
   npm install
   npm run db:migrate
   npm run db:seed             # crea el usuario admin / admin123
   npm run importar:sysvent -- "C:\ruta\stock_produto.csv"
   npm run build
   npm start
   ```
4. Frontend (en otra ventana):
   ```bash
   cd frontend
   npm install
   npm run build
   npm run preview
   ```
5. Abre http://localhost:5173, ingresa con `admin` / `admin123` y **cambia la contraseña** en Configuración → Mi contraseña.

Para desarrollo usa `npm run dev` en cada carpeta.

## Reglas de negocio

- Todo cambio de stock pasa por `StockService` (`backend/src/inventario/stock.service.ts`) y deja un movimiento. Ventas usarán el mismo servicio.
- Precio sugerido = costo × (1 + margen %), redondeado hacia arriba (S/ 0.10 por defecto). Al registrar una compra solo se marcan por defecto los precios que suben; bajar un precio es decisión del administrador.
- El costo del producto es el **último costo de compra**.
- Registrar compras, pagos, mermas, ajustes y editar productos es solo para el administrador. Los cajeros pueden consultar.
- Al importar desde SysVent, las presentaciones que comparten Id (por ejemplo, unidad y bolsa) quedan como productos distintos, cada uno con su código y stock. Los stocks negativos se cargan en 0 y quedan marcados "Por revisar".

## Pruebas

```bash
cd backend && npm test
```
