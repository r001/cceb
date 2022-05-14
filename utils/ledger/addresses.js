const Eth = require("@ledgerhq/hw-app-eth").default
const TransportNodeHid = require("@ledgerhq/hw-transport-node-hid-singleton").default

async function dispLedgerAddresses (args) {
	const addresses = await ledgerAddresses(args)
	Object.keys(addresses).map(key => addresses[key].map(desc => console.log(`${key}: ${desc.address} derivePath: ${desc.derivePath}`)))
}

async function ledgerAddresses (args) {
	switch (args.wallet) {
		case "Ethereum":
			console.log(await TransportNodeHid.list())
			// eslint-disable-next-line
			const transport = await TransportNodeHid.create();
			// eslint-disable-next-line
			const eth = new Eth(transport)

			var addressLoc = Array.from(Array(args.count).keys())
				.map(idx => idx + args.startPosition)

			var live = await addressLoc.reduce(async (acc, loc) => {
				const results = await acc
				const derivePath = `44'/60'/${loc}'/0/0`
				return [
					...results,
					{
						address: (await eth.getAddress(derivePath)).address,
						derivePath
					}
				]
			}, []
			)

			var legacy = await addressLoc.reduce(async (acc, loc) => {
				const results = await acc
				const derivePath = `44'/60'/0'/${loc}`
				return [
					...results,
					{
						address: (await eth.getAddress(derivePath)).address,
						derivePath
					}
				]
			}, []
			)

			return {live, legacy}
		default:
			throw new Error(`Wallet ${args.wallet} not implemented yet.`)
	}
}

module.exports = {
	dispLedgerAddresses,
	ledgerAddresses,
}

