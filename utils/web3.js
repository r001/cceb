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

var config = require('config')
const qrEncoding = require('qr-encoding')
const QRCode = require('qrcode')
const {Web3} = require('web3')
const BN = require('bignumber.js')
const {Common, Chain, Hardfork} = require('@ethereumjs/common')
const {Transaction, FeeMarketEIP1559Transaction} = require('@ethereumjs/tx')
const axios = require('axios')
var log4js = require('log4js')
var fs = require('fs')
const path = require('path')
const network = config.get('web3.network')
const common = new Common({chain: config.get(`web3.networks.${network}.chainid`)})
const pressAnyKey = require('press-any-key')
const shell = require('shelljs')
const TransportNodeHid = require("@ledgerhq/hw-transport-node-hid-singleton").default;
const Eth = require("@ledgerhq/hw-app-eth").default
const {ledgerService} = require("@ledgerhq/hw-app-eth").default
const sigUtil = require('@metamask/eth-sig-util')
const {bufArrToArr, fromRpcSig, stripHexPrefix} = require('@ethereumjs/util')
const {RLP} = require('@ethereumjs/rlp')
const ut = require('./util')
const {keccak256} = require('ethereum-cryptography/keccak') 
const {EthSignRequest, DataType, ETHSignature, CryptoKeypath, PathComponent} = require('@keystonehq/bc-ur-registry-eth')
const {URDecoder} = require('@ngraveio/bc-ur')
const UUID = require('uuid') 
const rlp = require('@ethereumjs/rlp')

// console.log(network)

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


var readlineSync = require('readline-sync')
if (require.main === module) {

  (async () => {
  })()
}

function toHex (value) {
  const raw = Web3.utils.toHex(value)
  return '0x' + (raw.length % 2 === 1 ? '0' : '') + raw.slice(2)
}


async function getPrivateKeySignature (web3, rawTx, type) {
  var tx
  const	account = await getAddressName(rawTx.from)

	const privateKeyConfig = 
		fs.readFileSync(
			path.join(
				config.get('passwordDir'),
				config.get(`web3.account.${account}.privatekey`)
				),
			'utf8'
		).trim()

  const privateKey = Buffer.from(privateKeyConfig, 'hex')
	const EIP_1559 = !rawTx.gasPrice
  switch (type) {
    case 'sign_transaction':
			var createTransaction

			if (EIP_1559) {
				createTransaction = FeeMarketEIP1559Transaction.fromTxData
			} else {
				createTransaction = Transaction.fromTxData
			}
				tx = createTransaction(rawTx, {common})
				tx.sign(privateKey)
				return tx.r.toString("hex") + tx.s.toString("hex") + tx.v.toString("hex")
    case 'sign_message':
    case 'sign_personal_message':
      return sigUtil.personalSign({privateKey, data: rawTx.data})
    case 'sign_typed_data':
      return sigUtil.signTypedData({privateKey, data: rawTx.data, version:rawTx.version})
    default:
      throw new Error(`Unsupported signature type: ${type}`)
  }
}

async function getLedgerSignature (web3, rawTx, type) {

  const derivePath = await getLedgerDerivePath(web3, 'Ethereum', rawTx.from)
  log.debug({derivePath})
  const transport = await TransportNodeHid.create();
  const eth = new Eth(transport)

  var signed, rawLedger, typedData, sanitizedData, domainSeparator,
    typedDataHash

	const EIP_1559 = !rawTx.gasPrice
  switch (type) {
    case 'sign_transaction':
			if (EIP_1559) {
				let tx = FeeMarketEIP1559Transaction.fromTxData(rawTx, {common})
				let unsignedTx = tx.getMessageToSign(false)
				let resolution = await ledgerService.resolveTransaction(tx)
				signed = await eth.signTransaction(derivePath, unsignedTx, resolution)
			} else {
				log.debug({rawLedger})
				var lTx = Transaction.fromTxData(rawTx, {common})

				log.debug({
					serialized:lTx.serialize().toString("hex"),
					r: lTx.r.toString("hex"),
					s: lTx.s.toString("hex"),
					v: lTx.v.toString("hex")
				})

				signed = await eth.signTransaction(
					derivePath,
					RLP.encode(bufArrToArr(lTx))
				)
			}

      break
    case 'sign_personal_message':
      signed = await eth.signPersonalMessage(derivePath, rawTx.data)
      signed.v = calcV(signed.v)
      break
    case 'sign_typed_data':
      typedData = rawTx.data
      sanitizedData = sigUtil.TypedDataUtils.sanitizeData(typedData)

      domainSeparator = sigUtil.TypedDataUtils.hashStruct(
        'EIP712Domain',
        sanitizedData.domain,
        sanitizedData.types,
        rawTx.version
      )

      typedDataHash = sigUtil.TypedDataUtils.hashStruct(
        rawTx.data.primaryType,
        sanitizedData.message,
        sanitizedData.types,
        rawTx.version,
      )

      signed = await eth.signEIP712HashedMessage(
        derivePath,
        domainSeparator.toString('hex'),
        typedDataHash.toString('hex')
      )

      signed.v = calcV(signed.v)
      break
    default:
      throw new Error(`Unsupported type ${type}`)
  }

  const signature = signed.r + signed.s + signed.v
  await transport.close()
  return signature
}

async function calcV (v) {
  v -= 27;
  v = v.toString(16);
  if (v.length < 2) {
    v = "0" + v;
  }
  return v
}

async function getFakeDerivePath (address) {
	let addressHash = keccak256(Uint8Array.from(Buffer.from(stripHexPrefix(address), 'hex')))
	return new CryptoKeypath (
		[0, 1, 2, 3].map(index => new PathComponent({index: addressHash.at(index), hardened:true}))
	).getPath()
}

async function getAirsignSignature (rawTx, type) {
  var signature
  log.info(`External signer used`)
  var signable, signableSpecific
	log.debug(`getAddressType: ${JSON.stringify(await getAddressType(rawTx.from))}`)
	var accountData = config.get((await getAddressType(rawTx.from)).confPath)
	const derivePath = accountData.derivePath || await getFakeDerivePath(rawTx.from) 
	const uuid = UUID.v4()
	log.debug(JSON.stringify({derivePath, accountData, uuid, rawTx, type}, (key, value) => typeof value === 'bigint' ? value.toString() : value))

  switch (type) {
    case 'sign_transaction':
      signableSpecific = {
        payload: {
          ...rawTx,
          chainId: config.get(`web3.networks.${network}.chainid`)
        }
      }

      break
    case 'sign_message':
    case 'sign_personal_message':
    case 'sign_typed_data':
      signableSpecific = {
        payload: rawTx.data,
        version: rawTx.version,
      }

      break
    default:
      throw new Error(`Unknown type ${type}`)
  }
	signable = {...signableSpecific, type, derivePath, uuid}

  log.debug(`signable: ${JSON.stringify(signable, (key, value) => typeof value === 'bigint' ? value.toString() : value)}`)

  const ethSignRequest = (await encode(signable))
	let done = false
	let ur = ethSignRequest.toUREncoder(config.get('qrCodeSize'))
	console.log(`cbor: ${ur.cbor.toString('hex')}`)
  while (!done) {
		let urPart = ur.nextPart()	


		QRCode.toString(urPart, {type: 'terminal'}, (err, str) => {
			if (err) throw new Error(err)
			console.log(str)
		})

		console.log(urPart)
		console.log('')

		try {
			await pressAnyKey('Press any key to continue!', {ctrlC: "reject"} )
		} catch (e) {
			done = true
		}
	}
  // console.log(`  ./ccb eth send '{"from": "${from}", ${Object.keys(signable.payload).map(key => `"${key}": "${signable.payload[key]}"`).join(', ')}}' <signature>`)

  const zbarcam = shell.exec("zbarcam")

  if (zbarcam.code) {
    signature = readlineSync.question("Signature: ")
  } else {
    signature = zbarcam.stdout
  }

	signature = signature.replace(/^.*ur:/, 'ur:')
	var decoder = new URDecoder()
	log.debug(`signature: ${signature}`)
	decoder.receivePart(signature)

	log.debug(`decoder fragments: ${JSON.stringify(decoder.expectedPartCount())}`)

	if (!decoder.isComplete() || !decoder.isSuccess()) {
		throw new Error('Error decoding signature.')
	}
	
	signature = ETHSignature.fromCBOR(decoder.resultUR().cbor)
	signature = `0x${signature.getSignature().toString('hex')}`
	log.debug(`signature: ${signature}`)
  return signature
}

async function encode (signable) {
	let version = signable.version
	const rawTx = signable.payload
	const derivePath = signable.derivePath
	let EIP_1559 = true
	let xfp = "12345678";
	let rlpEncoded, common, dataType, serializedMessage, txn, typedData 

  switch (signable.type) {
    case 'sign_message':
    case 'sign_personal_message':
			rlpEncoded = Buffer.from(rlp.encode(signable.payload))
			dataType = DataType.personalMessage
			break
    case 'sign_typed_data':
			typedData = Buffer.from(signable.payload, 'utf8') 
			version = Buffer.from(version.slice(1), 'utf8')
			rlpEncoded = Buffer.from(rlp.encode([version, typedData]))
			dataType = DataType.typedData
			break
    case 'sign_transaction':
			EIP_1559 = !rawTx.gasPrice	
			common = new Common({chain: rawTx.chainId, hardfork: Hardfork.Shanghai})
			if (EIP_1559) {
				log.debug(`encoding EIP_1559 transaction`)
				txn = FeeMarketEIP1559Transaction.fromTxData(rawTx, {common})
				dataType = DataType.typedTransaction
				serializedMessage = txn.getMessageToSign(false) //alreade rlp encoded!!!
				rlpEncoded = serializedMessage
			} else {
				log.debug(`encoding legacy transaction`)
				txn = Transaction.fromTxData(rawTx, {common})
				dataType = DataType.transaction
				serializedMessage = txn.getMessageToSign(false) //not rlp encoded!!!
				rlpEncoded = Buffer.from(rlp.encode(bufArrToArr(serializedMessage)))
			}
			break
		default:
			throw new Error(`Unknown signable type: ${signable.type}`)
  }
	log.debug(`rlpEncoded: ${rlpEncoded.toString('hex')}`)
	return EthSignRequest.constructETHRequest(rlpEncoded, dataType, derivePath, xfp, signable.uuid, rawTx.chainId)
}

// Function to broadcast transactions
async function broadcastTx (web3, from, to, txData, value, gasLimit, gasPrice, nonce, signature, getHashFast) {
	log.debug(`broadcastTx: ${JSON.stringify({from, to, txData, value, gasLimit, gasPrice, nonce, signature, getHashFast})}`)
  const txCount = nonce || await web3.eth.getTransactionCount(from)

  var rawTx = {
    from: from,
    to: to,
    data: txData,
    value: BigInt(value || 0),
    gasLimit: BigInt(gasLimit),
    nonce: BigInt(txCount),
  }

	const EIP_1559 = gasPrice.type === 'EIP_1559'
	if (EIP_1559) {
		//convert to hex
		log.debug(JSON.stringify({gasPrice}))

		gasPrice = {
			maxPriorityFeePerGas: BigInt(gasPrice.maxPriorityFeePerGas),
			maxFeePerGas: BigInt(gasPrice.maxFeePerGas)
		}

		//add to rawTx
	} else {
		gasPrice = {gasPrice: BigInt(gasPrice.gasPrice)}
	}
		rawTx = {...rawTx, ...gasPrice}

  log.debug(rawTx)
  const accounts = config.get(`web3.account`)
  const accountType = accounts[Object.keys(accounts).filter(key => accounts[key].address.toLowerCase() === from.toLowerCase())[0]].type

  if (!signature) {
    switch (accountType) {
      case 'airsign':
        signature = await getAirsignSignature(rawTx, 'sign_transaction')
        break
      case 'ledger':
        signature = await getLedgerSignature(web3, rawTx, 'sign_transaction')
        break
      case 'privatekey':
        signature = await getPrivateKeySignature(web3, rawTx, 'sign_transaction')
        break
      default:
        throw new Error(`Unknown account type ${accountType}`)
    }
  }

  if (signature) {
		let {v, r, s} = fromRpcSig('0x' + stripHexPrefix(signature).replace(/[^0-9a-fx]/gm, ""))

		rawTx = {
			...rawTx,
			r: `0x${r.toString('hex')}`,
			s: `0x${s.toString('hex')}`,
			v: Number(v)
		}

    log.debug(`r: ${rawTx.r}`)
    log.debug(`s: ${rawTx.s}`)
    log.debug(`v: ${rawTx.v}`)
  } else {
    log.error(`Signature not found`)
    throw new Error(`Signature not created`)
  }

  log.debug(`value: ${value}`)
  log.debug('Raw tx: ', rawTx)
	var tx
	if (EIP_1559) {
		rawTx.v = Number(rawTx.v - 27)
    log.debug(`tx.v changed to: ${rawTx.v}`) // fromRpcSig() adds 27 to v, here we set it back
		tx = new FeeMarketEIP1559Transaction(rawTx, {common})
	} else {
		tx = Transaction.fromTxData(rawTx, {common})
	}
	log.debug('Tx to json: ', JSON.stringify(tx.toJSON()))
	if (EIP_1559) {
		log.debug('maxPriorityFeePerGas: ', '0x' + tx.maxPriorityFeePerGas.toString(16))
		log.debug('maxFeePerGas: ', '0x' + tx.maxFeePerGas.toString(16))
	} else {
		log.debug('gasPrice: ', '0x' + tx.gasPrice.toString(16))
	} 
	log.debug('gasLimit: ', '0x' + tx.gasLimit.toString(16))
  log.debug('value: ', '0x' + tx.value.toString(16))
  log.debug('from: ', '0x' + tx.getSenderAddress().toString())

  if (!tx.verifySignature()) {
    throw new Error('Signature invalid.')
  }

  const serializedTx = tx.serialize()
  log.debug(JSON.stringify({serializedTx: '0x' + serializedTx.toString('hex')}))
  console.log('Tx hash: 0x' + tx.hash(true).toString('hex'))
  if (getHashFast) {
    return await Promise.any([sendTransaction(web3, serializedTx), getTransactionHash(tx)])
  } else {
    return await sendTransaction(web3, serializedTx)
  }
}

async function getTransactionHash (tx) {
  return {transactionHash: '0x' + tx.hash(true).toString('hex')}
}

async function sendTransaction (web3, serializedTx) {
  log.info('Sendig transaction...')
  const txReceipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('error', console.error)

  // Log the tx receipt
  log.debug(txReceipt)

  log.info('Transaction confirmed.')
  return txReceipt
}

async function getLedgerDerivePath (web3, wallet, from, transport) {
  switch (wallet) {
    case 'Ethereum':
      return await getLedgerEthereumDerivePath(web3, from, transport)
    default:
      throw new Error(`Ledger wallet '${wallet}' not supported yet.`)
  }
}

async function getLedgerEthereumDerivePath (web3, from, transport) {
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

async function getGasPrice (web3, gasPrice, EIP_1559) {
	if (!EIP_1559) EIP_1559 = !gasPrice || gasPrice.type === 'EIP_1559'
	log.debug(`gasPrice: ${JSON.stringify(gasPrice)}`)
  var etherscanWorked = true
  var gasPrices = {}
  try {
		const apiKey = 
		fs.readFileSync(
			path.join(
				config.get('passwordDir'),
				config.get('web3.etherscan.api-key')
				),
			'utf8'
		).trim()

    gasPrices = await axios.get(config.get('web3.etherscan.gas_price_url') + apiKey, {timeout: config.get('web3.etherscan.timeout')})
  } catch (e) {
    etherscanWorked = false
    log.debug('Etherscan did not work.')
		if (!web3) {
			const network = config.get('web3.network')
			web3 = await ut.getWeb3(network)
		}
    let feeHistory = await web3.eth.getFeeHistory(1, await web3.eth.getBlockNumber(), ['0', '25', '50', '75', '100'])
		let baseFeePerGas = BigInt(feeHistory.baseFeePerGas[0])
		let maxPriorityFeePerGas = BigInt(feeHistory.maxPriorityFeePerGas[0][1])
		let gasPrice = {}
		if (EIP_1559) {
			gasPrice = {
				type: 'EIP_1559',
				maxFeePerGas: baseFeePerGas + maxPriorityFeePerGas,
				maxPriorityFeePerGas,
			}

			log.info(`Web3 maxPriorityFeePerGas: ${new BN(gasPrice.maxPriorityFeePerGas).div(10 ** 9).toString()} GWei`)
			log.info(`Web3 maxFeePerGas: ${new BN(gasPrice.maxFeePerGas).div(10 ** 9).toString()} GWei`)
		} else {
			gasPrice= {
				type: 'legacy',
				gasPrice: baseFeePerGas + maxPriorityFeePerGas,
			}

			log.info(`Web3 gasprice: ${new BN(gasPrice.gasPrice).div(10 ** 9).toString()} GWei`)
		}
  }

  if (etherscanWorked) {
    const speed = config.get('web3.txSpeed')
    const required = ['FastGasPrice', 'ProposedGasPrice', 'SafeGasPrice']
    if (!required.includes(speed)) {
      throw new Error(`Wrong speed value of '${speed}'. Use any of '${required.join("', '")}'.`)
    }
		log.trace('Etherscan result: ', gasPrices)
    let gasPriceRec = gasPrices['data']['result'][speed]
    if (!gasPriceRec) {
      throw new Error('Panic: no valid gasprice from Etherscan.')
    }
		gasPriceRec = new BN(gasPriceRec).times(10 ** 9)
		if (EIP_1559) {
			log.debug(`EIP_1559 used to declare gas cost`)
			const suggestBaseFee = new BN(gasPrices['data']['result']['suggestBaseFee']).times(10 ** 9)

			const maxPriorityFeePerGas = 
				gasPrice &&
				gasPrice.maxPriorityFeePerGas && 
				BN(gasPrice.maxPriorityFeePerGas) ||
				gasPriceRec.minus(suggestBaseFee)

			const	maxFeePerGas =
				gasPrice && 
				gasPrice.maxFeePerGas &&
				BN(gasPrice.maxFeePerGas) ||
				gasPriceRec

			gasPrice = {type: 'EIP_1559', maxPriorityFeePerGas, maxFeePerGas}
		} else  {
			log.debug(`legacy used to declare gas cost`)
			gasPrice = {type: 'legacy', gasPrice: gasPriceRec}
		} 
		//log.debug('Etherscan result: ', gasPrices)
		if (EIP_1559) {
			log.info(`Etherscan maxPriorityFeePerGas: ${gasPrice.maxPriorityFeePerGas.div(10 ** 9).toFixed(6)} GWei maxFeePerGas: ${gasPrice.maxFeePerGas.div(10 ** 9).toFixed(6)} GWei`)
		} else {
			log.info('Etherscan gasprice: ' + BN(gasPrice.gasPrice).div(10 ** 9).toString() + ' GWei')
		}
  }

  return gasPrice
}

// Function to obtain conversion rate between src token and dst token
async function kyberGetRates (web3, SRC_TOKEN_ADDRESS, DST_TOKEN_ADDRESS, SRC_QTY_WEI) {
  return await access(web3, null, 'KyberNetworkProxy', 'getExpectedRate', [SRC_TOKEN_ADDRESS, DST_TOKEN_ADDRESS, SRC_QTY_WEI])
}

// Function to convert src token to dst token
async function kyberTrade (
  web3,
  from,
  srcTokenAddress,
  srcQtyWei,
  dstTokenAddress,
  dstAddress,
  maxDstAmount,
  minConversionRate,
  walletId,
  gaslimit,
  gasprice,
  nonce
) {
  from = await getAddress(from)
  srcTokenAddress = await getAddress(srcTokenAddress)
  dstTokenAddress = await getAddress(dstTokenAddress)
  dstAddress = await getAddress(dstAddress)
  const MAX_DEST_AMOUNT = '115792089237316195423570985008687907853269984665640564039457584007913129639935'
  if (srcTokenAddress !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
    // const allowance = await SRC_TOKEN_CONTRACT.methods.allowance(USER_ADDRESS, KYBER_NETWORK_PROXY_ADDRESS).call()
    const allowance = await access(web3, null, srcTokenAddress, 'allowance', [from, 'KyberNetworkProxy'], 'ERC20')
    if (new BN(allowance).lt(new BN(srcQtyWei))) {

      const decimals = await decimals(web3, null, srcTokenAddress)

      const allowanceStr = new BN(allowance).div(10 ** Number(decimals)).toString()
      log.warn(`Allowance (${allowanceStr}) is not enough, approving max...`)

      // const approveTxData = await SRC_TOKEN_CONTRACT.methods.approve(KYBER_NETWORK_PROXY_ADDRESS, MAX_DEST_AMOUNT).encodeABI()
      var receipt = await access(
        web3,
        null,
        srcTokenAddress,
        'approve',
        [
          'KyberNetworkProxy',
          MAX_DEST_AMOUNT,
        ],
        'ERC20',
        from,
        0,
        gaslimit,
        gasprice,
        nonce
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
	var gasPrice = await getGasPrice(web3, {type: 'legacy'})
	const EIP_1559 = !gasPrice || gasPrice.type === 'EIP_1559'
	if (EIP_1559) {
		gasPrice = gasPrice.maxFeePerGas
	}
	gasPrice = new BN(gasPrice.gasPrice)
  log.info(`Gasprice: ${gasPrice.div(10 ** 9).toString()} GWei`)

  const maxGasPrice = new BN(await getKyberMaxGasPrice(web3))
  log.info(`Kyber max gasprice: ${maxGasPrice.div(10 ** 9).toString()} GWei`)

  if (gasPrice.gte(maxGasPrice)) gasPrice = maxGasPrice
  log.info('Final gas price: ' + gasPrice.div(10 ** 9).toString() + ' GWei')

  log.info(`Broadcasting tx...`)
  return await access(web3, null,
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
    gaslimit, // gasLimit defaults to estimation
    gasprice || gasPrice.toString(), // gasPrice
    nonce
  )
}

async function getKyberMaxGasPrice (web3) {
  return await access(web3, null, 'KyberNetworkProxy', 'maxGasPrice')
}

async function getAbiFunctions (web3, abi, regexp) {
  return await extractAbi(web3, abi, regexp, ['function'])
}

async function extractAbi (web3, abi, regexp, type) {
  log.debug(`abi: ${abi}`)
  log.debug(`regexp: ${regexp}`)
  const abiJson = await getAbi(web3, abi, await getAddress(abi))

  const functions = abiJson
    .filter(abi =>
      (
        type.includes(abi.type) ||
        !abi.type
      )

    )
    .map(abi =>
      abi.name
      + '(' + abi.inputs.map(input => `${input.type} ${input.name || '_input' }`).join(', ') + ')' +
      ((Array.isArray(abi.outputs))
        ?
        '(' + abi.outputs.map(output => `${output.type} ${output.name || '_output' }`).join(', ') + ')'
        :
        '') +
      (abi.payable === 'true' || (abi.stateMutability && /^payable$/.test(abi.stateMutability)) ? ' payable' : '') +
      ((abi.stateMutability && !/nonPayable|payable/.test(abi.stateMutability)) || abi.constant ? ` ${abi.stateMutability || 'view'}` : '')
    )
    .filter(func => (new RegExp(regexp, 'i')).test(func))

	return functions

}

async function getNonce (address) {
  var addressLC = (await getAddress(address)).toLowerCase()
  try {
    var page = 1
    var resLength = 1
    var nonce = 0
    var nonceTx

		const apiKey = 
		fs.readFileSync(
			path.join(
				config.get('passwordDir'),
				config.get('web3.etherscan.api-key')
				),
			'utf8'
		).trim()

    while (typeof nonceTx === 'undefined' && resLength > 0 && nonce === 0) {

      var txs = (await axios.get(
        config.get('web3.etherscan.nonce_url') + apiKey + '&address=' + await getAddress(address) + '&page=' + page,
        {timeout: config.get('web3.etherscan.timeout')}
      )).data.result

      resLength = txs.length

      nonceTx = txs.find(tx => tx.from.toLowerCase() === addressLC)
      nonce = typeof nonceTx === 'undefined' ? 0 : nonceTx.nonce
      page++
    }
  } catch (e) {
    throw new Error('Could not download nonce.')
  }
  return nonce
}

async function getWeb3Function (web3, functionString) {
  return functionString.split(".").slice(1).reduce((acc, fnString) =>
    {
      try {
        return acc[fnString]
      } catch (e) {
        throw new Error(`Object "${fnString}" does not exist.`)
      }

    }
    , web3)
}

async function getSourceCode (web3, addressName) {
  const address = await getAddress(addressName)

		const apiKey = 
		fs.readFileSync(
			path.join(
				config.get('passwordDir'),
				config.get('web3.etherscan.api-key')
				),
			'utf8'
		).trim()

  try {
    var source = await axios.get(
      config.get('web3.etherscan.contract_url') + apiKey + '&action=getsourcecode&address=' + address,
      {timeout: config.get('web3.etherscan.timeout')}
    )
  } catch (e) {
    throw new Error('Could not download source code')
  }

  var code = source.data.result[0].SourceCode.replace(/\r/g, '')
  var remark = "//"
  if (code.slice(0, 2) === '{{' && code.slice(-2) === '}}') {
    code = code.slice(1, -1)
  }
  try {
    code = JSON.parse(code)
    const sources = Object.keys(code.sources || code)
    remark = sources[0] && sources[0].slice(-3) === 'sol' ? '//' : '#'

    log.debug({remark, language: code.language, code})

    code = `${remark} ------ File contains multiple sources. Can not be compiled as is.\n` +
      sources.reduce((acc, source) =>
        acc +
        `\n${remark} ------ Source of ${source} ------\n` +
        (code.sources ?
          code.sources[source].content.replace(/\r/g, '') :
          code[source].content.replace(/\r/g, ''))
        , '')
  } catch (e) {
    log.debug(e)
  }

  var implAddr = await proxyImplAddress(web3, await getAbi(web3, addressName, address), address)
  if (implAddr && !implAddr.match(/0x0{40}/)) {

    code = `${remark} ------ BEGIN PROXY CONTRACT SOURCE ------\n` +
      code +
      `\n${remark} ------ END PROXY CONTRACT SOURCE ------\n\n` +
      `${remark} ------ BEGIN IMPLEMENTATION SOURCE ------\n\n` +
      await getSourceCode(web3, addressName + "_IMPLEMENTATION") +
      `\n${remark} ------ END IMPLEMENTATION SOURCE ------`
  }
  return code
}

async function getAbi (web3, abi, address, recurseCount) {
	const apiKey = 
		fs.readFileSync(
			path.join(
				config.get('passwordDir'),
				config.get('web3.etherscan.api-key')
			),
			'utf8'
		).trim()

  try {
    var abiJson = JSON.parse(fs.readFileSync(`${baseDir}abi/${abi}`, 'utf8'))
  } catch (e) {
    try {
			
      log.debug('Downloading abi from etherscan.')
      try {

        const url = config.get('web3.etherscan.contract_url') + apiKey + '&action=getabi&address=' + await getAddress(abi)
        log.debug({url})

        abiJson = await axios.get(
          url,
          {timeout: config.get('web3.etherscan.timeout')}
        )
      } catch (e) {
        log.debug(`address: ${address}`)
        if (address !== null) {
          const url = config.get('web3.etherscan.contract_url') + apiKey + '&action=getabi&address=' + address
          log.debug({url})

          abiJson = await axios.get(
            url,
            {timeout: config.get('web3.etherscan.timeout')}
          )
        } else {
          throw new Error(`Either config must contain ${abi} or address must be provided.`)
        }
      }

      abiJson = JSON.parse(abiJson.data.result)

			log.trace({abiJson, address})
			const implAddr = await proxyImplAddress(web3, abiJson, address)
			log.debug({implAddr})
			log.debug({recurseCount})
			if (implAddr && (!recurseCount || recurseCount < 1)) {

				log.debug('here getAbi')

				log.debug({implAddr})

				const abiImpl = await getAbi(
					web3,
					`${abi}_IMPLEMENTATION`,
					implAddr,
					1
				)

				abiJson = [...abiJson, ...abiImpl]
			}
      log.debug(`Writing abi/${abi}`)

      fs.writeFileSync(
        `${baseDir}abi/${abi}`,
        JSON.stringify(abiJson),
        () => {
          throw Error(`File abi/${abi} could not be written.`)
        })

    } catch (e) {
      throw Error(`Could not download abi. Either timeout error, or valid value missing in config/default.yaml->web3->etherscan.`)
    }
  }
  return abiJson
}

async function getAddressAndCheck (web3, to) {
  const {address:toAddr, type} = await getAddressType(to)
  var toName
  if (to.match(/^0x[0-9a-fA-F]{40}$/)) {
    toName = await getAddressName(to)
  } else {
    toName = to
  }
  var toImplAddrStored, toImpAddr
  // TODO: find more elaborate solution instead of try catch
  try {
    toImplAddrStored = await getAddress(toName + '_IMPLEMENTATION')
    // abi contains a Truffle implementation() scheme
    const contract = new web3.eth.Contract(await getAbi(web3, toName), toAddr)
    toImpAddr = await contract.methods['implementation']().call()
    log.debug({toImplAddrStored, toImpAddr})
  } catch (e) {
    return toAddr
  }
  if (toImplAddrStored !== toImpAddr) {
    const path = `web3.networks.${network}.${type}`
    throw new Error(`Implementation address changed. If you trust contract owner, then run 'cceb eth import ${toName} ${toAddr} -l ${path}'`)
  }

  return toAddr
}

async function access (web3, block, to, funcName, args = [], abi, from, value, gasLimit, gasPrice, nonce, inputs, multipleUse, calldata, gasOverhead, getHashFast) {

	const EIP_1559 = !gasPrice || gasPrice.type === 'EIP_1559'

  if (multipleUse) {
    web3 = await ut.getWeb3(network)
  }

  web3.eth.handleRevert = true

  if (Number.isInteger(block)) {
    web3.eth.defaultBlock = toHex(block)
  }

  const dispCall = `${to}.${funcName}(${args})`+
    (abi ? ` abi ${abi}` : '') +
    (from ? ` from ${await getAddress(from)}` : '') +
    (value ? ` value ${value}` : '') +
    (gasLimit ? ` gasLimit ${gasLimit}` : '') +
    ((gasPrice && gasPrice.gasPrice) ? ` gasPrice ${JSON.stringify(gasPrice.gasPrice)}` : '') +
    ((gasPrice && gasPrice.maxPriorityFeePerGas) ? ` maxPriorityFeePerGas ${JSON.stringify(gasPrice.maxPriorityFeePerGas)}` : '') +
    ((gasPrice && gasPrice.maxFeePerGas) ? ` maxFeePerGas ${JSON.stringify(gasPrice.maxFeePerGas)}` : '') +
    (nonce ? ` nonce ${nonce}` : '') +
    (block ? ` block ${block}` : '') +
    (inputs ? ` inputs ${inputs}` : '') +
    (multipleUse ? ` multipleUse ${multipleUse}` : '') +
    (calldata ? ` calldata ${calldata}` : '') +
    (gasOverhead ? ` gasOverhead ${gasOverhead}` : '') +
    (getHashFast ? ` getHashFast ${getHashFast}` : '')


  log.info(dispCall)

  if (!abi || abi === '') {
    var {name:toName, type} = await getAddressNameType(to)
    if (type === 'token') {
      const fs = require("fs");
      if (fs.existsSync(`${baseDir}abi/` + toName)) { // if he has his own abi
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
  if (args && !Array.isArray(args)) {
    log.debug('Args was not an array, arrayify it.')
    args = [args]
  }
  to = await getAddressAndCheck(web3, to)
  const ether = to.match(/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/i)
  log.debug(`Value of 'to' changed to: '${to}'`)
  from = await getAddress(from)
  log.debug(`Value of 'from' changed to: '${from}'`)

  var contract
  var methodName
  var funcObject
  if (!ether) {
    let {contract: cn, funcObject: fo, funcName:fn, methodName:mn} = await getFunctionParams(web3, abi, to, calldata, funcName, inputs, args)
    funcObject = fo
    funcName = fn
    methodName = mn
    contract = cn

    log.debug(`Method is: ${methodName}`)
    const inputTypes = funcObject['inputs'].map(input => input.type)
    //log.debug(`inputTypes: ${inputTypes}`)

    log.debug(`Args originally are: ${args}`)

    if (!calldata && args.length !== inputTypes.length) {
      throw Error(`Wrong number of args. Should be ${inputTypes.length} and it is ${args.length}.`)
    }

    // substitute address name with address from config, remove all dots from uint values
    log.debug({args: JSON.stringify(args)})

    if (!calldata) {
      args = await Promise.all(inputTypes.map(async (type, index) =>
        type === 'address' ? await getAddress(args[index]) :
        type.match(/address\[\d*\]/) ? await Promise.all(args[index].map(async (address) => await getAddress(address))) :

        type.match(/uint\d*$/) ? args[index].replace(/\./g, "") :
        type.match(/uint\d*\[\d*\]/) ? args[index].map((uint) => String(uint).replace(/\./g, "")) :
        args[index]
      ))
    }

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
    log.debug(`${methodName} is a call`)
    if (!ether) {
      log.debug(`Not accessing Ether`)
      log.debug(`Call method is used to access ${methodName} function.`)
      try {
        log.debug(`Calling contract.methods ${methodName}`)
        log.debug(`Func name: ${funcName}`)
        log.debug(`Args are: ${args}`)
        ret = await contract.methods[methodName](...args).call()
      } catch (e) {
        log.debug(`Call to contract.methods ${methodName} failed`)
        if (calldata) {
          log.debug(`We are using calldata`)
          ret = await web3.eth.call({to, calldata, from})
        } else {
          log.debug(`We are not using calldata, but function name of ${funcName} given`)
          var parameters = web3.eth.abi.encodeParameters(funcObject.inputs, args)
          var signature = web3.eth.abi.encodeFunctionSignature(methodName)
          var data = signature + parameters.slice(2)
          ret = await web3.eth.call({to, data, from})
        }
      }
      log.debug(`Result: ${JSON.stringify(ret)}`)
    } else {
      if (funcName.match(/^balanceOf$|^balance$/i)) {
        const address = await getAddress(args[0])
        ret = await web3.eth.getBalance(address)
      }
    }
    return ret
  } else {
    log.debug(`Send method is used to access ${methodName} function.`)

    var txData = calldata ? calldata : ether ? '0x' : await contract.methods[methodName](...args).encodeABI()
    if (
			!gasPrice || (
				!EIP_1559 &&  !gasPrice.gasPrice || 
				(
					EIP_1559 &&
					(
						!gasPrice.maxPriorityFeePerGas ||
						!gasPrice.maxFeePerGas
					)
				)
			)
			) gasPrice = await getGasPrice(web3, gasPrice, EIP_1559)
		log.debug(`Gas price: ${JSON.stringify(gasPrice)}`)

		var ethUsdPrice = BN(await ut.getPriceInOtherCurrency('gate', 'ETH', 'USDT'))
    if (!gasLimit) {
      if (!ether) {
        try {
          if (calldata) {

            let txEst = {
              from,
              to,
              value,
              data: calldata
            }

            txEst = nonce ? {...txEst, nonce} : txEst
            gasLimit = await web3.eth.estimateGas(txEst)
          } else {
            gasLimit = await contract.methods[methodName](...args).estimateGas({
              from,
              value,
            })
          }
					if (EIP_1559) {
						var ethCost = BN(gasPrice.maxFeePerGas).times(BN(gasLimit)).div(10**18)
						var usdCost = ethCost.times(ethUsdPrice)
						console.log(`estimated gas: ${gasLimit} eth cost: ${ethCost.toFixed(6)} usd cost: ${usdCost.toFixed(6)}`)
						gasLimit += gasOverhead || config.get(`web3.gasOverhead`)
						ethCost = BN(gasPrice.maxFeePerGas).times(BN(gasLimit)).div(10**18)
						usdCost = ethCost.times(ethUsdPrice)
						console.log(`overhead est. gas: ${gasLimit} eth cost: ${ethCost.toFixed(6)} usd cost: ${usdCost.toFixed(6)}`)
					} else {
						ethCost = BN(gasPrice.gasPrice).times(BN(gasLimit)).div(10**18)
						usdCost = ethCost.times(ethUsdPrice)
						console.log(`gas: ${gasLimit} eth cost: ${ethCost.toFixed(6)} usd cost: ${usdCost.toFixed(6)}`)
						gasLimit += gasOverhead || config.get(`web3.gasOverhead`)
						ethCost = BN(gasPrice.gasPrice).times(BN(gasLimit)).div(10**18)
						usdCost = ethCost.times(ethUsdPrice)
						console.log(`overhead est. gas: ${gasLimit} eth cost: ${ethCost.toFixed(6)} usd cost: ${usdCost.toFixed(6)}`)
					}
        } catch (e) {
          log.warn(`Gaslimit estimation unsuccessful.`)
          gasLimit =  config.get(`web3.defaultGaslimit`)
        }
      } else {
        gasLimit = 21000 //gaslimit of sending ether
				if (EIP_1559) {
					ethCost = BN(gasPrice.maxFeePerGas).times(BN(gasLimit)).div(10**18)
					usdCost = ethCost.times(ethUsdPrice)
					console.log(`estimated gas: ${gasLimit} estimated eth cost: ${ethCost.toFixed(6)} eestimated usd cost: ${usdCost.toFixed(6)}`)
				} else {
					ethCost = BN(gasPrice.gasPrice).times(BN(gasLimit)).div(10**18)
					usdCost = ethCost.times(ethUsdPrice)
					console.log(`estimated gas: ${gasLimit} eth cost: ${ethCost.toFixed(6)} usd cost: ${usdCost.toFixed(6)}`)
				}
      }
    }

    console.log(dispCall)

    process.on('uncaughtException', function (err) {
      var value = err.message.match(/0x([a-zA-Z0-9]*)/)[1]
      value = Buffer.from(value, 'hex')
      //log.error(err.message)
      log.error(value.toString().replace(/[^-A-Za-z0-9/. ]/g, ''));
      process.exit(0)
    })

    if (!ether) {
      try {
        return await broadcastTx(web3, from, to, txData, value, gasLimit, gasPrice, nonce, null, getHashFast)
      } catch (e) {
        log.error(`broadcastTx threw Error: ${e.stack}`)
        return await contract.methods[methodName](...args).send({from, value, gasLimit, gasPrice, nonce})
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
      return await broadcastTx(web3, from, to, txData, value, gasLimit, gasPrice, nonce, null, getHashFast)
    }
  }
}

async function getFunctionParams (web3, abi, to, calldata, funcName = null, inputs, args) {
  const abiJson = await getAbi(web3, abi, to)
  let contract = new web3.eth.Contract(abiJson, to)
  var funcNameReg
  if (!calldata) {
    funcNameReg = new RegExp('^' + funcName + '$', '')
  }

  let funcObject = contract.options.jsonInterface
    .filter(abi =>
      (
        abi.type === 'function' ||
        !abi.type
      ) &&

      (calldata ?

        web3.eth.abi.encodeFunctionSignature(abi) === calldata.slice(0, 10)
        : (
          funcNameReg.test(abi.name) &&

          (!inputs || (abi.inputs.filter((input, index) => input.type === inputs[index]).length === inputs.length &&
            inputs.length === abi.inputs.length)) &&

          args.length === abi.inputs.length

        )))[0]

  try {
    funcName = funcObject['name']
  } catch (e) {

    throw new Error(`Function "${funcName}" not found at contract ${to}.`)
  }

  let methodName = funcName +
    '(' +
    funcObject['inputs'].reduce((total, input) => total + (total === '' ? '' : ',') + input.type, '') +
    ')'

  return {contract, funcObject, funcName, methodName}
}

async function getPath (sellToken, buyToken, pathString) {
  const yaml = require('js-yaml');
  const set = require('set-value');
  const network = config.get('web3.network')
  sellToken = sellToken === 'ETH' ? 'WETH' : sellToken.toUpperCase()
  buyToken = buyToken === 'ETH' ? 'WETH' : buyToken.toUpperCase()

  if (!pathString || pathString === '') {
    var pathKey = [sellToken, buyToken].sort().join('-')
    if (!config.has(`web3.networks.${network}.uniswap.paths.${pathKey}`)) {
      if (sellToken !== 'WETH' && buyToken !== 'WETH') {
        return JSON.stringify([sellToken, 'WETH', buyToken])
      } else {
        return JSON.stringify([sellToken, buyToken])
      }
    }
    path = config.get(`web3.networks.${network}.uniswap.paths.${pathKey}`)
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
    const pathLoc = `web3.networks.${network}.uniswap.paths`
    var paths = config.get(pathLoc)
    paths = {...paths, [pathKey]: path}
    const conf = yaml.load(fs.readFileSync(`${baseDir}config/default.yaml`, 'utf-8'))
    set(conf, pathLoc, paths)

    fs.writeFileSync(
      `${baseDir}config/default.yaml`,
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

async function importAddress (web3, args) {
  if (!args.contractAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
    throw new Error('Wrong contract address given.')
  }
  const yaml = require('js-yaml');
  const set = require('set-value');
  const conf = yaml.load(fs.readFileSync(`${baseDir}config/default.yaml`, 'utf-8'))
  const network = config.get('web3.network')
  if (args.location === '' || !args.location) {
    // find insert location based on contractName
    const addresses = Object.keys(config.get(`web3.networks.${network}`))
    log.info('Searching for insert location based on name...')
    for (var idx = 0; idx < addresses.length; idx++) {
      var names = Object.keys(config.get(`web3.networks.${network}.${addresses[idx]}`))
      var nameMatch = new RegExp(`^${args.contractName.split('_')[0]}`)
      var matching = names.filter(name => nameMatch.test(name))
      if (matching.length > 0) {
        args.location = `web3.networks.${network}.${addresses[idx]}`
        break
      }
    }
    if (args.location === '' || !args.location) {
      args.location = `web3.networks.${config.get('web3.network')}.other`
    }
  }

  // access element in change using args.location eg: 'web3.networks.mainnet.token'
  try {
    var change = args.location.split('.').reduce((acc, key) => acc && acc[key], conf)
  } catch (e) {
    change = undefined
  }
  if (change) {
    // location exists
    change = {...change, [args.contractName]: {address: args.contractAddress}}
  } else {
    // location does not exist
    change = {[args.contractName]: {address: args.contractAddress}}
  }

  set(conf, args.location, change);

  fs.writeFileSync(
    `${baseDir}/config/default.yaml`,
    yaml.dump(conf, {forceQuotes: true}),
    () => {
      throw Error(`File config could not be written.`)
    }
  )

  log.info(`Contract inserted into ${args.location}`)
  // reload config and dependent w3
  config = require('config')

  const abiJson = await getAbi(web3, args.contractName, args.contractAddress)
  var implAddr
  try {
    implAddr = await proxyImplAddress(web3, abiJson, args.contractAddress)
  } catch (e) {
    throw Error('Wrong proxy')
  }
  if (implAddr) {

    log.debug('here importAddress')

    await importAddress(
			web3,
      {
        ...args,
        contractName: `${args.contractName}_IMPLEMENTATION`,
        contractAddress: implAddr
      }
    )

  }
  return ''
}

async function proxyImplAddress (web3, abiJson, address) {

	if (!web3) {
				const network = config.get('web3.network')
				web3 = await ut.getWeb3(network)
	}
  var res_EIP_897
  var res_EIP_1967

  address = await getAddress(address)

  const address_EIP_1967 = '0x' + (
    await web3.eth.getStorageAt(
      address,
      '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc')
  ).slice(-40)

  log.debug({address_EIP_1967})

  if (address_EIP_1967.match(/0x0{40}/)) {
    const beacon_EIP_1967 = '0x' + (
      await web3.eth.getStorageAt(
        address,
        '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50')
    ).slice(-40)

    log.debug({beacon_EIP_1967})

    if (!beacon_EIP_1967.match(/0x0{40}/)) {
      const contract = new web3.eth.Contract(
        [{name: "implementation",
          type: "function",
          inputs:[],
          outputs:['address'],
          stateMutability: 'view'}
        ],
        beacon_EIP_1967)

      res_EIP_1967 = await contract.methods['implementation']().call()
      if (
        res_EIP_1967.match(/0x0{40}/) ||
        !res_EIP_1967.match(/^0x[0-9a-zA-Z]{40}$/)
      ) {
        res_EIP_1967 = null
      }
    }
  } else {
    res_EIP_1967 = address_EIP_1967
  }

  if (!res_EIP_1967) {
    var res_EIP_1822 = '0x' + (
      await web3.eth.getStorageAt(
        address,
        '0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7')
    ).slice(-40)

    log.debug({res_EIP_1822})
    if (
      res_EIP_1822.match(/0x0{40}/) ||
      !res_EIP_1822.match(/^0x[0-9a-zA-Z]{40}$/)

    ) {
      res_EIP_1822 = null

      res_EIP_897 =  abiJson && abiJson.find(a =>
        a.name === 'implementation' &&
        a.type === 'function' &&
        a.outputs[0].type === 'address' &&
        a.stateMutability === 'view'
      )

      log.debug({res_EIP_897})

      if (res_EIP_897) {
        const contract = new web3.eth.Contract(abiJson, address)
        res_EIP_897 = await contract.methods['implementation']().call()
        if (
          res_EIP_897.match(/0x0{40}/) ||
          !res_EIP_897.match(/^0x[0-9a-zA-Z]{40}$/)
        ) {
          res_EIP_897 = null

          log.debug({res_EIP_897})
        }
      }
    }
  }
  // we should return null if none of the proxy methods apply
  return res_EIP_897 || res_EIP_1822 || res_EIP_1967
}

/* Translates address id like 'DAI' to real address and */
async function getAddress (address) {
  const {address:addr} = await getAddressType(address)
  return addr
}

async function getAddressNames (regex, contractNamesOnly = false) {
  const network = config.get('web3.network')

  var accountNames = []
  if (!contractNamesOnly) {
    accountNames =
      Object.keys(config
        .get('web3.account'))
      .filter(accountName => accountName.match(new RegExp(regex)))
  }

  var contractNames = Object.keys(config.get(`web3.networks.${network}`)).reduce(
    (acc, type) => acc.concat(
      Object.keys(
        config.get(`web3.networks.${network}.${type}`)
      )
      .filter(contractName => contractName.match(new RegExp(regex)))
    )
    , [])

  return accountNames.concat(contractNames)
}

async function getAddressType (address) {
	let confPath
	if (!address || (typeof address === 'number' && address === 0)) return {address: '0x0000000000000000000000000000000000000000', type: null, confPath: null}
  if (address.match(/^0x[A-Fa-f0-9]{40}$/i)) {
    var addrNames = Object.keys(config.get(`web3.account`))
    for (idx = 0; idx < addrNames.length; idx++) {
			confPath = `web3.account.${addrNames[idx]}`
      conf = `${confPath}.address`
      if (config.has(conf) && config.get(conf).toLowerCase() === address.toLowerCase()) {
        log.debug(`Address ${address} is ${addrNames[idx]}.`)
        log.debug(`Address ${addrNames[idx]} is a web3 account.`)
				return {address: config.get(conf), type: 'account', confPath}
      }
    }
    const addresses = Object.keys(config.get(`web3.networks.${network}`))
    var idx
    var id1
    for (idx = 0; idx < addresses.length; idx++) {
      addrNames = Object.keys(config.get(`web3.networks.${network}.${addresses[idx]}`))
      for (id1 = 0; id1 < addrNames.length; id1++) {
				confPath = `web3.networks.${network}.${addresses[idx]}.${addrNames[id1]}`
        conf = `${confPath}.address`
        if (config.has(conf) && config.get(conf).toLowerCase() === address.toLowerCase()) {
          log.debug(`Address ${address} is a ${addresses[idx]} contract.`)
          address = config.get(conf)
          return {address: Web3.utils.toChecksumAddress(address), type: addresses[idx], confPath}
        }
      }
    }
		return {address: Web3.utils.toChecksumAddress(address), type: 'none', confPath: 'none'}
  } else {
    var conf = `web3.account.${address}.address`
    if (config.has(conf)) {
      log.debug(`Address ${address} is a web3 account.`)
			log.debug({conf})
      return {address:Web3.utils.toChecksumAddress(config.get(conf)), type: 'account'}
    } else {
      const addresses = Object.keys(config.get(`web3.networks.${network}`))
      for (idx = 0; idx < addresses.length; idx++) {
        conf = `web3.networks.${network}.${addresses[idx]}.${address}.address`
        if (config.has(conf)) {
          log.debug(`Address ${address} is a ${addresses[idx]} contract.`)
          return {address: Web3.utils.toChecksumAddress(config.get(conf)), type: addresses[idx]}
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
    const addresses = Object.keys(config.get(`web3.networks.${network}`))
    var idx
    var id1
    for (idx = 0; idx < addresses.length; idx++) {
      addrNames = Object.keys(config.get(`web3.networks.${network}.${addresses[idx]}`))
      for (id1 = 0; id1 < addrNames.length; id1++) {
        conf = `web3.networks.${network}.${addresses[idx]}.${addrNames[id1]}.address`
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
      const addresses = Object.keys(config.get(`web3.networks.${network}`))
      for (idx = 0; idx < addresses.length; idx++) {
        conf = `web3.networks.${network}.${addresses[idx]}.${address}.address`
        if (config.has(conf)) {
          log.debug(`Address ${address} is a ${addresses[idx]} contract.`)
          return {name: address, type: addresses[idx]}
        }
      }
    }
  }
  log.info(`Did not find anything to match ${address} in config.`)
  return {name: (address.match(/^0x[A-Fa-f0-9]{40}$/) ? Web3.utils.toChecksumAddress(address) : address), type: 'none'}
}

async function decimals (web3, block, token) {
  if (await getAddress(token) !== await getAddress('ETH')) {
    return await access(web3, block, token, 'decimals', [], 'ERC20')
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
  getAddressNames,
  getAddressType,
  getAirsignSignature,
  getGasPrice,
  getLedgerDerivePath,
  getLedgerEthereumDerivePath,
  getLedgerSignature,
  getNonce,
  getPath,
  getPrivateKeySignature,
  getSourceCode,
  getWeb3Function,
  importAddress,
  kyberGetRates,
  kyberTrade,
  sigUtil,
  toHex,
}
