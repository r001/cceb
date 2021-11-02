const rewiremock = require('../rewiremock.js')
const yaml = require('js-yaml');
var fs = require('fs')
var assert = require('assert')

  var called = 0

rewiremock('../../utils/web3.js').with({
  'access':  async (to, funcName, args = [], abi, from, value, gasLimit, gasPrice, inputs, multipleUse) => { 

    const config = yaml.load(fs.readFileSync('../../config/default.yaml', 'utf-8'))

    switch (called) {
      case 0:
        assert.equal(to, 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER')
        called ++
        return 'lendingPoolName'
      case 1:
        assert.equal(to, 'lendingPoolName')
        assert.equal(args[0], 'ETH') // token
        assert.equal(args[1], '10000000000000000000') //borrow amount
        assert.equal(args[2], 2) // interestRateMode
        assert.equal(args[3], ) // referral code
        assert.equal(args[4], 'AAVE_LENDING_POOL') // abi
        assert.equal(args[4], config.web3.defaultFrom) // from address
        return ''
      default:
        return 'error'
    }
  }
})

rewiremock.enable()
const cceb = require('../../cceb')

function runTest () {
  describe('Ethereum tests', async () => { 
    describe('aaveBorrow', async () => { 
      it('Borrow 10 ETH from Aave with variable rate `cceb eth aave borrow 10 ETH`', async () => {
        await aaveBorrowTest('cceb eth aave borrow 12 ETH')
      })
    })
  })
}

async function parseArgs (cmdAndArgs) {
  const cmd = cmdAndArgs.slice(0, 5)
  const args = cmdAndArgs.slice(5)
  assert.equal('cceb ', cmd)
  return cceb.argParse().parseArgs(args.split(" "))
}

async function aaveBorrowTest (cmdAndArgs) {
        const args = await parseArgs(cmdAndArgs) 
        const aaveBorrow = await cceb.aaveBorrow(args.amount, args.token, args.fixed, args.from) 
        assert.equal(aaveBorrow, '')
}
module.exports = {runTest}
