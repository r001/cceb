#!/usr/bin/env node
const path = require('path')

process.env.NODE_CONFIG_DIR = (process.env.NODE_CONFIG_DIR
  ?
    process.env.NODE_CONFIG_DIR + require('path').delimiter
  :
    "") +
  path.join(__dirname, '/../config/') +
  require('path').delimiter +
  path.join(__dirname, '/../config/secrets/')

const config = require('config')
const TelegramBot = require('node-telegram-bot-api')
const shell = require('shelljs')

// replace the value below with the Telegram token you receive from @BotFather
const token = config.get('telegram-token')

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true})

// Matches "/echo [whatever]"
bot.onText(/\/(.*)/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message
  const chatId = msg.chat.id
  console.log(resp)
  const exec = shell.exec(match[1], {silent: true}) // the captured "whatever"
  var resp = exec.stdout + exec.stderr
  if (!resp || resp === '') {
    resp = 'No results.'
  }

  // send back the matched "whatever" to the chat
  bot.sendMessage(chatId, resp)
})
