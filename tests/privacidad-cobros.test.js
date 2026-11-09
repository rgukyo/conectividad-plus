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

test('archivar deja la deuda en cero y solo aparece en Archivados', function () {
  var ahora = '2026-10-20';
  var data = {
    clientes: [{
      id: 'nuria',
      nombre: 'Nuria Ejemplo',
      notas: 'Timbra dos veces',
      promo: 'NO',
      exento: 'NO',
      proximo_vencimiento: '2026-09-15',
      fecha_ultimo_pago: '2026-08-10',
      meses_pagados: 2
    }],
    dispositivos: [{ id: 'dn', cliente_id: 'nuria', tipo: 'Celular', modelo: 'Ejemplo', mac: 'AA-BB-CC-DD-EE-11', notas: 'Nota del equipo' }],
    pagos: [{ id: 'pn', cliente_id: 'nuria', fecha: '2026-08-10', monto: 30, meses: 1 }]
  };
  var equipos = JSON.stringify(data.dispositivos);
  var pagos = JSON.stringify(data.pagos);
  assert.strictEqual(CP.porCobrarEsteMes(data.clientes, data.dispositivos, ahora).total, 30);

  var archivada = CP.fusionarCliente(data.clientes[0], { archivado: 'SI' });
  assert.strictEqual(archivada.id, 'nuria');
  assert.strictEqual(archivada.notas, 'Timbra dos veces');
  assert.strictEqual(archivada.archivado, 'SI');
  var guardado = {
    clientes: [archivada],
    dispositivos: data.dispositivos,
    pagos: data.pagos
  };
  assert.strictEqual(JSON.stringify(guardado.dispositivos), equipos);
  assert.strictEqual(JSON.stringify(guardado.pagos), pagos);
  assert.strictEqual(guardado.dispositivos[0].notas, 'Nota del equipo');
  assert.strictEqual(CP.cargoReactivacion(archivada), 0);
  assert.strictEqual(CP.porCobrarEsteMes(guardado.clientes, guardado.dispositivos, ahora).total, 0);
  assert.strictEqual(CP.informeCobros(guardado, '2026-08', ahora).cobrado, 30);
  assert.strictEqual(CP.resumen(guardado, ahora).clientes, 0);
  assert.strictEqual(CP.resumen(guardado, ahora).vencidos, 0);
  assert.strictEqual(CP.estadoDeCliente(archivada, ahora).clave, 'archivado');
  assert.deepStrictEqual(guardado.clientes.filter(function (c) { return !CP.esArchivado(c); }), []);
  assert.deepStrictEqual(guardado.clientes.filter(function (c) { return CP.esArchivado(c); }).map(function (c) { return c.id; }), ['nuria']);
  assert.strictEqual(CP.esArchivado({ id: 'viejo', nombre: 'Registro viejo' }), false);

  var ecoViejo = { id: 'nuria', nombre: 'Nuria Ejemplo', notas: 'Timbra dos veces', reactivacion: 0 };
  assert.strictEqual(CP.marcaGuardada(archivada, ecoViejo), false);
  assert.strictEqual(CP.marcaGuardada(archivada, { archivado: 'SI', reactivacion: 0 }), true);
  assert.strictEqual(CP.respuestaTraeArchivado({ clientes: [{ id: 'nuria', nombre: 'Nuria Ejemplo' }] }), false);
  assert.strictEqual(CP.respuestaTraeArchivado({ clientes: [{ id: 'nuria', archivado: '' }] }), true);

  var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  ['function htmlInicio() {', 'function htmlResumen(grande) {', 'function htmlClienteLink(c) {', 'function htmlVencidos() {'].forEach(function (firma) {
    var cuerpo = entre(app, firma, '\n  function ');
    assert.strictEqual(cuerpo.indexOf('dinero('), -1, firma);
    assert.strictEqual(cuerpo.indexOf('Debe pagar'), -1, firma);
    assert.strictEqual(cuerpo.indexOf('$'), -1, firma);
  });
  assert.ok(entre(app, 'function htmlInicio() {', 'function htmlClientes()').indexOf('!CP.esArchivado(c)') >= 0);
  assert.ok(entre(app, 'function htmlVencidos() {', 'function htmlEquipos()').indexOf('!CP.esArchivado(c)') >= 0);
  var fijar = entre(app, 'function fijarArchivo', 'function pedirBorrar');
  var marca = fijar.indexOf('marcaGuardada');
  var exito = fijar.indexOf('Solo se ve en Archivados');
  assert.ok(marca >= 0 && exito > marca);
  assert.ok(fijar.indexOf('No se archivó') >= 0);
  assert.ok(fijar.indexOf('No se archivó') < exito);
});
