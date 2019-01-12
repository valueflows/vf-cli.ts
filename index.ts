import { safeLoad } from 'js-yaml'
import { readFileSync } from 'fs'
import memdown from 'memdown'
import { RdfStore } from 'quadstore'
// import { Parser } from '@rdfjs/parser-jsonld'
const ParserJsonld = require('@rdfjs/parser-jsonld')
import { Readable, finished } from 'stream'
import { promisify } from 'util'
const done = promisify(finished)
const meow = require('meow')
const nn = require('@rdfjs/data-model').namedNode

const cli = meow('', {
  flags: {
    track: {
      type: 'string',
      alias: 't'
    }
  }
})

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

// import data from YAML file to quadstore

const data = safeLoad(readFileSync(cli.input[0], 'utf8'))
const store = new RdfStore(memdown())
const input = new Readable({
  read: () => {
    input.push(JSON.stringify(data))
    input.push(null)
  }
})
const parserJsonld = new ParserJsonld()
const output = parserJsonld.import(input)

async function match (subject, predicate, object, graph = null) {
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

async function outNodes (subject, predicate) {
  return objects(await match(subject, predicate, null))
}

async function inNodes (object, predicate) {
  return subjects(await match(null, predicate, object))
}

const visited = []
async function track (iri, level = 0) {
  if (visited.includes(iri)) return
  visited.push(iri)
  const types = await outNodes(iri, ns.rdf('type'))
  if (types.includes(ns.vf('EconomicResource'))) {
    console.log(pad('📦 ', level), iri)
    // find events affecting it
    const events = await inNodes(iri, ns.vf('affects')) 
    for (let event of events) await track(event, level + 1)
  }
  if (types.includes(ns.vf('Process'))) {
    console.log(pad('🌀 ', level), iri)
    // find events
    const events = await inNodes(iri, ns.vf('outputOf'))
    for (let event of events) await track(event, level + 1)
  }
  if (types.includes(ns.vf('EconomicEvent'))) {
    // find processes taking it as input
    const inputToProcesses = await outNodes(iri, ns.vf('inputOf'))
    console.log(pad('🔹 ', level), iri)
    for (let process of inputToProcesses) await track(process, level + 1)
    // find affected resources only if process takes it as an output
    const outputToProcesses = await outNodes(iri, ns.vf('outputOf'))
    if (outputToProcesses.length) {
      const resources = await outNodes(iri, ns.vf('affects'))
      for (let resource of resources) await track(resource, level +1)
    }
  }
}

;(async () => {
  await done(store.import(output))
  console.log('data imported to store')
  await track(cli.flags.track)
})()
