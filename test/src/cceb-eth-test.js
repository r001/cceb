const rewiremock = require('../rewiremock.js')
const yaml = require('js-yaml');
var fs = require('fs')
var assert = require('assert')

var called = 0

rewiremock('../../utils/web3.js')
  .with({
    access: accessMockBorrow, // override w3.access method in cceb
    decimals: decimals,
  })
  .dynamic()

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

async function accessMockBorrow (
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
      assert.equal(checkData.to[0].toLowerCase(), to.toLowerCase())
      assert.equal(checkData.funcName[0], funcName)
      called ++
      return 'lendingPoolName'
    case 1:
      assert.equal(checkData.to[1].toLowerCase(), to.toLowerCase())
      assert.equal(checkData.funcName[1], funcName)
      assert.equal(checkData.token.toLowerCase(), args[0].toLowerCase()) // token
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
      assert.equal(true, false, 'function access() called more than planned') // we should not end up here
      return 'error'
  }
}

async function accessMockCollateral (
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
      assert.equal(checkData.to[0].toLowerCase(), to.toLowerCase())
      assert.equal(checkData.funcName[0], funcName)
      called ++
      return 'lendingPoolName'
    case 1:
      assert.equal(checkData.to[1].toLowerCase(), to.toLowerCase())
      assert.equal(checkData.funcName[1], funcName)
      assert.equal(checkData.token.toLowerCase(), args[0].toLowerCase()) // token
      assert.equal(checkData.disable, args[1]) //borrow amount
      assert.equal(checkData.abi, abi) // abi
      assert.equal(checkData.from, from) // from address
      assert.equal(checkData.gaslimit, gaslimit)
      assert.equal(checkData.gasprice, gasprice)
      assert.equal(checkData.inputs, inputs)
      assert.equal(checkData.multipleUse, multipleUse)
      return ''
    default:
      assert.equal(true, false, 'function access() called more than planned') // we should not end up here
      return 'error'
  }
}

async function access (
  to,
  funcName,
  args,
  abi,
  from,
  value,
  gaslimit,
  gasprice,
  inputs,
  multipleUse) { 

  assert.deepStrictEqual(
    {to, funcName, args, abi, from, value, gaslimit, gasprice, inputs, multipleUse},
    checkData.access[called].args,
    `function w3.access() at iteration ${called} was called with wrong arguments`
  )

  assert.equal(called < checkData.access.length, true, `function access() called ${called} times than should have (${checkData.maxCallCount})`) // we should not end up here
  return checkData.access[called++].return
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

async function aaveCollateralTest (cmdAndArgs, expected) {
  const args = await parseArgs(cmdAndArgs) 
  checkData = expected
  
  const aaveCollateral = await cceb.aaveCollateral(args.token, args.disable, args.from, args.gaslimit, args.gasprice) 
  
  assert.equal(aaveCollateral, '')
  return aaveCollateral
}

async function aaveDepositTest (cmdAndArgs, expected) {
  const args = await parseArgs(cmdAndArgs) 
  checkData = expected
  
  const aaveDeposit = await cceb.aaveDeposit(args.token, args.amount, args.from, args.gaslimit, args.gasprice) 
  
  assert.equal(aaveDeposit, '')
  assert.equal(called, expected.access.length, `There was only ${called} calls made to access() instead of ${expected.access.length}.`)
  return aaveDeposit
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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
          funcName: ['getLendingPool', 'borrow'],
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

    describe('aaveCollateral',  () => { 

      before(() => {
        rewiremock.getMock('../../utils/web3.js')
          .with({
            access: accessMockCollateral, // override w3.access method in cceb
          })

      })

      beforeEach(() => {
        called = 0 
      })

      it('AAVE set ETH as collateral', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName', 'ETH'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          disable: true,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral ETH', expected)
      })

      it('AAVE set ETH as collateral sent from ETH-2', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          disable: true,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral ETH --from ETH-2', expected)
      })

      it('AAVE set ETH as collateral sent from ETH-2, gaslimit set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          disable: true,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral ETH --from ETH-2 --gas-limit 100110', expected)
      })

      it('AAVE set ETH as collateral sent from ETH-2, gaslimit set, gasprice set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          disable: true,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: '12321',
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral ETH --from ETH-2 --gas-limit 100110 --gas-price 12321', expected)
      })

      it('AAVE set ETH as collateral sent from ETH-1, gaslimit set, gasprice set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: '12321',
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral ETH -d -f ETH-2 -g 100110 -p 12321', expected)
      })

      it('AAVE unset ETH as collateral', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral ETH --disable', expected)
      })

      it('AAVE unset ETH as collateral sent from ETH-1', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral ETH --disable --from ETH-2', expected)
      })

      it('AAVE unset ETH as collateral sent from ETH-1, gaslimit set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral ETH --disable --from ETH-2 --gas-limit 100110', expected)
      })

      it('AAVE unset ETH as collateral sent from ETH-1, gaslimit set, gasprice set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: '12321',
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral ETH --disable --from ETH-2 --gas-limit 100110 --gas-price 12321', expected)
      })

      it('AAVE unset ETH as collateral sent from ETH-1, gaslimit set, gasprice set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: '12321',
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral ETH -d -f ETH-2 -g 100110 -p 12321', expected)
      })
      
      it('AAVE set MKR as collateral', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'MKR',
          disable: true,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral MKR', expected)
      })

      it('AAVE set MKR as collateral sent from ETH-2', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'MKR',
          disable: true,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral MKR --from ETH-2', expected)
      })

      it('AAVE set MKR as collateral sent from ETH-2, gaslimit set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'MKR',
          disable: true,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral MKR --from ETH-2 --gas-limit 100110', expected)
      })

      it('AAVE set MKR as collateral sent from ETH-2, gaslimit set, gasprice set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'MKR',
          disable: true,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: '12321',
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral MKR --from ETH-2 --gas-limit 100110 --gas-price 12321', expected)
      })

      it('AAVE set MKR as collateral sent from ETH-1, gaslimit set, gasprice set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'MKR',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: '12321',
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral MKR -d -f ETH-2 -g 100110 -p 12321', expected)
      })

      it('AAVE unset MKR as collateral', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'MKR',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral MKR --disable', expected)
      })

      it('AAVE unset MKR as collateral sent from ETH-1', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'MKR',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral MKR --disable --from ETH-2', expected)
      })

      it('AAVE unset MKR as collateral sent from ETH-1, gaslimit set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'MKR',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral MKR --disable --from ETH-2 --gas-limit 100110', expected)
      })

      it('AAVE unset MKR as collateral sent from ETH-1, gaslimit set, gasprice set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'MKR',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: '12321',
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral MKR --disable --from ETH-2 --gas-limit 100110 --gas-price 12321', expected)
      })

      it('AAVE unset MKR as collateral sent from ETH-1, gaslimit set, gasprice set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'MKR',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: '12321',
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral MKR -d -f ETH-2 -g 100110 -p 12321', expected)
      })

      it('AAVE set USDT as collateral', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'USDT',
          disable: true,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral USDT', expected)
      })

      it('AAVE set USDT as collateral sent from ETH-2', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'USDT',
          disable: true,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral USDT --from ETH-2', expected)
      })

      it('AAVE set USDT as collateral sent from ETH-2, gaslimit set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'USDT',
          disable: true,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral USDT --from ETH-2 --gas-limit 100110', expected)
      })

      it('AAVE set USDT as collateral sent from ETH-2, gaslimit set, gasprice set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'USDT',
          disable: true,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: '12321',
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral USDT --from ETH-2 --gas-limit 100110 --gas-price 12321', expected)
      })

      it('AAVE set USDT as collateral sent from ETH-1, gaslimit set, gasprice set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'USDT',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: '12321',
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral USDT -d -f ETH-2 -g 100110 -p 12321', expected)
      })

      it('AAVE unset USDT as collateral', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'USDT',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: config.web3.defaultFrom,
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral USDT --disable', expected)
      })

      it('AAVE unset USDT as collateral sent from ETH-1', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'USDT',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: null,
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral USDT --disable --from ETH-2', expected)
      })

      it('AAVE unset USDT as collateral sent from ETH-1, gaslimit set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'USDT',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: null,
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral USDT --disable --from ETH-2 --gas-limit 100110', expected)
      })

      it('AAVE unset USDT as collateral sent from ETH-1, gaslimit set, gasprice set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'USDT',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: '12321',
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral USDT --disable --from ETH-2 --gas-limit 100110 --gas-price 12321', expected)
      })

      it('AAVE unset USDT as collateral sent from ETH-1, gaslimit set, gasprice set', async () => {
        const expected = {
          to: ['AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'lendingPoolName'],
          funcName: ['getLendingPool', 'setUserUseReserveAsCollateral'],
          token: 'USDT',
          disable: false,
          abi: 'AAVE_LENDING_POOL',
          from: 'ETH-2',
          gaslimit: '100110',
          gasprice: '12321',
          inputs: null,
          multipleUse: null,
        }

        return await aaveCollateralTest('cceb eth aave collateral USDT -d -f ETH-2 -g 100110 -p 12321', expected)
      })
    })

    describe('aaveDeposit',  () => { 

      before(() => {
        rewiremock.getMock('../../utils/web3.js')
          .with({
            access: access, // override w3.access method in cceb
            decimals: decimals,
          })

      })

      beforeEach(() => {
        called = 0 
      })

      it('AAVE deposit 0.3 MKR as collateral, MKR not approved yet', async () => {
        const expected = {
          access: [
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPool',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolName',
            },
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPoolCore',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolCoreName',
            },
            {
              args: 
              {
                to: 'MKR', 
                funcName: 'allowance',
                args:
                [
                  config.web3.defaultFrom,
                  'lendingPoolCoreName',
                ],
                abi: 'ERC20',
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: '0',
            },
            {
              args:
              {
                to: 'MKR', 
                funcName: 'approve',
                args:
                [
                  'lendingPoolCoreName',
                  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
                ],
                abi: 'ERC20',
                from: config.web3.defaultFrom,
                value: null,
                gaslimit: null,
                gasprice: null,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: true,
            },
            {
              args:
              {
                to: 'lendingPoolName', 
                funcName: 'deposit',
                args:
                [
                  'MKR',
                  '300000000000000000',
                  secConfig.web3.mainnet.aave.referralCode,
                ],
                abi: 'AAVE_LENDING_POOL',
                from: config.web3.defaultFrom,
                value: 0,
                gaslimit: null,
                gasprice: null,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: true,
            },
          ],
          maxCallCount: 5,
        }

        return await aaveDepositTest('cceb eth aave deposit .3 MKR', expected)
      })

      it('AAVE deposit 0.3 USDT as collateral, USDT approved', async () => {
        const expected = {
          access: [
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPool',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolName',
            },
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPoolCore',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolCoreName',
            },
            {
              args: 
              {
                to: 'USDT', 
                funcName: 'allowance',
                args:
                [
                  config.web3.defaultFrom,
                  'lendingPoolCoreName',
                ],
                abi: 'ERC20',
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            },
            {
              args:
              {
                to: 'lendingPoolName', 
                funcName: 'deposit',
                args:
                [
                  'USDT',
                  '300000',
                  secConfig.web3.mainnet.aave.referralCode,
                ],
                abi: 'AAVE_LENDING_POOL',
                from: config.web3.defaultFrom,
                value: 0,
                gaslimit: null,
                gasprice: null,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: true,
            },
          ],
        }

        return await aaveDepositTest('cceb eth aave deposit .3 USDT', expected)
      })

      it('AAVE deposit 0.3 MKR as collateral, MKR approved', async () => {
        const expected = {
          access: [
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPool',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolName',
            },
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPoolCore',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolCoreName',
            },
            {
              args: 
              {
                to: 'MKR', 
                funcName: 'allowance',
                args:
                [
                  config.web3.defaultFrom,
                  'lendingPoolCoreName',
                ],
                abi: 'ERC20',
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            },
            {
              args:
              {
                to: 'lendingPoolName', 
                funcName: 'deposit',
                args:
                [
                  'MKR',
                  '300000000000000000',
                  secConfig.web3.mainnet.aave.referralCode,
                ],
                abi: 'AAVE_LENDING_POOL',
                from: config.web3.defaultFrom,
                value: 0,
                gaslimit: null,
                gasprice: null,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: true,
            },
          ],
        }

        return await aaveDepositTest('cceb eth aave deposit .3 MKR', expected)
      })

      it('AAVE deposit 1171 ETH as collateral, ETH approved', async () => {
        const expected = {
          access: [
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPool',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolName',
            },
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPoolCore',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolCoreName',
            },
            {
              args:
              {
                to: 'lendingPoolName', 
                funcName: 'deposit',
                args:
                [
                  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                  '1171000000000000000000',
                  secConfig.web3.mainnet.aave.referralCode,
                ],
                abi: 'AAVE_LENDING_POOL',
                from: config.web3.defaultFrom,
                value:  '1171000000000000000000',
                gaslimit: null,
                gasprice: null,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: true,
            },
          ],
        }

        return await aaveDepositTest('cceb eth aave deposit 1171 ETH', expected)
      })

      it('AAVE deposit 0.5 ETH as collateral, ETH approved', async () => {
        const expected = {
          access: [
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPool',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolName',
            },
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPoolCore',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolCoreName',
            },
            {
              args:
              {
                to: 'lendingPoolName', 
                funcName: 'deposit',
                args:
                [
                  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                  '500000000000000000',
                  secConfig.web3.mainnet.aave.referralCode,
                ],
                abi: 'AAVE_LENDING_POOL',
                from: config.web3.defaultFrom,
                value: '500000000000000000',
                gaslimit: null,
                gasprice: null,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: true,
            },
          ],
        }

        return await aaveDepositTest('cceb eth aave deposit .5 ETH', expected)
      })

      it('AAVE deposit 0.5 ETH as collateral, ETH approved, gas limit of 852321', async () => {
        const expected = {
          access: [
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPool',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolName',
            },
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPoolCore',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolCoreName',
            },
            {
              args:
              {
                to: 'lendingPoolName', 
                funcName: 'deposit',
                args:
                [
                  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                  '500000000000000000',
                  secConfig.web3.mainnet.aave.referralCode,
                ],
                abi: 'AAVE_LENDING_POOL',
                from: config.web3.defaultFrom,
                value: '500000000000000000',
                gaslimit: '852321',
                gasprice: null,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: true,
            },
          ],
        }

        return await aaveDepositTest('cceb eth aave deposit .5 ETH --gas-limit 852321', expected)
      })

      it('AAVE deposit 0.3 MKR as collateral, MKR not approved yet, gas limit 1660000, gasprice 178GW, from address ETH-FROM-1', async () => {
        const expected = {
          access: [
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPool',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolName',
            },
            {
              args: {
                to: 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 
                funcName: 'getLendingPoolCore',
                args: undefined,
                abi: undefined,
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: 'lendingPoolCoreName',
            },
            {
              args: 
              {
                to: 'MKR', 
                funcName: 'allowance',
                args:
                [
                  'ETH-FROM-1',
                  'lendingPoolCoreName',
                ],
                abi: 'ERC20',
                from: undefined,
                value: undefined,
                gaslimit: undefined,
                gasprice: undefined,
                inputs: undefined,
                multipleUse: undefined,
              },
              return: '0',
            },
            {
              args:
              {
                to: 'MKR', 
                funcName: 'approve',
                args:
                [
                  'lendingPoolCoreName',
                  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
                ],
                abi: 'ERC20',
                from: 'ETH-FROM-1',
                value: null,
                gaslimit: '1660000',
                gasprice: '178000000000',
                inputs: undefined,
                multipleUse: undefined,
              },
              return: true,
            },
            {
              args:
              {
                to: 'lendingPoolName', 
                funcName: 'deposit',
                args:
                [
                  'MKR',
                  '300000000000000000',
                  secConfig.web3.mainnet.aave.referralCode,
                ],
                abi: 'AAVE_LENDING_POOL',
                from: 'ETH-FROM-1',
                value: 0,
                gaslimit: '1660000',
                gasprice: '178000000000',
                inputs: undefined,
                multipleUse: undefined,
              },
              return: true,
            },
          ],
          maxCallCount: 5,
        }

        return await aaveDepositTest('cceb eth aave deposit .3 MKR --gas-limit 1660000 --gas-price 178000000000 --from ETH-FROM-1', expected)
      })
    })
  })
}

module.exports = {runTest}
