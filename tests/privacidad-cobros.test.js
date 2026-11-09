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

test('el cobrado sale de pagos reales y el inicio no muestra importes', function () {
  var data = {
    clientes: [
      { id: 'a', nombre: 'Ana Ejemplo', promo: 'NO', exento: 'NO', proximo_vencimiento: '2026-10-15', fecha_ultimo_pago: '2026-09-10', meses_pagados: 1 },
      { id: 'b', nombre: 'Beto Ejemplo', promo: 'NO', exento: 'NO', proximo_vencimiento: '2026-09-15', fecha_ultimo_pago: '2026-08-10', meses_pagados: 1 },
      { id: 'c', nombre: 'Ciro Ejemplo', promo: 'NO', exento: 'NO', proximo_vencimiento: '', fecha_ultimo_pago: '', meses_pagados: 0 },
      { id: 'd', nombre: 'Dina Ejemplo', promo: 'NO', exento: 'NO', proximo_vencimiento: '2026-10-20', fecha_ultimo_pago: '2026-10-02', meses_pagados: 3 },
      { id: 'e', nombre: 'Elena Ejemplo', promo: 'SI', exento: 'SI', proximo_vencimiento: '2026-09-15', fecha_ultimo_pago: '2026-09-01', meses_pagados: 1 },
      { id: 'f', nombre: 'Fede Ejemplo', promo: 'NO', exento: 'NO', proximo_vencimiento: '2026-11-15', fecha_ultimo_pago: '', meses_pagados: 0 },
      { id: 'h', nombre: 'Gala Ejemplo', promo: 'NO', exento: 'NO', proximo_vencimiento: '2026-11-15', fecha_ultimo_pago: '2026-07-01', meses_pagados: 1 }
    ],
    dispositivos: [
      { id: 'da', cliente_id: 'a' },
      { id: 'db1', cliente_id: 'b' },
      { id: 'db2', cliente_id: 'b' },
      { id: 'dc', cliente_id: 'c' },
      { id: 'dd', cliente_id: 'd' },
      { id: 'de1', cliente_id: 'e' },
      { id: 'de2', cliente_id: 'e' },
      { id: 'df', cliente_id: 'f' },
      { id: 'dh', cliente_id: 'h' }
    ],
    pagos: [
      { id: 'p-ana-sep', cliente_id: 'a', fecha: '2026-09-10', monto: 30, meses: 1 },
      { id: 'p-ana-oct', cliente_id: 'a', fecha: '2026-10-05', monto: 40.5, meses: 1 },
      { id: 'p-beto-ago', cliente_id: 'b', fecha: '2026-08-10', monto: 50, meses: 1 },
      { id: 'p-beto-oct', cliente_id: 'b', fecha: '2026-10-18', monto: 10, meses: 1 },
      { id: 'p-elena', cliente_id: 'e', fecha: '2026-09-01', monto: 0, meses: 1 },
      { id: 'p-gala', cliente_id: 'h', fecha: '2026-06-01', monto: 30, meses: 1 },
      { id: 'p-sin-fecha', cliente_id: 'a', fecha: '', monto: 999, meses: 1 },
      { id: 'p-sin-monto', cliente_id: 'b', fecha: '2026-10-01', monto: '', meses: 1 }
    ]
  };
  var copia = JSON.stringify(data);
  var octubre = CP.informeCobros(data, '2026-10', '2026-10-20');
  assert.strictEqual(JSON.stringify(data), copia);
  assert.strictEqual(octubre.clave, '2026-10');
  assert.strictEqual(octubre.cobrado, 50.5);
  assert.strictEqual(octubre.pagos, 2);
  assert.strictEqual(octubre.pagosSinFecha, 1);
  assert.strictEqual(octubre.pagosSinMonto, 1);
  assert.strictEqual(octubre.pendiente.total, 150);
  assert.notStrictEqual(octubre.cobrado, octubre.pendiente.total);
  assert.deepStrictEqual(octubre.faltantes.map(function (f) { return f.id + ':' + f.motivo; }), [
    'd:sin_pagos',
    'h:fecha_sin_pago'
  ]);
  assert.ok(octubre.faltantes.every(function (f) { return f.monto == null; }));

  var septiembre = CP.informeCobros(data, '2026-09', '2026-10-20');
  assert.strictEqual(septiembre.cobrado, 30);
  assert.strictEqual(septiembre.pagos, 2);
  assert.strictEqual(septiembre.pendiente, null);
  assert.strictEqual(septiembre.esMesActual, false);

  var actual = CP.informeCobros(data, '', '2026-10-20');
  assert.strictEqual(actual.clave, '2026-10');
  assert.strictEqual(actual.cobrado, octubre.cobrado);
  assert.strictEqual(actual.pendiente.total, CP.porCobrarEsteMes(data.clientes, data.dispositivos, '2026-10-20').total);

  var vacio = CP.informeCobros({
    clientes: [{ id: 'z', nombre: 'Zoe Ejemplo', promo: 'NO', fecha_ultimo_pago: '2026-10-01', meses_pagados: 4, proximo_vencimiento: '2026-10-15' }],
    dispositivos: [{ id: 'dz', cliente_id: 'z' }, { id: 'dz2', cliente_id: 'z' }],
    pagos: []
  }, '2026-10', '2026-10-20');
  assert.strictEqual(vacio.cobrado, 0);
  assert.strictEqual(vacio.pagos, 0);
  assert.strictEqual(vacio.faltantes.length, 1);
  assert.notStrictEqual(vacio.cobrado, vacio.pendiente.total);

  assert.strictEqual(CP.esArchivado({ id: 'viejo', nombre: 'Registro viejo' }), false);
  assert.strictEqual(CP.esArchivado({ id: 'viejo', archivado: '' }), false);
  assert.strictEqual(CP.esArchivado({ id: 'viejo', archivado: 'sí' }), true);
  assert.strictEqual(CP.resumen({
    clientes: [{ id: 'viejo', proximo_vencimiento: '2026-09-15' }],
    dispositivos: [{ id: 'dv', cliente_id: 'viejo' }]
  }, '2026-10-20').clientes, 1);
  var beto = Object.assign({}, data.clientes[1], { notas: 'Portón azul' });
  var marcado = CP.fusionarCliente(beto, { archivado: 'SI' });
  assert.strictEqual(marcado.id, 'b');
  assert.strictEqual(marcado.archivado, 'SI');
  assert.strictEqual(marcado.notas, 'Portón azul');
  var equiposAntes = JSON.stringify(data.dispositivos);
  var pagosAntes = JSON.stringify(data.pagos);
  var dataArch = {
    clientes: data.clientes.map(function (c) { return c.id === 'b' ? marcado : c; }),
    dispositivos: data.dispositivos,
    pagos: data.pagos
  };
  assert.strictEqual(JSON.stringify(dataArch.dispositivos), equiposAntes);
  assert.strictEqual(JSON.stringify(dataArch.pagos), pagosAntes);
  assert.ok(dataArch.dispositivos.some(function (d) { return d.id === 'db1' && d.cliente_id === 'b'; }));
  assert.ok(dataArch.dispositivos.some(function (d) { return d.id === 'db2' && d.cliente_id === 'b'; }));
  var cobroArch = CP.informeCobros(dataArch, '2026-10', '2026-10-20');
  assert.strictEqual(cobroArch.cobrado, 50.5);
  assert.strictEqual(cobroArch.pendiente.total, 90);
  assert.strictEqual(CP.resumen(dataArch, '2026-10-20').clientes, 6);
  assert.strictEqual(CP.resumen(dataArch, '2026-10-20').vencidos, 1);
  var editado = CP.fusionarCliente(marcado, { nombre: 'Beto Ruiz' });
  assert.strictEqual(editado.archivado, 'SI');
  assert.strictEqual(editado.notas, 'Portón azul');
  assert.strictEqual(editado.id, 'b');
  var restaurado = CP.fusionarCliente(marcado, { archivado: 'NO' });
  assert.strictEqual(restaurado.archivado, 'NO');
  assert.strictEqual(restaurado.notas, 'Portón azul');
  var dataRes = {
    clientes: data.clientes.map(function (c) { return c.id === 'b' ? restaurado : c; }),
    dispositivos: data.dispositivos,
    pagos: data.pagos
  };
  assert.strictEqual(CP.informeCobros(dataRes, '2026-10', '2026-10-20').cobrado, 50.5);
  assert.strictEqual(CP.informeCobros(dataRes, '2026-10', '2026-10-20').pendiente.total, 150);
  assert.strictEqual(CP.resumen(dataRes, '2026-10-20').clientes, 7);
  assert.strictEqual(JSON.stringify(dataRes.dispositivos), equiposAntes);
  assert.strictEqual(JSON.stringify(dataRes.pagos), pagosAntes);

  var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  ['function htmlInicio() {', 'function htmlResumen(grande) {', 'function htmlClienteLink(c) {', 'function htmlVencidos() {'].forEach(function (firma) {
    var cuerpo = entre(app, firma, '\n  function ');
    assert.strictEqual(cuerpo.indexOf('porCobrar'), -1, firma);
    assert.strictEqual(cuerpo.indexOf('dinero('), -1, firma);
    assert.strictEqual(cuerpo.indexOf('Por cobrar'), -1, firma);
    assert.strictEqual(cuerpo.indexOf('$'), -1, firma);
  });
  var inicio = entre(app, 'function htmlInicio() {', 'function htmlClientes()');
  assert.ok(inicio.indexOf('Consultar cobros') >= 0);
  assert.ok(inicio.indexOf('#/cobros') >= 0);
  var cobros = entre(app, 'function htmlCobros() {', 'function htmlFaltantesCobro');
  assert.ok(cobros.indexOf('informeCobros') >= 0);
  assert.ok(cobros.indexOf('Total cobrado') >= 0);
  assert.ok(cobros.indexOf('Pendiente') >= 0);
  assert.strictEqual(cobros.indexOf('info.cobrado +'), -1);
  assert.strictEqual(cobros.indexOf('porCobrar'), -1);
  var gs = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  assert.ok(gs.indexOf("'archivado'") >= 0);
  assert.ok(gs.indexOf("copiarSiViene_(cliente, input, 'archivado'") >= 0);
  assert.strictEqual(gs.indexOf('deleteCliente'), -1);
  assert.ok(app.indexOf("archivado: CP.esArchivado(c) ? 'SI' : 'NO'") >= 0);
});
