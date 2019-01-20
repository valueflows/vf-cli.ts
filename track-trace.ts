import { finished } from 'stream'
import { promisify } from 'util'
const done = promisify(finished)
const nn = require('@rdfjs/data-model').namedNode
const namespace = require('@rdfjs/namespace')

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

export async function * track (store, iri) {
  if (!iri.termType) iri = nn(iri)
  const visited = []
  yield * await tracker(store, visited, iri)
}

async function * tracker (store, visited, current, distance = 0) {
  if (visited.some(node => node.equals(current))) return
  visited.push(current)
  const types = await outNodes(store, current, ns.rdf('type'))
  if (types.some(node => node.equals(ns.vf('EconomicResource')))) {
    yield {
      type: ns.vf('EconomicResource'),
      iri: current.value,
      distance
    }
    // find events affecting it
    const events = await inNodes(store, current, ns.vf('affects')) 
    for (let event of events) yield * await tracker(store, visited, event, distance + 1)
  }
  if (types.some(node => node.equals(ns.vf('Process')))) {
    yield {
      type: ns.vf('Process'),
      iri: current.value,
      distance
    }
    // find events
    const events = await inNodes(store, current, ns.vf('outputOf'))
    for (let event of events) yield * await tracker(store, visited, event, distance + 1)
  }
  if (types.some(node => node.equals(ns.vf('EconomicEvent')))) {
    yield {
      type: ns.vf('EconomicEvent'),
      iri: current.value,
      distance
    }
    // find processes taking it as input
    const inputToProcesses = await outNodes(store, current, ns.vf('inputOf'))
    for (let process of inputToProcesses) yield * await tracker(store, visited, process, distance + 1)
    // find affected resources only if process takes it as an output
    const outputToProcesses = await outNodes(store, current, ns.vf('outputOf'))
    if (outputToProcesses.length) {
      const resources = await outNodes(store, current, ns.vf('affects'))
      for (let resource of resources) yield * await tracker(store, visited, resource, distance + 1)
    }
  }
}

export async function * trace (store, iri) {
  if (!iri.termType) iri = nn(iri)
  const visited = []
  yield * await tracer(store, visited, iri)
}

async function * tracer (store, visited, current, distance = 0) {
  if (visited.some(node => node.equals(current))) return
  visited.push(current)
  const types = await outNodes(store, current, ns.rdf('type'))
  if (types.some(node => node.equals(ns.vf('EconomicResource')))) {
    yield {
      type: ns.vf('EconomicResource'),
      iri: current.value,
      distance
    }
    // find events affecting it
    const events = await inNodes(store, current, ns.vf('affects')) 
    for (let event of events) yield * await tracer(store, visited, event, distance + 1)
  }
  if (types.some(node => node.equals(ns.vf('Process')))) {
    yield {
      type: ns.vf('Process'),
      iri: current.value,
      distance
    }
    // find events
    const events = await inNodes(store, current, ns.vf('inputOf'))
    for (let event of events) yield * await tracer(store, visited, event, distance + 1)
  }
  if (types.some(node => node.equals(ns.vf('EconomicEvent')))) {
    yield {
      type: ns.vf('EconomicEvent'),
      iri: current.value,
      distance
    }
    // find processes taking it as output
    const outputToProcesses = await outNodes(store, current, ns.vf('outputOf'))
    for (let process of outputToProcesses) yield * await tracer(store, visited, process, distance + 1)
    // find affected resources only if process takes it as an input
    const inputToProcesses = await outNodes(store, current, ns.vf('inputOf'))
    if (inputToProcesses.length) {
      const resources = await outNodes(store, current, ns.vf('affects'))
      for (let resource of resources) yield * await tracer(store, visited, resource, distance +1)
    }
  }
}
