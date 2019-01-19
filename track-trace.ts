import { finished } from 'stream'
import { promisify } from 'util'
const done = promisify(finished)
const nn = require('@rdfjs/data-model').namedNode
const namespace = require('@rdfjs/namespace')

function pad (string, count) {
  let prefix = ''
  for (let i = 0; i < count; i++) {
    prefix += ' '
  }
  return prefix + string
}

const ns = {
  vf: namespace('https://w3id.org/valueflows#'),
  rdf: namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#')
}

function subjects (quads) {
  return quads.map(quad => quad.subject)
}

function objects (quads) {
  return quads.map(quad => quad.object)
}

async function match (store, subject = null, predicate = null, object = null, graph = null) {
  const results = []
  await done(
    store.match(subject, predicate, object, graph)
      .on('data', (quad) => { results.push(quad) })
  )
  return results
}

// TODO: use https://github.com/rdf-ext/clownface

async function outNodes (store, subject, predicate) {
  return objects(await match(store, subject, predicate, null))
}

async function inNodes (store, object, predicate) {
  return subjects(await match(store, null, predicate, object))
}

const visited = []
export async function track (store, current, level = 0) {
  if (!current.termType) current = nn(current)
  if (visited.some(node => node.equals(current))) return
  visited.push(current)
  const types = await outNodes(store, current, ns.rdf('type'))
  if (types.some(node => node.equals(ns.vf('EconomicResource')))) {
    console.log(pad('📦 ', level), current.value)
    // find events affecting it
    const events = await inNodes(store, current, ns.vf('affects')) 
    for (let event of events) await track(store, event, level + 1)
  }
  if (types.some(node => node.equals(ns.vf('Process')))) {
    console.log(pad('🌀 ', level), current.value)
    // find events
    const events = await inNodes(store, current, ns.vf('outputOf'))
    for (let event of events) await track(store, event, level + 1)
  }
  if (types.some(node => node.equals(ns.vf('EconomicEvent')))) {
    // find processes taking it as input
    const inputToProcesses = await outNodes(store, current, ns.vf('inputOf'))
    console.log(pad('🔹 ', level), current.value)
    for (let process of inputToProcesses) await track(store, process, level + 1)
    // find affected resources only if process takes it as an output
    const outputToProcesses = await outNodes(store, current, ns.vf('outputOf'))
    if (outputToProcesses.length) {
      const resources = await outNodes(store, current, ns.vf('affects'))
      for (let resource of resources) await track(store, resource, level + 1)
    }
  }
}

export async function trace (store, current, level = 0) {
  if (!current.termType) current = nn(current)
  if (visited.some(node => node.equals(current))) return
  visited.push(current)
  const types = await outNodes(store, current, ns.rdf('type'))
  if (types.some(node => node.equals(ns.vf('EconomicResource')))) {
    console.log(pad('📦 ', level), current.value)
    // find events affecting it
    const events = await inNodes(store, current, ns.vf('affects')) 
    for (let event of events) await trace(store, event, level + 1)
  }
  if (types.some(node => node.equals(ns.vf('Process')))) {
    console.log(pad('🌀 ', level), current.value)
    // find events
    const events = await inNodes(store, current, ns.vf('inputOf'))
    for (let event of events) await trace(store, event, level + 1)
  }
  if (types.some(node => node.equals(ns.vf('EconomicEvent')))) {
    console.log(pad('🔹 ', level), current.value)
    // find processes taking it as output
    const outputToProcesses = await outNodes(store, current, ns.vf('outputOf'))
    for (let process of outputToProcesses) await trace(store, process, level + 1)
    // find affected resources only if process takes it as an input
    const inputToProcesses = await outNodes(store, current, ns.vf('inputOf'))
    if (inputToProcesses.length) {
      const resources = await outNodes(store, current, ns.vf('affects'))
      for (let resource of resources) await trace(store, resource, level +1)
    }
  }
}
