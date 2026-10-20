'use strict';

const assert = require('assert');
const CP = require('../js/logic.js');

function test(nombre, fn) {
  try {
    fn();
    console.log('ok ' + nombre);
  } catch (err) {
    console.error('FAIL ' + nombre);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

test('si sigue al corriente, el corte es el 15 del mes siguiente al vencimiento', function () {
  assert.strictEqual(CP.cubreHasta('2026-11-15', '2026-10-20', 1), '2026-12-15');
  assert.strictEqual(CP.cubreHasta('2026-11-15', '2026-10-20', 2), '2027-01-15');
  assert.strictEqual(CP.cubreHasta('2026-11-15', '2026-10-20', 3), '2027-02-15');
});

test('un pago adelantado no recorta los meses ya cubiertos', function () {
  assert.strictEqual(CP.cubreHasta('2026-12-15', '2026-10-01', 1), '2027-01-15');
  assert.strictEqual(CP.cubreHasta('2026-12-15', '2026-10-01', 2), '2027-02-15');
});

test('el mismo día del vencimiento todavía está al corriente', function () {
  assert.strictEqual(CP.cubreHasta('2026-10-15', '2026-10-15', 1), '2026-11-15');
});

test('un pago atrasado avanza desde el vencimiento anterior, no desde la fecha del pago', function () {
  assert.strictEqual(CP.cubreHasta('2026-09-15', '2026-10-01', 1), '2026-10-15');
  assert.strictEqual(CP.estadoCliente('2026-10-15', '2026-10-20').clave, 'vencido');
  assert.strictEqual(CP.cubreHasta('2026-09-15', '2026-10-20', 1), '2026-10-15');
  assert.strictEqual(CP.cubreHasta('2026-08-15', '2026-10-16', 1), '2026-09-15');
  assert.strictEqual(CP.estadoCliente(CP.cubreHasta('2026-08-15', '2026-10-16', 1), '2026-10-16').clave, 'vencido');
  assert.strictEqual(CP.cubreHasta('2026-08-15', '2026-10-01', 1), '2026-09-15');
  assert.strictEqual(CP.cubreHasta('2026-10-15', '2026-10-16', 1), '2026-11-15');
  assert.strictEqual(CP.cubreHasta('2026-09-15', '2026-10-20', 2), '2026-11-15');
});

test('una fecha que no es día 15 se acomoda al 15 de ese mismo mes', function () {
  assert.strictEqual(CP.cubreHasta('2026-09-20', '2026-10-01', 1), '2026-10-15');
  assert.strictEqual(CP.cubreHasta('2026-09-01', '2026-10-16', 1), '2026-10-15');
  assert.strictEqual(CP.cubreHasta('2026-09-20', '2026-10-01', 2), '2026-11-15');
  assert.strictEqual(CP.cubreHasta('2026-12-03', '2027-01-02', 1), '2027-01-15');
});

test('sin fecha previa se usa el mes siguiente al pago', function () {
  assert.strictEqual(CP.cubreHasta('', '2026-10-20', 1), '2026-11-15');
  assert.strictEqual(CP.cubreHasta('', '2026-10-05', 1), '2026-11-15');
  assert.strictEqual(CP.cubreHasta(null, '2026-01-05', 1), '2026-02-15');
  assert.strictEqual(CP.cubreHasta('', '2026-12-20', 1), '2027-01-15');
  assert.strictEqual(CP.cubreHasta('', '2026-10-20', 2), '2026-12-15');
  assert.strictEqual(CP.cubreHasta(undefined, '2026-10-20', 1), '2026-11-15');
});

test('meses vacío o cero cuenta como un mes', function () {
  assert.strictEqual(CP.cubreHasta('2026-11-15', '2026-10-20', 0), '2026-12-15');
  assert.strictEqual(CP.cubreHasta('2026-11-15', '2026-10-20', ''), '2026-12-15');
});

test('una fecha imposible no calcula corte', function () {
  assert.strictEqual(CP.cubreHasta('2026-11-15', '2026-02-31', 1), null);
  assert.strictEqual(CP.cubreHasta('2026-11-15', '', 1), null);
});

test('el estado usa hoy y la ventana de 5 días', function () {
  assert.deepStrictEqual(CP.estadoCliente('2026-10-19', '2026-10-20').clave, 'vencido');
  assert.strictEqual(CP.estadoCliente('2026-10-19', '2026-10-20').dias, -1);
  assert.strictEqual(CP.estadoCliente('2026-10-20', '2026-10-20').clave, 'por_vencer');
  assert.strictEqual(CP.estadoCliente('2026-10-20', '2026-10-20').dias, 0);
  assert.strictEqual(CP.estadoCliente('2026-10-25', '2026-10-20').clave, 'por_vencer');
  assert.strictEqual(CP.estadoCliente('2026-10-25', '2026-10-20').dias, 5);
  assert.strictEqual(CP.estadoCliente('2026-10-26', '2026-10-20').clave, 'al_corriente');
  assert.strictEqual(CP.estadoCliente('2026-10-26', '2026-10-20').dias, 6);
  assert.strictEqual(CP.estadoCliente('', '2026-10-20').clave, 'sin_fecha');
  assert.strictEqual(CP.estadoCliente('2026-10-25', '2026-10-20').etiqueta, 'Por vencer');
});

test('por cobrar suma un mes de vencidos, de este mes y de quienes no tienen fecha', function () {
  var dispositivos = [
    { id: 'a', cliente_id: 'A' },
    { id: 'b1', cliente_id: 'B' },
    { id: 'b2', cliente_id: 'B' },
    { id: 'c1', cliente_id: 'C' },
    { id: 'c2', cliente_id: 'C' },
    { id: 'c3', cliente_id: 'C' },
    { id: 'd', cliente_id: 'D' }
  ];
  var clientes = [
    { id: 'A', promo: 'NO', proximo_vencimiento: '2026-09-15' },
    { id: 'B', promo: 'NO', proximo_vencimiento: '2026-10-15' },
    { id: 'C', promo: 'NO', proximo_vencimiento: '2026-11-15' },
    { id: 'D', promo: 'NO', proximo_vencimiento: '' }
  ];
  var cobro = CP.porCobrarEsteMes(clientes, dispositivos, '2026-10-01');
  assert.strictEqual(cobro.total, 120);
  assert.deepStrictEqual(cobro.detalle.map(function (x) { return x.id; }), ['A', 'B', 'D']);

  var otraVez = CP.porCobrarEsteMes(
    [{ id: 'B', promo: 'NO', proximo_vencimiento: '2026-10-15' }],
    [{ id: 'b1', cliente_id: 'B' }],
    '2026-10-20'
  );
  assert.strictEqual(otraVez.total, 30);
  assert.strictEqual(otraVez.detalle.length, 1);
});

test('un exento vencido no entra en por cobrar ni se cuenta como vencido', function () {
  var dispositivos = [
    { id: 'a', cliente_id: 'A' },
    { id: 'e1', cliente_id: 'E' },
    { id: 'e2', cliente_id: 'E' },
    { id: 'f', cliente_id: 'F' }
  ];
  var clientes = [
    { id: 'A', promo: 'NO', exento: 'NO', proximo_vencimiento: '2026-09-15' },
    { id: 'E', promo: 'SI', exento: 'SI', proximo_vencimiento: '2026-09-15' },
    { id: 'F', promo: 'NO', exento: 'SI', proximo_vencimiento: '' },
    { id: 'G', promo: 'NO', exento: 'NO', proximo_vencimiento: '2026-10-22' }
  ];
  var cobro = CP.porCobrarEsteMes(clientes, dispositivos, '2026-10-20');
  assert.strictEqual(cobro.total, 30);
  assert.deepStrictEqual(cobro.detalle.map(function (x) { return x.id; }), ['A', 'G']);
  assert.strictEqual(cobro.detalle[1].monto, 0);
  var r = CP.resumen({ clientes: clientes, dispositivos: dispositivos }, '2026-10-20');
  assert.strictEqual(r.vencidos, 1);
  assert.strictEqual(r.porVencer, 1);
  assert.strictEqual(r.porCobrar, 30);
  assert.strictEqual(r.clientes, 4);
  var exento = CP.estadoDeCliente(clientes[1], '2026-10-20');
  assert.strictEqual(exento.clave, 'exento');
  assert.strictEqual(exento.etiqueta, 'Exento');
  assert.strictEqual(exento.dias, null);
  assert.strictEqual(CP.estadoDeCliente(clientes[2], '2026-10-20').clave, 'exento');
  assert.strictEqual(CP.estadoDeCliente(clientes[0], '2026-10-20').clave, 'vencido');
  assert.strictEqual(CP.estadoDeCliente(clientes[0], '2026-10-20').etiqueta, 'Vencido');
  assert.strictEqual(CP.estadoCliente('2026-09-15', '2026-10-20').clave, 'vencido');
});

test('el pago de un exento se guarda y la mensualidad sugerida es 0', function () {
  var data = {
    clientes: [{
      id: 'c1',
      nombre: 'Ana',
      promo: 'SI',
      exento: 'SI',
      proximo_vencimiento: '2026-09-15',
      meses_pagados: 1
    }],
    dispositivos: [
      { id: 'd1', cliente_id: 'c1' },
      { id: 'd2', cliente_id: 'c1' }
    ],
    pagos: []
  };
  var res = CP.aplicarPago(data, {
    cliente_id: 'c1',
    fecha: '2026-10-20',
    meses: 1,
    registrado_por: 'Rosa'
  });
  assert.strictEqual(res.pago.monto, 0);
  assert.strictEqual(res.pago.cubre_hasta, '2026-10-15');
  assert.strictEqual(res.cliente.fecha_ultimo_pago, '2026-10-20');
  assert.strictEqual(res.cliente.meses_pagados, 2);
  assert.strictEqual(res.cliente.exento, 'SI');
  assert.strictEqual(res.data.pagos.length, 1);
  var conMonto = CP.aplicarPago(data, {
    cliente_id: 'c1',
    fecha: '2026-10-20',
    meses: 1,
    monto: 10,
    registrado_por: 'Rosa'
  });
  assert.strictEqual(conMonto.pago.monto, 10);
  assert.strictEqual(conMonto.cliente.proximo_vencimiento, '2026-10-15');
});

test('registrar pago guarda historial y mueve al cliente', function () {
  var data = {
    clientes: [{
      id: 'c1',
      nombre: 'Ana',
      celular: '5500000001',
      promo: 'SI',
      proximo_vencimiento: '2026-11-15',
      fecha_ultimo_pago: '2026-10-10',
      meses_pagados: 2
    }],
    dispositivos: [
      { id: 'd1', cliente_id: 'c1' },
      { id: 'd2', cliente_id: 'c1' }
    ],
    pagos: []
  };
  var res = CP.aplicarPago(data, {
    id: 'p1',
    cliente_id: 'c1',
    fecha: '2026-10-20',
    meses: 1,
    registrado_por: 'Rosa'
  });
  assert.strictEqual(res.pago.monto, 50);
  assert.strictEqual(res.pago.cubre_hasta, '2026-12-15');
  assert.strictEqual(res.pago.registrado_por, 'Rosa');
  assert.strictEqual(res.cliente.proximo_vencimiento, '2026-12-15');
  assert.strictEqual(res.cliente.fecha_ultimo_pago, '2026-10-20');
  assert.strictEqual(res.cliente.meses_pagados, 3);
  assert.strictEqual(res.data.pagos.length, 1);
  assert.strictEqual(data.pagos.length, 0);
  assert.strictEqual(data.clientes[0].meses_pagados, 2);
});

test('un pago atrasado de dos meses sale del vencimiento anterior y respeta un monto distinto', function () {
  var data = {
    clientes: [{ id: 'c1', promo: 'NO', proximo_vencimiento: '2026-08-15', meses_pagados: 1 }],
    dispositivos: [{ id: 'd1', cliente_id: 'c1' }],
    pagos: []
  };
  var res = CP.aplicarPago(data, {
    cliente_id: 'c1',
    fecha: '2026-10-20',
    meses: 2,
    monto: 40,
    registrado_por: 'Luis'
  });
  assert.strictEqual(res.pago.cubre_hasta, '2026-10-15');
  assert.strictEqual(CP.estadoCliente(res.pago.cubre_hasta, '2026-10-20').clave, 'vencido');
  assert.strictEqual(res.pago.monto, 40);
  assert.strictEqual(res.cliente.meses_pagados, 3);
});

test('el mensaje de WhatsApp usa el texto acordado', function () {
  var texto = CP.mensajeWhatsApp('Mariana Solís', 50, '2026-12-15');
  assert.strictEqual(
    texto,
    'Hola Mariana Solís, ya recibimos tu pago de $50. ¡Gracias! Tu servicio de Conectividad Plus queda cubierto hasta el 15 de diciembre de 2026.'
  );
  assert.strictEqual(
    CP.enlaceWhatsApp('55 0000 0001', texto),
    'https://wa.me/525500000001?text=' + encodeURIComponent(texto)
  );
});

test('no se puede cobrar a un cliente que no existe', function () {
  assert.throws(function () {
    CP.aplicarPago({ clientes: [], dispositivos: [], pagos: [] }, { cliente_id: 'x', fecha: '2026-10-20' });
  }, /Cliente no encontrado/);
});

if (require.main === module) {
  const path = require('path');
  process.argv.slice(2).filter(function (file) {
    return file.endsWith('.test.js');
  }).forEach(function (file) {
    require(path.resolve(file));
  });
}
