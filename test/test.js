#!/usr/bin/env node
// const exchange = require('./src/cceb-exchange-test.js')

 const eth = require('./src/cceb-eth-test.js')

// const ledger = require('./src/cceb-ledger-test.js')

;(async () => {
  //  exchange.runTest()
   eth.runTest()
  // ledger.runTest()
})()
