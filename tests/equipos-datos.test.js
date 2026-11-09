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

test('reactivar cobra 20 una sola vez y se puede pagar', function () {
  var octubre = '2026-10-20';
  var noviembre = '2026-11-20';
  var archivada = {
    id: 'nuria',
    nombre: 'Nuria Ejemplo',
    notas: 'Timbra dos veces',
    promo: 'NO',
    exento: 'NO',
    archivado: 'SI',
    reactivacion: 0,
    proximo_vencimiento: '2026-12-15',
    fecha_ultimo_pago: '2026-10-01',
    meses_pagados: 1
  };
  var data = {
    clientes: [archivada],
    dispositivos: [{ id: 'dn', cliente_id: 'nuria' }],
    pagos: [{ id: 'pn', cliente_id: 'nuria', fecha: '2026-10-01', monto: 30, meses: 1 }]
  };
  var activa = CP.fusionarCliente(archivada, { archivado: 'NO', reactivacion: CP.CARGO_REACTIVACION });
  assert.strictEqual(CP.CARGO_REACTIVACION, 20);
  assert.strictEqual(activa.archivado, 'NO');
  assert.strictEqual(activa.reactivacion, 20);
  assert.strictEqual(activa.notas, 'Timbra dos veces');
  assert.strictEqual(CP.cargoReactivacion(activa), 20);
  var otraVez = CP.fusionarCliente(activa, { archivado: 'NO', reactivacion: CP.CARGO_REACTIVACION });
  assert.strictEqual(otraVez.reactivacion, 20);

  var conCargo = { clientes: [activa], dispositivos: data.dispositivos, pagos: data.pagos };
  assert.strictEqual(CP.porCobrarEsteMes(conCargo.clientes, conCargo.dispositivos, octubre).total, 20);
  assert.strictEqual(CP.porCobrarEsteMes(conCargo.clientes, conCargo.dispositivos, noviembre).total, 20);
  assert.strictEqual(CP.informeCobros(conCargo, '2026-10', octubre).cobrado, 30);
  assert.strictEqual(CP.marcaGuardada(activa, { archivado: 'NO' }), false);
  assert.strictEqual(CP.marcaGuardada(activa, { archivado: 'NO', reactivacion: 20 }), true);

  var soloMensual = CP.aplicarPago(conCargo, {
    cliente_id: 'nuria',
    fecha: '2026-10-21',
    meses: 1,
    monto: 30,
    registrado_por: 'Dueño'
  });
  assert.strictEqual(soloMensual.cliente.reactivacion, 20);
  assert.strictEqual(CP.porCobrarEsteMes(soloMensual.data.clientes, soloMensual.data.dispositivos, noviembre).total, 20);

  var pagado = CP.aplicarPago(conCargo, {
    cliente_id: 'nuria',
    fecha: '2026-10-21',
    meses: 1,
    monto: 50,
    registrado_por: 'Dueño'
  });
  assert.strictEqual(pagado.pago.monto, 50);
  assert.strictEqual(pagado.cliente.reactivacion, 0);
  assert.strictEqual(CP.cargoReactivacion(pagado.cliente), 0);
  assert.strictEqual(CP.porCobrarEsteMes(pagado.data.clientes, pagado.data.dispositivos, noviembre).total, 0);
  assert.strictEqual(pagado.data.pagos.length, 2);
  assert.strictEqual(CP.informeCobros(pagado.data, '2026-10', octubre).cobrado, 80);

  var sugerido = CP.aplicarPago(conCargo, {
    cliente_id: 'nuria',
    fecha: '2026-10-22',
    meses: 2,
    registrado_por: 'Dueño'
  });
  assert.strictEqual(sugerido.pago.monto, 80);
  assert.strictEqual(sugerido.cliente.reactivacion, 0);

  var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  var leyenda = 'Debe pagar $20 de reactivación';
  assert.ok(app.indexOf(leyenda) >= 0);
  assert.ok(entre(app, 'function pedirReactivar', 'function fijarArchivo').indexOf(leyenda) >= 0);
  assert.ok(entre(app, 'function htmlLeyendaReactivacion', 'function htmlMensualidad').indexOf(leyenda) >= 0);
  ['function htmlInicio() {', 'function htmlClienteLink(c) {', 'function htmlVencidos() {', 'function htmlResumen(grande) {'].forEach(function (firma) {
    assert.strictEqual(entre(app, firma, '\n  function ').indexOf(leyenda), -1, firma);
    assert.strictEqual(entre(app, firma, '\n  function ').indexOf('$'), -1, firma);
  });
  assert.ok(app.indexOf('>Reactivar</button>') >= 0);
  assert.strictEqual(app.indexOf('>Restaurar</button>'), -1);
});
