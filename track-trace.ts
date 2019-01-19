import { finished } from 'stream'
import { promisify } from 'util'
const done = promisify(finished)
const nn = require('@rdfjs/data-model').namedNode

function pad (string, count) {
  let prefix = ''
  for (let i = 0; i < count; i++) {
    prefix += ' '
  }
  return prefix + string
}

const ns = {
  vf (term) {
    return `https://w3id.org/valueflows#${term}`
  },
  rdf (term) {
    return `http://www.w3.org/1999/02/22-rdf-syntax-ns#${term}`
  }
}

function subjects (quads) {
  return quads.map(quad => quad.subject.value)
}

function objects (quads) {
  return quads.map(quad => quad.object.value)
}

async function match (store, subject, predicate, object, graph = null) {
  if (subject) subject = nn(subject)
  if (predicate) predicate = nn(predicate)
  if (object) object = nn(object)
  if (graph) graph = nn(graph)
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
export async function track (store, iri, level = 0) {
  if (visited.includes(iri)) return
  visited.push(iri)
  const types = await outNodes(store, iri, ns.rdf('type'))
  if (types.includes(ns.vf('EconomicResource'))) {
    console.log(pad('📦 ', level), iri)
    // find events affecting it
    const events = await inNodes(store, iri, ns.vf('affects')) 
    for (let event of events) await track(store, event, level + 1)
  }
  if (types.includes(ns.vf('Process'))) {
    console.log(pad('🌀 ', level), iri)
    // find events
    const events = await inNodes(store, iri, ns.vf('outputOf'))
    for (let event of events) await track(store, event, level + 1)
  }
  if (types.includes(ns.vf('EconomicEvent'))) {
    // find processes taking it as input
    const inputToProcesses = await outNodes(store, iri, ns.vf('inputOf'))
    console.log(pad('🔹 ', level), iri)
    for (let process of inputToProcesses) await track(store, process, level + 1)
    // find affected resources only if process takes it as an output
    const outputToProcesses = await outNodes(store, iri, ns.vf('outputOf'))
    if (outputToProcesses.length) {
      const resources = await outNodes(store, iri, ns.vf('affects'))
      for (let resource of resources) await track(store, resource, level + 1)
    }
  }
}

export async function trace (store, iri, level = 0) {
  if (visited.includes(iri)) return
  visited.push(iri)
  const types = await outNodes(store, iri, ns.rdf('type'))
  if (types.includes(ns.vf('EconomicResource'))) {
    console.log(pad('📦 ', level), iri)
    // find events affecting it
    const events = await inNodes(store, iri, ns.vf('affects')) 
    for (let event of events) await trace(store, event, level + 1)
  }
  if (types.includes(ns.vf('Process'))) {
    console.log(pad('🌀 ', level), iri)
    // find events
    const events = await inNodes(store, iri, ns.vf('inputOf'))
    for (let event of events) await trace(store, event, level + 1)
  }
  if (types.includes(ns.vf('EconomicEvent'))) {
    console.log(pad('🔹 ', level), iri)
    // find processes taking it as output
    const outputToProcesses = await outNodes(store, iri, ns.vf('outputOf'))
    for (let process of outputToProcesses) await trace(store, process, level + 1)
    // find affected resources only if process takes it as an input
    const inputToProcesses = await outNodes(store, iri, ns.vf('inputOf'))
    if (inputToProcesses.length) {
      const resources = await outNodes(store, iri, ns.vf('affects'))
      for (let resource of resources) await trace(store, resource, level +1)
    }
  }
}