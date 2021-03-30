# Documentation - cceb

`cceb` bash cli can be used to trade on centralized and decentralized exchanges, and explore and interact with [Ethereum](https://ethereum.org/en/) smart contracts.

## General structure of usage 

`cceb` has three main groups of commands:
- `cceb exchange` - Interact with exchanges
	- `cceb exchange deposit` - get deposit address for tokens
	- `cceb exchange add` - add limit or market order
	- `cceb exchange listorders` - list orders
	- `cceb exchange listbalances` - list balances
	- `cceb exchange rm` - remove an order
	- `cceb exchange rmall` - remove all orders
	- `cceb exchange orderbook` - show orderbook
	- `cceb exchange price` - show price
	- `cceb exchange trickle` - trickle - automatically create many small orders or one large order if price reaches a threshold value 
- `cceb eth` -  [Ethereum](https://ethereum.org/en/) blockchain interactions 
	- `cceb eth tx` - send or call ethereum contracts,
	- `cceb eth abi` - display abi of smart contracts in a human readable way
	- `cceb eth address` - get address of a contract name, or name of a contract address
	- `cceb eth source` - display source code of smart contracts
	- `cceb eth import` - import smart contract name and abi
	- `cceb eth maker` - Interact with [Makerdao](https://www.makerdao.com)
	- `cceb eth aave` - Interact with [Aave](https://aave.com), and 
	- `cceb eth curve` - Interact with [Curve](https://www.curve.fi).
- `cceb ledger` - [Ledger](https://www.ledger.com) interactions 
	- `cceb ledger addresses` - list ledger addresses.

### Interact with exchanges

Using `cceb` all basic exchange function can be executed including deposit, and withdraw funds. Add, remove, list orders, get orderbook, show a price of a token, and show available token pairs(markets).

#### Deposit tokens

Get deposit address for tokens on an exchange. 

##### Examples

Get deposit address for Ether on Binance:  
`$ cceb exchange deposit binance ETH`

##### Details `cceb exchange deposit`
```
$ cceb exchange deposit --help
usage: cceb exchange deposit [-h] exchange token

Get deposit address of token for exchange.

Positional arguments:
  exchange    Name of exchange.
  token       Token to deposit.

Optional arguments:
  -h, --help  Show this help message and exit.
```

#### Add order

Orders can be added on centralized exchanges like Binance, and on decentralized ones using the same syntax.

When stating amount, any javascript accepted mathematical expression can be used with the symbol of `max`, meaning 'maximum possible amount'.   
Add order buying Ether for half of the USDT we have at a limit price of 1500:  
`$ cceb exchange add binance buy limit max/2 ETH/USDT 1500`  
  
Sell all the WBTC we have (note we just set a price of 0, as it is ignored anyway when adding market orders):  
`$ cceb exchange add uniswap sell market max WBTC/USDT 0`  

##### Examples

Add buy limit order of amount of 1 BTC at price 55000:  
`$ cceb exchange add coinbasepro buy limit 1 BTC/USDT 55000`  
  
Add buy market order of amount of 15 BTC at price 55000 (note price ignored adding market orders):  
`$ cceb exchange add binance buy market 15 BTC/USDT 0`  

##### Details 'cceb exchange add'
```
usage: cceb exchange add [-h] [--due-time DUETIME] [--min-percent MINPERCENT]
                        [--max-slippage MAXSLIPPAGE] [--path PATH]
                        [--from FROM] [--gaslimit GASLIMIT] [--to TO]
                        [--gasprice GASPRICE] [--params PARAMS]
                        exchange {buy,sell} {limit,market} amount pair price

Add new order to exchange.

Positional arguments:
  exchange              Name of exchange.
  {buy,sell}            The order side
  {limit,market}        The order side
  amount                The order amount to buy or sell. Should be a number
                        or an expression of "max" to do the max available.
  pair                  The standard names of token pair eg: "ETH/USD".
  price                 Price of the order. Ignored if market order.

Optional arguments:
  -h, --help            Show this help message and exit.
  --due-time DUETIME, -t DUETIME
                        Uniswap only. Minimum amount requeseted. Uses free
                        text to define end time using chrono lib.
  --min-percent MINPERCENT, -m MINPERCENT
                        Uniswap only. The minimum output amount can be this
                        percent less then calculated output amount.
  --max-slippage MAXSLIPPAGE, -s MAXSLIPPAGE
                        Uniswap only. Maximum allowed slippage.
  --path PATH, -x PATH  Uniswap only. Path to exchange sell- to buyToken.
  --from FROM, -f FROM  Decentralized swaps only. From Address defaults to
                        web3.defaultFrom
  --gaslimit GASLIMIT, -g GASLIMIT
                        Decentralized swaps only. Gaslimit of transaction
  --to TO, -o TO        Uniswap only. Recipient of output tokens
  --gasprice GASPRICE, -p GASPRICE
                        Decentralized swaps only. Gas price of transaction
  --params PARAMS       Extra parameters for exchange in json string format.
```
#### List orders

List all open orders on exchange. Centralized exchanges only.

##### Examples

List open orders:  
`$ cceb exchange listorders kraken`  
  
List closed orders:  
`$ cceb exchange listorders -- colosed kraken`  

##### Details `cceb exchange listorders`
```
ß cceb exchange listorders --help
usage: cceb exchange listorders [-h] [--token TOKEN] [--closed] [--pair PAIR]
                               exchange

List all open orders on exchange.

Positional arguments:
  exchange              Name of exchange.

Optional arguments:
  -h, --help            Show this help message and exit.
  --token TOKEN, -t TOKEN
                        Token to list
  --closed, -c          List closed offers.
  --pair PAIR, -p PAIR  The pair to look orders for.
```

#### List balances

List balances on exchange. Centralized exchanges only.

##### Examples

List balances higher than 1:  
`$ cceb exchange listbalances kraken --dust-limit 1`  

##### Details `cceb exchange listbalances`
```
$ cceb exchange listbalances --help
usage: cceb exchange listbalances [-h] [--token TOKEN] [--dust-limit DUST]
                                  exchange

List all non-dust balances on exchange.

Positional arguments:
  exchange              Name of exchange.

Optional arguments:
  -h, --help            Show this help message and exit.
  --token TOKEN, -t TOKEN
                        Token to list
  --dust-limit DUST, -d DUST
                        Amounts less than dust-limit will not be listed
```

#### Remove orders

Remove orders from exchange. Centralized exchanges only.

##### Examples

Remove order GRHVAG-WL9WX-6HHULI on [Kraken](https://www.kraken.com) 
`$ cceb exchange rm kraken GRHVAG-WL9WX-6HHULI`

##### Details `cceb exchange rm`
```
$ cceb exchange rm --help
usage: cceb exchange rm [-h] exchange order

Remove order from exchange.

Positional arguments:
  exchange    Name of exchange.
  order       The order id to cancel

Optional arguments:
  -h, --help  Show this help message and exit.
```

#### Remove all orders

Remove all orders on exchanges. (It does not work on some exchanges!!)

##### Examples

Remove all open orders from [Bitfinex](https://www.bitfinex.com)
`$ cceb exchange rmall bitfinex`

##### Details `cceb exchange rmall`

```
$ cceb exchange rmall --help
usage: cceb exchange rmall [-h] exchange

Remove all open orders from exchange.

Positional arguments:
  exchange    Name of exchange.

Optional arguments:
  -h, --help  Show this help message and exit.
```
#### Show orderbook 

Show orderbook on exchange. Not applicable on decentralized exchanges.

##### Examples

Show orderbook on [Binance](https://www.binance.com) for ETH/BTC but showing prices in USD instead of BTC and display only 50 entries:  
 `$ cceb exchange orderbook binance ETH/BTC --currency USD --limit 50`  

##### Details `cceb exhcnage orderbook`
```
$cceb exchange orderbook --help
usage: cceb exchange orderbook [-h] [--currency CURRENCY]
                               [--other-exchange OTHEREXCHANGE]
                               [--limit LIMIT] [--price-precision PPRECISION]
                               [--amount-precision APRECISION]
                               exchange pair

Download orderbook from exchange.

Positional arguments:
  exchange              Name of exchange.
  pair                  Tokenpair to get price for.

Optional arguments:
  -h, --help            Show this help message and exit.
  --currency CURRENCY, -c CURRENCY
                        Show prices in currency instead of the quote currency.
  --other-exchange OTHEREXCHANGE, -o OTHEREXCHANGE
                        The other exchange to get currency price from.
  --limit LIMIT, -l LIMIT
                        Limit of the number of items in orderbook.
  --price-precision PPRECISION, -p PPRECISION
                        Precision of prices.
  --amount-precision APRECISION, -a APRECISION
                        Precision of amounts.
```
#### Show price - **not implemented**

Displays price of a token pair. **not implemented**

##### Examples

##### Details `cceb exchange price`
```
$cceb exchange price --help
usage: cceb exchange price [-h] [--amount AMOUNT] [--sell] [--usd] [--eur]
                           exchange pair

Get price of token.

Positional arguments:
  exchange              Name of exchange.
  pair                  Tokenpair to get price for.

Optional arguments:
  -h, --help            Show this help message and exit.
  --amount AMOUNT, -a AMOUNT
                        Get average price for buying "amount" from token 
                        based on orderbook.
  --sell, -s            Get average price for selling amount from token.
  --usd, -u             Get price in USD from coinbasepro
  --eur, -e             Get price in EUR from coinbasepro
```
#### Trickle

Using trickle `cceb` will create multiple orders or random sizes, random times apart when price reaches a threshold value.  

Trickle feature can be used in two cases:
- Buy/sell a large amount of tokens, in many small batches.
- Emulate limit order on Uniswap (that does not support it). It works only with accounts with private key provided, where `cceb` can actually sign the transaction when necessary.

##### Examples

Sell a large stack of CRV token adding multiple orders automatically.  
Sell on Binance 2090.46 CRV token in batches ranging from 0 to 1000 CRV, with random timeout between 120-240 seconds between successful orders, and put orders there only if price is greater or equal to 4:  
`$ cceb trickle binance sell market 2090.46936856 CRV/USDT 0 -s 0 -v 1000 -t 120 -r 120 -m 4`
  
Emulate limit order on [Uniswap](https://app.uniswap.org/#/swap):  
Add limit order on [Uniswap](https://app.uniswap.org/#/swap) selling 11 MKR for 77000 DUCK tokens. Do this from ETH-MY account, with batch size of 11 MKR, price 1000, wait 300 seconds between retries if order does not succeed, and 10 seconds between successful orders (makes no sense here), batch time variance is 0, and send the resulting DUCK tokens to ETH-TO address:  
`$ cceb exchange trickle uniswap sell market 11 MKR/DUCK 0 --from ETH-MY -s 11 -m 7000 -y 300 -t 10 -r 0 -o ETH-TO`  

##### Details `cceb exchange trickle`
```
$cceb exchange trickle --help
usage: cceb exchange trickle [-h] [--batch-size BATCHSIZE]
                             [--batch-size-variance BATCHSIZEVARIANCE]
                             [--batch-min-rate BATCHMINRATE]
                             [--batch-retry-time BATCHRETRYSEC]
                             [--batch-time BATCHTIME]
                             [--batch-time-variance BATCHTIMEVARIANCE]
                             [--params PARAMS] [--due-time DUETIME]
                             [--min-percent MINPERCENT]
                             [--max-slippage MAXSLIPPAGE] [--path PATH]
                             [--from FROM] [--gaslimit GASLIMIT] [--to TO]
                             [--gasprice GASPRICE]
                             exchange {buy,sell} {limit,market} amount pair
                             price

Buy or sell in small batches not to ruin market price.

Positional arguments:
  exchange              Name of exchange.
  {buy,sell}            The order side
  {limit,market}        The order side
  amount                The order amount to buy or sell. Should be a number 
                        or an expression of "max" to do the max available.
  pair                  The standard names of token pair eg: "ETH/USD".
  price                 Price of the order. Ignored if market order.

Optional arguments:
  -h, --help            Show this help message and exit.
  --batch-size BATCHSIZE, -s BATCHSIZE
                        Buy/sell this much at one batch.
  --batch-size-variance BATCHSIZEVARIANCE, -v BATCHSIZEVARIANCE
                        Maximum this much is added to batch size. Evenly 
                        distributed random number generated.
  --batch-min-rate BATCHMINRATE, -m BATCHMINRATE
                        Minimum/maximum rate at which the trade executes.
  --batch-retry-time BATCHRETRYSEC, -y BATCHRETRYSEC
                        Retry time after offer skipped because price was less 
                        than args.batchMinRate.
  --batch-time BATCHTIME, -t BATCHTIME
                        Sell a batch every batch-time seconds.
  --batch-time-variance BATCHTIMEVARIANCE, -r BATCHTIMEVARIANCE
                        Maximum this much is added to batch time. Evenly 
                        distributed random number generated.
  --params PARAMS       Extra parameters for exchange in json string format.
  --due-time DUETIME, -u DUETIME
                        Uniswap only. Minimum amount requeseted. Uses free 
                        text to define end time using chrono lib.
  --min-percent MINPERCENT, -p MINPERCENT
                        Uniswap only. The minimum output amount can be this 
                        percent less then calculated output amount.
  --max-slippage MAXSLIPPAGE, -l MAXSLIPPAGE
                        Uniswap only. Maximum allowed slippage.
  --path PATH, -x PATH  Uniswap only. Path to exchange sell- to buyToken.
  --from FROM, -f FROM  Decentralized swaps only. From Address defaults to 
                        web3.defaultFrom
  --gaslimit GASLIMIT, -g GASLIMIT
                        Decentralized swaps only. Gaslimit of transaction
  --to TO, -o TO        Uniswap only. Recipient of output tokens
  --gasprice GASPRICE, -c GASPRICE
                        Decentralized swaps only. Gas price of transaction
```
### [Ethereum](https://ethereum.org/en/) blockchain interactions

When interacting with Ethereum contracts, `cceb` returns fixed digits (decimals fitted for each token) numbers when `balanceOf`, or `totalSupply` is requested. When numbers are entered to `cceb eth tx` then dot is disregarded, and number is taken as an integer. So make sure you DO NOT delete any digits from fractional numbers.
  
From address is not needed, because if not provided `cceb` will use default address defined in `config/default.yaml -> web3.defaultFrom`  
  
There are three types of Ethereum accounts can be defined in `config/secrets/default.yaml -> web3.account`:
- `privatekey` - UNSAFE!!! the privatekey is stored  in `config/secrets/default.yaml web3.account.<account_name>.privatekey`. If the file gets compromised, attacker has total authority on account.
- `airsign` - (SAFE) [airsign](https://github.com/r001/airsign) accounts store the privatekeys on a mobile phone that communicates `cceb` using QR codes to sign transactions and signatures. 
- `ledger` - (SAFE) [ledger](https://www.ledger.com) accounts use Ledger cold wallets to sign transactions

#### Send or call ethereum contracts

##### Examples

Check the balance of [Compound](https://compound.finance/) account:  
`$ cceb eth tx DAI balanceOf 0x5d3a536e4d6dbd6114cc1ead35777bab948e3643`  
  
Check Ether balance of account (contract address is the WETH contract):  
`$ cceb eth tx ETH balanceOf 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`  
(Note that same syntax can be for Ether as for any [ERC20](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/) tokens. But of course the original functions can be used too.)  
  
Check Ether balance of account:  
`$ cceb eth tx ETH balance 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`  
(Note this time we use the function defined for Ether.)  
  
Get exchange address for pair on [Uniswap](https://app.uniswap.org/#/swap):   
`$cceb eth tx UNISWAP_FACTORY getPair DAI WETH`  
  
###### Add liquidity to [Curve](https://www.curve.fi)
Let's assume 62000 USDT will be deposited to 3POOL on Curve.  
  
First approve SWAP contract for token you want to deposit:  
`$ cceb eth tx USDT approve CRV_SWAP_3POOL`  
  
Then check which argument of the next function is USDT token:  
`$ cceb eth tx CRV_SWAP_3POOL coins 2`  
  
Then add liquidity to pool (as USDT is the third token, in the array the third value will represent it).  
Add 62000 USDT to 3POOL requiring a minimum of 61000 LP tokens.  
`$ cceb eth tx CRV_SWAP_3POOL add_liquidity '["0","0","62000.000000"]' 61000.000000000000000000`  
(Note that the USDT has 6 decimal precision, but the minimum requied LP token is 18 digit precision.)   
  
Lets check if we really got the LP tokens:  
`$ cceb eth tx CRV_LP_3POOL balanceOf ETH-MY-ACC`  
(Lets assume we got 61234.560000000000000000 LP tokens.)  
(Note we assume that ETH-MY-ACC is listed in `config/secrets/default.yaml -> web3: -> account:` and has a valid address.)  
  
Let's put that LP token to the gauge to receive CRV payment:  
`$ cceb eth tx CRV_GAUGE_3POOL deposit 61234.560000000000000000`  
  
Let's check how much CRV can we claim on gauge:  
`$ cceb eth tx CRV_GAUGE_3POOL claimable_tokens ETH-MY-ACC`  
  
Once we have enough let's claim CRV:  
`$ cceb eth tx CRV_TOKEN_MINTER mint CRV_GAUGE_3POOL`  
  
If you want to know the callable functions(abi) of CRV_TOKEN_MINTER, you can just add `--ls .` to the end of previous:  
`$ cceb eth tx CRV_TOKEN_MINTER mint CRV_GAUGE_3POOL --ls .`  
(Note if you use `--ls` then all the other function calls will be disregarded.)  

##### Details `cceb eth tx`
```
$ cceb eth tx --help
usage: cceb eth tx [-h] [--abi ABI] [--from FROM] [--value VALUE]
                   [--gaslimit GASLIMIT] [--gasprice GASPRICE] [--ls LS]
                   contract func [args [args ...]]

Create an ethereum transaction. Send or call method is used automatically 
based on abi.

Positional arguments:
  contract              Contract address
  func                  Function name to call or send
  args                  Called function's arguments

Optional arguments:
  -h, --help            Show this help message and exit.
  --abi ABI, -a ABI     Abi defaults to <contract>.abi
  --from FROM, -f FROM  From Address defaults to web3.defaultFrom
  --value VALUE, -v VALUE
                        Eth value to send
  --gaslimit GASLIMIT, -g GASLIMIT
                        Gaslimit of transaction
  --gasprice GASPRICE, -p GASPRICE
                        Gas price of transaction
  --ls LS, -l LS        List functions in abi matching pattern.
```
#### Display abi of smart contracts in a human readable way

Api-key for [Etherscan](https://etherscan.io/register) is needed for this function to work.
See [Readme.md](https://github.com/r001/cceb/README.md) for installation details.

##### Examples

Display abi of Uniswap router2 and sort the functions:  
`$ cceb eth abi UNISWAP_ROUTER2 |sort`  

##### Details `cceb eth abi`

```
$ cceb eth abi --help
usage: cceb eth abi [-h] contract

Displays abi of smart contract.

Positional arguments:
  contract        Contract address

Optional arguments:
  -h, --help      Show this help message and exit.
```
#### Get address of a contract name, or name of a contract address

##### Examples
Get address of DAI smartcontract:  
`$ cceb eth address DAI`  
  
Check if we have a short name for contract address:  
`$ cceb eth address 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`  
`$ WETH`  
  
##### Details `cceb eth address`
```
$ cceb eth address --help
usage: cceb eth address [-h] contr

Get contract address from contract name, or vica versa.

Positional arguments:
  contr       Contract address or contract name

Optional arguments:
  -h, --help  Show this help message and exit.
```
#### Display source code of smart contracts

Api-key for [Etherscan](https://etherscan.io/register) is needed for this function to work.
See [Readme.md](https://github.com/r001/cceb/README.md) for installation details.

##### Examples

Download source of a Snowswap contract and open it in vim:  
`$ cceb eth source SNOW_POOL_YCRVSNOW |vim -`  
  
##### Details `cceb eth source`
```
$ cceb eth source --help
usage: cceb eth source [-h] contractName

Download and display source code of contract.

Positional arguments:
  contractName  Contract name

Optional arguments:
  -h, --help    Show this help message and exit.
```
#### Import smart contract name and abi

Addresses are stored in two files:
- `config/secret/default.yaml` 
	- account addresses are stored here at `web3.account`. Importing accounts is not implemented. You have to edit the config file to add new accounts.
- `config/default.yaml`
	- token addresses are stored in 
		- `web3.mainnet.token` 
		- `web3.kovan.token` 
		- `web3.ropsten.token` 
	- contract addressses are stored in:
		- `web3.mainnet.<contract_group_name>` 
		- `web3.kovan.<contract_group_name>` 
		- `web3.ropsten.<contract_group_name>` 

Contracts are grouped in contract groups. Eg.: Makerdao contracts are grouped under `web3.mainnet.maker` contract group name.  
  
During importing smart contracts if a path is not specified (path tells cceb under which contract group a contract should be imported), then `cceb` will search for smart contract names that match until the first `_`. Eg: Curve smart contracts are stored under `web3.mainnet.curve` and all their names begin with `CRV_`, so if you import a smart contract with the name `CRV_TEST`, then it will automatically be appended to curve contract as its `CRV_` matches the `curve` contract group names.
  
If you want to import to a new path, you have to edit the config file manually to add new path, as adding path is not implemented yet.  
  
To import a token, the path must be specified. In most cases it will be `web3.mainnet.token`.

##### Examples

Import token (eg.: BZRX):  
`$ ./cceb eth import BZRX 0x56d811088235F11C8920698a204A5010a788f4b3 -l web3.mainnet.token`  

Import new Synthetics smart contract:
1. Edit config file and add `synthetics` contract group name under `web3.mainnet`:  
`vim config/default.yaml`  
2. Import Synthetics address resolver smart contract:  
`$ cceb eth import SYNTHETICS_ADDRESS_RESOLVER 0x823bE81bbF96BEc0e25CA13170F5AaCb5B79ba83 -l web3.mainnet.synthetics`  

##### Details `cceb eth import`
```
$ cceb eth import --help
usage: cceb eth import [-h] [--location LOCATION] contractName contractAddress

Map contract address to a human readable name and download and store contract
abi.

Positional arguments:
  contractName          Human readable shorthand name for contract. When
                        contract name is used later on, it will be
                        substituted by contract address automatically.
  contractAddress       Contract address

Optional arguments:
  -h, --help            Show this help message and exit.
  --location LOCATION, -l LOCATION
                        Insert contract into path in "./config/default.yaml".
```
#### Interact with [Makerdao](https://www.makerdao.com)

Using `cceb` it is possible to manage Makerdao vaults. Vaults can be opened, can get info from, DAI be drawn, and debts can be paid back.

Amounts are expressed as 'normal' numbers. Eg.: if you type 1 for an Ether amount it does mean 1 Ether, and not 1e-18 Ether.

##### Examples

Open `ETH-A` vault for `ETH-SECOND-ACC`:  
`$ cceb eth maker open --from ETH-SECOND-ACC ETH-A`  
  
Deposit collateral of 10 Ether:  
`$ cceb eth maker deposit --from ETH-SECOND-ACC ETH-A 10`  
(Note we use normal number and not WEI for Ether amount)  
  
Generate 100 DAI:  
`$ cceb eth maker ETH-A 100 --from ETH-SECOND-ACC`  
  
Check if 100 DAI was indeed generated:  
`$ cceb eth tx DAI balanceOf ETH-SECOND-ACC`  
  
Get vault info:  
`$ cceb eth maker info ETH-A --from ETH-SECOND-ACC`  
  
Payback debt of 100 DAI:  
`$ cceb eth maker payback ETH-A 100`  
  
Withdraw collateral of 9 Ether:  
`$ cceb eth maker withdraw ETH-A 9`  
  
##### Details `cceb eth maker open`

Open vault.   
  
`--from address` the address the tx originates from.  
```
$ cceb eth maker open --help
usage: cceb eth maker open [-h] type

Open new MakerDao vault.

Positional arguments:
  type        Type of vault that will be created

Optional arguments:
  -h, --help  Show this help message and exit.
```
##### Details `cceb eth maker deposit`

Deposit collateral to Makerdao vault.
  
`--from address` the address the tx originates from.  
```
cceb eth maker deposit --help
usage: cceb eth maker deposit [-h] [--draw DRAW] type amount

Deposit collateral to vault.

Positional arguments:
  type                  Type of vault that will be deposited to. Eg.: ETH-A
  amount                Deposit amount of collateral.

Optional arguments:
  -h, --help            Show this help message and exit.
  --draw DRAW, -d DRAW  Draw create DAI to the urn in one step
```
##### Details `cceb eth maker generate`

Generate dai to default address or `--from` address.  
  
`--from address` the address the tx originates from.  
```
$ cceb eth maker generate --help
usage: cceb eth maker generate [-h] type amount

Generate DAI stablecoin.

Positional arguments:
  type        Type of vault that DAI will be generated from. Eg.: ETH-A
  amount      Amount of DAI to generate.

Optional arguments:
  -h, --help  Show this help message and exit.
```
##### Details `cceb eth maker info`

Get info on a vault.  
`--from address` the address the tx originates from.  
```
$ cceb eth maker info --help
usage: cceb eth maker info [-h] type

Get vault info.

Positional arguments:
  type        Type of vault to get info from. Eg.: USDC-A

Optional arguments:
  -h, --help  Show this help message and exit.
```
##### Details `cceb eth maker payback`

Payback DAI to Makerdao.  
  

`--from address` the address the tx originates from.  
```
$ cceb eth maker payback --help
usage: cceb eth maker payback [-h] type amount

Payback an amount of DAI to vault type.

Positional arguments:
  type        Type of vault that DAI will be paid back to. Eg.: ETH-A
  amount      Amount of DAI paid back.

Optional arguments:
  -h, --help  Show this help message and exit.
```
##### Details `cceb eth maker withdraw`

Withdraw collateral from Makerdao.  
  

`--from address` the address the tx originates from.  
```
$ cceb eth maker withdraw --help
usage: cceb eth maker withdraw [-h] type amount

Withdraw collateral from vault.

Positional arguments:
  type        Type of vault that will be withdrawn from. Eg.: ETH-A
  amount      Withdraw amount of collateral.

Optional arguments:
  -h, --help  Show this help message and exit.
```
##### Makerdao auctions

If there is a lot of bad debt in Makerdao, an auction is created, where the bidders pay DAI, and receive MKR. Bad debt is put into 50,000 DAI sized packages, called **lot**s. Bidders can bid on those lots with requireing less and less MKR for each lot. Once noone bids for a lot, then that bid is closed. If no one bids for a lot, then it is possible to offer to receive less MKR for the 50,000 DAI.

##### Details `cceb eth maker flog`

Release queued bad-debt for auction.

```
$ cceb eth maker flog --help
usage: cceb eth maker flog [-h] [--from-block FROM_BLOCK]
                           [--to-block TO_BLOCK] [--amount AMOUNT]
                           contract

Get events of bad debt from contract from blocknumber to blocknumber.

Positional arguments:
  contract              Contract to get events from

Optional arguments:
  -h, --help            Show this help message and exit.
  --from-block FROM_BLOCK, -f FROM_BLOCK
                        Startblock to get events from
  --to-block TO_BLOCK, -t TO_BLOCK
                        End block to get events from.
  --amount AMOUNT, -a AMOUNT
                        Amount of max. dai to allow auction for.
```

##### Details `cceb eth maker flop`

```
$ cceb eth maker flop --help
usage: cceb eth maker flop [-h] [--count COUNT]

Make a count of new bids.

Optional arguments:
  -h, --help            Show this help message and exit.
  --count COUNT, -c COUNT
                        Number of new bids to make
```

##### Details `cceb eth maker dent`

```
$ cceb eth maker dent --help
usage: cceb eth maker dent [-h] [--amount AMOUNT] id

Bid for an auction of id.

Positional arguments:
  id                    Identifier of auction to make bid for.

Optional arguments:
  -h, --help            Show this help message and exit.
  --amount AMOUNT, -a AMOUNT
                        Amount to bid. Default amount is the minimal 
                        necessary.

```
##### Details `cceb eth maker tick`

```
cceb eth maker tick --help
usage: cceb eth maker tick [-h] id

Bid a better price for an expired auction.

Positional arguments:
  id          Make an expired auction have better price.

Optional arguments:
  -h, --help  Show this help message and exit.
```

##### Details `cceb eth maker deal`

```
$ cceb eth maker deal --help
usage: cceb eth maker deal [-h] id

Finish an auction and receive MKR

Positional arguments:
  id          Idealifier of auction to finish.

Optional arguments:
  -h, --help  Show this help message and exit.
```

#### Interact with [Aave](https://aave.com)

Aave enables to take collaterized loans in multiple tokens, and with multiple collaterals.

##### Examples

Deposit 10 Ether:  
`$ cceb eth aave deposit 10 ETH`  
  
Enable deposit as collateral:  
`$ cceb eth aave collateral ETH`  
  
Borrow 50 USDT:  
`$ cceb eth aave borrow 50 USDT`  
  
Change interest payment to current fixed rate:  
`$ cceb eth aave swaprate USDT`
  
Change fixed rate to currently offered one:  
`$ cceb eth aave rebalance USDT`  
  
Get info on reserve:  
`$ cceb eth aave info reserve USDT`  
  
Get info on default account:  
`$ cceb eth aave info account`  
  
Liquidate position of `ETH-BORROWER` on Aave if it is undercollaterized:  
`$ cceb eth aave liquidate ETH USDT ETH-BORROWER`  
  
Payback loan:  
`$ cceb eth aave payback 50 USDT`  

##### Details `cceb eth aave deposit`

```
$ cceb eth aave deposit --help
usage: cceb eth aave deposit [-h] amount token

Deposit an amount of token to aave.

Positional arguments:
  amount      Amount you want to deposit
  token       Token you want to deposit

Optional arguments:
  -h, --help  Show this help message and exit.
```

##### Details `cceb eth aave collateral`

```
$ cceb eth aave collateral --help
usage: cceb eth aave collateral [-h] [--disable] token

Enable(/disable) token as collateral in aave.

Positional arguments:
  token       Token you want to use as collateral

Optional arguments:
  -h, --help  Show this help message and exit.
  --disable   Disable to use token as collateral
```

##### Details `cceb eth aave borrow`

```
$ cceb eth aave borrow --help
usage: cceb eth aave borrow [-h] [--fixed] amount token

Borrow an amount of token against a collateral in aave.

Positional arguments:
  amount       Deposit amount of collateral.
  token        Token that w

Optional arguments:
  -h, --help   Show this help message and exit.
  --fixed, -d  Use fixed interests. Default: variable interests.
```

##### Details `cceb eth aave swaprate`
```
$ cceb eth aave swaprate --help
usage: cceb eth aave swaprate [-h] token

Toggle between fixed and variable rate for token.

Positional arguments:
  token       Token to swap the rate between fixed and variable.

Optional arguments:
  -h, --help  Show this help message and exit.

```
##### Details `cceb eth aave rebalance`

```
$ cceb eth aave rebalance --help
usage: cceb eth aave rebalance [-h] [--for FOR] token

Rebalancei (actualize) fixed interest rate for token for ourselves or others.

Positional arguments:
  token       Token to rebalance interest rate for.

Optional arguments:
  -h, --help  Show this help message and exit.
  --for FOR   Address to rebalance for. Default: ETH-1
```

##### Details `cceb eth aave info reserve`
```
$ cceb eth aave info reserve --help
usage: cceb eth aave info reserve [-h] token

Get info on token reserve.

Positional arguments:
  token       Get info for token reserve

Optional arguments:
  -h, --help  Show this help message and exit.
```

##### Details `cceb eth aave info account`
```
$ cceb eth aave info account --help
usage: cceb eth aave info account [-h] [--from FROM]

Get account info for account address.

Optional arguments:
  -h, --help            Show this help message and exit.
  --from FROM, -f FROM  Account address. (Defaults to ./config/default.yaml 
                        -> web3.defaultFrom)
```
##### Details `cceb eth aave liquidate`
```
$ cceb eth aave liquidate --help
usage: cceb eth aave liquidate [-h] collateraltoken loantoken user amount

Liquidate undercollaterized position for collateral token and loan token 
owned by address.

Positional arguments:
  collateraltoken  Token that is the collateral.
  loantoken        Token that is used for the loan
  user             Address of user who has the loan.
  amount           Amount of collateral to buy(???)

Optional arguments:
  -h, --help       Show this help message and exit.
```
##### Details `cceb eth aave payback`

Payback loan.  
```
$ cceb eth aave payback --help
usage: cceb eth aave payback [-h] [--for FOR] amount token

Payback an amount of token for ourselfes or others.

Positional arguments:
  amount             Amount to payback
  token              Token to payback.

Optional arguments:
  -h, --help         Show this help message and exit.
  --for FOR, -f FOR  Payback for someone else.
```

#### Interact with [Curve](https://www.curve.fi)

##### Examples

Get Curve info on our reserves and dailiy expected CRV income.
`$ cceb eth curve info`

##### Details `cceb eth curve info`

Information about Curve.fi reserves of current account.  
The current account is the default account (defined in `config/default.yaml -> web3.defaultFrom`), or can be specified `--from address`.  
  
When `cceb eth curve info` issued the following fields are displayed:  
- `GAUGE` - name of gauges, that are entities that can receive CRV 
- `CRV` - the claimable CRV for current account.
- `CRV_USD` - USDT value of CRV token based on Uniswap exchange rates.
- `CRV_100K` - CRV daily income of 100,000 LP tokens. The gauges are ordered on this value ascending.
- `CRV_100K_F` - CRV daily income of 100,000 LP tokens next week based on ongoing vote.
- `CRV_DAY` - CRV daily income of current account's reserves
- `LP` - amount of LP tokens of current account in gauge
- `LP_USD` - USD value of LP tokens of current account in gauge
- `BOOST` - current boost of current account
- `BOOST_F` - expected boost of current account if boost is updated. Claiming CRV does update boost.
- `D_LP_MAX_BOOST` - amount of LP tokens that currently can be added to maintain max boost for gauge
- `GAUGE_PERCENT` - gauge relative weight in percentage points compared to total weight of all gauges in receiving CRV income. Note if total value is less than 100, then there are unlisted gauges. Gauge addresses can be retrieved from CRV_GAUGE_CONTROLLER the following way: `cceb eth tx CRV_GAUGE_CONTROLLER gauges 0` (returns the address of the first gauge)
- `DEPOSIT_USD` - total deposits in gauge in USD

#### [Ledger](https://www.ledger.com) interactions

`cceb` supports ledger for transaction signing. Message signing is not supported yet.

Ledger accounts that will be used with `cceb` must be imported manually to `config/secrets/default.yaml -> web3.account`. The example below shows a valid entry:  
```
	web3:
		account:
			ETH-LEDGER-0:
				address: '0x1111111111111111111111111111111111111111'
				type: 'ledger'
```

##### Examples

Get legacy and live ledger addresses:  
`$ cceb eth ledger addresses`

##### Details `cceb ledger addresses`

Ledger can control nearly unlimited addresses. Addresses are derived by a deterministic hash function. All addresses have a position. The first address has the position of 0. By default `cceb` will list the first ten 'legacy' and ten 'live' accounts each starting from start position of 0. You can set any start position and address count. 

```
$ cceb ledger addresses --help
usage: cceb ledger addresses [-h] [--wallet {Ethereum}] [--live LIVE]
                             [--start-position STARTPOSITION] [--count COUNT]
                             

List first ten addresses.

Optional arguments:
  -h, --help            Show this help message and exit.
  --wallet {Ethereum}, -w {Ethereum}
                        Wallet to connect to. Currently only Ethereum is 
                        supported.
  --live LIVE, -l LIVE  Connect to ledger live vallets only.
  --start-position STARTPOSITION, -s STARTPOSITION
                        List accounts starting from this position. Starting 
                        at 0.
  --count COUNT, -c COUNT
                        List this many addresses each.
```
