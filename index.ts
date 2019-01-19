import { safeLoad } from 'js-yaml'
import { readFileSync } from 'fs'
import memdown from 'memdown'
import { RdfStore } from 'quadstore'
const ParserJsonld = require('@rdfjs/parser-jsonld')
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

;(async () => {
  await done(store.import(output))
  console.log('data imported to store')
  if (cli.flags.track) {
    await track(store, cli.flags.track)
  }
  if (cli.flags.trace) {
    await trace(store, cli.flags.trace)
  }
})()
