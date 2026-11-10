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

test('sin internet el aviso es claro y el pago queda en la cola', function () {
  assert.strictEqual(CP.MENSAJE_SIN_INTERNET, 'No se guardó: sin internet');
  var pago = { id: 'p-nuria', cliente_id: 'nuria', fecha: '2026-11-15', monto: 30, meses: 1 };
  var cola = CP.encolarOperacion([], { tipo: 'pago', pago: pago });
  cola = CP.encolarOperacion(cola, { tipo: 'pago', pago: pago });
  assert.strictEqual(cola.length, 1);
  assert.strictEqual(cola[0].pago.id, 'p-nuria');
});

test('reintentar el mismo id no duplica el pago', function () {
  var data = {
    clientes: [{ id: 'nuria', nombre: 'Nuria Ejemplo', promo: 'NO', proximo_vencimiento: '2026-11-15', meses_pagados: 0 }],
    dispositivos: [{ id: 'd1', cliente_id: 'nuria' }],
    pagos: []
  };
  var entrada = { id: 'p-nuria', cliente_id: 'nuria', fecha: '2026-11-15', monto: 30, meses: 1, registrado_por: 'Dueño' };
  var uno = CP.incorporarPago(data, entrada);
  var dos = CP.incorporarPago(uno.data, entrada);
  assert.strictEqual(uno.duplicado, false);
  assert.strictEqual(dos.duplicado, true);
  assert.strictEqual(dos.data.pagos.length, 1);
  assert.strictEqual(dos.data.pagos[0].id, 'p-nuria');
  assert.strictEqual(dos.data.pagos[0].monto, 30);
});
