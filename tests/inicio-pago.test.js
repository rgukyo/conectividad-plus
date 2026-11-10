'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

function entre(src, desde, hasta) {
  var inicio = src.indexOf(desde);
  var fin = hasta ? src.indexOf(hasta, inicio + desde.length) : src.length;
  assert.ok(inicio >= 0, desde);
  assert.ok(fin > inicio, hasta || 'fin');
  return src.slice(inicio, fin);
}

var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('el inicio muestra Registrar pago en Por vencer', function () {
  var inicio = entre(app, 'function htmlInicio() {', 'function htmlClientes()');
  var grupo = entre(app, 'function htmlGrupo', 'function htmlFichaInicio');
  assert.ok(inicio.indexOf("htmlGrupo('Por vencer'") >= 0);
  assert.ok(inicio.indexOf("htmlGrupo('Vencidos'") >= 0);
  assert.ok(inicio.indexOf("htmlGrupo('Sin fecha de pago'") >= 0);
  assert.ok(inicio.indexOf('!CP.esArchivado(c)') >= 0);
  assert.ok(grupo.indexOf('Registrar pago') >= 0);
  assert.ok(grupo.indexOf('htmlFichaInicio(c)') >= 0);
  assert.strictEqual(grupo.indexOf('$'), -1);
  assert.strictEqual(grupo.indexOf('dinero('), -1);
});

test('el botón abre el pago de ese cliente y el nombre abre la ficha', function () {
  var grupo = entre(app, 'function htmlGrupo', 'function htmlFichaInicio');
  var ficha = entre(app, 'function htmlFichaInicio', 'function htmlClienteLink');
  assert.ok(grupo.indexOf("seg(c.id) + '/pago\"") >= 0);
  assert.ok(grupo.indexOf('href="#/clientes/\'') >= 0);
  assert.ok(ficha.indexOf('href="#/clientes/\' + seg(c.id) + \'"') >= 0);
  assert.strictEqual(ficha.indexOf('/pago'), -1);
  assert.strictEqual(ficha.indexOf('$'), -1);
});
