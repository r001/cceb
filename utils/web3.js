const baseDir = '/home/user/ccxt/' 
process.env["NODE_CONFIG_DIR"] = baseDir + "config/" + require('path').delimiter + baseDir + "config/secrets/"
var config = require('config')
const qrEncoding = require('eth-airsign-util')
const QRCode = require('qrcode')
const Web3 = require('web3')
const BN = require('bignumber.js')
const Transaction = require('ethereumjs-tx')
const axios = require('axios')
var log4js = require('log4js')
var fs = require('fs')
const network = config.get('web3.network')
const pressAnyKey = require('press-any-key')
const shell = require('shelljs')
const TransportNodeHid = require("@ledgerhq/hw-transport-node-hid-singleton").default;
const Eth = require("@ledgerhq/hw-app-eth").default;
// console.log(network)
var web3 = new Web3(Web3.givenProvider || new Web3.providers.WebsocketProvider(config.get(`web3.${network}.infura.url`) + config.get(`web3.${network}.infura.api-key`)))

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
const MAX_DEST_AMOUNT = '115792089237316195423570985008687907853269984665640564039457584007913129639935'
if (require.main === module) {

  (async () => {
  })()
}

function toHex (value) {
 const raw = web3.utils.toHex(value)
 return '0x' + (raw.length % 2 === 1 ? '0' : '') + raw.slice(2)
}

// Function to broadcast transactions
async function broadcastTx (from, to, txData, value, gasLimit, gasPrice, nonce, signature) {
  const txCount = nonce || await web3.eth.getTransactionCount(from)

  const network = config.get('web3.network')

  const rawTx = {
    from: from,
    to: to,
    data: txData,
    value: toHex(value),
    gasLimit: toHex(gasLimit),
    gasPrice: toHex(gasPrice),
    nonce: toHex(txCount),
  }

  log.debug(rawTx)
  const accounts = config.get(`web3.account`)
  const accountType = accounts[Object.keys(accounts).filter(key => accounts[key].address === from)[0]].type

  if (!signature && accountType === 'airsign') {
    log.info(`External signer used`)

    const signable = {
      from: rawTx.from,
      type: 'sign_transaction',
      payload: {
        ...rawTx,
        chainId: config.get(`web3.${network}.chainid`) 
      }
    }

    delete signable.payload.from

    log.debug(`signable: ${JSON.stringify(signable)}`)

    const encoded = qrEncoding.encode(JSON.stringify(signable))
 
    await QRCode.toString(encoded, {type: 'terminal'}, (err, str) => {
      if (err) throw new Error(err)
      console.log(str) //FIXME: make this optional 
    })

    console.log(encoded)
    console.log('')

    // console.log(`  ./ccb eth send '{"from": "${from}", ${Object.keys(signable.payload).map(key => `"${key}": "${signable.payload[key]}"`).join(', ')}}' <signature>`)

    await pressAnyKey('Press any key to continue!')
    signature = shell.exec("zbarcam").stdout
    signature = signature.replace(/^.*0x/, '') 
  }

  if (!signature && accountType === 'ledger') {
    const rawLedger = {...rawTx,
        chainId: config.get(`web3.${network}.chainid`),
        v: toHex(config.get(`web3.${network}.chainid`)),
        r: '0x00',
        s: '0x00',
      }

    log.debug({rawLedger})
    var lTx = new Transaction(rawLedger)

    log.debug({serialized:lTx.serialize().toString("hex"), r: lTx.r.toString("hex"), s:lTx.s.toString("hex"), v:lTx.v.toString("hex")})
    
    const derivePath = await getLedgerDerivePath('Ethereum', rawTx.from)
    log.debug({derivePath})
    const transport = await TransportNodeHid.create();
    const eth = new Eth(transport)
    const signed = await eth.signTransaction(derivePath, lTx.serialize().toString("hex"))
    signature = signed.r + signed.s + signed.v
    await transport.close()
  }

  if (signature) {
    const signedUri = signature.replace(/^0x/, "")
    const r = '0x' + signedUri.substr(0, 64)
    const s = '0x' + signedUri.substr(64, 64)
    const v = '0x' + signedUri.substr(128, 2)
    log.debug(`r: ${r}`)
    log.debug(`s: ${s}`)
    log.debug(`v: ${v}`)
    Object.assign(rawTx, {r, s, v})
  }

  log.debug(`value: ${value}`)
  log.debug('Raw tx: ', rawTx)
  const tx = new Transaction(rawTx, {chain: config.get(`web3.${network}.chainid`)})
  log.debug('gasPrice: ', '0x' + tx.gasPrice.toString("hex"))
  log.debug('gasLimit: ', '0x' + tx.gasLimit.toString("hex"))
  log.debug('value: ', '0x' + tx.value.toString("hex"))

  if (!signature) {
    const account = await getAddressName(from)

    const privateKey = Buffer.from(config.get(`web3.account.${account}.privatekey`), 'hex')
    tx.sign(privateKey)
  }
  log.debug('from: ', '0x' + tx.from.toString("hex"))

  if (!tx.verifySignature()) {
    throw new Error('Signature invalid.')
  }

  const serializedTx = tx.serialize()
  log.debug(JSON.stringify({serializedTx: '0x' + serializedTx.toString('hex')}))
  console.log('Tx hash: 0x' + tx.hash(true).toString('hex'))
  log.info('Sendig transaction...')
  const txReceipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('error', console.error)

  // Log the tx receipt
  //log.debug(txReceipt)
  log.info('Transaction confirmed.')
  return txReceipt
}

async function getLedgerDerivePath (wallet, from, transport) {
  switch (wallet) {
    case 'Ethereum':
      return await getLedgerEthereumDerivePath(from, transport)
    default:
      throw new Error(`Ledger wallet '${wallet}' not supported yet.`)
  }
}

async function getLedgerEthereumDerivePath (from, transport) {
  const fromName = await getAddressName(from) 
  from = await getAddress(from)
  const derivePathLoc = `web3.account.${fromName}.derivePath`
  if (config.has(derivePathLoc)) {
    return config.get(derivePathLoc) 
  } 
  transport = transport || await TransportNodeHid.create();
  const eth = new Eth(transport)
  var derivePathNotFound = true
  var loc = 0
  var derivePathLegacy = `44'/60'/0'/${loc}`
  var derivePathLive = `44'/60'/${loc}`
  var address = (await eth.getAddress(derivePathLegacy)).address
  while (derivePathNotFound) {
    if (address.toLowerCase() === from.toLowerCase()) {
      return derivePathLegacy
    }
    address = (await eth.getAddress(derivePathLive)).address
    if (address.toLowerCase() === from.toLowerCase()) {
      return derivePathLive
    }
    loc++;
    derivePathLegacy = `44'/60'/0'/${loc}`
    derivePathLive = `44'/60'/${loc}`
    address = (await eth.getAddress(derivePathLegacy)).address
  }
  await transport.close()
}

async function getGasPrice () {
  let gasPrice
  try {
    const gasPrices = await axios.get(config.get('web3.ethgasstation.url') + config.get('web3.ethgasstation.api-key'), {timeout: config.get('web3.ethgasstation.timeout')})
    gasPrice = new BN(gasPrices['data'][config.get('web3.txSpeed') ] / 10).times(10 ** 9)
    //log.debug('Ethgasstation result: ', gasPrices)
    log.info('Ethgasstation gasprice: ' + BN(gasPrice).div(10 ** 9).toString() + ' GWei')
  } catch (e) {
    log.debug('Ethgasstation did not work.')
    gasPrice = await web3.eth.getGasPrice()
    log.info('Web3 gasprice: ' + new BN(gasPrice).div(10 ** 9).toString() + ' GWei')
  }
  return gasPrice
}

// Function to obtain conversion rate between src token and dst token
async function kyberGetRates (SRC_TOKEN_ADDRESS, DST_TOKEN_ADDRESS, SRC_QTY_WEI) {
  return await access('KyberNetworkProxy', 'getExpectedRate', [SRC_TOKEN_ADDRESS, DST_TOKEN_ADDRESS, SRC_QTY_WEI])
}

// Function to convert src token to dst token
async function kyberTrade (
  from,
  srcTokenAddress,
  srcQtyWei,
  dstTokenAddress,
  dstAddress,
  maxDstAmount,
  minConversionRate,
  walletId
) {
  from = await getAddress(from)
  srcTokenAddress = await getAddress(srcTokenAddress)
  dstTokenAddress = await getAddress(dstTokenAddress)
  dstAddress = await getAddress(dstAddress)
  const MAX_DEST_AMOUNT = '115792089237316195423570985008687907853269984665640564039457584007913129639935'
  if (srcTokenAddress !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
    // const allowance = await SRC_TOKEN_CONTRACT.methods.allowance(USER_ADDRESS, KYBER_NETWORK_PROXY_ADDRESS).call()
    const allowance = await access(srcTokenAddress, 'allowance', [from, 'KyberNetworkProxy'], 'ERC20')
    if (new BN(allowance).lt(new BN(srcQtyWei))) {

      const decimals = await decimals(srcTokenAddress)

      const allowanceStr = new BN(allowance).div(10 ** Number(decimals)).toString()
      log.warn(`Allowance (${allowanceStr}) is not enough, approving max...`)

      // const approveTxData = await SRC_TOKEN_CONTRACT.methods.approve(KYBER_NETWORK_PROXY_ADDRESS, MAX_DEST_AMOUNT).encodeABI()
      var receipt = await access(
        srcTokenAddress,
        'approve',
        [
          'KyberNetworkProxy',
          MAX_DEST_AMOUNT,
        ],
        'ERC20',
        from,
        0
      )

      if (!receipt.status) {
        throw Error('Approve was reverted.')
      }
    }

  } else {
    const ethBalance = parseInt(await web3.eth.getBalance(from), 10)
    if (ethBalance < srcQtyWei) {
      const strBalance = new BN(ethBalance).div(10 ** 18).toString()
      const strQty = new BN(srcQtyWei).div(10 ** 18).toString()
      throw Error(`Current Ether balance is: ${strBalance} Ether, Ether to spend is larger: ${strQty} Ether`)
    }
  }
  var gasPrice = new BN(await getGasPrice())
  log.info(`Gasprice: ${gasPrice.div(10 ** 9).toString()} GWei`)

  const maxGasPrice = new BN(await getKyberMaxGasPrice())
  log.info(`Kyber max gasprice: ${maxGasPrice.div(10 ** 9).toString()} GWei`)

  if (gasPrice.gte(maxGasPrice)) gasPrice = maxGasPrice
  log.info('Final gas price: ' + gasPrice.div(10 ** 9).toString() + ' GWei')

  log.info(`Broadcasting tx...`)
  return await access(
    'KyberNetworkProxy', // contract
    'trade', // function
    [
      srcTokenAddress, // arg 0 of function trade()
      srcQtyWei, // arg 1 of function trade()
      dstTokenAddress, // arg 2 of function trade()
      dstAddress, // arg 3 of function trade()
      maxDstAmount, // arg 4 of function trade()
      minConversionRate, // arg 5 of function trade()
      walletId, // arg 6 of function trade()
    ],
    null, // abi defaults to <contract>.abi
    null, // from address defaults to web3.defaultFrom
    srcTokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? srcQtyWei : 0, // value
    null, // gasLimit defaults to estimation
    gasPrice.toString(), // gasPrice
  )
}

async function getKyberMaxGasPrice () {
  return await access('KyberNetworkProxy', 'maxGasPrice')
}

async function getAbiFunctions (abi, regexp) {
  log.debug(`abi: ${abi}`)
  log.debug(`regexp: ${regexp}`)
  const abiJson = await getAbi(abi)
  const contract = new web3.eth.Contract(abiJson) 
  return contract.options.jsonInterface
    .filter(abi =>
      (
        abi.type === 'function' ||
        !abi.type
      )

    )
    .map(abi =>
      abi.name 
      + '(' + abi.inputs.map(input => `${input.type} ${input.name || '_input' }`).join(', ') + ')' +
      '(' + abi.outputs.map(output => `${output.type} ${output.name || '_output' }`).join(', ') + ')' +
      (abi.payable === 'true' || (abi.stateMutability && /^payable$/.test(abi.stateMutability)) ? ' payable' : '') +
      ((abi.stateMutability && !/nonPayable|payable/.test(abi.stateMutability)) || abi.constant ? ` ${abi.stateMutability || 'view'}` : '')
    )
    .filter(func => (new RegExp(regexp, 'i')).test(func))

}

async function getSourceCode (address) {
  try {
    var source = await axios.get(
      config.get('web3.etherscan.url') + config.get('web3.etherscan.api-key') + '&action=getsourcecode&address=' + await getAddress(address),
      {timeout: config.get('web3.etherscan.timeout')}
    )

    return source.data.result[0].SourceCode.replace(/\r/g, '')
  } catch (e) {
    throw new Error('Could not download source code')
  }
}

async function getAbi (abi, address) {
  try {
    var abiJson = JSON.parse(fs.readFileSync(`abi/${abi}`, 'utf8'))
  } catch (e) {
    try {
      log.debug('Downloading abi from etherscan.')
      try {
        abiJson = await axios.get(
          config.get('web3.etherscan.url') + '&action=getabi&address=' + await getAddress(abi),
          {timeout: config.get('web3.etherscan.timeout')}
        )
      } catch (e) {
        log.debug(`address: ${address}`)
        if (address) {
          abiJson = await axios.get(
            config.get('web3.etherscan.url') + '&action=getabi&address=' + address,
            {timeout: config.get('web3.etherscan.timeout')}
          )
        } else {
          throw new Error(`Either config must contain ${abi} or address must be provided.`)
        }
      }
      abiJson = JSON.parse(abiJson.data.result)

      log.debug(`Writing abi/${abi}`)

      fs.writeFileSync(
        `abi/${abi}`,
        JSON.stringify(abiJson),
        () => {
          throw Error(`File abi/${abi} could not be written.`)
        })  
    } catch (e) {
      throw Error(`Could download abi. Either timeout or valid value must be in config/default.yaml->web3->etherscan.`)
    }
  }
  return abiJson
}

async function access (to, funcName, args = [], abi, from, value, gasLimit, gasPrice, inputs, multipleUse) {
  if (multipleUse) {
    web3 = new Web3(Web3.givenProvider || new Web3.providers.WebsocketProvider(config.get(`web3.${network}.infura.url`) + config.get(`web3.${network}.infura.api-key`)))
  }
  web3.eth.handleRevert = true

  const dispCall = `${to}.${funcName}(${args})`+
    (abi ? ` abi ${abi}` : '') +
    (from ? ` from ${await getAddress(from)}` : '') +
    (value ? ` value ${value}` : '') +
    (gasLimit ? ` gasLimit ${gasLimit}` : '') +
    (gasPrice ? ` gasPrice ${gasPrice}` : '')

  log.info(dispCall)

  if (!abi || abi === '') {
    var {name:toName, type} = await getAddressNameType(to)
    if (type === 'token') {
      const fs = require("fs"); 
      if (fs.existsSync("abi/" + toName)) { // if he has his own abi
        abi = toName
      } else {
        abi = 'ERC20'
      }
    } else {
      abi = toName
    }
    log.debug(`Value of 'abi' was null or '', now it is ${abi}.`)
  }
  if (!value) {
    value = 0
    log.debug(`Value of 'value' was null , now it is ${value}.`)
  }
  if (from === '' || !from) {
    from = config.get('web3.defaultFrom')
    log.debug(`Value of 'from' changed to: '${from}'`)
  }
  if (!Array.isArray(args)) {
    log.debug('Args was not an array, arrayify it.')
    args = [args]
  }
  to = await getAddress(to)
  const ether = to.match(/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/i) 
  log.debug(`Value of 'to' changed to: '${to}'`)
  from = await getAddress(from)
  log.debug(`Value of 'from' changed to: '${from}'`)

  var contract
  var methodName
  if (!ether) {
    const abiJson = await getAbi(abi)
    contract = new web3.eth.Contract(abiJson, to)
    const funcNameReg = new RegExp('^' + funcName + '$', '')

    const funcObject = contract.options.jsonInterface
      .filter(abi =>
        (
          abi.type === 'function' ||
          !abi.type
        ) &&

        funcNameReg.test(abi.name) &&

        (!inputs || (abi.inputs.filter((input, index) => input.type === inputs[index]).length === inputs.length &&
          inputs.length === abi.inputs.length)) &&

        args.length === abi.inputs.length

      )[0]

    funcName = funcObject['name']

    methodName = funcName +
      '(' +
      funcObject['inputs'].reduce((total, input) => total + (total === '' ? '' : ',') + input.type, '') +
      ')'

    log.debug(`Method is: ${methodName}`)
    const inputTypes = funcObject['inputs'].map(input => input.type)
    //log.debug(`inputTypes: ${inputTypes}`)

    log.debug(`Args originally are: ${args}`)

    if (args.length !== inputTypes.length) {
      throw Error(`Wrong number of args. Should be ${inputTypes.length} and it is ${args.length}.`)
    }

    // substitute address name with address from config, remove all dots from uint values
    args = await Promise.all(inputTypes.map(async (type, index) =>
      type === 'address' ? await getAddress(args[index]) : 
      type.match(/address\[\d*\]/) ? await Promise.all(args[index].map(async (address) => await getAddress(address))) :

      type.match(/uint\d*$/) ? args[index].replace(/\./g, "") :
      type.match(/uint\d*\[\d*\]/) ? args[index].map( (uint) => String(uint).replace(/\./g, "")) :
      args[index]
    ))

    log.debug(`Args expanded are: ${JSON.stringify(args)}`)

    var isCall =
      (
        funcObject['stateMutability'] &&
        (
          funcObject['stateMutability'] === 'pure' ||
          funcObject['stateMutability'] === 'view'
        )
      ) ||
      (
        funcObject['constant'] &&
        (
          funcObject['constant'] === true ||
          funcObject['constant'] === 'true'
        )
      )
  } else {
    if (['transfer', 'transferFrom'].includes(funcName)) {
      isCall = false
    } else {
      isCall = true
    }
  }

  var ret
  if (isCall) {
    if (!ether) {
      log.debug(`Call method is used to access ${methodName} function.`)
      ret = await contract.methods[methodName](...args).call()
      log.debug(`Result: ${JSON.stringify(ret)}`)
    } else {
      if (funcName.match(/^balanceOf$|^balance$/i)) {
        const address = await getAddress(args[0])
        return await web3.eth.getBalance(address)
      }
    }
    return ret
  } else {
    log.debug(`Send method is used to access ${methodName} function.`)

    var txData = ether ? '0x' : await contract.methods[methodName](...args).encodeABI()
    if (!gasPrice) gasPrice = await getGasPrice()

    if (!gasLimit) {
      if (!ether) {
        try {
          gasLimit = await contract.methods[methodName](...args).estimateGas({
            from,
            value,
          })

          log.error(`estimated gas: ${gasLimit} estimated eth cost: ${BN(gasPrice).times(BN(gasLimit)).div(10**18).toFixed(6)}`)
          gasLimit += config.get(`web3.gasOverhead`)
          log.error(`netw est. gas: ${gasLimit} estimated eth cost: ${BN(gasPrice).times(BN(gasLimit)).div(10**18).toFixed(6)}`)
        } catch (e) {
          log.warn(`Gaslimit estimation unsuccessful.`)
          gasLimit =  config.get(`web3.defaultGaslimit`)
        }
      } else {
        gasLimit = 21000 //gaslimit of sending ether
        log.error(`estimated gas: ${gasLimit} estimated eth cost: ${BN(gasPrice).times(BN(gasLimit)).div(10**18).toFixed(6)}`)
      }
    }

    console.log(dispCall)

    process.on('uncaughtException', function (err) {
      var value = err.message.match(/0xx([a-zA-Z0-9]*)/)[1] 
      value = new Buffer(value, 'hex')
      //log.error(err.message)
      log.error(value.toString().replace(/[^-A-Za-z0-9/. ]/g, ''));
      process.exit(0)
    })

    if (!ether) {
      try {
        return await broadcastTx(from, to, txData, value, gasLimit, gasPrice)
      } catch (e) {
        return await contract.methods[methodName](...args).call({from, value})
      }
    } else {
      if (funcName === 'transfer') {
        to = await getAddress(args[0])
        value = BN(args[1].replace(/\./g, "")).integerValue().toFixed()
        txData = '0x'
      } else if (funcName === 'transferFrom') {
        from =  await getAddress(args[0])
        to =  await getAddress(args[1])
        value = BN(args[2].replace(/\./g, "")).integerValue().toFixed()
        txData = '0x'
      }
      return await broadcastTx(from, to, txData, value, gasLimit, gasPrice)
    }
  }
}

async function getPath (sellToken, buyToken, pathString) {
      const yaml = require('js-yaml');
      const set = require('set-value');
      const network = config.get('web3.network')
      sellToken = sellToken === 'ETH' ? 'WETH' : sellToken.toUpperCase()
      buyToken = buyToken === 'ETH' ? 'WETH' : buyToken.toUpperCase()

      if (!pathString || pathString === '') {
        var pathKey = [sellToken, buyToken].sort().join('-')
        if (!config.has(`web3.${network}.uniswap.paths.${pathKey}`)) {
          if (sellToken !== 'WETH' && buyToken !== 'WETH') {
            return JSON.stringify([sellToken, 'WETH', buyToken])
          } else {
            return JSON.stringify([sellToken, buyToken])
          }
        }
        path = config.get(`web3.${network}.uniswap.paths.${pathKey}`)
        if (sellToken !== path[0]) {
          return JSON.stringify(path.reverse())
        } else {
          return JSON.stringify(path)
        }
      } else {
        pathString = pathString.toUpperCase()
        var path = Array.from(JSON.parse(pathString)) 
        
        // replace all entries of ETH to WETH
        path = path.map(token => token === 'ETH' ? 'WETH' : token)

        if ( path.length < 2) {
          throw new Error('Path must contain at least two elements.')
        }
        log.debug(`${JSON.stringify({path, buyToken, sellToken, pathSlice: path.slice(-1)[0]})}`)
        if (
          (path[0] !== sellToken && path[0] !== buyToken) || 
          (path.slice(-1)[0] !== sellToken && path.slice(-1)[0] !== buyToken)||
          (path[0] === path.slice(-1)[0])
          ) {
          throw new Error('Path must include sell token and buy token, and first and last element must differ.')
        }

        pathKey = [sellToken, buyToken].sort().join('-')
        const pathLoc = `web3.${network}.uniswap.paths`
        var paths = config.get(pathLoc)
        paths = {...paths, [pathKey]: path}
        const conf = yaml.load(fs.readFileSync('./config/default.yaml', 'utf-8'))
        set(conf, pathLoc, paths)

        fs.writeFileSync(
          './config/default.yaml',
          yaml.dump(conf, {forceQuotes: true}),
          () => {
            throw Error(`File config could not be written.`)
          }
        )

        log.info(`Contract inserted into ${pathLoc}`)
        
        if (sellToken !== path[0]) {
          return JSON.stringify(path.reverse())
        } else {
          return JSON.stringify(path)
        }
      }
}

async function importAddress (args) {
      if (!args.contractAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
        throw new Error('Wrong contract address given.')
      }
      const yaml = require('js-yaml');
      const set = require('set-value');
      const conf = yaml.load(fs.readFileSync('./config/default.yaml', 'utf-8'))
      const network = config.get('web3.network')
      if (args.location === '' || !args.location) {
        // find insert location based on contractName
        const addresses = Object.keys(config.get(`web3.${network}`))
        log.info('Searching for insert location based on name...')
        for (var idx = 0; idx < addresses.length; idx++) {
          var names = Object.keys(config.get(`web3.${network}.${addresses[idx]}`))
          var nameMatch = new RegExp(`^${args.contractName.split('_')[0]}`)
          var matching = names.filter(name => nameMatch.test(name))
          if (matching.length > 0) {
            args.location = `web3.${network}.${addresses[idx]}`
            break
          }
        }
        if (args.location === '' || !args.location) {
          args.location = `web3.${config.get('web3.network')}.other`
        }
      }
      var change = config.get(args.location)
      change = {...change, [args.contractName]: {address: args.contractAddress}}
      set(conf, args.location, change);

      fs.writeFileSync(
        './config/default.yaml',
        yaml.dump(conf, {forceQuotes: true}),
        () => {
              throw Error(`File config could not be written.`)
              }
      )

      log.info(`Contract inserted into ${args.location}`)
      // reload config and dependent w3
      config = require('config')

      await getAbi(args.contractName, args.contractAddress)
      return ''
}

/* Translates address id like 'DAI' to real address */
async function getAddress (address) {
  const {address:addr} = await getAddressType(address)
  return addr
}

async function getAddressType (address) {
  const network = config.get('web3.network')
  if (!address || (typeof address === 'number' && address === 0)) return {address: '0x0000000000000000000000000000000000000000', type: null}
  if (address.match(/^0x[A-Fa-f0-9]{40}$/i)) {
    var addrNames = Object.keys(config.get(`web3.account`))
    for (idx = 0; idx < addrNames.length; idx++) {
        conf = `web3.${network}.${addrNames[idx]}.address`
        if (config.has(conf) && config.get(conf).toLowerCase() === address.toLowerCase()) {
          log.debug(`Address ${address} is ${addrNames[idx]}.`)
          log.debug(`Address ${addrNames[idx]} is a web3 account.`)
          return {address: config.get(conf), type: 'account'}
        }
    }
    const addresses = Object.keys(config.get(`web3.${network}`))
    var idx
    var id1
    for (idx = 0; idx < addresses.length; idx++) {
      addrNames = Object.keys(config.get(`web3.${network}.${addresses[idx]}`))
      for (id1 = 0; id1 < addrNames.length; id1++) {
        conf = `web3.${network}.${addresses[idx]}.${addrNames[id1]}.address`
        if (config.has(conf) && config.get(conf).toLowerCase() === address.toLowerCase()) {
          log.debug(`Address ${address} is a ${addresses[idx]} contract.`)
          address = config.get(conf)
          return {address, type: addresses[idx]}
        }
      }
    }
    return {address, type: 'none'}
  } else {
    var conf = `web3.account.${address}.address`
    if (config.has(conf)) {
      log.debug(`Address ${address} is a web3 account.`)
      return {address:config.get(conf), type: 'account'}
    } else {
      const addresses = Object.keys(config.get(`web3.${network}`))
      for (idx = 0; idx < addresses.length; idx++) {
        conf = `web3.${network}.${addresses[idx]}.${address}.address`
        if (config.has(conf)) {
          log.debug(`Address ${address} is a ${addresses[idx]} contract.`)
          return {address: config.get(conf), type: addresses[idx]}
        }
      }
    }
  }
  throw Error(`Did not find anything to match ${address} in config.`)
}

async function getAddressName (address) {
  const {name} = await getAddressNameType(address)
  return name
}

async function getAddressNameType (address) {
  var conf
  if (address.match(/^0x[A-Fa-f0-9]{40}$/i)) {
    var addrNames = Object.keys(config.get(`web3.account`))
    for (idx = 0; idx < addrNames.length; idx++) {
        conf = `web3.account.${addrNames[idx]}.address`
        if (config.has(conf) && config.get(conf).toLowerCase() === address.toLowerCase()) {
          log.debug(`Address ${address} is ${addrNames[idx]}.`)
          log.debug(`Address ${addrNames[idx]} is a web3 account.`)
          return {name: addrNames[idx], type: 'account'}
        }
    }
    const addresses = Object.keys(config.get(`web3.${network}`))
    var idx
    var id1
    for (idx = 0; idx < addresses.length; idx++) {
      addrNames = Object.keys(config.get(`web3.${network}.${addresses[idx]}`))
      for (id1 = 0; id1 < addrNames.length; id1++) {
        conf = `web3.${network}.${addresses[idx]}.${addrNames[id1]}.address`
        if (config.has(conf) && config.get(conf).toLowerCase() === address.toLowerCase()) {
          log.debug(`Address ${address} is a ${addresses[idx]} contract.`)
          return {name: addrNames[id1], type: addresses[idx]}
        }
      }
    }
  } else {
    conf = `web3.account.${address}.address`
    if (config.has(conf)) {
      log.debug(`Address ${address} is a web3 account.`)
      return {name: address, type: 'account'}
    } else {
      const addresses = Object.keys(config.get(`web3.${network}`))
      for (idx = 0; idx < addresses.length; idx++) {
        conf = `web3.${network}.${addresses[idx]}.${address}.address`
        if (config.has(conf)) {
          log.debug(`Address ${address} is a ${addresses[idx]} contract.`)
          return {name: address, type: addresses[idx]}
        }
      }
    }
  }
  log.info(`Did not find anything to match ${address} in config.`)
  return {name: address, type: 'none'} 
}

async function decimals (token) {
  if (token !== 'ETH') {
    return await access(token, 'decimals', [], 'ERC20')
  } else {
    return '18'
  }
}

module.exports = {
 MAX_DEST_AMOUNT,
 access,
 broadcastTx,
 decimals,
 getAbi,
 getAbiFunctions,
 getAddress,
 getAddressName,
 getAddressType,
 getGasPrice,
 getLedgerDerivePath,
 getLedgerEthereumDerivePath,
 getPath,
 getSourceCode,
 importAddress,
 kyberGetRates,
 kyberTrade,
 web3,
}
