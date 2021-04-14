const rewiremock = require('../rewiremock.js')
const yaml = require('js-yaml');
var fs = require('fs')
var assert = require('assert')

var called = 0

rewiremock('../../utils/web3.js')
  .with({
    access: accessMock1, // override w3.access method in cceb
    decimals: decimals,
  })

const config = yaml.load(fs.readFileSync('./config/default.yaml', 'utf-8'))
const secConfig = yaml.load(fs.readFileSync('./config/secrets/default.yaml', 'utf-8'))

var checkData = { }

async function decimals (token) {
  switch (token) {
    case 'WBTC':
      return 8
    case 'USDC':
      return 6
    case 'USDT':
      return 6
    default:
      return 18
  }
}

async function accessMock1 (
  to,
  funcName,
  args = [],
  abi,
  from,
  value,
  gaslimit,
  gasprice,
  inputs,
  multipleUse) { 


  switch (called) {
    case 0:
      assert.equal(checkData.to[0], to)
      called ++
      return 'lendingPoolName'
    case 1:
      assert.equal(checkData.to[1], to)
      assert.equal(checkData.token, args[0]) // token
      assert.equal(checkData.borrowAmt, args[1]) //borrow amount
      assert.equal(checkData.interestRateMode, args[2]) // interestRateMode
      assert.equal(checkData.referralCode, args[3]) // referral code
      assert.equal(checkData.abi, abi) // abi
      assert.equal(checkData.from, from) // from address
      assert.equal(checkData.gaslimit, gaslimit)
      assert.equal(checkData.gasprice, gasprice)
      assert.equal(checkData.inputs, inputs)
      assert.equal(checkData.multipleUse, multipleUse)
      return ''
    default:
      assert.equal(true, false) // we should not end up here
      return 'error'
  }
}

rewiremock.enable()
const cceb = require('../../cceb')

async function parseArgs (cmdAndArgs) {
  const cmd = cmdAndArgs.slice(0, 5)
  const args = cmdAndArgs.slice(5)
  assert.equal('cceb ', cmd)
  return cceb.argParse().parseArgs(args.split(" "))
}

async function aaveBorrowTest (cmdAndArgs, expected) {

  const args = await parseArgs(cmdAndArgs) 

  checkData = expected
  const aaveBorrow = await cceb.aaveBorrow(args.amount, args.token, args.fixed, args.from, args.gaslimit, args.gasprice) 
  assert.equal(aaveBorrow, '')
  return aaveBorrow
}

function runTest () {


  describe('Ethereum tests',  () => { 
    describe('aaveBorrow',  () => { 

      beforeEach(() => {
        called = 0 
      })

      it('Borrow 12 ETH from Aave with variable rate', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'ETH',
          borrowAmt: '12000000000000000000',
          interestRateMode: 2,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth aave borrow 12 ETH', expected)
      })

      it('Borrow 0.12 ETH from Aave with variable rate', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'ETH',
          borrowAmt: '120000000000000000',
          interestRateMode: 2,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth aave borrow 0.12 ETH', expected)
      })

      it('Borrow 0.17 MKR from Aave with variable rate', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'MKR',
          borrowAmt: '170000000000000000',
          interestRateMode: 2,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth aave borrow 0.17 MKR', expected)
      })

      it('Borrow 0.17 WBTC from Aave with variable rate', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'WBTC',
          borrowAmt: '17000000',
          interestRateMode: 2,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth aave borrow 0.17 WBTC', expected)
      })

      it('Borrow 12 ETH from Aave with fixed rate', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'ETH',
          borrowAmt: '12000000000000000000',
          interestRateMode: 1,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth aave borrow --fixed 12 ETH', expected)
      })

      it('Borrow 0.12 ETH from Aave with fixed rate', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'ETH',
          borrowAmt: '120000000000000000',
          interestRateMode: 1,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth aave borrow --fixed 0.12 ETH', expected)
      })

      it('Borrow 0.17 MKR from Aave with fixed rate', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'MKR',
          borrowAmt: '170000000000000000',
          interestRateMode: 1,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth aave borrow --fixed 0.17 MKR', expected)
      })

      it('Borrow 0.17 WBTC from Aave with fixed rate', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'WBTC',
          borrowAmt: '17000000',
          interestRateMode: 1,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth aave borrow --fixed 0.17 WBTC', expected)
      })

      it('Borrow 12 ETH from Aave with fixed rate from address ETH-1', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'ETH',
          borrowAmt: '12000000000000000000',
          interestRateMode: 1,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-1',
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth --from ETH-1 aave borrow --fixed 12 ETH', expected)
      })

      it('Borrow 0.12 ETH from Aave with fixed rate from address ETH-1', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'ETH',
          borrowAmt: '120000000000000000',
          interestRateMode: 1,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-1',
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth --from ETH-1 aave borrow --fixed 0.12 ETH', expected)
      })

      it('Borrow 0.17 MKR from Aave with fixed rate from address ETH-1', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'MKR',
          borrowAmt: '170000000000000000',
          interestRateMode: 1,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-1',
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth --from ETH-1 aave borrow --fixed 0.17 MKR', expected)
      })

      it('Borrow 0.17 WBTC from Aave with fixed rate from address ETH-1', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'WBTC',
          borrowAmt: '17000000',
          interestRateMode: 1,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-1',
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth --from ETH-1 aave borrow --fixed 0.17 WBTC', expected)
      })

      it('Borrow 12 ETH from Aave with variable rate with given gas limit of 1234567', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'ETH',
          borrowAmt: '12000000000000000000',
          interestRateMode: 2,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: '1234567',
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth --gas-limit 1234567 aave borrow 12 ETH', expected)
      })

      it('Borrow 0.12 ETH from Aave with variable rate with given gas limit of 1234567', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'ETH',
          borrowAmt: '120000000000000000',
          interestRateMode: 2,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: '1234567',
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth --gas-limit 1234567 aave borrow 0.12 ETH', expected)
      })

      it('Borrow 0.17 MKR from Aave with variable rate with given gas limit of 1234567', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'MKR',
          borrowAmt: '170000000000000000',
          interestRateMode: 2,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: '1234567',
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth --gas-limit 1234567 aave borrow 0.17 MKR', expected)
      })

      it('Borrow 0.17 WBTC from Aave with variable rate with given gas limit of 1234567', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'WBTC',
          borrowAmt: '17000000',
          interestRateMode: 2,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: '1234567',
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth --gas-limit 1234567 aave borrow 0.17 WBTC', expected)
      })

      it('Borrow 12 ETH from Aave with variable rate with given gas price of 765431 with given gas limit of 1234567', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'ETH',
          borrowAmt: '12000000000000000000',
          interestRateMode: 2,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: '1234567',
          gasprice: '765431',
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth --gas-price 765431 --gas-limit 1234567 aave borrow 12 ETH', expected)
      })

      it('Borrow 0.12 ETH from Aave with variable rate with given gas price of 765431 with given gas limit of 1234567', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'ETH',
          borrowAmt: '120000000000000000',
          interestRateMode: 2,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: '1234567',
          gasprice: '765431',
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth --gas-price 765431 --gas-limit 1234567 aave borrow 0.12 ETH', expected)
      })

      it('Borrow 0.17 MKR from Aave with variable rate with given gas price of 765431 with given gas limit of 1234567', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'MKR',
          borrowAmt: '170000000000000000',
          interestRateMode: 2,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: '1234567',
          gasprice: '765431',
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth --gas-price 765431 --gas-limit 1234567 aave borrow 0.17 MKR', expected)
      })

      it('Borrow 0.17 WBTC from Aave with variable rate with given gas price of 765431 with given gas limit of 1234567', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          token: 'WBTC',
          borrowAmt: '17000000',
          interestRateMode: 2,
          referralCode: secConfig.web3.mainnet.aave.referralCode,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: '1234567',
          gasprice: '765431',
          inputs: null,
          multipleUse: null,
        }

        return await aaveBorrowTest('cceb eth --gas-price 765431 --gas-limit 1234567 aave borrow 0.17 WBTC', expected)
      })
    })
  })
}

module.exports = {runTest}
