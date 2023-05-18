const BN = require('bignumber.js')
const config = require('config')
const w3 = require('../web3.js')
const log4js = require('log4js')

log4js.configure(
	{
		appenders: {
			out: {type: 'stdout', layout: {
				type: 'pattern',
				pattern: '%[[%d] [%p] [%f{1}#%l] -%] %m',
			},
			},
		},
		categories: {default: {appenders: ['out'], level: 'info', enableCallStack: true}},
	}
)

const log = log4js.getLogger()
  log.level = config.get('loglevel')
const network = config.get('web3.network')

async function dispAaveDeposit (block, token, amount, from, gaslimit, gasprice, nonce) {
	console.log(await aaveDeposit(block, token, amount, from, gaslimit, gasprice, nonce))
}

async function getReferralCode () {
  const network = config.get('web3.network')
    return config.get(`web3.networks.${network}.aave.referralCode`)
}

async function aaveDeposit (block, token, amount, from, gaslimit, gasprice, nonce) {
	const web3 = await w3.getWeb3(network)
  const decimals = token === 'ETH' ? 18 : Number(await w3.decimals(web3, block, token))
    const depositAmt = BN(amount).times(BN(10).pow(decimals)).integerValue()
    const referralCode = await getReferralCode()
    const lendingPool = await w3.access(web3, block, 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'getLendingPool')
    const lendingPoolCore = await w3.access(web3, block, 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'getLendingPoolCore')
    var approved
    if (token === 'ETH') {
      approved = BN(10).pow(100)	
        token = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
    } else {
      approved = BN(await w3.access(web3, block, token, 'allowance', [from, lendingPoolCore], 'ERC20'))
    }


  if (approved.lt(depositAmt)) {
    await w3.access(
        web3, 
        block,
        token,
        'approve',
        [lendingPoolCore, '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'],
        'ERC20',
        from,
        null,
        gaslimit,
        gasprice,
        nonce
        )
  }

  await w3.access(
      web3, 
      block,
      lendingPool,
      'deposit',
      [
      token,
      depositAmt.toFixed(),
      referralCode
      ],
      'AAVE_LENDING_POOL',
      from,
      (token === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' ? depositAmt.toFixed() : 0),
      gaslimit,
      gasprice,
      nonce)


    return ''

}

async function dispAaveWithdraw (args) {
  console.log(await aaveWithdraw(args))
}

async function aaveWithdraw (args) {
	const web3 = await w3.getWeb3(network)
  const aToken = 'a' + args.token
    const decimals = Number(await w3.decimals(web3, args.block, aToken))
    var amount
    if (args.amount.match(/ALL/i)) {
      amount = BN(await w3.access(web3, args.block, aToken, 'balanceOf', [args.from], 'ERC20'))
    } else {
      amount = BN(args.amount).times(BN(10).pow(decimals)).integerValue()
    }
  var canWithdraw = await w3.access(web3, args.block, aToken, 'isTransferAllowed', [args.from, amount], 'aToken')
    if (!canWithdraw) { throw new Error('Withdraw not possible. Payback all debt first!')}
  log.debug(`amount final: ${amount.toFixed()}`)

    await w3.access(
        web3, 
        args.block,
        aToken,
        'redeem',
        [amount.toFixed()],
        'aToken',
        args.from,
        0,
        args.gaslimit,
        args.gasprice,
        args.nonce
        ) 
}

async function dispAaveCollateral (block, token, disable, from, gaslimit, gasprice, nonce) {
  console.log(await aaveCollateral(block, token, disable, from, gaslimit, gasprice, nonce))
}

async function aaveCollateral (block, token, disable, from, gaslimit, gasprice, nonce) {
	const web3 = await w3.getWeb3(network)
  if (token === 'ETH') {
    token = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
  } 
  const lendingPool = await w3.access(web3, block, 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'getLendingPool')
    return await w3.access(web3, block, lendingPool, 'setUserUseReserveAsCollateral', [token, !disable], 'AAVE_LENDING_POOL', from, null, gaslimit, gasprice, nonce)
}

async function dispAaveBorrow (amount, token, fixed, from, gasLimit, gasPrice, nonce) {
  console.log(await aaveBorrow(amount, token, fixed, from, gasLimit, gasPrice, nonce))
}

async function aaveBorrow (
    amount,
    token,
    fixed,
    from,
    gasLimit,
    gasPrice,
    nonce,
    block
    ) {
	const web3 = await w3.getWeb3(network)
  const decimals = token === 'ETH' ? 18 : Number(await w3.decimals(web3, block, token))
    const borrowAmt = BN(amount).times(BN(10).pow(decimals)).integerValue()
    const interestRateMode = fixed ? 1 : 2
    const referralCode = await getReferralCode()
    const lendingPool = await w3.access(web3, block, 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'getLendingPool')
    return await w3.access(web3, block, lendingPool, 'borrow', [token, borrowAmt.toFixed(), interestRateMode, referralCode], 'AAVE_LENDING_POOL', from, 0, gasLimit, gasPrice, nonce)
}

async function dispAavePayback (args) {
  console.log(await aavePayback(args))
}

async function aavePayback (args) {
	const web3 = await w3.getWeb3(network)

  const decimals = 
    args.token === 'ETH' ?
    18 :
    Number(await w3.decimals(web3, args.block, args.token))

    if ( args.amount.match(/all/i)) {

      if (args.token === 'ETH') {
        var {currentBorrowBalance:paybackAmt} = await aaveInfo({...args, aaveInfoCommand: 'user'})

          paybackAmt = BN(paybackAmt).plus(BN(config.get('web3.aave.paybackExtra')).times(BN(10).pow(18))).toFixed()
      } else {
        paybackAmt = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      }
    } else {

      paybackAmt = BN(args.amount).times(BN(10).pow(decimals)).integerValue().toFixed()

    }

  const lendingPoolCore = await w3.access(web3, args.block, 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'getLendingPoolCore')

    const approved = args.token === 'ETH' ?
    BN(10).pow(100) :
    BN(await w3.access(
          web3, 
          args.block,
          args.token,
          'allowance',
          [args.from, lendingPoolCore],
          'ERC20'
          ))

    if (approved.lt(paybackAmt)) {
      await w3.access(
          web3, 
          args.block,
          args.token,
          'approve',
          [lendingPoolCore, '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'],
          'ERC20',
          args.from,
          0,
          args.gaslimit,
          args.gasprice,
          args.nonce
          )
    }
  const lendingPool = await w3.access(web3, args.block, 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'getLendingPool')

    await w3.access(
        web3, 
        args.block,
        lendingPool,
        'repay',
        [
        args.token,
        paybackAmt,
        args.for ? args.for : args.from
        ],
        'AAVE_LENDING_POOL',
        args.from,
        (args.token === 'ETH' ? paybackAmt : 0),
        args.gaslimit,
        args.gasprice,
        args.nonce
        )
}

async function dispAaveSwapRate (args) {
  console.log(await aaveSwapRate(args))
}

async function aaveSwapRate (args) {
	const web3 = await w3.getWeb3(network)
  const lendingPool = await w3.access(web3, args.block, 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'getLendingPool')

    await w3.access(
        web3, 
        args.block,
        lendingPool,
        'swapBorrowRateMode',
        [args.token],
        'AAVE_LENDING_POOL',
        args.from,
        0,
        args.gaslimit,
        args.gasprice,
        args.nonce
        )
}

async function dispAaveRebalance (args) {
  console.log(await aaveRebalance(args))
}

async function aaveRebalance (args) {
	const web3 = await w3.getWeb3(network)

  const lendingPool = await w3.access(web3, args.block, 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'getLendingPool')

    await w3.access(
        web3, 
        args.block,
        lendingPool,
        'rebalanceStableBorrowRate',
        [args.token, args.for ? args.for : args.from],
        'AAVE_LENDING_POOL',
        args.from,
        0,
        args.gaslimit,
        args.gasprice,
        args.nonce
        )
}

async function dispAaveLiquidate (args) {
  console.log(await aaveLiquidate(args))
}

async function aaveLiquidate (args) { //TODO: implement
	const web3 = await w3.getWeb3(network)

  const lendingPool = await w3.access(web3, args.block, 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'getLendingPool')

    await w3.access(
        web3, 
        args.block,
        lendingPool,
        'liquidationCall', 
        [
        args.token, 
        args.for ? args.for : args.from
        ],
        'AAVE_LENDING_POOL',
        args.from,
        0,
        args.gaslimit,
        args.gasprice,
        args.nonce
        )//TODO: finish arguments
}

async function dispAaveInfo (args) {
  console.log(await aaveInfo(args))
}

async function aaveInfo (args) {
	const web3 = await w3.getWeb3(network)
  const lendingPool = await w3.access(web3, args.block, 'AAVE_LENDING_POOL_ADDRESSES_PROVIDER', 'getLendingPool')

    if (args._[3] === 'reserve') {

      var configdata =  await w3.access(
          web3, 
          args.block,
          lendingPool,
          'getReserveConfigurationData',
          [args.token],
          'AAVE_LENDING_POOL'
          )

        var configdata1 = await w3.access(web3, args.block, lendingPool, 'getReserveData', [args.token], 'AAVE_LENDING_POOL')	

        return {...configdata, ...configdata1}

    }	else if (args._[3] === 'account') {

      return await w3.access(web3, args.block, lendingPool, 'getUserAccountData', [args.from], 'AAVE_LENDING_POOL')		

    }	else if (args._[3] === 'user') {

      return await w3.access(web3, args.block, lendingPool, 'getUserReserveData', [args.token, args.from], 'AAVE_LENDING_POOL')		
    }
}

async function dispAaveEstimate (args) {
  console.log(await aaveEstimate(args))
}

async function aaveEstimate () {
}

module.exports = {
  aaveBorrow, 					// tested
  aaveCollateral,				// tested
  aaveDeposit,					// tested
  aaveEstimate,
  aaveInfo,
  aaveLiquidate,
  aavePayback,
  aaveRebalance,
  aaveSwapRate,
  aaveWithdraw,
  dispAaveBorrow,
  dispAaveCollateral,
  dispAaveDeposit,
  dispAaveEstimate,
  dispAaveInfo,
  dispAaveLiquidate,
  dispAavePayback,
  dispAaveRebalance,
  dispAaveSwapRate,
  dispAaveWithdraw,
  getReferralCode,
}

