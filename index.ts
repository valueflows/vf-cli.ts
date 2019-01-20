import { safeLoad } from 'js-yaml'
import { readFileSync } from 'fs'
import memdown from 'memdown'
import { RdfStore } from 'quadstore'
const ParserJsonld = require('@rdfjs/parser-jsonld')
const namespace = require('@rdfjs/namespace')
import { Readable, finished } from 'stream'
import { promisify } from 'util'
const done = promisify(finished)
const meow = require('meow')

import { track, trace } from './track-trace'

const cli = meow('', {
  flags: {
    track: {
      type: 'string',
      alias: 't'
    }
  }
})

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

function pad (string, count) {
  let prefix = ''
  for (let i = 0; i < count; i++) {
    prefix += ' '
  }
  return prefix + string
}

const vf = namespace('https://w3id.org/valueflows#')
function log (node) {
  let emoji = '⛔'
  if (node.type.equals(vf('EconomicResource'))) emoji = '📦'
  if (node.type.equals(vf('EconomicEvent'))) emoji = '🔹'
  if (node.type.equals(vf('Process'))) emoji = '🌀'
  console.log(pad(`${emoji} `, node.distance), node.iri)
}

;(async () => {
  await done(store.import(output))
  console.log('data imported to store')
  if (cli.flags.track) {
    for await (const node of track(store, cli.flags.track)) {
      log(node)
    }
  }
  if (cli.flags.trace) {
    for await (const node of trace(store, cli.flags.trace)) {
      log(node)
    }
  }
})()
