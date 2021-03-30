#!/usr/bin/env node
var keyth=require('keythereum')
const account = '0x8361d15ef3dc10efccc278d4ffed1c17308ba486'
var keyobj=keyth.importFromFile(account,'/home/telegram/.ethereum/')
var privateKey=keyth.recover('<your pwdi>',keyobj)
console.log(privateKey.toString('hex'))

