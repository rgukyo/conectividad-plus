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

test('el día 15 lista activos que vencen y deja fuera archivados y exentos', function () {
  var clientes = [
    { id: 'hoy', nombre: 'Nuria Ejemplo', exento: 'NO', proximo_vencimiento: '2026-11-15' },
    { id: 'atraso', nombre: 'Beto Ejemplo', exento: 'NO', proximo_vencimiento: '2026-10-15' },
    { id: 'futuro', nombre: 'Ciro Ejemplo', exento: 'NO', proximo_vencimiento: '2026-12-15' },
    { id: 'arch', nombre: 'Dina Ejemplo', archivado: 'SI', exento: 'NO', proximo_vencimiento: '2026-11-15' },
    { id: 'ex', nombre: 'Elena Ejemplo', exento: 'SI', proximo_vencimiento: '2026-11-15' }
  ];
  var hoy = CP.recordatoriosHoy(clientes, '2026-11-15');
  assert.deepStrictEqual(hoy.map(function (c) { return c.id; }), ['hoy', 'atraso']);
  assert.strictEqual(CP.recordatoriosHoy(clientes, '2026-11-16').length, 0);
});

test('el recordatorio no lleva monto y abre WhatsApp con el nombre', function () {
  var texto = CP.mensajeRecordatorio('Nuria Ejemplo');
  assert.strictEqual(texto.indexOf('$'), -1);
  assert.ok(texto.indexOf('Nuria Ejemplo') >= 0);
  assert.ok(texto.indexOf('👋') >= 0);
  assert.ok(texto.indexOf('📶') >= 0);
  assert.ok(texto.indexOf('✅') >= 0);
  var enlace = CP.enlaceWhatsApp('5500000091', texto);
  assert.ok(enlace.indexOf('https://wa.me/525500000091?text=') === 0);
  assert.strictEqual(decodeURIComponent(enlace.split('?text=')[1]), texto);
});
