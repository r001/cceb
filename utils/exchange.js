const log4js = require('log4js')
const pressAnyKey = require('press-any-key')
const {decimalToPrecision, TRUNCATE, DECIMAL_PLACES, PAD_WITH_ZERO, SIGNIFICANT_DIGITS} = require ('ccxt')
const chrono = require('chrono-node')
const columnify = require('columnify')
const ut = require('./util')
const w3 = require('./web3.js')
const BN = require('bignumber.js')
var fs = require('fs')
const path = require('path')

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

const baseDir = __dirname + '/../'

process.env.NODE_CONFIG_DIR = (process.env.NODE_CONFIG_DIR
  ?
    process.env.NODE_CONFIG_DIR + require('path').delimiter
  :
    "") +
	baseDir + "config/" + require('path').delimiter + 
	baseDir + "config/secrets/" + require('path').delimiter +
	"../.config/cceb/" + require('path').delimiter +
	"config/radix/" 

process.env.ALLOW_CONFIG_MUTATIONS = 'true'

const config = require('config')

const log = log4js.getLogger()
log.level = config.get('loglevel')
const network = config.get('web3.network')

async function dispAddTrickleOrder (exchange, args) {
  var order
  var totalAmount = args.amount
  var sleepMs
  const market = exchange && exchange.markets && exchange.markets[args.pair]
  while (totalAmount > 0) {

    log.info(`Current total amount: ${totalAmount}`)
    args.amount = Math.min(args.batchSize + (args.batchSizeVariance ? args.batchSizeVariance : 0) * (1 - Math.random()), totalAmount)

    args.amount = decimalToPrecision(
      args.amount,
      TRUNCATE,
      args.aPrecision || (market && market.precision.amount) || 5,
      exchange && exchange.id === 'bitfinex' ? SIGNIFICANT_DIGITS : DECIMAL_PLACES,
      PAD_WITH_ZERO
    )

    log.info(`Current order amount: ${args.amount}`)
    try {
      order = await addOrder(exchange, args)
      log.info(order.id)
      if (order.id !== 'skipped-order') {
        totalAmount -= args.amount
      }
    } catch (e) {
      log.error(e)
    }
    if (order.id === 'skipped-order') {
      sleepMs = args.batchRetrySec * 1000
    } else {

      sleepMs = Math.floor(1000 * 
        (
          args.batchTime +
          (
            args.batchTimeVariance 
            ? 
            args.batchTimeVariance
            : 0
          ) * 
          (
            1 -
            Math.random()
          )
        )
      )
    }
    log.info(`Sleep ${sleepMs / 1000} seconds.`)
    await sleep(sleepMs)
  }
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function dispOrderbook (exchange, args) {
  const orderbook = await ut.getOrderbook(exchange, args)
  let cumulativeSum = 0
  const market = exchange.markets[args.pair]
  const asks = orderbook.asks
  const bids = orderbook.bids
  var priceCurrency = 1
  if (args.currency) {
    priceCurrency = await ut.getPriceInOtherCurrency(
      args.otherExchange,
      args.pair.replace(/.*\//, ''),
      args.currency
    )
  }
  if (args.limit && args.limit < asks.length) asks.length = args.limit
  if (args.limit && args.limit < bids.length) bids.length = args.limit

  var orderColumns = [{price: '---', amount: '---', cumsum: '---'}]

  orderColumns = orderColumns.concat(asks.map(order => [
    decimalToPrecision(
      order[0] * priceCurrency,
      TRUNCATE,
      args.pPrecision || market.precision.price || 5,
      exchange.id === 'bitfinex' ? SIGNIFICANT_DIGITS : DECIMAL_PLACES,
      PAD_WITH_ZERO
    ),
    decimalToPrecision(
      order[1],
      TRUNCATE,
      args.aPrecision || market.precision.amount || 5,
      exchange.id === 'bitfinex' ? SIGNIFICANT_DIGITS : DECIMAL_PLACES,
      PAD_WITH_ZERO
    ),
    decimalToPrecision(
      cumulativeSum += order[1],
      TRUNCATE,
      args.aPrecision || market.precision.amount || 5,
      exchange.id === 'bitfinex' ? SIGNIFICANT_DIGITS : DECIMAL_PLACES,
      PAD_WITH_ZERO
    ),
  ])
    .reverse()
    .map(order => { return {price: order[0], amount: order[1], cumsum: order[2]} }))

  orderColumns.push({price: '---', amount: '---', cumsum: '---'})
  cumulativeSum = 0

  orderColumns = orderColumns.concat(bids.map(order => [
    decimalToPrecision(
      order[0] * priceCurrency,
      TRUNCATE,
      args.pPrecision || market.precision.price || 5,
      exchange.id === 'bitfinex' ? SIGNIFICANT_DIGITS : DECIMAL_PLACES,
      PAD_WITH_ZERO
    ),
    decimalToPrecision(
      order[1],
      TRUNCATE,
      args.aPrecision || market.precision.amount || 5,
      exchange.id === 'bitfinex' ? SIGNIFICANT_DIGITS : DECIMAL_PLACES,
      PAD_WITH_ZERO
    ),
    decimalToPrecision(
      cumulativeSum += order[1],
      TRUNCATE,
      args.aPrecision || market.precision.amount || 5,
      exchange.id === 'bitfinex' ? SIGNIFICANT_DIGITS : DECIMAL_PLACES,
      PAD_WITH_ZERO
    ),
  ])
    .map(order => { return {price: order[0], amount: order[1], cumsum: order[2]} }))

  const columns = columnify(orderColumns, {align: 'right'})
  console.log(columns)
}

async function dispMarkets (exchange, args) {
  console.dir(JSON.stringify(await getMarkets(exchange, args)))
}

async function getMarkets (exchange) {
  return await exchange.loadMarkets()
}

async function removeAllOrders (exchange, args) {
  const orders = await listOrders(exchange, args)
  orders.map(async (order) => await removeOrder(exchange, {order: order.id, symbol: order.symbol}))
  return
}

async function removeOrder (exchange, args) {
  var symbol
  if (typeof args.symbol !== 'undefined') {
    symbol = args.symbol
  } else { 
    const orders = await listOrders(exchange, args)
    const order = orders.find(order => order.id === args.order)
    if (typeof order !== 'undefined') {
      symbol = order['symbol']
    } else {
      throw new Error('Order id ' + args.order + ' does not exist.')
    }
  }
  console.log(args.order, symbol)
  return await exchange.cancelOrder(String(args.order), String(symbol), [])
}

async function dispAddOrder (exchange, args) {
  const order = await addOrder(exchange, args)
  console.log(order.id)
}

async function addOrder (exchange, args) {
  if ((typeof exchange !== 'undefined') && exchange.id === 'okex') {
    exchange.options['createMarketBuyOrderRequiresPrice'] = false
  }
  var amount = args.amount
  const buy = args.side === 'buy'

  // disregard price data if args.type is market
  var price = args.type === 'market' ? undefined : args.price
  args.price = price

  if (!Object.keys(config.get('keys')).includes(args.exchange)) {
    throw new Error('Exchange "' + args.exchange + '" not found in config ./config/default.yaml.')
  }
  const exchangeType = config.get(`keys.${args.exchange}.type`)
  switch (exchangeType) {
    case 'centralized':
      return await addOrderCentralized(exchange, args, amount, buy, price)
    case 'kyber':
      return await addOrderKyber(args, amount, buy, price)
    case 'uniswap':
      return await addOrderUniswap(args, amount, buy, price)
  }
}

async function addOrderUniswap (args, amount, buy) {
  var web3 = await w3.getWeb3(network)

  if (args.type === 'limit') {
    throw new Error(`Limit orders not supported (yet).`)
  }
  const sellToken = buy ? args.pair.replace(/.*\//, '') : args.pair.replace(/\/.*/, '')
  log.info(`Sell token: ${sellToken}`)

  const buyToken = buy ? args.pair.replace(/\/.*/, '') : args.pair.replace(/.*\//, '')
  log.info(`Buy token: ${buyToken}`)

  const sellDecimals = await w3.decimals(web3, args.block, sellToken)
  log.info(`${sellToken} decimals: ${sellDecimals}`)

  const buyDecimals = await w3.decimals(web3, args.block, buyToken)
  log.info(`${buyToken} decimals: ${buyDecimals}`)

  const fromAddress = await w3.getAddress(args.from || config.get('web3.defaultFrom'))
  log.info(`tx from: ${fromAddress}`)

  args.path = await w3.getPath(sellToken, buyToken, args.path)

  var sellAmt
  var buyAmt

  var balance = BN(
    await w3.access(
      web3, 
      args.block,
      sellToken,
      'balanceOf',
      fromAddress,
      null, // abi - not necessary
      args.from,
    )
  )

  if (amount.match(/max/i)) {

    log.info(`${sellToken} balance: ${balance.div(10 ** sellDecimals).toFixed()}`)

    sellAmt = new BN(ut.evalExpr('max', balance.toFixed(), amount, true)).decimalPlaces(0)

    buyAmt = new BN(
      (await w3.access(
        web3, 
        args.block,
        'UNISWAP_ROUTER_V2',
        'getAmountsOut',
        [	
          sellAmt.toFixed(),
          Array.from(JSON.parse(args.path)),
        ],
        null,  //abi name
        args.from,
      )
      ).slice(-1)[0]
    )

    log.info(`Uniswap final amount: ${sellAmt.toString()}`)
  } else {
    const tokenAmt = BN(amount).times(10 ** (buy ? Number(buyDecimals) : Number(sellDecimals))).decimalPlaces(0)

    if (buy) {
      sellAmt = BN(
        (
          await w3.access(
            web3, 
            args.block,
            'UNISWAP_ROUTER_V2',
            'getAmountsIn',
            [	
              tokenAmt.toFixed(),
              Array.from(JSON.parse(args.path)),
            ],
            null,  //abi name
            args.from,
          )
        )[0])

      buyAmt = tokenAmt
    } else {
      sellAmt = tokenAmt

      buyAmt = BN(
        (
          await w3.access(
            web3, 
            args.block,
            'UNISWAP_ROUTER_V2',
            'getAmountsOut',
            [	
              sellAmt.toFixed(),
              Array.from(JSON.parse(args.path)),
            ],
            null,  //abi name
            args.from,
          )
        ).slice(-1)[0]
      )
    }
  }

  const dueTimestampSec = BN((new Date(chrono.parseDate(args.dueTime))).getTime()).div(1000).decimalPlaces(0).toFixed()

  var uniswapFunction = `swap\
      ${buy ? '' : 'Exact'}\
      ${sellToken === 'ETH' ? 'ETH' : 'Tokens'}\
      For\
      ${buy ? 'Exact' : ''}\
      ${buyToken === 'ETH' ? 'ETH' : 'Tokens'}\
      ${buy ? '' : 'SupportingFeeOnTransferTokens'}`.replace(/\s*/g, '')

  const minBuyAmount = buyAmt.times((100. - args.minPercent)/100.).decimalPlaces(0)
  const maxSellAmount = BN.min(balance, sellAmt.times((100. + args.minPercent)/100.).decimalPlaces(0))
  const ethValue = sellToken === 'ETH' ? maxSellAmount.toFixed() : null

  log.debug(JSON.stringify({
    ethValue,
    buyToken,
    buyAmt,
    minBuyAmount,
  }))

  log.debug(JSON.stringify({
    sellToken,
    sellAmt,
    maxSellAmount,
    dueTimestampSec,
  }))

  var uniswapArgs = 
    [
      buy ? buyAmt.toFixed() : sellAmt.toFixed(),
      buy ? maxSellAmount.toFixed() : minBuyAmount.toFixed(),
      Array.from(JSON.parse(args.path)),
      args.to || args.from,
      dueTimestampSec
    ]

  if (sellToken === 'ETH') {
    // remove first element of args
    uniswapArgs.shift()
    uniswapArgs[0] = minBuyAmount.toFixed()
  }

  const a = [
    'UNISWAP_ROUTER_V2',
    uniswapFunction,
    uniswapArgs,
    null,  //abi name
    args.from,
    ethValue,
    args.gaslimit,
    args.gasprice,
    args.nonce
  ]

  log.debug(`w3.access(web3, args.block, ${JSON.stringify(a.slice(0, 2))}...`)
  log.debug(`...${JSON.stringify(a.slice(2))})`)

  const priceToken = 
    buy 
    ? 
    sellAmt.div(BN(10).pow(BN(sellDecimals))).div(buyAmt.div(BN(10).pow(BN(buyDecimals))))
    :
    buyAmt.div(BN(10).pow(BN(buyDecimals)))
    .div(sellAmt.div(BN(10).pow(BN(sellDecimals))))

  const priceDisp = priceToken.toFixed(6)
  const tokensDisp = buy ? buyToken+'/'+sellToken : sellToken + '/' + buyToken
  const buyDisp = buyAmt.div(BN(10).pow(BN(buyDecimals))).toFixed(6)
  var render = []
  if (/max/.test(amount)) {
    const sellDisp = sellAmt.div(BN(10).pow(BN(sellDecimals))).toFixed(6)

    render.push({
      action: 'sell',
      amount: sellDisp,
      token: sellToken
    })
  }

  render.push({
    action: 'price',
    amount: priceDisp,
    token: tokensDisp,
  })

  render.push({
    action: 'receive',
    amount: buyDisp,
    token: buyToken,
  })

  var display = columnify(render,
    {config: {
      amount: {align: 'right'},
    }})

  console.log(display)
  const accType = `web3.account.${await w3.getAddressName(args.from)}.type`
  if (config.has(accType)) {
    if (config.get(accType) !== 'privatekey') {
      await pressAnyKey('Press any key to continue!')
    }
  } else {
    throw new Error('From address must be stored in ./config/secrets/default.yaml -> web3: -> account:')
  }

  const allowance = BN(await w3.access(web3, args.block, sellToken, 'allowance', [args.from, 'UNISWAP_ROUTER_V2']))
  if (allowance.lt(sellAmt)) {
    await w3.access(
      web3, 
      args.block,
      sellToken,
      'approve',
      ['UNISWAP_ROUTER_V2', BN(2).pow(256).minus(1).toFixed()],
      null,
      args.from,
      0,
      args.gaslimit,
      args.gasprice,
      args.nonce
    )
  }

  if (args._[1] !== 'trickle' ||
    ( buy && priceToken.lt(args.batchMinRate)) ||
    (!buy && priceToken.gt(args.batchMinRate))) {

    log.debug(`Final params:`, {a})

    const receipt = await w3.access(web3, args.block, ...a, null, args._[1] === 'trickle')

    if (!receipt.status) {
      log.error(`Transaction reverted`)
      log.debug(`Receipt: ${JSON.stringify(receipt)}`)
      return {id: 'skipped-order'}
    }
    return {id: 'no-order-id'}
  } else {
    log.warn(`Order skipped because Uniswap rate ${priceDisp} ${buy ? 'greater' : 'less'} than allowed rate ${args.batchMinRate}.`)
    return {id: 'skipped-order'}
  }
}

async function addOrderKyber (args, amount, buy) {
  const network = config.get('web3.network')
  var web3 = await w3.getWeb3(network)

  if (args.type === 'limit') {
    log.error(`Limit orders not supported (yet).`)
    process.exit(1)
  }

  const sellToken = buy ? args.pair.replace(/.*\//, '') : args.pair.replace(/\/.*/, '')
  log.info(`Sell token: ${sellToken}`)

  const buyToken = buy ? args.pair.replace(/\/.*/, '') : args.pair.replace(/.*\//, '')
  log.info(`Buy token: ${buyToken}`)

  const sellDecimals = await w3.decimals(web3, args.block, sellToken)
  log.info(`${sellToken} decimals: ${sellDecimals}`)

  const buyDecimals = await w3.decimals(web3, args.block, buyToken)
  log.info(`${buyToken} decimals: ${buyDecimals}`)

  var buyTokenCap
  try {
    buyTokenCap = new BN(await w3.access(
      web3, 
      args.block,
      'KyberNetworkProxy',
      'getUserCapInTokenWei',
      [
        config.get('web3.defaultFrom'),
        buyToken
      ]
    ))
  } catch (e) {
    buyTokenCap = new BN(w3.MAX_DEST_AMOUNT)
  }
  log.info(`Kyber ${buyToken} cap: ${buyTokenCap.div(10 ** buyDecimals).toString()}`)


  if (amount.match(/max/i)) {
    if (sellToken === 'ETH') {
      var balance = new BN(await web3.eth.getBalance(await w3.getAddress(config.get('web3.defaultFrom'))))
    } else {
      balance = new BN(await w3.access(
        web3, 
        args.block,
        sellToken,
        'balanceOf',
        config.get('web3.defaultFrom'),
        'ERC20'
      ))
    }
    log.info(`Balance: ${balance.div(10 ** sellDecimals).toString()}`)

    let {expectedRate: kyberRate} = await w3.access(
      web3, 
      args.block,
      'KyberNetworkProxy',
      'getExpectedRate',
      [
        sellToken,
        buyToken,
        balance.toString(),
      ]
    )

    kyberRate = new BN(kyberRate)
    log.info(`Kyber rate: ${kyberRate.div(10 ** 18).toString()}`)

    const maxSellAmt = ut.minBN(
      balance,
      buyTokenCap
      .times(10 ** sellDecimals) // decimals of sellToken
      .times(10 ** 18) // decimals of kyberRate
      .div(10 ** buyDecimals)  // decimals of buyToken
      .div(kyberRate),
    )

    log.info(`Kyber maxSellAmt: ${maxSellAmt.div(10 ** sellDecimals).toString()}`)

    var amt = new BN(ut.evalExpr('max', maxSellAmt.toString(), amount, true))
    log.info(`Kyber final amount: ${amt.toString()}`)
  } else {
    amount = new BN(amount)

    let {expectedRate: kyberRate} = await w3.access(
      web3, 
      args.block,
      'KyberNetworkProxy',
      'getExpectedRate',
      [
        sellToken,
        buyToken,
        '1000000000000000000',
      ])

    kyberRate = new BN(kyberRate)
    // log.info(`Kyber rate: ${kyberRate.div(10 ** 18).toString()}`)

    if (kyberRate.toString() === '0') {
      log.error(`There is no liquidiy on Kyber.`)
      process.exit(1)
    }

    var sellTokenAmt = buy ? amount
      .times(10 ** buyDecimals)
      .times(10 ** 18)
      .div(kyberRate)
      .decimalPlaces(0)
      : amount
      .times(10 ** sellDecimals)
      .decimalPlaces(0)

    log.info(`Kyber sell token amount: ${sellTokenAmt.toString()}`)

    if (buy) { // iterate another to find a close enough sellTokenAmt
      let {'expectedRate': kyberRate} = await w3.access(
        web3, 
        args.block,
        'KyberNetworkProxy',
        'getExpectedRate',
        [
          sellToken,
          buyToken,
          sellTokenAmt.toString(),
        ]
      )

      kyberRate = new BN(kyberRate)
      log.info(`Kyber rate: ${kyberRate.div(10 ** 18).toString()}`)

      sellTokenAmt = amount
        .times(10 ** buyDecimals)
        .times(10 ** 18)
        .div(kyberRate)
        .decimalPlaces(0)

      log.info(`Kyber amount: ${sellTokenAmt.toString()}`)
    }

    if (buyTokenCap.lt(sellTokenAmt.times(kyberRate))) {
      log.error(`Sell amount (${sellTokenAmt.times(kyberRate).toString()}) exceeds user cap (${buyTokenCap})`)
      throw new Error('Sell amount exceeds user cap')
    }
    amt = sellTokenAmt
  }

  let {expectedRate: kyberRate} = await w3.access(
    web3, 
    args.block,
    'KyberNetworkProxy',
    'getExpectedRate',
    [
      sellToken,
      buyToken,
      amt.toString(),
    ])

  kyberRate = new BN(kyberRate)
  log.info(`Kyber rate: ${kyberRate.div(10 ** 18).toString()}`)
  if (kyberRate.div(10 ** 18).gt(new BN(args.batchMinRate))) {
    const receipt = await w3.kyberTrade(
      web3,
      config.get('web3.defaultFrom'),
      sellToken,
      amt.toString(),
      buyToken,
      config.get('web3.defaultFrom'),
      w3.MAX_DEST_AMOUNT,
      '0',
      '0x0000000000000000000000000000000000000000',
      args.gaslimit,
      args.gasprice,
      args.nonce
    )

    if (!receipt.status) {
      log.error(`Transaction reverted`)
      log.debug(`Receipt: ${JSON.stringify(receipt)}`)
      process.exit(1)
    }
    return {id: 'no-order-id'}
  } else {
    log.warn(`Order skipped because kyber rate ${kyberRate.div(10 ** 18).toString()} less than current min rate ${args.batchMinRate}.`)
    return {id: 'skipped-order'}
  }
}

async function addOrderCentralized (exchange, args, amount, buy, price) {
  const quoteToken = args.pair.replace(/.*\//, '')
  const baseToken = args.pair.replace(/\/.*/, '')
  const currPrice = await ut.getPriceInOtherCurrency (args.exchange, baseToken, quoteToken)
  log.debug(`currPrice: ${currPrice}`)
  if (args.batchMinRate) {
    if ((buy && currPrice > args.batchMinRate) || (!buy && currPrice < args.batchMinRate)) {
      return {id: 'skipped-order'}
    }
  }
  if (amount.match(/max/i)) {
    const token = buy ? args.pair.replace(/.*\//, '') : args.pair.replace(/\/.*/, '')
    const dust = config.get('dust-limit')
    const tokenAmount = (await listBalances(exchange, {token, dust}, {type: 'free'}))[token]
    log.debug(`tokenAmount: ${tokenAmount}`)
    if (args.type === 'limit') {
      var finalAmount = buy ? tokenAmount / args.price : tokenAmount
    } else {
      finalAmount = buy ? await getSpendAmountFromOrderbook(exchange, tokenAmount, args) : tokenAmount
    }
    log.debug(`finalAmount: ${finalAmount}`)
    amount = ut.evalExpr('max', finalAmount, amount)
  } else await exchange.loadMarkets()

  const market = exchange.markets[args.pair]

  log.debug('amount: ' + amount)
  if (args.type === 'market' && !exchange.has['createMarketOrder']) {
    const type = 'limit'

    const maxPrice = market['max'] && market['max']['price'] ?
      market['max']['price'] :
      1000000

    log.debug(`market maxPrice ${maxPrice}`)

    const minPrice = market['min'] && market['min']['price'] ?
      market['min']['price'] :
      0

    log.debug(`market minPrice ${minPrice}`)

    price = buy ? maxPrice : minPrice
    const {price: finalPrice, amount: finalAmount} = await fitPriceAndAmountToMarket(exchange, price, amount)
    return await exchange.createOrder(args.pair, type, args.side, finalAmount, finalPrice, args.params)
  } else {
    const {price: finalPrice, amount: finalAmount} = await fitPriceAndAmountToMarket(exchange, price, amount, args.pair)
    log.debug(`finalPrice ${finalPrice} finalAmount ${finalAmount}`)
    return await exchange.createOrder(args.pair, args.type, args.side, finalAmount, finalPrice, args.params)
  }
}

async function fitPriceAndAmountToMarket (exchange, price, amount, pair) {
  const market = exchange.markets[pair]

  const minAmount = market['min'] && market['min']['amount'] ? market['min']['amount'] : 0
  const maxAmount = market['max'] && market['max']['amount'] ? market['max']['amount'] : 1000000
  log.debug(`market minAmount: ${minAmount}`)	
  log.debug(`market maxAmount: ${maxAmount}`)	

  log.debug(`amount before check min max: ${amount}`)
  if (amount < minAmount) amount = minAmount
  if (amount > maxAmount) amount = maxAmount
  log.debug(`amount after  check min max: ${amount}`)

  log.debug(`amount before truncate: ${amount}`)
  log.debug(`amount precision: ${market.precision.amount}`)

  log.debug(`\
    sigdig ${SIGNIFICANT_DIGITS}\
    decpl: ${DECIMAL_PLACES}\
    final: ${exchange.id.match(/bitfinex|okex/) ? SIGNIFICANT_DIGITS : DECIMAL_PLACES}\
    exchangeid: ${exchange.id}`)

  log.debug(`precision reported by market:${market.precision.amount}`)
  if (market.precision.amount !== 0) {	
    amount = decimalToPrecision(
      amount,
      TRUNCATE,
      //some exchanges report precision 
      market.precision.amount < 1 ? market.precision.amount.toString().split('.')[1].length || 0 : market.precision.amount,
      exchange.id.match(/bitfinex/) ? SIGNIFICANT_DIGITS : DECIMAL_PLACES
    )
  }
  log.debug(`amount after truncate: ${amount}`)

  log.debug(`price before adust: ${price}`)
  if (price) {
    const maxPrice = market['max'] ?
      market['max']['price'] :
      1000000

    const minPrice = market['min'] ?
      market['min']['price'] :
      0

    price = price < minPrice ? minPrice : price
    price = price > maxPrice ? maxPrice : price
    if (
      market['max'] &&
      market['max']['cost'] &&
      amount * price > market['max']['cost']
    ) {
      price = market['max']['cost'] / amount
    }

    if (
      market['min'] &&
      market['min']['cost'] &&
      amount * price < market['min']['cost']
    ) {
      price = market['max']['cost'] / amount
    }
    log.debug(`price before adust: ${price}`)

    log.debug(`price before truncate: ${price}`)
    log.debug(`price precision: ${market.precision.price}`)

    log.debug(`\\
      sigdig ${SIGNIFICANT_DIGITS} decpl: ${DECIMAL_PLACES}\\
      final: ${exchange.id.match(/bitfinex|okex/) ? SIGNIFICANT_DIGITS : DECIMAL_PLACES}\\
      exchangeid: ${exchange.id}`)

    price = decimalToPrecision(
      price,
      TRUNCATE,
      market.precision.price < 1 ? market.precision.price.toString().split('.')[1].length || 0 : market.precision.price,
      exchange.id.match(/bitfinex/) ? SIGNIFICANT_DIGITS : DECIMAL_PLACES
    )

    log.debug(`price after truncate: ${price}`)

  }
  return {price, amount}
}

async function getSpendAmountFromOrderbook (exchange, tokenAmount, args) {
  const orderbook = await ut.getOrderbook(exchange, args)
  var amountToSpend = tokenAmount
  var orderNum = 0
  var finalAmount = 0
  while (amountToSpend > 0 && orderNum < orderbook.asks.length) {
    const sellPrice = orderbook.asks[orderNum][0]
    const sellAmount = orderbook.asks[orderNum][1]
    if (amountToSpend > sellPrice * sellAmount) {
      finalAmount += sellAmount
      amountToSpend -= sellPrice * sellAmount
    } else {
      finalAmount += amountToSpend / sellPrice
      amountToSpend = 0
    }
    orderNum++
  }
  return finalAmount
}

async function lockedAmount (exchange, token) {
  const orders = await listOrders(exchange, {pair: undefined, since: undefined, limit: undefined})
  const pairBuy = new RegExp('.*/' + token)
  const pairSell = new RegExp(token + '/.*')
  return orders.filter(
    order => order.side === 'buy' && order.symbol.match(pairBuy) ||
    order.side === 'sell' && order.symbol.match(pairSell)
  )
    .map(order => order.side === 'buy' ? order.remaining * order.price : order.remaining)
    .reduce((total, remaining) => total + remaining, 0)
}

async function dispListOrders (exchange, args) {
  const orders = await listOrders(exchange, args)
  orders.map(order => console.log(order.id + ' ' + order.type + ' ' + order.side + ' ' + order.amount + ' ' + order.symbol + ' ' + order.price))
}

async function listOrders (exchange, args) {
  if (exchange.id === 'binance') {
    exchange.options['warnOnFetchOpenOrdersWithoutSymbol'] = false
    console.log('Rate limit: Do not start this in 271 secs to avoid ban.')
  }
  const fetchOrders = args.closed ? exchange.fetchClosedOrders.bind(exchange) : exchange.fetchOpenOrders.bind(exchange)
  args.closed && exchange.loadMarkets()
  if (!args.closed && exchange.has['fetchOpenOrders'] ||
    args.closed && exchange.has['fetchClosedOrders']) {
    return await fetchOrders(args.pair, args.since, args.limit)
  } else {
    throw new Error('Exchange does not support fetching open offers.')
  }
}

async function dispDeposit (exchange, args) {
  console.log(await deposit(exchange, args))
}

async function deposit (exchange, args) {
  const deposit = await exchange.fetchDepositAddress(args.token)
  return deposit.address
}

async function withdraw (exchange, args) {
  var amt = args.amount
  if (amt.match(/max/i)) {

    // security check

    args.dust = config.get('dust-limit')
    const balances = await listBalances(exchange, args)
    const balanceValue = balances[args.token]
    const lockedValue = await lockedAmount(exchange, args.token)
    amt = ut.evalExpr('max', balanceValue - lockedValue, amt)

    amt = decimalToPrecision(
      amt,
      TRUNCATE,
      args.digits,
      DECIMAL_PLACES
    )
  }

  log.debug('amount:', amt)
  const confStart = 'withdraw.' + args.exchange
  var confToken = confStart + '.' + args.token
  if (!config.has(confToken)) {
    confToken = confStart + '.default'
    if (!config.has(confToken)) {
      throw new Error('Withdrawal for token ' + args.token + ' not defined in config.')
    }
  }
  const confDestPart = confToken + '.' + args.destination
  const confDestination = confDestPart + '.destination'
  const confTag = confDestPart + '.tag'
  const confParams = confDestPart + '.params'
  var tag
  if (config.has(confTag)) tag = config.get(confTag)
  const address = config.get(confDestination)
  const params = config.get(confParams)
	if (params && params.trade_pwd) {
		params.trade_pwd = 
			fs.readFileSync(
				path.join(
					config.get('passwordDir'),
					params.trade_pwd
				),
			'utf8'
		).trim()
	}
  await exchange.withdraw(args.token, amt, address, tag, params)
}

async function dispListBalances (exchange, args, params) {
  const balances = await listBalances(exchange, args, params)
  Object.keys(balances).map(currency => console.log(currency + ' ' + balances[currency]))
}

async function listBalances (exchange, args, params = {}) {
  var filtered
	log.debug(`params: ${JSON.stringify(params)}`)
  var balances = await exchange.fetchBalance(params)
  const balanceType = (params && params.type) || 'total'
  var balance = balances[balanceType]
  log.debug(`balance from ccxt: ${JSON.stringify(balance)}`)
  log.debug(`typeof balance: ${typeof balance}`)
  if (typeof balance === 'undefined' || JSON.stringify(balance) === '{}') { 
    log.warn(`balance is not useable`)

    //log.debug(`balances: ${JSON.stringify(balances)}`)
    balances = balances.info.balances &&
      balances.info.balances.reduce(
        (entry, asset) => {
          entry = {
            ...entry,
            [asset.asset]:{
              free: Number(asset.free),
              locked: Number(asset.locked),
              total: Number(asset.locked) + Number(asset.free)
            },

            total: {
              ...entry.total,
              [asset.asset]: Number(asset.locked) + Number(asset.free)
            },

            free: {
              ...entry.free,
              [asset.asset]: Number(asset.free)
            },

            locked: {
              ...entry.locked,
              [asset.asset]: Number(asset.locked)
            }
          }

          return entry
        },
        {})

    //log.debug(`balances: ${JSON.stringify(balances)}`)
    balance = balances[balanceType]
  }

  log.debug(JSON.stringify(balance))
  log.debug(`args.token: ${args.token}`)
  if (typeof balance !== 'undefined') { 
    filtered = Object
      .keys(balance)
      .filter(currency => balance[currency] >= args.dust && (!args.token || args.token === currency))
      .reduce((bal, currency) => { bal[currency] = balance[currency]; return bal }, {})
  } else {
    if (params.type === 'free') {
      balance = balances['total']

      filtered = Object
        .keys(balance)
        .filter(currency => balance[currency] >= args.dust && (!args.token || args.token === currency))

      filtered = await filtered
        .reduce(async (bal, currency) => { bal[currency] = balance[currency] - await lockedAmount(exchange, currency); return bal }, {})
    }
  }
  return filtered
}

module.exports = {
  addOrder,
  addOrderCentralized,
  addOrderKyber,
  addOrderUniswap,
  deposit,
  dispAddOrder,
  dispAddTrickleOrder,
  dispDeposit,
  dispListBalances,
  dispListOrders,
  dispMarkets,
  dispOrderbook,
  fitPriceAndAmountToMarket,
  getMarkets,
  getSpendAmountFromOrderbook,
  listBalances,
  listOrders,
  lockedAmount,
  removeAllOrders,
  removeOrder,
  withdraw,
}
