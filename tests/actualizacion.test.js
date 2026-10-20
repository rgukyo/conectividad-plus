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

test('un formulario con texto nuevo está sucio y uno intacto no', function () {
  assert.strictEqual(CP.formularioSucio([
    { type: 'text', value: 'Rosa', defaultValue: '' }
  ]), true);
  assert.strictEqual(CP.formularioSucio([
    { type: 'hidden', value: 'c1', defaultValue: '' },
    { type: 'text', value: 'Rosa', defaultValue: 'Rosa' }
  ]), false);
  assert.strictEqual(CP.formularioSucio([
    { type: 'checkbox', checked: true, defaultChecked: false }
  ]), true);
  assert.strictEqual(CP.formularioSucio([]), false);
  assert.strictEqual(CP.formularioSucio(null), false);
});

test('el azul eléctrico es el color de la marca y los íconos siguen en la caché', function () {
  var root = path.join(__dirname, '..');
  var css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
  var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  var manifest = fs.readFileSync(path.join(root, 'manifest.json'), 'utf8');
  var sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(css.indexOf('--blue: #0066FF') >= 0);
  assert.ok(css.indexOf('--blue-dark: #0047CC') >= 0);
  assert.ok(css.indexOf('--bad: #a33b32') >= 0);
  assert.ok(css.indexOf('--ok: #1c7a45') >= 0);
  assert.ok(html.indexOf('name="theme-color" content="#0066FF"') >= 0);
  assert.ok(manifest.indexOf('"theme_color": "#0066FF"') >= 0);
  assert.ok(manifest.indexOf('"background_color": "#071530"') >= 0);
  assert.ok(manifest.indexOf('"purpose": "maskable"') >= 0);
  assert.ok(manifest.indexOf('icons/icon-maskable-512.png') >= 0);
  assert.strictEqual(css.indexOf('#0c6b63'), -1);
  assert.strictEqual(html.indexOf('#0c6b63'), -1);
  assert.ok(html.indexOf('icons/icon-64.png') >= 0);
  assert.ok(html.indexOf('icons/icon-192.png') >= 0);
  assert.ok(html.indexOf('Conectividad Plus') >= 0);
  assert.ok(sw.indexOf("'./icons/icon-64.png'") >= 0);
  assert.ok(sw.indexOf("'./icons/icon-192.png'") >= 0);
  assert.ok(sw.indexOf("'./icons/icon-512.png'") >= 0);
  assert.ok(sw.indexOf("'./icons/icon-maskable-192.png'") >= 0);
  assert.ok(sw.indexOf("'./icons/icon-maskable-512.png'") >= 0);
  assert.ok(sw.indexOf("'./img/logo.webp'") >= 0);
  assert.ok(sw.indexOf("'./img/logo.jpg'") >= 0);
  assert.ok(fs.statSync(path.join(root, 'icons', 'icon-64.png')).size > 200);
  assert.ok(fs.statSync(path.join(root, 'icons', 'icon-192.png')).size > 500);
  assert.ok(fs.statSync(path.join(root, 'icons', 'icon-512.png')).size > 500);
  assert.ok(fs.statSync(path.join(root, 'icons', 'icon-maskable-512.png')).size > 500);
  assert.ok(fs.statSync(path.join(root, 'favicon.ico')).size > 200);
  var jpg = fs.statSync(path.join(root, 'img', 'logo.jpg')).size;
  var webp = fs.statSync(path.join(root, 'img', 'logo.webp')).size;
  assert.ok(jpg > 1000 && jpg < 150 * 1024, 'logo.jpg ' + jpg);
  assert.ok(webp > 1000 && webp < 150 * 1024, 'logo.webp ' + webp);
  var app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  assert.ok(app.indexOf('img/logo.webp') >= 0);
  assert.ok(app.indexOf('img/logo.jpg') >= 0);
  assert.ok(app.indexOf('logo-inicio') >= 0);
});

test('la versión del service worker y la de la app son la misma', function () {
  var sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  var enSw = sw.match(/var VERSION = '([^']+)'/);
  var enApp = app.match(/var VERSION = '([^']+)'/);
  assert.ok(enSw && enSw[1]);
  assert.strictEqual(enApp[1], enSw[1]);
  assert.ok(sw.indexOf("var CACHE = 'conectividad-plus-' + VERSION") >= 0);
  assert.ok(app.indexOf('Versión \' + esc(VERSION)') >= 0 || app.indexOf("Versión ' + esc(VERSION)") >= 0);
});

test('instalar guarda el cascarón y no toma el control', function () {
  var sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  var instalar = entre(sw, "addEventListener('install'", "addEventListener('activate'");
  assert.ok(instalar.indexOf('waitUntil') >= 0);
  assert.ok(instalar.indexOf("cache: 'reload'") >= 0);
  assert.ok(instalar.indexOf('cache.put') >= 0);
  assert.strictEqual(instalar.indexOf('skipWaiting'), -1);
  [
    './index.html',
    './manifest.json',
    './css/styles.css',
    './js/logic.js',
    './js/demo-data.js',
    './js/app.js',
    './favicon.ico',
    './icons/icon-64.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
    './img/logo.webp',
    './img/logo.jpg'
  ].forEach(function (url) {
    assert.ok(sw.indexOf("'" + url + "'") >= 0, url);
  });
  var activar = entre(sw, "addEventListener('activate'", "addEventListener('message'");
  assert.ok(activar.indexOf('caches.delete') >= 0);
  assert.ok(activar.indexOf('self.clients.claim()') >= 0);
  var mensaje = entre(sw, "addEventListener('message'", 'function pideRedPrimero');
  assert.ok(mensaje.indexOf("data.type === 'SKIP_WAITING'") >= 0);
  assert.ok(mensaje.indexOf('self.skipWaiting()') >= 0);
  assert.ok(sw.indexOf("req.mode === 'navigate'") >= 0);
  assert.ok(sw.indexOf('index\\.html') >= 0);
  assert.ok(sw.indexOf('\\.(js|css)$') >= 0);
  var fetchHandler = entre(sw, "addEventListener('fetch'", 'function redLuegoCache');
  assert.ok(fetchHandler.indexOf('webp') >= 0);
  assert.ok(fetchHandler.indexOf('jpg') >= 0);
  assert.ok(fetchHandler.indexOf('png') >= 0);
  assert.ok(fetchHandler.indexOf('ico') >= 0);
  assert.ok(sw.indexOf('return fetch(req)') >= 0);
  assert.ok(sw.indexOf('caches.match(req)') >= 0);
  assert.ok(sw.indexOf("caches.match('./index.html')") >= 0);
});

test('la app busca la versión nueva y solo recarga al toque', function () {
  var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.ok(app.indexOf("register('./sw.js', { updateViaCache: 'none' })") >= 0);
  assert.ok(app.indexOf('state.swReg.update()') >= 0);
  assert.ok(app.indexOf("document.visibilityState === 'visible'") >= 0);
  assert.ok(app.indexOf('Hay una versión nueva — Actualizar') >= 0);
  assert.ok(app.indexOf("postMessage({ type: 'SKIP_WAITING' })") >= 0);
  assert.ok(app.indexOf('cp.sw-recarga') >= 0);
  assert.ok(app.indexOf('state.recargaHecha') >= 0);
  assert.ok(app.indexOf('state.pidioActualizar') >= 0);
  var ofrecer = entre(app, 'function ofrecerActualizacion', 'function aplicarActualizacion');
  assert.strictEqual(ofrecer.indexOf('formularioSucio'), -1);
  assert.strictEqual(ofrecer.indexOf('if ('), -1);
  assert.strictEqual(ofrecer.indexOf('postMessage'), -1);
  assert.strictEqual(ofrecer.indexOf('location.reload'), -1);
  var aplicar = entre(app, 'function aplicarActualizacion', 'function alCambiarControl');
  assert.ok(aplicar.indexOf('CP.formularioSucio(camposDeFormularios())') >= 0);
  assert.ok(aplicar.indexOf('Tienes cambios sin guardar') >= 0);
  assert.ok(aplicar.indexOf('state.pidioActualizar = true') >= 0);
  assert.ok(aplicar.indexOf("postMessage({ type: 'SKIP_WAITING' })") >= 0);
  assert.ok(aplicar.indexOf('window.location.reload()') >= 0);
  var control = entre(app, 'function alCambiarControl', 'function camposDeFormularios');
  assert.ok(control.indexOf('!state.pidioActualizar') >= 0);
  assert.ok(control.indexOf('state.hayVersionNueva = false') >= 0);
  assert.ok(control.indexOf('state.recargaHecha') >= 0);
  assert.ok(control.indexOf('window.location.reload()') >= 0);
  assert.ok(control.indexOf('10000') >= 0);
  var clic = entre(app, "action === 'aplicar-version'", 'function idFormulario');
  assert.ok(clic.indexOf('aplicarActualizacion()') >= 0);
});

if (require.main === module) {
  process.argv.slice(2).filter(function (file) {
    return file.endsWith('.test.js');
  }).forEach(function (file) {
    require(path.resolve(file));
  });
}
