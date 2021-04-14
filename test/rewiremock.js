// rewiremock.cjs.js
const rewiremock = require('rewiremock/node')
// nothng more than `plugins.node`, but it might change how filename resolution works
/// settings
rewiremock.overrideEntryPoint(module)
module.exports = rewiremock
