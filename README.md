# Conectividad Plus

App de celular para anotar clientes, equipos y pagos de un internet compartido. La usan dos personas: quien es dueño y quien ayuda. Los datos viven en un Google Sheet. Esta página solo es la pantalla.

No subas datos reales a este repositorio. Los ejemplos son ficticios.

## Probarla ya

Abre el sitio (o `index.html`) en Chrome. Si en Ajustes no hay dirección del script, entra en **modo demostración** con gente inventada. Ahí puedes buscar, filtrar por área, asignar un equipo y registrar un pago. Nada de eso toca una hoja.

En el teléfono: Chrome → menú → **Instalar aplicación** o **Agregar a pantalla principal**.

## Publicar en GitHub Pages

1. Cuando este cambio esté en `main`, entra a Settings → Pages.
2. Branch: `main`. Carpeta: `/ (root)`.
3. La dirección queda `https://rgukyo.github.io/conectividad-plus/`.
4. Ábrela en el celular e instálala.

El archivo de entrada es `index.html` en la raíz. No hay que compilar nada.

## Conectar el Google Sheet

1. Entra a Google Drive con la cuenta del dueño.
2. Nuevo → Hoja de cálculo. Ponle un nombre, por ejemplo `Conectividad Plus`.
3. Archivo → Configuración → Zona horaria → **Ciudad de México**. Guarda.
4. Extensiones → Apps Script.
5. Borra el código de ejemplo y pega todo `apps-script/Code.gs`.
6. Engrane **Configuración del proyecto** → **Propiedades del script** → Agregar propiedad.
   - Propiedad: `CLAVE`
   - Valor: una contraseña larga que inventen los dos. No la escribas en git ni en un chat.
7. **Implementar** → **Nueva implementación**.
8. Engrane junto a «Seleccionar tipo» → **Aplicación web**.
9. Ejecutar como: **Yo**.
10. Quién tiene acceso: **Cualquier persona**.
11. Implementar y aceptar los permisos de la hoja.
12. Copia la URL de la aplicación web. Termina en `/exec`. No uses la que dice `/dev`.
13. En la app, Ajustes: pega la URL, la misma clave y tu nombre. **Guardar y conectar**.

La primera conexión crea las pestañas `Clientes`, `Dispositivos` y `Pagos` si no están.

Si cambias `Code.gs`: Implementar → Administrar implementaciones → lápiz → Versión **Nueva versión** → Implementar. La URL sigue igual.

Quien tenga esa URL y la clave puede leer y modificar la hoja. Por eso la clave tiene que ser larga, y la página puede ser pública sin llevar datos adentro.

## Precio

- $30 por equipo al mes.
- Sin promo: 30 × equipos.
- Con promo `SI`: `30 × equipos − 10 × cada par`.
  - 2 equipos → $50
  - 3 equipos → $80
  - 4 equipos → $100
- Con `exento` en `SI`: la mensualidad es $0, no sale como vencido ni en el pendiente estimado, y al registrar un pago no se abre WhatsApp. El pago sí se puede guardar.

## Día 15

El corte es siempre el día 15. Al registrar un pago, los meses se suman al vencimiento anterior, no a la fecha en que pagó.

- Si ya hay próximo vencimiento, el nuevo es el día 15 de ese mes más los meses pagados. Una fecha que no cae en 15 se acomoda al 15 de ese mismo mes, y de ahí se cuentan los meses.
- Debía el 15/09 y pagó el 01/10 un mes → queda el 15/10. Si ese día ya pasó, sigue vencido.
- Debía el 15/08 y pagó el 16/10 un mes → queda el 15/09.
- Debía el 20/09 y pagó un mes → queda el 15/10.
- Si es el primer pago y no hay fecha, queda el 15 del mes siguiente a la fecha del pago. Un mes extra corre un mes más.

Después de guardarlo se abre WhatsApp con el recado de gracias. Si el cliente está exento, el pago se guarda y no se abre WhatsApp.

En la lista, **Por vencer** significa que faltan 5 días o menos. **Vencido** es cuando la fecha ya pasó.

El inicio no muestra importes. **Cobros** se abre con «Consultar cobros». El total cobrado suma los pagos registrados en el periodo elegido, también los de quien después se archivó. El pendiente estimado del mes en curso va aparte: es un mes de quienes vencen en el mes, de quienes ya vencieron y de quienes no tienen fecha. No multiplica meses atrasados, no es un ingreso y no se suma al cobrado. Un cliente exento, o uno archivado, no entra en ese pendiente ni en el conteo de activos ni en el de vencidos. Si alguien tiene fecha de pago y no hay renglón en Pagos, la pantalla lo dice y no inventa el monto.

**Archivar cliente** lo quita de la lista activa, con confirmación. No borra su registro, sus pagos, sus equipos ni sus notas. Solo se ve en el filtro **Archivados**. Mientras está archivado, su pendiente queda en cero. Al **Reactivar**, vuelve a la lista activa y queda el aviso «Debe pagar $20 de reactivación»: son $20 una sola vez, no cada mes, y se pueden registrar como pago. Un renglón viejo sin la columna sigue activo.

El script completo está en `apps-script/Code.gs`. Si archivar no se queda al recargar, el script publicado es el viejo. Para publicarlo sin cambiar la URL `/exec`:

1. En la hoja: Extensiones → Apps Script. Borra el código y pega todo `apps-script/Code.gs`.
2. Implementar → Administrar implementaciones → lápiz → Versión **Nueva versión** → Implementar.
3. No cambies la URL que termina en `/exec`. En la app, Ajustes → Actualizar.

Si la hoja no devuelve la marca, la app no dice que se archivó.

## Importar lo que ya tienen anotado

Está en `tools/import_template.md`. Se pega en la hoja. No guardes ese pegado en git.

## Sin internet

La primera visita guarda la página, los scripts, el estilo, el manifiesto y los íconos. Sin señal, esa copia abre la app. Para anotar algo nuevo en la hoja hace falta conexión. El modo demostración sí se puede modificar sin red, y se queda solo en ese teléfono.

Si se publica una versión nueva, aparece el aviso «Hay una versión nueva — Actualizar». No recarga sola. Si el formulario tiene cambios, pregunta «Tienes cambios sin guardar…» antes de seguir. Si otra pestaña ya actualizó, el aviso se quita. La versión se ve en Ajustes.

## Pruebas

```bash
node tests/*.test.js
```

Cubren el precio, el día 15 y la normalización de celular y MAC.

## Acciones del script

Cada petición lleva la clave. Si no coincide con la propiedad `CLAVE`, se rechaza. Las escrituras usan un candado para que las dos personas no se pisen.

- `list`
- `upsertCliente`
- `upsertDispositivo`
- `deleteDispositivo`
- `registrarPago`
