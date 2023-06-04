const BN = require('bignumber.js')
const config = require('config')
const columnify = require('columnify')
const fs = require('fs')
const log4js = require('log4js')
const w3 = require('../web3.js')
const ut = require('../util')


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
  const network = config.get('web3.network')

	async function dispCurveInfo (args, baseDir) {
		const {claims, crv_day, sum, crv_usd, lp_usd, gauge_percent, deposit_token} = await curveInfo(args, baseDir)

		var render = claims
			.map(gauge => {return {
				gauge: gauge.gauge,                                   // name of gauge
				crv: BN(gauge.token).div(10**18).toFixed(2),          // current crv balance
				crv_usd: BN(gauge.crv_usd).div(10**6).toFixed(2),     // current crv balance in usd
				crv_100k: BN(gauge.crv_100k).div(10**18).toFixed(2),  // crv daily harvest per 100k lp token (good to compare pools)
				crv_100k_f: BN(gauge.crv_100k_f).div(10**18).toFixed(2),  // crv daily harvest per 100k lp token (good to compare pools)
				crv_day: BN(gauge.crv_day).div(10**18).toFixed(2),    // crv daily harvest per current lp token deposit
				lp: BN(gauge.lp).div(10**18).toFixed(2),              // lp tokens deposited
				lp_usd: gauge.lp_usd.toFixed(2),                      // usd value of lp tokens deposited
				boost: gauge.boost.toFixed(2),                        // current boost
				boost_f: BN( gauge.boost_f).toFixed(2),               // future boost if same lp tokens would be deposited now
				d_lp_max_boost: gauge.d_lp_max_boost.div(10**18).toFixed(2),   // this much lp tokens can be deposited without loosing max boost
				gauge_percent: gauge.gauge_percent.times(100)
				.toFixed(2),                                       // this is percentage of CRV that ends up in gauge 
				deposit_usd: gauge.deposit_token.toFormat(2), // deposited USD value in gauge 
			}})
			.sort((a, b) => Number(a.crv_100k) - Number(b.crv_100k))

		render.push({
			gauge: '---',
			crv: '---',
			crv_usd: '---',
			gauge_percent: '---',
			deposit_usd: '---',
			crv_100k: '---',
			crv_100k_f: '---',
			crv_day: '---',
			lp: '---',
			lp_usd: '---',
			boost: '---',
			boost_f: '---',
			d_lp_max_boost: '---',
		})

		render.push({
			gauge: 'TOTAL',
			crv: BN(sum).div(10**18).toFixed(2),
			crv_usd: crv_usd.div(10**6).toFixed(2),
			crv_100k: '',
			crv_100k_f: '',
			crv_day: BN(crv_day).div(10**18).toFixed(2),
			lp: '',
			lp_usd: lp_usd.toFixed(2),
			boost: '',
			boost_f: '',
			d_lp_max_boost: '',
			gauge_percent: gauge_percent.toFixed(2),
			deposit_usd: deposit_token.toFormat(2),
		})

		const columns = columnify(render,
			{config: {
				gauge: {align: 'left'},
				crv: {align: 'right'},
				crv_usd: {align: 'right'},
				crv_100k: {align: 'right'},
				crv_100k_f: {align: 'right'},
				crv_day: {align: 'right'},
				sum: {align: 'right'},
				lp: {align: 'right'},
				lp_usd: {align: 'right'},
				boost: {align: 'right'},
				boost_f: {align: 'right'},
				d_lp_max_boost: {align: 'right'},
				gauge_percent: {align: 'right'},
				deposit_usd: {align: 'right'},
			}})

		console.log(columns)
	}

	async function curveInfo (args, baseDir) {
		var web3 = await ut.getWeb3(network)
		var fileNames = await fs.promises.readdir(baseDir + 'abi')
		fileNames = fileNames.filter(fileName => /^CRV_GAUGE_/.test(fileName) && fileName !== 'CRV_GAUGE_CONTROLLER')

		var claims = await Promise.all(fileNames.map(async fileName => {
			return { 
				gauge: fileName, 
				token: await w3.access(web3, args.block, fileName, 'claimable_tokens', [args.from]),
				lp_free: await w3.access(web3, args.block, 'CRV_LP_' + fileName.replace(/CRV_GAUGE_/, ''), 'balanceOf', [args.from]),
			}
		}
		)
		)

		claims.map(gauge => {
			BN(gauge.lp_free).gt(1) && log.warn(`${gauge.gauge} has unused LP of ${BN(gauge.lp_free).toFixed()}`)
			return 0
		})

		// claims = claims.filter(gauge => gauge.token !== '0')
		const ve_crv = await w3.access(web3, args.block, 'CRV_VECRV', 'balanceOf', [args.from])
		const ve_crv_total = await w3.access(web3, args.block, 'CRV_VECRV', 'totalSupply')
		// const WEEK = 604800
		const rate = await w3.access(web3, args.block, 'CRV', 'rate')
		const btc_usd = (await w3.access(web3, args.block, 'UNISWAP_ROUTER_V2', 'getAmountsOut', ["1.00000000", ["WBTC", "WETH", "USDT"]]))[2]

		claims = await Promise.all(claims.map(async claim => {
			// const period = await w3.access(web3, args.block, claim.gauge,'period')
			// const prev_week_time = await w3.access(web3, args.block, claim.gauge,'period_timestamp',[period])
			const crv_usd = claim.token !== '0' ? (await w3.access(web3, args.block, 'UNISWAP_ROUTER_V2', 'getAmountsOut', [claim.token, ["CRV", "WETH", "USDT"]]))[2]: 0
			const lp = await w3.access(web3, args.block, claim.gauge, 'balanceOf', [args.from])
			const name = claim.gauge.replace(/CRV_GAUGE_/, '')
			const lp_virtual_price = await w3.access(web3, args.block, 'CRV_SWAP_' + name, 'get_virtual_price')
			const lp_usd = BN(lp).times(BN(lp_virtual_price)).div(10**36)
			const lp_total = (await w3.access(web3, args.block, claim.gauge, 'totalSupply')).replace(/\./, "")
			const lp_all = (await w3.access(web3, args.block, 'CRV_LP_' + name, 'totalSupply')).replace(/\./, "")
			var deposit_token = BN(lp_all).times(BN(lp_virtual_price)).div(10**36)
			if (/.*BTC.*|.*REN.*/.test(claim.gauge)) {
				deposit_token = deposit_token.times(BN(btc_usd)).div(10**6)
			}
			const working_balances =  await w3.access(web3, args.block, claim.gauge, 'working_balances', [args.from])
			const working_supply =  await w3.access(web3, args.block, claim.gauge, 'working_supply')
			const gauge_relative_weight = await w3.access(web3, args.block, 'CRV_GAUGE_CONTROLLER', 'gauge_relative_weight', [claim.gauge]) 
			const next_week = String(Math.floor(Date.now() / 1000 + 604800))
			const gauge_relative_weight_f = await w3.access(web3, args.block, 'CRV_GAUGE_CONTROLLER', 'gauge_relative_weight', [claim.gauge, next_week]) 
			const gauge_weight = await w3.access(web3, args.block, 'CRV_GAUGE_CONTROLLER', 'get_gauge_weight', [claim.gauge]) 
			const gauge_type = await w3.access(web3, args.block, 'CRV_GAUGE_CONTROLLER', 'gauge_types', [claim.gauge]) 
			const type_weight = await w3.access(web3, args.block, 'CRV_GAUGE_CONTROLLER', 'get_weights_sum_per_type', [gauge_type]) 
			const gauge_percent = BN(gauge_weight).div(BN(type_weight))
			const crv_day_lp = BN(rate).times(BN(gauge_relative_weight)).times(86400).div(BN(working_supply))
			const crv_day_lp_f = BN(rate).times(BN(gauge_relative_weight_f)).times(86400).div(BN(working_supply))
			const crv_100k = crv_day_lp.times(100000)
			const crv_100k_f = crv_day_lp_f.times(100000)
			const boost = BN(working_balances).div(BN(lp)).times(2.5)
			const crv_day = lp === '0' ? BN(0) : crv_day_lp.times(BN(lp)).div(10**18).times(boost).div(2.5)

			const boost_f = 
				Math.min(
					Number(
						BN(lp)
						.times(0.4)
						.plus(
							BN(lp_total)
							.times(
								BN(ve_crv)
								.div( BN(ve_crv_total))
							)
							.times(0.6)
						)
						.div(BN(lp))
						.times(2.5)),
					2.5)

			const d_lp_max_boost = BN(lp_total).times(BN(ve_crv).div(BN(ve_crv_total))).minus(BN(lp))
			return {
				...claim,
				crv_usd,
				gauge_percent,
				lp,
				lp_usd,
				lp_total,
				deposit_token,
				working_balances,
				crv_day_lp, 
				crv_100k, 
				crv_100k_f, 
				crv_day,
				boost, 
				boost_f, 
				d_lp_max_boost, 
			}   
		}))

		claims = claims
			.reduce((acc, val, idx) => {
				acc.push({...val, sum: new BN(val.token).plus((acc[idx-1] && BN(acc[idx-1].sum)||'0')).toFixed()})
				return acc}, [])

		const crv_day = claims.reduce((acc, val) => val.crv_day.plus(acc), BN(0)) 
		const sum = claims[claims.length - 1]['sum']
		const crv_usd = claims.reduce((acc, val) => BN(val.crv_usd).plus(acc), BN(0))
		const lp_usd = claims.reduce((acc, val) => BN(val.lp_usd).plus(acc), BN(0))
		const gauge_percent = claims.reduce((acc, val) => BN(val.gauge_percent).plus(acc), BN(0)).times(100)
		const deposit_token = claims.reduce((acc, val) => BN(val.deposit_token).plus(acc), BN(0))
		return {claims, crv_day, sum, crv_usd, lp_usd, gauge_percent, deposit_token}
	}

module.exports = {
	curveInfo,
	dispCurveInfo,
}

