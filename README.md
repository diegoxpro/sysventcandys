# Candy's Market · Sistema de ventas

Sistema de ventas para minimarket que funciona **sin internet** en la PC de la tienda.

- `backend/`: API en NestJS + Prisma + PostgreSQL.
- `frontend/`: interfaz web en React + Vite.

## Qué incluye

| Módulo | Qué hace |
| --- | --- |
| Productos | Código de barras (opcional), 3 precios con su margen, costo, stock, stock mínimo, IGV (exonerado por defecto, región San Martín), control de vencimiento opcional. |
| Importación SysVent | Carga el "Reporte de stock de producto" exportado a CSV. Marca para revisar los datos dudosos. |
| Compras | Registro de factura del proveedor (serie y número únicos), contado o crédito, lotes con vencimiento. Suma stock, guarda el último costo y **sugiere precios** según el margen. Anulación con reversión de stock. |
| Cuentas por pagar | Saldo por proveedor y por factura, pagos parciales con medio de pago y n.º de operación opcional. |
| Inventario | Movimientos de stock (base del kardex), mermas valorizadas al costo, ajustes por conteo físico. |
| Alertas | Lotes vencidos (con botón "Enviar a merma"), por vencer, stock bajo el mínimo, facturas por vencer. |
| Venta (POS) | Venta rápida con lector de barras, boleta (B001) o boleta libre (L001), precio 1/2/3, cliente opcional, pago mixto (efectivo, Yape, Plin, tarjeta) con vuelto, ticket de 80 mm. Atajos: F2 buscar, F4 comprobante, F6 precio, F7 cliente, F9 cobrar. |
| Autorización | Descuentos, precios rebajados y anulaciones piden la clave del administrador cuando los hace un cajero. |
| Caja | Apertura con fondo fijo (S/ 150 por defecto), ingresos y gastos, pagos a proveedores desde la caja, cierre con contador de billetes y monedas, diferencia, ticket de cierre e historial. |
| Ventas realizadas | Consulta por fecha y comprobante, reimpresión y anulación (devuelve el stock, incluidos los lotes). |
| Configuración | Datos de la tienda, márgenes por defecto, redondeo de precios, permitir venta sin stock, días de aviso de vencimiento, usuarios (administrador y cajeros). |

Siguientes pasos del plan: reportes y backup a Google Drive, y facturación electrónica SUNAT.

> Las boletas B001 todavía **no se envían a SUNAT**; eso llega en el paso de facturación electrónica.

## Ticketera y gaveta

El ticket se imprime con la impresora predeterminada de Windows (POS-80C, papel de 80 mm). Para que la gaveta se abra sola, activa en el driver de la impresora la opción de abrir el cajón al imprimir ("Cash drawer: open before printing"). Para imprimir sin el cuadro de diálogo, abre el sistema en Chrome con `--kiosk-printing`.

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
- Solo hay una caja abierta a la vez. Una venta solo se anula mientras su caja siga abierta.
- Los productos que controlan vencimiento se venden primero de los lotes que vencen antes.
- La boleta libre se imprime como "NOTA DE VENTA" porque no es un comprobante de SUNAT.
- Al importar desde SysVent, las presentaciones que comparten Id (por ejemplo, unidad y bolsa) quedan como productos distintos, cada uno con su código y stock. Los stocks negativos se cargan en 0 y quedan marcados "Por revisar".

## Pruebas

```bash
cd backend && npm test
```
