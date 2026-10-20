/**
 * Conectividad Plus — puente entre la app y el Google Sheet.
 *
 * Cómo publicarlo (también está en el README):
 * 1. En la hoja: Extensiones > Apps Script. Pega este archivo.
 * 2. Configuración del proyecto > Propiedades del script > CLAVE = una contraseña larga.
 * 3. Implementar > Nueva implementación > Aplicación web.
 *    Ejecutar como: Yo. Quién tiene acceso: Cualquier persona.
 * 4. Copia la URL que termina en /exec y pégala en Ajustes de la app.
 *
 * La app manda POST con Content-Type text/plain (JSON adentro) para no disparar
 * el preflight de CORS, que Apps Script no contesta.
 *
 * Si cambias el precio o el día 15, cambia también js/logic.js y corre las pruebas.
 */
var PRECIO_EQUIPO = 30;
var DESCUENTO_PAR = 10;
var DIA_CORTE = 15;
var TIPOS_ = ['Celular', 'Tablet', 'iPad', 'TV Smart', 'PC', 'Otro'];
var HEADERS_CLIENTES = ['id', 'nombre', 'celular', 'area', 'promo', 'fecha_ultimo_pago', 'proximo_vencimiento', 'meses_pagados', 'notas'];
var HEADERS_DISPOSITIVOS = ['id', 'cliente_id', 'tipo', 'modelo', 'mac', 'notas'];
var HEADERS_PAGOS = ['id', 'cliente_id', 'fecha', 'monto', 'meses', 'cubre_hasta', 'registrado_por'];
var CAMPOS_FECHA_ = {
  fecha_ultimo_pago: true,
  proximo_vencimiento: true,
  fecha: true,
  cubre_hasta: true
};

function doGet(e) {
  return responder_(function () {
    return despachar_((e && e.parameter) || {});
  });
}

function doPost(e) {
  return responder_(function () {
    var crudo = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    var body = {};
    if (crudo) {
      try {
        body = JSON.parse(crudo);
      } catch (err) {
        throw new Error('JSON inválido');
      }
    }
    if (!body || typeof body !== 'object') throw new Error('JSON inválido');
    return despachar_(body);
  });
}

/** Útil en el editor: selecciona prepararHojas y pulsa Ejecutar para crear las pestañas. */
function prepararHojas() {
  var ss = libro_();
  asegurarTodas_(ss);
  SpreadsheetApp.flush();
}

function responder_(fn) {
  try {
    return json_({ ok: true, data: fn() });
  } catch (err) {
    return json_({ ok: false, error: err && err.message ? String(err.message) : 'Error inesperado' });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function despachar_(req) {
  exigirClave_(req);
  var action = String(req.action || 'list').trim();
  if (action === 'list') return listar_();
  if (action === 'upsertCliente') return conCandado_(function () { return upsertCliente_(req); });
  if (action === 'upsertDispositivo') return conCandado_(function () { return upsertDispositivo_(req); });
  if (action === 'deleteDispositivo') return conCandado_(function () { return borrarDispositivo_(req); });
  if (action === 'registrarPago') return conCandado_(function () { return registrarPago_(req); });
  throw new Error('Acción desconocida.');
}

function exigirClave_(req) {
  var esperada = PropertiesService.getScriptProperties().getProperty('CLAVE');
  if (!esperada) {
    throw new Error('Falta la propiedad CLAVE. En Apps Script: Configuración del proyecto, Propiedades del script.');
  }
  var recibida = req && req.clave != null ? String(req.clave) : '';
  if (!mismaClave_(recibida, String(esperada))) throw new Error('Clave incorrecta');
}

function mismaClave_(a, b) {
  var n = Math.max(a.length, b.length);
  var diff = a.length === b.length ? 0 : 1;
  var i;
  for (i = 0; i < n; i++) {
    var ca = i < a.length ? a.charCodeAt(i) : 0;
    var cb = i < b.length ? b.charCodeAt(i) : 0;
    diff = diff | (ca ^ cb);
  }
  return diff === 0 && a.length > 0;
}

function conCandado_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Hay otro guardado en curso. Intenta de nuevo.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function libro_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(String(id));
  throw new Error('Abre el script desde la hoja: Extensiones, Apps Script.');
}

function zona_() {
  return libro_().getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/Mexico_City';
}

function listar_() {
  var ss = libro_();
  if (faltanHojas_(ss) || idsVacios_(ss)) {
    conCandado_(function () {
      asegurarTodas_(ss);
      asignarIdsFaltantes_(ss.getSheetByName('Clientes'), 'c');
      asignarIdsFaltantes_(ss.getSheetByName('Dispositivos'), 'd');
      asignarIdsFaltantes_(ss.getSheetByName('Pagos'), 'p');
    });
  }
  return {
    clientes: leerObjetos_(ss.getSheetByName('Clientes'), HEADERS_CLIENTES),
    dispositivos: leerObjetos_(ss.getSheetByName('Dispositivos'), HEADERS_DISPOSITIVOS),
    pagos: leerObjetos_(ss.getSheetByName('Pagos'), HEADERS_PAGOS)
  };
}

function faltanHojas_(ss) {
  return !ss.getSheetByName('Clientes') || !ss.getSheetByName('Dispositivos') || !ss.getSheetByName('Pagos');
}

function idsVacios_(ss) {
  if (faltanHojas_(ss)) return false;
  return faltanIds_(ss.getSheetByName('Clientes')) ||
    faltanIds_(ss.getSheetByName('Dispositivos')) ||
    faltanIds_(ss.getSheetByName('Pagos'));
}

function upsertCliente_(req) {
  var ss = libro_();
  asegurarTodas_(ss);
  var cliente = normalizarCliente_(objetoDe_(req, 'cliente'));
  if (!cliente.id) cliente.id = nuevoId_('c');
  return { cliente: guardarObjeto_(ss.getSheetByName('Clientes'), HEADERS_CLIENTES, cliente) };
}

function upsertDispositivo_(req) {
  var ss = libro_();
  asegurarTodas_(ss);
  var equipo = normalizarDispositivo_(objetoDe_(req, 'dispositivo'));
  if (equipo.cliente_id && !existeId_(ss.getSheetByName('Clientes'), equipo.cliente_id)) {
    throw new Error('Ese cliente no existe.');
  }
  if (!equipo.id) equipo.id = nuevoId_('d');
  var guardado = guardarObjeto_(ss.getSheetByName('Dispositivos'), HEADERS_DISPOSITIVOS, equipo);
  var advertencia = macRepetida_(ss.getSheetByName('Dispositivos'), guardado.mac, guardado.id);
  var respuesta = { dispositivo: guardado };
  if (advertencia) respuesta.advertencia = 'Esta MAC ya está en otro equipo.';
  return respuesta;
}

function borrarDispositivo_(req) {
  var anidado = req && req.dispositivo;
  var id = String((req && (req.id || (anidado && anidado.id))) || '').trim();
  if (!id) throw new Error('Falta el id del equipo.');
  var ss = libro_();
  asegurarTodas_(ss);
  var sh = ss.getSheetByName('Dispositivos');
  var row = indiceFila_(sh, id);
  if (row < 0) throw new Error('Equipo no encontrado');
  sh.deleteRow(row);
  return { id: id };
}

function registrarPago_(req) {
  var ss = libro_();
  asegurarTodas_(ss);
  var entrada = objetoDe_(req, 'pago');
  var shClientes = ss.getSheetByName('Clientes');
  var shPagos = ss.getSheetByName('Pagos');
  var shEquipos = ss.getSheetByName('Dispositivos');
  var clienteId = String(entrada.cliente_id || '').trim();
  var row = indiceFila_(shClientes, clienteId);
  if (row < 0) throw new Error('Cliente no encontrado');
  var cliente = leerFila_(shClientes, HEADERS_CLIENTES, row);
  var fechaTexto = String(entrada.fecha || '').trim();
  var fechaObj = fechaTexto ? parseFecha_(fechaTexto) : inicioDeDia_(new Date());
  if (!fechaObj) throw new Error('La fecha del pago no es válida.');
  var meses = parseInt(entrada.meses, 10);
  if (!meses || meses < 1) meses = 1;
  if (meses > 24) throw new Error('Máximo 24 meses por pago.');
  var equipos = leerObjetos_(shEquipos, HEADERS_DISPOSITIVOS);
  var n = 0;
  var i;
  for (i = 0; i < equipos.length; i++) {
    if (String(equipos[i].cliente_id || '') === clienteId) n++;
  }
  var mensual = precioMensual_(n, cliente.promo);
  var monto;
  if (entrada.monto === '' || entrada.monto == null) monto = mensual * meses;
  else monto = Number(entrada.monto);
  if (!isFinite(monto) || monto < 0) throw new Error('Monto inválido');
  monto = Math.round(monto * 100) / 100;
  var cubre = cubreHasta_(cliente.proximo_vencimiento, formatISO_(fechaObj), meses);
  var previos = parseInt(cliente.meses_pagados, 10);
  if (!previos || previos < 0) previos = 0;
  var pago = {
    id: String(entrada.id || '').trim() || nuevoId_('p'),
    cliente_id: clienteId,
    fecha: formatISO_(fechaObj),
    monto: monto,
    meses: meses,
    cubre_hasta: cubre,
    registrado_por: String(entrada.registrado_por || '').trim().slice(0, 80)
  };
  guardarObjeto_(shPagos, HEADERS_PAGOS, pago);
  cliente.fecha_ultimo_pago = pago.fecha;
  cliente.proximo_vencimiento = cubre;
  cliente.meses_pagados = previos + meses;
  escribirFila_(shClientes, HEADERS_CLIENTES, row, cliente);
  return { pago: pago, cliente: cliente };
}

function normalizarCliente_(input) {
  input = input || {};
  var nombre = String(input.nombre || '').trim();
  if (!nombre) throw new Error('Escribe el nombre.');
  if (nombre.length > 120) throw new Error('El nombre es demasiado largo.');
  var cel = normalizarCelular_(input.celular);
  if (!cel.ok) throw new Error(cel.error);
  var ultimoCrudo = String(input.fecha_ultimo_pago || '').trim();
  var proximoCrudo = String(input.proximo_vencimiento || '').trim();
  var ultimo = ultimoCrudo ? valorFecha_(input.fecha_ultimo_pago) : '';
  var proximo = proximoCrudo ? valorFecha_(input.proximo_vencimiento) : '';
  if (ultimoCrudo && !ultimo) throw new Error('La fecha del último pago no es válida.');
  if (proximoCrudo && !proximo) throw new Error('La fecha de vencimiento no es válida.');
  var meses = input.meses_pagados === '' || input.meses_pagados == null ? 0 : parseInt(input.meses_pagados, 10);
  if (!isFinite(meses) || meses < 0) throw new Error('Los meses pagados no son válidos.');
  var area = String(input.area || '').trim();
  var notas = String(input.notas || '').trim();
  if (area.length > 120) throw new Error('El área es demasiado larga.');
  if (notas.length > 2000) throw new Error('Las notas son demasiado largas.');
  return {
    id: String(input.id || '').trim(),
    nombre: nombre,
    celular: cel.digitos,
    area: area,
    promo: esPromo_(input.promo) ? 'SI' : 'NO',
    fecha_ultimo_pago: ultimo,
    proximo_vencimiento: proximo,
    meses_pagados: meses,
    notas: notas
  };
}

function normalizarDispositivo_(input) {
  input = input || {};
  var tipo = String(input.tipo || '').trim();
  if (TIPOS_.indexOf(tipo) < 0) throw new Error('Elige el tipo de equipo.');
  var modelo = String(input.modelo || '').trim();
  if (!modelo) throw new Error('Escribe el modelo.');
  if (modelo.length > 120) throw new Error('El modelo es demasiado largo.');
  var mac = normalizarMac_(input.mac);
  if (!mac.ok) throw new Error(mac.error);
  var notas = String(input.notas || '').trim();
  if (notas.length > 2000) throw new Error('Las notas son demasiado largas.');
  return {
    id: String(input.id || '').trim(),
    cliente_id: String(input.cliente_id || '').trim(),
    tipo: tipo,
    modelo: modelo,
    mac: mac.mac,
    notas: notas
  };
}

function esPromo_(promo) {
  if (promo === true) return true;
  var s = String(promo == null ? '' : promo).trim().toUpperCase();
  s = s.replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U');
  return s === 'SI' || s === 'S' || s === 'YES' || s === 'TRUE' || s === '1';
}

function precioMensual_(n, promo) {
  var equipos = parseInt(n, 10);
  if (!equipos || equipos < 0) equipos = 0;
  if (!esPromo_(promo)) return PRECIO_EQUIPO * equipos;
  return PRECIO_EQUIPO * equipos - DESCUENTO_PAR * Math.floor(equipos / 2);
}

function parseFecha_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (value == null || value === '') return null;
  var match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  var anio = Number(match[1]);
  var mes = Number(match[2]);
  var dia = Number(match[3]);
  var fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null;
  return fecha;
}

function formatISO_(fecha) {
  var mes = String(fecha.getMonth() + 1);
  var dia = String(fecha.getDate());
  if (mes.length < 2) mes = '0' + mes;
  if (dia.length < 2) dia = '0' + dia;
  return fecha.getFullYear() + '-' + mes + '-' + dia;
}

function inicioDeDia_(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function cubreHasta_(proximoVencimiento, fechaPago, meses) {
  var pago = parseFecha_(fechaPago);
  if (!pago) return null;
  var n = parseInt(meses, 10);
  if (!n || n < 1) n = 1;
  var vencimiento = parseFecha_(proximoVencimiento);
  var sigue = vencimiento && vencimiento.getTime() >= pago.getTime();
  var base = sigue ? vencimiento : pago;
  return formatISO_(new Date(base.getFullYear(), base.getMonth() + n, DIA_CORTE));
}

function normalizarCelular_(input) {
  var digits = String(input == null ? '' : input).replace(/\D/g, '');
  if (!digits) return { ok: false, digitos: '', error: 'Escribe el celular.' };
  if (digits.length === 13 && digits.indexOf('521') === 0) digits = digits.slice(3);
  else if (digits.length === 12 && digits.indexOf('52') === 0) digits = digits.slice(2);
  else if (digits.length === 13 && (digits.indexOf('044') === 0 || digits.indexOf('045') === 0)) digits = digits.slice(3);
  else if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
  if (digits.length !== 10) return { ok: false, digitos: digits, error: 'El celular debe tener 10 dígitos.' };
  return { ok: true, digitos: digits, error: null };
}

function normalizarMac_(input) {
  if (input == null || String(input).trim() === '') return { ok: false, mac: '', error: 'Escribe la MAC.' };
  var hex = String(input).toUpperCase().replace(/[^0-9A-F]/g, '');
  if (!/^[0-9A-F]{12}$/.test(hex)) {
    return { ok: false, mac: '', error: 'MAC inválida. Usa 12 hexadecimales, por ejemplo AA-BB-CC-DD-EE-FF.' };
  }
  return { ok: true, mac: hex.match(/.{2}/g).join('-'), error: null };
}

function valorFecha_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, zona_(), 'yyyy-MM-dd');
  }
  var parsed = parseFecha_(value);
  return parsed ? formatISO_(parsed) : '';
}

function fechaACelda_(iso) {
  var fecha = parseFecha_(iso);
  if (!fecha) return '';
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0);
}

function textoSeguro_(value) {
  var texto = String(value == null ? '' : value).trim();
  if (/^[=+\-@]/.test(texto)) return "'" + texto;
  return texto;
}

function nuevoId_(prefijo) {
  return prefijo + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

function objetoDe_(req, nombre) {
  if (req && req[nombre] && typeof req[nombre] === 'object') return req[nombre];
  return req || {};
}

function asegurarTodas_(ss) {
  asegurarHoja_(ss, 'Clientes', HEADERS_CLIENTES);
  asegurarHoja_(ss, 'Dispositivos', HEADERS_DISPOSITIVOS);
  asegurarHoja_(ss, 'Pagos', HEADERS_PAGOS);
}

function asegurarHoja_(ss, nombre, headers) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) {
    var sheets = ss.getSheets();
    if (nombre === 'Clientes' && sheets.length === 1 && sheets[0].getLastRow() === 0) {
      var unica = sheets[0].getName();
      if (unica === 'Sheet1' || unica === 'Hoja 1' || unica === 'Hoja1') {
        sheets[0].setName(nombre);
        sh = sheets[0];
      }
    }
    if (!sh) sh = ss.insertSheet(nombre);
  }
  if (sh.getLastRow() === 0 || filaVacia_(sh, headers)) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  formatearHoja_(sh, headers);
  return sh;
}

function filaVacia_(sh, headers) {
  if (sh.getLastRow() < 1) return true;
  var first = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  var i;
  for (i = 0; i < first.length; i++) {
    if (String(first[i] || '').trim() !== '') return false;
  }
  return true;
}

function formatearHoja_(sh, headers) {
  var alto = Math.max(sh.getMaxRows(), 2);
  var i;
  for (i = 0; i < headers.length; i++) {
    var campo = headers[i];
    var rango = sh.getRange(1, i + 1, alto, 1);
    if (CAMPOS_FECHA_[campo]) rango.setNumberFormat('yyyy-mm-dd');
    else if (campo === 'monto' || campo === 'meses' || campo === 'meses_pagados') rango.setNumberFormat('0.##');
    else if (campo === 'id' || campo === 'cliente_id' || campo === 'celular' || campo === 'mac') rango.setNumberFormat('@');
  }
}

function leerObjetos_(sh, headers) {
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  var out = [];
  var r;
  for (r = 0; r < values.length; r++) {
    var obj = filaAObjeto_(headers, values[r]);
    if (obj.id) out.push(obj);
  }
  return out;
}

function leerFila_(sh, headers, row) {
  return filaAObjeto_(headers, sh.getRange(row, 1, 1, headers.length).getValues()[0]);
}

function filaAObjeto_(headers, row) {
  var obj = {};
  var c;
  for (c = 0; c < headers.length; c++) {
    var campo = headers[c];
    var value = row[c];
    if (CAMPOS_FECHA_[campo]) obj[campo] = valorFecha_(value);
    else if (campo === 'monto' || campo === 'meses' || campo === 'meses_pagados') {
      if (value === '' || value == null) obj[campo] = '';
      else obj[campo] = isFinite(Number(value)) ? Number(value) : '';
    } else obj[campo] = value == null ? '' : String(value).trim();
  }
  return obj;
}

function guardarObjeto_(sh, headers, obj) {
  var row = indiceFila_(sh, obj.id);
  if (row < 0) {
    row = sh.getLastRow() + 1;
    if (row < 2) row = 2;
  } else {
    var actual = leerFila_(sh, headers, row);
    var mezclado = {};
    var i;
    for (i = 0; i < headers.length; i++) {
      var campo = headers[i];
      mezclado[campo] = Object.prototype.hasOwnProperty.call(obj, campo) && obj[campo] !== undefined ? obj[campo] : actual[campo];
    }
    mezclado.id = String(obj.id);
    obj = mezclado;
  }
  escribirFila_(sh, headers, row, obj);
  return obj;
}

function escribirFila_(sh, headers, row, obj) {
  var fila = [];
  var i;
  for (i = 0; i < headers.length; i++) {
    var campo = headers[i];
    var value = obj[campo];
    if (value == null || value === '') fila.push('');
    else if (CAMPOS_FECHA_[campo]) fila.push(fechaACelda_(value));
    else if (campo === 'monto' || campo === 'meses' || campo === 'meses_pagados') fila.push(Number(value));
    else fila.push(textoSeguro_(value));
  }
  sh.getRange(row, 1, 1, headers.length).setValues([fila]);
}

function indiceFila_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  var want = String(id).trim();
  var i;
  for (i = 0; i < ids.length; i++) {
    if (String(ids[i][0] == null ? '' : ids[i][0]).trim() === want) return i + 2;
  }
  return -1;
}

function existeId_(sh, id) {
  return indiceFila_(sh, id) >= 0;
}

function faltanIds_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return false;
  var values = sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), 1)).getValues();
  var r;
  for (r = 0; r < values.length; r++) {
    if (String(values[r][0] == null ? '' : values[r][0]).trim()) continue;
    var c;
    for (c = 1; c < values[r].length; c++) {
      if (String(values[r][c] == null ? '' : values[r][c]).trim() !== '') return true;
    }
  }
  return false;
}

function asignarIdsFaltantes_(sh, prefijo) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var values = sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), 1)).getValues();
  var r;
  for (r = 0; r < values.length; r++) {
    if (String(values[r][0] == null ? '' : values[r][0]).trim()) continue;
    var has = false;
    var c;
    for (c = 1; c < values[r].length; c++) {
      if (String(values[r][c] == null ? '' : values[r][c]).trim() !== '') has = true;
    }
    if (has) sh.getRange(r + 2, 1).setValue(nuevoId_(prefijo));
  }
}

function macRepetida_(sh, mac, exceptoId) {
  var equipos = leerObjetos_(sh, HEADERS_DISPOSITIVOS);
  var i;
  for (i = 0; i < equipos.length; i++) {
    if (String(equipos[i].id) === String(exceptoId)) continue;
    if (String(equipos[i].mac || '').toUpperCase() === String(mac || '').toUpperCase()) return true;
  }
  return false;
}
