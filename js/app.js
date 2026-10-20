/* Pantalla de Conectividad Plus. Sin dirección del script, usa datos ficticios. */
(function () {
  'use strict';

  var K_SETTINGS = 'cp.settings.v1';
  var K_CACHE = 'cp.cache.v1';
  var K_DEMO = 'cp.demo.v1';
  var VERSION = '4';

  var state = {
    settings: { url: '', clave: '', nombre: '' },
    data: { clientes: [], dispositivos: [], pagos: [] },
    modo: 'demo',
    soloLectura: false,
    aviso: '',
    cacheEn: '',
    q: '',
    area: '',
    qEquipos: '',
    confirm: null,
    pagoHecho: null,
    montoManual: false,
    guardando: false,
    cargando: true,
    hayVersionNueva: false,
    swReg: null,
    pidioActualizar: false,
    recargaHecha: false
  };

  var ultimaRuta = null;
  var toastTimer = 0;

  function arrancar() {
    state.settings = leerSettings();
    window.addEventListener('hashchange', function () { render(); });
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
      if (document.visibilityState === 'visible') pedirRevision();
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
      return { data: normalizarRemoto(parsed.data), cuando: String(parsed.cuando || '') };
    } catch (e) {
      return null;
    }
  }

  function guardarCache(data) {
    lsSet(K_CACHE, JSON.stringify({ cuando: new Date().toISOString(), data: data }));
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

  function normalizarRemoto(data) {
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
          monto: Number(p.monto) || 0,
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
    var body = Object.assign({ clave: state.settings.clave, action: action }, extra || {});
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
      state.data = leerDemo();
      state.cargando = false;
      render();
      return Promise.resolve();
    }
    return api('list').then(function (data) {
      state.data = normalizarRemoto(data);
      state.modo = 'online';
      state.soloLectura = false;
      state.aviso = '';
      guardarCache(state.data);
    }).catch(function (err) {
      var cache = leerCache();
      if (esFalloDeRed(err) && cache) {
        state.data = cache.data;
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
    if (a === 'clientes' || a === 'vencidos' || a === 'equipos' || a === 'ajustes') return a;
    return 'inicio';
  }

  function render(opciones) {
    opciones = opciones || {};
    var firma = location.hash || '#/';
    if (firma !== ultimaRuta) {
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
    if (state.modo === 'demo') {
      partes.push('<p class="aviso">Modo demostración con datos ficticios. Nada de esto se guarda en la hoja.</p>');
    } else if (state.aviso) {
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
    if (a === 'ajustes') return htmlAjustes();
    return htmlInicio();
  }

  function htmlInicio() {
    var hoy = new Date();
    var vencidos = state.data.clientes.filter(function (c) {
      return CP.estadoDeCliente(c, hoy).clave === 'vencido';
    });
    var pronto = state.data.clientes.filter(function (c) {
      return CP.estadoDeCliente(c, hoy).clave === 'por_vencer';
    });
    var sinFecha = state.data.clientes.filter(function (c) {
      return CP.estadoDeCliente(c, hoy).clave === 'sin_fecha';
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
      '<p class="ayuda">Por cobrar este mes suma un mes de quienes vencen en este mes, de quienes ya vencieron y de quienes no tienen fecha. No acumula meses atrasados. Quien está exento de pago no entra.</p>' +
      '<p><a class="btn primary block" href="#/clientes/nuevo">Nuevo cliente</a></p>' +
      (state.settings.url ? '<p><button type="button" class="btn ghost block" data-action="actualizar">Actualizar</button></p>' : '') +
      htmlGrupo('Vencidos', ordenarPorNombre(vencidos), 'Nadie está vencido.') +
      (pronto.length ? htmlGrupo('Por vencer', ordenarPorNombre(pronto)) : '') +
      (sinFecha.length ? htmlGrupo('Sin fecha de pago', ordenarPorNombre(sinFecha)) : '');
  }

  function htmlClientes() {
    return '<h1>Clientes</h1>' +
      htmlResumen(false) +
      '<label class="campo">Buscar<input id="buscar" type="search" placeholder="Nombre, celular o área" value="' + esc(state.q) + '" autocomplete="off"></label>' +
      htmlFiltroAreas() +
      '<p class="ayuda">Por vencer: faltan 5 días o menos. Vencido: la fecha ya pasó.</p>' +
      '<p><a class="btn primary block" href="#/clientes/nuevo">Nuevo cliente</a></p>' +
      '<div id="lista">' + htmlListaClientes() + '</div>';
  }

  function htmlListaClientes() {
    var lista = clientesFiltrados();
    if (!lista.length) return '<p class="vacio">Ningún cliente coincide.</p>';
    return '<ul class="lista">' + lista.map(function (c) {
      return '<li>' + htmlClienteLink(c) + '</li>';
    }).join('') + '</ul>';
  }

  function htmlVencidos() {
    var hoy = new Date();
    var lista = state.data.clientes.filter(function (c) {
      return CP.estadoDeCliente(c, hoy).clave === 'vencido';
    }).sort(function (a, b) {
      return CP.estadoDeCliente(a, hoy).dias - CP.estadoDeCliente(b, hoy).dias;
    });
    var cuerpo = lista.length ? '<ul class="lista">' + lista.map(function (c) {
      var estado = CP.estadoDeCliente(c, hoy);
      var total = CP.mensualidadCliente(c, state.data.dispositivos);
      return '<li class="card"><strong>' + esc(c.nombre) + '</strong>' +
        '<p class="muted">' + esc(c.area || 'Sin área') + ' · ' + esc(CP.textoDias(estado)) + '</p>' +
        '<p>Mensualidad <strong class="num">' + esc(dinero(total)) + '</strong></p>' +
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
        (eq.notas ? '<p class="muted">' + esc(eq.notas) + '</p>' : '') +
        '<label class="campo">Asignar a<select data-action="asignar" data-id="' + esc(eq.id) + '"' + (state.soloLectura ? ' disabled' : '') + '>' +
        '<option value="">Elegir cliente…</option>' +
        ordenarPorNombre(state.data.clientes).map(function (c) {
          return '<option value="' + esc(c.id) + '">' + esc(c.nombre) + '</option>';
        }).join('') +
        '</select></label>' +
        '<a class="btn ghost block" href="#/equipos/' + seg(eq.id) + '">Editar</a></article>';
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
      htmlDesglose(cliente) +
      '<a class="btn primary block" href="#/clientes/' + seg(cliente.id) + '/pago">Registrar pago</a>' +
      '<a class="btn ghost block" href="#/clientes/' + seg(cliente.id) + '/editar">Editar cliente</a>' +
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
      '<p class="ayuda">Exento de pago deja la mensualidad en $0. No sale como vencido ni en por cobrar, y el pago no abre WhatsApp.</p>' +
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
    var exento = CP.esExento(cliente);
    var fecha = hoyISO();
    var monto = mensual;
    return htmlVolver('#/clientes/' + seg(cliente.id), cliente.nombre) +
      '<h1>Registrar pago</h1>' +
      htmlDesglose(cliente) +
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
      '<h2>En el teléfono</h2>' +
      '<p class="ayuda">Chrome → menú → Instalar aplicación, o Agregar a pantalla principal. Sin señal se abre la última copia, solo para consultar.</p>' +
      (state.cacheEn ? '<p class="ayuda">Última copia en línea: ' + esc(state.cacheEn) + '</p>' : '');
  }

  function htmlResumen(grande) {
    var r = CP.resumen(state.data, new Date());
    if (!grande) {
      return '<p class="resumen-mini"><strong class="num">' + r.clientes + '</strong> clientes · <strong class="num">' + esc(dinero(r.porCobrar)) + '</strong> por cobrar · <strong class="num">' + r.vencidos + '</strong> vencidos</p>';
    }
    return '<section class="stats" aria-label="Resumen">' +
      '<article class="stat"><p class="stat-num num">' + r.clientes + '</p><p class="stat-label">Clientes</p></article>' +
      '<article class="stat money"><p class="stat-num num">' + esc(dinero(r.porCobrar)) + '</p><p class="stat-label">Por cobrar este mes</p></article>' +
      '<article class="stat' + (r.vencidos ? ' alerta' : '') + '"><p class="stat-num num">' + r.vencidos + '</p><p class="stat-label">Vencidos</p></article>' +
      '</section>';
  }

  function htmlFiltroAreas() {
    var areas = areasUnicas();
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
      return '<li>' + htmlClienteLink(c) + '</li>';
    }).join('') + '</ul>';
  }

  function htmlClienteLink(c) {
    var estado = CP.estadoDeCliente(c, new Date());
    var n = CP.equiposDeCliente(state.data.dispositivos, c.id).length;
    var total = CP.mensualidadCliente(c, state.data.dispositivos);
    return '<a class="item" href="#/clientes/' + seg(c.id) + '">' +
      '<span class="item-main"><strong>' + esc(c.nombre) + '</strong>' +
      '<span class="muted">' + esc(c.area || 'Sin área') + ' · ' + n + (n === 1 ? ' equipo' : ' equipos') +
      (c.promo === 'SI' ? ' · Promo' : '') + '</span></span>' +
      '<span class="item-side">' + htmlChip(estado) + '<strong class="num">' + esc(dinero(total)) + '</strong></span></a>';
  }

  function htmlChip(estado) {
    var clase = { al_corriente: 'ok', por_vencer: 'warn', vencido: 'bad', exento: 'mute' }[estado.clave] || 'mute';
    return '<span class="chip ' + clase + '">' + esc(estado.etiqueta) + '</span>';
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

  function htmlEquipoCard(eq, href) {
    return '<article class="card"><h3>' + esc(eq.tipo) + '</h3>' + htmlModelo(eq) +
      '<p class="mac num">' + esc(eq.mac) + '</p>' +
      (eq.notas ? '<p class="muted">' + esc(eq.notas) + '</p>' : '') +
      '<div class="fila-botones"><a class="btn ghost" href="' + href + '">Editar</a>' +
      '<button type="button" class="btn danger" data-action="borrar-equipo" data-id="' + esc(eq.id) + '">Borrar</button></div></article>';
  }

  function htmlHistorial(clienteId) {
    var pagos = pagosDe(clienteId);
    if (!pagos.length) return '<p class="vacio">Todavía no hay pagos.</p>';
    return '<ul class="lista">' + pagos.map(function (p) {
      var meses = Number(p.meses) || 0;
      return '<li class="item"><span class="item-main"><strong class="num">' + esc(dinero(p.monto)) + '</strong>' +
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
    if (action === 'ver-clave') {
      e.preventDefault();
      var input = document.querySelector('#form-ajustes [name="clave"]');
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
    if (id !== 'form-cliente' && id !== 'form-equipo' && id !== 'form-pago' && id !== 'form-ajustes') return;
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
    }
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
    boton.disabled = guardando || state.soloLectura;
    if (guardando) boton.textContent = 'Guardando…';
    else if (idFormulario(form) === 'form-pago') {
      var clientePago = buscarCliente(val(form, 'cliente_id'));
      boton.textContent = clientePago && CP.esExento(clientePago) ? 'Guardar pago' : 'Guardar pago y abrir WhatsApp';
    }
    else boton.textContent = 'Guardar';
  }

  function persistirCliente(cliente) {
    if (state.modo === 'demo') {
      var guardado = CP.fusionarCliente(buscarCliente(cliente.id), cliente);
      if (!guardado.id) guardado.id = cliente.id;
      state.data.clientes = upsert(state.data.clientes, guardado);
      guardarDemo();
      return Promise.resolve(guardado);
    }
    return api('upsertCliente', { cliente: cliente }).then(function (res) {
      var guardado = normalizarRemoto({ clientes: [res.cliente] }).clientes[0];
      state.data.clientes = upsert(state.data.clientes, guardado);
      guardarCache(state.data);
      return guardado;
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
    state.guardando = true;
    return api('upsertDispositivo', { dispositivo: dispositivo }).then(function (res) {
      var guardado = normalizarRemoto({ dispositivos: [res.dispositivo] }).dispositivos[0];
      despues(guardado, res.advertencia);
    }).catch(function (err) {
      state.guardando = false;
      toast(mensaje(err));
    });
  }

  function asignarEquipo(id, clienteId) {
    if (state.soloLectura) return Promise.reject(new Error('Sin conexión. No se puede guardar.'));
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
    return api('upsertDispositivo', { dispositivo: copia }).then(function (res) {
      var guardado = normalizarRemoto({ dispositivos: [res.dispositivo] }).dispositivos[0];
      state.data.dispositivos = upsert(state.data.dispositivos, guardado);
      guardarCache(state.data);
      var dueno = buscarCliente(guardado.cliente_id);
      toast('Asignado a ' + (dueno ? dueno.nombre : 'cliente') + '.');
      render();
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
    if (state.soloLectura) return Promise.reject(new Error('Sin conexión. No se puede guardar.'));
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
    return api('deleteDispositivo', { id: id }).then(listo);
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
    return api('registrarPago', { pago: entrada }).then(function (res) {
      var cliente = normalizarRemoto({ clientes: [res.cliente] }).clientes[0];
      var pago = normalizarRemoto({ pagos: [res.pago] }).pagos[0];
      state.data.clientes = upsert(state.data.clientes, cliente);
      state.data.pagos = upsert(state.data.pagos, pago);
      guardarCache(state.data);
      return { pago: pago, cliente: cliente };
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
    form.elements.monto.value = String(CP.mensualidadCliente(cliente, state.data.dispositivos) * meses);
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
    if (!state.soloLectura) return false;
    toast('Sin conexión. No se puede guardar.');
    return true;
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

  function clientesFiltrados() {
    return ordenarPorNombre(state.data.clientes.filter(function (c) {
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

  function areasUnicas() {
    var set = {};
    state.data.clientes.forEach(function (c) { if (c.area) set[c.area] = true; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'es-MX'); });
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
