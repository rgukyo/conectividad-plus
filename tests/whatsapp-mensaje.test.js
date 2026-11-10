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

test('el mensaje de WhatsApp no lleva el monto', function () {
  var texto = CP.mensajeWhatsApp('Nuria Ejemplo', 1860, '2026-12-15');
  assert.strictEqual(texto.indexOf('$'), -1);
  assert.strictEqual(texto.indexOf('1860'), -1);
  assert.strictEqual(texto.indexOf('1,860'), -1);
});

test('el mensaje lleva el nombre, la fecha y los emojis', function () {
  var texto = CP.mensajeWhatsApp('Nuria Ejemplo', 30, '2026-12-15');
  var fecha = CP.fechaLarga('2026-12-15');
  assert.ok(texto.indexOf('Nuria Ejemplo') >= 0);
  assert.ok(texto.indexOf(fecha) >= 0);
  assert.ok(texto.indexOf('👋') >= 0);
  assert.ok(texto.indexOf('✅') >= 0);
  assert.ok(texto.indexOf('📶') >= 0);
  assert.strictEqual(
    texto,
    '¡Hola Nuria Ejemplo! 👋 Gracias por tu pago oportuno. Tu servicio de Conectividad Plus queda cubierto hasta el ' +
      fecha + ' ✅ ¡Que disfrutes tu conexión! 📶'
  );
  var enlace = CP.enlaceWhatsApp('5500000001', texto);
  var codificado = enlace.split('?text=')[1];
  assert.strictEqual(decodeURIComponent(codificado), texto);
  assert.ok(codificado.indexOf(encodeURIComponent('👋')) >= 0);
  assert.ok(codificado.indexOf(encodeURIComponent('✅')) >= 0);
  assert.ok(codificado.indexOf(encodeURIComponent('📶')) >= 0);
});
