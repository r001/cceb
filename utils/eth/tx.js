const BN = require('bignumber.js')
const config = require('config')
const log4js = require('log4js')
const ut = require('../util')
const util = require('util')
const {web3MatchingCommands} = require('../argparse.js')
const w3 = require('../web3.js')

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

	async function dispEthTransaction (args) {
		var web3 = await w3.getWeb3(network)
		if (args._[1] === 'source') {
			console.log(await w3.getSourceCode(args.contractName))
			return
		}
		let disp = await getEthTransaction(web3, args)
		var decimals = 0
		if ((await w3.getAddressType(args.contract)).type === 'token' &&
			['balanceOf', 'totalSupply', 'allowance'].includes(args.func)) {
			decimals = await w3.decimals(web3, args.block, args.contract)
		}
			
		if (disp && disp.map) {
			await Promise.all(disp.map(async (func) => console.log(
				func.match && func.match(/^0x[A-Fa-f0-9]{40}$/i) ?
				await w3.getAddressName(func) :
				await toDec(func))))
		} else {
			if (disp !== null || typeof disp !== 'undefined' || disp === '') {
				if (typeof disp === 'object') {
					log.info(`Result is an object: ${JSON.stringify(disp)}`)
					try {
						disp = JSON.stringify(disp)
					} catch (e) {
						disp = util.inspect(disp, {maxArrayLength: null, depth:null})
					}
				} else {
					log.info(`Result is a string: ${disp}`)
					disp = String(disp)
				}

				disp = (await Promise.all(
					disp.split && disp.split(/\n/)
					.map(
						async (line) => 
						line.match(/^0x[A-Fa-f0-9]{40}$/i) && !args.contr  ?
						await w3.getAddressName(line) :
						await toDec(line, decimals))
				)).join("\n")

				console.log(disp)
			}
		}
		return
	}

	async function getEthTransaction (web3, args) {
		
		if (args.block < 0) {
			args.block = await web3.eth.getBlockNumber() + args.block
		}

		if (args._[1] === 'web3') {
			return await getWeb3(web3, args)
		}

		if (args._[1] === 'import') {
			return await w3.importAddress(web3, args)
		}

		if (args._[1] === 'address') {
			if (args.contr.match(/^0x[A-Fa-f0-9]{40}$/i)) {
				return await w3.getAddressName(args.contr)
			} else {
				return await w3.getAddress(args.contr)
			}
		}	
		
		if (args._[1] === 'send') {
			const tx = JSON.parse(args.txjson)
			if (!tx.gasPrice) {
				tx.gasPrice = {maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas}
			}
			return await w3.broadcastTx(
				web3,
				tx.from,
				tx.to,
				tx.data,
				tx.value,
				tx.gasLimit,
				tx.gasPrice,
				tx.nonce,
				args.signature
			)
		}

		if (args._[1] === 'nonce') {
			var acc = args.account.match(/^0x[0-9a-fA-F]{40}$/) ? args.account : await w3.getAddress(args.account)
			return await w3.getNonce(acc)
		}

		if (args.ls || args.ls === '' || args._[1] === 'abi') {
			
			args.ls = (!args.ls || args.ls === '') ? '.*' : args.ls
			return await w3.getAbiFunctions(web3, args.abi || args.contract, args.ls)
		
		}

		if (args.contract === 'ETH' || args.contract.match(/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/i)) {
			
			log.debug('eth transfer')
			log.debug(`args.func: ${args.func}`)
			log.debug(`args.args: ${JSON.stringify(args.args)}`)

			if (args.func.match(/transfer/i) && args.args[1].match(/max/i)) {
				
				log.debug('eth transfer')
				args.args[1] = await calcValue(web3, args.from, args.args[1], args.block)
				log.debug(`value to send: ${args.args[1]}`)
			
			} else if (args.func.match(/^transferFrom$/i) && args.args[2].match(/max/i)) {
			
				log.debug('eth transferFrom')
				args.args[2] = await calcValue(web3, args.args[0], args.args[2], args.block)
				log.debug(`value to send: ${args.args[2]}`)
			}
		}

		//handle array arguments
		if (typeof args.args !== 'object') {
			args.args = [args.args]
		}

		args.args = args.args.map(
			arg => arg.match(/^\s*\[.*]\s*$/) ?
			Array.from(JSON.parse(arg)) :
			arg 
		)

		log.debug('args.args: ' + JSON.stringify(args.args))
		log.debug(`args.gasPrice: ${args.gasPrice}`)

		return await w3.access(
			web3,
			args.block,
			args.contract,
			args.func,
			args.args,
			args.abi,
			args.from,
			args.value,
			args.gasLimit,
			args.gasPrice,
			args.nonce,
			null, // inputs
			null, // multiple use
			args.calldata
		)
	}


	async function getWeb3 (web3, args) {
		if (Number.isInteger(args.block)) {
			web3.eth.defaultBlock = w3.toHex(args.block)
		}
		log.debug({function: args.function})
		let func = (await web3MatchingCommands(web3, args.function, true, true))[0]
		log.debug({function: func})
		var fn = await w3.getWeb3Function(web3, func)
		var parent = await w3.getWeb3Function(web3, func.replace(/\.\w*\s*$/, ""))

		var params = await Promise.all(args.parameters.map(async param => {

			if (typeof param === 'string' && param.match(/^\s*[[{].*[\]}]\s*$/)) {
				param = JSON.parse(param)	
			}	


			try {
				return await w3.getAddress(param)
			} catch (e)  {
				return param
			}
		}))

		switch (typeof fn) {
			case 'function':
				log.debug("Function has been called.")
				try {
							ret = await fn(...params)
							log.debug("Used the fn(...params) method.")
					return ret
				} catch (e) {
					switch (e.name) {
						case "TypeError":
							var ret = await fn.call(parent, ...params)
							log.debug("Used the fn.call(parent, ...params) method.")
							return ret
						default:
							throw e
					}
				}
			default:
				log.debug("Return object.")
				return fn
		}
	}

	async function toDec (str, decimals) {
		if (typeof decimals === 'undefined' || decimals === null || decimals === "0x") decimals = 0
		log.debug(`decimals: ${decimals}`)
		if (String(str).match(/^[-+]?[0-9]+$/) && (decimals > 0 || BN(str).gt(BN(10).pow(18)))) {
			if (decimals === 0) { 
				decimals = 18
			}
			// return BN(str).div(BN(10).pow(decimals || 18)).toFixed()
			str.padStart(decimals + 1, '0')
			return str.slice(0, -(decimals)) +
				'.' +
				'000000000000000000000000000000000000'.slice(0, Math.max(decimals - str.length, 0)) +
				str.slice(-decimals)	
		} else {
			return str
		}
	}

	async function calcValue (web3, from, balanceExpr, block) {
		var balance = BN(await w3.access(web3, block, 'ETH', 'balanceOf', from)).div(BN(10).pow(18)).toFixed()
		return ut.evalExpr('max', balance, balanceExpr, true)
	}



module.exports = {
	dispEthTransaction,
	getEthTransaction,
	toDec,
	calcValue,
}
