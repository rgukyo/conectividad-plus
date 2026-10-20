# Plantilla para pegar clientes y equipos

Estos renglones son **inventados**. No pongas nombres, celulares ni MAC reales en git. Pégalos directo en el Google Sheet del dueño.

La app crea las pestañas si no existen. También puedes crearlas a mano con estos nombres exactos: `Clientes` y `Dispositivos`. La primera fila son los títulos. No cambies los títulos.

## Clientes

Copia desde la fila de títulos. Si el renglón no trae `id`, la app le inventa uno la primera vez que se conecta.

| Columna | Qué va |
| --- | --- |
| id | Puede ir vacío, o algo como `c1`. No lo repitas. |
| nombre | Nombre del cliente. |
| celular | 10 dígitos. También acepta `+52` y espacios; la app lo deja en 10. |
| area | Colonia o zona. Sirve para filtrar. |
| promo | `SI` o `NO`. |
| fecha_ultimo_pago | `AAAA-MM-DD` o vacío. |
| proximo_vencimiento | `AAAA-MM-DD`. El corte del negocio es el día 15. Vacío si todavía no paga. |
| meses_pagados | Número. `0` si es nuevo. |
| notas | Texto libre. Vacío si no hay. |

```csv
id,nombre,celular,area,promo,fecha_ultimo_pago,proximo_vencimiento,meses_pagados,notas
c_ejemplo_1,Nombre Ejemplo,5500000091,Col. Ejemplo,NO,2026-09-15,2026-10-15,1,Dato ficticio — borra esta fila
c_ejemplo_2,Otra Persona,5500000092,Otra Colonia,SI,2026-10-10,2026-11-15,3,Dato ficticio — borra esta fila
```

## Dispositivos

`cliente_id` vacío significa **sin asignar**. Tiene que coincidir con el `id` de un cliente si ya tiene dueño.

| Columna | Qué va |
| --- | --- |
| id | Puede ir vacío, o algo como `d1`. |
| cliente_id | El `id` del cliente, o vacío. |
| tipo | Uno de: `Celular`, `Tablet`, `iPad`, `TV Smart`, `PC`, `Otro`. |
| modelo | Texto, por ejemplo `Samsung A14`. |
| mac | 12 hexadecimales. La app la guarda como `AA-BB-CC-DD-EE-FF`. |
| notas | Texto libre. |

```csv
id,cliente_id,tipo,modelo,mac,notas
d_ejemplo_1,c_ejemplo_1,Celular,Modelo ejemplo,AA-BB-CC-DD-EE-91,Dato ficticio — borra esta fila
d_ejemplo_2,,TV Smart,Modelo sin dueño,AA-BB-CC-DD-EE-92,Dato ficticio — queda en Sin asignar
```

## Cómo pegarlo

1. Abre la pestaña `Clientes`.
2. Selecciona la celda A1.
3. Pega la tabla. Si cae toda en una sola columna: Datos → Dividir texto en columnas → Coma.
4. Repite en `Dispositivos`.
5. Borra los renglones de ejemplo antes de pegar los tuyos.
6. Revisa que el celular no se haya vuelto `5.50E+09`. Si pasó, selecciona la columna, Formato → Número → Texto plano, y vuelve a escribir los 10 dígitos.

## Pagos

No hace falta importarlos. Se llenan cuando registras un pago en la app.

Columnas, por si las ves en la hoja: `id`, `cliente_id`, `fecha`, `monto`, `meses`, `cubre_hasta`, `registrado_por`.
