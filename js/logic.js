/*
 * Reglas de Conectividad Plus.
 * Si cambias el precio, el día 15 o el celular/MAC, actualiza también
 * apps-script/Code.gs y corre: node tests/*.test.js
 */
(function (root, factory) {
  var api = factory();
  root.CP = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var PRECIO_EQUIPO = 30;
  var DESCUENTO_PAR = 10;
  var DIA_CORTE = 15;
  var DIAS_POR_VENCER = 5;
  var MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  var MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var TIPOS = ['Celular', 'Tablet', 'iPad', 'TV Smart', 'PC', 'Otro'];

  function esPromo(promo) {
    if (promo === true) return true;
    var s = String(promo == null ? '' : promo).trim().toUpperCase();
    if (typeof s.normalize === 'function') {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return s === 'SI' || s === 'S' || s === 'YES' || s === 'TRUE' || s === '1';
  }

  function esExento(cliente) {
    if (cliente && typeof cliente === 'object') return esPromo(cliente.exento);
    return esPromo(cliente);
  }

  function precioMensual(n, promo) {
    var equipos = parseInt(n, 10);
    if (!equipos || equipos < 0) equipos = 0;
    var total = PRECIO_EQUIPO * equipos;
    if (esPromo(promo)) {
      total -= DESCUENTO_PAR * Math.floor(equipos / 2);
    }
    return total;
  }

  function desgloseMensual(n, promo) {
    var equipos = parseInt(n, 10);
    if (!equipos || equipos < 0) equipos = 0;
    var promoActiva = esPromo(promo);
    var pares = Math.floor(equipos / 2);
    var descuento = promoActiva ? DESCUENTO_PAR * pares : 0;
    return {
      equipos: equipos,
      promo: promoActiva,
      bruto: PRECIO_EQUIPO * equipos,
      pares: pares,
      descuento: descuento,
      total: PRECIO_EQUIPO * equipos - descuento
    };
  }

  function parseFecha(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    var match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    var anio = Number(match[1]);
    var mes = Number(match[2]);
    var dia = Number(match[3]);
    var fecha = new Date(anio, mes - 1, dia);
    if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
      return null;
    }
    return fecha;
  }

  function formatISO(fecha) {
    if (!(fecha instanceof Date) || isNaN(fecha.getTime())) return '';
    var mes = String(fecha.getMonth() + 1);
    var dia = String(fecha.getDate());
    if (mes.length < 2) mes = '0' + mes;
    if (dia.length < 2) dia = '0' + dia;
    return fecha.getFullYear() + '-' + mes + '-' + dia;
  }

  function inicioDeDia(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    var parsed = parseFecha(value);
    if (parsed) return parsed;
    var ahora = new Date();
    return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  }

  function cubreHasta(proximoVencimiento, fechaPago, meses) {
    var pago = parseFecha(fechaPago);
    if (!pago) return null;
    var n = parseInt(meses, 10);
    if (!n || n < 1) n = 1;
    var vencimiento = parseFecha(proximoVencimiento);
    if (!vencimiento) {
      return formatISO(new Date(pago.getFullYear(), pago.getMonth() + n, DIA_CORTE));
    }
    // El día que no es 15 se acomoda al 15 de ese mismo mes, y de ahí se suman los meses.
    return formatISO(new Date(vencimiento.getFullYear(), vencimiento.getMonth() + n, DIA_CORTE));
  }

  function diasEntre(desde, hasta) {
    var ms = inicioDeDia(hasta).getTime() - inicioDeDia(desde).getTime();
    return Math.round(ms / 86400000);
  }

  function estadoCliente(proximoVencimiento, now) {
    var hoy = inicioDeDia(now || new Date());
    var vencimiento = parseFecha(proximoVencimiento);
    if (!vencimiento) {
      return { clave: 'sin_fecha', etiqueta: 'Sin fecha', dias: null };
    }
    var dias = diasEntre(hoy, vencimiento);
    if (dias < 0) return { clave: 'vencido', etiqueta: 'Vencido', dias: dias };
    if (dias <= DIAS_POR_VENCER) return { clave: 'por_vencer', etiqueta: 'Por vencer', dias: dias };
    return { clave: 'al_corriente', etiqueta: 'Al corriente', dias: dias };
  }

  function estadoDeCliente(cliente, now) {
    if (esExento(cliente)) return { clave: 'exento', etiqueta: 'Exento', dias: null };
    var fecha = cliente && typeof cliente === 'object' ? cliente.proximo_vencimiento : cliente;
    return estadoCliente(fecha, now);
  }

  function normalizarCelular(input) {
    var digits = String(input == null ? '' : input).replace(/\D/g, '');
    if (!digits) return { ok: false, digitos: '', error: 'Escribe el celular.' };
    if (digits.length === 13 && digits.indexOf('521') === 0) digits = digits.slice(3);
    else if (digits.length === 12 && digits.indexOf('52') === 0) digits = digits.slice(2);
    else if (digits.length === 13 && (digits.indexOf('044') === 0 || digits.indexOf('045') === 0)) {
      digits = digits.slice(3);
    } else if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
    if (digits.length !== 10) {
      return { ok: false, digitos: digits, error: 'El celular debe tener 10 dígitos.' };
    }
    return { ok: true, digitos: digits, error: null };
  }

  function normalizarMac(input) {
    if (input == null || String(input).trim() === '') {
      return { ok: false, mac: '', error: 'Escribe la MAC.' };
    }
    var hex = String(input).toUpperCase().replace(/[^0-9A-F]/g, '');
    if (!/^[0-9A-F]{12}$/.test(hex)) {
      return {
        ok: false,
        mac: '',
        error: 'MAC inválida. Usa 12 hexadecimales, por ejemplo AA-BB-CC-DD-EE-FF.'
      };
    }
    return { ok: true, mac: hex.match(/.{2}/g).join('-'), error: null };
  }

  function buscarMacDuplicada(dispositivos, mac, exceptoId) {
    var normal = normalizarMac(mac);
    if (!normal.ok) return null;
    var lista = dispositivos || [];
    for (var i = 0; i < lista.length; i++) {
      var equipo = lista[i];
      if (exceptoId && String(equipo.id) === String(exceptoId)) continue;
      var otra = normalizarMac(equipo.mac);
      if (otra.ok && otra.mac === normal.mac) return equipo;
    }
    return null;
  }

  function fechaLarga(iso) {
    var fecha = parseFecha(iso);
    if (!fecha) return '';
    return fecha.getDate() + ' de ' + MESES[fecha.getMonth()] + ' de ' + fecha.getFullYear();
  }

  function fechaCorta(iso) {
    var fecha = parseFecha(iso);
    if (!fecha) return '';
    return fecha.getDate() + ' ' + MESES_CORTOS[fecha.getMonth()] + ' ' + fecha.getFullYear();
  }

  function formatPesos(monto) {
    var n = Number(monto);
    if (!isFinite(n)) n = 0;
    n = Math.round(n * 100) / 100;
    if (Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n));
    return n.toFixed(2);
  }

  function mensajeWhatsApp(nombre, monto, cubreHastaIso) {
    return 'Hola ' + String(nombre || '').trim() +
      ', ya recibimos tu pago de $' + formatPesos(monto) +
      '. ¡Gracias! Tu servicio de Conectividad Plus queda cubierto hasta el ' +
      fechaLarga(cubreHastaIso) + '.';
  }

  function enlaceWhatsApp(celular10, texto) {
    var cel = normalizarCelular(celular10);
    if (!cel.ok) return '';
    return 'https://wa.me/52' + cel.digitos + '?text=' + encodeURIComponent(texto || '');
  }

  function equiposDeCliente(dispositivos, clienteId) {
    var id = String(clienteId || '');
    if (!id) return [];
    return (dispositivos || []).filter(function (equipo) {
      return String(equipo.cliente_id || '') === id;
    });
  }

  function mensualidadCliente(cliente, dispositivos) {
    if (!cliente) return 0;
    if (esExento(cliente)) return 0;
    return precioMensual(equiposDeCliente(dispositivos, cliente.id).length, cliente.promo);
  }

  function porCobrarEsteMes(clientes, dispositivos, now) {
    var hoy = inicioDeDia(now || new Date());
    var total = 0;
    var detalle = [];
    (clientes || []).forEach(function (cliente) {
      if (esExento(cliente)) return;
      var estado = estadoCliente(cliente.proximo_vencimiento, hoy);
      var vencimiento = parseFecha(cliente.proximo_vencimiento);
      var incluir = estado.clave === 'vencido' || estado.clave === 'sin_fecha';
      if (!incluir && vencimiento &&
          vencimiento.getFullYear() === hoy.getFullYear() &&
          vencimiento.getMonth() === hoy.getMonth()) {
        incluir = true;
      }
      if (!incluir) return;
      var monto = mensualidadCliente(cliente, dispositivos);
      total += monto;
      detalle.push({ id: cliente.id, monto: monto, estado: estado.clave });
    });
    return { total: total, detalle: detalle };
  }

  function resumen(data, now) {
    var fuente = data || {};
    var clientes = fuente.clientes || [];
    var cobro = porCobrarEsteMes(clientes, fuente.dispositivos, now);
    var vencidos = 0;
    var porVencer = 0;
    clientes.forEach(function (cliente) {
      var estado = estadoDeCliente(cliente, now);
      if (estado.clave === 'vencido') vencidos += 1;
      if (estado.clave === 'por_vencer') porVencer += 1;
    });
    return {
      clientes: clientes.length,
      porCobrar: cobro.total,
      vencidos: vencidos,
      porVencer: porVencer,
      detalleCobro: cobro.detalle
    };
  }

  function clonarData(data) {
    function copiar(lista) {
      return (lista || []).map(function (item) {
        return Object.assign({}, item);
      });
    }
    return {
      clientes: copiar(data && data.clientes),
      dispositivos: copiar(data && data.dispositivos),
      pagos: copiar(data && data.pagos)
    };
  }

  function validarCliente(input) {
    input = input || {};
    var nombre = String(input.nombre || '').trim();
    if (!nombre) return { ok: false, error: 'Escribe el nombre.' };
    if (nombre.length > 120) return { ok: false, error: 'El nombre es demasiado largo.' };
    var celular = normalizarCelular(input.celular);
    if (!celular.ok) return { ok: false, error: celular.error };
    var cliente = {
      id: String(input.id || '').trim(),
      nombre: nombre,
      celular: celular.digitos,
      area: String(input.area || '').trim(),
      promo: esPromo(input.promo) ? 'SI' : 'NO'
    };
    if (campoPresente(input, 'exento')) {
      cliente.exento = esPromo(input.exento) ? 'SI' : 'NO';
    }
    if (campoPresente(input, 'fecha_ultimo_pago')) {
      var ultimo = String(input.fecha_ultimo_pago).trim();
      if (ultimo && !parseFecha(ultimo)) return { ok: false, error: 'La fecha del último pago no es válida.' };
      cliente.fecha_ultimo_pago = ultimo ? formatISO(parseFecha(ultimo)) : '';
    }
    if (campoPresente(input, 'proximo_vencimiento')) {
      var proximo = String(input.proximo_vencimiento).trim();
      if (proximo && !parseFecha(proximo)) return { ok: false, error: 'La fecha de vencimiento no es válida.' };
      cliente.proximo_vencimiento = proximo ? formatISO(parseFecha(proximo)) : '';
    }
    if (campoPresente(input, 'meses_pagados')) {
      var meses = String(input.meses_pagados).trim();
      var mesesNum = meses === '' ? 0 : parseInt(meses, 10);
      if (!isFinite(mesesNum) || mesesNum < 0) {
        return { ok: false, error: 'Los meses pagados no son válidos.' };
      }
      cliente.meses_pagados = mesesNum;
    }
    if (campoPresente(input, 'notas')) {
      var notas = String(input.notas).trim();
      if (notas.length > 2000) return { ok: false, error: 'Las notas son demasiado largas.' };
      cliente.notas = notas;
    }
    return { ok: true, cliente: cliente };
  }

  function validarDispositivo(input, dispositivos) {
    input = input || {};
    var tipo = String(input.tipo || '').trim();
    if (TIPOS.indexOf(tipo) < 0) return { ok: false, error: 'Elige el tipo de equipo.' };
    var modelo = String(input.modelo || '').trim();
    if (modelo.length > 120) return { ok: false, error: 'El modelo es demasiado largo.' };
    var mac = normalizarMac(input.mac);
    if (!mac.ok) return { ok: false, error: mac.error };
    var notas = String(input.notas || '').trim();
    if (notas.length > 2000) return { ok: false, error: 'Las notas son demasiado largas.' };
    return {
      ok: true,
      duplicado: buscarMacDuplicada(dispositivos, mac.mac, input.id),
      dispositivo: {
        id: String(input.id || '').trim(),
        cliente_id: String(input.cliente_id || '').trim(),
        tipo: tipo,
        modelo: modelo,
        mac: mac.mac,
        notas: notas
      }
    };
  }

  function aplicarPago(data, entrada, ahora) {
    entrada = entrada || {};
    var next = clonarData(data);
    var cliente = null;
    for (var i = 0; i < next.clientes.length; i++) {
      if (String(next.clientes[i].id) === String(entrada.cliente_id || '')) {
        cliente = next.clientes[i];
        break;
      }
    }
    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }
    var fechaObj = String(entrada.fecha || '').trim()
      ? parseFecha(entrada.fecha)
      : inicioDeDia(ahora || new Date());
    if (!fechaObj) throw new Error('La fecha del pago no es válida.');
    var meses = parseInt(entrada.meses, 10);
    if (!meses || meses < 1) meses = 1;
    if (meses > 24) throw new Error('Máximo 24 meses por pago.');
    var mensual = mensualidadCliente(cliente, next.dispositivos);
    var monto;
    if (entrada.monto === '' || entrada.monto == null) monto = mensual * meses;
    else monto = Number(entrada.monto);
    if (!isFinite(monto) || monto < 0) throw new Error('Monto inválido');
    monto = Math.round(monto * 100) / 100;
    var cubre = cubreHasta(cliente.proximo_vencimiento, formatISO(fechaObj), meses);
    var previos = parseInt(cliente.meses_pagados, 10);
    if (!previos || previos < 0) previos = 0;
    var pago = {
      id: String(entrada.id || '').trim() || ('p' + formatISO(fechaObj).replace(/-/g, '') + String(next.pagos.length + 1)),
      cliente_id: String(cliente.id),
      fecha: formatISO(fechaObj),
      monto: monto,
      meses: meses,
      cubre_hasta: cubre,
      registrado_por: String(entrada.registrado_por || '').trim().slice(0, 80)
    };
    cliente.fecha_ultimo_pago = pago.fecha;
    cliente.proximo_vencimiento = cubre;
    cliente.meses_pagados = previos + meses;
    next.pagos.push(pago);
    return { data: next, pago: pago, cliente: Object.assign({}, cliente) };
  }

  var CAMPOS_PRESERVAR = ['fecha_ultimo_pago', 'proximo_vencimiento', 'meses_pagados', 'notas'];

  function campoPresente(input, campo) {
    return !!input && Object.prototype.hasOwnProperty.call(input, campo) && input[campo] !== undefined && input[campo] !== null;
  }

  function fusionarCliente(actual, cambios) {
    var base = Object.assign({}, actual || {});
    var origen = cambios || {};
    Object.keys(origen).forEach(function (campo) {
      if (!campoPresente(origen, campo)) return;
      base[campo] = origen[campo];
    });
    CAMPOS_PRESERVAR.forEach(function (campo) {
      if (!campoPresente(origen, campo) && actual && Object.prototype.hasOwnProperty.call(actual, campo)) {
        base[campo] = actual[campo];
      }
    });
    return base;
  }

  function textoSeguro(value) {
    var crudo = String(value == null ? '' : value);
    var texto = crudo.replace(/^[\t\r\n]+/, '').trim();
    if (/^[=+\-@]/.test(texto) || /^[\t\r\n]/.test(crudo)) return "'" + texto;
    return texto;
  }

  function formularioSucio(campos) {
    var lista = campos || [];
    var i;
    for (i = 0; i < lista.length; i++) {
      var el = lista[i] || {};
      var tipo = String(el.type || '').toLowerCase();
      if (tipo === 'hidden' || tipo === 'button' || tipo === 'submit' || tipo === 'reset') continue;
      if (tipo === 'checkbox' || tipo === 'radio') {
        if (!!el.checked !== !!el.defaultChecked) return true;
      } else if (String(el.value == null ? '' : el.value) !== String(el.defaultValue == null ? '' : el.defaultValue)) {
        return true;
      }
    }
    return false;
  }

  function textoDias(estado) {
    if (estado && estado.clave === 'exento') return 'No se cobra';
    if (!estado || estado.dias == null) return 'Sin fecha de vencimiento';
    if (estado.dias < 0) {
      var atraso = Math.abs(estado.dias);
      return atraso === 1 ? 'Venció ayer' : 'Venció hace ' + atraso + ' días';
    }
    if (estado.dias === 0) return 'Vence hoy';
    if (estado.dias === 1) return 'Vence mañana';
    return 'Vence en ' + estado.dias + ' días';
  }

  return {
    PRECIO_EQUIPO: PRECIO_EQUIPO,
    DESCUENTO_PAR: DESCUENTO_PAR,
    DIA_CORTE: DIA_CORTE,
    DIAS_POR_VENCER: DIAS_POR_VENCER,
    TIPOS: TIPOS,
    esPromo: esPromo,
    esExento: esExento,
    precioMensual: precioMensual,
    desgloseMensual: desgloseMensual,
    parseFecha: parseFecha,
    formatISO: formatISO,
    inicioDeDia: inicioDeDia,
    cubreHasta: cubreHasta,
    estadoCliente: estadoCliente,
    estadoDeCliente: estadoDeCliente,
    normalizarCelular: normalizarCelular,
    normalizarMac: normalizarMac,
    buscarMacDuplicada: buscarMacDuplicada,
    fechaLarga: fechaLarga,
    fechaCorta: fechaCorta,
    formatPesos: formatPesos,
    mensajeWhatsApp: mensajeWhatsApp,
    enlaceWhatsApp: enlaceWhatsApp,
    equiposDeCliente: equiposDeCliente,
    mensualidadCliente: mensualidadCliente,
    porCobrarEsteMes: porCobrarEsteMes,
    resumen: resumen,
    clonarData: clonarData,
    validarCliente: validarCliente,
    validarDispositivo: validarDispositivo,
    aplicarPago: aplicarPago,
    fusionarCliente: fusionarCliente,
    formularioSucio: formularioSucio,
    textoSeguro: textoSeguro,
    CAMPOS_PRESERVAR: CAMPOS_PRESERVAR,
    textoDias: textoDias
  };
});
