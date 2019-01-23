declare module 'quadstore' {
  import { AbstractLevelDOWN } from 'abstract-leveldown'
  import { Term, Source, Stream, Quad } from 'rdf-js'
  export class RdfStore implements Source {
    constructor(abstractLevelDown :AbstractLevelDOWN, options ?:any)
    match(subject ?:Term, predicate ?:Term, object ?:Term, graph ?:Term) :Stream<Quad>
    import(stream: Stream<Quad>): Readable
  }
} 
