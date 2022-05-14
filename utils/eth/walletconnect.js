const w3 = require('../web3.js')
const WalletConnect = require("@walletconnect/client").default
const log4js = require('log4js')
const config = require('config')
const colors = require('colors')
const inquirer = require('inquirer')

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

async function displayConnect (args) {
  const {uri} = args

  log.info(`Connecting to ${uri}`)

  const walletConnect = new WalletConnect({
    uri,
    clientMeta: {
      description: "cceb wallet",
      url: "https://www.npmjs.com/package/cceb",
      icons: ["https://walletconnect.com/walletconnect-logo.png"],
      name: "cceb",
    },
  })


  walletConnect.on('session_request', async (error, payload) => {
    if (error) {
      log.error(error)
      return
    }
    log.info(`Session Request: ${JSON.stringify(payload, null, 2)}`)
    const accounts = await Promise.all(args.accounts.map(async account => await w3.getAddress(account)))

    console.log(`Session request: ${JSON.stringify(payload.params[0].peerMeta.url)}`)

    var result = {
      accounts,
      chainId: args.chainid || await getChainId(),
    }
    
    log.info(`Approve result sent: ${JSON.stringify(result)}`)

    walletConnect.approveSession(result)

    console.log(`Session Approved, accounts: ${accounts.join(', ')}`)

    process && process.on('SIGINT', async () => {
      log.info("Caught interrupt signal");
      await walletConnect.killSession()
      log.info("Session killed");
      walletConnect.transportClose()
      log.info("Transport closed");
      process.exit(0)
    });
  })

  walletConnect.on('call_request', async (error, payload) => {
    if (error) {
      log.error(error)
      return
    }
    log.info(`Call Request: ${JSON.stringify(payload)}`)
    

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

    const accounts = config.get(`web3.account`)
    log.trace(`Accounts: ${JSON.stringify(accounts)}`)

    const accountType = accounts[Object.keys(accounts).filter(key => accounts[key].address.toLowerCase() === from.toLowerCase())[0]].type
    var fn, result, signature, rawTx, txReceipt 
    switch (accountType) {
      case 'ledger':
        log.info(`Using Ledger account`)
        fn = w3.getLedgerSignature
        break
      case 'airsign':
        log.info(`Using Airsign account`)
        fn = w3.getAirsignSignature
        break
      case 'privatekey':
        log.info(`Using PrivateKey account`)
        fn = w3.getPrivateKeySignature
        break
      default:
        throw new Error(`Unknown account type: ${accountType}`)
    }

    switch (payload.method) {
      case 'personal_sign':
        console.log('from: ', from)
        console.log('msg: ', Buffer.from(payload.params[0]).toString())
        log.info(`Signing personal message`)
        from = payload.params[1]

        result = '0x' + (
          await getRes(
            'personal_sign',
            fn,
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
          await getRes(
            'eth_sign',
            fn,
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
        await visualizeTypedData(JSON.parse(payload.params[1]))
        log.info(`Signing typed data`)
        from = payload.params[0]
        
        result = '0x' + (
          await getRes(
          'eth_signTypedData',
          fn,
          {
            type: 'sign_typed_data',
            data: payload.params[1],
            from: payload.params[0],
            version: payload.method === 'eth_signTypedData_v4' ? 'V4' : 'V3'
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

        signature = await getRes(
          'eth_signTransaction', 
          fn, 
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

        txReceipt = await getRes(
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
  })

  walletConnect.on('disconnect', (error, payload) => {
    log.info(`Got Disconnect`)
    if (error) {
      log.error(error)
      return
    }
    log.info(`Disconnected: ${JSON.stringify(payload)}`)

    process || process.exit(0)
  })

  // eslint-disable-next-line no-constant-condition
  while  (true) {
    await sleep(1000)
  }
}

async function getRes (type, fn, arg, walletConnect, payload) {
  try {
    switch (type) {
      case 'eth_sendRawTransaction':
        log.info(`Sending raw transaction: ${JSON.stringify(arg)}`)
        return await w3.web3.eth.sendSignedTransaction(arg).on('error', console.error)
      default:
        try {
          return await fn(arg, arg.type)
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

async function visualizeTypedData (typedData) {

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
          await inquireAddress(dis)
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

async function inquireAddress (address) {
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
          if (value.match(/^\s*[A-F0-9][A-F0-9_]*\s*$/)) {
            return true
          } else {
            return 'Please enter valid address name'
          }
        }

      },
        {
          type: 'input',
          name: 'importpath',
          message: `Enter address path import to: (eg.: web3.mainnet.token) leave empty for default)`,
          validate (value) {
            let accepted = new RegExp(`^\\s*web3\\.(mainnet|ropsten|rinkeby|kovan)\\.\\w+\\s*$`)
            if (value.match(accepted)) {
              return true
            } else {
              return 'Please enter valid address path'
            }
          }
        }])

      args = {contractName: im.address, contractAddress: address, location: im.importpath}
      await w3.importAddress(args)
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

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getChainId () {
  const network = config.get('web3.network')
  return config.get(`web3.${network}.chainid`)
}


module.exports = {
  displayConnect
}
