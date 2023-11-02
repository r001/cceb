const w3 = require('../web3.js')
const WalletConnect = require("@walletconnect/client").default
const log4js = require('log4js')
const config = require('config')
const wc = require('./wcutil.js')
const {Core} = require('@walletconnect/core')
const {Web3Wallet} = require('@walletconnect/web3wallet')
const {buildApprovedNamespaces} = require("@walletconnect/utils")

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
	const version = uri.match(/@(.)/)[1]

	if (version === "1") {
		await walletconnectv1(args, uri)	
	} else if (version === "2") {
		await walletconnectv2(args, uri)
	} else {
		log.error(`Unsupported walletconnect version: ${version}`)
		process.exit(1)
	}
}

async function walletconnectv2 (args, uri) {

	const projectId = config.has('pprojectId') ? config.get('projectId') : "9d37e67f43e240b20e687515d759a71a"

	const core = new Core({
		projectId
	});

	const walletConnectV2 = await Web3Wallet.init({
		core, // <- pass the shared `core` instance
		metadata: {
			name: "cceb",
			description: "cceb wallet",
			url: "https://www.npmjs.com/package/cceb",
			icons: [],
		},
	});

	var namespaces

	walletConnectV2.on("session_proposal", async sessionProposal => {
		log.info(`Session Proposal`)
		log.debug(`Session Proposal: ${JSON.stringify(sessionProposal, null, 2)}`)

		const {id, params} = sessionProposal

		var accounts = await Promise.all(
			args.accounts.map(async account => await w3.getAddress(account))
		)

		const account0 = args.from || accounts[0]

		const chains = Object
			.keys(config.get(`web3.networks`))
			.map(network => config.get(`web3.networks.${network}.chainid`))
			.map(chainid => `eip155:${chainid}`)

		accounts = chains.map(chainid => `${chainid}:${account0}`)

		const namespacesCandidate = {
				proposal: params, 
				"supportedNamespaces": {
					"eip155": {
						"chains": chains,
						"methods": [
							"personal_sign",
							"eth_sign",
							"eth_sendTransaction",
							"eth_signTypedData",
							"eth_signTransaction",
						],
						"events": ["chainChanged", "accountsChanged"],
						"accounts": [...accounts, "eip155:0x0000000000000000000000000000000000000000"], 
					},
				},
			}

		log.debug(`Session Proposal, id: ${id} `)
		log.debug(`requiredNamespace: ${JSON.stringify(params.requiredNamespaces)}`)
		log.debug(`optionalNamespaces: ${JSON.stringify(params.optionalNamespaces)}`)
		log.debug(`Proposer: ${JSON.stringify(params.proposer)}`)
    log.debug(`namespacesCandidate: ${JSON.stringify(namespacesCandidate)}`)
		namespaces = buildApprovedNamespaces(namespacesCandidate)


		await walletConnectV2.approveSession({
			id,
			namespaces,
		});

		console.log(`Session Approved, accounts: ${accounts.join(', ')}`)

		process && process.on('SIGINT', async () => {
			log.info("Caught interrupt signal");
			await walletConnectV2.core.pairing.disconnect({topic: walletConnectV2.core.pairing.topic})
			log.info("Session killed");
			process && process.exit(0)
		});
	});

	walletConnectV2.on("session_request", async event => {
		log.info(`Session Request`)
		log.debug(`Session Request: ${JSON.stringify(event, null, 2)}`)
		await wc.signV2(walletConnectV2, event, args)
	});		

	walletConnectV2.on("session_delete", async () => {
		log.info(`Session Deleted`)
		walletConnectV2.core.pairing.disconnect({topic: walletConnectV2.core.pairing.topic})
		log.info("Transport closed");
		process && process.exit(0)
	});

	await walletConnectV2.core.pairing.pair({uri});	
	log.info(`Session Paired`)

	// eslint-disable-next-line no-constant-condition
	while  (true) {
		await sleep(1000)
	}
}

async function walletconnectv1 (args, uri) {
	log.info(`Connecting to ${uri}`)

	const walletConnectV1 = new WalletConnect({
		uri,
		clientMeta: {
			description: "cceb wallet",
			url: "https://www.npmjs.com/package/cceb",
			icons: ["https://walletconnect.com/walletconnect-logo.png"],
			name: "cceb",
		},
	})


		walletConnectV1.on('session_request', async (error, payload) => {
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

			walletConnectV1.approveSession(result)

			console.log(`Session Approved, accounts: ${accounts.join(', ')}`)

			process && process.on('SIGINT', async () => {
				log.info("Caught interrupt signal");
				await walletConnectV1.killSession()
				log.info("Session killed");
				walletConnectV1.transportClose()
				log.info("Transport closed");
				process && process.exit(0)
			});
		})

		walletConnectV1.on('call_request', async (error, payload) => {
			if (error) {
				log.error(error)
				return
			}
			log.info(`Call Request: ${JSON.stringify(payload)}`)

			await wc.signV1(walletConnectV1, payload, args)

		})

		walletConnectV1.on('disconnect', (error, payload) => {
			log.info(`Got Disconnect`)
			if (error) {
				log.error(error)
				return
			}
			log.info(`Disconnected: ${JSON.stringify(payload)}`)
			walletConnectV1.transportClose()
			process && process.exit(0)
		})

		// eslint-disable-next-line no-constant-condition
		while  (true) {
			await sleep(1000)
		}
	}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getChainId () {
  const network = config.get('web3.network')
  return config.get(`web3.networks.${network}.chainid`)
}


module.exports = {
  displayConnect
}
