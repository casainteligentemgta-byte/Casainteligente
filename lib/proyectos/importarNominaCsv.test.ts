import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizarRolNomina, parsearNominaCsv } from './importarNominaCsv'
import { PLANTILLA_CSV_NOMINA } from './plantillaNominaCsv'

describe('nómina por CSV', () => {
  it('lee la plantilla', () => {
    const { filas, errores } = parsearNominaCsv(PLANTILLA_CSV_NOMINA)
    assert.equal(errores.length, 0)
    assert.equal(filas.length, 2)
    assert.deepEqual(
      { ...filas[0], linea: 0 },
      { linea: 0, nombre: 'Pedro Pérez', cedula: 'V-12345678', rol: 'depositario', categoria: 'empleado', telefono: '0414-1234567', email: null, chatId: null, notas: 'Celular de la empresa' },
    )
    assert.equal(filas[1].categoria, 'obrero')
  })

  it('acepta comas, comillas, encabezados con acentos y orden distinto; deduce la categoría', () => {
    const csv = '﻿Cargo,Nombre y apellido,Cédula,Celular\n"Ingeniero residente","Gómez, Ana",12.345.678,+58 412 555 0000\nPeón,Luis,,\n,Sin rol,,\n'
    const { filas, errores } = parsearNominaCsv(csv)
    assert.equal(filas.length, 2)
    assert.equal(filas[0].nombre, 'Gómez, Ana')
    assert.equal(filas[0].rol, 'ingeniero_residente')
    assert.equal(filas[0].cedula, 'V-12345678')
    assert.equal(filas[0].categoria, 'empleado')
    assert.equal(filas[1].rol, 'peon')
    assert.equal(filas[1].categoria, 'obrero')
    assert.equal(errores.length, 1)
    assert.match(errores[0].error, /sin rol/)
  })

  it('exige nombre y rol en el encabezado', () => {
    assert.match(parsearNominaCsv('cedula;telefono\n1;2').errores[0].error, /nombre/)
  })

  it('roles de aplicación y sinónimos', () => {
    assert.equal(normalizarRolNomina('Comprador'), 'comprador')
    assert.equal(normalizarRolNomina('Almacenista'), 'depositario')
    assert.equal(normalizarRolNomina('Logística'), 'logistica')
    assert.equal(normalizarRolNomina('PM'), 'pm_obra')
  })
})
