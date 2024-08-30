const Web3 = require('web3');
const rlp = require('rlp');
const keccak256 = require('keccak');
const {fromRpcSig, stripHexPrefix} = require('@ethereumjs/util')
const QRCode = require('qrcode')
require('dotenv').config();

// Set up web3 with an Arbitrum provider (you can use Infura, Alchemy, or another provider)
const web3 = new Web3('https://arb1.arbitrum.io/rpc');
const readline = require('readline');

// Create an interface to read input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


// Your account details
const senderAddress        = '0x0004d2A2f9a823C1A585fDE6514A17FF695E0001'; // Replace with your sender address

// USDC contract details
const usdcContractAddress  = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // USDC contract on Arbitrum
const usdcTransferFunction = '0xa9059cbb';                                 // transfer() function selector
const recipientAddress     = '0xec5feaf95edd4a06e8ec92da2f572a0a5f644ca6'; // Replace with the recipient's address
const usdc_amount_String   = '3976203769'
const gasPrice_String      = '20000000'
const gasLimit_String      = '2000000'
const chainId              = 42161;                                        // Arbitrum one 
var value_String           = '0'

// Encode the data for the transaction
const amountToSend = BigInt(usdc_amount_String).toString(16);

const data = usdcTransferFunction +
	web3.utils.padLeft(recipientAddress.replace('0x', ''), 64) +
	web3.utils.padLeft(amountToSend, 64);

async function sendUSDC () {
  // Get nonce
  const nonce = await web3.eth.getTransactionCount(senderAddress);

  // Set transaction parameters
  const gasPrice = BigInt(gasPrice_String).toString(16);
  const gasLimit = BigInt(gasLimit_String).toString(16);

	if (BigInt(value_String) === BigInt(0)) {
		value_String = ''
	}

  var txParams = {
    nonce:    '0x' + padEven(stripHexPrefix(nonce.toString(16))),
    gasPrice: '0x' + padEven(stripHexPrefix(gasPrice)),
    gasLimit: '0x' + padEven(stripHexPrefix(gasLimit)),
    to:       '0x' + padEven(stripHexPrefix(usdcContractAddress)),
    value:    '0x' + padEven(stripHexPrefix(value_String)),                 // No ETH being transferred
    data:     '0x' + padEven(stripHexPrefix(data)),
    chainId:  '0x' + padEven(stripHexPrefix(BigInt(chainId).toString(16))), // Arbitrum One Chain ID
  };

  // RLP encode the transaction
  var rlpEncoded = rlp.encode([
    Buffer.from(stripHexPrefix(txParams.nonce),    'hex'),
    Buffer.from(stripHexPrefix(txParams.gasPrice), 'hex'),
    Buffer.from(stripHexPrefix(txParams.gasLimit), 'hex'),
    Buffer.from(stripHexPrefix(txParams.to),       'hex'),
    Buffer.from(stripHexPrefix(txParams.value),    'hex'),
    Buffer.from(stripHexPrefix(txParams.data),     'hex'),
    Buffer.from(stripHexPrefix(txParams.chainId),  'hex'),
    Buffer.from(stripHexPrefix('0x'),              'hex'),
		Buffer.from(stripHexPrefix('0x'),              'hex'), // Empty r and s values initially
  ]);
	
	console.log(`chainId: ${txParams.chainId}`);

  // Hash the encoded transaction
  var txHash = keccak256('keccak256').update(rlpEncoded).digest();
	txHash = '0x' + txHash.toString('hex')

	QRCode.toString(txHash, {type: 'terminal'}, (err, str) => {
		if (err) throw new Error(err)
		console.log(str)
	})

	console.log(txHash);

	rl.question('Please enter signature: ', (signature) => {
  // Do something with the input string
  console.log(`You entered: ${signature}`);

	let {v, r, s} = fromRpcSig('0x' + stripHexPrefix(signature).replace(/[^0-9a-fx]/gm, ""))

	console.log({v, r, s})
	
  var vString = padEven((v + BigInt('0x' + stripHexPrefix(txParams.chainId)) * BigInt(2) + BigInt(8)).toString(16))
	vString = `0x${vString}`
	
	txParams = {
		...txParams,
		r: `0x${r.toString('hex').padStart(64, '0')}`,
		s: `0x${s.toString('hex').padStart(64, '0')}`,
		v: vString,
	}
	
	console.log(txParams);

	rlpEncoded = rlp.encode([
		Buffer.from(stripHexPrefix(txParams.nonce),    'hex'),
		Buffer.from(stripHexPrefix(txParams.gasPrice), 'hex'),
		Buffer.from(stripHexPrefix(txParams.gasLimit), 'hex'),
		Buffer.from(stripHexPrefix(txParams.to),       'hex'),
		Buffer.from(stripHexPrefix(txParams.value),    'hex'),
		Buffer.from(stripHexPrefix(txParams.data),     'hex'),
		Buffer.from(stripHexPrefix(txParams.v),        'hex'),
		Buffer.from(stripHexPrefix(txParams.r),        'hex'),
		Buffer.from(stripHexPrefix(txParams.s),        'hex'),
	]);

	const signedTx = '0x' + rlpEncoded.toString('hex');

	console.log(signedTx);
  
	// Send the signed transaction
  web3.eth.sendSignedTransaction(signedTx)
    .on('receipt', console.log)
    .on('error', console.error);
  // Close the interface

  rl.close();
});
}


function padEven (hexString) {
	return hexString.length % 2 === 0 ? hexString : '0' + hexString;
}

sendUSDC();

