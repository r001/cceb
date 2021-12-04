# cceb
[![GitHub license](https://img.shields.io/github/license/r001/cceb)](https://github.com/r001/cceb/blob/main/LICENSE)
[![NPM version](https://img.shields.io/npm/v/cceb.svg?style=flat)](https://www.npmjs.org/package/cceb)
[![Twitter](https://img.shields.io/twitter/url?url=https%3A%2F%2Ftwitter.com%2Fcceb08733804)](https://twitter.com/intent/tweet?text=Wow:&url=https%3A%2F%2Ftwitter.com%2Fcceb08733804)

> Bash cli for trading, and to interact with RadixDLT and Ethereum.

## What's new 
### Changes from 1.3.x to 1.4.x

[RadixDLT](https://www.radixdlt.com) interaction is enabled along with auto completion support for Bash. All the current methods are implemented. 

## Features

* Support to operate with 150+ exchanges that are supported by [CCXT](https://github.com/ccxt/ccxt) library
* Support trading on UNISWAP and Kyber
* Ethereum smart contract interaction
	* [MakerDAO](https://www.makerdao.com) supported
	* [AAVE](https://github.com/ccxt/ccxt) supported
	* [Curve](https://curve.fi) contracts integrated (All operations manageable via command line.)
* Ethereum wallets supported:
	* Account with private keys
	* [Ledger](https://www.ledger.com/) wallet supported
	* [Airsign](https://github.com/r001/airsign) supported. Keys are stored on an android device, that is shut off from internet, and communicates with cceb through QR codes.
* Access CCEB remotely using [Telegram](https://telegram.org).
* Works on Android [Termux](https://termux.com/)

## Getting started

### Prerequisities
You need access to the followings in order to make CCEB work:
* On exchanges you wish to connect to, generate api keys and secrets.
* [Infura](https://infura.io) api-key is needed for Ethereum (and Uniswap) interaction.
* [Etherscan](https://etherscan.io/) api-key is needed to download abi and contract source code for your Ethereum smart contracts.
* [Ethgasstation](https://ethgasstation.info/) api-key is needed for gas pricing for Ethereum transactions.
* [Telegram](https://telegram.org) telegram-token is needed if you want to access CCEB from within Telegram. To receive it:
	- Within Telegram send message to `BotFather`:
		- `/start`
		- `/newbot`
		- `/<name_ending_with_bot>`
		- The reply of `BotFather` will include telegram-token. Use this token during [Installing](#installing)!

### Installing

1. Install CCEB:  
`$ npm i -g cceb`
2. Add api keys:  
`$ vim $(npm root -g)/cceb/config/secrets/default.yaml`
	- install basic Ethereum interactions
		- edit [Infura](https://infura.io) api key: `web3.mainnet.infura.api-key`
		- edit [Ethgasstation](https://ethgasstation.info) api-key: `web3.ethgasstation.api-key`
	- install centralized exhchange credentials
		- add exchange name (using [list](https://github.com/ccxt/ccxt)):
		```
		keys:
			<ecxhange_name>:	
				apiKey: <your_key>
				secret: <your_secret>
				type: 'centralized'
				enableRateLimit: true
				timeout: 30000
			<ecxhange_name_1>:
				apiKey: ...
				...
		```
	- (optional) enable abi and contract source download
		- (optional) edit [Etherscan](https://etherscan.io) api-key: `web3.etherscan.api-key`
	- (optional) add Telegram token: `telegram-token`
3. (optional) Configure cceb.  
`$ vim $(npm root -g)/cceb/config/default.yaml`
	- (optional) Set Ethereum tx speed.`web3.txSpeed`   
		Values `fastest`: < 30 sec, `fast`: < 2 min, `average`: < 5 min, `safeLow`: < 30 min
	- (optional) Set default account: `web3.defaultFrom`
	- (optional) Set network: `web3.network`
4. Check if all works well

	`$ cceb eth tx USDT balanceOf 0x1062a747393198f70f71ec65a582423dba7e5ab3`  
  Should return a number greater than zero.

	`$ cceb exchange listbalances <exchange_name>`   
	Should return your balances on <exchange_name> you configured in [Installing](#installing).  

## Examples

### Exchange

Add order on [Binance](https://www.binance.com):  
`$ cceb exchange add binance buy market 1 ETH/USDT 0`  

Add order on [Uniswap](https://app.uniswap.org/#/swap):  
`$ cceb exchange add uniswap buy market 1 ETH/USDT 0`  

Add order buying the maximum ETH possible on [Binance](https://www.binance.com):  
`$ cceb exchange add binance buy market max ETH/USDT 0`  

Add order buying the maximum ETH possible on [Uniswap](https://app.uniswap.org/#/swap):  
`$ cceb exchange add uniswap buy market max ETH/USDT 0`  

Add order buying half of the maximum ETH possible on [Binance](https://www.binance.com):  
`$ cceb exchange add binance buy market max/2 ETH/USDT 0`  

Add order buying half of the maximum ETH possible on [Uniswap](https://app.uniswap.org/#/swap):  
`$ cceb exchange add uniswap buy market max/2 ETH/USDT 0`  

Sell CRV in batches using random batch size between 0 and 1000 CRV with random time varying from 120 to 240 seconds between the creation of sell orders. Create order only if price of CRV is a minimum of 4 on [Binance](https://www.binance.com)  
`$ cceb exchange trickle binance sell market 2090.46936856 CRV/USDT 0 -s 0 -v 1000 -t 120 -r 120 -m 4`  

Emulate limit order on Uniswap, selling 11 MKR at limit price of 2000. Will try to sell once in every 300 seconds, if price is higher than or equal to limit:  
`$ cceb exchange trickle uniswap sell market 11 MKR/USDT 0 -s 11 -m 2000 -y 300 -t 10 -r 0`  

### Ethereum contract manipulation

Get info on [Curve.fi](https://www.curve.fi):  
`$ cceb eth curve info`  

See how much an ETH is worth on Uniswap.  
`$ cceb eth tx UNISWAP_ROUTER_V2 getAmountsOut 1.000000000000000000 '["WETH","USDT"]'`  

Send 1 ETH to 0x0000000000000000000000000000000000000000:  
`$ cceb eth tx ETH transfer ZERO_ADDRESS 1.000000000000000000`  

Import token (eg.: BZRX):  
`$ cceb eth import BZRX 0x56d811088235F11C8920698a204A5010a788f4b3 -l web3.mainnet.token`  

Once imported you can use its name to substitute for address:  
`$ cceb eth abi BZRX`  

### Ledger interaction

List ledger addresses:  
`$ cceb ledger addresses`

## Documentation

See [documentation](https://github.com/r001/cceb/blob/main/DOCUMENTATION.md).  

Get detailed help:  
`$ cceb --help`

## Authors
* **Robert Horvath** - *Initial work* - [Contact](https://github.com/r001)  
## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Disclaimer

This software and all its components come with absolutely no warranty whatsoever. Using this software is absolutely your own risk. Please note that test are missing, but I have been using this software for quite a while, and trying to fix its bugs.

## Acknowledgments

* Thanks for the CCXT team for the great product.
* Ethereum team did a great work with their api.
