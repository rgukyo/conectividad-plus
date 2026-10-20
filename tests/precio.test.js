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

test('sin equipos cuesta 0', function () {
  assert.strictEqual(CP.precioMensual(0, 'NO'), 0);
  assert.strictEqual(CP.precioMensual(0, 'SI'), 0);
});

test('sin promo son 30 por equipo', function () {
  assert.strictEqual(CP.precioMensual(1, 'NO'), 30);
  assert.strictEqual(CP.precioMensual(2, 'NO'), 60);
  assert.strictEqual(CP.precioMensual(3, 'no'), 90);
  assert.strictEqual(CP.precioMensual(4, ''), 120);
});

test('promo resta 10 por cada par', function () {
  assert.strictEqual(CP.precioMensual(1, 'SI'), 30);
  assert.strictEqual(CP.precioMensual(2, 'SI'), 50);
  assert.strictEqual(CP.precioMensual(3, 'si'), 80);
  assert.strictEqual(CP.precioMensual(4, 'sí'), 100);
  assert.strictEqual(CP.precioMensual(5, 'SI'), 130);
  assert.strictEqual(CP.precioMensual(6, true), 150);
});

test('el desglose explica el total', function () {
  var d = CP.desgloseMensual(4, 'SI');
  assert.strictEqual(d.equipos, 4);
  assert.strictEqual(d.bruto, 120);
  assert.strictEqual(d.pares, 2);
  assert.strictEqual(d.descuento, 20);
  assert.strictEqual(d.total, 100);
  assert.strictEqual(d.promo, true);
});

test('mensualidad de un cliente usa solo sus equipos', function () {
  var data = {
    clientes: [{ id: 'c1', promo: 'SI' }],
    dispositivos: [
      { id: 'd1', cliente_id: 'c1' },
      { id: 'd2', cliente_id: 'c1' },
      { id: 'd3', cliente_id: '' },
      { id: 'd4', cliente_id: 'c2' }
    ]
  };
  assert.strictEqual(CP.mensualidadCliente(data.clientes[0], data.dispositivos), 50);
});

test('un cliente exento paga 0 aunque tenga equipos y promo', function () {
  var dispositivos = [
    { id: 'd1', cliente_id: 'c1' },
    { id: 'd2', cliente_id: 'c1' }
  ];
  assert.strictEqual(CP.esExento({ exento: 'SI' }), true);
  assert.strictEqual(CP.esExento({ exento: 'sí' }), true);
  assert.strictEqual(CP.esExento({ exento: '1' }), true);
  assert.strictEqual(CP.esExento({ exento: 'NO' }), false);
  assert.strictEqual(CP.esExento({ exento: '' }), false);
  assert.strictEqual(CP.esExento({}), false);
  assert.strictEqual(CP.mensualidadCliente({ id: 'c1', promo: 'SI', exento: 'SI' }, dispositivos), 0);
  assert.strictEqual(CP.mensualidadCliente({ id: 'c1', promo: 'SI', exento: 'sí' }, dispositivos), 0);
  assert.strictEqual(CP.mensualidadCliente({ id: 'c1', promo: 'NO', exento: 'SI' }, dispositivos), 0);
  assert.strictEqual(CP.mensualidadCliente({ id: 'c1', promo: 'SI', exento: 'NO' }, dispositivos), 50);
  assert.strictEqual(CP.mensualidadCliente({ id: 'c1', promo: 'SI' }, dispositivos), 50);
});

if (require.main === module) {
  const path = require('path');
  process.argv.slice(2).filter(function (file) {
    return file.endsWith('.test.js');
  }).forEach(function (file) {
    require(path.resolve(file));
  });
}
