'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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

function cargarScript() {
  var props = { CLAVE: 'clave-roger-admin' };
  var context = {
    props: props,
    PropertiesService: {
      getScriptProperties: function () {
        return {
          getProperty: function (k) { return props[k] == null ? null : String(props[k]); },
          setProperty: function (k, v) { props[k] = String(v); }
        };
      }
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF-8' },
      computeDigest: function (algo, text) {
        var buf = crypto.createHash('sha256').update(String(text), 'utf8').digest();
        var out = [];
        var i;
        for (i = 0; i < buf.length; i++) out.push(buf[i] > 127 ? buf[i] - 256 : buf[i]);
        return out;
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), context);
  context.props = props;
  return context;
}

test('el operador no archiva, no borra y no ve montos', function () {
  var s = cargarScript();
  var admin = s.usuarioDe_('clave-roger-admin');
  assert.strictEqual(admin.rol, 'admin');
  assert.strictEqual(admin.nombre, 'Roger García');
  assert.throws(function () { s.usuarioDe_('otra-clave'); }, /Clave incorrecta/);
  s.setUsuario_({ nombre: 'Jorge Daniel Colli Cocom', rol: 'operador', clave: 'clave-jorge-larga' }, admin);
  assert.strictEqual(s.props.USUARIOS.indexOf('clave-jorge-larga'), -1);
  var op = s.usuarioDe_('clave-jorge-larga');
  assert.strictEqual(op.rol, 'operador');
  assert.strictEqual(op.nombre, 'Jorge Daniel Colli Cocom');
  assert.throws(function () { s.vigilarCamposOperador_({ archivado: 'SI' }, { archivado: 'NO' }); });
  assert.throws(function () { s.vigilarCamposOperador_({ archivado: 'NO' }, { archivado: 'SI' }); });
  assert.throws(function () { s.vigilarCamposOperador_({ exento: 'SI' }, null); });
  assert.throws(function () { s.vigilarCamposOperador_({ reactivacion: 20 }, { reactivacion: 0 }); });
  s.vigilarCamposOperador_({ nombre: 'Ana', archivado: 'NO' }, { archivado: 'NO', exento: 'NO', reactivacion: 0 });
  assert.throws(function () { s.exigirAdmin_(op); });
  s.exigirAdmin_(admin);
  var datos = {
    clientes: [{ id: 'c1', nombre: 'Ana Ejemplo', promo: 'SI', mensualidad: 30 }],
    dispositivos: [],
    pagos: [{ id: 'p1', cliente_id: 'c1', fecha: '2026-11-10', monto: 50, meses: 1, registrado_por: 'Alguien' }]
  };
  var lista = s.listaParaRol_(datos, op);
  assert.strictEqual(lista.pagos[0].monto, '');
  assert.strictEqual(lista.clientes[0].mensualidad, undefined);
  assert.strictEqual(lista.clientes[0].promo, 'SI');
  assert.strictEqual(lista.usuarios, undefined);
  assert.strictEqual(s.autorPago_({ registrado_por: 'Hacker' }, op), 'Jorge Daniel Colli Cocom');
  var gs = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  var borrar = entre(gs, 'function borrarDispositivo_', 'function registrarPago_');
  assert.ok(borrar.indexOf('exigirAdmin_(usuario)') >= 0);
  assert.ok(gs.indexOf('registrado_por: autorPago_(entrada, usuario)') >= 0);
});

test('el admin sigue viendo montos y el resumen del día no los muestra', function () {
  var s = cargarScript();
  var admin = s.usuarioDe_('clave-roger-admin');
  var datos = {
    clientes: [{ id: 'c1', nombre: 'Ana Ejemplo', promo: 'SI', mensualidad: 30 }],
    dispositivos: [],
    pagos: [{ id: 'p1', cliente_id: 'c1', fecha: '2026-11-10', monto: 50, meses: 1 }]
  };
  var lista = s.listaParaRol_(datos, admin);
  assert.strictEqual(lista.pagos[0].monto, 50);
  assert.strictEqual(lista.clientes[0].mensualidad, 30);
  assert.ok(Array.isArray(lista.usuarios));
  var hoy = '2026-11-10';
  var grupos = CP.jornadaAjena([
    { fecha: hoy, registrado_por: 'Jorge Daniel Colli Cocom', cliente_id: 'c1', monto: 40 },
    { fecha: hoy, registrado_por: 'Jorge Daniel Colli Cocom', cliente_id: 'c2', monto: 15 },
    { fecha: hoy, registrado_por: 'Roger García', cliente_id: 'c2', monto: 90 },
    { fecha: '2026-11-09', registrado_por: 'Jorge Daniel Colli Cocom', cliente_id: 'c1', monto: 10 }
  ], [
    { id: 'c1', nombre: 'Ana Ejemplo' },
    { id: 'c2', nombre: 'Luis Ejemplo' }
  ], hoy, 'Roger García');
  assert.strictEqual(grupos.length, 1);
  assert.strictEqual(grupos[0].nombre, 'Jorge Daniel Colli Cocom');
  assert.strictEqual(grupos[0].n, 2);
  assert.deepStrictEqual(grupos[0].clientes, ['Ana Ejemplo', 'Luis Ejemplo']);
  assert.strictEqual(JSON.stringify(grupos).indexOf('40'), -1);
  assert.strictEqual(JSON.stringify(grupos).indexOf('$'), -1);
  assert.strictEqual(CP.jornadaAjena([
    { fecha: hoy, registrado_por: 'Roger García', cliente_id: 'c2', monto: 90 }
  ], [{ id: 'c2', nombre: 'Luis Ejemplo' }], hoy, 'Roger García').length, 0);
  var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  var jornada = entre(app, 'function htmlJornada', 'function htmlUsuarios');
  assert.ok(jornada.indexOf('registró') >= 0);
  assert.ok(jornada.indexOf('!esAdmin()') >= 0);
  assert.strictEqual(jornada.indexOf('$'), -1);
  assert.ok(app.indexOf('htmlJornada(hoy)') >= 0);
});
