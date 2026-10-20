/* Datos ficticios para probar la app sin Google Sheet. No son clientes reales. */
(function (root) {
  var CP = root.CP;

  function iso(fecha) {
    return CP.formatISO(fecha);
  }

  function sumarDias(base, dias) {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
  }

  function datosDemo(ahora) {
    var hoy = CP.inicioDeDia(ahora || new Date());
    var alCorriente = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 15);
    var porVencer = sumarDias(hoy, 3);
    var vencido = sumarDias(hoy, -18);
    var pagoMariana = new Date(alCorriente.getFullYear(), alCorriente.getMonth() - 1, 10);
    var pagoJose = sumarDias(porVencer, -30);
    var pagoLucia = sumarDias(vencido, -30);

    return {
      clientes: [
        {
          id: 'c_mariana',
          nombre: 'Mariana Solís',
          celular: '5500000001',
          area: 'Centro',
          promo: 'SI',
          fecha_ultimo_pago: iso(pagoMariana),
          proximo_vencimiento: iso(alCorriente),
          meses_pagados: 4,
          notas: 'Ejemplo. Promo de dos equipos.'
        },
        {
          id: 'c_jose',
          nombre: 'José Ramírez',
          celular: '5500000002',
          area: 'Centro',
          promo: 'NO',
          fecha_ultimo_pago: iso(pagoJose),
          proximo_vencimiento: iso(porVencer),
          meses_pagados: 2,
          notas: 'Ejemplo. Vence en pocos días.'
        },
        {
          id: 'c_lucia',
          nombre: 'Lucía Hernández',
          celular: '5500000003',
          area: 'San Pedro',
          promo: 'NO',
          fecha_ultimo_pago: iso(pagoLucia),
          proximo_vencimiento: iso(vencido),
          meses_pagados: 1,
          notas: 'Ejemplo. Pago atrasado.'
        },
        {
          id: 'c_pedro',
          nombre: 'Pedro Gómez',
          celular: '5500000004',
          area: 'Ejido Norte',
          promo: 'NO',
          fecha_ultimo_pago: '',
          proximo_vencimiento: '',
          meses_pagados: 0,
          notas: 'Ejemplo. Cliente nuevo, todavía sin pago.'
        }
      ],
      dispositivos: [
        { id: 'd_mariana_cel', cliente_id: 'c_mariana', tipo: 'Celular', modelo: 'Samsung A14', mac: 'AA-BB-CC-DD-EE-01', notas: '' },
        { id: 'd_mariana_ipad', cliente_id: 'c_mariana', tipo: 'iPad', modelo: 'iPad 9', mac: 'AA-BB-CC-DD-EE-02', notas: '' },
        { id: 'd_jose_tv', cliente_id: 'c_jose', tipo: 'TV Smart', modelo: 'Hisense 43', mac: 'AA-BB-CC-DD-EE-03', notas: '' },
        { id: 'd_lucia_cel', cliente_id: 'c_lucia', tipo: 'Celular', modelo: 'Moto G14', mac: 'AA-BB-CC-DD-EE-04', notas: '' },
        { id: 'd_lucia_tab', cliente_id: 'c_lucia', tipo: 'Tablet', modelo: 'Lenovo Tab', mac: 'AA-BB-CC-DD-EE-05', notas: '' },
        { id: 'd_lucia_pc', cliente_id: 'c_lucia', tipo: 'PC', modelo: 'Dell escritorio', mac: 'AA-BB-CC-DD-EE-06', notas: '' },
        { id: 'd_pedro_cel', cliente_id: 'c_pedro', tipo: 'Celular', modelo: 'Redmi Note', mac: 'AA-BB-CC-DD-EE-07', notas: '' },
        { id: 'd_libre_tv', cliente_id: '', tipo: 'TV Smart', modelo: 'Roku Express', mac: 'AA-BB-CC-DD-EE-08', notas: 'Ejemplo sin asignar' },
        { id: 'd_libre_otro', cliente_id: '', tipo: 'Otro', modelo: 'Repetidor', mac: 'AA-BB-CC-DD-EE-09', notas: 'Ejemplo sin asignar' }
      ],
      pagos: [
        {
          id: 'p_mariana_1',
          cliente_id: 'c_mariana',
          fecha: iso(pagoMariana),
          monto: 50,
          meses: 1,
          cubre_hasta: iso(alCorriente),
          registrado_por: 'Dueño'
        },
        {
          id: 'p_jose_1',
          cliente_id: 'c_jose',
          fecha: iso(pagoJose),
          monto: 30,
          meses: 1,
          cubre_hasta: iso(porVencer),
          registrado_por: 'Ayudante'
        },
        {
          id: 'p_lucia_1',
          cliente_id: 'c_lucia',
          fecha: iso(pagoLucia),
          monto: 90,
          meses: 1,
          cubre_hasta: iso(vencido),
          registrado_por: 'Dueño'
        }
      ]
    };
  }

  root.CPDemo = { datosDemo: datosDemo };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.CPDemo;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
