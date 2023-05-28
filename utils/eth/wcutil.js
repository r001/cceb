const w3 = require('../web3.js')
const log4js = require('log4js')
const config = require('config')
const colors = require('colors')
const inquirer = require('inquirer')
const {getSdkError} = require("@walletconnect/utils")

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

async function signV2 (walletconnectV2, event, args) {
	const web3 = await w3.getWeb3(network)
	const {topic, params, id} = event
	const {request, chainId} = params
	const {method, params: methodParams} = request
	log.debug(`Topic: ${topic}`)
	log.debug(`Params: ${JSON.stringify(params, null, 2)}`)
	log.debug(`Id: ${id}`)
	log.debug(`Request: ${JSON.stringify(request, null, 2)}`)
	log.debug(`ChainId: ${chainId}`)
	log.debug(`Method: ${method}`)
	log.debug(`MethodParams: ${JSON.stringify(methodParams, null, 2)}`)

	var signature
	switch (method) {
		case "personal_sign": 
			var [message, from] = methodParams

			signature = '0x' + await getResV2(
				'personal_sign', 
				await getSignFunction(from),
				{
					type: 'sign_personal_message',
					data: message,
					from
				},
				walletconnectV2,
				id
			)
				.replace(/^\s*0x/, '')
				.replace(/[^A-Fa-f0-9]*$/, '')

			approveRequestV2(walletconnectV2, topic, id, signature)
			break
		case "eth_sign": 
			[from, message] = methodParams	
			log.info(`Signing message`)

			signature = '0x' + await getResV2(
				'eth_sign', 
				await getSignFunction(from),
				{
					type: 'sign_message',
					data: message,
					from
				},
				walletconnectV2,
				id
			)
				.replace(/^\s*0x/, '')
				.replace(/[^A-Fa-f0-9]*$/, '')

			log.info(`Signature: ${signature}`)

			approveRequestV2(walletconnectV2, topic, id, signature)
			break
		case "eth_signTypedData":
		case 'eth_signTypedData_v1':
		case 'eth_signTypedData_v3':
		case 'eth_signTypedData_v4':
		case 'eth_signTypedData_v5':
		case 'eth_signTypedData_v6':
		case 'eth_signTypedData_v7':
		case 'eth_signTypedData_v8':
		case 'eth_signTypedData_v9':
			from = methodParams[0]
			var typedData = methodParams[1]
			var version = 'V4' // default version
			if (args && args.typeddataversion) {
				version = `V${args.typeddataversion}`
			} else if (method[19]) {
				version = `V${method[19]}`
			} 
			if (chainId !== typedData.domain.chainId) { 
				await walletconnectV2.rejectSession({
					id,
					reason: getSdkError('UNSUPPORTED_CHAINS'),
				})

				log.error(`Invalid chainId: ${chainId} != ${typedData.domain.chainId}`)
			}
			await visualizeTypedData(web3, JSON.parse(typedData))
			log.info(`Signing typed data`)
			log.debug(`Method: ${method}`)
			log.debug(`Version: ${version}`)
			log.debug(`From: ${from}`)
			log.debug(`CChainId: ${chainId}`)

			signature = '0x' + await getResV2(
				'eth_signTypedData', 
				await getSignFunction(from),
				{
					type: 'sign_typed_data',
					data: typedData,
					from,
					version,
				},
				walletconnectV2,
				id
			)
				.replace(/^\s*0x/, '')
				.replace(/[^A-Fa-f0-9]*$/, '')

			log.info(`Signature: ${signature}`)

			approveRequestV2(walletconnectV2, topic, id, signature)
			break
		case "eth_signTransaction":
			var txData = methodParams[0]
			from = txData.from
			txData.chainId = chainId.replace(/.*:/g, '')
			log.info(`Signing transaction`)

			signature = '0x' + (
				await getResV2(
					'eth_signTransaction', 
					await getSignFunction(from),
					{
						type: 'sign_transaction',
						data: txData,
						from,
					},
					walletconnectV2,
					id
				)
			)
				.replace(/^\s*0x/, '')
				.replace(/[^A-Fa-f0-9]*$/, '')

			log.info(`Signature: ${signature}`)

			approveRequestV2(walletconnectV2, topic, id, signature)

			break
		default:
			await walletconnectV2.rejectSession({
				id,
				reason: getSdkError('UNSUPPORTED_METHOD'),
			})

			log.error(`Invalid method: ${method}`)
	}
}

async function signV1 (walletConnect, payload, args) {
	const web3 = await w3.getWeb3(network)
	var from 
	switch (payload.method) {
		case 'personal_sign':
			from = payload.params[1]
			break
		case 'eth_signTypedData':
		case 'eth_signTypedData_v4':
		case 'eth_sendRawTransaction':
		case 'eth_sign':
			from = payload.params[0]
			log.debug(`Signing message from ${from}`)
			break
		case 'eth_sendTransaction':
		case 'eth_signTransaction':
			from = payload.params[0].from
			log.debug(`Signing transaction from ${from}`)
			break
		default:
			log.error(`Unsupported method: ${payload.method}`)

			walletConnect.rejectRequest({
				id: payload.id,
				error: {
					code: -1,
					message: `Method ${payload.method} not found`,
				}})

			log.info(`Request rejected`)

			throw new Error(`Method ${payload.method} not found`)
	}


	var result, signature, rawTx, txReceipt 

  const signFunction = await getSignFunction(from)
	
	switch (payload.method) {
		case 'personal_sign':
			console.log('from: ', from)
			console.log('msg: ', Buffer.from(payload.params[0]).toString())
			log.info(`Signing personal message`)
			from = payload.params[1]

			result = '0x' + (
				await getResV1(
					'personal_sign',
					signFunction,
					{
						type: 'sign_personal_message',
						data: payload.params[0],
						from: payload.params[1]
					},
					walletConnect,
					payload
				)
			)
				.replace(/^\s*0x/, '')
				.replace(/[^A-Fa-f0-9]*$/, '')

			log.info(`Signature: ${result}`)
			approveRequest(walletConnect, payload, result)
			break
		case 'eth_sign':
			console.log('from: ', from)
			console.log('msg: ', Buffer.from(payload.params[0]).toString())
			log.info(`Signing message`)
			from = payload.params[1]

			result = '0x' + (
				await getResV1(
					'eth_sign',
					signFunction,
					{
						type: 'sign_message',
						data: payload.params[1],
						from: payload.params[0]
					},
					walletConnect,
					payload
				)
			)
				.replace(/^\s*0x/, '')
				.replace(/[^A-Fa-f0-9]*$/, '')

			log.info(`Signature: ${result}`)

			approveRequest(walletConnect, payload, result)
			break
		case 'eth_signTypedData':
		case 'eth_signTypedData_v4':
		case 'eth_signTypedData_v5':
		case 'eth_signTypedData_v6':
		case 'eth_signTypedData_v7':
		case 'eth_signTypedData_v8':
		case 'eth_signTypedData_v9':
			var version = 'V4' // default version
			if (args && args.typeddataversion) {
				version = `V${args.typeddataversion}`
			} else if (payload.method[19]) {
				version = `V${payload.method[19]}`
			} 
			// await visualizeTypedData(web3, JSON.parse(payload.params[1]))
			log.info(`Signing typed data`)
			log.debug(`Typed data version: ${version}`)
			log.debug(`payload.method: ${payload.method}`)
			from = payload.params[0]

			result = '0x' + (
				await getResV1(
					'eth_signTypedData',
					signFunction,
					{
						type: 'sign_typed_data',
						data: payload.params[1],
						from: payload.params[0],
						version,
					},
					walletConnect,
					payload
				)
			)
				.replace(/^\s*0x/, '')
				.replace(/[^A-Fa-f0-9]*$/, '')


			log.info(`Signature: ${result}`)
			approveRequest(walletConnect, payload, result)
			break
		case 'eth_sendTransaction':
			log.info(`Sending transaction`)
			from = payload.params[0].from

			try {
				result = (await w3.access(
					web3, 
					null,
					payload.params[0].to,
					null,
					null,
					null,
					args.overridefrom || payload.params[0].from,
					payload.params[0].value,
					args.overridegaslimit || args.theirgas && payload.params[0].gas,
					args.overridegasprice || args.theirgas && payload.params[0].gasPrice,
					args.overridenonce || payload.params[0].nonce,
					null,
					null,
					payload.params[0].data,
					args.gasoverhead,
					true                       // getHashFast
				)).transactionHash

				log.info(`Transactionhash: ${result}`)

				approveRequest(walletConnect, payload, result)

			} catch (e) {
				let message = `Signing aborted`
				log.error(`Error sending transaction: ${message} \n${e.stack}`)

				walletConnect.rejectRequest({
					id: payload.id,
					error: {
						code: -1,
						message,
					}
				})

				log.info(`Request rejected`)
			}

			break
		case 'eth_signTransaction':
			log.info(`Signing transaction`)
			from = payload.params[0].from

			signature = await getResV1(
				'eth_signTransaction', 
				signFunction, 
				{
					type: 'sign_transaction',
					payload: payload.params[0],
					from: payload.params[0].from
				},
				walletConnect,
				payload
			)

			approveRequest(walletConnect, payload, signature)

			break  
		case 'eth_sendRawTransaction':
			log.info(`Sending raw transaction`)
			rawTx = payload.params[0]

			txReceipt = await getResV1(
				'eth_sendRawTransaction',
				null,
				rawTx,
				walletConnect,
				payload
			)

			approveRequest(walletConnect, payload, txReceipt.transactionHash)

			break
		default:
			throw new Error(`Unknown method: ${payload.method}`)
	}
}

async function getSignFunction (from) {
	const accounts = config.get(`web3.account`)
	log.trace(`Accounts: ${JSON.stringify(accounts)}`)
	const accountType = accounts[Object.keys(accounts).filter(key => accounts[key].address.toLowerCase() === from.toLowerCase())[0]].type
	var signFunction
	switch (accountType) {
		case 'ledger':
			log.info(`Using Ledger account`)
			signFunction = w3.getLedgerSignature
			break
		case 'airsign':
			log.info(`Using Airsign account`)
			signFunction = w3.getAirsignSignature
			break
		case 'privatekey':
			log.info(`Using PrivateKey account`)
			signFunction = w3.getPrivateKeySignature
			break
		default:
			throw new Error(`Unknown account type: ${accountType}`)
	}
	return signFunction
}

async function getResV1 (type, signFunction, arg, walletConnect, payload) {
  try {
    switch (type) {
      case 'eth_sendRawTransaction':
        log.info(`Sending raw transaction: ${JSON.stringify(arg)}`)
        return await w3.web3.eth.sendSignedTransaction(arg).on('error', console.error)
      default:
        try {
          return await signFunction(arg, arg.type)
        } catch (e) {
          log.error(`Rejected ${type}: ${JSON.stringify(arg)}`)

          walletConnect.rejectRequest({
            id: payload.id,
            error: {
              code: e.code,
              message: e.message,
            }
          })

          log.info(`Request rejected`)
        }
    }
  } catch (e) {
    log.error(`Rejected raw transaction: ${JSON.stringify(arg)}`)

    walletConnect.rejectRequest({
      id: payload.id,
      error: {
        code: e.code,
        message: e.message,
      }
    })

    log.info(`Request rejected`)
  }
}

async function getResV2 (type, signFunction, arg, walletConnectV2, id) {
  try {
    switch (type) {
      case 'eth_sendRawTransaction':
        log.info(`Sending raw transaction: ${JSON.stringify(arg)}`)
        return await w3.web3.eth.sendSignedTransaction(arg).on('error', console.error)
      default:
        try {
          return await signFunction(arg, arg.type)
        } catch (e) {
          log.error(`Rejected ${type}: ${JSON.stringify(arg)}`)

          await walletConnectV2.rejectRequest({
            id,
            reason: getSdkError('USER_REJECTED') 
					})

          log.info(`Request rejected`)
        }
    }
  } catch (e) {
    log.error(`Rejected raw transaction: ${JSON.stringify(arg)}`)

    walletConnectV2.rejectRequest({
      id,
      reason: getSdkError('USER_REJECTED')
    })

    log.info(`Request rejected`)
  }
}

function approveRequest (walletConnect, payload, result) {

        let approved = {
          id: payload.id,
          jsonrpc: payload.jsonrpc,
          result,
        }

        log.debug(`approved: ${JSON.stringify(approved)}`)

        walletConnect.approveRequest(approved)

        log.info(`Request approved`)
}

function approveRequestV2 (walletConnect, topic, id, signature) {

				let response = 
				{
					topic, 
					response: {
						id,
						jsonrpc: '2.0',
						result: signature,
					}
				}

        log.debug(`approved: ${JSON.stringify(response)}`)

        walletConnect.approveRequest(response)

        log.info(`Request approved`)
}

async function visualizeTypedData (web3, typedData) {

  colors.setTheme({
    silly: 'rainbow',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    info: 'green', //'white',
    data: 'grey', //'grey',
    help: 'cyan',
    warn: 'yellow', //'yellow',
    debug: 'blue',
    error: 'red'
  })

  const sanitizedTypedData = w3.sigUtil.TypedDataUtils.sanitizeData(typedData)
  log.info(`Sanitized typed data: ${JSON.stringify(sanitizedTypedData)}`)

  console.log(`typed data:`.info)
  console.log(`  domain:`.info)
  for (const i in sanitizedTypedData.domain) {
    log.info(`    ${i}: ${sanitizedTypedData.domain[i]}`)
    var dis = sanitizedTypedData.domain[i]
    var disType = sanitizedTypedData.types.EIP712Domain.find(entry => entry.name === i).type 
    switch (disType) {
      case 'string':
        console.log(`    ${i}: `.info + `"${dis}"`.data)
        break
      case 'address':
        dis = await w3.getAddressName(dis)
        console.log(`    ${i}: `.info + `${dis}`.data)
        if (dis.match(/^\s*0x[a-fA-F0-9]*\s*$/)) {
          await inquireAddress(web3, dis)
        } 
        break
      default:
        if (disType.match(/uint\d+/)) {
          console.log(`    ${i}: `.info + `${dis}`.data)
        } else {
          throw new Error(`Unknown type: ${disType}`)
        }
    }
  }
  console.log(`  message:`.info)
  await displayMessageItem(2, sanitizedTypedData.primaryType, sanitizedTypedData,  sanitizedTypedData.message)
}

async function displayMessageItem (depth, parentTypeName, sanitizedTypedData, dispObject) {
  for (var name in dispObject) {
    if (typeof dispObject[name] === 'object') {
      // type is object
      console.log(`${' '.repeat(depth)}${name}:`.info)
      await displayMessageItem(depth + 1, name, sanitizedTypedData, dispObject[name])
      continue
    } 

    // get value
    const value = dispObject[name]

    // get type of value
    var type = sanitizedTypedData.types[parentTypeName].find(entry => entry.name === name).type
    switch (type) {
      case 'string':
      case 'bytes':
        console.log(`${"  ".repeat(depth) + name}: `.info + `"${value}"`.data)
        break
      case 'address':
        console.log(`${"  ".repeat(depth) + name}: `.info + `${await w3.getAddressName(value)}`.data)
        break
      default:
        if (type.match(/uint\d*/)) {
          console.log(`${"  ".repeat(depth) + name}: `.info + `${value}`.data)
        } else {
          console.log(`${"  ".repeat(depth) + name}: `.warn + `"${value}"`.warn)
        }
    }

  }

}

async function inquireAddress (web3, address) {
  let accept = await inquirer.prompt([{
    type: 'list',
    name: 'accept',
    message: `${address} is not recognized address. This can be a FRAUD!! What do you want to do?`,
    choices: [
      'Import address',
      'Accept address',
      'Reject signature',
      'Cancel',
    ]}])

  let im, args
  switch (accept.accept) {
    case 'Import address':
      im = await inquirer.prompt([{
        type: 'input',
        name: 'address',
        message: `Enter address name import to: (use upper case letters and underscore)`,
        validate (value) {
          if (value.match(/^\s*[A-Z0-9][A-Z0-9_]*\s*$/)) {
            return true
          } else {
            return 'Please enter valid address name'
          }
        }

      },
        {
          type: 'input',
          name: 'importpath',
          message: `Enter address path import to: (eg.: web3.networks.mainnet.token) leave empty for default)`,
          validate (value) {
            let accepted = new RegExp(`^\\s*web3\\.networks\\.(mainnet|ropsten|rinkeby|kovan)\\.\\w+\\s*$|^\\s*$`)
            if (value.match(accepted)) {
              return true
            } else {
              return 'Please enter valid address path'
            }
          }
        }])

      args = {contractName: im.address, contractAddress: address, location: im.importpath}
      await w3.importAddress(web3, args)
      break
    case 'Accept address':
      break
    case 'Reject signature':
    case 'Cancel':
      throw new Error('Signature rejected')
    default:
      throw new Error('Unknown option')
  }
}

module.exports = {
  signV1,
	signV2,
	getSignFunction,
}
