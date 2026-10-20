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
  assert.strictEqual(Object.prototype.hasOwnProperty.call(res.cliente, 'exento'), false);
  var marcado = CP.validarCliente({
    nombre: 'Ana',
    celular: '5500000001',
    promo: 'NO',
    exento: 'sí'
  });
  assert.strictEqual(marcado.ok, true);
  assert.strictEqual(marcado.cliente.exento, 'SI');
  var apagado = CP.validarCliente({
    nombre: 'Ana',
    celular: '5500000001',
    exento: 'NO'
  });
  assert.strictEqual(apagado.cliente.exento, 'NO');
  var fusion = CP.fusionarCliente({ id: 'c1', exento: 'SI', notas: 'Portón' }, res.cliente);
  assert.strictEqual(fusion.exento, 'SI');
  assert.strictEqual(CP.fusionarCliente({ id: 'c1', exento: 'SI' }, marcado.cliente).exento, 'SI');
  assert.strictEqual(CP.fusionarCliente({ id: 'c1', exento: 'SI' }, apagado.cliente).exento, 'NO');
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

test('un equipo sin modelo se puede guardar y sigue exigiendo la MAC', function () {
  var vacio = CP.validarDispositivo({ tipo: 'TV Smart', modelo: '   ', mac: 'aa:bb:cc:dd:ee:10' }, []);
  assert.strictEqual(vacio.ok, true);
  assert.strictEqual(vacio.dispositivo.modelo, '');
  assert.strictEqual(vacio.dispositivo.mac, 'AA-BB-CC-DD-EE-10');
  assert.strictEqual(CP.validarDispositivo({ tipo: 'Celular', modelo: '', mac: '' }).ok, false);
  var largo = new Array(122).join('a');
  assert.strictEqual(CP.validarDispositivo({ tipo: 'Celular', modelo: largo, mac: 'aabbccddeeff' }).ok, false);
  var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  var linea = app.split('\n').filter(function (l) { return l.indexOf('name="modelo"') >= 0; })[0];
  assert.ok(linea);
  assert.strictEqual(linea.indexOf('required'), -1);
  var script = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  assert.ok(script.indexOf('Versión: 2') >= 0);
  assert.strictEqual(script.indexOf('Escribe el modelo'), -1);
  assert.ok(script.indexOf('El modelo es demasiado largo') >= 0);
  assert.ok(script.indexOf('function normalizarMac_') >= 0);
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

test('guardar un cliente sin fechas ni notas no las borra', function () {
  var actual = {
    id: 'c1',
    nombre: 'Ana',
    fecha_ultimo_pago: '2026-09-15',
    proximo_vencimiento: '2026-10-15',
    meses_pagados: 4,
    notas: 'Portón azul'
  };
  var parcial = CP.validarCliente({ nombre: 'Ana Ruiz', celular: '5500000001', promo: 'NO' });
  assert.strictEqual(parcial.ok, true);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(parcial.cliente, 'fecha_ultimo_pago'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(parcial.cliente, 'proximo_vencimiento'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(parcial.cliente, 'meses_pagados'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(parcial.cliente, 'notas'), false);
  var fusion = CP.fusionarCliente(actual, parcial.cliente);
  assert.strictEqual(fusion.nombre, 'Ana Ruiz');
  assert.strictEqual(fusion.fecha_ultimo_pago, '2026-09-15');
  assert.strictEqual(fusion.proximo_vencimiento, '2026-10-15');
  assert.strictEqual(fusion.meses_pagados, 4);
  assert.strictEqual(fusion.notas, 'Portón azul');
  var conNulos = CP.fusionarCliente(actual, {
    nombre: 'Ana',
    fecha_ultimo_pago: null,
    proximo_vencimiento: null,
    meses_pagados: null,
    notas: null
  });
  assert.strictEqual(conNulos.fecha_ultimo_pago, '2026-09-15');
  assert.strictEqual(conNulos.proximo_vencimiento, '2026-10-15');
  assert.strictEqual(conNulos.meses_pagados, 4);
  assert.strictEqual(conNulos.notas, 'Portón azul');
  var limpia = CP.fusionarCliente(actual, { notas: '' });
  assert.strictEqual(limpia.notas, '');
  assert.strictEqual(limpia.meses_pagados, 4);
});

test('el texto que empieza con fórmula o con salto se marca para la hoja', function () {
  assert.strictEqual(CP.textoSeguro('=1+1'), "'=1+1");
  assert.strictEqual(CP.textoSeguro('+cmd'), "'+cmd");
  assert.strictEqual(CP.textoSeguro('-1'), "'-1");
  assert.strictEqual(CP.textoSeguro('@suma'), "'@suma");
  assert.strictEqual(CP.textoSeguro('\t=1+1'), "'=1+1");
  assert.strictEqual(CP.textoSeguro('\rnota'), "'nota");
  assert.strictEqual(CP.textoSeguro('\nnota'), "'nota");
  assert.strictEqual(CP.textoSeguro('  hola'), 'hola');
  assert.strictEqual(CP.textoSeguro('Ana'), 'Ana');
});

test('los formularios no dejan que el campo id tape el id del form', function () {
  var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.ok(app.indexOf("getAttribute('id')") >= 0);
  assert.ok(app.indexOf('name="registro_id"') >= 0);
  assert.strictEqual(app.indexOf('name="id"'), -1);
  assert.strictEqual(/form\.id\s*===/.test(app), false);
  var enviar = app.slice(app.indexOf('function onSubmit'));
  var freno = enviar.indexOf('e.preventDefault()');
  assert.ok(freno >= 0);
  assert.ok(freno < enviar.indexOf('guardarClienteDesde'));
  assert.ok(freno < enviar.indexOf('guardarEquipoDesde'));
  assert.ok(freno < enviar.indexOf('guardarPagoDesde'));
});

test('el script de la hoja trae la clave, el candado y las mismas reglas', function () {
  var src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  assert.ok(src.indexOf('function doGet') >= 0);
  assert.ok(src.indexOf('function doPost') >= 0);
  assert.ok(src.indexOf("getProperty('CLAVE')") >= 0);
  assert.ok(src.indexOf('LockService.getScriptLock') >= 0);
  assert.ok(src.indexOf("['id', 'nombre', 'celular', 'area', 'promo', 'fecha_ultimo_pago', 'proximo_vencimiento', 'meses_pagados', 'notas', 'exento']") >= 0);
  assert.ok(src.indexOf('function agregarEncabezadosFaltantes_') >= 0);
  assert.ok(src.indexOf('agregarEncabezadosFaltantes_(sh, headers)') >= 0);
  assert.ok(src.indexOf('function esExento_') >= 0);
  assert.ok(src.indexOf('esExento_(cliente) ? 0 : precioMensual_(n, cliente.promo)') >= 0);
  assert.ok(src.indexOf("copiarSiViene_(cliente, input, 'exento'") >= 0);
  assert.ok(src.indexOf("['id', 'cliente_id', 'tipo', 'modelo', 'mac', 'notas']") >= 0);
  assert.ok(src.indexOf("['id', 'cliente_id', 'fecha', 'monto', 'meses', 'cubre_hasta', 'registrado_por']") >= 0);
  assert.ok(src.indexOf('upsertCliente') >= 0);
  assert.ok(src.indexOf('upsertDispositivo') >= 0);
  assert.ok(src.indexOf('deleteDispositivo') >= 0);
  assert.ok(src.indexOf('registrarPago') >= 0);
  assert.ok(src.indexOf('PRECIO_EQUIPO * equipos - DESCUENTO_PAR * Math.floor(equipos / 2)') >= 0);
  assert.ok(src.indexOf('DIA_CORTE') >= 0);
  assert.ok(src.indexOf('text/plain') >= 0 || src.indexOf('MimeType.JSON') >= 0);
  assert.ok(src.indexOf("action !== 'list'") >= 0);
  assert.ok(src.indexOf('Las escrituras van por POST') >= 0);
  assert.ok(src.indexOf('copiarSiViene_') >= 0);
  assert.ok(src.indexOf('[\\t\\r\\n]') >= 0);
  assert.ok(src.indexOf('input[campo] !== null') >= 0);
  var corte = 'vencimiento.getFullYear(), vencimiento.getMonth() + n, DIA_CORTE';
  assert.ok(src.indexOf(corte) >= 0);
  var logic = fs.readFileSync(path.join(__dirname, '..', 'js', 'logic.js'), 'utf8');
  assert.ok(logic.indexOf(corte) >= 0);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'favicon.ico')));
});

if (require.main === module) {
  process.argv.slice(2).filter(function (file) {
    return file.endsWith('.test.js');
  }).forEach(function (file) {
    require(path.resolve(file));
  });
}
