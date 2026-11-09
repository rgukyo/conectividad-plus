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

test('las tarjetas ocultan notas de importación, conservan el dato y permiten eliminar sin asignar', function () {
  var importada = 'Agregado desde datos2.xlsx fila 34 (sección ZONA FICTICIA, nombre en datos2: Persona Ejemplo). Marca/equipo en datos2 (referencia): MODELO-X';
  var hoja = 'Fila 5 de Hoja 2 original. Sin asignar. Código original: ZX-9';
  var guardada = { notas: hoja };
  assert.strictEqual(CP.notaVisibleEquipo(importada), '');
  assert.strictEqual(CP.notaVisibleEquipo(hoja), '');
  assert.strictEqual(guardada.notas, hoja);
  assert.strictEqual(CP.notaVisibleEquipo('Ejemplo sin asignar'), 'Ejemplo sin asignar');
  assert.strictEqual(CP.notaVisibleEquipo('Timbre dos veces. Portón azul.'), 'Timbre dos veces. Portón azul.');
  assert.strictEqual(CP.notaVisibleEquipo('Cliente pidió el código original del módem'), 'Cliente pidió el código original del módem');
  assert.strictEqual(CP.notaVisibleEquipo('Anoté la fila 5 de mi libreta'), 'Anoté la fila 5 de mi libreta');
  assert.strictEqual(CP.notaVisibleEquipo('Hoja de papel original'), 'Hoja de papel original');
  assert.strictEqual(CP.notaVisibleEquipo('Sin asignar'), 'Sin asignar');
  assert.strictEqual(
    CP.notaVisibleEquipo('Agregado desde datos2.xlsx fila 3. El equipo está en la sala.'),
    'El equipo está en la sala'
  );
  assert.strictEqual(
    CP.notaVisibleEquipo('Fila 5 de Hoja 2 original. Sin asignar. Código original: ZX-9. Revisar antena.'),
    'Revisar antena'
  );
  assert.strictEqual(CP.notaVisibleEquipo(''), '');
  assert.strictEqual(CP.notaVisibleEquipo(null), '');

  var app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  var lista = entre(app, 'function htmlListaEquipos() {', 'function htmlDetalle');
  assert.ok(lista.indexOf('htmlNotaEquipo(eq)') >= 0);
  assert.ok(lista.indexOf('>Eliminar</button>') >= 0);
  assert.ok(lista.indexOf('data-action="borrar-equipo"') >= 0);
  assert.ok(lista.indexOf('eq.tipo') >= 0);
  assert.ok(lista.indexOf('htmlModelo(eq)') >= 0);
  assert.ok(lista.indexOf('eq.mac') >= 0);
  assert.ok(lista.indexOf('d.notas') >= 0);
  assert.strictEqual(lista.indexOf('esc(eq.notas)'), -1);
  var botones = lista.slice(lista.indexOf('fila-botones'));
  assert.strictEqual(botones.indexOf('cliente_id'), -1);

  var ficha = entre(app, 'function htmlEquipoCard', 'function htmlHistorial');
  assert.ok(ficha.indexOf('htmlNotaEquipo(eq)') >= 0);
  assert.strictEqual(ficha.indexOf('esc(eq.notas)'), -1);

  var form = entre(app, 'function htmlFormEquipo', 'function htmlPago');
  assert.ok(form.indexOf('esc(equipo.notas)') >= 0);
  assert.strictEqual(form.indexOf('notaVisibleEquipo'), -1);

  var detalle = entre(app, 'function htmlDetalle', 'function htmlFormCliente');
  assert.ok(detalle.indexOf('htmlMensualidad(cliente)') >= 0);
  assert.strictEqual(detalle.indexOf('htmlDesglose(cliente)'), -1);
  var mensual = entre(app, 'function htmlMensualidad', 'function htmlDesglose');
  assert.ok(mensual.indexOf('Consultar mensualidad') >= 0);
  assert.ok(mensual.indexOf('Ocultar mensualidad') >= 0);
  assert.ok(mensual.indexOf('!state.mensualidadAbierta') >= 0);

  var render = entre(app, 'function render(opciones)', 'function actualizarChrome');
  assert.ok(render.indexOf('state.mensualidadAbierta = false') >= 0);
  var click = entre(app, "action === 'borrar-equipo'", "action === 'ver-clave'");
  assert.ok(click.indexOf('pedirBorrar') >= 0);
  assert.ok(click.indexOf("action === 'ver-mensualidad'") >= 0);
  assert.strictEqual(click.indexOf('borrarEquipo('), -1);
  var confirmar = entre(app, 'function pedirBorrar', 'function borrarEquipo');
  assert.ok(confirmar.indexOf('state.confirm') >= 0);
  assert.strictEqual(confirmar.indexOf('deleteDispositivo'), -1);
  assert.ok(confirmar.indexOf('borrarEquipo(id)') >= 0);

  assert.ok(detalle.indexOf('Archivar cliente') >= 0);
  assert.ok(detalle.indexOf('data-action="restaurar-cliente"') >= 0);
  assert.ok(app.indexOf('>Archivados</button>') >= 0);
  assert.strictEqual(app.indexOf('deleteCliente'), -1);
  assert.strictEqual(app.indexOf('borrarCliente'), -1);
  var pedirArch = entre(app, 'function pedirArchivar', 'function pedirRestaurar');
  assert.ok(pedirArch.indexOf('state.confirm') >= 0);
  assert.ok(pedirArch.indexOf('sus pagos, sus equipos y sus notas') >= 0);
  assert.strictEqual(pedirArch.indexOf('state.data.dispositivos'), -1);
  assert.strictEqual(pedirArch.indexOf('state.data.pagos'), -1);
  var fijar = entre(app, 'function fijarArchivo', 'function pedirBorrar');
  assert.ok(fijar.indexOf('persistirCliente(cliente)') >= 0);
  assert.ok(fijar.indexOf("archivado: archivado ? 'SI' : 'NO'") >= 0);
  assert.strictEqual(fijar.indexOf('deleteDispositivo'), -1);
  assert.strictEqual(fijar.indexOf('.dispositivos'), -1);
  assert.strictEqual(fijar.indexOf('.pagos'), -1);
  var listaClientes = entre(app, 'function htmlListaClientes', 'function htmlVencidos');
  assert.ok(listaClientes.indexOf('>Restaurar</button>') >= 0);
  assert.ok(listaClientes.indexOf("vistaArchivo === 'archivados'") >= 0);
});
