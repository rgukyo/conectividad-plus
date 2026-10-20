'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
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

test('celular mexicano a 10 dígitos', function () {
  assert.deepStrictEqual(CP.normalizarCelular('55 1234 5678'), { ok: true, digitos: '5512345678', error: null });
  assert.strictEqual(CP.normalizarCelular('(55) 1234-5678').digitos, '5512345678');
  assert.strictEqual(CP.normalizarCelular('+52 55 1234 5678').digitos, '5512345678');
  assert.strictEqual(CP.normalizarCelular('52 1 55 1234 5678').digitos, '5512345678');
  assert.strictEqual(CP.normalizarCelular('0445512345678').digitos, '5512345678');
  assert.strictEqual(CP.normalizarCelular('045 55 1234 5678').digitos, '5512345678');
  assert.strictEqual(CP.normalizarCelular('1 55 1234 5678').digitos, '5512345678');
});

test('un celular de 10 dígitos que empieza con 52 no se recorta', function () {
  assert.strictEqual(CP.normalizarCelular('5212345678').digitos, '5212345678');
  assert.strictEqual(CP.normalizarCelular('5212345678').ok, true);
});

test('celular incompleto se rechaza', function () {
  assert.strictEqual(CP.normalizarCelular('551234567').ok, false);
  assert.strictEqual(CP.normalizarCelular('').ok, false);
  assert.strictEqual(CP.normalizarCelular('abc').ok, false);
  assert.strictEqual(CP.normalizarCelular(null).ok, false);
});

test('MAC se normaliza a AA-BB-CC-DD-EE-FF', function () {
  assert.strictEqual(CP.normalizarMac('aa:bb:cc:dd:ee:ff').mac, 'AA-BB-CC-DD-EE-FF');
  assert.strictEqual(CP.normalizarMac('AA-BB-CC-DD-EE-FF').mac, 'AA-BB-CC-DD-EE-FF');
  assert.strictEqual(CP.normalizarMac('aabb.ccdd.eeff').mac, 'AA-BB-CC-DD-EE-FF');
  assert.strictEqual(CP.normalizarMac('AA BB CC DD EE FF').mac, 'AA-BB-CC-DD-EE-FF');
  assert.strictEqual(CP.normalizarMac('aabbccddeeff').mac, 'AA-BB-CC-DD-EE-FF');
  assert.strictEqual(CP.normalizarMac(' aa-bb-cc-dd-ee-ff ').ok, true);
});

test('MAC inválida se rechaza', function () {
  assert.strictEqual(CP.normalizarMac('').ok, false);
  assert.strictEqual(CP.normalizarMac('AA:BB:CC:DD:EE').ok, false);
  assert.strictEqual(CP.normalizarMac('AA:BB:CC:DD:EE:FF:11').ok, false);
  assert.strictEqual(CP.normalizarMac('zz-bb-cc-dd-ee-ff').ok, false);
  assert.strictEqual(CP.normalizarMac('GG-BB-CC-DD-EE-FF').ok, false);
});

test('avisa si la MAC ya está en otro equipo', function () {
  var equipos = [
    { id: 'd1', mac: 'aa:bb:cc:dd:ee:01', modelo: 'A' },
    { id: 'd2', mac: 'AA-BB-CC-DD-EE-02', modelo: 'B' }
  ];
  assert.strictEqual(CP.buscarMacDuplicada(equipos, 'AA-BB-CC-DD-EE-01').id, 'd1');
  assert.strictEqual(CP.buscarMacDuplicada(equipos, 'AA-BB-CC-DD-EE-01', 'd1'), null);
  assert.strictEqual(CP.buscarMacDuplicada(equipos, 'AA-BB-CC-DD-EE-09'), null);
});

test('validar cliente deja el celular en 10 dígitos y la promo en SI/NO', function () {
  var res = CP.validarCliente({
    nombre: '  Ana  ',
    celular: '+52 55 0000 0001',
    area: ' Centro ',
    promo: 'sí',
    meses_pagados: '',
    notas: ''
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.cliente.nombre, 'Ana');
  assert.strictEqual(res.cliente.celular, '5500000001');
  assert.strictEqual(res.cliente.area, 'Centro');
  assert.strictEqual(res.cliente.promo, 'SI');
  assert.strictEqual(res.cliente.meses_pagados, 0);
  assert.strictEqual(CP.validarCliente({ nombre: '', celular: '5500000001' }).ok, false);
});

test('validar equipo normaliza la MAC', function () {
  var res = CP.validarDispositivo({
    tipo: 'Celular',
    modelo: ' Samsung A14 ',
    mac: 'aa:bb:cc:dd:ee:ff',
    cliente_id: ''
  }, []);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.dispositivo.mac, 'AA-BB-CC-DD-EE-FF');
  assert.strictEqual(res.dispositivo.modelo, 'Samsung A14');
  assert.strictEqual(CP.validarDispositivo({ tipo: 'Laptop', modelo: 'X', mac: 'aabbccddeeff' }).ok, false);
});

test('el modo demostración trae los tres estados y equipos sin asignar', function () {
  require('../js/demo-data.js');
  var data = global.CPDemo.datosDemo(new Date('2026-10-20T12:00:00'));
  var claves = data.clientes.map(function (c) {
    return CP.estadoCliente(c.proximo_vencimiento, '2026-10-20').clave;
  });
  assert.ok(claves.indexOf('al_corriente') >= 0);
  assert.ok(claves.indexOf('por_vencer') >= 0);
  assert.ok(claves.indexOf('vencido') >= 0);
  assert.ok(claves.indexOf('sin_fecha') >= 0);
  var libres = data.dispositivos.filter(function (d) { return !d.cliente_id; });
  assert.ok(libres.length >= 1);
  var mariana = data.clientes.filter(function (c) { return c.id === 'c_mariana'; })[0];
  assert.strictEqual(CP.mensualidadCliente(mariana, data.dispositivos), 50);
  data.dispositivos.forEach(function (d) {
    if (!d.cliente_id) return;
    var existe = data.clientes.some(function (c) { return c.id === d.cliente_id; });
    assert.strictEqual(existe, true, d.id);
  });
  data.clientes.forEach(function (c) {
    assert.strictEqual(CP.normalizarCelular(c.celular).ok, true);
  });
  data.dispositivos.forEach(function (d) {
    assert.strictEqual(CP.normalizarMac(d.mac).ok, true);
  });
});

test('el script de la hoja trae la clave, el candado y las mismas reglas', function () {
  var src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  assert.ok(src.indexOf('function doGet') >= 0);
  assert.ok(src.indexOf('function doPost') >= 0);
  assert.ok(src.indexOf("getProperty('CLAVE')") >= 0);
  assert.ok(src.indexOf('LockService.getScriptLock') >= 0);
  assert.ok(src.indexOf("['id', 'nombre', 'celular', 'area', 'promo', 'fecha_ultimo_pago', 'proximo_vencimiento', 'meses_pagados', 'notas']") >= 0);
  assert.ok(src.indexOf("['id', 'cliente_id', 'tipo', 'modelo', 'mac', 'notas']") >= 0);
  assert.ok(src.indexOf("['id', 'cliente_id', 'fecha', 'monto', 'meses', 'cubre_hasta', 'registrado_por']") >= 0);
  assert.ok(src.indexOf('upsertCliente') >= 0);
  assert.ok(src.indexOf('upsertDispositivo') >= 0);
  assert.ok(src.indexOf('deleteDispositivo') >= 0);
  assert.ok(src.indexOf('registrarPago') >= 0);
  assert.ok(src.indexOf('PRECIO_EQUIPO * equipos - DESCUENTO_PAR * Math.floor(equipos / 2)') >= 0);
  assert.ok(src.indexOf('DIA_CORTE') >= 0);
  assert.ok(src.indexOf('text/plain') >= 0 || src.indexOf('MimeType.JSON') >= 0);
});

if (require.main === module) {
  process.argv.slice(2).filter(function (file) {
    return file.endsWith('.test.js');
  }).forEach(function (file) {
    require(path.resolve(file));
  });
}
