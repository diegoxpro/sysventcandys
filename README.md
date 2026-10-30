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
| Ventas realizadas | Consulta por fecha y comprobante, reimpresión y anulación (devuelve el stock, incluidos los lotes). Corrección de comprobante (boleta ↔ boleta libre), cliente y pago mientras no se haya enviado a SUNAT y la caja siga abierta, con clave del administrador e historial de cambios. Al cambiar de comprobante toma el siguiente número de la otra serie; una boleta B001 solo pasa a boleta libre si es la última, para no dejar números saltados ante SUNAT. |
| Reportes | Ventas resumido (como el de SysVent, agrupado por comprobante), ventas por producto con utilidad y margen, por día, por medio de pago, por cajero, utilidad del período (ventas − costo − mermas − gastos), compras por proveedor y stock valorizado. Descarga en Excel o impresión/PDF. Solo administrador. |
| Backup | Copia diaria de la base de datos con `pg_dump` a una carpeta de Google Drive para escritorio, más una copia local. También al cerrar caja y con un botón. Conserva los últimos 30. |
| Facturación electrónica | Las boletas B001 se firman con tu certificado digital y se envían directo a SUNAT (SEE del contribuyente). Sin internet quedan "por enviar" y se reintenta solo cada 2 minutos. Las anulaciones van en el resumen diario. Ticket con QR, hash y leyenda de la Amazonía. Las boletas libres (L001) nunca se envían. |
| Configuración | Datos de la tienda, márgenes por defecto, redondeo de precios, permitir venta sin stock, días de aviso de vencimiento, usuarios (administrador y cajeros), SUNAT. |

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

## Backup en Google Drive

1. Instala **Google Drive para escritorio** en la PC de la tienda e inicia sesión con tu cuenta.
2. En el sistema, ve a Configuración → Backup y escribe una carpeta dentro de tu unidad, por ejemplo `G:\Mi unidad\Backups Candys`.
3. Si `pg_dump` no está en el PATH, indica su ruta (`C:\Program Files\PostgreSQL\16\bin\pg_dump.exe`).
4. Presiona "Hacer backup ahora" para probar. Drive sube la copia cuando hay internet.

Además, siempre queda una copia local en `backend/backups` (o en la carpeta de la variable `BACKUP_LOCAL`).

**Restaurar un backup** (en una base vacía):

```bash
createdb -U postgres candys_restaurada
pg_restore --no-owner -U postgres -d candys_restaurada "G:\Mi unidad\Backups Candys\candys_2026-10-29_2200.backup"
```

Luego apunta `DATABASE_URL` a `candys_restaurada` y reinicia el backend.

## Facturación electrónica SUNAT

El sistema envía las boletas directamente a SUNAT, firmadas con tu certificado digital. No necesitas OSE.

1. **Certificado.** En Configuración → SUNAT elige tu archivo `.pfx`, escribe su contraseña y presiona "Cargar certificado". Se guarda solo en `backend/secretos` (o en la carpeta de la variable `SECRETOS_DIR`). **No** va a la base de datos ni a los backups, así que guarda el `.pfx` original en un lugar seguro. El certificado también debe estar registrado en SUNAT Operaciones en Línea.
2. **Datos del emisor.** Revisa RUC, razón social, dirección fiscal, ubigeo (Tarapoto: 220901) y código de establecimiento (0000 para el domicilio fiscal). Guarda.
3. **Prueba en beta.** Presiona "Probar con SUNAT beta". Firma una boleta de S/ 1.00 y la envía al entorno de pruebas de SUNAT, que usa el usuario `MODDATOS`. Debe responder "ha sido aceptada".
4. **Usuario SOL secundario.** En SUNAT Operaciones en Línea crea un usuario secundario con el perfil de envío de comprobantes electrónicos y escríbelo en la misma pestaña (sin el RUC). La clave queda en `backend/secretos`.
5. **Producción.** Cambia el modo a "Producción" y guarda. Desde ese momento cada boleta B001 se envía al emitirla.

Qué pasa en el día a día:

- **Sin internet:** la boleta se imprime igual, con su QR y hash, y queda "Por enviar". El sistema reintenta cada 2 minutos. En Ventas también está el botón "Enviar pendientes a SUNAT".
- **Rechazada:** el detalle de la venta muestra el código y el mensaje de SUNAT. El administrador puede corregir y "Reenviar a SUNAT", o anular y emitir otra.
- **Anulación** de una boleta aceptada: se informa a SUNAT en el resumen diario de bajas, que se envía solo. El estado pasa a "Baja aceptada".
- **Aviso:** si una boleta lleva más de 2 días sin ser aceptada, aparece una alerta en Inicio.
- Las boletas de **S/ 700 o más** exigen el DNI u otro documento del cliente.
- Cada boleta guarda su XML firmado, que se puede descargar desde el detalle de la venta.

Variables opcionales: `SUNAT_URL` (otro servicio, por ejemplo uno de pruebas), `SUNAT_AUTOMATICO=0` (apaga el envío automático), `SECRETOS_DIR`.

## Reglas de negocio

- Todo cambio de stock pasa por `StockService` (`backend/src/inventario/stock.service.ts`) y deja un movimiento. Ventas usarán el mismo servicio.
- Precio sugerido = costo × (1 + margen %), redondeado hacia arriba (S/ 0.10 por defecto). Al registrar una compra solo se marcan por defecto los precios que suben; bajar un precio es decisión del administrador.
- El costo del producto es el **último costo de compra**.
- Registrar compras, pagos, mermas, ajustes y editar productos es solo para el administrador. Los cajeros pueden consultar.
- Solo hay una caja abierta a la vez. Una venta solo se anula mientras su caja siga abierta.
- Los productos que controlan vencimiento se venden primero de los lotes que vencen antes.
- La boleta libre se imprime como "NOTA DE VENTA" porque no es un comprobante de SUNAT.
- Al importar desde SysVent, las presentaciones que comparten Id (por ejemplo, unidad y bolsa) quedan como productos distintos, cada uno con su código y stock. Los stocks negativos se cargan en 0 y quedan marcados "Por revisar".
- Para poner los costos, exporta de SysVent el "Reporte de stock valorizado" en CSV y corre en `backend`:
  `npm run importar:costos -- "C:\ruta\stock_producto.csv"`. Agrega `--probar` para ver los cambios sin guardar y `--stock` para igualar también el stock (la diferencia queda como ajuste en el kardex). Se puede repetir cuando quieras.
- En la venta: `F2` buscar, `F4` boleta / libre, `F6` precio, `F7` cliente, `F8` descuento, `F9` cobrar, `F10` cancelar, `F11` reimprimir. En el cobro: `F1` efectivo, `F2` Yape, `F3` Plin, `F4` tarjeta (llenan lo que falta), `Enter` confirma, `Esc` vuelve.

## Pruebas

```bash
cd backend && npm test
```
