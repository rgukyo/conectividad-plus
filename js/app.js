/* Pantalla de Conectividad Plus. Sin dirección del script, usa datos ficticios. */
(function () {
  'use strict';

  var K_SETTINGS = 'cp.settings.v1';
  var K_CACHE = 'cp.cache.v1';
  var K_DEMO = 'cp.demo.v1';
  var K_COLA = 'cp.cola.v1';
  var K_RECORDATORIOS = 'cp.recordatorios.v1';
  var VERSION = '11';

  var state = {
    settings: { url: '', clave: '', nombre: '' },
    data: { clientes: [], dispositivos: [], pagos: [] },
    modo: 'demo',
    soloLectura: false,
    aviso: '',
    cacheEn: '',
    q: '',
    area: '',
    vistaArchivo: 'activos',
    scriptViejo: false,
    qEquipos: '',
    periodoCobro: '',
    mensualidadAbierta: false,
    confirm: null,
    pagoHecho: null,
    montoManual: false,
    guardando: false,
    cargando: true,
    hayVersionNueva: false,
    swReg: null,
    pidioActualizar: false,
    recargaHecha: false,
    cola: [],
    plantillaAviso: 'mantenimiento',
    textoAviso: '',
    areaAviso: '',
    avisosHechos: {},
    usuario: { nombre: 'Roger García', rol: 'admin' },
    usuarios: []
  };

  var ultimaRuta = null;
  var toastTimer = 0;

  function arrancar() {
    state.settings = leerSettings();
    state.cola = leerCola();
    state.textoAviso = textoPlantilla('mantenimiento');
    window.addEventListener('hashchange', function () { render(); });
    window.addEventListener('online', function () { reintentarCola(); });
    document.body.addEventListener('click', onClick);
    document.body.addEventListener('submit', onSubmit);
    document.body.addEventListener('input', onInput);
    document.body.addEventListener('change', onChange);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.confirm) {
        state.confirm = null;
        render({ soloModal: true });
      }
    });
    cargar();
    vigilarServiceWorker();
  }

  function vigilarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('controllerchange', alCambiarControl);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        pedirRevision();
        if ((location.hash || '#/') === '#/' || location.hash === '#/avisos') render();
      }
    });
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function (reg) {
      state.swReg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) ofrecerActualizacion();
      reg.addEventListener('updatefound', function () {
        var worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) ofrecerActualizacion();
        });
      });
      pedirRevision();
    }).catch(function () {});
  }

  function pedirRevision() {
    if (state.swReg && state.swReg.update) state.swReg.update().catch(function () {});
  }

  function ofrecerActualizacion() {
    state.hayVersionNueva = true;
    pintarAvisos();
  }

  function aplicarActualizacion() {
    if (CP.formularioSucio(camposDeFormularios())) {
      state.confirm = {
        texto: 'Tienes cambios sin guardar. Si actualizas ahora, se pierden.',
        ok: 'Actualizar',
        run: function () { ejecutarActualizacion(); }
      };
      render({ soloModal: true });
      return;
    }
    ejecutarActualizacion();
  }

  function ejecutarActualizacion() {
    var reg = state.swReg;
    var waiting = reg && reg.waiting;
    state.pidioActualizar = true;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
    // Otra pestaña ya activó la versión nueva. Recargar sí toma esa versión.
    window.location.reload();
  }

  function alCambiarControl() {
    if (!state.pidioActualizar) {
      state.hayVersionNueva = false;
      pintarAvisos();
      return;
    }
    if (state.recargaHecha) return;
    state.recargaHecha = true;
    var ahora = Date.now();
    var previa = 0;
    try { previa = Number(sessionStorage.getItem('cp.sw-recarga') || 0); } catch (e) {}
    if (previa && ahora - previa < 10000) return;
    try { sessionStorage.setItem('cp.sw-recarga', String(ahora)); } catch (e) {}
    window.location.reload();
  }

  function camposDeFormularios() {
    var campos = [];
    document.querySelectorAll('form').forEach(function (form) {
      form.querySelectorAll('input, textarea, select').forEach(function (el) {
        campos.push({
          type: el.type || el.tagName,
          value: el.value,
          defaultValue: el.defaultValue,
          checked: el.checked,
          defaultChecked: el.defaultChecked
        });
      });
    });
    return campos;
  }

  function pintarAvisos() {
    var avisos = document.getElementById('avisos');
    if (avisos) avisos.innerHTML = htmlAvisos();
  }

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function lsSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function lsDel(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function leerSettings() {
    try {
      var parsed = JSON.parse(lsGet(K_SETTINGS) || '{}');
      return {
        url: String(parsed.url || '').trim(),
        clave: String(parsed.clave || ''),
        nombre: String(parsed.nombre || '').trim()
      };
    } catch (e) {
      return { url: '', clave: '', nombre: '' };
    }
  }

  function guardarSettings() {
    lsSet(K_SETTINGS, JSON.stringify(state.settings));
  }

  function leerCache() {
    try {
      var parsed = JSON.parse(lsGet(K_CACHE) || 'null');
      if (!parsed || !parsed.data) return null;
      return {
        data: normalizarRemoto(parsed.data, parsed.usuario && parsed.usuario.rol),
        cuando: String(parsed.cuando || ''),
        usuario: parsed.usuario || null,
        usuarios: parsed.usuarios || []
      };
    } catch (e) {
      return null;
    }
  }

  function guardarCache(data) {
    lsSet(K_CACHE, JSON.stringify({
      cuando: new Date().toISOString(),
      data: data,
      usuario: state.usuario,
      usuarios: state.usuarios
    }));
  }

  function leerDemo() {
    try {
      var parsed = JSON.parse(lsGet(K_DEMO) || 'null');
      if (parsed && parsed.clientes) return normalizarRemoto(parsed);
    } catch (e) {}
    return CPDemo.datosDemo(new Date());
  }

  function guardarDemo() {
    if (!lsSet(K_DEMO, JSON.stringify(state.data))) toast('No se pudo guardar en este teléfono.');
  }

  function normalizarRemoto(data, rol) {
    data = data || {};
    function fecha(value) {
      if (!value) return '';
      return CP.formatISO(CP.parseFecha(value)) || '';
    }
    return {
      clientes: (data.clientes || []).map(function (c) {
        return {
          id: String(c.id || '').trim(),
          nombre: String(c.nombre || '').trim(),
          celular: String(c.celular || '').trim(),
          area: String(c.area || '').trim(),
          promo: CP.esPromo(c.promo) ? 'SI' : 'NO',
          exento: CP.esPromo(c.exento) ? 'SI' : 'NO',
          archivado: CP.esArchivado(c) ? 'SI' : 'NO',
          reactivacion: (function () {
            var n = Number(c.reactivacion);
            if (!isFinite(n) || n < 0) return 0;
            return Math.round(n * 100) / 100;
          })(),
          fecha_ultimo_pago: fecha(c.fecha_ultimo_pago),
          proximo_vencimiento: fecha(c.proximo_vencimiento),
          meses_pagados: c.meses_pagados === '' || c.meses_pagados == null ? 0 : Number(c.meses_pagados) || 0,
          notas: String(c.notas || '').trim()
        };
      }).filter(function (c) { return c.id; }),
      dispositivos: (data.dispositivos || []).map(function (d) {
        var mac = CP.normalizarMac(d.mac);
        return {
          id: String(d.id || '').trim(),
          cliente_id: String(d.cliente_id || '').trim(),
          tipo: String(d.tipo || '').trim(),
          modelo: String(d.modelo || '').trim(),
          mac: mac.ok ? mac.mac : String(d.mac || '').trim(),
          notas: String(d.notas || '').trim()
        };
      }).filter(function (d) { return d.id; }),
      pagos: (data.pagos || []).map(function (p) {
        return {
          id: String(p.id || '').trim(),
          cliente_id: String(p.cliente_id || '').trim(),
          fecha: fecha(p.fecha),
          monto: (function () {
            if (rol === 'operador' || p.monto === '' || p.monto == null) return null;
            var n = Number(p.monto);
            return isFinite(n) ? n : null;
          })(),
          meses: Number(p.meses) || 0,
          cubre_hasta: fecha(p.cubre_hasta),
          registrado_por: String(p.registrado_por || '').trim()
        };
      }).filter(function (p) { return p.id; })
    };
  }

  function vacio() {
    return { clientes: [], dispositivos: [], pagos: [] };
  }

  function api(action, extra) {
    var url = state.settings.url;
    if (!url) return Promise.reject(new Error('Falta la dirección del script.'));
    var body = Object.assign({ action: action }, extra || {}, { clave: state.settings.clave });
    return fetchConTiempo(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }, 25000).then(function (res) {
      return res.text();
    }).then(function (text) {
      var limpio = String(text || '').trim();
      if (!limpio || limpio.charAt(0) === '<') {
        throw new Error('El script no respondió JSON. Revisa que esté implementado como aplicación web con acceso Cualquier persona.');
      }
      var json;
      try { json = JSON.parse(limpio); } catch (e) {
        throw new Error('Respuesta inesperada del script.');
      }
      if (!json.ok) throw new Error(json.error || 'Error del script');
      return json.data;
    });
  }

  function fetchConTiempo(url, options, ms) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = 0;
    if (ctrl) {
      options = Object.assign({}, options, { signal: ctrl.signal });
      timer = setTimeout(function () { ctrl.abort(); }, ms);
    }
    return fetch(url, options).then(function (res) {
      clearTimeout(timer);
      return res;
    }, function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') throw new Error('Tiempo de espera agotado');
      throw err;
    });
  }

  function esFalloDeRed(err) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    var nombre = err && err.name;
    var msg = String(err && err.message || err || '');
    return nombre === 'TypeError' || nombre === 'AbortError' || /failed to fetch|network|load failed|tiempo de espera/i.test(msg);
  }

  function cargar() {
    state.cargando = true;
    if (state.settings.url) {
      state.modo = 'cargando';
      render();
    }
    if (!state.settings.url) {
      state.modo = 'demo';
      state.soloLectura = false;
      state.aviso = '';
      state.scriptViejo = false;
      state.usuario = { nombre: CP.NOMBRE_ADMIN, rol: 'admin' };
      state.usuarios = [];
      state.data = leerDemo();
      state.cargando = false;
      render();
      return Promise.resolve();
    }
    return api('list').then(function (data) {
      state.scriptViejo = !CP.respuestaTraeArchivado(data);
      aplicarUsuario(data);
      state.data = normalizarRemoto(data, state.usuario.rol);
      state.modo = 'online';
      state.soloLectura = false;
      state.aviso = '';
      guardarCache(state.data);
    }).catch(function (err) {
      var cache = leerCache();
      if (esFalloDeRed(err) && cache) {
        state.data = cache.data;
        if (cache.usuario && cache.usuario.rol) state.usuario = cache.usuario;
        state.usuarios = cache.usuarios || [];
        state.modo = 'offline';
        state.soloLectura = true;
        state.cacheEn = cache.cuando;
        state.aviso = navigator.onLine === false
          ? 'Sin conexión. Puedes consultar la copia guardada, pero no anotar.'
          : 'No se pudo conectar con el script. Revisa la dirección, la clave y que el acceso sea Cualquier persona. Puedes consultar la última copia, sin guardar.';
      } else {
        state.modo = 'error';
        state.soloLectura = true;
        state.data = vacio();
        state.aviso = err && err.message ? err.message : 'No se pudo cargar.';
      }
    }).then(function () {
      state.cargando = false;
      render();
    });
  }

  function rutaActual() {
    var raw = (location.hash || '#/').replace(/^#/, '');
    var parts = raw.split('/').filter(Boolean).map(function (parte) {
      try { return decodeURIComponent(parte); } catch (e) { return parte; }
    });
    return { parts: parts };
  }

  function ir(ruta) {
    var destino = '#' + ruta;
    if (location.hash === destino) render();
    else location.hash = ruta;
  }

  function tabActual() {
    var a = rutaActual().parts[0] || 'inicio';
    if (a === 'clientes' || a === 'vencidos' || a === 'equipos' || a === 'ajustes' || a === 'cobros' || a === 'avisos') return a;
    return 'inicio';
  }

  function render(opciones) {
    opciones = opciones || {};
    var firma = location.hash || '#/';
    if (firma !== ultimaRuta) {
      state.mensualidadAbierta = false;
      if (/\/pago$/.test(firma)) state.montoManual = false;
      ultimaRuta = firma;
    }
    if (!/\/pago$/.test(firma)) state.pagoHecho = null;
    actualizarChrome();
    document.getElementById('avisos').innerHTML = htmlAvisos();
    if (opciones.soloLista) {
      var lista = document.getElementById('lista');
      if (lista) lista.innerHTML = htmlListaClientes();
      var listaEq = document.getElementById('lista-equipos');
      if (listaEq) listaEq.innerHTML = htmlListaEquipos();
    } else if (!opciones.soloModal) {
      var foco = document.activeElement;
      var focoId = foco && foco.id;
      var sel = foco && typeof foco.selectionStart === 'number' ? foco.selectionStart : null;
      document.getElementById('vista').innerHTML = htmlVista();
      if (focoId) {
        var el = document.getElementById(focoId);
        if (el) {
          el.focus();
          if (sel != null && el.setSelectionRange) {
            try { el.setSelectionRange(sel, sel); } catch (e) {}
          }
        }
      }
    }
    document.getElementById('modal').innerHTML = state.confirm ? htmlConfirm() : '';
    if (state.confirm) {
      var boton = document.getElementById('confirmar-btn');
      if (boton) boton.focus();
    }
  }

  function actualizarChrome() {
    var modo = document.getElementById('modo');
    modo.className = 'modo ' + (state.modo === 'online' ? 'online' : state.modo === 'demo' ? '' : state.modo);
    modo.textContent = state.modo === 'online' ? 'En línea' : state.modo === 'offline' ? 'Sin conexión' : state.modo === 'error' ? 'Error' : state.modo === 'cargando' ? '…' : 'Demo';
    document.querySelectorAll('.tabbar a').forEach(function (a) {
      if (a.getAttribute('data-tab') === tabActual()) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var resumen = CP.resumen(state.data, new Date());
    var libres = state.data.dispositivos.filter(function (d) { return !d.cliente_id; }).length;
    ponerBadge('badge-vencidos', resumen.vencidos);
    ponerBadge('badge-equipos', libres);
  }

  function ponerBadge(id, n) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = !n;
    el.textContent = String(n);
  }

  function htmlAvisos() {
    var partes = [];
    if (state.hayVersionNueva) {
      partes.push('<p class="aviso actualizacion"><button type="button" class="btn primary block" data-action="aplicar-version">Hay una versión nueva — Actualizar</button></p>');
    }
    if (state.cola.length) {
      var nCola = state.cola.length;
      partes.push('<div class="aviso warn"><p>' + CP.MENSAJE_SIN_INTERNET + '. ' + nCola +
        (nCola === 1 ? ' pendiente.' : ' pendientes.') + '</p>' +
        '<button type="button" class="btn primary block" data-action="reintentar-cola">Reintentar pendientes</button></div>');
    }
    if (state.modo === 'demo') {
      partes.push('<p class="aviso">Modo demostración con datos ficticios. Nada de esto se guarda en la hoja.</p>');
    } else if (state.scriptViejo) {
      partes.push('<p class="aviso warn">Archivar no se está guardando en la hoja. El script publicado es anterior y no tiene la columna archivado. Publica una versión nueva sin cambiar el enlace /exec.</p>');
    }
    if (state.modo !== 'demo' && state.aviso) {
      var clase = state.modo === 'error' ? 'aviso bad' : 'aviso warn';
      partes.push('<p class="' + clase + '">' + esc(state.aviso) + '</p>');
    }
    return partes.join('');
  }

  function htmlVista() {
    if (state.cargando && state.settings.url && !state.data.clientes.length) {
      return '<p class="vacio">Cargando…</p>';
    }
    var parts = rutaActual().parts;
    var a = parts[0] || 'inicio';
    if (a === 'inicio') return htmlInicio();
    if (a === 'clientes' && parts[1] === 'nuevo') return htmlFormCliente(null);
    if (a === 'clientes' && parts[1] && parts[2] === 'editar') {
      var clienteEdit = buscarCliente(parts[1]);
      if (!clienteEdit) return htmlNoEsta('Ese cliente no está en la lista.');
      return htmlFormCliente(clienteEdit);
    }
    if (a === 'clientes' && parts[1] && parts[2] === 'pago') return htmlPago(buscarCliente(parts[1]));
    if (a === 'clientes' && parts[1] && parts[2] === 'equipo' && parts[3] === 'nuevo') {
      if (!buscarCliente(parts[1])) return htmlNoEsta('Ese cliente no está en la lista.');
      return htmlFormEquipo(null, parts[1]);
    }
    if (a === 'clientes' && parts[1] && parts[2] === 'equipo' && parts[3]) {
      var equipoCliente = buscarEquipo(parts[3]);
      if (!equipoCliente) return htmlNoEsta('Ese equipo no está en la lista.');
      return htmlFormEquipo(equipoCliente, parts[1]);
    }
    if (a === 'clientes' && parts[1]) return htmlDetalle(buscarCliente(parts[1]));
    if (a === 'clientes') return htmlClientes();
    if (a === 'vencidos') return htmlVencidos();
    if (a === 'equipos' && parts[1] === 'nuevo') return htmlFormEquipo(null, '');
    if (a === 'equipos' && parts[1]) {
      var equipoLibre = buscarEquipo(parts[1]);
      if (!equipoLibre) return htmlNoEsta('Ese equipo no está en la lista.');
      return htmlFormEquipo(equipoLibre, '');
    }
    if (a === 'equipos') return htmlEquipos();
    if (a === 'cobros') return htmlCobros();
    if (a === 'avisos') return htmlModuloAvisos();
    if (a === 'ajustes') return htmlAjustes();
    return htmlInicio();
  }

  function htmlInicio() {
    var hoy = new Date();
    var vencidos = state.data.clientes.filter(function (c) {
      return !CP.esArchivado(c) && CP.estadoDeCliente(c, hoy).clave === 'vencido';
    });
    var pronto = state.data.clientes.filter(function (c) {
      return !CP.esArchivado(c) && CP.estadoDeCliente(c, hoy).clave === 'por_vencer';
    });
    var sinFecha = state.data.clientes.filter(function (c) {
      return !CP.esArchivado(c) && CP.estadoDeCliente(c, hoy).clave === 'sin_fecha';
    });
    vencidos.sort(function (a, b) {
      return CP.estadoDeCliente(a, hoy).dias - CP.estadoDeCliente(b, hoy).dias;
    });
    return '<picture>' +
      '<source srcset="img/logo.webp" type="image/webp">' +
      '<img class="logo-inicio" src="img/logo.jpg" alt="Conectividad Plus. Velocidad y conexión sin límites." width="800" height="722">' +
      '</picture>' +
      '<h1>Hoy</h1>' +
      htmlResumen(true) +
      '<p><a class="btn primary block" href="#/clientes/nuevo">Nuevo cliente</a></p>' +
      (esAdmin() ? '<p><a class="btn ghost block" href="#/cobros">Consultar cobros</a></p>' : '') +
      '<p><a class="btn ghost block" href="#/avisos">Avisos</a></p>' +
      htmlJornada(hoy) +
      (state.settings.url ? '<p><button type="button" class="btn ghost block" data-action="actualizar">Actualizar</button></p>' : '') +
      htmlRecordatorios(hoy) +
      htmlGrupo('Vencidos', ordenarPorNombre(vencidos), 'Nadie está vencido.') +
      (pronto.length ? htmlGrupo('Por vencer', ordenarPorNombre(pronto)) : '') +
      (sinFecha.length ? htmlGrupo('Sin fecha de pago', ordenarPorNombre(sinFecha)) : '');
  }

  function htmlClientes() {
    return '<h1>Clientes</h1>' +
      htmlResumen(false) +
      '<label class="campo">Buscar<input id="buscar" type="search" placeholder="Nombre, celular o área" value="' + esc(state.q) + '" autocomplete="off"></label>' +
      htmlFiltroArchivo() +
      htmlFiltroAreas() +
      '<p class="ayuda">' + (state.vistaArchivo === 'archivados'
        ? 'Aquí se restaura a quien se archivó. El registro, los pagos, los equipos y las notas siguen guardados.'
        : 'Por vencer: faltan 5 días o menos. Vencido: la fecha ya pasó.') + '</p>' +
      '<p><a class="btn primary block" href="#/clientes/nuevo">Nuevo cliente</a></p>' +
      '<div id="lista">' + htmlListaClientes() + '</div>';
  }

  function htmlListaClientes() {
    var lista = clientesFiltrados();
    var archivados = state.vistaArchivo === 'archivados';
    if (!lista.length) {
      return '<p class="vacio">' + (archivados ? 'Nadie está archivado.' : 'Ningún cliente coincide.') + '</p>';
    }
    if (archivados) {
      return '<ul class="lista">' + lista.map(function (c) {
        return '<li class="card">' + htmlClienteLink(c) +
          '<button type="button" class="btn primary block" data-action="reactivar-cliente" data-id="' + esc(c.id) + '">Reactivar</button></li>';
      }).join('') + '</ul>';
    }
    return '<ul class="lista">' + lista.map(function (c) {
      return '<li>' + htmlClienteLink(c) + '</li>';
    }).join('') + '</ul>';
  }

  function htmlVencidos() {
    var hoy = new Date();
    var lista = state.data.clientes.filter(function (c) {
      return !CP.esArchivado(c) && CP.estadoDeCliente(c, hoy).clave === 'vencido';
    }).sort(function (a, b) {
      return CP.estadoDeCliente(a, hoy).dias - CP.estadoDeCliente(b, hoy).dias;
    });
    var cuerpo = lista.length ? '<ul class="lista">' + lista.map(function (c) {
      var estado = CP.estadoDeCliente(c, hoy);
      return '<li class="card"><strong>' + esc(c.nombre) + '</strong>' +
        '<p class="muted">' + esc(c.area || 'Sin área') + ' · ' + esc(CP.textoDias(estado)) + '</p>' +
        '<a class="btn primary block" href="#/clientes/' + seg(c.id) + '/pago">Registrar pago</a></li>';
    }).join('') + '</ul>' : '<p class="vacio">Nadie está vencido.</p>';
    return '<h1>Vencidos</h1>' + htmlResumen(false) + cuerpo;
  }

  function htmlEquipos() {
    var n = equiposLibres().length;
    return '<h1>Sin asignar</h1>' +
      '<p class="ayuda">' + n + (n === 1 ? ' equipo no tiene cliente.' : ' equipos no tienen cliente.') + ' Elige a quién corresponde: un toque en la lista.</p>' +
      '<label class="campo">Buscar<input id="buscar-equipos" type="search" placeholder="Modelo o MAC" value="' + esc(state.qEquipos) + '" autocomplete="off"></label>' +
      '<p><a class="btn primary block" href="#/equipos/nuevo">Agregar equipo</a></p>' +
      '<div id="lista-equipos">' + htmlListaEquipos() + '</div>';
  }

  function htmlListaEquipos() {
    var q = fold(state.qEquipos);
    var lista = equiposLibres().filter(function (d) {
      if (!q) return true;
      return fold(d.modelo + ' ' + d.mac + ' ' + d.tipo + ' ' + d.notas).indexOf(q) >= 0;
    });
    if (!lista.length) return '<p class="vacio">No hay equipos sin asignar.</p>';
    return lista.map(function (eq) {
      return '<article class="card"><h3>' + esc(eq.tipo) + '</h3>' + htmlModelo(eq) +
        '<p class="mac num">' + esc(eq.mac) + '</p>' +
        htmlNotaEquipo(eq) +
        '<label class="campo">Asignar a<select data-action="asignar" data-id="' + esc(eq.id) + '"' + (state.soloLectura ? ' disabled' : '') + '>' +
        '<option value="">Elegir cliente…</option>' +
        ordenarPorNombre(state.data.clientes.filter(function (c) { return !CP.esArchivado(c); })).map(function (c) {
          return '<option value="' + esc(c.id) + '">' + esc(c.nombre) + '</option>';
        }).join('') +
        '</select></label>' +
        '<div class="fila-botones">' +
        '<a class="btn ghost" href="#/equipos/' + seg(eq.id) + '">Editar</a>' +
        (esAdmin() ? '<button type="button" class="btn danger" data-action="borrar-equipo" data-id="' + esc(eq.id) + '">Eliminar</button>' : '') +
        '</div></article>';
    }).join('');
  }

  function htmlDetalle(cliente) {
    if (!cliente) return htmlNoEsta('Ese cliente no está en la lista.');
    var estado = CP.estadoDeCliente(cliente, new Date());
    var equipos = CP.equiposDeCliente(state.data.dispositivos, cliente.id);
    var cel = CP.normalizarCelular(cliente.celular);
    return htmlVolver('#/clientes', 'Clientes') +
      '<h1>' + esc(cliente.nombre) + '</h1>' +
      '<p>' + htmlChip(estado) + ' <span class="muted">' + esc(CP.textoDias(estado)) + '</span></p>' +
      '<p class="muted">' + esc(cliente.area || 'Sin área') +
      (cel.ok ? ' · <a href="tel:+52' + cel.digitos + '">' + esc(cel.digitos) + '</a>' : '') +
      (cliente.promo === 'SI' ? ' · Promo' : '') + '</p>' +
      '<p>Próximo vencimiento<br><strong>' + esc(cliente.proximo_vencimiento ? CP.fechaLarga(cliente.proximo_vencimiento) : 'Sin fecha') + '</strong></p>' +
      htmlMensualidad(cliente) +
      htmlLeyendaReactivacion(cliente) +
      '<a class="btn primary block" href="#/clientes/' + seg(cliente.id) + '/pago">Registrar pago</a>' +
      '<a class="btn ghost block" href="#/clientes/' + seg(cliente.id) + '/editar">Editar cliente</a>' +
      (esAdmin() ? (CP.esArchivado(cliente)
        ? '<button type="button" class="btn primary block" data-action="reactivar-cliente" data-id="' + esc(cliente.id) + '">Reactivar</button>'
        : '<p class="ayuda">Archivar lo quita de la lista activa y del pendiente. No borra su registro.</p>' +
          '<button type="button" class="btn ghost block" data-action="archivar-cliente" data-id="' + esc(cliente.id) + '">Archivar cliente</button>') : '') +
      (cliente.notas ? '<p class="notas">' + esc(cliente.notas) + '</p>' : '') +
      '<h2>Equipos</h2>' +
      (equipos.length ? equipos.map(function (eq) {
        return htmlEquipoCard(eq, '#/clientes/' + seg(cliente.id) + '/equipo/' + seg(eq.id));
      }).join('') : '<p class="vacio">Todavía no tiene equipos.</p>') +
      '<a class="btn ghost block" href="#/clientes/' + seg(cliente.id) + '/equipo/nuevo">Agregar equipo</a>' +
      '<h2>Pagos</h2>' + htmlHistorial(cliente.id);
  }

  function htmlFormCliente(cliente) {
    var nuevo = !cliente;
    if (!nuevo && !cliente.id) return htmlNoEsta('Ese cliente no está en la lista.');
    cliente = cliente || {
      id: '', nombre: '', celular: '', area: '', promo: 'NO', exento: 'NO',
      fecha_ultimo_pago: '', proximo_vencimiento: '', meses_pagados: 0, notas: ''
    };
    var areas = areasUnicas().map(function (area) {
      return '<option value="' + esc(area) + '">';
    }).join('');
    return htmlVolver(nuevo ? '#/clientes' : '#/clientes/' + seg(cliente.id), 'Volver') +
      '<h1>' + (nuevo ? 'Nuevo cliente' : 'Editar cliente') + '</h1>' +
      '<form id="form-cliente">' +
      '<input type="hidden" name="registro_id" value="' + esc(cliente.id) + '">' +
      '<label class="campo">Nombre<input name="nombre" required maxlength="120" value="' + esc(cliente.nombre) + '"></label>' +
      '<label class="campo">Celular<input name="celular" type="tel" inputmode="tel" required maxlength="20" placeholder="10 dígitos" value="' + esc(cliente.celular) + '"></label>' +
      '<label class="campo">Área<input name="area" maxlength="120" list="lista-areas" placeholder="Colonia o zona" value="' + esc(cliente.area) + '"></label>' +
      '<datalist id="lista-areas">' + areas + '</datalist>' +
      '<label class="check"><input type="checkbox" name="promo"' + (cliente.promo === 'SI' ? ' checked' : '') + '><span>Promo activa</span></label>' +
      '<p class="ayuda">Con promo, cada dos equipos restan $10. 2 equipos quedan en $50, 3 en $80 y 4 en $100.</p>' +
      '<label class="check"><input type="checkbox" name="exento"' + (cliente.exento === 'SI' ? ' checked' : '') + '><span>Exento de pago</span></label>' +
      '<p class="ayuda">Exento de pago deja la mensualidad en $0. No sale como vencido ni en el pendiente estimado, y el pago no abre WhatsApp.</p>' +
      '<label class="campo">Notas<textarea name="notas" maxlength="2000">' + esc(cliente.notas) + '</textarea></label>' +
      '<details><summary>Fechas, si ya las traías anotadas</summary>' +
      '<label class="campo">Último pago<input name="fecha_ultimo_pago" type="date" value="' + esc(cliente.fecha_ultimo_pago) + '"></label>' +
      '<label class="campo">Próximo vencimiento<input name="proximo_vencimiento" type="date" value="' + esc(cliente.proximo_vencimiento) + '"></label>' +
      '<label class="campo">Meses pagados<input name="meses_pagados" inputmode="numeric" value="' + esc(cliente.meses_pagados) + '"></label>' +
      '</details>' +
      '<button class="btn primary block" type="submit"' + (state.soloLectura ? ' disabled' : '') + '>' + (state.guardando ? 'Guardando…' : 'Guardar') + '</button>' +
      '</form>';
  }

  function htmlFormEquipo(equipo, clienteForzado) {
    var nuevo = !equipo;
    if (!equipo) {
      equipo = { id: '', cliente_id: clienteForzado || '', tipo: 'Celular', modelo: '', mac: '', notas: '' };
    }
    var dueno = equipo.cliente_id ? buscarCliente(equipo.cliente_id) : null;
    var volver = dueno ? '#/clientes/' + seg(dueno.id) : '#/equipos';
    return htmlVolver(volver, dueno ? dueno.nombre : 'Sin asignar') +
      '<h1>' + (nuevo ? 'Nuevo equipo' : 'Editar equipo') + '</h1>' +
      (dueno ? '<p class="muted">De ' + esc(dueno.nombre) + '</p>' : '<p class="muted">Quedará sin asignar hasta que elijas cliente.</p>') +
      '<form id="form-equipo">' +
      '<input type="hidden" name="registro_id" value="' + esc(equipo.id) + '">' +
      '<input type="hidden" name="cliente_id" value="' + esc(equipo.cliente_id) + '">' +
      '<div class="campo"><span>Tipo</span>' + htmlTipos(equipo.tipo) + '</div>' +
      '<label class="campo">Modelo, si lo sabes<input name="modelo" maxlength="120" value="' + esc(equipo.modelo) + '" placeholder="Opcional. Samsung A14"></label>' +
      '<label class="campo">MAC<input name="mac" required autocapitalize="characters" placeholder="AA-BB-CC-DD-EE-FF" value="' + esc(equipo.mac) + '"></label>' +
      '<p class="ayuda" id="mac-ayuda">Se guarda como AA-BB-CC-DD-EE-FF.</p>' +
      '<label class="campo">Notas<textarea name="notas" maxlength="2000">' + esc(equipo.notas) + '</textarea></label>' +
      '<button class="btn primary block" type="submit"' + (state.soloLectura ? ' disabled' : '') + '>' + (state.guardando ? 'Guardando…' : 'Guardar') + '</button>' +
      '</form>';
  }

  function htmlPago(cliente) {
    if (!cliente) return htmlNoEsta('Ese cliente no está en la lista.');
    if (state.pagoHecho) return htmlPagoListo(cliente, state.pagoHecho);
    var mensual = CP.mensualidadCliente(cliente, state.data.dispositivos);
    var cargo = CP.cargoReactivacion(cliente);
    var exento = CP.esExento(cliente);
    var fecha = hoyISO();
    var monto = mensual + cargo;
    return htmlVolver('#/clientes/' + seg(cliente.id), cliente.nombre) +
      '<h1>Registrar pago</h1>' +
      htmlDesglose(cliente) +
      htmlLeyendaReactivacion(cliente) +
      (!exento && mensual === 0 ? '<p class="aviso warn">Este cliente no tiene equipos. La mensualidad sale en $0.</p>' : '') +
      '<form id="form-pago">' +
      '<input type="hidden" name="cliente_id" value="' + esc(cliente.id) + '">' +
      '<label class="campo">Fecha<input name="fecha" type="date" required value="' + fecha + '"></label>' +
      '<div class="campo"><span>Meses</span><div class="stepper">' +
      '<button type="button" data-action="meses-menos" aria-label="Un mes menos">−</button>' +
      '<input name="meses" inputmode="numeric" value="1" aria-label="Meses">' +
      '<button type="button" data-action="meses-mas" aria-label="Un mes más">+</button>' +
      '</div></div>' +
      '<label class="campo">Monto recibido<input name="monto" inputmode="decimal" value="' + esc(monto) + '"></label>' +
      '<label class="campo">Tu nombre<input name="registrado_por" maxlength="80" required value="' + esc(state.settings.nombre) + '" placeholder="Quién recibe el pago"></label>' +
      '<div id="vista-pago" class="preview">' + htmlPreviewPago(cliente, fecha, 1, monto) + '</div>' +
      '<button class="btn primary block" type="submit"' + (state.soloLectura ? ' disabled' : '') + '>' + (state.guardando ? 'Guardando…' : (exento ? 'Guardar pago' : 'Guardar pago y abrir WhatsApp')) + '</button>' +
      '</form>';
  }

  function htmlPagoListo(cliente, hecho) {
    var aviso = '';
    if (CP.esExento(cliente)) {
      aviso = '<p class="ayuda">Exento de pago: no se manda recordatorio por WhatsApp.</p>';
    } else if (hecho.url) {
      aviso = '<a class="btn primary block" href="' + esc(hecho.url) + '" target="_blank" rel="noopener">Abrir WhatsApp</a>';
    } else {
      aviso = '<p class="aviso warn">El celular no tiene 10 dígitos, así que no se armó el enlace.</p>';
    }
    return htmlVolver('#/clientes/' + seg(cliente.id), cliente.nombre) +
      '<h1>Pago guardado</h1>' +
      '<p>Cubierto hasta el <strong>' + esc(CP.fechaLarga(hecho.pago.cubre_hasta)) + '</strong>.</p>' +
      (hecho.texto ? '<div class="mensaje-box">' + esc(hecho.texto) + '</div>' : '') +
      aviso +
      '<a class="btn ghost block" href="#/clientes/' + seg(cliente.id) + '">Volver al cliente</a>';
  }

  function htmlPreviewPago(cliente, fecha, meses, monto) {
    if (monto === '' || monto == null) {
      monto = CP.mensualidadCliente(cliente, state.data.dispositivos) * (parseInt(meses, 10) || 1);
    }
    var cubre = CP.cubreHasta(cliente.proximo_vencimiento, fecha, meses);
    var hasta = '<p class="total"><span>Queda cubierto hasta</span><strong>' + esc(cubre ? CP.fechaLarga(cubre) : '—') + '</strong></p>';
    if (CP.esExento(cliente)) {
      return hasta + '<p class="ayuda">Exento de pago: se guarda el pago y no se abre WhatsApp.</p>';
    }
    var texto = cubre ? CP.mensajeWhatsApp(cliente.nombre, monto, cubre) : 'Revisa la fecha del pago.';
    return hasta + '<div class="mensaje-box">' + esc(texto) + '</div>';
  }

  function htmlAjustes() {
    var url = state.settings.url;
    var avisoDev = url.indexOf('/dev') >= 0
      ? '<p class="aviso warn">Esa dirección es de prueba (/dev) y suele pedir login. Usa la que termina en /exec.</p>'
      : '';
    return '<h1>Ajustes</h1>' +
      '<p class="ayuda" id="version-app">Versión ' + esc(VERSION) + '</p>' +
      '<p class="ayuda">Sin dirección, la app se queda en demostración y no toca la hoja.</p>' +
      avisoDev +
      '<form id="form-ajustes">' +
      '<label class="campo">Dirección del script<input name="url" type="url" inputmode="url" placeholder="https://script.google.com/macros/s/.../exec" autocomplete="off" value="' + esc(state.settings.url) + '"></label>' +
      '<div class="campo"><span>Clave</span><div class="clave-fila">' +
      '<input name="clave" type="password" autocomplete="off" value="' + esc(state.settings.clave) + '">' +
      '<button type="button" class="btn ghost" data-action="ver-clave">Ver</button></div></div>' +
      '<label class="campo">Tu nombre<input name="nombre" maxlength="80" autocomplete="name" placeholder="Así queda en cada pago" value="' + esc(state.settings.nombre) + '"></label>' +
      '<button class="btn primary block" type="submit">Guardar y conectar</button>' +
      '<button class="btn ghost block" type="button" data-action="probar">Probar conexión</button>' +
      '<button class="btn ghost block" type="button" data-action="modo-demo">Quitar conexión (demostración)</button>' +
      '<button class="btn ghost block" type="button" data-action="reset-demo">Restablecer datos de demostración</button>' +
      '</form>' +
      htmlUsuarios() +
      '<h2>En el teléfono</h2>' +
      '<p><a class="btn ghost block" href="#/avisos">Avisos</a></p>' +
      '<p class="ayuda">Chrome → menú → Instalar aplicación, o Agregar a pantalla principal. Sin señal se abre la última copia, solo para consultar.</p>' +
      (state.cacheEn ? '<p class="ayuda">Última copia en línea: ' + esc(state.cacheEn) + '</p>' : '');
  }

  function esAdmin() {
    return !state.usuario || state.usuario.rol !== 'operador';
  }

  function aplicarUsuario(data) {
    var u = data && data.usuario;
    if (!u || (u.rol !== 'admin' && u.rol !== 'operador')) {
      state.usuario = { nombre: CP.NOMBRE_ADMIN, rol: 'admin' };
    } else {
      state.usuario = { nombre: String(u.nombre || CP.NOMBRE_ADMIN), rol: u.rol };
    }
    state.usuarios = (data && data.usuarios) || [];
  }

  function htmlJornada(hoy) {
    if (!esAdmin()) return '';
    var grupos = CP.jornadaAjena(state.data.pagos, state.data.clientes, hoy, state.usuario && state.usuario.nombre);
    if (!grupos.length) return '';
    return grupos.map(function (g) {
      return '<section class="card"><p><strong>Hoy ' + esc(g.nombre) + ' registró ' + g.n +
        (g.n === 1 ? ' pago' : ' pagos') + '</strong></p><p class="muted">' +
        esc(g.clientes.join(', ')) + '</p></section>';
    }).join('');
  }

  function htmlUsuarios() {
    if (!esAdmin() || state.modo === 'demo') return '';
    var filas = (state.usuarios || []).map(function (u) {
      return '<li class="item"><span class="item-main"><strong>' + esc(u.nombre) + '</strong><span class="muted">' +
        esc(u.rol || 'operador') + '</span></span><button type="button" class="btn ghost" data-action="quitar-usuario" data-nombre="' +
        esc(u.nombre) + '">Quitar</button></li>';
    }).join('');
    return '<h2>Usuarios</h2>' +
      '<p class="ayuda">La clave se guarda cifrada. Aquí no se vuelve a mostrar.</p>' +
      '<form id="form-usuario">' +
      '<label class="campo">Nombre<input name="nombre" maxlength="120" placeholder="Jorge Daniel Colli Cocom" required></label>' +
      '<p class="ayuda">Rol: operador</p>' +
      '<input type="hidden" name="rol" value="operador">' +
      '<div class="campo"><span>Clave</span><div class="clave-fila">' +
      '<input name="clave" type="password" autocomplete="off" minlength="8">' +
      '<button type="button" class="btn ghost" data-action="ver-clave-usuario">Ver</button></div></div>' +
      '<button class="btn primary block" type="submit">Guardar usuario</button>' +
      '</form>' +
      (filas ? '<ul class="lista">' + filas + '</ul>' : '<p class="vacio">Todavía no hay otros usuarios.</p>');
  }

  function htmlRecordatorios(hoy) {
    var lista = CP.recordatoriosHoy(state.data.clientes, hoy);
    if (!lista.length) return '';
    var marcas = leerRecordatorios(hoy);
    return '<h2>Recordatorios de hoy</h2><ul class="lista">' + lista.map(function (c) {
      var avisado = !!marcas[c.id];
      var texto = CP.mensajeRecordatorio(c.nombre);
      var url = CP.enlaceWhatsApp(c.celular, texto);
      var boton = avisado
        ? '<p class="muted">Avisado</p>'
        : (url
          ? '<a class="btn primary block" href="' + esc(url) + '" target="_blank" rel="noopener" data-action="marcar-recordatorio" data-id="' + esc(c.id) + '">Avisar por WhatsApp</a>'
          : '<p class="aviso warn">El celular no tiene 10 dígitos.</p>');
      return '<li class="card"><a class="nombre-ficha" href="#/clientes/' + seg(c.id) + '"><strong>' + esc(c.nombre) + '</strong></a>' +
        '<p class="muted">' + esc(c.area || 'Sin área') + '</p>' + boton + '</li>';
    }).join('') + '</ul>';
  }

  function htmlModuloAvisos() {
    var plantillas = CP.PLANTILLAS_AVISO.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === state.plantillaAviso ? ' selected' : '') + '>' + esc(p.nombre) + '</option>';
    }).join('');
    var zonas = areasDe(CP.destinatariosAviso(state.data.clientes, '')).map(function (area) {
      return '<option value="' + esc(area) + '"' + (area === state.areaAviso ? ' selected' : '') + '>' + esc(area) + '</option>';
    }).join('');
    var lista = CP.destinatariosAviso(state.data.clientes, state.areaAviso);
    var conteo = CP.conteoAvisos(lista, state.avisosHechos);
    var filas = lista.length ? lista.map(function (c) {
      var texto = CP.mensajeAviso(state.textoAviso, c.nombre);
      var url = CP.enlaceWhatsApp(c.celular, texto);
      var abierto = !!state.avisosHechos[c.id];
      var boton = abierto
        ? '<p class="muted">Abierto</p>'
        : (url
          ? '<a class="btn primary block" href="' + esc(url) + '" target="_blank" rel="noopener" data-action="marcar-aviso" data-id="' + esc(c.id) + '">Abrir WhatsApp</a>'
          : '<p class="aviso warn">El celular no tiene 10 dígitos.</p>');
      return '<li class="card"><strong>' + esc(c.nombre) + '</strong><p class="muted">' + esc(c.area || 'Sin área') + '</p>' + boton + '</li>';
    }).join('') : '<li><p class="vacio">No hay destinatarios activos.</p></li>';
    return htmlVolver('#/', 'Inicio') +
      '<h1>Avisos</h1>' +
      '<label class="campo">Plantilla<select id="plantilla-aviso">' + plantillas + '</select></label>' +
      '<label class="campo">Mensaje<textarea id="texto-aviso" maxlength="1000">' + esc(state.textoAviso) + '</textarea></label>' +
      '<p class="ayuda">Usa {nombre} y se cambia por cada cliente. No incluyas montos.</p>' +
      '<label class="campo">Destinatarios<select id="area-aviso"><option value="">Todos los activos</option>' + zonas + '</select></label>' +
      '<p class="ayuda">' + esc(conteo.texto) + '</p>' +
      '<p><button type="button" class="btn ghost block" data-action="copiar-numeros">Copiar números</button></p>' +
      '<ul class="lista">' + filas + '</ul>';
  }

  function htmlResumen(grande) {
    var r = CP.resumen(state.data, new Date());
    if (!grande) {
      return '<p class="resumen-mini"><strong class="num">' + r.clientes + '</strong> clientes · <strong class="num">' + r.vencidos + '</strong> vencidos</p>';
    }
    return '<section class="stats" aria-label="Resumen">' +
      '<article class="stat"><p class="stat-num num">' + r.clientes + '</p><p class="stat-label">Clientes</p></article>' +
      '<article class="stat' + (r.vencidos ? ' alerta' : '') + '"><p class="stat-num num">' + r.vencidos + '</p><p class="stat-label">Vencidos</p></article>' +
      '</section>';
  }

  function htmlCobros() {
    if (!esAdmin()) {
      return htmlVolver('#/', 'Inicio') +
        '<h1>Cobros</h1>' +
        '<p class="ayuda">El total cobrado solo lo ve quien administra.</p>';
    }
    var info = CP.informeCobros(state.data, state.periodoCobro, new Date());
    var opciones = info.periodos.map(function (clave) {
      return '<option value="' + esc(clave) + '"' + (clave === info.clave ? ' selected' : '') + '>' +
        esc(CP.etiquetaPeriodo(clave)) + '</option>';
    }).join('');
    var detalleCobrado = info.pagos
      ? 'Suma de ' + info.pagos + (info.pagos === 1 ? ' pago registrado' : ' pagos registrados') + ' en ' + info.etiqueta + '.'
      : 'No hay pagos registrados en ' + info.etiqueta + '. El total cobrado es $0.';
    var pendiente;
    if (info.pendiente) {
      pendiente = '<section class="desglose"><h2>Pendiente</h2>' +
        '<p class="ayuda">Estimación de lo que falta por cobrar este mes. No es dinero ya cobrado y no se suma al total de arriba.</p>' +
        '<p class="total"><span>Pendiente estimado</span><strong class="num">' + esc(dinero(info.pendiente.total)) + '</strong></p>' +
        '<p class="ayuda">' + info.pendiente.clientes + (info.pendiente.clientes === 1 ? ' cliente entra' : ' clientes entran') +
        ' en esa cuenta: vencen este mes, ya vencieron o no tienen fecha. Quien está exento no entra.</p></section>';
    } else {
      pendiente = '<section class="desglose"><h2>Pendiente</h2>' +
        '<p class="ayuda">El pendiente estimado solo se muestra en el mes en curso. En otros periodos no se reconstruye, porque habría que inventar deudas.</p></section>';
    }
    return htmlVolver('#/', 'Inicio') +
      '<h1>Cobros</h1>' +
      '<p class="ayuda">Se abre a propósito. El cobrado sale solo de pagos anotados. Las deudas y las mensualidades no cuentan como ingreso. Las dos cifras no se suman.</p>' +
      '<label class="campo">Periodo<select id="periodo-cobros">' + opciones + '</select></label>' +
      '<section class="desglose cobrado"><h2>Cobrado</h2>' +
      '<p class="total"><span>Total cobrado</span><strong class="num">' + esc(dinero(info.cobrado)) + '</strong></p>' +
      '<p class="ayuda">' + esc(detalleCobrado) + '</p></section>' +
      pendiente +
      htmlFaltantesCobro(info);
  }

  function htmlFaltantesCobro(info) {
    var partes = [];
    if (info.faltantes.length) {
      var items = info.faltantes.map(function (f) {
        var porque = f.motivo === 'fecha_sin_pago'
          ? 'La fecha de último pago no coincide con ningún pago registrado.'
          : 'Tiene fecha de pago o meses pagados, y no hay ningún pago registrado.';
        return '<li class="item"><span class="item-main"><strong>' + esc(f.nombre || 'Sin nombre') + '</strong>' +
          '<span class="muted">' + porque + '</span></span></li>';
      }).join('');
      partes.push('<h2>Registros que faltan</h2>' +
        '<p class="aviso warn">Estos clientes no se suman al cobrado. No hay un renglón de pago con el monto, y no se inventa.</p>' +
        '<ul class="lista">' + items + '</ul>');
    }
    if (info.pagosSinFecha) {
      partes.push('<p class="aviso warn">' + info.pagosSinFecha +
        (info.pagosSinFecha === 1 ? ' pago no tiene fecha válida' : ' pagos no tienen fecha válida') +
        ' y queda fuera de todos los periodos.</p>');
    }
    if (info.pagosSinMonto) {
      partes.push('<p class="aviso warn">' + info.pagosSinMonto +
        (info.pagosSinMonto === 1 ? ' pago de este periodo no tiene monto' : ' pagos de este periodo no tienen monto') +
        ' y no se suma.</p>');
    }
    return partes.join('');
  }

  function htmlFiltroArchivo() {
    var archivados = state.vistaArchivo === 'archivados';
    return '<div class="chips" role="group" aria-label="Lista de clientes">' +
      '<button type="button" data-action="filtrar-archivo" data-archivo="activos" aria-pressed="' + (archivados ? 'false' : 'true') + '">Activos</button>' +
      '<button type="button" data-action="filtrar-archivo" data-archivo="archivados" aria-pressed="' + (archivados ? 'true' : 'false') + '">Archivados</button>' +
      '</div>';
  }

  function htmlFiltroAreas() {
    var areas = areasDe(clientesDeVista());
    var botones = '<button type="button" data-action="filtrar-area" data-area="" aria-pressed="' + (state.area === '' ? 'true' : 'false') + '">Todas</button>';
    areas.forEach(function (area) {
      botones += '<button type="button" data-action="filtrar-area" data-area="' + esc(area) + '" aria-pressed="' + (state.area === area ? 'true' : 'false') + '">' + esc(area) + '</button>';
    });
    return '<div class="chips" role="group" aria-label="Filtrar por área">' + botones + '</div>';
  }

  function htmlGrupo(titulo, clientes, vacioTexto) {
    if (!clientes.length) {
      return vacioTexto ? '<h2>' + esc(titulo) + '</h2><p class="vacio">' + esc(vacioTexto) + '</p>' : '';
    }
    return '<h2>' + esc(titulo) + '</h2><ul class="lista">' + clientes.map(function (c) {
      return '<li class="card">' + htmlFichaInicio(c) +
        '<a class="btn primary block" href="#/clientes/' + seg(c.id) + '/pago">Registrar pago</a></li>';
    }).join('') + '</ul>';
  }

  function htmlFichaInicio(c) {
    var estado = CP.estadoDeCliente(c, new Date());
    var n = CP.equiposDeCliente(state.data.dispositivos, c.id).length;
    return '<a class="nombre-ficha" href="#/clientes/' + seg(c.id) + '"><strong>' + esc(c.nombre) + '</strong></a>' +
      '<p class="muted">' + esc(c.area || 'Sin área') + ' · ' + n + (n === 1 ? ' equipo' : ' equipos') +
      (c.promo === 'SI' ? ' · Promo' : '') + '</p>' +
      '<p>' + htmlChip(estado) + '</p>';
  }

  function htmlClienteLink(c) {
    var estado = CP.estadoDeCliente(c, new Date());
    var n = CP.equiposDeCliente(state.data.dispositivos, c.id).length;
    return '<a class="item" href="#/clientes/' + seg(c.id) + '">' +
      '<span class="item-main"><strong>' + esc(c.nombre) + '</strong>' +
      '<span class="muted">' + esc(c.area || 'Sin área') + ' · ' + n + (n === 1 ? ' equipo' : ' equipos') +
      (c.promo === 'SI' ? ' · Promo' : '') + '</span></span>' +
      '<span class="item-side">' + htmlChip(estado) + '</span></a>';
  }

  function htmlChip(estado) {
    var clase = { al_corriente: 'ok', por_vencer: 'warn', vencido: 'bad', exento: 'mute', archivado: 'mute' }[estado.clave] || 'mute';
    return '<span class="chip ' + clase + '">' + esc(estado.etiqueta) + '</span>';
  }

  function htmlLeyendaReactivacion(cliente) {
    if (CP.cargoReactivacion(cliente) !== CP.CARGO_REACTIVACION) return '';
    return '<p class="aviso warn">Debe pagar $20 de reactivación</p>';
  }

  function htmlMensualidad(cliente) {
    if (!state.mensualidadAbierta) {
      return '<button type="button" class="btn ghost block" data-action="ver-mensualidad" aria-expanded="false">Consultar mensualidad</button>';
    }
    return '<button type="button" class="btn ghost block" data-action="ver-mensualidad" aria-expanded="true">Ocultar mensualidad</button>' +
      htmlDesglose(cliente);
  }

  function htmlDesglose(cliente) {
    if (CP.esExento(cliente)) {
      return '<section class="desglose"><h2>Mensualidad</h2>' +
        '<p>Exento de pago. La mensualidad queda en $0.</p>' +
        '<p class="total"><span>Total al mes</span><strong class="num">' + esc(dinero(0)) + '</strong></p></section>';
    }
    var n = CP.equiposDeCliente(state.data.dispositivos, cliente.id).length;
    var d = CP.desgloseMensual(n, cliente.promo);
    var promo = d.promo
      ? '<p>Promo: −$' + CP.DESCUENTO_PAR + ' × ' + d.pares + (d.pares === 1 ? ' par' : ' pares') + ' = −' + esc(dinero(d.descuento)) + '</p>'
      : '';
    return '<section class="desglose"><h2>Mensualidad</h2>' +
      '<p>' + d.equipos + ' × $' + CP.PRECIO_EQUIPO + ' = ' + esc(dinero(d.bruto)) + '</p>' +
      promo +
      '<p class="total"><span>Total al mes</span><strong class="num">' + esc(dinero(d.total)) + '</strong></p></section>';
  }

  function nombreEquipo(eq) {
    if (!eq) return 'este equipo';
    var modelo = String(eq.modelo || '').trim();
    if (modelo) return modelo;
    if (eq.tipo) return eq.tipo;
    return 'este equipo';
  }

  function htmlModelo(eq) {
    var modelo = String(eq && eq.modelo || '').trim();
    return modelo ? '<p>' + esc(modelo) + '</p>' : '';
  }

  function htmlNotaEquipo(eq) {
    var nota = CP.notaVisibleEquipo(eq && eq.notas);
    return nota ? '<p class="muted">' + esc(nota) + '</p>' : '';
  }

  function htmlEquipoCard(eq, href) {
    return '<article class="card"><h3>' + esc(eq.tipo) + '</h3>' + htmlModelo(eq) +
      '<p class="mac num">' + esc(eq.mac) + '</p>' +
      htmlNotaEquipo(eq) +
      '<div class="fila-botones"><a class="btn ghost" href="' + href + '">Editar</a>' +
      (esAdmin() ? '<button type="button" class="btn danger" data-action="borrar-equipo" data-id="' + esc(eq.id) + '">Borrar</button>' : '') +
      '</div></article>';
  }

  function htmlHistorial(clienteId) {
    var pagos = pagosDe(clienteId);
    if (!pagos.length) return '<p class="vacio">Todavía no hay pagos.</p>';
    return '<ul class="lista">' + pagos.map(function (p) {
      var meses = Number(p.meses) || 0;
      return '<li class="item"><span class="item-main">' +
        (p.monto == null ? '' : '<strong class="num">' + esc(dinero(p.monto)) + '</strong>') +
        '<span class="muted">' + esc(CP.fechaCorta(p.fecha) || p.fecha) + ' · ' + meses + (meses === 1 ? ' mes' : ' meses') +
        (p.registrado_por ? ' · ' + esc(p.registrado_por) : '') + '</span></span>' +
        '<span class="item-side"><span class="muted">Hasta</span><strong>' + esc(CP.fechaCorta(p.cubre_hasta) || '—') + '</strong></span></li>';
    }).join('') + '</ul>';
  }

  function htmlTipos(actual) {
    return '<div class="tipos" role="radiogroup" aria-label="Tipo de equipo">' + CP.TIPOS.map(function (tipo) {
      var on = tipo === actual;
      return '<label class="tipo"><input type="radio" name="tipo" value="' + esc(tipo) + '"' + (on ? ' checked' : '') + '>' + esc(tipo) + '</label>';
    }).join('') + '</div>';
  }

  function htmlVolver(href, texto) {
    return '<a class="volver" href="' + href + '">‹ ' + esc(texto) + '</a>';
  }

  function htmlNoEsta(texto) {
    return '<h1>No encontrado</h1><p>' + esc(texto) + '</p><a class="btn primary block" href="#/clientes">Ir a clientes</a>';
  }

  function htmlConfirm() {
    return '<div class="modal-fondo" role="presentation"><div class="modal" role="dialog" aria-modal="true" aria-label="Confirmar">' +
      '<p>' + esc(state.confirm.texto) + '</p>' +
      '<button type="button" class="btn ' + (state.confirm.peligro ? 'danger' : 'primary') + ' block" id="confirmar-btn" data-action="confirmar">' + esc(state.confirm.ok || 'Confirmar') + '</button>' +
      '<button type="button" class="btn ghost block" data-action="cancelar-modal">Cancelar</button></div></div>';
  }

  function onClick(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (action === 'cancelar-modal') {
      e.preventDefault();
      state.confirm = null;
      render({ soloModal: true });
      return;
    }
    if (action === 'confirmar') {
      e.preventDefault();
      var run = state.confirm && state.confirm.run;
      state.confirm = null;
      render({ soloModal: true });
      if (run) Promise.resolve().then(run).catch(function (err) { toast(mensaje(err)); });
      return;
    }
    if (action === 'filtrar-area') {
      e.preventDefault();
      state.area = btn.getAttribute('data-area') || '';
      render();
      return;
    }
    if (action === 'filtrar-archivo') {
      e.preventDefault();
      state.vistaArchivo = btn.getAttribute('data-archivo') === 'archivados' ? 'archivados' : 'activos';
      render();
      return;
    }
    if (action === 'archivar-cliente') {
      e.preventDefault();
      pedirArchivar(btn.getAttribute('data-id'));
      return;
    }
    if (action === 'reactivar-cliente') {
      e.preventDefault();
      pedirReactivar(btn.getAttribute('data-id'));
      return;
    }
    if (action === 'meses-menos' || action === 'meses-mas') {
      e.preventDefault();
      cambiarMeses(action === 'meses-mas' ? 1 : -1);
      return;
    }
    if (action === 'borrar-equipo') {
      e.preventDefault();
      pedirBorrar(btn.getAttribute('data-id'));
      return;
    }
    if (action === 'ver-mensualidad') {
      e.preventDefault();
      state.mensualidadAbierta = !state.mensualidadAbierta;
      render();
      return;
    }
    if (action === 'ver-clave' || action === 'ver-clave-usuario') {
      e.preventDefault();
      var selector = action === 'ver-clave-usuario' ? '#form-usuario [name="clave"]' : '#form-ajustes [name="clave"]';
      var input = document.querySelector(selector);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? 'Ver' : 'Ocultar';
      return;
    }
    if (action === 'probar') {
      e.preventDefault();
      probarConexion();
      return;
    }
    if (action === 'modo-demo') {
      e.preventDefault();
      state.settings.url = '';
      guardarSettings();
      cargar().then(function () { toast('Modo demostración. La hoja no se modificó.'); });
      return;
    }
    if (action === 'reset-demo') {
      e.preventDefault();
      lsDel(K_DEMO);
      if (!state.settings.url) {
        state.data = CPDemo.datosDemo(new Date());
        render();
        toast('Datos de demostración restablecidos.');
      } else {
        toast('Listo. La demostración volverá a los datos de ejemplo.');
      }
      return;
    }
    if (action === 'actualizar') {
      e.preventDefault();
      cargar().then(function () {
        if (state.modo === 'online') toast('Lista actualizada.');
      });
      return;
    }
    if (action === 'reintentar-cola') {
      e.preventDefault();
      reintentarCola();
      return;
    }
    if (action === 'marcar-recordatorio') {
      marcarRecordatorio(btn.getAttribute('data-id'));
      return;
    }
    if (action === 'marcar-aviso') {
      state.avisosHechos[btn.getAttribute('data-id')] = true;
      return;
    }
    if (action === 'copiar-numeros') {
      e.preventDefault();
      copiarNumerosAviso();
      return;
    }
    if (action === 'quitar-usuario') {
      e.preventDefault();
      quitarUsuario(btn.getAttribute('data-nombre'));
      return;
    }
    if (action === 'aplicar-version') {
      e.preventDefault();
      aplicarActualizacion();
    }
  }

  function idFormulario(form) {
    return form && form.getAttribute ? (form.getAttribute('id') || '') : '';
  }

  function onSubmit(e) {
    var form = e.target;
    var id = idFormulario(form);
    if (id !== 'form-cliente' && id !== 'form-equipo' && id !== 'form-pago' && id !== 'form-ajustes' && id !== 'form-usuario') return;
    e.preventDefault();
    if (id === 'form-cliente') guardarClienteDesde(form);
    else if (id === 'form-equipo') guardarEquipoDesde(form, false);
    else if (id === 'form-pago') guardarPagoDesde(form);
    else if (id === 'form-ajustes') {
      state.settings = leerAjustesForm();
      guardarSettings();
      cargar().then(function () {
        if (state.modo === 'online') toast('Conectado.');
        else if (state.modo === 'demo') toast('Modo demostración.');
      });
    } else if (id === 'form-usuario') guardarUsuarioDesde(form);
  }

  function onInput(e) {
    var el = e.target;
    if (el.id === 'buscar') {
      state.q = el.value;
      render({ soloLista: true });
      return;
    }
    if (el.id === 'buscar-equipos') {
      state.qEquipos = el.value;
      render({ soloLista: true });
      return;
    }
    if (el.id === 'texto-aviso') {
      state.textoAviso = el.value;
      return;
    }
    if (el.name === 'mac') {
      var ayuda = document.getElementById('mac-ayuda');
      var norm = CP.normalizarMac(el.value);
      if (ayuda) ayuda.textContent = norm.ok ? norm.mac : 'Se guarda como AA-BB-CC-DD-EE-FF.';
    }
    if (!el.form || idFormulario(el.form) !== 'form-pago') return;
    if (el.name === 'monto' && e.isTrusted) state.montoManual = true;
    if ((el.name === 'meses' || el.name === 'fecha') && !state.montoManual) rellenarMonto();
    if (el.name === 'meses' || el.name === 'fecha' || el.name === 'monto') actualizarPreviewPago();
  }

  function onChange(e) {
    var el = e.target;
    if (el.id === 'periodo-cobros') {
      state.periodoCobro = el.value;
      render();
      return;
    }
    if (el.id === 'plantilla-aviso') {
      state.plantillaAviso = el.value;
      state.textoAviso = textoPlantilla(el.value);
      state.avisosHechos = {};
      render();
      return;
    }
    if (el.id === 'area-aviso') {
      state.areaAviso = el.value;
      state.avisosHechos = {};
      render();
      return;
    }
    if (el.getAttribute('data-action') === 'asignar') {
      var clienteId = el.value;
      var id = el.getAttribute('data-id');
      if (!clienteId) return;
      asignarEquipo(id, clienteId).catch(function (err) {
        el.value = '';
        toast(mensaje(err));
      });
      return;
    }
    if (el.form && idFormulario(el.form) === 'form-pago' && (el.name === 'fecha' || el.name === 'meses')) {
      if (!state.montoManual) rellenarMonto();
      actualizarPreviewPago();
    }
  }

  function guardarClienteDesde(form) {
    if (state.guardando) return;
    if (rechazoLectura()) return;
    var id = val(form, 'registro_id') || nuevoId('c');
    var valid = CP.validarCliente({
      id: id,
      nombre: val(form, 'nombre'),
      celular: val(form, 'celular'),
      area: val(form, 'area'),
      promo: form.elements.promo && form.elements.promo.checked ? 'SI' : 'NO',
      exento: form.elements.exento && form.elements.exento.checked ? 'SI' : 'NO',
      fecha_ultimo_pago: val(form, 'fecha_ultimo_pago'),
      proximo_vencimiento: val(form, 'proximo_vencimiento'),
      meses_pagados: val(form, 'meses_pagados'),
      notas: val(form, 'notas')
    });
    if (!valid.ok) { toast(valid.error); return; }
    valid.cliente.id = id;
    state.guardando = true;
    marcarGuardando(form);
    persistirCliente(valid.cliente).then(function (guardado) {
      state.guardando = false;
      toast('Cliente guardado.');
      ir('clientes/' + encodeURIComponent(guardado.id));
    }).catch(function (err) {
      state.guardando = false;
      marcarGuardando(form, false);
      toast(mensaje(err));
    });
  }

  function guardarEquipoDesde(form, forzar) {
    if (state.guardando) return;
    if (rechazoLectura()) return;
    var id = val(form, 'registro_id') || nuevoId('d');
    var tipo = '';
    var radios = form.querySelectorAll('input[name="tipo"]');
    radios.forEach(function (radio) { if (radio.checked) tipo = radio.value; });
    var valid = CP.validarDispositivo({
      id: id,
      cliente_id: val(form, 'cliente_id'),
      tipo: tipo,
      modelo: val(form, 'modelo'),
      mac: val(form, 'mac'),
      notas: val(form, 'notas')
    }, state.data.dispositivos);
    if (!valid.ok) { toast(valid.error); return; }
    valid.dispositivo.id = id;
    if (valid.dispositivo.cliente_id && !buscarCliente(valid.dispositivo.cliente_id)) {
      toast('Ese cliente no existe.');
      return;
    }
    if (valid.duplicado && !forzar) {
      var otro = valid.duplicado;
      var dueno = buscarCliente(otro.cliente_id);
      state.confirm = {
        texto: 'Esta MAC ya está en ' + nombreEquipo(otro) + (dueno ? ' (' + dueno.nombre + ')' : ' (sin asignar)') + '. ¿La guardas de todos modos?',
        ok: 'Guardar de todos modos',
        run: function () { return persistirEquipo(valid.dispositivo); }
      };
      render({ soloModal: true });
      return;
    }
    persistirEquipo(valid.dispositivo);
  }

  function guardarPagoDesde(form) {
    if (state.guardando) return;
    if (rechazoLectura()) return;
    var cliente = buscarCliente(val(form, 'cliente_id'));
    if (!cliente) { toast('Cliente no encontrado'); return; }
    var nombre = val(form, 'registrado_por').trim();
    if (!nombre) { toast('Escribe tu nombre para el historial.'); return; }
    var entrada = {
      id: nuevoId('p'),
      cliente_id: cliente.id,
      fecha: val(form, 'fecha'),
      meses: val(form, 'meses'),
      monto: val(form, 'monto'),
      registrado_por: nombre
    };
    var exento = CP.esExento(cliente);
    var abrir = exento ? null : prepararVentana();
    state.guardando = true;
    marcarGuardando(form);
    guardarPago(entrada).then(function (res) {
      state.guardando = false;
      if (!state.settings.nombre) {
        state.settings.nombre = nombre;
        guardarSettings();
      }
      var texto = '';
      var url = '';
      if (!exento) {
        texto = CP.mensajeWhatsApp(cliente.nombre, res.pago.monto, res.pago.cubre_hasta);
        url = CP.enlaceWhatsApp(cliente.celular, texto);
        if (url) abrir(url);
        else abrir.cerrar();
      }
      if (sigueEnPago(cliente.id)) {
        state.pagoHecho = { pago: res.pago, texto: texto, url: url };
        render();
      } else toast('Pago guardado.');
    }).catch(function (err) {
      state.guardando = false;
      if (abrir) abrir.cerrar();
      marcarGuardando(form, false);
      toast(mensaje(err));
    });
  }

  function val(form, nombre) {
    var el = form.elements[nombre];
    return el ? String(el.value || '') : '';
  }

  function marcarGuardando(form, activo) {
    var boton = form.querySelector('[type="submit"]');
    if (!boton) return;
    var guardando = activo !== false;
    boton.disabled = guardando || (state.soloLectura && !state.settings.url);
    if (guardando) boton.textContent = 'Guardando…';
    else if (idFormulario(form) === 'form-pago') {
      var clientePago = buscarCliente(val(form, 'cliente_id'));
      boton.textContent = clientePago && CP.esExento(clientePago) ? 'Guardar pago' : 'Guardar pago y abrir WhatsApp';
    }
    else boton.textContent = 'Guardar';
  }

  function persistirCliente(cliente) {
    if (state.modo === 'demo') {
      var guardadoDemo = CP.fusionarCliente(buscarCliente(cliente.id), cliente);
      if (!guardadoDemo.id) guardadoDemo.id = cliente.id;
      state.data.clientes = upsert(state.data.clientes, guardadoDemo);
      guardarDemo();
      return Promise.resolve(guardadoDemo);
    }
    function dejarPendiente() {
      var guardado = CP.fusionarCliente(buscarCliente(cliente.id), cliente);
      if (!guardado.id) guardado.id = cliente.id;
      state.data.clientes = upsert(state.data.clientes, guardado);
      guardarCache(state.data);
      encolar({ tipo: 'cliente', cliente: guardado });
      throw new Error(CP.MENSAJE_SIN_INTERNET);
    }
    if (sinRed()) return Promise.resolve().then(dejarPendiente);
    return api('upsertCliente', { cliente: cliente }).then(function (res) {
      var guardado = normalizarRemoto({ clientes: [res.cliente] }).clientes[0];
      state.data.clientes = upsert(state.data.clientes, guardado);
      guardarCache(state.data);
      return guardado;
    }).catch(function (err) {
      if (!esFalloDeRed(err)) throw err;
      dejarPendiente();
    });
  }

  function persistirEquipo(dispositivo) {
    function despues(guardado, advertencia) {
      state.guardando = false;
      state.data.dispositivos = upsert(state.data.dispositivos, guardado);
      if (state.modo === 'demo') guardarDemo();
      else guardarCache(state.data);
      toast(advertencia || 'Equipo guardado.');
      if (guardado.cliente_id) ir('clientes/' + encodeURIComponent(guardado.cliente_id));
      else ir('equipos');
    }
    if (state.modo === 'demo') {
      return Promise.resolve().then(function () { despues(dispositivo); });
    }
    function dejarPendiente() {
      state.guardando = false;
      state.data.dispositivos = upsert(state.data.dispositivos, dispositivo);
      guardarCache(state.data);
      encolar({ tipo: 'equipo', dispositivo: dispositivo });
      toast(CP.MENSAJE_SIN_INTERNET);
      render();
    }
    if (sinRed()) {
      dejarPendiente();
      return Promise.resolve();
    }
    state.guardando = true;
    return api('upsertDispositivo', { dispositivo: dispositivo }).then(function (res) {
      var guardado = normalizarRemoto({ dispositivos: [res.dispositivo] }).dispositivos[0];
      despues(guardado, res.advertencia);
    }).catch(function (err) {
      state.guardando = false;
      if (!esFalloDeRed(err)) {
        toast(mensaje(err));
        return;
      }
      dejarPendiente();
    });
  }

  function asignarEquipo(id, clienteId) {
    if (state.soloLectura && !state.settings.url) return Promise.reject(new Error(CP.MENSAJE_SIN_INTERNET));
    var eq = buscarEquipo(id);
    if (!eq) return Promise.reject(new Error('Equipo no encontrado'));
    var copia = Object.assign({}, eq, { cliente_id: clienteId });
    if (state.modo === 'demo') {
      state.data.dispositivos = upsert(state.data.dispositivos, copia);
      guardarDemo();
      var cliente = buscarCliente(clienteId);
      toast('Asignado a ' + (cliente ? cliente.nombre : 'cliente') + '.');
      render();
      return Promise.resolve();
    }
    function dejarPendiente() {
      state.data.dispositivos = upsert(state.data.dispositivos, copia);
      guardarCache(state.data);
      encolar({ tipo: 'equipo', dispositivo: copia });
      toast(CP.MENSAJE_SIN_INTERNET);
      render();
    }
    if (sinRed()) {
      dejarPendiente();
      return Promise.resolve();
    }
    return api('upsertDispositivo', { dispositivo: copia }).then(function (res) {
      var guardado = normalizarRemoto({ dispositivos: [res.dispositivo] }).dispositivos[0];
      state.data.dispositivos = upsert(state.data.dispositivos, guardado);
      guardarCache(state.data);
      var dueno = buscarCliente(guardado.cliente_id);
      toast('Asignado a ' + (dueno ? dueno.nombre : 'cliente') + '.');
      render();
    }).catch(function (err) {
      if (!esFalloDeRed(err)) throw err;
      dejarPendiente();
    });
  }

  function pedirArchivar(id) {
    var cliente = buscarCliente(id);
    state.confirm = {
      texto: '¿Archivar a ' + (cliente ? cliente.nombre : 'este cliente') + '? Sale de la lista activa y no entra en el pendiente. Se conservan su registro, sus pagos, sus equipos y sus notas.',
      ok: 'Archivar',
      peligro: true,
      run: function () { return fijarArchivo(id, true); }
    };
    render({ soloModal: true });
  }

  function pedirReactivar(id) {
    var cliente = buscarCliente(id);
    state.confirm = {
      texto: '¿Reactivar a ' + (cliente ? cliente.nombre : 'este cliente') + '? Vuelve a la lista activa. Debe pagar $20 de reactivación. Es un cargo único, no es la mensualidad.',
      ok: 'Reactivar',
      run: function () { return fijarArchivo(id, false); }
    };
    render({ soloModal: true });
  }

  function fijarArchivo(id, archivado) {
    if (rechazoLectura()) return Promise.resolve();
    var actual = buscarCliente(id);
    if (!actual) return Promise.reject(new Error('Cliente no encontrado'));
    var cambios = archivado
      ? { archivado: 'SI' }
      : { archivado: 'NO', reactivacion: CP.CARGO_REACTIVACION };
    var cliente = CP.fusionarCliente(actual, cambios);
    return persistirCliente(cliente).then(function (guardado) {
      if (!CP.marcaGuardada(cliente, guardado)) {
        state.scriptViejo = true;
        toast(archivado
          ? 'No se archivó. La hoja no guardó la marca. Publica una versión nueva del script, sin cambiar el enlace /exec, y vuelve a intentar.'
          : 'No se reactivó. La hoja no guardó el regreso ni el cargo de $20. Publica una versión nueva del script, sin cambiar el enlace /exec, y vuelve a intentar.');
        render();
        return;
      }
      toast(archivado ? 'Cliente archivado. Solo se ve en Archivados.' : 'Cliente reactivado. Debe pagar $20 de reactivación.');
      var parts = rutaActual().parts;
      if (archivado && parts[0] === 'clientes' && parts[1] && !parts[2]) {
        state.vistaArchivo = 'activos';
        ir('clientes');
      } else render();
    });
  }

  function pedirBorrar(id) {
    var eq = buscarEquipo(id);
    state.confirm = {
      texto: '¿Borrar ' + nombreEquipo(eq) + '? Esta acción no se deshace.',
      ok: 'Borrar',
      peligro: true,
      run: function () { return borrarEquipo(id); }
    };
    render({ soloModal: true });
  }

  function borrarEquipo(id) {
    if (state.soloLectura && !state.settings.url) return Promise.reject(new Error(CP.MENSAJE_SIN_INTERNET));
    function listo() {
      state.data.dispositivos = state.data.dispositivos.filter(function (d) { return String(d.id) !== String(id); });
      if (state.modo === 'demo') guardarDemo();
      else guardarCache(state.data);
      toast('Equipo borrado.');
      var parts = rutaActual().parts;
      if (parts[0] === 'equipos' && parts[1] && parts[1] !== 'nuevo') ir('equipos');
      else render();
    }
    if (state.modo === 'demo') {
      listo();
      return Promise.resolve();
    }
    function dejarPendiente() {
      state.data.dispositivos = state.data.dispositivos.filter(function (d) { return String(d.id) !== String(id); });
      guardarCache(state.data);
      encolar({ tipo: 'borrar-equipo', borrarId: id });
      toast(CP.MENSAJE_SIN_INTERNET);
      render();
    }
    if (sinRed()) {
      dejarPendiente();
      return Promise.resolve();
    }
    return api('deleteDispositivo', { id: id }).then(listo).catch(function (err) {
      if (!esFalloDeRed(err)) throw err;
      dejarPendiente();
    });
  }

  function guardarPago(entrada) {
    if (state.modo === 'demo') {
      try {
        var res = CP.aplicarPago(state.data, entrada);
        state.data = res.data;
        guardarDemo();
        return Promise.resolve(res);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    function dejarPendiente() {
      var local = CP.incorporarPago(state.data, entrada);
      state.data = local.data;
      guardarCache(state.data);
      encolar({ tipo: 'pago', pago: entrada });
      throw new Error(CP.MENSAJE_SIN_INTERNET);
    }
    if (sinRed()) return Promise.resolve().then(dejarPendiente);
    return api('registrarPago', { pago: entrada }).then(function (res) {
      var cliente = normalizarRemoto({ clientes: [res.cliente] }).clientes[0];
      var pago = normalizarRemoto({ pagos: [res.pago] }, state.usuario && state.usuario.rol).pagos[0];
      state.data.clientes = upsert(state.data.clientes, cliente);
      state.data.pagos = upsert(state.data.pagos, pago);
      guardarCache(state.data);
      return { pago: pago, cliente: cliente };
    }).catch(function (err) {
      if (!esFalloDeRed(err)) throw err;
      dejarPendiente();
    });
  }

  function probarConexion() {
    var form = document.getElementById('form-ajustes');
    if (!form) return;
    var previo = state.settings;
    var prueba = leerAjustesForm();
    if (!prueba.url) { toast('Sin dirección: la app se queda en demostración.'); return; }
    state.settings = prueba;
    api('list').then(function (data) {
      var normal = normalizarRemoto(data);
      toast('Conectado. ' + normal.clientes.length + ' clientes, ' + normal.dispositivos.length + ' equipos, ' + normal.pagos.length + ' pagos.');
    }).catch(function (err) {
      toast(mensaje(err));
    }).then(function () {
      state.settings = previo;
    });
  }

  function leerAjustesForm() {
    var form = document.getElementById('form-ajustes');
    return {
      url: val(form, 'url').trim(),
      clave: val(form, 'clave'),
      nombre: val(form, 'nombre').trim()
    };
  }

  function cambiarMeses(delta) {
    var input = document.querySelector('#form-pago [name="meses"]');
    if (!input) return;
    var n = parseInt(input.value, 10) || 1;
    n = Math.min(24, Math.max(1, n + delta));
    input.value = String(n);
    if (!state.montoManual) rellenarMonto();
    actualizarPreviewPago();
  }

  function rellenarMonto() {
    var form = document.getElementById('form-pago');
    if (!form) return;
    var cliente = buscarCliente(val(form, 'cliente_id'));
    if (!cliente) return;
    var meses = parseInt(val(form, 'meses'), 10) || 1;
    form.elements.monto.value = String(CP.mensualidadCliente(cliente, state.data.dispositivos) * meses + CP.cargoReactivacion(cliente));
  }

  function actualizarPreviewPago() {
    var form = document.getElementById('form-pago');
    var caja = document.getElementById('vista-pago');
    if (!form || !caja) return;
    var cliente = buscarCliente(val(form, 'cliente_id'));
    if (!cliente) return;
    caja.innerHTML = htmlPreviewPago(cliente, val(form, 'fecha'), val(form, 'meses'), val(form, 'monto'));
  }

  function prepararVentana() {
    var w = null;
    try { w = window.open('about:blank', '_blank'); } catch (e) { w = null; }
    function irUrl(url) {
      if (w && !w.closed) {
        w.location = url;
        return true;
      }
      try { return !!window.open(url, '_blank', 'noopener'); } catch (e) { return false; }
    }
    irUrl.cerrar = function () {
      try { if (w && !w.closed) w.close(); } catch (e) {}
    };
    return irUrl;
  }

  function rechazoLectura() {
    if (!state.soloLectura || state.settings.url) return false;
    toast(CP.MENSAJE_SIN_INTERNET);
    return true;
  }

  function sinRed(err) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    return !!(err && esFalloDeRed(err));
  }

  function leerCola() {
    try {
      var parsed = JSON.parse(lsGet(K_COLA) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function guardarCola() {
    lsSet(K_COLA, JSON.stringify(state.cola));
  }

  function encolar(op) {
    state.cola = CP.encolarOperacion(state.cola, op);
    guardarCola();
    pintarAvisos();
  }

  function reintentarCola() {
    if (!state.settings.url || state.modo === 'demo') return Promise.resolve();
    if (sinRed()) {
      toast(CP.MENSAJE_SIN_INTERNET);
      return Promise.resolve();
    }
    function paso() {
      if (!state.cola.length) {
        guardarCola();
        pintarAvisos();
        toast('Pendientes guardados.');
        return Promise.resolve();
      }
      var item = state.cola[0];
      return enviarColaItem(item).then(function () {
        state.cola = state.cola.slice(1);
        guardarCola();
        pintarAvisos();
        return paso();
      }).catch(function (err) {
        guardarCola();
        pintarAvisos();
        toast(esFalloDeRed(err) || sinRed() ? CP.MENSAJE_SIN_INTERNET : mensaje(err));
      });
    }
    return paso();
  }

  function enviarColaItem(item) {
    if (!item) return Promise.resolve();
    if (item.tipo === 'cliente') {
      return api('upsertCliente', { cliente: item.cliente }).then(function (res) {
        var guardado = normalizarRemoto({ clientes: [res.cliente] }).clientes[0];
        state.data.clientes = upsert(state.data.clientes, guardado);
        guardarCache(state.data);
        if (item.cliente && CP.esArchivado(item.cliente) !== CP.esArchivado(guardado)) state.scriptViejo = true;
      });
    }
    if (item.tipo === 'pago') {
      return api('registrarPago', { pago: item.pago }).then(function (res) {
        var cliente = normalizarRemoto({ clientes: [res.cliente] }).clientes[0];
        var pago = normalizarRemoto({ pagos: [res.pago] }, state.usuario && state.usuario.rol).pagos[0];
        state.data.clientes = upsert(state.data.clientes, cliente);
        state.data.pagos = upsert(state.data.pagos, pago);
        guardarCache(state.data);
      });
    }
    if (item.tipo === 'equipo') {
      return api('upsertDispositivo', { dispositivo: item.dispositivo }).then(function (res) {
        var guardado = normalizarRemoto({ dispositivos: [res.dispositivo] }).dispositivos[0];
        state.data.dispositivos = upsert(state.data.dispositivos, guardado);
        guardarCache(state.data);
      });
    }
    if (item.tipo === 'borrar-equipo') return api('deleteDispositivo', { id: item.borrarId });
    return Promise.resolve();
  }

  function leerRecordatorios(hoy) {
    var fecha = CP.formatISO(CP.inicioDeDia(hoy || new Date()));
    try {
      var parsed = JSON.parse(lsGet(K_RECORDATORIOS) || '{}');
      if (!parsed || parsed.fecha !== fecha) return {};
      return parsed.ids || {};
    } catch (e) {
      return {};
    }
  }

  function marcarRecordatorio(id) {
    var fecha = CP.formatISO(CP.inicioDeDia(new Date()));
    var ids = leerRecordatorios(new Date());
    ids[id] = true;
    lsSet(K_RECORDATORIOS, JSON.stringify({ fecha: fecha, ids: ids }));
  }

  function guardarUsuarioDesde(form) {
    if (!esAdmin()) return;
    if (state.modo !== 'online') { toast('Conecta la hoja para guardar usuarios.'); return; }
    if (sinRed()) { toast(CP.MENSAJE_SIN_INTERNET); return; }
    var nombre = val(form, 'nombre').trim();
    var clave = val(form, 'clave');
    api('setUsuario', { nombre: nombre, rol: 'operador', claveUsuario: clave }).then(function (data) {
      state.usuarios = (data && data.usuarios) || [];
      form.reset();
      toast('Usuario guardado.');
      render();
    }).catch(function (err) { toast(mensaje(err)); });
  }

  function quitarUsuario(nombre) {
    if (!esAdmin() || state.modo !== 'online') return;
    if (sinRed()) { toast(CP.MENSAJE_SIN_INTERNET); return; }
    api('quitarUsuario', { nombre: nombre }).then(function (data) {
      state.usuarios = (data && data.usuarios) || [];
      toast('Usuario quitado.');
      render();
    }).catch(function (err) { toast(mensaje(err)); });
  }

  function copiarNumerosAviso() {
    var texto = CP.numerosDifusion(CP.destinatariosAviso(state.data.clientes, state.areaAviso)).join('\n');
    if (!texto) { toast('No hay números para copiar.'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () {
        toast('Números copiados.');
      }, function () { copiarConSeleccion(texto); });
      return;
    }
    copiarConSeleccion(texto);
  }

  function copiarConSeleccion(texto) {
    var area = document.createElement('textarea');
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      toast('Números copiados.');
    } catch (e) {
      toast('No se pudieron copiar.');
    }
    document.body.removeChild(area);
  }

  function textoPlantilla(id) {
    var lista = CP.PLANTILLAS_AVISO;
    var i;
    for (i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i].texto;
    }
    return '';
  }

  function sigueEnPago(clienteId) {
    var parts = rutaActual().parts;
    return parts[0] === 'clientes' && parts[1] === clienteId && parts[2] === 'pago';
  }

  function upsert(lista, item) {
    var next = lista.slice();
    for (var i = 0; i < next.length; i++) {
      if (String(next[i].id) === String(item.id)) {
        next[i] = item;
        return next;
      }
    }
    next.push(item);
    return next;
  }

  function buscarCliente(id) {
    for (var i = 0; i < state.data.clientes.length; i++) {
      if (String(state.data.clientes[i].id) === String(id)) return state.data.clientes[i];
    }
    return null;
  }

  function buscarEquipo(id) {
    for (var i = 0; i < state.data.dispositivos.length; i++) {
      if (String(state.data.dispositivos[i].id) === String(id)) return state.data.dispositivos[i];
    }
    return null;
  }

  function clientesDeVista() {
    var archivados = state.vistaArchivo === 'archivados';
    return state.data.clientes.filter(function (c) {
      return CP.esArchivado(c) === archivados;
    });
  }

  function clientesFiltrados() {
    var archivados = state.vistaArchivo === 'archivados';
    return ordenarPorNombre(state.data.clientes.filter(function (c) {
      if (CP.esArchivado(c) !== archivados) return false;
      if (state.area && c.area !== state.area) return false;
      if (!state.q) return true;
      return fold(c.nombre + ' ' + c.celular + ' ' + c.area).indexOf(fold(state.q)) >= 0;
    }));
  }

  function equiposLibres() {
    return state.data.dispositivos.filter(function (d) { return !d.cliente_id; });
  }

  function pagosDe(clienteId) {
    return state.data.pagos.filter(function (p) {
      return String(p.cliente_id) === String(clienteId);
    }).sort(function (a, b) {
      return String(b.fecha).localeCompare(String(a.fecha)) || String(b.id).localeCompare(String(a.id));
    });
  }

  function ordenarPorNombre(lista) {
    return lista.slice().sort(function (a, b) {
      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es-MX');
    });
  }

  function areasDe(lista) {
    var set = {};
    (lista || []).forEach(function (c) { if (c.area) set[c.area] = true; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'es-MX'); });
  }

  function areasUnicas() {
    return areasDe(state.data.clientes);
  }

  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function nuevoId(prefijo) {
    return prefijo + (Math.random().toString(16).slice(2) + Date.now().toString(16)).slice(0, 12);
  }

  function hoyISO() {
    return CP.formatISO(CP.inicioDeDia(new Date()));
  }

  function dinero(n) {
    var texto = CP.formatPesos(n);
    var partes = texto.split('.');
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '$' + partes.join('.');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mensaje(err) {
    return err && err.message ? err.message : 'No se pudo completar.';
  }

  function toast(texto) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = texto;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3400);
  }

  function seg(s) { return encodeURIComponent(s); }

  if (typeof document !== 'undefined') arrancar();
})();
