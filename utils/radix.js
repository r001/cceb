const https = require('https');
const baseDir = __dirname + '/../'

process.env.NODE_CONFIG_DIR = (process.env.NODE_CONFIG_DIR
  ?
    process.env.NODE_CONFIG_DIR + require('path').delimiter
  :
    "")
  + baseDir + "config/" + require('path').delimiter + baseDir + "config/secrets/" +
   require('path').delimiter + "config/radix/" 

var config = require('config')
const axios = require('axios')
var fs = require('fs')
var log4js = require('log4js')

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

if (require.main === module) {

  (async () => {
  })()
}

async function queryRpc (method, params) {
  var openRpc = JSON.parse(fs.readFileSync(`${baseDir}/config/radix/open-rpc.spec.json`, `utf8`))
  var endPoint = openRpc.methods.filter(mtd => mtd.name.match(method))[0].servers[0].name

//// **Documenting methods
//  return openRpc.methods.sort().reduce((helpString, method) => {
//    helpString += `\`cceb radix ${method.name}`
//
//    helpString += method.params.reduce(
//      (paramsString, param) => paramsString + (param.required ? ' <':' [') + param.name + (param.required ? '>':']')
//      , "")
//
//    helpString += `\` - ${method.summary}  \n`
//    return helpString
//  
//  }, "")

  var postData = {
      jsonrpc: "2.0",
      method,
      params,
      id: 1,
    }

  var conf = {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  }

  if (params.username) {
    conf.auth = {
      username: params.username,
      password: params.password
    }

    delete params.username
    delete params.u
    delete params.password
    delete params.p
  }

  return (await axios.post(
    config.get(`xrd.provider`)[1].http.url + "/" + endPoint,
    postData, conf
      )).data.result
  
}

module.exports = {
  queryRpc,
}
