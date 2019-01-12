# vf-cli

ValueFlows CLI

Clone this repository and then either ```yarn install``` or ```npm install```

## Track & Trace

https://www.valueflo.ws/appendix/track.html

Currently it loads data from YAML file and tracks or traces starting from specific IRI

```bash
yarn start --track=https://alice.example/3584c5eb-5b15-4c71-853e-0470fc34bbcb ../valueflows/examples/service.yaml
```

```bash
yarn start --trace=https://jesus.example/be1dbb7d-ef4b-4e7e-8685-3e218dcd2d0d ../valueflows/examples/service.yaml
```

## TODO

* [ ] extract track & trace into separate module