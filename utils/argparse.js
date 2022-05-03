const BN = require('bignumber.js')
const yargs = require('yargs/yargs')(process.argv.slice(2))
const baseDir = __dirname + '/'
process.chdir(baseDir)

process.env.NODE_CONFIG_DIR = (process.env.NODE_CONFIG_DIR
  ?
    process.env.NODE_CONFIG_DIR + require('path').delimiter
  :
    "")
  + baseDir + "config/" + require('path').delimiter + baseDir + "config/secrets/" +
   require('path').delimiter + "config/radix/" 

const config = require('config')
const w3 = require('../utils/web3.js')
const fs = require('fs')
const openRpc = JSON.parse(fs.readFileSync(`${baseDir}../config/radix/open-rpc.spec.json`, `utf8`))

function argParse () {
	
return yargs
//  .option('pm2', {
//    type: 'string',
//    boolean: true,
//    desc: 'Current process is a pm2 started one'
//  })
  .command({
    //cceb
    command: 'exchange <exchangeCommand>',
    desc: 'Exchange tokens via centralized or decentralized exchanges',
    builder: (yargs) => {
      yargs.command({
          //cceb exchange
          command: 'listorders <exchange> [token] [closed] [pair]',
          desc: 'List all open orders on exchange',
          builder: (yargs) =>
            yargs
              .positional('exchange', {
                desc: 'Name of exchange',
                type: 'string',
                choices: Object.keys(config.get('keys')),
              }) 
              .option('token', {
                alias: 't',
                type: 'string',
                desc: 'Token to list'
              })
              .option('closed', {
                alias: 'c',
                type: 'boolean',
                desc: 'List closed offers'
              })
              .option('pair', {
                alias: 'p',
                type: 'string',
                desc: 'The pair to look orders for'
              })
              .strict()
          ,
      })
        .command({
          //cceb exchange
          command: 'add [exchange] [side] [type] [amount] [pair] [price]',
          desc: 'Add new order to exchange',
          builder: yargs => {
            yargs
              .positional('exchange', {
                type: 'string',
                desc: 'Name of exchange',
                choices: Object.keys(config.get('keys')),
              })
              .positional('side', {
                type: 'string',
                desc: 'The order side',
                choices: ['buy', 'sell'],
              })
              .positional('type', {
                type: 'string',
                desc: 'The order side',
                choices: ['limit', 'market'],
              })
              .positional('amount', {
								type: 'string',
                desc: 'The order amount to buy or sell. Should be a number or an expression of "max" to do the max available',
              }
              )
							.coerce('amount', amount => numberFormatted(amount))

              .positional('pair', {
								type: 'string',
                desc: 'The standard names of token pair eg: "ETH/USD"',
              }
              )

              .positional('price', {
								type: 'string',
                desc: 'Price of the order. Ignored if market order',
              }
              )

              .option('due-time', {
                type: 'string',
                alias: ['dueTime', 't'],
                default: '10 minutes from now',
                desc: 'Uniswap only. Minimum amount requeseted. Uses free text to define end time using chrono lib',
              }
              )

              .option('min-percent', {
                alias: ['m', 'minPercent'],
                type: 'number',
                default: 1,
                desc: 'Uniswap only. The minimum output amount can be this percent less then calculated output amount',
              }
              )

              .option('max-slippage', {
                type: 'string',
                alias: ['s', 'maxSlippage'],
                desc: 'Uniswap only. Maximum allowed slippage',
              }
              )

              .option('path', {
                type: 'string',
                alias: 'x',
                desc: 'Uniswap only. Path to exchange sell- to buyToken. ',
              }
              )

              .option('from', {
                type: 'string',
                alias:'f',
                default: config.get('web3.defaultFrom'),
                desc: 'Decentralized swaps only. From Address defaults to web3.defaultFrom',
              }
              )

              .option('gaslimit', {
                type: 'string',
                alias:'g',
                desc: 'Decentralized swaps only. Gaslimit of transaction',
              }
              )

              .option('to', {
                type: 'string',
                alias:'o',
                desc: 'Uniswap only. Recipient of output tokens',
              }
              )

              .option('gasprice', {
                type: 'string',
                alias:'p',
                desc: 'Decentralized swaps only. Gas price of transaction',
              }
              )

              .option('params', {
                type: 'string',
                desc: 'Extra parameters for exchange in json string format',
              }
              )

          }

        })
        .command({
          //cceb exchange
          command: 'rm <exchange> <order>',
          desc: 'Remove order from exchange',
          builder: (yargs) => {
            yargs
              .positional('exchange', {
                type: 'string',
                choice: Object.keys(config.get('keys')),
                desc: 'Name of exchange',
              }
              )

              .positional('order', {
                type: 'string',
                desc: 'The order id to cancel',
              }
              )

          }
        })
        .command({
          //cceb exchange
          command: 'rmall <exchange> <order>',
          desc: 'Remove all open orders from exchange',
          builder: (yargs) => {
            yargs
              .positional('exchange', {
                type: 'string',
                choice: Object.keys(config.get('keys')),
                desc: 'Name of exchange',
              }
              )
          }
        })
        .command({
          //cceb exchange
          command: 'listbalances <exchange> [token] [dust-limit]',
          desc: 'List all non-dust balances on exchange',
          builder: (yargs) => {
            yargs

              .positional('exchange', {
                type: 'string',
                choice: Object.keys(config.get('keys')),
                desc: 'Name of exchange',
              }
              )

              .option('token', {
                type: 'string',
                alias: 't',
                desc: 'Token to list',
              }
              )

              .option('dust-limit', {
                alias: ['d', 'dust'],
                type: 'number',
                default: config.get('dust-limit'),
                desc: 'Amounts less than dust-limit will not be listed',
              }
              )
          }
        })
        .command({
          //cceb exchange
          command: 'withdraw <exchange> <token> <amount> <destination> [digits]',
          desc: 'Withdraw token from exchange',
          builder: (yargs) => {
            yargs
              .positional('exchange', {
                type: 'string',
                choice: Object.keys(config.get('keys')),
                desc: 'Name of exchange',
              }
              )

              .option('digits', {
                alias: 'd',
                type: 'number',
                default: 2,
                desc: 'Digits used after dot for withdrawal',
              }
              )

              .positional('token', {
                type: 'string',
                desc: 'Token to withdraw',
              }
              )

              .positional('amount', {
                type: 'string',
                desc: 'Amount to withdraw. Can be "max"',
              }
              )
							.coerce('amount', amount => numberFormatted(amount))

              .positional('destination', {
                type: 'string',
                desc: 'Destination to withdraw to',
              }
              )


          }
        })
        .command({
          //cceb exchange
					command: 'deposit <exchange> <token>',
          desc: 'Get deposit address of token for exchange',
          builder: (yargs) => {
            yargs
              .positional('exchange', {
                type: 'string',
                choice: Object.keys(config.get('keys')),
                desc: 'Name of exchange',
              }
              )

              .positional('token', {
                type: 'string',
                desc: 'Token to deposit',
              }
              )
          }
        })
        .command({
          //cceb exchange
          command: 'markets <exchange>',
          desc: 'Display all token pairs on an exchange',
          builder: (yargs) => {
            yargs
              .positional('exchange', {
                type: 'string',
                choice: Object.keys(config.get('keys')),
                desc: 'Name of exchange',
              }
              )
          }
        })
        .command({
          //cceb exchange
          command: 'price <exchange> <pair> [amount] [sell] [usd] [eur]',
          desc: 'Display all token pairs on an exchange. (not implemented)',
          builder: (yargs) => {
            yargs
              .positional('exchange', {
                type: 'string',
                choice: Object.keys(config.get('keys')),
                desc: 'Name of exchange',
              }
              )

              .positional('pair', {
                type: 'string',
                desc: 'Tokenpair to get price for',
              }
              )

              .option('amount', {
                type: 'string',
                alias: 'a',
                desc: 'Get average price for buying "amount" from token based on orderbook',
              }
              )
							.coerce('amount', amount => numberFormatted(amount))

              .option('sell', {
                alias: 's',
                type: 'boolean',
                desc: 'Get average price for selling amount from token',
              }
              )

              .option('usd', {
                alias: 'u',
                type: 'boolean',
                desc: 'Get price in USD from coinbasepro',
              }
              )

              .option('eur', {
                alias: 'e',
                type: 'boolean',
                desc: 'Get price in USD from coinbasepro',
              }
              )
          }
        })
        . command({
          //cceb exchange
          command: 'orderbook <exchange> <pair> [limit] [price-precision] [amount-precision]',
          desc: 'Download orderbook from exchange',
          builder: (yargs) => {
            yargs
              .positional('exchange', {
                type: 'string',
                choice: Object.keys(config.get('keys')),
                desc: 'Name of exchange',
              }
              )

              .positional('pair', {
                type: 'string',
                desc: 'Tokenpair to get price for',
              }
              )

              .option('currency', {
                type: 'string',
                alias: 'c',
                desc: 'Show prices in currency instead of the quote currency',
              }
              )

              .option('other-exchange', {
                type: 'string',
                alias: ['o', 'otherExchange'],
                default: 'coinbasepro',
                desc: 'The other exchange to get currency price from',
              }
              )

              .option('limit', {
                type: 'string',
                alias: 'l',
                desc: 'Limit of the number of items in orderbook',
              }
              )

              .option('price-precision', {
                alias: ['p', 'pPrecision'],
                type: 'number',
                desc: 'Precision of prices in digits after zero',
              }
              )

              .option('amount-precision', {
                alias: ['a', 'aPrecision'],
                type: 'number',
                desc: 'Precision of amounts in digits after zero',
              }
              )
          }
        })
        .command({
          //cceb exchange
          command: 'trickle <exchange> <side> <type> <amount> <pair> <price> [batch-size] [batch-size-variance] [batch-min-rate] [batch-retry-time] [batch-time] [batch-time-variance] [params] [due-time] [min-percent] [max-slippage] [path] [from] [gaslimit] [to] [gasprice]',
          desc: 'Buy or sell in small batches not to ruin market price',
          builder: (yargs) => {
            yargs
              .positional('exchange', {
                type: 'string',
                choice: Object.keys(config.get('keys')),
                desc: 'Name of exchange',
              }
              )

              .positional('side', {
                type: 'string',
                choices: ['buy', 'sell'],
                desc: 'The order side',
              }
              )

              .positional('type', {
                type: 'string',
                choices: ['limit', 'market'],
                desc: 'The order side',
              }
              )

              .positional('amount', {
                type: 'string',
                desc: 'The order amount to buy or sell. Should be a number or an expression of "max" to do the max available',
              }
              )
							.coerce('amount', amount => numberFormatted(amount))

              .positional('pair', {
                type: 'string',
                desc: 'The standard names of token pair eg: "ETH/USD"',
              }
              )

              .positional('price', {
                type: 'string',
                desc: 'Price of the order. Ignored if market order',
              }
              )

              .option('batch-size', {
                alias: ['s', 'batchSize'],
                type: 'number',
                desc: 'Buy/sell this much at one batch',
              }
              )

              .option('batch-size-variance', {
                alias: ['v', 'batchSizeVariance'],
                type: 'number',
                default: 0,
                desc: 'Maximum this much is added to batch size. Evenly distributed random number generated',
              }
              )

              .option('batch-min-rate', {
                alias: ['m', 'batchMinRate'],
                type: 'number',
                desc: 'Minimum/maximum rate at which the trade executes',
              }
              )

              .option('batch-retry-time', {
                alias: ['y', 'batchRetrySec'],
                type: 'number',
                default: 60,
                desc: 'Retry time after offer skipped because price was less than args.batchMinRate',
              }
              )

              .option('batch-time', {
                alias: ['t', 'batchTime'],
                type: 'number',
                desc: 'Sell a batch every batch-time seconds',
              }
              )

              .option('batch-time-variance', {
                alias: ['r', 'batchTimeVariance'],
                type: 'number',
                default: 0,
                desc: 'Maximum this much is added to batch time. Evenly distributed random number generated',
              }
              )

              .option('params', {
                type: 'string',
                desc: 'Extra parameters for exchange in json string format',
              }
              )

              .option('due-time', {
                type: 'string',
                alias: ['u', 'dueTime'],
                default: '30 minutes from now',
                desc: 'Uniswap only. Minimum amount requeseted. Uses free text to define end time using chrono lib',
              }
              )

              .option('min-percent', {
                alias: ['p', 'minPercent'],
                type: 'number',
                default: '1',
                desc: 'Uniswap only. The minimum output amount can be this percent less then calculated output amount',
              }
              )

              .option('max-slippage', {
                type: 'string',
                alias: ['l', 'maxSlippage'],
                desc: 'Uniswap only. Maximum allowed slippage',
              }
              )

              .option('path', {
                type: 'string',
                alias: 'x',
                desc: 'Uniswap only. Path to exchange sell- to buyToken. ',
              }
              )

              .option('from', {
                type: 'string',
                alias:'f',
                default: config.get('web3.defaultFrom'),
                desc: 'Decentralized swaps only. From Address defaults to web3.defaultFrom',
              }
              )

              .option('gaslimit', {
                type: 'string',
                alias:'g',
                desc: 'Decentralized swaps only. Gaslimit of transaction',
              }
              )

              .option('to', {
                type: 'string',
                alias:'o',
                desc: 'Uniswap only. Recipient of output tokens',
              }
              )

              .option('gasprice', {
                type: 'string',
                alias:'c',
                desc: 'Decentralized swaps only. Gas price of transaction',
              }
              )

          }
        })
        .command({
          //cceb exchange
          command: 'rmall <exchange> <order>',
          desc: 'Remove all open orders from exchange',
          builder: (yargs) => {
            yargs
              .positional('exchange', {
                type: 'string',
                choice: Object.keys(config.get('keys')),
                desc: 'Name of exchange',
              }
              )
          }
        })
        .demandCommand()
    }
  })
  .command({
    //cceb
    command: 'eth <ethCommand> [from] [gaslimit] [gasprice] [nonce] [block]',
    desc: 'Do stuff with the Ethereum blockchain',
    builder: (yargs) => {
      yargs
        .option('from', {
          alias:'f',
          default: config.get('web3.defaultFrom'),
          desc: 'From address defaults to web3.defaultFrom',
					type: 'string',
        }
        )

        .option('gaslimit', {
          alias:['g'], 
          desc: 'Gas limit of transaction',
					type: 'string',
        }
        )
				.coerce('gaslimit', gaslimit => numberFormatted(gaslimit))

        .option('gasprice', {
          alias:['p'], 
          desc: 'Gas price of transaction',
					type: 'string',
        }
        )
				.coerce('gasprice', gasprice => numberFormatted(gasprice))
        .option('nonce', {
          alias:'n',
          desc: 'Nonce of transaction',
					type: 'string',
        }
        )

        .option('block', {
          alias:'b',
          type: 'number',
          desc: 'Block height of transaction. (Only used with call transactions.)',
        }
        )

        .command({
          //cceb eth
          command: 'web3 <function> [parameters..]',
          desc: 'Display all token pairs on an exchange',
          builder: (yargs) => {
            yargs
              .positional('function', {
                desc: 'Web3 function or parameter to use (eg.: web3.eth.getAccounts)',
								type: 'string',
              }
              )

              .positional('parameters', {
                type: 'string',
                desc: 'Web3 function parameters',
                default: []
              }
              )
							.coerce('parameters', 
								parameters => parameters.map(parameter => numberFormatted(parameter))
							)
          }
        })
        .command({
          //cceb eth
          command: 'tx [contract] [func] [args..]',
          desc: 'Create an ethereum transaction. Send or call method is used automatically based on abi',
          builder: (yargs) => {
            yargs
              .positional('contract', {
                desc: 'Contract address',
								type: 'string',
              }
              )

              .positional('func', {
                type: 'string',
                desc: 'Function name to call or send',
              }
              )

              .positional('args', {
                desc: 'Called function\'s arguments',
								type: 'string',
                default: [],
              }
              )
							.coerce('args', args => args.map(arg => numberFormatted(arg)))

              .option('abi', {
                alias:'a',
                desc: 'Abi defaults to <contract>.abi',
								type: 'string',
              }
              )

              .option('value', {
                alias:'v',
                desc: 'Eth value to send',
								type: 'string',
              }
              )
							.coerce('value', value => numberFormatted(value))

              .option('ls', {
                alias:'l',
                desc: 'List functions in abi matching pattern',
								type: 'string',
              }
              )

              .option('calldata', {
                alias:['c', 'd'],
                desc: 'Hex calldata to be sent to contract.',
								type: 'string',
              }
              )
          }
        })
        .command({
          //cceb eth
          command: 'abi <contract> [ls]',
          desc: 'Displays abi of smart contract',
          builder: (yargs) => {
            yargs
              .positional('contract', {
                desc: 'Contract address',
								type: 'string',
              }
              )

              .option('ls', {
                alias: 'l',
                default: '.*',
                desc: 'List functions matching regex pattern',
								type: 'string',
              }
              )

          }
        })
        .command({
          //cceb eth
          command: 'send <txjson> <signature>',
          desc: 'Sends a prepared transaction (json formatted) to the blockchain',
          builder: (yargs) => {
            yargs

              .positional('txjson', {
                desc: 'Json file of the transaction',
								type: 'string',
              }
              )

              .positional('signature', {
                type: 'string',
                desc: 'Signature created by external signer',
              }
              )
          }
        })
        .command({
          //cceb eth
          command: 'address <contr>',
          desc: 'Get contract address from contract name, or vica versa',
          builder: (yargs) => {
            yargs

              .positional('contr', {
                desc: 'Contract address or contract name',
								type: 'string',
              }
              )

          }
        })
        .command({
          //cceb eth
          command: 'source <contractName>',
          alias: ['so'],
          desc: 'Download and display source code of contract',
          builder: (yargs) => {
            yargs

              .positional('contractName', {
                desc: 'Contract name',
								type: 'string',
              }
              )

          }
        })
        .command({
          //cceb eth
          command: 'import <contractName> <contractAddress> [location]',
          alias: ['im'],
          desc:'Map contract address to a human readable name and download and store contract abi',
          builder: (yargs) => {
            yargs

              .positional('contractName', {
                desc: 'Human readable shorthand name for contract. When contract name is used later on, it will be substituted by contract address automatically',
								type: 'string',
              }
              )

              .positional('contractAddress', {
                desc: 'Contract address',
								type: 'string',
              }
              )

              .option('location', {
                alias: 'l',
                desc: 'Insert contract into path in "./config/default.yaml"',
								type: 'string',
              }
              )

          }
        })
        .command({
          //cceb eth
          command: 'nonce <account>',
          alias: ['no'],
          desc:'Get highest nonce of account',
          builder: (yargs) => {
            yargs

              .positional('account', {
                desc: 'Account to get nonce for',
								type: 'string',
              }
              )

          }
        })
        .command({
          //cceb eth
          command: 'maker <makerCommand> [vault] [from] [estimate]',
          desc: 'Commands to operate MakerDao vaults',
          builder: (yargs) => {
            yargs
              .option('vault', {
                alias: 'v',
                type: 'number',
                default: 0,
                desc: 'The number of vault to operate with',
              }
              )

              .option('from', {
                default: config.get('web3.defaultFrom'),
                desc: 'From Address defaults to web3.defaultFrom',
								type: 'string',
              }
              )

              .option('estimate', {
                alias:'e',
                type: 'boolean',
                desc: 'Returns expected gas cost in USD',
              }
              )
              .command({
                //cceb eth maker
                command: 'info <type>',
                desc: 'Get vault info',
                builder: (yargs) => {
                  yargs

                    .positional('type', {
                      desc: 'Type of vault to get info from. Eg.: USDC-A',
											type: 'string',
                    }
                    )
                }
              })
              .command({
                //cceb eth maker
                command: 'open <type>',
                desc: 'Open new MakerDao vault',
                builder: (yargs) => {
                  yargs

                    .positional('type', {
                      desc: 'Type of vault to get info from. Eg.: USDC-A',
											type: 'string',
                    }
                    )
                }
              })
              .command({
                //cceb eth maker
                command: 'deposit <type> <amount>',
                desc: 'Deposit collateral to vault',
                builder: (yargs) => {
                  yargs

                    .positional('type', {
                      desc: 'Type of vault that will be deposited to. Eg.: ETH-A',
											type: 'string',
                    }
                    )

                    .positional('amount', {
                      desc: 'Deposit amount of collateral',
											type: 'string',
                    }
                    )
										.coerce('amount', amount => numberFormatted(amount))

                    .option('draw', {
                      alias: 'd',
                      type: 'number',
                      default: 0,
                      desc: 'Draw create DAI to the urn in one step',
                    }
                    )

                }
              })
              .command({
                //cceb eth maker
                command: 'withdraw <type> <amount>',
                desc: 'Withdraw collateral from vault',
                builder: (yargs) => {
                  yargs

                    .positional('type', {
                      desc: 'Type of vault that will be withdrawn from. Eg.: ETH-A',
											type: 'string',
                    }
                    )

                    .positional('amount', {
                      desc: 'Withdraw amount of collateral',
											type: 'string',
                    }
                    )
										.coerce('amount', amount => numberFormatted(amount))
                }
              })
              .command({
                //cceb eth maker
                command: 'generate <type> <amount>',
                desc: 'Generate DAI stablecoin',
                builder: (yargs) => {
                  yargs

                    .positional('type', {
											type: 'string',
                      desc: 'Type of vault that DAI will be generated from. Eg.: ETH-A',
                    }
                    )

                    .positional('amount', {
											type: 'string',
                      desc: 'Amount of DAI to generate',
                    }
                    )
										.coerce('amount', amount => numberFormatted(amount))
                }
              })
              .command({
                //cceb eth maker
                command: 'payback <type> <amount>',
                desc: 'Payback an amount of DAI to vault type',
                builder: (yargs) => {
                  yargs

                    .positional('type', {
                      type: 'string',
                      desc: 'Type of vault that DAI will be paid back to. Eg.: ETH-A',
                    }
                    )

                    .positional('amount', {
                      type: 'string',
                      desc: 'Amount of DAI paid back',
                    }
                    )
										.coerce('amount', amount => numberFormatted(amount))
                }
              })
              .command({
                //cceb eth maker
                command: 'estimate',
                desc: 'Estimate gas cost of ??. Don\'t use this!',
              })
              .command({
                //cceb eth maker
                command: 'flop [count]',
                desc: 'Make a count of new bids',
                builder: (yargs) => {
                  yargs

                    .option('count', {
                      type: 'string',
                      alias: 'c',
                      desc: 'Number of new bids to make',
                    }
                    )
										.coerce('count', count => numberFormatted(count))
                }
              })
              .command({
                //cceb eth maker
                command: 'tick <id>',
                desc: 'Bid a better price for an expired auction',
                builder: (yargs) => {
                  yargs

                    .positional('id', {
                      type: 'string',
                      desc: 'Make an expired auction have better price',
                    }
                    )

                }
              })
              .command({
                //cceb eth maker
                command: 'dent <id> [amount]',
                desc: 'Bid for an auction of id',
                builder: (yargs) => {
                  yargs

                    .positional('id', {
                      type: 'string',
                      desc: 'Identifier of auction to make bid for',
                    }
                    )

                    .option('amount', {
                      type: 'string',
                      alias: 'a',
                      desc: 'Amount to bid. Default amount is the minimal necessary',
                    }
                    )
										.coerce('amount', amount => numberFormatted(amount))

                }
              })
              .command({
                //cceb eth maker
                command: 'deal <id>',
                desc: 'Finish an auction and receive MKR',
                builder: (yargs) => {
                  yargs

                    .positional('id', {
                      type: 'string',
                      desc: 'Idealifier of auction to finish',
                    }
                    )
                }
              }).command({
                //cceb eth maker
                command: 'flog <contract> [from-block] [to-block] [amount]',
                desc: 'Get events of bad debt from contract from blocknumber to blocknumber',
                builder: (yargs) => {
                  yargs

                    .positional('contract', {
                      type: 'string',
                      desc: 'Contract to get events from',
                    }
                    )

                    .option('from-block', {
                      type: 'string',
                      alias: 'f',
                      default: 'latest',
                      desc: 'Startblock to get events from',
                    }
                    )

                    .option('to-block', {
                      type: 'string',
                      alias: 't',
                      default: 'latest',
                      desc: 'End block to get events from',
                    }
                    )

                    .option('amount', {
                      alias: 'a',
                      default: 50000,
                      type: 'number',
                      desc: 'Amount of max. dai to allow auction for',
                    }
                    )
										.coerce('amount', amount => numberFormatted(amount))

                }
              })
          }
        })
        .command({
          //cceb eth
          command: 'aave <aaveCommand> [referral] [estimate]',
          desc: 'Commands accessing https://aave.com lending protocol',
          builder: (yargs) => {
            yargs
              .option('referral', {
                type: 'string',
                alias: 'r',
                default: '0',
                desc: 'Referral code in AAVE system',
              }
              )

              .option('estimate', {
                alias:'e',
                type: 'boolean',
                desc: 'Returns expected gas cost in USD',
              }
              )

              .command({
                //cceb eth aave 
                command: 'deposit <amount> <token>', 
                desc: 'Deposit an amount of token to aave',
                builder: (yargs) => {
                  yargs
                    .positional('amount', {
                      type: 'string',
                      desc: 'Amount you want to deposit',
                    }
                    )
										.coerce('amount', amount => numberFormatted(amount))

                    .positional('token', {
                      type: 'string',
                      desc: 'Token you want to deposit',
                    }
                    )

                }
              })
              .command({
                //cceb eth aave 
                command: 'withdraw <amount> <token>', 
                desc: 'Withdraw an amount of token from aave',
                builder: (yargs) => {
                  yargs
                    .positional('amount', {
                      type: 'string',
                      desc: 'Amount you want to withdraw',
                    }
                    )
										.coerce('amount', amount => numberFormatted(amount))

                    .positional('token', {
                      type: 'string',
                      desc: 'Token you want to withdraw',
                    }
                    )
                }
              })
              .command({
                //cceb eth aave 
                command: 'collateral <token> [disable]', 
                desc: 'Enable(/disable) token as collateral in aave',
                builder: (yargs) => {
                  yargs
                    .positional('token', {
                      type: 'string',
                      desc: 'Token you want to use as collateral',
                    }
                    )

                    .option('disable', {
                      alias: 'd',
                      type: 'boolean',
                      desc: 'Disable to use token as collateral',
                    }
                    )

                }
              })
              .command({
                //cceb eth aave 
                command: 'borrow <amount> <token> [fixed]', 
                desc: 'Borrow an amount of token against a collateral in aave',
                builder: (yargs) => {
                  yargs
                    .positional('amount', {
                      type: 'string',
                      desc: 'Deposit amount of collateral',
                    }
                    )
										.coerce('amount', amount => numberFormatted(amount))

                    .positional('token', {
                      type: 'string',
                      desc: 'Token that w',
                    }
                    )

                    .option('fixed', {
                      alias: 'd',
                      type: 'boolean',
                      desc: 'Use fixed interests. Default: variable interests',
                    }
                    )

                }
              })
              .command({
                //cceb eth aave 
                command: 'payback <amount> <token> [for]', 
                desc: 'Payback an amount of token for ourselfes or others',
                builder: (yargs) => {
                  yargs
                    .positional('amount', {
                      type: 'string',
                      desc: 'Amount to payback',
                    }
                    )
										.coerce('amount', amount => numberFormatted(amount))

                    .positional('token', {
                      type: 'string',
                      desc: 'Token to payback',
                    }
                    )

                    .option('for', {
                      type: 'string',
                      alias: 'o',
                      desc: 'Payback for someone else',
                    }
                    )

                }
              })
              .command({
                //cceb eth aave 
                command: 'swaprate <token> [for]', 
                desc: 'Toggle between fixed and variable rate for token',
                builder: (yargs) => {
                  yargs

                    .positional('token', {
                      type: 'string',
                      desc: 'Token to swap the rate between fixed and variable',
                    }
                    )

                }
              })
              .command({
                //cceb eth aave 
                command: 'rebalance <token> [for]', 
                desc: 'Rebalancei (actualize) fixed interest rate for token for ourselves or others',
                builder: (yargs) => {
                  yargs

                    .positional('token', {
                      type: 'string',
                      desc: 'Token to rebalance interest rate for',
                    }
                    )

                    .option('for', {
                      type: 'string',
                      desc: 'Address to rebalance for. Default: '+ config.get('web3.defaultFrom'),
                    }
                    )
                }
              })
              .command({
                //cceb eth aave 
                command: 'liquidate <collateraltoken> <loantoken> <user> <amount>', 
                desc: 'Liquidate undercollaterized position for collateral token and loan token owned by address',
                builder: (yargs) => {
                  yargs

                    .positional('collateraltoken', {
                      type: 'string',
                      desc: 'Token that is the collateral',
                    }
                    )

                    .positional('loantoken', {
                      type: 'string',
                      desc: 'Token that is used for the loan',
                    }
                    )

                    .positional('user', {
                      type: 'string',
                      desc: 'Address of user who has the loan',
                    }
                    )

                    .positional('amount', {
                      type: 'string',
                      desc: 'Amount of collateral to buy(???)', //FIXME: have no idea what that is
                    }
                    )
										.coerce('amount', amount => numberFormatted(amount))
                }
              })
              .command({
                //cceb eth aave 
                command: 'info <aaveInfoCommand>', 
                desc: 'Get info on reserves',
                builder: (yargs) => {
                  yargs
                    .command({
                      //cceb eth aave info
                      command: 'reserve <token>', 
                      desc: 'Get info on token reserve',
                      builder: (yargs) => {
                        yargs
                          .positional('token', {
                            type: 'string',
                            desc: 'Get info for token reserve',
                          }
                          )

                      }
                    })
                    .command({
                      //cceb eth aave info
                      command: 'account', 
                      desc: 'Get account info for account address',
                    })
                    .command({
                      //cceb eth aave info
                      command: 'user <token>', 
                      desc: 'Get info on user\'s token reserves',
                      builder: (yargs) => {
                        yargs
                          .positional('token', {
                            type: 'string',
                            desc: 'Get info for token reserve',
                          }
                          )

                      }
                    })

                }
              })



          }
        })
        .command({
          //cceb eth
          command: 'curve <curveCommand>',
          desc: 'Commands accessing https://curve.fi protocol',
          builder: (yargs) => {
            yargs

              .command({
                //cceb eth curve
                command: 'info',
                desc: 'Commands accessing https://curve.fi protocol',
              })

          }
        })
    },
    handler: (argv) => {
      console.log(`setting ${argv.key} to ${argv.value}`)
    }
  })
  .command({
    //cceb
    command: 'ledger <ledgerCommand>',
    desc: 'Do stuff with Ledger cold wallet https://www.ledger.com/ ',
    builder: (yargs) => {
      yargs
        .command({
          //cceb ledger
          command: 'addresses [wallet] [live] [start-position] [count]',
          desc: 'List first ten addresses',
          builder: (yargs) => {
            yargs
              .option('wallet', {
                type: 'string',
                alias:'w',
                choices: ['Ethereum'],
                default: 'Ethereum',
                desc: 'Wallet to connect to. Currently only Ethereum is supported',
              }
              )

              .option('live', {
                type: 'string',
                alias:'l',
                desc: 'Connect to ledger live vallets only',
              }
              )

              .option('start-position', {
                type: 'string',
                alias:['s', 'startPosition'], 
                default: 0,
                desc: 'List accounts starting from this position. Starting at 0',
              }
              )

              .option('count', {
                alias:'c',
                type: 'number',
                default: 10,
                desc: 'List this many addresses each',
              }
              )
							.coerce('count', count => numberFormatted(Number.toString(count)))

          }
        })
    }
  })
  .command({
    //cceb
    command: 'radix <radixCommand> [username] [password]',
    desc: 'Interact with Radix network. https://www.radixdlt.com',
    builder: (yargs) => buildRadixCommands(yargs) 
  })
  .demandCommand()
  .completion('completion', function (current, argv, completionFilter, done) {
    // if 'apple' present return default completions
    //fs.writeFileSync("/home/user/cceb/args.txt", JSON.stringify({current, argv}));
    if (tab('cceb eth web3', argv)) {
				handleEthWeb3(current, argv, done, completionFilter)
			} else if (tab('cceb eth source', argv)) {
				handleEthTxContract(current, argv, done, completionFilter)
			} else if (tab('cceb eth nonce', argv)) {
				handleEthTxArgs(current, argv, done, completionFilter)
			} else if (tab('cceb eth abi', argv)) {
				handleEthTxContract(current, argv, done, completionFilter)
			} else if (tab('cceb eth address', argv)) {
				handleEthTxArgs(current, argv, done, completionFilter)
			} else if (tab('cceb eth tx', argv)) {
				handleEthTxContract(current, argv, done, completionFilter)
			} else if (tab('cceb eth tx .*', argv)) {
				handleEthTxFunc(current, argv, done, completionFilter)
			} else if (tab('cceb eth tx .* .*', argv, true)) {
				handleEthTxArgs(current, argv, done, completionFilter)
			} else if (tab('cceb exchange add', argv)) {
				done(Object.keys(config.get('keys')))	
			} else if (tab('cceb exchange add .*', argv)) {
				done(['buy', 'sell'])	
			} else if (tab('cceb exchange add .* .*', argv)) {
				done(['limit', 'market'])	
			} else if (tab('cceb exchange add .* .* .*', argv)) {
				done(['max', '<amount>'])	
			} else if (tab('cceb exchange add .* .* .* .*', argv)) {
				done(['aaa', ' aaa'])	
			} else if (tab('cceb exchange add .* .* .* .* .*', argv)) {
				done([' ', '<price>'])	
			} else {
		//fs.writeFileSync("/home/user/cceb/args.txt", `completionFilter: whyyyyy?`)
				completionFilter()
			}
		})
		.help()
		.epilogue('More info: https://www.npmjs.com/package/cceb')
		.argv
	}

function buildRadixCommands (yargs) {
  yargs
    .option('username', {
      alias:'u',
      type: 'string',
      desc: 'Username for authorization',
    }
    )
    .option('password', {
      alias:'p',
      type: 'string',
      desc: 'Password for authorization',
    }
    )

  openRpc.methods.reduce((y, method) => 
    y.command({
    //cceb radix
      command: method.name + method.params.reduce(
        (paramsString, param) => paramsString + (param.required ? ' <':' [') + param.name + (param.required ? '>':']')
      , ""),
    desc: method.summary,
    builder: (yargs) => buildArgs(yargs, method) 
  })
  , yargs) 
} 

function buildArgs (yargs, method) {
  method.params.reduce((yargs, param) => { 
    param.required ?
    yargs.positional(param.name, {
      type: param.schema.type === 'integer' ? 'string': !param.schema.type ? 'string' : param.schema.type,
    })
    :
    yargs.option(param.name, {
      type: param.schema.type === 'integer' ? 'string': !param.schema.type ? 'string' : param.schema.type,
    })

    if (param.schema.type === 'integer') {
      yargs.coerce(param.name, int => numberFormatted(int))
    }

    return yargs
  }
    , yargs)
}

function numberFormatted (numString) {

	const exponent = {
		wei: 0,
		kwei: 3,
		babbage: 3,
		mwei: 6,
		lovelace: 6,
		gwei: 9,
		gw: 9,
		shannon: 9,
		terawei: 12,
		tw: 12,
		szabo: 12,
		microether: 12,
		petawei: 15,
		pw: 15,
		finney: 15,	
		milliether: 15,
		ether: 18,
	}

	const units = Object.keys(exponent)	
	
	numString = units.reduce((acc, unit) => 
		acc && acc.replace(new RegExp('^\\s*([-+]?[0-9.]*)\\s*' + unit, 'i'), (match, p1) =>
			BN(p1 || 1).times(BN(10).pow(exponent[unit])).toFixed())
	, numString)

	numString = numString && numString.replace(/^\s*([-0-9.]*)E(-?[0-9]+)/i, (match, p1, p2) => {
		return BN(p1 || 1).times(BN(10).pow(p2)).toFixed()
	})

	return numString
}

	async function handleEthTxArgs (current, argv, done, completionFilter) {
		return await Promise.all(completionFilter(async (err, comp) => {
			if (current.match(/[A-Z]/) && !current.match(/[a-z]/)) {
				comp = await w3.getAddressNames('^'+ current)	
			}
			done(comp)
		}))
	}

	async function handleEthTxFunc (current, argv, done, completionFilter) {
    try {
		var ret = await Promise.all(completionFilter(async (err, comp) => {
			if (argv._[3] === 'ETH') {
				comp = ['balance', 'balanceOf', 'transfer']
			} else {
        //fs.writeFileSync("/home/user/cceb/args.txt", JSON.stringify({err, comp}) + `argv: ${JSON.stringify(argv)} \n`)

				comp = (await w3.getAbiFunctions(argv._[3], '.*'))
					.filter(fn => fn.match(new RegExp('^' + (current || ''))))
					.map(fn => fn.replace(/ /g, '_'))

			}

			var funcNames = comp.map(fn => fn.replace(/\(.*/, ''))
			funcNames = [...new Set(funcNames)]
			if (funcNames.length === 1) {
				comp = funcNames
			}
			done(comp)
		}))
    } catch (e) {
    
      //fs.writeFileSync("/home/user/cceb/args.txt", e.stack)
    }
    return ret 
	}

	async function handleEthTxContract (current, argv, done, completionFilter) {
		return await Promise.all(completionFilter(async (err, comp) => {
			comp = await w3.getAddressNames('^'+ current, true)	
			//fs.writeFileSync("/home/user/cceb/args.txt", "handleEthTxContract: " + JSON.stringify(comp))
			done(comp)
		}))
	}

	async function handleEthWeb3 (current, argv, done, completionFilter) {
  completionFilter((err, comp) => {
    if (current.match(/^web3.eth.I/)) {
      comp = comp.concat(ibanFuncs().map(key => 'web3.eth.Iban.' + key))

    } else if (current.match(/^web3.eth.n/)) {
      comp = comp.concat(Object.keys(w3.web3.eth.net).filter(
        key => ![
          'setProvider',
          'BatchRequest',
        ].includes(key)).map(key => 'web3.eth.net.' + key))

    } else if (current.match(/^web3.eth.a/)) {
      comp = comp.concat(Object.keys(w3.web3.eth.abi).map(key => 'web3.eth.abi.' + key))

    } else if (current.match(/^web3.u/)) {
      
      comp = comp.concat(Object.keys(w3.web3.utils).map(key => 'web3.utils.' + key))

    } else if (current.match(/^web3.e/)) {
      
      comp = comp.concat(Object.keys(w3.web3.eth).filter(
        key => ![
          'subscribe',
          'Contract',
          'setProvider',
          'clearSubscriptions',
          'handleRevert',
          'BatchRequest',
        ].includes(key)).map(key => 'web3.eth.' + key))
    
    } else if (current.match(/^w/)) {
      
      comp.push("web3.eth")
      comp.push("web3.utils")
    } else {
      let funcsOffered = web3MatchingCommands(current) 
      
      // if after multiple occurances removed from array it remains same length => 
      // func has unique name  
      if ([...new Set(funcsOffered)].length < funcsOffered.length) {
        throw new Error('Fucnction occurs in multiple places use full path eg: web3.eth.getBlockNumber')
      }
      comp = funcsOffered.concat(['web3'])
      
    }
      done(comp)
  })
}

function ibanFuncs () {
   return [
      'toAddress',
      'toIban',
      'fromAddress',
      'fromBban',
      'createIndirect',
      'isValid',
    ]

}

function web3MatchingCommands (command, fullPath = false, exact = false) {
  return Object.keys(w3.web3.eth)
		.filter(key => ('web3.eth.' + key).match(new RegExp((exact ? command + '$' : command), 'i')))
    .map(key => fullPath ? 'web3.eth.' + key :key)
    .concat(
      Object.keys(w3.web3.utils)
      .filter(key => ('web3.utils.' + key).match(new RegExp((exact ? command + '$' : command), 'i')))
      .map(key => fullPath ? 'web3.utils.' + key :key)
    )
    .concat(
      ibanFuncs()
      .filter(key => ('web3.eth.Iban.' + key).match(new RegExp((exact ? command + '$' : command), 'i')))
      .map(key => fullPath ? 'web3.eth.Iban' + key :key)
    )
		.concat(
			Object.keys(w3.web3.eth.abi)
			.filter(key => ('web3.eth.abi.' + key).match(new RegExp((exact ? command + '$' : command), 'i')))
			.map(key => fullPath ? 'web3.eth.abi.' + key :key)
		)
}

function tab (commands, argv, commandLengthCanBeGreaterArgsLength = false) {
  var comms = commands.split(/\s+/).slice(1)
	
	var commandsEqualsArgv = comms.reduce(
    (acc, command, idx) =>  acc && (!argv._[idx + 1] || (argv._[idx + 1]).match(new RegExp('^' + command + '$')))
  , true)

	var matches = commandsEqualsArgv && 
		(
			(
				!commandLengthCanBeGreaterArgsLength &&
				comms.length + 2 === argv._.length
			) ||
			(
				commandLengthCanBeGreaterArgsLength &&
				comms.length + 2 <= argv._.length
			)
		)

	//fs.writeFileSync("/home/user/cceb/args.txt", `tab(${matches}): commands:` + JSON.stringify(commands) + 'argv: ' + JSON.stringify(argv))

	return matches
}

module.exports = {
  argParse,
  web3MatchingCommands,
}
