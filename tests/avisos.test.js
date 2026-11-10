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

test('los avisos no incluyen archivados ni montos', function () {
  var clientes = [
    { id: 'a', nombre: 'Nuria Ejemplo', celular: '5500000091', area: 'Centro', archivado: 'NO' },
    { id: 'b', nombre: 'Beto Ejemplo', celular: '5500000092', area: 'Norte', archivado: 'NO' },
    { id: 'c', nombre: 'Dina Ejemplo', celular: '5500000093', area: 'Centro', archivado: 'SI' }
  ];
  var todos = CP.destinatariosAviso(clientes, '');
  assert.deepStrictEqual(todos.map(function (c) { return c.id; }), ['a', 'b']);
  var centro = CP.destinatariosAviso(clientes, 'Centro');
  assert.deepStrictEqual(centro.map(function (c) { return c.id; }), ['a']);
  var plantilla = CP.PLANTILLAS_AVISO[0].texto;
  var mensaje = CP.mensajeAviso(plantilla, 'Nuria Ejemplo');
  assert.strictEqual(mensaje.indexOf('$'), -1);
  assert.strictEqual(mensaje.indexOf('30'), -1);
  assert.ok(mensaje.indexOf('Nuria Ejemplo') >= 0);
  assert.strictEqual(CP.numerosDifusion(todos).join(','), '+525500000091,+525500000092');
  assert.strictEqual(CP.numerosDifusion(clientes).indexOf('+525500000093'), -1);
});

test('el contador marca los avisos ya abiertos', function () {
  var clientes = [
    { id: 'a', nombre: 'Nuria Ejemplo' },
    { id: 'b', nombre: 'Beto Ejemplo' }
  ];
  var cero = CP.conteoAvisos(clientes, {});
  assert.strictEqual(cero.texto, '0 de 2');
  var uno = CP.conteoAvisos(clientes, { a: true });
  assert.strictEqual(uno.texto, '1 de 2');
  assert.strictEqual(uno.hechos, 1);
  assert.strictEqual(uno.total, 2);
});
