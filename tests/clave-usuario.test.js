'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

test('guardar usuario autentica con la clave de Roger y guarda la otra', function () {
  var s = cargarScript();
  var admin = s.usuarioDe_('clave-roger-admin');
  s.setUsuario_({
    clave: 'clave-roger-admin',
    claveUsuario: 'clave-jorge-larga',
    nombre: 'Jorge Daniel Colli Cocom',
    rol: 'operador'
  }, admin);
  assert.strictEqual(s.props.USUARIOS.indexOf('clave-jorge-larga'), -1);
  assert.strictEqual(s.props.USUARIOS.indexOf('clave-roger-admin'), -1);
  assert.strictEqual(s.usuarioDe_('clave-roger-admin').rol, 'admin');
  assert.strictEqual(s.usuarioDe_('clave-jorge-larga').nombre, 'Jorge Daniel Colli Cocom');
  assert.throws(function () {
    s.setUsuario_({ clave: 'clave-jorge-larga', nombre: 'Otra', rol: 'operador' }, admin);
  });
});

test('la app no pisa la clave de admin y quitar usuario no la usa', function () {
  var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  var api = entre(app, 'function api(action, extra)', 'function fetchConTiempo');
  var guardar = entre(app, 'function guardarUsuarioDesde', 'function quitarUsuario');
  assert.ok(api.indexOf('clave: state.settings.clave') > api.indexOf('extra || {}'));
  assert.ok(guardar.indexOf('claveUsuario: clave') >= 0);
  assert.strictEqual(guardar.indexOf('clave: clave'), -1);
  var gs = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  var setUsuario = entre(gs, 'function setUsuario_', 'function quitarUsuario_');
  var quitar = entre(gs, 'function quitarUsuario_', 'function autorPago_');
  assert.ok(setUsuario.indexOf('req.claveUsuario') >= 0);
  assert.strictEqual(setUsuario.split('req.claveUsuario').join('').indexOf('req.clave'), -1);
  assert.strictEqual(quitar.indexOf('req.clave'), -1);
  assert.ok(quitar.indexOf('req.nombre') >= 0);
});
