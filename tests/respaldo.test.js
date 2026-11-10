'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

function entre(src, desde, hasta) {
  var inicio = src.indexOf(desde);
  var fin = hasta ? src.indexOf(hasta, inicio + desde.length) : src.length;
  assert.ok(inicio >= 0, desde);
  assert.ok(fin > inicio, hasta || 'fin');
  return src.slice(inicio, fin);
}

test('el respaldo semanal crea la carpeta y no duplica el disparador', function () {
  var src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  var instalar = entre(src, 'function instalarRespaldoSemanal()', 'function respaldoSemanal()');
  assert.ok(instalar.indexOf("getHandlerFunction() === 'respaldoSemanal'") >= 0);
  assert.ok(instalar.indexOf('return') < instalar.indexOf('newTrigger'));
  assert.ok(src.indexOf("var CARPETA_RESPALDOS_ = 'Conectividad Plus - Respaldos'") >= 0);
  assert.ok(src.indexOf('DriveApp.createFolder(CARPETA_RESPALDOS_)') >= 0);
  assert.strictEqual(src.indexOf("setProperty('CLAVE'"), -1);
  assert.strictEqual(src.indexOf("setProperty('SHEET_ID'"), -1);
});

test('se conservan solo las últimas 8 copias', function () {
  var items = [];
  var i;
  for (i = 1; i <= 10; i++) items.push({ id: 'r' + i, fecha: i });
  var quedan = CP.quedarseConRecientes(items, CP.MAX_RESPALDOS);
  assert.strictEqual(quedan.length, 8);
  assert.strictEqual(quedan[0].id, 'r10');
  assert.strictEqual(quedan[7].id, 'r3');
  var src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  assert.ok(src.indexOf('var MAX_RESPALDOS_ = 8') >= 0);
  assert.ok(src.indexOf('setTrashed(true)') >= 0);
});
