const dateFormat = require('dateformat')
const w3 = require('../web3.js')
const ut = require('../util')
const BN = require('bignumber.js')
const log4js = require('log4js')
const config = require('config')
const exchange = require('../exchange.js')

BN.set({DECIMAL_PLACES: 45, ROUNDING_MODE: 1/*round down*/})

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


async function dispVaultEstimate () {
  console.log((await vaultEstimate()).toString())
}

async function vaultEstimate () {
  var gas = 739549
  return await estimateGasCost(gas)
}

async function dispVaultPayback (args) {
  console.log(await vaultPayback(args))
}

async function vaultPayback (args) {
  var web3 = await ut.getWeb3(network)
  if (args.estimate) {
    var gas = 159676
    console.log(await estimateGasCost(gas))
    process.exit(0)
  }
  var {vaultId} = await getVaultId(args.from, args.vault, vaultTypeHex)
  var {vaultAddr, vaultTypeHex, daiNormalized} = await getUrnParams(args.block, vaultId, args.type)

  var ilk = await w3.access(web3, args.block, 'MCD_VAT', 'ilks', [vaultTypeHex]) 
  var rate = BN(ilk.rate)
  log.debug(`rate: ${rate}`)

  var daiVault = BN(await w3.access(web3, args.block, 'MCD_VAT', 'dai', [vaultAddr]))
  log.debug(`dai in Vault: ${daiVault.toFixed()}`)
  const daiBalance = BN(await w3.access(web3, args.block, 'MCD_DAI', 'balanceOf', [args.from], 'ERC20'))
  var daiVaultNormalizedWad = daiVault.div(rate).integerValue()
  log.debug(`dai in Vaultnormalized: ${daiVaultNormalizedWad.toFixed()}`)
  var paybackWad = BN(args.amount).times(BN(10).pow(18)).integerValue()
  log.debug(`paybackWad(before leftover payback): ${paybackWad.toFixed()}`)
  paybackWad = paybackWad.minus(daiVault.div(BN(10).pow(27)).integerValue())
  log.debug(`paybackWad(after leftover payback): ${paybackWad.toFixed()}`)
  paybackWad = BN.min(paybackWad, daiNormalized.times(rate).div(BN(10).pow(27)).integerValue().plus(1), daiBalance)
  log.debug(`paybackWad(after considering actual dai debt, and balance): ${paybackWad.toFixed()}`)
  const paybackNormalizedWad = paybackWad.times(BN(10).pow(27)).div(rate).integerValue()

  log.debug(`paybackNormalizedWad: ${paybackNormalizedWad}`)
  const approvedDai = BN(await w3.access(web3, args.block, 'MCD_DAI', 'allowance', [args.from, 'MCD_JOIN_DAI'], 'ERC20'))
  if (approvedDai.lt(paybackWad)) {
    await w3.access(
      web3, 
      args.block,
      'MCD_DAI',
      'approve',
      ['MCD_JOIN_DAI', '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'],
      'ERC20',
      args.from,
      0, 
      args.gaslimit,
      args.gasprice,
      args.nonce
    )	
  }
  if (paybackWad.gt(0)) {
    await w3.access(
      web3, 
      args.block,
      'MCD_JOIN_DAI',
      'join',
      [vaultAddr, paybackWad.toFixed()],
      null,
      args.from,
      0,
      args.gaslimit,
      args.gasprice,
      args.nonce
    )

  }

  daiVault = BN(await w3.access(web3, args.block, 'MCD_VAT', 'dai', [vaultAddr])).div(BN(10).pow(27))
  ilk = await w3.access(web3, args.block, 'MCD_VAT', 'ilks', [vaultTypeHex]) 
  rate = BN(ilk.rate)
  log.debug(`rate: ${rate}`)
  daiVaultNormalizedWad = daiVault.div(rate).integerValue()

  await w3.access(
    web3, 
    args.block,
    'MCD_CDP_MANAGER',
    'frob',
    [vaultId, '0', daiVaultNormalizedWad],
    null,
    args.from,
    0,
    args.gaslimit,
    args.gasprice,
    args.nonce
  ) //FIXME: withdraw collateral too
}

async function dispVaultGenerate (args) {
  console.log(await vaultGenerate(args))
}

async function vaultGenerate (args) {
  var web3 = await ut.getWeb3(network)
  web3.eth.handleRevert = true
  if (args.estimate) {
    var gas = 208114
    console.log(await estimateGasCost(gas))
    process.exit(0)
  }
  const vaultTypeHex = web3.eth.abi.encodeParameter('bytes32', '0x' + Buffer.from(args.type).toString('hex'))
  var {vaultId} = await getVaultId(args.from, args.vault, vaultTypeHex)
  const vaultAddr = await w3.access(web3, args.block, 'MCD_CDP_MANAGER', 'urns', [vaultId])
  var ilk = await w3.access(web3, args.block, 'MCD_VAT', 'ilks', [vaultTypeHex]) 
  var rate = new BN(ilk.rate)
  var daiToGenerate = BN(args.amount).times(BN(10).pow(45)).integerValue()
  log.debug(`DaiToGenerate: ${daiToGenerate}`)
  var daiAtVault = BN(await w3.access(web3, args.block, 'MCD_VAT', 'dai', [vaultAddr]))
  log.debug(`daiAtVault: ${daiAtVault}`)
  var daiAtFrom = BN(await w3.access(web3, args.block, 'MCD_VAT', 'dai', [args.from]))
  var daiTotal = daiAtVault.plus(daiAtFrom)
  log.debug(`daiAtFrom: ${daiAtFrom}`)
  var daiToFrobWad = (daiTotal.lt(daiToGenerate) ? daiToGenerate.minus(daiTotal) : BN(0)).div(rate).integerValue()
  log.debug(`DaiToFrobWad: ${daiToFrobWad}`)
  if (!daiToFrobWad.eq(BN(0))) {

    await w3.access(
      web3, 
      args.block,
      'MCD_CDP_MANAGER',
      'frob',
      [vaultId, 0, daiToFrobWad.toFixed()],
      null,
      args.from,
      0,
      args.gaslimit,
      args.gasprice,
      args.nonce
    )

    daiAtVault = BN(await w3.access(web3, args.block, 'MCD_VAT', 'dai', [vaultAddr]))
    daiTotal = daiAtVault.plus(daiAtFrom)
  }

  daiToGenerate = BN.min(daiToGenerate, daiTotal)

  await w3.access(
    web3, 
    args.block,
    'MCD_CDP_MANAGER',
    'move',
    [vaultId, args.from, daiToGenerate.minus(daiAtFrom).integerValue().toFixed()],
    null,
    args.from,
    0,
    args.gaslimit,
    args.gasprice,
    args.nonce
  )

  const joinEnabled = await w3.access(web3, args.block, 'MCD_VAT', 'can', [args.from, 'MCD_JOIN_DAI'])

  if (Number(joinEnabled) === 0) {
    await w3.access(
      web3, 
      args.block,
      'MCD_VAT',
      'hope',
      ['MCD_JOIN_DAI'],
      null,
      args.from,
      0,
      args.gaslimit,
      args.gasprice,
      args.nonce
    )
  }

  await w3.access(
    web3, 
    args.block,
    'MCD_JOIN_DAI',
    'exit',
    [args.from, daiToGenerate.div(BN(10).pow(27)).integerValue().toFixed()],
    null,
    args.from,
    0,
    args.gaslimit,
    args.gasprice,
    args.nonce
  )
}

async function dispVaultWithdraw (args) {
  await vaultWithDraw(args)
}

async function vaultWithDraw (args) {
  var web3 = await ut.getWeb3(network)
  const vaultTypeHex = web3.eth.abi.encodeParameter('bytes32', '0x' + Buffer.from(args.type).toString('hex'))
  var collCoin = args.type.replace(/-.*/, '')
  if (args.estimate) {
    var gas = 225226
    if (collCoin === 'ETH') gas += 38169
    console.log(await estimateGasCost(gas))
    process.exit(0)
  }
  if (collCoin === 'ETH') collCoin = 'WETH'
  const joinContract = 'MCD_JOIN_' + args.type.replace(/-/, "_")
  var {vaultId} = await getVaultId(args.from, args.vault, vaultTypeHex)
  const decimals = Number(await w3.decimals(web3, args.block, collCoin))
  var withdrawAmt = BN(args.amount).times(BN(10).pow(decimals)).integerValue()
  var withdrawAmtWad = BN(args.amount).times(BN(10).pow(18)).integerValue()

  const vltInfo = await vaultInfo(args)
  const vault = vltInfo.find(vlt => vlt.vaultId.eq(vaultId))
  if (vault.collateralToWithdraw.lt(args.amount)) {
    throw Error(`You can't withdraw more than ${vault.collateralToWithdraw}. Or pay back some DAI first!`)
  }
  if (vault.unlockedCollateral.lt(args.amount)) {
    const freeCollateral = vault.unlockedCollateral.minus(args.amount).times(BN(10).pow(18)).integerValue()

    await w3.access(
      web3, 
      args.block,
      'MCD_CDP_MANAGER',
      'frob',
      [vaultId, freeCollateral.toFixed(), 0],
      null,
      args.from,
      0,
      args.gaslimit,
      args.gasprice,
      args.nonce
    ) //FIXME: allow to payback dai
  }

  await w3.access(
    web3, 
    args.block,
    'MCD_CDP_MANAGER',
    'flux',
    [vaultId, args.from, withdrawAmtWad.toFixed()],
    null,
    args.from, 
    0,
    args.gaslimit,
    args.gasprice,
    args.nonce,
    ['uint256', 'address', 'uint256']
  )

  await w3.access(
    web3, 
    args.block,
    joinContract,
    'exit',
    [args.from, withdrawAmt.toFixed()],
    null,
    args.from,
    0,
    args.gaslimit,
    args.gasprice,
    args.nonce
  )

  if (collCoin === 'WETH') {
    await w3.access(
      web3, 
      args.block,
      'WETH',
      'withdraw',
      [withdrawAmt.toFixed()],
      null,
      args.from,
      0,
      args.gaslimit,
      args.gasprice,
      args.nonce
    )
  }
}

async function dispVaultDeposit (args) {
  console.log(await vaultDeposit(args))
}

async function vaultDeposit (args) {
  var web3 = await ut.getWeb3(network)
  const vaultTypeHex = web3.eth.abi.encodeParameter('bytes32', '0x' + Buffer.from(args.type).toString('hex'))
  var collCoin = args.type.replace(/-.*/, '')
  if (args.estimate) {
    var gas = 146533
    if (collCoin === 'ETH') gas += 43766
    console.log(await estimateGasCost(gas))
    process.exit(0)
  }
  if (collCoin === 'ETH') {
    collCoin = 'WETH'

    await w3.access(
      web3, 
      args.block,
      'WETH',
      'deposit',
      [],
      null,
      args.from,
      BN(args.amount).times(BN(10).pow(18)).integerValue().toFixed(),
      args.gaslimit,
      args.gasprice,
      args.nonce
    )
  }
  const joinContract = 'MCD_JOIN_' + args.type.replace(/-/, "_")
  const decimals = Number(await w3.decimals(web3, args.block, collCoin))
  var allowance = BN(await w3.access(web3, args.block, collCoin, 'allowance', [args.from, joinContract]))
  if (allowance.div(BN(10).pow(decimals)).lt(BN(args.amount))) {
    //if allowance less than amount to deposit
    log.info("approve infinite")

    await w3.access(
      web3, 
      args.block,
      collCoin, 
      'approve', 
      [
        joinContract,
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ],
      null,
      args.from,
      0,
      args.gaslimit,
      args.gasprice,
      args.nonce
    )
  }
  var balance = BN(await w3.access(web3, args.block, collCoin, 'balanceOf', [args.from]))
  var {vaultId} = await getVaultId(args.from, args.vault, vaultTypeHex, args.block)
  const vaultAddr = await w3.access(web3, args.block, 'MCD_CDP_MANAGER', 'urns', [vaultId])
  var depositAmt = BN(args.amount).times(BN(10).pow(decimals)).integerValue()
  if (depositAmt.gt(balance)) {
    depositAmt = balance
    log.warn("Deposit truncated to: " + balance.div(BN(10).pow(decimals)).integerValue().toFixed())
  }

  log.info(`joincontract: ${joinContract} vaultAddr: ${vaultAddr} depositamt: ${depositAmt.toFixed()}`)

  await w3.access(
    web3, 
    args.block,
    joinContract,
    'join',
    [vaultAddr, depositAmt.toFixed()],
    null,
    args.from,
    0,
    args.gaslimit,
    args.gasprice,
    args.nonce
  )

  const depositInt = await web3.eth.abi.encodeParameter('int', depositAmt.toFixed())
  var ilk = await w3.access(web3, args.block, 'MCD_VAT', 'ilks', [vaultTypeHex], null, args.from) 
  var rate = new BN(ilk.rate)
  const drawDaiInt = await web3.eth.abi.encodeParameter('int', BN(args.draw).times(BN(10).pow(18+27)).div(rate).integerValue().toFixed())

  await w3.access(
    web3, 
    args.block,
    'MCD_CDP_MANAGER', 
    'frob',
    [vaultId, depositInt, drawDaiInt],
    null,
    args.from,
    0,
    args.gaslimit,
    args.gasprice,
    args.nonce
  )
}

async function dispVaultOpen (args) {
  console.log(await vaultOpen(args))
}

async function estimateGasCost (gas) {
  var price = await exchange.getPriceInOtherCurrency('binance', 'ETH', 'USDT')
	var web3 = undefined
	var gasPrice = BN(await w3.getGasPrice(web3, {type: 'legacy'}))
	const EIP_1559 = gasPrice.type === 'EIP_1559'
	var gasCost
	if (EIP_1559) {
		gasCost = gasPrice.maxFeePerGas
	} else { 
		gasCost = gasPrice.gasPrice
	}
  const total = gasCost.times(price).times(gas).div(BN(10).pow(18)).toFixed()
  return total
}

async function vaultOpen (args) {
  var web3 = await ut.getWeb3(network)
  if (args.estimate) {
    console.log(await estimateGasCost(229642))
    process.exit(0)
  }

  const vaultTypeHex = web3.eth.abi.encodeParameter('bytes32', '0x' + Buffer.from(args.type).toString('hex'))

  await w3.access(
    web3, 
    args.block,
    'MCD_CDP_MANAGER',
    'open',
    [vaultTypeHex, args.from],
    null,
    args.from,
    0,
    args.gaslimit,
    args.gasprice,
    args.nonce
  )

  return await w3.access(web3, args.block, 'MCD_CDP_MANAGER', 'last', [args.from])
}

async function dispVaultInfo (args) {
  // get dai debt from vat contract
  const vltInfo = await vaultInfo(args)
  const collCoin = args.type.replace(/-.*/, '')

  vltInfo.map(vault => console.log(
    "id:" + vault.vaultId.toFixed() +
    "\nproxy: " + (vault.proxyUsed ? "true" : "false") +
    `\nfrom: ${vault.fromAddr}\
          \nvault: ${vault.vaultAddr}\
          \ndeposit: ${vault.deposit.toFixed()} ${collCoin}\
          \ndebt: ${vault.debt.toFixed()}\
          \ndaiToGenerate: ${vault.daiToGenerate.toFixed()}\
          \ncollateralToWithdraw: ${vault.collateralToWithdraw.toFixed()}\
          \nliquidationRatio: ${vault.liquidationRatio.toFixed()}\
          \nfeed: ${vault.priceFeedAddress}`
  ))
}

async function getVaultId (from, vault, type, block) {
  var web3 = await ut.getWeb3(network)
  const vaultTypeHex = web3.eth.abi.encodeParameter('bytes32', '0x' + Buffer.from(type).toString('hex'))
  // check if cdp is registered with proxy
  var proxyAddress = await w3.access(web3, block,  'MCD_PROXY_REGISTRY', 'proxies', [from])
  var fromAddress = parseInt(proxyAddress) === 0 ? from : proxyAddress

  log.info(`fromAddress: ${fromAddress}, type: ${typeof fromAddress}`)

  var vaultId = vault !== 0 ? vault : await w3.access(web3, block, 'MCD_CDP_MANAGER', 'last', [fromAddress])
  log.debug({vaultId})
  if (vaultTypeHex) {
    var vaultTypeHexCurr = await w3.access(web3, block, 'MCD_CDP_MANAGER', 'ilks', [vaultId])
    log.debug({vaultTypeHexCurr, vaultTypeHex})
    while (vaultTypeHexCurr.toString("hex") !== vaultTypeHex.toString("hex") && vaultId !== 0) {
      if (vault !== 0) throw new Error('Vault id and type mismatch.')
      vaultId =  Number((await w3.access(web3, block, 'MCD_CDP_MANAGER', 'list', [vaultId])).prev)
      log.debug({vaultId})
      if (vaultId !== 0) {
        vaultTypeHexCurr = await w3.access(web3, block, 'MCD_CDP_MANAGER', 'ilks', [vaultId])
        log.debug({vaultTypeHexCurr})
      }
    }
    if (vaultTypeHexCurr !== vaultTypeHex) throw new Error('Vault type not opened yet. Pls open first!')
  }
  return {proxyAddress, fromAddress, vaultId}
}

async function getUrnParams (block, vaultId, type) {
  var web3 = await ut.getWeb3(network)
  const vaultAddr = await w3.access(web3, block, 'MCD_CDP_MANAGER', 'urns', [vaultId])

  const vaultTypeHex = web3.eth.abi.encodeParameter('bytes32', '0x' + Buffer.from(type).toString('hex'))
  log.info('VaultTypeHex: ' + vaultTypeHex)
  var urn = await w3.access(web3, block, 'MCD_VAT', 'urns', [vaultTypeHex, vaultAddr])
  var daiNormalized = BN(urn.art)
  var lockedCollateral = BN(urn.ink)
  var unlockedCollateral = BN(await w3.access(web3, block, 'MCD_VAT', 'gem', [vaultTypeHex, vaultAddr]))
  log.info('Dai(normalized) in vault: ' + daiNormalized.toFixed())
  return {vaultAddr, vaultTypeHex, daiNormalized, lockedCollateral, unlockedCollateral}
}

async function vaultInfo (args) {
  var web3 = await ut.getWeb3(network)
  var vaults = []
  var {proxyAddress, fromAddress, vaultId} = await getVaultId(args.from, args.vault, args.type)

  var first = true
  while (first || args.vault !== 0) {
    first = false
    log.info("args.vault: " + typeof args.vault)
    log.info(`vaultId: ${vaultId}`)
    console.log(vaultId)
    if (Number(vaultId) === 0) break

    var {vaultAddr, vaultTypeHex, daiNormalized, lockedCollateral, unlockedCollateral} = await getUrnParams(vaultId, args.type)
    //get current rate from vat contract
    var ilk = await w3.access(web3, args.block, 'MCD_VAT', 'ilks', [vaultTypeHex]) 
    var rate = new BN(ilk.rate)
    var spot = new BN(ilk.spot)
    log.info('Rate of ' + args.type +' : ' + rate.div(10**27).toFixed())

    var spotIlk = await w3.access(web3, args.block, 'MCD_SPOT', 'ilks', [vaultTypeHex])
    const priceFeed = spotIlk.pip
    const liquidationRatio = BN(spotIlk.mat)

    const daiDebt = daiNormalized.times(rate).div(BN(10).pow(18 + 27))

    vaults.push({
      vaultId: BN(vaultId),
      proxyUsed: fromAddress === proxyAddress,
      fromAddr: await w3.getAddress(fromAddress),
      vaultAddr: vaultAddr,
      deposit: lockedCollateral.plus(unlockedCollateral).div(BN(10).pow(18)),
      debt: daiDebt,
      daiToGenerate: spot.times(lockedCollateral.plus(unlockedCollateral)).div(BN(10).pow(27+18)).minus(daiDebt),
      lockedCollateral: lockedCollateral.div(BN(10).pow(18)),
      unlockedCollateral: unlockedCollateral.div(BN(10).pow(18)),
      collateralToWithdraw: lockedCollateral.plus(unlockedCollateral).div(BN(10).pow(18)).minus(daiDebt.div(spot.div(BN(10).pow(27)))),
      liquidationRatio: liquidationRatio.div(BN(10).pow(27)),
      priceFeedAddress: priceFeed,
    })

    vaultId = args.vault !== 0 ? args.vault : (await w3.access(web3, args.block, 'MCD_CDP_MANAGER', 'list', [vaultId])).prev
  }
  return vaults
}

async function dispFlog (args) {
  console.log(await getFlog(args))
}

async function getFlog (args) {
  var web3 = await ut.getWeb3(network)

  const logs = await web3.eth.getPastLogs(
    {
      fromBlock: args.from_block,
      toBlock:   args.to_block,
      address: await w3.getAddress(args.contract),
      topics: [
'0x697efb7800000000000000000000000000000000000000000000000000000000'
      ]
    }
  )

  var era
  var log
  var sinB
  var amt = args.amount 
  const rad = new BN('1e45')
  if (!logs || logs.length === 0) {
    console.log('no events')
    process.exit(0)
  } else {
    for (var index = 0; index < logs.length && amt >= 0; index++) {
      log = logs[index]    
      var block  = await web3.eth.getBlock(log.blockNumber)
      era = block.timestamp

      sinB = await w3.access(
        web3, 
        args.block,
        'MCD_VOW',
        'sin',
        [new BN(era).toFixed()],
        null, // args.abi,
        args.from, // args.from,
        null, // args.value,
        null, // args.gaslimit,
        null  // args.gasprice
      )

      const sin = Number(new BN(sinB).div(rad))
      const tab = Number(new BN(log.topics[2]).div(rad).toString())
      amt -= Math.min(sin, tab) 

      if (sin > 0) 
        await w3.access(
          web3, 
          args.block,
          'MCD_VOW',
          'flog',
          [era],
          null,
          args.from,
          0,
          args.gaslimit,
          args.gasprice,
          args.nonce
        )

      const d = new Date(era * 1000)
      const date = dateFormat(d, 'yy-mm-dd HH:MM:ss') 
      console.log(`blk: ${log.blockNumber}, ${date}, amt: ${amt.toFixed(2)}, sin: ${sin.toFixed(2)}, tab: ${tab.toFixed(2)},\ntx: ${log.transactionHash},\nminer: ${block.miner}\n `)
    }
  }
  return ''
}

async function dispFlop (args) {
  console.log(await getFlop(args))
}

async function getFlop (args) {
  var web3 = await ut.getWeb3(network)
  return await w3.access(
    web3, 
    args.block,
    'MCD_VOW',
    'flop',
    [],
    null, 					// args.abi,
    args.from, 			// args.from,
    0, 							// args.value,
    args.gaslimit, 	// args.gaslimit,
    args.gasprice,  // args.gasprice
    args.nonce  		// args.nonce
  )
}

async function dispTick (args) {
  console.log(await getTick(args))
}

async function getTick (args) {
  var web3 = await ut.getWeb3(network)
  return await w3.access(
    web3, 
    args.block,
    'MCD_FLOP',
    'tick',
    [args.id],
    null, 					// args.abi,
    args.from, 			// args.from,
    0, 							// args.value,
    args.gaslimit, 	// args.gaslimit,
    args.gasprice,  // args.gasprice
    args.nonce      // args.nonce
  )
}

async function dispDent (args) {
  console.log(await getDent(args))
}

async function getDent (args) {
  var web3 = await ut.getWeb3(network)
  var lot
  var beg
  if (!args.amount) {
    const bids = await w3.access(
      web3, 
      args.block,
      'MCD_FLOP',
      'bids',
      [
        args.id
      ],
      null,
      args.from)

    log.info(bids)
    lot = bids.lot
    beg = Number(new BN(await w3.access(web3, args.block, 'MCD_FLOP', 'beg', [])).div(10**18))

    var Bignumber = BN.clone({ 
      DECIMAL_PLACES: 0,
      ROUNDING_MODE: 0})

    lot = new Bignumber(lot).times(10**18).div(beg)
  } else {
    lot = args.amount
  }

  return await w3.access(
    web3, 
    args.block,
    'MCD_FLOP',
    'dent',
    [
      args.id,
      lot,
      new BN(await w3.access(web3, args.block, 'MCD_FLOP', 'bid', [])).toFixed(),
    ],
    null, // args.abi,
    args.from, // args.from,
    0, // args.value,
    args.gaslimit,  // args.gaslimit,
    args.gasprice,  // args.gasprice
    args.nonce
  )
}

async function dispDeal (args) {
  console.log(await getDeal(args))
}

async function getDeal (args) {
  var web3 = await ut.getWeb3(network)
  return await w3.access(
    web3, 
    args.block,
    'MCD_flop',
    'deal',
    [args.id],
    null, // args.abi,
    args.from, // args.from,
    0, // args.value,
    args.gaslimit, // args.gaslimit,
    args.gasprice  // args.gasprice
  )
}

module.exports = {
  dispDeal,
  dispDent,
  dispFlog,
  dispFlop,
  dispTick,
  dispVaultDeposit,
  dispVaultEstimate,
  dispVaultGenerate,
  dispVaultInfo,
  dispVaultOpen,
  dispVaultPayback,
  dispVaultWithdraw,
  estimateGasCost,
  getDeal,
  getDent,
  getFlog,
  getFlop,
  getTick,
  getUrnParams,
  getVaultId,
  vaultDeposit,
  vaultEstimate,
  vaultGenerate,
  vaultInfo,
  vaultOpen,
  vaultPayback,
  vaultWithDraw,
}
