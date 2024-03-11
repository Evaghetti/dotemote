/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/tmi.js/index.js":
/*!**************************************!*\
  !*** ./node_modules/tmi.js/index.js ***!
  \**************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const client = __webpack_require__(/*! ./lib/client */ "./node_modules/tmi.js/lib/client.js");
module.exports = {
	client,
	Client: client
};


/***/ }),

/***/ "./node_modules/tmi.js/lib/api.js":
/*!****************************************!*\
  !*** ./node_modules/tmi.js/lib/api.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const fetch = __webpack_require__(/*! node-fetch */ "?641d");
const _ = __webpack_require__(/*! ./utils */ "./node_modules/tmi.js/lib/utils.js");

module.exports = function api(options, callback) {
	// Set the url to options.uri or options.url..
	let url = options.url !== undefined ? options.url : options.uri;

	// Make sure it is a valid url..
	if(!_.isURL(url)) {
		url = `https://api.twitch.tv/kraken${url[0] === '/' ? url : `/${url}`}`;
	}

	// We are inside a Node application, so we can use the node-fetch module..
	if(_.isNode()) {
		const opts = Object.assign({ method: 'GET', json: true }, options);
		if(opts.qs) {
			const qs = new URLSearchParams(opts.qs);
			url += `?${qs}`;
		}
		/** @type {import('node-fetch').RequestInit} */
		const fetchOptions = {};
		if('fetchAgent' in this.opts.connection) {
			fetchOptions.agent = this.opts.connection.fetchAgent;
		}
		/** @type {ReturnType<import('node-fetch')['default']>} */
		const fetchPromise = fetch(url, {
			...fetchOptions,
			method: opts.method,
			headers: opts.headers,
			body: opts.body
		});
		let response = {};
		fetchPromise.then(res => {
			response = { statusCode: res.status, headers: res.headers };
			return opts.json ? res.json() : res.text();
		})
		.then(
			data => callback(null, response, data),
			err => callback(err, response, null)
		);
	}
	// Web application, extension, React Native etc.
	else {
		const opts = Object.assign({ method: 'GET', headers: {} }, options, { url });
		// prepare request
		const xhr = new XMLHttpRequest();
		xhr.open(opts.method, opts.url, true);
		for(const name in opts.headers) {
			xhr.setRequestHeader(name, opts.headers[name]);
		}
		xhr.responseType = 'json';
		// set request handler
		xhr.addEventListener('load', _ev => {
			if(xhr.readyState === 4) {
				if(xhr.status !== 200) {
					callback(xhr.status, null, null);
				}
				else {
					callback(null, null, xhr.response);
				}
			}
		});
		// submit
		xhr.send();
	}
};


/***/ }),

/***/ "./node_modules/tmi.js/lib/client.js":
/*!*******************************************!*\
  !*** ./node_modules/tmi.js/lib/client.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const _global = typeof __webpack_require__.g !== 'undefined' ? __webpack_require__.g : typeof window !== 'undefined' ? window : {};
const _WebSocket = _global.WebSocket || __webpack_require__(/*! ws */ "?6264");
const _fetch = _global.fetch || __webpack_require__(/*! node-fetch */ "?641d");
const api = __webpack_require__(/*! ./api */ "./node_modules/tmi.js/lib/api.js");
const commands = __webpack_require__(/*! ./commands */ "./node_modules/tmi.js/lib/commands.js");
const EventEmitter = (__webpack_require__(/*! ./events */ "./node_modules/tmi.js/lib/events.js").EventEmitter);
const logger = __webpack_require__(/*! ./logger */ "./node_modules/tmi.js/lib/logger.js");
const parse = __webpack_require__(/*! ./parser */ "./node_modules/tmi.js/lib/parser.js");
const Queue = __webpack_require__(/*! ./timer */ "./node_modules/tmi.js/lib/timer.js");
const _ = __webpack_require__(/*! ./utils */ "./node_modules/tmi.js/lib/utils.js");

let _apiWarned = false;

// Client instance..
const client = function client(opts) {
	if(this instanceof client === false) { return new client(opts); }
	this.opts = _.get(opts, {});
	this.opts.channels = this.opts.channels || [];
	this.opts.connection = this.opts.connection || {};
	this.opts.identity = this.opts.identity || {};
	this.opts.options = this.opts.options || {};

	this.clientId = _.get(this.opts.options.clientId, null);
	this._globalDefaultChannel = _.channel(_.get(this.opts.options.globalDefaultChannel, '#tmijs'));
	this._skipMembership = _.get(this.opts.options.skipMembership, false);
	this._skipUpdatingEmotesets = _.get(this.opts.options.skipUpdatingEmotesets, false);
	this._updateEmotesetsTimer = null;
	this._updateEmotesetsTimerDelay = _.get(this.opts.options.updateEmotesetsTimer, 60000);

	this.maxReconnectAttempts = _.get(this.opts.connection.maxReconnectAttempts, Infinity);
	this.maxReconnectInterval = _.get(this.opts.connection.maxReconnectInterval, 30000);
	this.reconnect = _.get(this.opts.connection.reconnect, true);
	this.reconnectDecay = _.get(this.opts.connection.reconnectDecay, 1.5);
	this.reconnectInterval = _.get(this.opts.connection.reconnectInterval, 1000);

	this.reconnecting = false;
	this.reconnections = 0;
	this.reconnectTimer = this.reconnectInterval;

	this.secure = _.get(
		this.opts.connection.secure,
		!this.opts.connection.server && !this.opts.connection.port
	);

	// Raw data and object for emote-sets..
	this.emotes = '';
	this.emotesets = {};

	this.channels = [];
	this.currentLatency = 0;
	this.globaluserstate = {};
	this.lastJoined = '';
	this.latency = new Date();
	this.moderators = {};
	this.pingLoop = null;
	this.pingTimeout = null;
	this.reason = '';
	this.username = '';
	this.userstate = {};
	this.wasCloseCalled = false;
	this.ws = null;

	// Create the logger..
	let level = 'error';
	if(this.opts.options.debug) { level = 'info'; }
	this.log = this.opts.logger || logger;

	try { logger.setLevel(level); } catch(err) {}

	// Format the channel names..
	this.opts.channels.forEach((part, index, theArray) =>
		theArray[index] = _.channel(part)
	);

	EventEmitter.call(this);
	this.setMaxListeners(0);
};

_.inherits(client, EventEmitter);

// Put all commands in prototype..
for(const methodName in commands) {
	client.prototype[methodName] = commands[methodName];
}

// Emit multiple events..
client.prototype.emits = function emits(types, values) {
	for(let i = 0; i < types.length; i++) {
		const val = i < values.length ? values[i] : values[values.length - 1];
		this.emit.apply(this, [ types[i] ].concat(val));
	}
};
/** @deprecated */
client.prototype.api = function(...args) {
	if(!_apiWarned) {
		this.log.warn('Client.prototype.api is deprecated and will be removed for version 2.0.0');
		_apiWarned = true;
	}
	api(...args);
};
// Handle parsed chat server message..
client.prototype.handleMessage = function handleMessage(message) {
	if(!message) {
		return;
	}

	if(this.listenerCount('raw_message')) {
		this.emit('raw_message', JSON.parse(JSON.stringify(message)), message);
	}

	const channel = _.channel(_.get(message.params[0], null));
	let msg = _.get(message.params[1], null);
	const msgid = _.get(message.tags['msg-id'], null);

	// Parse badges, badge-info and emotes..
	const tags = message.tags = parse.badges(parse.badgeInfo(parse.emotes(message.tags)));

	// Transform IRCv3 tags..
	for(const key in tags) {
		if(key === 'emote-sets' || key === 'ban-duration' || key === 'bits') {
			continue;
		}
		let value = tags[key];
		if(typeof value === 'boolean') { value = null; }
		else if(value === '1') { value = true; }
		else if(value === '0') { value = false; }
		else if(typeof value === 'string') { value = _.unescapeIRC(value); }
		tags[key] = value;
	}

	// Messages with no prefix..
	if(message.prefix === null) {
		switch(message.command) {
			// Received PING from server..
			case 'PING':
				this.emit('ping');
				if(this._isConnected()) {
					this.ws.send('PONG');
				}
				break;

			// Received PONG from server, return current latency..
			case 'PONG': {
				const currDate = new Date();
				this.currentLatency = (currDate.getTime() - this.latency.getTime()) / 1000;
				this.emits([ 'pong', '_promisePing' ], [ [ this.currentLatency ] ]);

				clearTimeout(this.pingTimeout);
				break;
			}

			default:
				this.log.warn(`Could not parse message with no prefix:\n${JSON.stringify(message, null, 4)}`);
				break;
		}
	}


	// Messages with "tmi.twitch.tv" as a prefix..
	else if(message.prefix === 'tmi.twitch.tv') {
		switch(message.command) {
			case '002':
			case '003':
			case '004':
			case '372':
			case '375':
			case 'CAP':
				break;

			// Retrieve username from server..
			case '001':
				this.username = message.params[0];
				break;

			// Connected to server..
			case '376': {
				this.log.info('Connected to server.');
				this.userstate[this._globalDefaultChannel] = {};
				this.emits([ 'connected', '_promiseConnect' ], [ [ this.server, this.port ], [ null ] ]);
				this.reconnections = 0;
				this.reconnectTimer = this.reconnectInterval;

				// Set an internal ping timeout check interval..
				this.pingLoop = setInterval(() => {
					// Make sure the connection is opened before sending the message..
					if(this._isConnected()) {
						this.ws.send('PING');
					}
					this.latency = new Date();
					this.pingTimeout = setTimeout(() => {
						if(this.ws !== null) {
							this.wasCloseCalled = false;
							this.log.error('Ping timeout.');
							this.ws.close();

							clearInterval(this.pingLoop);
							clearTimeout(this.pingTimeout);
							clearTimeout(this._updateEmotesetsTimer);
						}
					}, _.get(this.opts.connection.timeout, 9999));
				}, 60000);

				// Join all the channels from the config with an interval..
				let joinInterval = _.get(this.opts.options.joinInterval, 2000);
				if(joinInterval < 300) {
					joinInterval = 300;
				}
				const joinQueue = new Queue(joinInterval);
				const joinChannels = [ ...new Set([ ...this.opts.channels, ...this.channels ]) ];
				this.channels = [];

				for(let i = 0; i < joinChannels.length; i++) {
					const channel = joinChannels[i];
					joinQueue.add(() => {
						if(this._isConnected()) {
							this.join(channel).catch(err => this.log.error(err));
						}
					});
				}

				joinQueue.next();
				break;
			}

			// https://github.com/justintv/Twitch-API/blob/master/chat/capabilities.md#notice
			case 'NOTICE': {
				const nullArr = [ null ];
				const noticeArr = [ channel, msgid, msg ];
				const msgidArr = [ msgid ];
				const channelTrueArr = [ channel, true ];
				const channelFalseArr = [ channel, false ];
				const noticeAndNull = [ noticeArr, nullArr ];
				const noticeAndMsgid = [ noticeArr, msgidArr ];
				const basicLog = `[${channel}] ${msg}`;
				switch(msgid) {
					// This room is now in subscribers-only mode.
					case 'subs_on':
						this.log.info(`[${channel}] This room is now in subscribers-only mode.`);
						this.emits([ 'subscriber', 'subscribers', '_promiseSubscribers' ], [ channelTrueArr, channelTrueArr, nullArr ]);
						break;

					// This room is no longer in subscribers-only mode.
					case 'subs_off':
						this.log.info(`[${channel}] This room is no longer in subscribers-only mode.`);
						this.emits([ 'subscriber', 'subscribers', '_promiseSubscribersoff' ], [ channelFalseArr, channelFalseArr, nullArr ]);
						break;

					// This room is now in emote-only mode.
					case 'emote_only_on':
						this.log.info(`[${channel}] This room is now in emote-only mode.`);
						this.emits([ 'emoteonly', '_promiseEmoteonly' ], [ channelTrueArr, nullArr ]);
						break;

					// This room is no longer in emote-only mode.
					case 'emote_only_off':
						this.log.info(`[${channel}] This room is no longer in emote-only mode.`);
						this.emits([ 'emoteonly', '_promiseEmoteonlyoff' ], [ channelFalseArr, nullArr ]);
						break;

					// Do not handle slow_on/off here, listen to the ROOMSTATE notice instead as it returns the delay.
					case 'slow_on':
					case 'slow_off':
						break;

					// Do not handle followers_on/off here, listen to the ROOMSTATE notice instead as it returns the delay.
					case 'followers_on_zero':
					case 'followers_on':
					case 'followers_off':
						break;

					// This room is now in r9k mode.
					case 'r9k_on':
						this.log.info(`[${channel}] This room is now in r9k mode.`);
						this.emits([ 'r9kmode', 'r9kbeta', '_promiseR9kbeta' ], [ channelTrueArr, channelTrueArr, nullArr ]);
						break;

					// This room is no longer in r9k mode.
					case 'r9k_off':
						this.log.info(`[${channel}] This room is no longer in r9k mode.`);
						this.emits([ 'r9kmode', 'r9kbeta', '_promiseR9kbetaoff' ], [ channelFalseArr, channelFalseArr, nullArr ]);
						break;

					// The moderators of this room are: [..., ...]
					case 'room_mods': {
						const listSplit = msg.split(': ');
						const mods = (listSplit.length > 1 ? listSplit[1] : '').toLowerCase()
						.split(', ')
						.filter(n => n);

						this.emits([ '_promiseMods', 'mods' ], [ [ null, mods ], [ channel, mods ] ]);
						break;
					}

					// There are no moderators for this room.
					case 'no_mods':
						this.emits([ '_promiseMods', 'mods' ], [ [ null, [] ], [ channel, [] ] ]);
						break;

					// The VIPs of this channel are: [..., ...]
					case 'vips_success': {
						if(msg.endsWith('.')) {
							msg = msg.slice(0, -1);
						}
						const listSplit = msg.split(': ');
						const vips = (listSplit.length > 1 ? listSplit[1] : '').toLowerCase()
						.split(', ')
						.filter(n => n);

						this.emits([ '_promiseVips', 'vips' ], [ [ null, vips ], [ channel, vips ] ]);
						break;
					}

					// There are no VIPs for this room.
					case 'no_vips':
						this.emits([ '_promiseVips', 'vips' ], [ [ null, [] ], [ channel, [] ] ]);
						break;

					// Ban command failed..
					case 'already_banned':
					case 'bad_ban_admin':
					case 'bad_ban_anon':
					case 'bad_ban_broadcaster':
					case 'bad_ban_global_mod':
					case 'bad_ban_mod':
					case 'bad_ban_self':
					case 'bad_ban_staff':
					case 'usage_ban':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseBan' ], noticeAndMsgid);
						break;

					// Ban command success..
					case 'ban_success':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseBan' ], noticeAndNull);
						break;

					// Clear command failed..
					case 'usage_clear':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseClear' ], noticeAndMsgid);
						break;

					// Mods command failed..
					case 'usage_mods':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseMods' ], [ noticeArr, [ msgid, [] ] ]);
						break;

					// Mod command success..
					case 'mod_success':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseMod' ], noticeAndNull);
						break;

					// VIPs command failed..
					case 'usage_vips':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseVips' ], [ noticeArr, [ msgid, [] ] ]);
						break;

					// VIP command failed..
					case 'usage_vip':
					case 'bad_vip_grantee_banned':
					case 'bad_vip_grantee_already_vip':
					case 'bad_vip_max_vips_reached':
					case 'bad_vip_achievement_incomplete':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseVip' ], [ noticeArr, [ msgid, [] ] ]);
						break;

					// VIP command success..
					case 'vip_success':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseVip' ], noticeAndNull);
						break;

					// Mod command failed..
					case 'usage_mod':
					case 'bad_mod_banned':
					case 'bad_mod_mod':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseMod' ], noticeAndMsgid);
						break;

					// Unmod command success..
					case 'unmod_success':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseUnmod' ], noticeAndNull);
						break;

					// Unvip command success...
					case 'unvip_success':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseUnvip' ], noticeAndNull);
						break;

					// Unmod command failed..
					case 'usage_unmod':
					case 'bad_unmod_mod':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseUnmod' ], noticeAndMsgid);
						break;

					// Unvip command failed..
					case 'usage_unvip':
					case 'bad_unvip_grantee_not_vip':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseUnvip' ], noticeAndMsgid);
						break;

					// Color command success..
					case 'color_changed':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseColor' ], noticeAndNull);
						break;

					// Color command failed..
					case 'usage_color':
					case 'turbo_only_color':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseColor' ], noticeAndMsgid);
						break;

					// Commercial command success..
					case 'commercial_success':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseCommercial' ], noticeAndNull);
						break;

					// Commercial command failed..
					case 'usage_commercial':
					case 'bad_commercial_error':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseCommercial' ], noticeAndMsgid);
						break;

					// Host command success..
					case 'hosts_remaining': {
						this.log.info(basicLog);
						const remainingHost = (!isNaN(msg[0]) ? parseInt(msg[0]) : 0);
						this.emits([ 'notice', '_promiseHost' ], [ noticeArr, [ null, ~~remainingHost ] ]);
						break;
					}

					// Host command failed..
					case 'bad_host_hosting':
					case 'bad_host_rate_exceeded':
					case 'bad_host_error':
					case 'usage_host':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseHost' ], [ noticeArr, [ msgid, null ] ]);
						break;

					// r9kbeta command failed..
					case 'already_r9k_on':
					case 'usage_r9k_on':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseR9kbeta' ], noticeAndMsgid);
						break;

					// r9kbetaoff command failed..
					case 'already_r9k_off':
					case 'usage_r9k_off':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseR9kbetaoff' ], noticeAndMsgid);
						break;

					// Timeout command success..
					case 'timeout_success':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseTimeout' ], noticeAndNull);
						break;

					case 'delete_message_success':
						this.log.info(`[${channel} ${msg}]`);
						this.emits([ 'notice', '_promiseDeletemessage' ], noticeAndNull);
						break;

					// Subscribersoff command failed..
					case 'already_subs_off':
					case 'usage_subs_off':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseSubscribersoff' ], noticeAndMsgid);
						break;

					// Subscribers command failed..
					case 'already_subs_on':
					case 'usage_subs_on':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseSubscribers' ], noticeAndMsgid);
						break;

					// Emoteonlyoff command failed..
					case 'already_emote_only_off':
					case 'usage_emote_only_off':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseEmoteonlyoff' ], noticeAndMsgid);
						break;

					// Emoteonly command failed..
					case 'already_emote_only_on':
					case 'usage_emote_only_on':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseEmoteonly' ], noticeAndMsgid);
						break;

					// Slow command failed..
					case 'usage_slow_on':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseSlow' ], noticeAndMsgid);
						break;

					// Slowoff command failed..
					case 'usage_slow_off':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseSlowoff' ], noticeAndMsgid);
						break;

					// Timeout command failed..
					case 'usage_timeout':
					case 'bad_timeout_admin':
					case 'bad_timeout_anon':
					case 'bad_timeout_broadcaster':
					case 'bad_timeout_duration':
					case 'bad_timeout_global_mod':
					case 'bad_timeout_mod':
					case 'bad_timeout_self':
					case 'bad_timeout_staff':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseTimeout' ], noticeAndMsgid);
						break;

					// Unban command success..
					// Unban can also be used to cancel an active timeout.
					case 'untimeout_success':
					case 'unban_success':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseUnban' ], noticeAndNull);
						break;

					// Unban command failed..
					case 'usage_unban':
					case 'bad_unban_no_ban':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseUnban' ], noticeAndMsgid);
						break;

					// Delete command failed..
					case 'usage_delete':
					case 'bad_delete_message_error':
					case 'bad_delete_message_broadcaster':
					case 'bad_delete_message_mod':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseDeletemessage' ], noticeAndMsgid);
						break;

					// Unhost command failed..
					case 'usage_unhost':
					case 'not_hosting':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseUnhost' ], noticeAndMsgid);
						break;

					// Whisper command failed..
					case 'whisper_invalid_login':
					case 'whisper_invalid_self':
					case 'whisper_limit_per_min':
					case 'whisper_limit_per_sec':
					case 'whisper_restricted':
					case 'whisper_restricted_recipient':
						this.log.info(basicLog);
						this.emits([ 'notice', '_promiseWhisper' ], noticeAndMsgid);
						break;

					// Permission error..
					case 'no_permission':
					case 'msg_banned':
					case 'msg_room_not_found':
					case 'msg_channel_suspended':
					case 'tos_ban':
					case 'invalid_user':
						this.log.info(basicLog);
						this.emits([
							'notice',
							'_promiseBan',
							'_promiseClear',
							'_promiseUnban',
							'_promiseTimeout',
							'_promiseDeletemessage',
							'_promiseMods',
							'_promiseMod',
							'_promiseUnmod',
							'_promiseVips',
							'_promiseVip',
							'_promiseUnvip',
							'_promiseCommercial',
							'_promiseHost',
							'_promiseUnhost',
							'_promiseJoin',
							'_promisePart',
							'_promiseR9kbeta',
							'_promiseR9kbetaoff',
							'_promiseSlow',
							'_promiseSlowoff',
							'_promiseFollowers',
							'_promiseFollowersoff',
							'_promiseSubscribers',
							'_promiseSubscribersoff',
							'_promiseEmoteonly',
							'_promiseEmoteonlyoff',
							'_promiseWhisper'
						], [ noticeArr, [ msgid, channel ] ]);
						break;

					// Automod-related..
					case 'msg_rejected':
					case 'msg_rejected_mandatory':
						this.log.info(basicLog);
						this.emit('automod', channel, msgid, msg);
						break;

					// Unrecognized command..
					case 'unrecognized_cmd':
						this.log.info(basicLog);
						this.emit('notice', channel, msgid, msg);
						break;

					// Send the following msg-ids to the notice event listener..
					case 'cmds_available':
					case 'host_target_went_offline':
					case 'msg_censored_broadcaster':
					case 'msg_duplicate':
					case 'msg_emoteonly':
					case 'msg_verified_email':
					case 'msg_ratelimit':
					case 'msg_subsonly':
					case 'msg_timedout':
					case 'msg_bad_characters':
					case 'msg_channel_blocked':
					case 'msg_facebook':
					case 'msg_followersonly':
					case 'msg_followersonly_followed':
					case 'msg_followersonly_zero':
					case 'msg_slowmode':
					case 'msg_suspended':
					case 'no_help':
					case 'usage_disconnect':
					case 'usage_help':
					case 'usage_me':
					case 'unavailable_command':
						this.log.info(basicLog);
						this.emit('notice', channel, msgid, msg);
						break;

					// Ignore this because we are already listening to HOSTTARGET..
					case 'host_on':
					case 'host_off':
						break;

					default:
						if(msg.includes('Login unsuccessful') || msg.includes('Login authentication failed')) {
							this.wasCloseCalled = false;
							this.reconnect = false;
							this.reason = msg;
							this.log.error(this.reason);
							this.ws.close();
						}
						else if(msg.includes('Error logging in') || msg.includes('Improperly formatted auth')) {
							this.wasCloseCalled = false;
							this.reconnect = false;
							this.reason = msg;
							this.log.error(this.reason);
							this.ws.close();
						}
						else if(msg.includes('Invalid NICK')) {
							this.wasCloseCalled = false;
							this.reconnect = false;
							this.reason = 'Invalid NICK.';
							this.log.error(this.reason);
							this.ws.close();
						}
						else {
							this.log.warn(`Could not parse NOTICE from tmi.twitch.tv:\n${JSON.stringify(message, null, 4)}`);
							this.emit('notice', channel, msgid, msg);
						}
						break;
				}
				break;
			}

			// Handle subanniversary / resub..
			case 'USERNOTICE': {
				const username = tags['display-name'] || tags['login'];
				const plan = tags['msg-param-sub-plan'] || '';
				const planName = _.unescapeIRC(_.get(tags['msg-param-sub-plan-name'], '')) || null;
				const prime = plan.includes('Prime');
				const methods = { prime, plan, planName };
				const streakMonths = ~~(tags['msg-param-streak-months'] || 0);
				const recipient = tags['msg-param-recipient-display-name'] || tags['msg-param-recipient-user-name'];
				const giftSubCount = ~~tags['msg-param-mass-gift-count'];
				tags['message-type'] = msgid;

				switch(msgid) {
					// Handle resub
					case 'resub':
						this.emits([ 'resub', 'subanniversary' ], [
							[ channel, username, streakMonths, msg, tags, methods ]
						]);
						break;

					// Handle sub
					case 'sub':
						this.emits([ 'subscription', 'sub' ], [
							[ channel, username, methods, msg, tags ]
						]);
						break;

					// Handle gift sub
					case 'subgift':
						this.emit('subgift', channel, username, streakMonths, recipient, methods, tags);
						break;

					// Handle anonymous gift sub
					// Need proof that this event occur
					case 'anonsubgift':
						this.emit('anonsubgift', channel, streakMonths, recipient, methods, tags);
						break;

					// Handle random gift subs
					case 'submysterygift':
						this.emit('submysterygift', channel, username, giftSubCount, methods, tags);
						break;

					// Handle anonymous random gift subs
					// Need proof that this event occur
					case 'anonsubmysterygift':
						this.emit('anonsubmysterygift', channel, giftSubCount, methods, tags);
						break;

					// Handle user upgrading from Prime to a normal tier sub
					case 'primepaidupgrade':
						this.emit('primepaidupgrade', channel, username, methods, tags);
						break;

					// Handle user upgrading from a gifted sub
					case 'giftpaidupgrade': {
						const sender = tags['msg-param-sender-name'] || tags['msg-param-sender-login'];
						this.emit('giftpaidupgrade', channel, username, sender, tags);
						break;
					}

					// Handle user upgrading from an anonymous gifted sub
					case 'anongiftpaidupgrade':
						this.emit('anongiftpaidupgrade', channel, username, tags);
						break;

					// Handle raid
					case 'raid': {
						const username = tags['msg-param-displayName'] || tags['msg-param-login'];
						const viewers = +tags['msg-param-viewerCount'];
						this.emit('raided', channel, username, viewers, tags);
						break;
					}
					// Handle ritual
					case 'ritual': {
						const ritualName = tags['msg-param-ritual-name'];
						switch(ritualName) {
							// Handle new chatter ritual
							case 'new_chatter':
								this.emit('newchatter', channel, username, tags, msg);
								break;
							// All unknown rituals should be passed through
							default:
								this.emit('ritual', ritualName, channel, username, tags, msg);
								break;
						}
						break;
					}
					// All other msgid events should be emitted under a usernotice event
					// until it comes up and needs to be added..
					default:
						this.emit('usernotice', msgid, channel, tags, msg);
						break;
				}
				break;
			}

			// Channel is now hosting another channel or exited host mode..
			case 'HOSTTARGET': {
				const msgSplit = msg.split(' ');
				const viewers = ~~msgSplit[1] || 0;
				// Stopped hosting..
				if(msgSplit[0] === '-') {
					this.log.info(`[${channel}] Exited host mode.`);
					this.emits([ 'unhost', '_promiseUnhost' ], [ [ channel, viewers ], [ null ] ]);
				}

				// Now hosting..
				else {
					this.log.info(`[${channel}] Now hosting ${msgSplit[0]} for ${viewers} viewer(s).`);
					this.emit('hosting', channel, msgSplit[0], viewers);
				}
				break;
			}

			// Someone has been timed out or chat has been cleared by a moderator..
			case 'CLEARCHAT':
				// User has been banned / timed out by a moderator..
				if(message.params.length > 1) {
					// Duration returns null if it's a ban, otherwise it's a timeout..
					const duration = _.get(message.tags['ban-duration'], null);

					if(duration === null) {
						this.log.info(`[${channel}] ${msg} has been banned.`);
						this.emit('ban', channel, msg, null, message.tags);
					}
					else {
						this.log.info(`[${channel}] ${msg} has been timed out for ${duration} seconds.`);
						this.emit('timeout', channel, msg, null, ~~duration, message.tags);
					}
				}

				// Chat was cleared by a moderator..
				else {
					this.log.info(`[${channel}] Chat was cleared by a moderator.`);
					this.emits([ 'clearchat', '_promiseClear' ], [ [ channel ], [ null ] ]);
				}
				break;

			// Someone's message has been deleted
			case 'CLEARMSG':
				if(message.params.length > 1) {
					const deletedMessage = msg;
					const username = tags['login'];
					tags['message-type'] = 'messagedeleted';

					this.log.info(`[${channel}] ${username}'s message has been deleted.`);
					this.emit('messagedeleted', channel, username, deletedMessage, tags);
				}
				break;

			// Received a reconnection request from the server..
			case 'RECONNECT':
				this.log.info('Received RECONNECT request from Twitch..');
				this.log.info(`Disconnecting and reconnecting in ${Math.round(this.reconnectTimer / 1000)} seconds..`);
				this.disconnect().catch(err => this.log.error(err));
				setTimeout(() => this.connect().catch(err => this.log.error(err)), this.reconnectTimer);
				break;

			// Received when joining a channel and every time you send a PRIVMSG to a channel.
			case 'USERSTATE':
				message.tags.username = this.username;

				// Add the client to the moderators of this room..
				if(message.tags['user-type'] === 'mod') {
					if(!this.moderators[channel]) {
						this.moderators[channel] = [];
					}
					if(!this.moderators[channel].includes(this.username)) {
						this.moderators[channel].push(this.username);
					}
				}

				// Logged in and username doesn't start with justinfan..
				if(!_.isJustinfan(this.getUsername()) && !this.userstate[channel]) {
					this.userstate[channel] = tags;
					this.lastJoined = channel;
					this.channels.push(channel);
					this.log.info(`Joined ${channel}`);
					this.emit('join', channel, _.username(this.getUsername()), true);
				}

				// Emote-sets has changed, update it..
				if(message.tags['emote-sets'] !== this.emotes) {
					this._updateEmoteset(message.tags['emote-sets']);
				}

				this.userstate[channel] = tags;
				break;

			// Describe non-channel-specific state informations..
			case 'GLOBALUSERSTATE':
				this.globaluserstate = tags;
				this.emit('globaluserstate', tags);

				// Received emote-sets..
				if(typeof message.tags['emote-sets'] !== 'undefined') {
					this._updateEmoteset(message.tags['emote-sets']);
				}
				break;

			// Received when joining a channel and every time one of the chat room settings, like slow mode, change.
			// The message on join contains all room settings.
			case 'ROOMSTATE':
				// We use this notice to know if we successfully joined a channel..
				if(_.channel(this.lastJoined) === channel) { this.emit('_promiseJoin', null, channel); }

				// Provide the channel name in the tags before emitting it..
				message.tags.channel = channel;
				this.emit('roomstate', channel, message.tags);

				if(!_.hasOwn(message.tags, 'subs-only')) {
					// Handle slow mode here instead of the slow_on/off notice..
					// This room is now in slow mode. You may send messages every slow_duration seconds.
					if(_.hasOwn(message.tags, 'slow')) {
						if(typeof message.tags.slow === 'boolean' && !message.tags.slow) {
							const disabled = [ channel, false, 0 ];
							this.log.info(`[${channel}] This room is no longer in slow mode.`);
							this.emits([ 'slow', 'slowmode', '_promiseSlowoff' ], [ disabled, disabled, [ null ] ]);
						}
						else {
							const seconds = ~~message.tags.slow;
							const enabled = [ channel, true, seconds ];
							this.log.info(`[${channel}] This room is now in slow mode.`);
							this.emits([ 'slow', 'slowmode', '_promiseSlow' ], [ enabled, enabled, [ null ] ]);
						}
					}

					// Handle followers only mode here instead of the followers_on/off notice..
					// This room is now in follower-only mode.
					// This room is now in <duration> followers-only mode.
					// This room is no longer in followers-only mode.
					// duration is in minutes (string)
					// -1 when /followersoff (string)
					// false when /followers with no duration (boolean)
					if(_.hasOwn(message.tags, 'followers-only')) {
						if(message.tags['followers-only'] === '-1') {
							const disabled = [ channel, false, 0 ];
							this.log.info(`[${channel}] This room is no longer in followers-only mode.`);
							this.emits([ 'followersonly', 'followersmode', '_promiseFollowersoff' ], [ disabled, disabled, [ null ] ]);
						}
						else {
							const minutes = ~~message.tags['followers-only'];
							const enabled = [ channel, true, minutes ];
							this.log.info(`[${channel}] This room is now in follower-only mode.`);
							this.emits([ 'followersonly', 'followersmode', '_promiseFollowers' ], [ enabled, enabled, [ null ] ]);
						}
					}
				}
				break;

			// Wrong cluster..
			case 'SERVERCHANGE':
				break;

			default:
				this.log.warn(`Could not parse message from tmi.twitch.tv:\n${JSON.stringify(message, null, 4)}`);
				break;
		}
	}


	// Messages from jtv..
	else if(message.prefix === 'jtv') {
		switch(message.command) {
			case 'MODE':
				if(msg === '+o') {
					// Add username to the moderators..
					if(!this.moderators[channel]) {
						this.moderators[channel] = [];
					}
					if(!this.moderators[channel].includes(message.params[2])) {
						this.moderators[channel].push(message.params[2]);
					}

					this.emit('mod', channel, message.params[2]);
				}
				else if(msg === '-o') {
					// Remove username from the moderators..
					if(!this.moderators[channel]) {
						this.moderators[channel] = [];
					}
					this.moderators[channel].filter(value => value !== message.params[2]);

					this.emit('unmod', channel, message.params[2]);
				}
				break;

			default:
				this.log.warn(`Could not parse message from jtv:\n${JSON.stringify(message, null, 4)}`);
				break;
		}
	}


	// Anything else..
	else {
		switch(message.command) {
			case '353':
				this.emit('names', message.params[2], message.params[3].split(' '));
				break;

			case '366':
				break;

			// Someone has joined the channel..
			case 'JOIN': {
				const nick = message.prefix.split('!')[0];
				// Joined a channel as a justinfan (anonymous) user..
				if(_.isJustinfan(this.getUsername()) && this.username === nick) {
					this.lastJoined = channel;
					this.channels.push(channel);
					this.log.info(`Joined ${channel}`);
					this.emit('join', channel, nick, true);
				}

				// Someone else joined the channel, just emit the join event..
				if(this.username !== nick) {
					this.emit('join', channel, nick, false);
				}
				break;
			}

			// Someone has left the channel..
			case 'PART': {
				let isSelf = false;
				const nick = message.prefix.split('!')[0];
				// Client left a channel..
				if(this.username === nick) {
					isSelf = true;
					if(this.userstate[channel]) { delete this.userstate[channel]; }

					let index = this.channels.indexOf(channel);
					if(index !== -1) { this.channels.splice(index, 1); }

					index = this.opts.channels.indexOf(channel);
					if(index !== -1) { this.opts.channels.splice(index, 1); }

					this.log.info(`Left ${channel}`);
					this.emit('_promisePart', null);
				}

				// Client or someone else left the channel, emit the part event..
				this.emit('part', channel, nick, isSelf);
				break;
			}

			// Received a whisper..
			case 'WHISPER': {
				const nick = message.prefix.split('!')[0];
				this.log.info(`[WHISPER] <${nick}>: ${msg}`);

				// Update the tags to provide the username..
				if(!_.hasOwn(message.tags, 'username')) {
					message.tags.username = nick;
				}
				message.tags['message-type'] = 'whisper';

				const from = _.channel(message.tags.username);
				// Emit for both, whisper and message..
				this.emits([ 'whisper', 'message' ], [
					[ from, message.tags, msg, false ]
				]);
				break;
			}

			case 'PRIVMSG':
				// Add username (lowercase) to the tags..
				message.tags.username = message.prefix.split('!')[0];

				// Message from JTV..
				if(message.tags.username === 'jtv') {
					const name = _.username(msg.split(' ')[0]);
					const autohost = msg.includes('auto');
					// Someone is hosting the channel and the message contains how many viewers..
					if(msg.includes('hosting you for')) {
						const count = _.extractNumber(msg);

						this.emit('hosted', channel, name, count, autohost);
					}


					// Some is hosting the channel, but no viewer(s) count provided in the message..
					else if(msg.includes('hosting you')) {
						this.emit('hosted', channel, name, 0, autohost);
					}
				}

				else {
					const messagesLogLevel = _.get(this.opts.options.messagesLogLevel, 'info');

					// Message is an action (/me <message>)..
					const actionMessage = _.actionMessage(msg);
					message.tags['message-type'] = actionMessage ? 'action' : 'chat';
					msg = actionMessage ? actionMessage[1] : msg;
					// Check for Bits prior to actions message
					if(_.hasOwn(message.tags, 'bits')) {
						this.emit('cheer', channel, message.tags, msg);
					}
					else {
						//Handle Channel Point Redemptions (Require's Text Input)
						if(_.hasOwn(message.tags, 'msg-id')) {
							if(message.tags['msg-id'] === 'highlighted-message') {
								const rewardtype = message.tags['msg-id'];
								this.emit('redeem', channel, message.tags.username, rewardtype, message.tags, msg);
							}
							else if(message.tags['msg-id'] === 'skip-subs-mode-message') {
								const rewardtype = message.tags['msg-id'];
								this.emit('redeem', channel, message.tags.username, rewardtype, message.tags, msg);
							}
						}
						else if(_.hasOwn(message.tags, 'custom-reward-id')) {
							const rewardtype = message.tags['custom-reward-id'];
							this.emit('redeem', channel, message.tags.username, rewardtype, message.tags, msg);
						}
						if(actionMessage) {
							this.log[messagesLogLevel](`[${channel}] *<${message.tags.username}>: ${msg}`);
							this.emits([ 'action', 'message' ], [
								[ channel, message.tags, msg, false ]
							]);
						}

						// Message is a regular chat message..
						else {
							this.log[messagesLogLevel](`[${channel}] <${message.tags.username}>: ${msg}`);
							this.emits([ 'chat', 'message' ], [
								[ channel, message.tags, msg, false ]
							]);
						}
					}
				}
				break;

			default:
				this.log.warn(`Could not parse message:\n${JSON.stringify(message, null, 4)}`);
				break;
		}
	}
};
// Connect to server..
client.prototype.connect = function connect() {
	return new Promise((resolve, reject) => {
		this.server = _.get(this.opts.connection.server, 'irc-ws.chat.twitch.tv');
		this.port = _.get(this.opts.connection.port, 80);

		// Override port if using a secure connection..
		if(this.secure) { this.port = 443; }
		if(this.port === 443) { this.secure = true; }

		this.reconnectTimer = this.reconnectTimer * this.reconnectDecay;
		if(this.reconnectTimer >= this.maxReconnectInterval) {
			this.reconnectTimer = this.maxReconnectInterval;
		}

		// Connect to server from configuration..
		this._openConnection();
		this.once('_promiseConnect', err => {
			if(!err) { resolve([ this.server, ~~this.port ]); }
			else { reject(err); }
		});
	});
};
// Open a connection..
client.prototype._openConnection = function _openConnection() {
	const url = `${this.secure ? 'wss' : 'ws'}://${this.server}:${this.port}/`;
	/** @type {import('ws').ClientOptions} */
	const connectionOptions = {};
	if('agent' in this.opts.connection) {
		connectionOptions.agent = this.opts.connection.agent;
	}
	this.ws = new _WebSocket(url, 'irc', connectionOptions);

	this.ws.onmessage = this._onMessage.bind(this);
	this.ws.onerror = this._onError.bind(this);
	this.ws.onclose = this._onClose.bind(this);
	this.ws.onopen = this._onOpen.bind(this);
};
// Called when the WebSocket connection's readyState changes to OPEN.
// Indicates that the connection is ready to send and receive data..
client.prototype._onOpen = function _onOpen() {
	if(!this._isConnected()) {
		return;
	}

	// Emitting "connecting" event..
	this.log.info(`Connecting to ${this.server} on port ${this.port}..`);
	this.emit('connecting', this.server, ~~this.port);

	this.username = _.get(this.opts.identity.username, _.justinfan());
	this._getToken()
	.then(token => {
		const password = _.password(token);

		// Emitting "logon" event..
		this.log.info('Sending authentication to server..');
		this.emit('logon');

		let caps = 'twitch.tv/tags twitch.tv/commands';
		if(!this._skipMembership) {
			caps += ' twitch.tv/membership';
		}
		this.ws.send('CAP REQ :' + caps);

		// Authentication..
		if(password) {
			this.ws.send(`PASS ${password}`);
		}
		else if(_.isJustinfan(this.username)) {
			this.ws.send('PASS SCHMOOPIIE');
		}
		this.ws.send(`NICK ${this.username}`);
	})
	.catch(err => {
		this.emits([ '_promiseConnect', 'disconnected' ], [ [ err ], [ 'Could not get a token.' ] ]);
	});
};
// Fetches a token from the option.
client.prototype._getToken = function _getToken() {
	const passwordOption = this.opts.identity.password;
	let password;
	if(typeof passwordOption === 'function') {
		password = passwordOption();
		if(password instanceof Promise) {
			return password;
		}
		return Promise.resolve(password);
	}
	return Promise.resolve(passwordOption);
};
// Called when a message is received from the server..
client.prototype._onMessage = function _onMessage(event) {
	const parts = event.data.trim().split('\r\n');

	parts.forEach(str => {
		const msg = parse.msg(str);
		if(msg) {
			this.handleMessage(msg);
		}
	});
};
// Called when an error occurs..
client.prototype._onError = function _onError() {
	this.moderators = {};
	this.userstate = {};
	this.globaluserstate = {};

	// Stop the internal ping timeout check interval..
	clearInterval(this.pingLoop);
	clearTimeout(this.pingTimeout);
	clearTimeout(this._updateEmotesetsTimer);

	this.reason = this.ws === null ? 'Connection closed.' : 'Unable to connect.';

	this.emits([ '_promiseConnect', 'disconnected' ], [ [ this.reason ] ]);

	// Reconnect to server..
	if(this.reconnect && this.reconnections === this.maxReconnectAttempts) {
		this.emit('maxreconnect');
		this.log.error('Maximum reconnection attempts reached.');
	}
	if(this.reconnect && !this.reconnecting && this.reconnections <= this.maxReconnectAttempts - 1) {
		this.reconnecting = true;
		this.reconnections = this.reconnections + 1;
		this.log.error(`Reconnecting in ${Math.round(this.reconnectTimer / 1000)} seconds..`);
		this.emit('reconnect');
		setTimeout(() => {
			this.reconnecting = false;
			this.connect().catch(err => this.log.error(err));
		}, this.reconnectTimer);
	}

	this.ws = null;
};
// Called when the WebSocket connection's readyState changes to CLOSED..
client.prototype._onClose = function _onClose() {
	this.moderators = {};
	this.userstate = {};
	this.globaluserstate = {};

	// Stop the internal ping timeout check interval..
	clearInterval(this.pingLoop);
	clearTimeout(this.pingTimeout);
	clearTimeout(this._updateEmotesetsTimer);

	// User called .disconnect(), don't try to reconnect.
	if(this.wasCloseCalled) {
		this.wasCloseCalled = false;
		this.reason = 'Connection closed.';
		this.log.info(this.reason);
		this.emits([ '_promiseConnect', '_promiseDisconnect', 'disconnected' ], [ [ this.reason ], [ null ], [ this.reason ] ]);
	}

	// Got disconnected from server..
	else {
		this.emits([ '_promiseConnect', 'disconnected' ], [ [ this.reason ] ]);

		// Reconnect to server..
		if(this.reconnect && this.reconnections === this.maxReconnectAttempts) {
			this.emit('maxreconnect');
			this.log.error('Maximum reconnection attempts reached.');
		}
		if(this.reconnect && !this.reconnecting && this.reconnections <= this.maxReconnectAttempts - 1) {
			this.reconnecting = true;
			this.reconnections = this.reconnections + 1;
			this.log.error(`Could not connect to server. Reconnecting in ${Math.round(this.reconnectTimer / 1000)} seconds..`);
			this.emit('reconnect');
			setTimeout(() => {
				this.reconnecting = false;
				this.connect().catch(err => this.log.error(err));
			}, this.reconnectTimer);
		}
	}

	this.ws = null;
};
// Minimum of 600ms for command promises, if current latency exceeds, add 100ms to it to make sure it doesn't get timed out..
client.prototype._getPromiseDelay = function _getPromiseDelay() {
	if(this.currentLatency <= 600) { return 600; }
	else { return this.currentLatency + 100; }
};
// Send command to server or channel..
client.prototype._sendCommand = function _sendCommand(delay, channel, command, fn) {
	// Race promise against delay..
	return new Promise((resolve, reject) => {
		// Make sure the socket is opened..
		if(!this._isConnected()) {
			// Disconnected from server..
			return reject('Not connected to server.');
		}
		else if(delay === null || typeof delay === 'number') {
			if(delay === null) {
				delay = this._getPromiseDelay();
			}
			_.promiseDelay(delay).then(() => reject('No response from Twitch.'));
		}

		// Executing a command on a channel..
		if(channel !== null) {
			const chan = _.channel(channel);
			this.log.info(`[${chan}] Executing command: ${command}`);
			this.ws.send(`PRIVMSG ${chan} :${command}`);
		}
		// Executing a raw command..
		else {
			this.log.info(`Executing command: ${command}`);
			this.ws.send(command);
		}
		if(typeof fn === 'function') {
			fn(resolve, reject);
		}
		else {
			resolve();
		}
	});
};
// Send a message to channel..
client.prototype._sendMessage = function _sendMessage(delay, channel, message, fn) {
	// Promise a result..
	return new Promise((resolve, reject) => {
		// Make sure the socket is opened and not logged in as a justinfan user..
		if(!this._isConnected()) {
			return reject('Not connected to server.');
		}
		else if(_.isJustinfan(this.getUsername())) {
			return reject('Cannot send anonymous messages.');
		}
		const chan = _.channel(channel);
		if(!this.userstate[chan]) { this.userstate[chan] = {}; }

		// Split long lines otherwise they will be eaten by the server..
		if(message.length >= 500) {
			const msg = _.splitLine(message, 500);
			message = msg[0];

			setTimeout(() => {
				this._sendMessage(delay, channel, msg[1], () => {});
			}, 350);
		}

		this.ws.send(`PRIVMSG ${chan} :${message}`);

		const emotes = {};

		// Parse regex and string emotes..
		Object.keys(this.emotesets).forEach(id => this.emotesets[id].forEach(emote => {
			const emoteFunc = _.isRegex(emote.code) ? parse.emoteRegex : parse.emoteString;
			return emoteFunc(message, emote.code, emote.id, emotes);
		})
		);

		// Merge userstate with parsed emotes..
		const userstate = Object.assign(
			this.userstate[chan],
			parse.emotes({ emotes: parse.transformEmotes(emotes) || null })
		);

		const messagesLogLevel = _.get(this.opts.options.messagesLogLevel, 'info');

		// Message is an action (/me <message>)..
		const actionMessage = _.actionMessage(message);
		if(actionMessage) {
			userstate['message-type'] = 'action';
			this.log[messagesLogLevel](`[${chan}] *<${this.getUsername()}>: ${actionMessage[1]}`);
			this.emits([ 'action', 'message' ], [
				[ chan, userstate, actionMessage[1], true ]
			]);
		}


		// Message is a regular chat message..
		else {
			userstate['message-type'] = 'chat';
			this.log[messagesLogLevel](`[${chan}] <${this.getUsername()}>: ${message}`);
			this.emits([ 'chat', 'message' ], [
				[ chan, userstate, message, true ]
			]);
		}
		if(typeof fn === 'function') {
			fn(resolve, reject);
		}
		else {
			resolve();
		}
	});
};
// Grab the emote-sets object from the API..
client.prototype._updateEmoteset = function _updateEmoteset(sets) {
	let setsChanges = sets !== undefined;
	if(setsChanges) {
		if(sets === this.emotes) {
			setsChanges = false;
		}
		else {
			this.emotes = sets;
		}
	}
	if(this._skipUpdatingEmotesets) {
		if(setsChanges) {
			this.emit('emotesets', sets, {});
		}
		return;
	}
	const setEmotesetTimer = () => {
		if(this._updateEmotesetsTimerDelay > 0) {
			clearTimeout(this._updateEmotesetsTimer);
			this._updateEmotesetsTimer = setTimeout(() => this._updateEmoteset(sets), this._updateEmotesetsTimerDelay);
		}
	};
	this._getToken()
	.then(token => {
		const url = `https://api.twitch.tv/kraken/chat/emoticon_images?emotesets=${sets}`;
		/** @type {import('node-fetch').RequestInit} */
		const fetchOptions = {};
		if('fetchAgent' in this.opts.connection) {
			fetchOptions.agent = this.opts.connection.fetchAgent;
		}
		/** @type {import('node-fetch').Response} */
		return _fetch(url, {
			...fetchOptions,
			headers: {
				'Accept': 'application/vnd.twitchtv.v5+json',
				'Authorization': `OAuth ${_.token(token)}`,
				'Client-ID': this.clientId
			}
		});
	})
	.then(res => res.json())
	.then(data => {
		this.emotesets = data.emoticon_sets || {};
		this.emit('emotesets', sets, this.emotesets);
		setEmotesetTimer();
	})
	.catch(() => setEmotesetTimer());
};
// Get current username..
client.prototype.getUsername = function getUsername() {
	return this.username;
};
// Get current options..
client.prototype.getOptions = function getOptions() {
	return this.opts;
};
// Get current channels..
client.prototype.getChannels = function getChannels() {
	return this.channels;
};
// Check if username is a moderator on a channel..
client.prototype.isMod = function isMod(channel, username) {
	const chan = _.channel(channel);
	if(!this.moderators[chan]) { this.moderators[chan] = []; }
	return this.moderators[chan].includes(_.username(username));
};
// Get readyState..
client.prototype.readyState = function readyState() {
	if(this.ws === null) { return 'CLOSED'; }
	return [ 'CONNECTING', 'OPEN', 'CLOSING', 'CLOSED' ][this.ws.readyState];
};
// Determine if the client has a WebSocket and it's open..
client.prototype._isConnected = function _isConnected() {
	return this.ws !== null && this.ws.readyState === 1;
};
// Disconnect from server..
client.prototype.disconnect = function disconnect() {
	return new Promise((resolve, reject) => {
		if(this.ws !== null && this.ws.readyState !== 3) {
			this.wasCloseCalled = true;
			this.log.info('Disconnecting from server..');
			this.ws.close();
			this.once('_promiseDisconnect', () => resolve([ this.server, ~~this.port ]));
		}
		else {
			this.log.error('Cannot disconnect from server. Socket is not opened or connection is already closing.');
			reject('Cannot disconnect from server. Socket is not opened or connection is already closing.');
		}
	});
};
client.prototype.off = client.prototype.removeListener;

// Expose everything, for browser and Node..
if( true && module.exports) {
	module.exports = client;
}
if(typeof window !== 'undefined') {
	window.tmi = {
		client,
		Client: client
	};
}


/***/ }),

/***/ "./node_modules/tmi.js/lib/commands.js":
/*!*********************************************!*\
  !*** ./node_modules/tmi.js/lib/commands.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const _ = __webpack_require__(/*! ./utils */ "./node_modules/tmi.js/lib/utils.js");

// Enable followers-only mode on a channel..
function followersonly(channel, minutes) {
	channel = _.channel(channel);
	minutes = _.get(minutes, 30);
	// Send the command to the server and race the Promise against a delay..
	return this._sendCommand(null, channel, `/followers ${minutes}`, (resolve, reject) => {
		// Received _promiseFollowers event, resolve or reject..
		this.once('_promiseFollowers', err => {
			if(!err) { resolve([ channel, ~~minutes ]); }
			else { reject(err); }
		});
	});
}

// Disable followers-only mode on a channel..
function followersonlyoff(channel) {
	channel = _.channel(channel);
	// Send the command to the server and race the Promise against a delay..
	return this._sendCommand(null, channel, '/followersoff', (resolve, reject) => {
		// Received _promiseFollowersoff event, resolve or reject..
		this.once('_promiseFollowersoff', err => {
			if(!err) { resolve([ channel ]); }
			else { reject(err); }
		});
	});
}

// Leave a channel..
function part(channel) {
	channel = _.channel(channel);
	// Send the command to the server and race the Promise against a delay..
	return this._sendCommand(null, null, `PART ${channel}`, (resolve, reject) => {
		// Received _promisePart event, resolve or reject..
		this.once('_promisePart', err => {
			if(!err) { resolve([ channel ]); }
			else { reject(err); }
		});
	});
}

// Enable R9KBeta mode on a channel..
function r9kbeta(channel) {
	channel = _.channel(channel);
	// Send the command to the server and race the Promise against a delay..
	return this._sendCommand(null, channel, '/r9kbeta', (resolve, reject) => {
		// Received _promiseR9kbeta event, resolve or reject..
		this.once('_promiseR9kbeta', err => {
			if(!err) { resolve([ channel ]); }
			else { reject(err); }
		});
	});
}

// Disable R9KBeta mode on a channel..
function r9kbetaoff(channel) {
	channel = _.channel(channel);
	// Send the command to the server and race the Promise against a delay..
	return this._sendCommand(null, channel, '/r9kbetaoff', (resolve, reject) => {
		// Received _promiseR9kbetaoff event, resolve or reject..
		this.once('_promiseR9kbetaoff', err => {
			if(!err) { resolve([ channel ]); }
			else { reject(err); }
		});
	});
}

// Enable slow mode on a channel..
function slow(channel, seconds) {
	channel = _.channel(channel);
	seconds = _.get(seconds, 300);
	// Send the command to the server and race the Promise against a delay..
	return this._sendCommand(null, channel, `/slow ${seconds}`, (resolve, reject) => {
		// Received _promiseSlow event, resolve or reject..
		this.once('_promiseSlow', err => {
			if(!err) { resolve([ channel, ~~seconds ]); }
			else { reject(err); }
		});
	});
}

// Disable slow mode on a channel..
function slowoff(channel) {
	channel = _.channel(channel);
	// Send the command to the server and race the Promise against a delay..
	return this._sendCommand(null, channel, '/slowoff', (resolve, reject) => {
		// Received _promiseSlowoff event, resolve or reject..
		this.once('_promiseSlowoff', err => {
			if(!err) { resolve([ channel ]); }
			else { reject(err); }
		});
	});
}

module.exports = {
	// Send action message (/me <message>) on a channel..
	action(channel, message) {
		channel = _.channel(channel);
		message = `\u0001ACTION ${message}\u0001`;
		// Send the command to the server and race the Promise against a delay..
		return this._sendMessage(this._getPromiseDelay(), channel, message, (resolve, _reject) => {
			// At this time, there is no possible way to detect if a message has been sent has been eaten
			// by the server, so we can only resolve the Promise.
			resolve([ channel, message ]);
		});
	},

	// Ban username on channel..
	ban(channel, username, reason) {
		channel = _.channel(channel);
		username = _.username(username);
		reason = _.get(reason, '');
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, `/ban ${username} ${reason}`, (resolve, reject) => {
			// Received _promiseBan event, resolve or reject..
			this.once('_promiseBan', err => {
				if(!err) { resolve([ channel, username, reason ]); }
				else { reject(err); }
			});
		});
	},

	// Clear all messages on a channel..
	clear(channel) {
		channel = _.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, '/clear', (resolve, reject) => {
			// Received _promiseClear event, resolve or reject..
			this.once('_promiseClear', err => {
				if(!err) { resolve([ channel ]); }
				else { reject(err); }
			});
		});
	},

	// Change the color of your username..
	color(channel, newColor) {
		newColor = _.get(newColor, channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, '#tmijs', `/color ${newColor}`, (resolve, reject) => {
			// Received _promiseColor event, resolve or reject..
			this.once('_promiseColor', err => {
				if(!err) { resolve([ newColor ]); }
				else { reject(err); }
			});
		});
	},

	// Run commercial on a channel for X seconds..
	commercial(channel, seconds) {
		channel = _.channel(channel);
		seconds = _.get(seconds, 30);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, `/commercial ${seconds}`, (resolve, reject) => {
			// Received _promiseCommercial event, resolve or reject..
			this.once('_promiseCommercial', err => {
				if(!err) { resolve([ channel, ~~seconds ]); }
				else { reject(err); }
			});
		});
	},
	
	// Delete a specific message on a channel
	deletemessage(channel, messageUUID) {
		channel = _.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, `/delete ${messageUUID}`, (resolve, reject) => {
			// Received _promiseDeletemessage event, resolve or reject..
			this.once('_promiseDeletemessage', err => {
				if(!err) { resolve([ channel ]); }
				else { reject(err); }
			});
		});
	},

	// Enable emote-only mode on a channel..
	emoteonly(channel) {
		channel = _.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, '/emoteonly', (resolve, reject) => {
			// Received _promiseEmoteonly event, resolve or reject..
			this.once('_promiseEmoteonly', err => {
				if(!err) { resolve([ channel ]); }
				else { reject(err); }
			});
		});
	},

	// Disable emote-only mode on a channel..
	emoteonlyoff(channel) {
		channel = _.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, '/emoteonlyoff', (resolve, reject) => {
			// Received _promiseEmoteonlyoff event, resolve or reject..
			this.once('_promiseEmoteonlyoff', err => {
				if(!err) { resolve([ channel ]); }
				else { reject(err); }
			});
		});
	},

	// Enable followers-only mode on a channel..
	followersonly,

	// Alias for followersonly()..
	followersmode: followersonly,

	// Disable followers-only mode on a channel..
	followersonlyoff,

	// Alias for followersonlyoff()..
	followersmodeoff: followersonlyoff,

	// Host a channel..
	host(channel, target) {
		channel = _.channel(channel);
		target = _.username(target);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(2000, channel, `/host ${target}`, (resolve, reject) => {
			// Received _promiseHost event, resolve or reject..
			this.once('_promiseHost', (err, remaining) => {
				if(!err) { resolve([ channel, target, ~~remaining ]); }
				else { reject(err); }
			});
		});
	},

	// Join a channel..
	join(channel) {
		channel = _.channel(channel);
		// Send the command to the server ..
		return this._sendCommand(undefined, null, `JOIN ${channel}`, (resolve, reject) => {
			const eventName = '_promiseJoin';
			let hasFulfilled = false;
			const listener = (err, joinedChannel) => {
				if(channel === _.channel(joinedChannel)) {
					// Received _promiseJoin event for the target channel, resolve or reject..
					this.removeListener(eventName, listener);
					hasFulfilled = true;
					if(!err) { resolve([ channel ]); }
					else { reject(err); }
				}
			};
			this.on(eventName, listener);
			// Race the Promise against a delay..
			const delay = this._getPromiseDelay();
			_.promiseDelay(delay).then(() => {
				if(!hasFulfilled) {
					this.emit(eventName, 'No response from Twitch.', channel);
				}
			});
		});
	},

	// Mod username on channel..
	mod(channel, username) {
		channel = _.channel(channel);
		username = _.username(username);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, `/mod ${username}`, (resolve, reject) => {
			// Received _promiseMod event, resolve or reject..
			this.once('_promiseMod', err => {
				if(!err) { resolve([ channel, username ]); }
				else { reject(err); }
			});
		});
	},

	// Get list of mods on a channel..
	mods(channel) {
		channel = _.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, '/mods', (resolve, reject) => {
			// Received _promiseMods event, resolve or reject..
			this.once('_promiseMods', (err, mods) => {
				if(!err) {
					// Update the internal list of moderators..
					mods.forEach(username => {
						if(!this.moderators[channel]) { this.moderators[channel] = []; }
						if(!this.moderators[channel].includes(username)) { this.moderators[channel].push(username); }
					});
					resolve(mods);
				}
				else { reject(err); }
			});
		});
	},

	// Leave a channel..
	part,

	// Alias for part()..
	leave: part,

	// Send a ping to the server..
	ping() {
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, null, 'PING', (resolve, _reject) => {
			// Update the internal ping timeout check interval..
			this.latency = new Date();
			this.pingTimeout = setTimeout(() => {
				if(this.ws !== null) {
					this.wasCloseCalled = false;
					this.log.error('Ping timeout.');
					this.ws.close();

					clearInterval(this.pingLoop);
					clearTimeout(this.pingTimeout);
				}
			}, _.get(this.opts.connection.timeout, 9999));

			// Received _promisePing event, resolve or reject..
			this.once('_promisePing', latency => resolve([ parseFloat(latency) ]));
		});
	},

	// Enable R9KBeta mode on a channel..
	r9kbeta,

	// Alias for r9kbeta()..
	r9kmode: r9kbeta,

	// Disable R9KBeta mode on a channel..
	r9kbetaoff,

	// Alias for r9kbetaoff()..
	r9kmodeoff: r9kbetaoff,

	// Send a raw message to the server..
	raw(message) {
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, null, message, (resolve, _reject) => {
			resolve([ message ]);
		});
	},

	// Send a message on a channel..
	say(channel, message) {
		channel = _.channel(channel);

		if((message.startsWith('.') && !message.startsWith('..')) || message.startsWith('/') || message.startsWith('\\')) {
			// Check if the message is an action message..
			if(message.substr(1, 3) === 'me ') {
				return this.action(channel, message.substr(4));
			}
			else {
				// Send the command to the server and race the Promise against a delay..
				return this._sendCommand(null, channel, message, (resolve, _reject) => {
					// At this time, there is no possible way to detect if a message has been sent has been eaten
					// by the server, so we can only resolve the Promise.
					resolve([ channel, message ]);
				});
			}
		}
		// Send the command to the server and race the Promise against a delay..
		return this._sendMessage(this._getPromiseDelay(), channel, message, (resolve, _reject) => {
			// At this time, there is no possible way to detect if a message has been sent has been eaten
			// by the server, so we can only resolve the Promise.
			resolve([ channel, message ]);
		});
	},

	// Enable slow mode on a channel..
	slow,

	// Alias for slow()..
	slowmode: slow,

	// Disable slow mode on a channel..
	slowoff,

	// Alias for slowoff()..
	slowmodeoff: slowoff,

	// Enable subscribers mode on a channel..
	subscribers(channel) {
		channel = _.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, '/subscribers', (resolve, reject) => {
			// Received _promiseSubscribers event, resolve or reject..
			this.once('_promiseSubscribers', err => {
				if(!err) { resolve([ channel ]); }
				else { reject(err); }
			});
		});
	},

	// Disable subscribers mode on a channel..
	subscribersoff(channel) {
		channel = _.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, '/subscribersoff', (resolve, reject) => {
			// Received _promiseSubscribersoff event, resolve or reject..
			this.once('_promiseSubscribersoff', err => {
				if(!err) { resolve([ channel ]); }
				else { reject(err); }
			});
		});
	},

	// Timeout username on channel for X seconds..
	timeout(channel, username, seconds, reason) {
		channel = _.channel(channel);
		username = _.username(username);

		if(seconds !== null && !_.isInteger(seconds)) {
			reason = seconds;
			seconds = 300;
		}

		seconds = _.get(seconds, 300);
		reason = _.get(reason, '');
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, `/timeout ${username} ${seconds} ${reason}`, (resolve, reject) => {
			// Received _promiseTimeout event, resolve or reject..
			this.once('_promiseTimeout', err => {
				if(!err) { resolve([ channel, username, ~~seconds, reason ]); }
				else { reject(err); }
			});
		});
	},

	// Unban username on channel..
	unban(channel, username) {
		channel = _.channel(channel);
		username = _.username(username);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, `/unban ${username}`, (resolve, reject) => {
			// Received _promiseUnban event, resolve or reject..
			this.once('_promiseUnban', err => {
				if(!err) { resolve([ channel, username ]); }
				else { reject(err); }
			});
		});
	},

	// End the current hosting..
	unhost(channel) {
		channel = _.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(2000, channel, '/unhost', (resolve, reject) => {
			// Received _promiseUnhost event, resolve or reject..
			this.once('_promiseUnhost', err => {
				if(!err) { resolve([ channel ]); }
				else { reject(err); }
			});
		});
	},

	// Unmod username on channel..
	unmod(channel, username) {
		channel = _.channel(channel);
		username = _.username(username);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, `/unmod ${username}`, (resolve, reject) => {
			// Received _promiseUnmod event, resolve or reject..
			this.once('_promiseUnmod', err => {
				if(!err) { resolve([ channel, username ]); }
				else { reject(err); }
			});
		});
	},

	// Unvip username on channel..
	unvip(channel, username) {
		channel = _.channel(channel);
		username = _.username(username);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, `/unvip ${username}`, (resolve, reject) => {
			// Received _promiseUnvip event, resolve or reject..
			this.once('_promiseUnvip', err => {
				if(!err) { resolve([ channel, username ]); }
				else { reject(err); }
			});
		});
	},

	// Add username to VIP list on channel..
	vip(channel, username) {
		channel = _.channel(channel);
		username = _.username(username);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, `/vip ${username}`, (resolve, reject) => {
			// Received _promiseVip event, resolve or reject..
			this.once('_promiseVip', err => {
				if(!err) { resolve([ channel, username ]); }
				else { reject(err); }
			});
		});
	},

	// Get list of VIPs on a channel..
	vips(channel) {
		channel = _.channel(channel);
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, channel, '/vips', (resolve, reject) => {
			// Received _promiseVips event, resolve or reject..
			this.once('_promiseVips', (err, vips) => {
				if(!err) { resolve(vips); }
				else { reject(err); }
			});
		});
	},

	// Send an whisper message to a user..
	whisper(username, message) {
		username = _.username(username);

		// The server will not send a whisper to the account that sent it.
		if(username === this.getUsername()) {
			return Promise.reject('Cannot send a whisper to the same account.');
		}
		// Send the command to the server and race the Promise against a delay..
		return this._sendCommand(null, '#tmijs', `/w ${username} ${message}`, (_resolve, reject) => {
			this.once('_promiseWhisper', err => {
				if (err) { reject(err); }
			});
		}).catch(err => {
			// Either an "actual" error occured or the timeout triggered
			// the latter means no errors have occured and we can resolve
			// else just elevate the error
			if(err && typeof err === 'string' && err.indexOf('No response from Twitch.') !== 0) {
				throw err;
			}
			const from = _.channel(username);
			const userstate = Object.assign({
				'message-type': 'whisper',
				'message-id': null,
				'thread-id': null,
				username: this.getUsername()
			}, this.globaluserstate);

			// Emit for both, whisper and message..
			this.emits([ 'whisper', 'message' ], [
				[ from, userstate, message, true ],
				[ from, userstate, message, true ]
			]);
			return [ username, message ];
		});
	}
};


/***/ }),

/***/ "./node_modules/tmi.js/lib/events.js":
/*!*******************************************!*\
  !*** ./node_modules/tmi.js/lib/events.js ***!
  \*******************************************/
/***/ ((module) => {

/* istanbul ignore file */
/* eslint-disable */
/*
 * Copyright Joyent, Inc. and other Node contributors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
 * NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

function EventEmitter() {
	this._events = this._events || {};
	this._maxListeners = this._maxListeners || undefined;
}

module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
	if (!isNumber(n) || n < 0 || isNaN(n)) {
		throw TypeError("n must be a positive number");
	}

	this._maxListeners = n;

	return this;
};

EventEmitter.prototype.emit = function(type) {
	var er, handler, len, args, i, listeners;

	if (!this._events) { this._events = {}; }

	// If there is no 'error' event listener then throw.
	if (type === "error") {
		if (!this._events.error || (isObject(this._events.error) && !this._events.error.length)) {
			er = arguments[1];
			if (er instanceof Error) { throw er; }
			throw TypeError("Uncaught, unspecified \"error\" event.");
		}
	}

	handler = this._events[type];

	if (isUndefined(handler)) { return false; }

	if (isFunction(handler)) {
		switch (arguments.length) {
			// fast cases
			case 1:
				handler.call(this);
				break;
			case 2:
				handler.call(this, arguments[1]);
				break;
			case 3:
				handler.call(this, arguments[1], arguments[2]);
				break;
				// slower
			default:
				args = Array.prototype.slice.call(arguments, 1);
				handler.apply(this, args);
		}
	} else if (isObject(handler)) {
		args = Array.prototype.slice.call(arguments, 1);
		listeners = handler.slice();
		len = listeners.length;
		for (i = 0; i < len; i++) { listeners[i].apply(this, args); }
	}

	return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
	var m;

	if (!isFunction(listener)) { throw TypeError("listener must be a function"); }

	if (!this._events) { this._events = {}; }

	// To avoid recursion in the case that type === "newListener"! Before
	// adding it to the listeners, first emit "newListener".
	if (this._events.newListener) {
		this.emit("newListener", type, isFunction(listener.listener) ? listener.listener : listener);
	}

	// Optimize the case of one listener. Don't need the extra array object.
	if (!this._events[type]) { this._events[type] = listener; }
	// If we've already got an array, just append.
	else if (isObject(this._events[type])) { this._events[type].push(listener); }
	// Adding the second element, need to change to array.
	else { this._events[type] = [this._events[type], listener]; }

	// Check for listener leak
	if (isObject(this._events[type]) && !this._events[type].warned) {
		if (!isUndefined(this._maxListeners)) {
			m = this._maxListeners;
		} else {
			m = EventEmitter.defaultMaxListeners;
		}

		if (m && m > 0 && this._events[type].length > m) {
			this._events[type].warned = true;
			console.error("(node) warning: possible EventEmitter memory leak detected. %d listeners added. Use emitter.setMaxListeners() to increase limit.", this._events[type].length);
			// Not supported in IE 10
			if (typeof console.trace === "function") {
				console.trace();
			}
		}
	}

	return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

// Modified to support multiple calls..
EventEmitter.prototype.once = function(type, listener) {
	if (!isFunction(listener)) { throw TypeError("listener must be a function"); }

	var fired = false;

	if (this._events.hasOwnProperty(type) && type.charAt(0) === "_") {
		var count = 1;
		var searchFor = type;

		for (var k in this._events){
			if (this._events.hasOwnProperty(k) && k.startsWith(searchFor)) {
				count++;
			}
		}
		type = type + count;
	}

	function g() {
		if (type.charAt(0) === "_" && !isNaN(type.substr(type.length - 1))) {
			type = type.substring(0, type.length - 1);
		}
		this.removeListener(type, g);

		if (!fired) {
			fired = true;
			listener.apply(this, arguments);
		}
	}

	g.listener = listener;
	this.on(type, g);

	return this;
};

// Emits a "removeListener" event if the listener was removed..
// Modified to support multiple calls from .once()..
EventEmitter.prototype.removeListener = function(type, listener) {
	var list, position, length, i;

	if (!isFunction(listener)) { throw TypeError("listener must be a function"); }

	if (!this._events || !this._events[type]) { return this; }

	list = this._events[type];
	length = list.length;
	position = -1;
	if (list === listener || (isFunction(list.listener) && list.listener === listener)) {
		delete this._events[type];

		if (this._events.hasOwnProperty(type + "2") && type.charAt(0) === "_") {
			var searchFor = type;
			for (var k in this._events){
				if (this._events.hasOwnProperty(k) && k.startsWith(searchFor)) {
					if (!isNaN(parseInt(k.substr(k.length - 1)))) {
						this._events[type + parseInt(k.substr(k.length - 1) - 1)] = this._events[k];
						delete this._events[k];
					}
				}
			}

			this._events[type] = this._events[type + "1"];
			delete this._events[type + "1"];
		}
		if (this._events.removeListener) { this.emit("removeListener", type, listener); }
	}
	else if (isObject(list)) {
		for (i = length; i-- > 0;) {
			if (list[i] === listener ||
				(list[i].listener && list[i].listener === listener)) {
				position = i;
				break;
			}
		}

		if (position < 0) { return this; }

		if (list.length === 1) {
			list.length = 0;
			delete this._events[type];
		}
		else { list.splice(position, 1); }

		if (this._events.removeListener) { this.emit("removeListener", type, listener); }
	}

	return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
	var key, listeners;

	if (!this._events) { return this; }

	// not listening for removeListener, no need to emit
	if (!this._events.removeListener) {
		if (arguments.length === 0) { this._events = {}; }
		else if (this._events[type]) { delete this._events[type]; }
		return this;
	}

	// emit removeListener for all listeners on all events
	if (arguments.length === 0) {
		for (key in this._events) {
			if (key === "removeListener") { continue; }
			this.removeAllListeners(key);
		}
		this.removeAllListeners("removeListener");
		this._events = {};
		return this;
	}

	listeners = this._events[type];

	if (isFunction(listeners)) { this.removeListener(type, listeners); }
	else if (listeners) { while (listeners.length) { this.removeListener(type, listeners[listeners.length - 1]); } }
	delete this._events[type];

	return this;
};

EventEmitter.prototype.listeners = function(type) {
	var ret;
	if (!this._events || !this._events[type]) { ret = []; }
	else if (isFunction(this._events[type])) { ret = [this._events[type]]; }
	else { ret = this._events[type].slice(); }
	return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
	if (this._events) {
		var evlistener = this._events[type];

		if (isFunction(evlistener)) { return 1; }
		else if (evlistener) { return evlistener.length; }
	}
	return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
	return emitter.listenerCount(type);
};

function isFunction(arg) {
	return typeof arg === "function";
}

function isNumber(arg) {
	return typeof arg === "number";
}

function isObject(arg) {
	return typeof arg === "object" && arg !== null;
}

function isUndefined(arg) {
	return arg === void 0;
}


/***/ }),

/***/ "./node_modules/tmi.js/lib/logger.js":
/*!*******************************************!*\
  !*** ./node_modules/tmi.js/lib/logger.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const _ = __webpack_require__(/*! ./utils */ "./node_modules/tmi.js/lib/utils.js");

let currentLevel = 'info';
const levels = { 'trace': 0, 'debug': 1, 'info': 2, 'warn': 3, 'error': 4, 'fatal': 5 };

// Logger implementation..
function log(level) {
	// Return a console message depending on the logging level..
	return function(message) {
		if(levels[level] >= levels[currentLevel]) {
			console.log(`[${_.formatDate(new Date())}] ${level}: ${message}`);
		}
	};
}

module.exports = {
	// Change the current logging level..
	setLevel(level) {
		currentLevel = level;
	},
	trace: log('trace'),
	debug: log('debug'),
	info: log('info'),
	warn: log('warn'),
	error: log('error'),
	fatal: log('fatal')
};


/***/ }),

/***/ "./node_modules/tmi.js/lib/parser.js":
/*!*******************************************!*\
  !*** ./node_modules/tmi.js/lib/parser.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/*
	Copyright (c) 2013-2015, Fionn Kelleher All rights reserved.

	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:

		Redistributions of source code must retain the above copyright notice,
		this list of conditions and the following disclaimer.

		Redistributions in binary form must reproduce the above copyright notice,
		this list of conditions and the following disclaimer in the documentation and/or other materials
		provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
	IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
	INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
	OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
	WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
	ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY
	OF SUCH DAMAGE.
*/
const _ = __webpack_require__(/*! ./utils */ "./node_modules/tmi.js/lib/utils.js");
const nonspaceRegex = /\S+/g;

function parseComplexTag(tags, tagKey, splA = ',', splB = '/', splC) {
	const raw = tags[tagKey];
	
	if(raw === undefined) {
		return tags;
	}

	const tagIsString = typeof raw === 'string';
	tags[tagKey + '-raw'] = tagIsString ? raw : null;

	if(raw === true) {
		tags[tagKey] = null;
		return tags;
	}

	tags[tagKey] = {};

	if(tagIsString) {
		const spl = raw.split(splA);

		for (let i = 0; i < spl.length; i++) {
			const parts = spl[i].split(splB);
			let val = parts[1];
			if(splC !== undefined && val) {
				val = val.split(splC);
			}
			tags[tagKey][parts[0]] = val || null;
		}
	}
	return tags;
}

module.exports = {
	// Parse Twitch badges..
	badges: tags => parseComplexTag(tags, 'badges'),

	// Parse Twitch badge-info..
	badgeInfo: tags => parseComplexTag(tags, 'badge-info'),

	// Parse Twitch emotes..
	emotes: tags => parseComplexTag(tags, 'emotes', '/', ':', ','),

	// Parse regex emotes..
	emoteRegex(msg, code, id, obj) {
		nonspaceRegex.lastIndex = 0;
		const regex = new RegExp('(\\b|^|\\s)' + _.unescapeHtml(code) + '(\\b|$|\\s)');
		let match;

		// Check if emote code matches using RegExp and push it to the object..
		while ((match = nonspaceRegex.exec(msg)) !== null) {
			if(regex.test(match[0])) {
				obj[id] = obj[id] || [];
				obj[id].push([ match.index, nonspaceRegex.lastIndex - 1 ]);
			}
		}
	},

	// Parse string emotes..
	emoteString(msg, code, id, obj) {
		nonspaceRegex.lastIndex = 0;
		let match;

		// Check if emote code matches and push it to the object..
		while ((match = nonspaceRegex.exec(msg)) !== null) {
			if(match[0] === _.unescapeHtml(code)) {
				obj[id] = obj[id] || [];
				obj[id].push([ match.index, nonspaceRegex.lastIndex - 1 ]);
			}
		}
	},

	// Transform the emotes object to a string with the following format..
	// emote_id:first_index-last_index,another_first-another_last/another_emote_id:first_index-last_index
	transformEmotes(emotes) {
		let transformed = '';

		Object.keys(emotes).forEach(id => {
			transformed = `${transformed+id}:`;
			emotes[id].forEach(
				index => transformed = `${transformed+index.join('-')},`
			);
			transformed = `${transformed.slice(0, -1)}/`;
		});
		return transformed.slice(0, -1);
	},

	formTags(tags) {
		const result = [];
		for(const key in tags) {
			const value = _.escapeIRC(tags[key]);
			result.push(`${key}=${value}`);
		}
		return `@${result.join(';')}`;
	},

	// Parse Twitch messages..
	msg(data) {
		const message = {
			raw: data,
			tags: {},
			prefix: null,
			command: null,
			params: []
		};

		// Position and nextspace are used by the parser as a reference..
		let position = 0;
		let nextspace = 0;

		// The first thing we check for is IRCv3.2 message tags.
		// http://ircv3.atheme.org/specification/message-tags-3.2
		if(data.charCodeAt(0) === 64) {
			nextspace = data.indexOf(' ');

			// Malformed IRC message..
			if(nextspace === -1) {
				return null;
			}

			// Tags are split by a semi colon..
			const rawTags = data.slice(1, nextspace).split(';');

			for (let i = 0; i < rawTags.length; i++) {
				// Tags delimited by an equals sign are key=value tags.
				// If there's no equals, we assign the tag a value of true.
				const tag = rawTags[i];
				const pair = tag.split('=');
				message.tags[pair[0]] = tag.substring(tag.indexOf('=') + 1) || true;
			}

			position = nextspace + 1;
		}

		// Skip any trailing whitespace..
		while (data.charCodeAt(position) === 32) {
			position++;
		}

		// Extract the message's prefix if present. Prefixes are prepended with a colon..
		if(data.charCodeAt(position) === 58) {
			nextspace = data.indexOf(' ', position);

			// If there's nothing after the prefix, deem this message to be malformed.
			if(nextspace === -1) {
				return null;
			}

			message.prefix = data.slice(position + 1, nextspace);
			position = nextspace + 1;

			// Skip any trailing whitespace..
			while (data.charCodeAt(position) === 32) {
				position++;
			}
		}

		nextspace = data.indexOf(' ', position);

		// If there's no more whitespace left, extract everything from the
		// current position to the end of the string as the command..
		if(nextspace === -1) {
			if(data.length > position) {
				message.command = data.slice(position);
				return message;
			}
			return null;
		}

		// Else, the command is the current position up to the next space. After
		// that, we expect some parameters.
		message.command = data.slice(position, nextspace);

		position = nextspace + 1;

		// Skip any trailing whitespace..
		while (data.charCodeAt(position) === 32) {
			position++;
		}

		while (position < data.length) {
			nextspace = data.indexOf(' ', position);

			// If the character is a colon, we've got a trailing parameter.
			// At this point, there are no extra params, so we push everything
			// from after the colon to the end of the string, to the params array
			// and break out of the loop.
			if(data.charCodeAt(position) === 58) {
				message.params.push(data.slice(position + 1));
				break;
			}

			// If we still have some whitespace...
			if(nextspace !== -1) {
				// Push whatever's between the current position and the next
				// space to the params array.
				message.params.push(data.slice(position, nextspace));
				position = nextspace + 1;

				// Skip any trailing whitespace and continue looping.
				while (data.charCodeAt(position) === 32) {
					position++;
				}

				continue;
			}

			// If we don't have any more whitespace and the param isn't trailing,
			// push everything remaining to the params array.
			if(nextspace === -1) {
				message.params.push(data.slice(position));
				break;
			}
		}
		return message;
	}
};


/***/ }),

/***/ "./node_modules/tmi.js/lib/timer.js":
/*!******************************************!*\
  !*** ./node_modules/tmi.js/lib/timer.js ***!
  \******************************************/
/***/ ((module) => {

// Initialize the queue with a specific delay..
class Queue {
	constructor(defaultDelay) {
		this.queue = [];
		this.index = 0;
		this.defaultDelay = defaultDelay === undefined ? 3000 : defaultDelay;
	}
	// Add a new function to the queue..
	add(fn, delay) {
		this.queue.push({ fn, delay });
	}
	// Go to the next in queue..
	next() {
		const i = this.index++;
		const at = this.queue[i];
		if(!at) {
			return;
		}
		const next = this.queue[this.index];
		at.fn();
		if(next) {
			const delay = next.delay === undefined ? this.defaultDelay : next.delay;
			setTimeout(() => this.next(), delay);
		}
	}
}

module.exports = Queue;


/***/ }),

/***/ "./node_modules/tmi.js/lib/utils.js":
/*!******************************************!*\
  !*** ./node_modules/tmi.js/lib/utils.js ***!
  \******************************************/
/***/ ((module) => {

// eslint-disable-next-line no-control-regex
const actionMessageRegex = /^\u0001ACTION ([^\u0001]+)\u0001$/;
const justinFanRegex = /^(justinfan)(\d+$)/;
const unescapeIRCRegex = /\\([sn:r\\])/g;
const escapeIRCRegex = /([ \n;\r\\])/g;
const ircEscapedChars = { s: ' ', n: '', ':': ';', r: '' };
const ircUnescapedChars = { ' ': 's', '\n': 'n', ';': ':', '\r': 'r' };
const urlRegex = new RegExp('^(?:(?:https?|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?!(?:10|127)(?:\\.\\d{1,3}){3})(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))\\.?)(?::\\d{2,5})?(?:[/?#]\\S*)?$', 'i');
const regexEmoteRegex = /[|\\^$*+?:#]/;
const _ = module.exports = {
	// Return the second value if the first value is undefined..
	get: (a, b) => typeof a === 'undefined' ? b : a,

	// Indirectly use hasOwnProperty
	hasOwn: (obj, key) => ({}).hasOwnProperty.call(obj, key),

	// Race a promise against a delay..
	promiseDelay: time => new Promise(resolve => setTimeout(resolve, time)),

	// Value is a finite number..
	isFinite: int => isFinite(int) && !isNaN(parseFloat(int)),

	// Parse string to number. Returns NaN if string can't be parsed to number..
	toNumber(num, precision) {
		if(num === null) {
			return 0;
		}
		const factor = Math.pow(10, _.isFinite(precision) ? precision : 0);
		return Math.round(num * factor) / factor;
	},

	// Value is an integer..
	isInteger: int => !isNaN(_.toNumber(int, 0)),

	// Value is a regex..
	isRegex: str => regexEmoteRegex.test(str),

	// Value is a valid url..
	isURL: str => urlRegex.test(str),

	// Return a random justinfan username..
	justinfan: () => `justinfan${Math.floor((Math.random() * 80000) + 1000)}`,

	// Username is a justinfan username..
	isJustinfan: username => justinFanRegex.test(username),

	// Return a valid channel name..
	channel(str) {
		const channel = (str ? str : '').toLowerCase();
		return channel[0] === '#' ? channel : '#' + channel;
	},

	// Return a valid username..
	username(str) {
		const username = (str ? str : '').toLowerCase();
		return username[0] === '#' ? username.slice(1) : username;
	},

	// Return a valid token..
	token: str => str ? str.toLowerCase().replace('oauth:', '') : '',

	// Return a valid password..
	password(str) {
		const token = _.token(str);
		return token ? `oauth:${token}` : '';
	},

	actionMessage: msg => msg.match(actionMessageRegex),

	// Replace all occurences of a string using an object..
	replaceAll(str, obj) {
		if(str === null || typeof str === 'undefined') {
			return null;
		}
		for (const x in obj) {
			str = str.replace(new RegExp(x, 'g'), obj[x]);
		}
		return str;
	},

	unescapeHtml: safe =>
		safe.replace(/\\&amp\\;/g, '&')
		.replace(/\\&lt\\;/g, '<')
		.replace(/\\&gt\\;/g, '>')
		.replace(/\\&quot\\;/g, '"')
		.replace(/\\&#039\\;/g, '\''),

	// Escaping values:
	// http://ircv3.net/specs/core/message-tags-3.2.html#escaping-values
	unescapeIRC(msg) {
		if(!msg || typeof msg !== 'string' || !msg.includes('\\')) {
			return msg;
		}
		return msg.replace(
			unescapeIRCRegex,
			(m, p) => p in ircEscapedChars ? ircEscapedChars[p] : p
		);
	},
	
	escapeIRC(msg) {
		if(!msg || typeof msg !== 'string') {
			return msg;
		}
		return msg.replace(
			escapeIRCRegex,
			(m, p) => p in ircUnescapedChars ? `\\${ircUnescapedChars[p]}` : p
		);
	},

	// Add word to a string..
	addWord: (line, word) => line.length ? line + ' ' + word : line + word,

	// Split a line but try not to cut a word in half..
	splitLine(input, length) {
		let lastSpace = input.substring(0, length).lastIndexOf(' ');
		// No spaces found, split at the very end to avoid a loop..
		if(lastSpace === -1) {
			lastSpace = length - 1;
		}
		return [ input.substring(0, lastSpace), input.substring(lastSpace + 1) ];
	},

	// Extract a number from a string..
	extractNumber(str) {
		const parts = str.split(' ');
		for (let i = 0; i < parts.length; i++) {
			if(_.isInteger(parts[i])) {
				return ~~parts[i];
			}
		}
		return 0;
	},

	// Format the date..
	formatDate(date) {
		let hours = date.getHours();
		let mins  = date.getMinutes();

		hours = (hours < 10 ? '0' : '') + hours;
		mins = (mins < 10 ? '0' : '') + mins;
		return `${hours}:${mins}`;
	},

	// Inherit the prototype methods from one constructor into another..
	inherits(ctor, superCtor) {
		ctor.super_ = superCtor;
		const TempCtor = function () {};
		TempCtor.prototype = superCtor.prototype;
		ctor.prototype = new TempCtor();
		ctor.prototype.constructor = ctor;
	},

	// Return whether inside a Node application or not..
	isNode() {
		try {
			return typeof process === 'object' &&
				Object.prototype.toString.call(process) === '[object process]';
		} catch(e) {}
		return false;
	}
};


/***/ }),

/***/ "./src/animation.ts":
/*!**************************!*\
  !*** ./src/animation.ts ***!
  \**************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AnimationController = void 0;
const vector_1 = __webpack_require__(/*! ./vector */ "./src/vector.ts");
class AnimationController {
    constructor(animations) {
        this.animations = animations;
        this.currentTime = 0;
        this.nameCurrentAnimation = "";
        this.currentFrameIndex = 0;
    }
    updateAnimation(deltaTime) {
        const frame = this.currentFrame;
        this.currentTime += deltaTime;
        if (this.currentTime >= frame.holdTime) {
            const animation = this.currentAnimation;
            this.currentFrameIndex = (this.currentFrameIndex + 1) % animation.frames.length;
            this.currentTime = 0;
        }
    }
    changeAnimation(newAnimation) {
        if (this.nameCurrentAnimation.length > 0) {
            this.currentTime = 0;
            this.currentFrameIndex = 0;
        }
        this.nameCurrentAnimation = newAnimation;
    }
    get clip() {
        const frame = this.currentFrame;
        return {
            position: new vector_1.Vector(frame.x, frame.y),
            size: new vector_1.Vector(frame.w, frame.h),
        };
    }
    get currentAnimation() {
        return this.animations[this.nameCurrentAnimation];
    }
    get currentFrame() {
        const currentAnimation = this.currentAnimation;
        return currentAnimation.frames[this.currentFrameIndex];
    }
}
exports.AnimationController = AnimationController;


/***/ }),

/***/ "./src/bubble.ts":
/*!***********************!*\
  !*** ./src/bubble.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SpeechBubble = void 0;
const vector_1 = __webpack_require__(/*! ./vector */ "./src/vector.ts");
class SpeechBubble {
    constructor(content, track, offset) {
        this.track = track;
        this.offset = offset;
        this.kill = false;
        this.element = document.createElement("div");
        this.element.classList.add("bubble", "medium", "bottom");
        this.element.innerText = content;
        this.element.style.opacity = "1";
        this.updatePosition();
        document.getElementsByTagName("body")[0].appendChild(this.element);
        setTimeout(() => {
            let interval = setInterval(() => {
                let currentOpacity = this.opacity - 0.1;
                this.element.style.opacity = `${currentOpacity}`;
                if (this.shouldStartFading) {
                    this.kill = true;
                    clearInterval(interval);
                }
            }, 50);
        }, 5000);
    }
    updatePosition() {
        const actualPosition = this.track.add(this.offset);
        actualPosition.x -= this.size.x / 4;
        this.element.style.left = `${actualPosition.x}px`;
        this.element.style.top = `${actualPosition.y}px`;
    }
    addOffset(offset) {
        this.offset.inplaceAdd(offset);
    }
    deleteElement() {
        this.element.remove();
    }
    get size() {
        return new vector_1.Vector(this.element.offsetWidth, this.element.offsetHeight);
    }
    get layer() {
        const index = parseInt(this.element.style.zIndex) || 0;
        return index;
    }
    get opacity() {
        let opacity = parseFloat(this.element.style.opacity);
        if (isNaN(opacity))
            opacity = 1;
        return opacity;
    }
    get shouldKill() {
        return this.kill;
    }
    get shouldStartFading() {
        const opacity = this.opacity;
        return opacity <= 0;
    }
    set layer(newLayer) {
        this.element.style.zIndex = `${newLayer}`;
    }
}
exports.SpeechBubble = SpeechBubble;


/***/ }),

/***/ "./src/dotfan.ts":
/*!***********************!*\
  !*** ./src/dotfan.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DotFan = void 0;
const bubble_1 = __webpack_require__(/*! ./bubble */ "./src/bubble.ts");
const vector_1 = __webpack_require__(/*! ./vector */ "./src/vector.ts");
const VELOCITY = new vector_1.Vector(50, 0);
class DotFan {
    constructor(sprite, animationController) {
        this.sprite = sprite;
        this.animationController = animationController;
        this.bubbles = [];
        const posYSpawn = 0;
        this.position = new vector_1.Vector(window.innerWidth * Math.random(), posYSpawn);
        this.animationController.changeAnimation("andando"); // TODO: mudar isso pra caso tenha mais de uma animação
        this.flipped = Math.random() >= 0.5;
        if (this.flipped)
            this.sprite.flip();
    }
    addMessage(content) {
        let offset = new vector_1.Vector(0, -this.sprite.size.y);
        let newBubble = new bubble_1.SpeechBubble(content, this.position, offset);
        for (let bubble of this.bubbles) {
            offset.y += -bubble.size.y;
            bubble.layer = bubble.layer + 1;
        }
        this.bubbles.push(newBubble);
    }
    update(deltaTime) {
        this.animationController.updateAnimation(deltaTime);
        if (Math.random() >= 0.995) {
            this.sprite.flip();
            this.flipped = !this.flipped;
        }
        let actualVelocity = VELOCITY.multiplyScalar(deltaTime);
        if (this.flipped)
            actualVelocity.inplaceMultiplyScalar(-1);
        this.position.inplaceAdd(actualVelocity);
        this.sprite.clip = this.animationController.clip;
        this.sprite.position = this.position;
        for (let i = 0; i < this.bubbles.length; i++) {
            const bubble = this.bubbles[i];
            bubble.updatePosition();
            if (bubble.shouldKill) {
                for (let j = i + 1; j < this.bubbles.length; j++) {
                    const updatingBubble = this.bubbles[j];
                    updatingBubble.addOffset(new vector_1.Vector(0, bubble.size.y));
                }
                bubble.deleteElement();
                this.bubbles.splice(i, 1);
                i--;
            }
        }
    }
    draw(ctx) {
        this.sprite.draw(ctx);
    }
}
exports.DotFan = DotFan;


/***/ }),

/***/ "./src/load-data.ts":
/*!**************************!*\
  !*** ./src/load-data.ts ***!
  \**************************/
/***/ (function(__unused_webpack_module, exports) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SpriteInfoLoader = void 0;
class SpriteInfoLoader {
    constructor() {
        this.pathes = [];
        this.animationDatabases = [];
        this.currentIndex = 0;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            yield fetch("./database.json")
                .then(r => r.json())
                .then(r => {
                let jsonData = r.sprites;
                for (let json of jsonData) {
                    console.log(json);
                    this.pathes.push(json.path);
                    let database = {};
                    for (let teste of json.animations) {
                        database[teste.name] = { frames: [] };
                        database[teste.name].frames = teste.frames;
                    }
                    this.animationDatabases.push(database);
                }
                console.log(this.pathes, this.animationDatabases);
            });
        });
    }
    getRandomNumber(max) {
        return Math.floor(Math.random() * max);
    }
    selectRandomSprite() {
        this.currentIndex = this.getRandomNumber(this.pathes.length);
    }
    get path() {
        return this.pathes[this.currentIndex];
    }
    get animationDatabase() {
        return this.animationDatabases[this.currentIndex];
    }
}
exports.SpriteInfoLoader = SpriteInfoLoader;


/***/ }),

/***/ "./src/main.ts":
/*!*********************!*\
  !*** ./src/main.ts ***!
  \*********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const tmi = __importStar(__webpack_require__(/*! tmi.js */ "./node_modules/tmi.js/index.js"));
const load_data_1 = __webpack_require__(/*! ./load-data */ "./src/load-data.ts");
const animation_1 = __webpack_require__(/*! ./animation */ "./src/animation.ts");
const dotfan_1 = __webpack_require__(/*! ./dotfan */ "./src/dotfan.ts");
const vector_1 = __webpack_require__(/*! ./vector */ "./src/vector.ts");
const sprite_1 = __webpack_require__(/*! ./sprite */ "./src/sprite.ts");
const client = new tmi.Client({
    channels: ['vinidotruan']
});
client.connect();
client.on('message', (channel, tags, message, self) => {
    console.log(`${tags['display-name']}: ${message}`);
});
const loadedData = new load_data_1.SpriteInfoLoader();
loadedData.load().then(() => {
    var _a;
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx === null)
        throw "Foda";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false;
    let fans = [];
    for (let i = 0; i < 10; i++) {
        loadedData.selectRandomSprite();
        let fan = new dotfan_1.DotFan(new sprite_1.Sprite(loadedData.path, {
            position: new vector_1.Vector(0, 0),
            size: new vector_1.Vector(64, 64)
        }), new animation_1.AnimationController(loadedData.animationDatabase));
        fans.push(fan);
    }
    // Main Loop
    let tempoAntigo = Date.now();
    setInterval(() => {
        let tempoAtual = Date.now();
        let deltaTime = (tempoAtual - tempoAntigo) / 1000;
        tempoAntigo = tempoAtual;
        // Update Sprites
        for (let fan of fans)
            fan.update(deltaTime);
        // Draw Everything
        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
        for (let fan of fans)
            fan.draw(ctx);
    }, 1 / 60);
    (_a = document.querySelector("#falar")) === null || _a === void 0 ? void 0 : _a.addEventListener("click", () => {
        let fan = fans[Math.floor(Math.random() * fans.length)];
        fan.addMessage("Mensagem de texto testavel testada");
    });
});


/***/ }),

/***/ "./src/sprite.ts":
/*!***********************!*\
  !*** ./src/sprite.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Sprite = void 0;
const vector_1 = __webpack_require__(/*! ./vector */ "./src/vector.ts");
class Sprite {
    constructor(path, transform) {
        this.transform = transform;
        this.flipped = false;
        this.image = new Image();
        this.image.src = path;
        this.currentClip = {
            position: new vector_1.Vector(0, 0),
            size: new vector_1.Vector(this.image.width, this.image.height)
        };
    }
    flip() {
        this.flipped = !this.flipped;
    }
    set clip(newClip) {
        this.currentClip = newClip;
    }
    set position(newPosition) {
        this.transform.position.x = newPosition.x;
        this.transform.position.y = newPosition.y;
    }
    get size() {
        return this.transform.size;
    }
    draw(ctx) {
        if (this.flipped) {
            ctx.translate(this.transform.size.x, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(this.image, this.currentClip.position.x, this.currentClip.position.y, this.currentClip.size.x, this.currentClip.size.y, (this.flipped) ? -this.transform.position.x : this.transform.position.x, this.transform.position.y, this.transform.size.x, this.transform.size.y);
        if (this.flipped) {
            ctx.translate(this.transform.size.x, 0);
            ctx.scale(-1, 1);
        }
    }
}
exports.Sprite = Sprite;


/***/ }),

/***/ "./src/vector.ts":
/*!***********************!*\
  !*** ./src/vector.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Vector = void 0;
class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    // Original methods returning new instances
    // Addition
    add(other) {
        return new Vector(this.x + other.x, this.y + other.y);
    }
    // Subtraction
    subtract(other) {
        return new Vector(this.x - other.x, this.y - other.y);
    }
    // Multiplication by scalar
    multiplyScalar(scalar) {
        return new Vector(this.x * scalar, this.y * scalar);
    }
    // Division by scalar
    divideScalar(scalar) {
        if (scalar === 0) {
            throw new Error("Division by zero");
        }
        return new Vector(this.x / scalar, this.y / scalar);
    }
    // New methods modifying the instance itself
    // In-place addition
    inplaceAdd(other) {
        this.x += other.x;
        this.y += other.y;
        return this;
    }
    // In-place subtraction
    inplaceSubtract(other) {
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }
    // In-place multiplication by scalar
    inplaceMultiplyScalar(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }
    // In-place division by scalar
    inplaceDivideScalar(scalar) {
        if (scalar === 0) {
            throw new Error("Division by zero");
        }
        this.x /= scalar;
        this.y /= scalar;
        return this;
    }
}
exports.Vector = Vector;


/***/ }),

/***/ "?641d":
/*!****************************!*\
  !*** node-fetch (ignored) ***!
  \****************************/
/***/ (() => {

/* (ignored) */

/***/ }),

/***/ "?6264":
/*!********************!*\
  !*** ws (ignored) ***!
  \********************/
/***/ (() => {

/* (ignored) */

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/main.ts");
/******/ 	
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esd0JBQXdCLFNBQVMsRUFBRSxJQUFJO0FBQ3ZDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9FQUFvRSxpQ0FBaUM7QUFDckc7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBc0I7QUFDdEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdUJBQXVCLFFBQVE7QUFDL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHVCQUF1QixRQUFRLGdCQUFnQixhQUFhLE1BQU0sU0FBUztBQUMzRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHdCQUF3QixRQUFRLElBQUksS0FBSztBQUN6QztBQUNBO0FBQ0E7QUFDQSx3QkFBd0IsUUFBUSxJQUFJLEtBQUsseUJBQXlCLFVBQVU7QUFDNUU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdUJBQXVCLFFBQVE7QUFDL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHVCQUF1QixRQUFRLElBQUksU0FBUztBQUM1QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHVEQUF1RCx3Q0FBd0M7QUFDL0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDZCQUE2QixRQUFRO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpREFBaUQ7QUFDakQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlCQUF5QixRQUFRO0FBQ2pDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx5QkFBeUIsUUFBUTtBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EseUJBQXlCLFFBQVE7QUFDakM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlCQUF5QixRQUFRO0FBQ2pDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrRUFBa0UsaUNBQWlDO0FBQ25HO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx3REFBd0QsaUNBQWlDO0FBQ3pGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsNkJBQTZCLFFBQVE7QUFDckM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1DQUFtQztBQUNuQztBQUNBO0FBQ0Esd0JBQXdCO0FBQ3hCO0FBQ0E7QUFDQSx3QkFBd0I7QUFDeEI7QUFDQSwyQkFBMkIsUUFBUTtBQUNuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0NBQWdDLEtBQUssS0FBSyxJQUFJO0FBQzlDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQ0FBc0MsUUFBUSxNQUFNLHNCQUFzQixLQUFLLElBQUk7QUFDbkY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQ0FBc0MsUUFBUSxLQUFLLHNCQUFzQixLQUFLLElBQUk7QUFDbEY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsK0NBQStDLGlDQUFpQztBQUNoRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0JBQW9CO0FBQ3BCLDBCQUEwQjtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxjQUFjO0FBQ2QsVUFBVTtBQUNWLEdBQUc7QUFDSCxFQUFFO0FBQ0Y7QUFDQTtBQUNBO0FBQ0EsZ0JBQWdCLDJCQUEyQixLQUFLLFlBQVksR0FBRyxVQUFVO0FBQ3pFLFlBQVksNEJBQTRCO0FBQ3hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0NBQWdDLGFBQWEsVUFBVSxVQUFVO0FBQ2pFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esd0JBQXdCLFNBQVM7QUFDakM7QUFDQTtBQUNBO0FBQ0E7QUFDQSx1QkFBdUIsY0FBYztBQUNyQyxFQUFFO0FBQ0Y7QUFDQTtBQUNBLEVBQUU7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9DQUFvQyx3Q0FBd0M7QUFDNUU7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtFQUFrRSx3Q0FBd0M7QUFDMUc7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQ0FBa0M7QUFDbEMsUUFBUTtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxQkFBcUIsS0FBSyx1QkFBdUIsUUFBUTtBQUN6RCwyQkFBMkIsTUFBTSxHQUFHLFFBQVE7QUFDNUM7QUFDQTtBQUNBO0FBQ0EsdUNBQXVDLFFBQVE7QUFDL0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUU7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDhCQUE4QjtBQUM5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNEQUFzRDtBQUN0RCxJQUFJO0FBQ0o7QUFDQTtBQUNBLDBCQUEwQixNQUFNLEdBQUcsUUFBUTtBQUMzQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWtCLCtDQUErQztBQUNqRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0NBQWtDLEtBQUssTUFBTSxtQkFBbUIsS0FBSyxpQkFBaUI7QUFDdEY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0NBQWtDLEtBQUssS0FBSyxtQkFBbUIsS0FBSyxRQUFRO0FBQzVFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQ0FBa0M7QUFDbEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDZFQUE2RSxLQUFLO0FBQ2xGLGFBQWEsa0NBQWtDO0FBQy9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBYSwrQkFBK0I7QUFDNUM7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4QkFBOEIsZUFBZTtBQUM3QztBQUNBO0FBQ0EsR0FBRztBQUNILEVBQUU7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4QkFBOEI7QUFDOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQSx3QkFBd0I7QUFDeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFFO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHLEtBQTZCO0FBQ2hDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7O0FDOStDQSxVQUFVLG1CQUFPLENBQUMsbURBQVM7O0FBRTNCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx1REFBdUQsUUFBUTtBQUMvRDtBQUNBO0FBQ0EsY0FBYztBQUNkLFVBQVU7QUFDVixHQUFHO0FBQ0gsRUFBRTtBQUNGOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYztBQUNkLFVBQVU7QUFDVixHQUFHO0FBQ0gsRUFBRTtBQUNGOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsOENBQThDLFFBQVE7QUFDdEQ7QUFDQTtBQUNBLGNBQWM7QUFDZCxVQUFVO0FBQ1YsR0FBRztBQUNILEVBQUU7QUFDRjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWM7QUFDZCxVQUFVO0FBQ1YsR0FBRztBQUNILEVBQUU7QUFDRjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWM7QUFDZCxVQUFVO0FBQ1YsR0FBRztBQUNILEVBQUU7QUFDRjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0RBQWtELFFBQVE7QUFDMUQ7QUFDQTtBQUNBLGNBQWM7QUFDZCxVQUFVO0FBQ1YsR0FBRztBQUNILEVBQUU7QUFDRjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWM7QUFDZCxVQUFVO0FBQ1YsR0FBRztBQUNILEVBQUU7QUFDRjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDRCQUE0QixRQUFRO0FBQ3BDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsRUFBRTs7QUFFRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrREFBa0QsVUFBVSxFQUFFLE9BQU87QUFDckU7QUFDQTtBQUNBLGVBQWU7QUFDZixXQUFXO0FBQ1gsSUFBSTtBQUNKLEdBQUc7QUFDSCxFQUFFOztBQUVGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZUFBZTtBQUNmLFdBQVc7QUFDWCxJQUFJO0FBQ0osR0FBRztBQUNILEVBQUU7O0FBRUY7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxREFBcUQsU0FBUztBQUM5RDtBQUNBO0FBQ0EsZUFBZTtBQUNmLFdBQVc7QUFDWCxJQUFJO0FBQ0osR0FBRztBQUNILEVBQUU7O0FBRUY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlEQUF5RCxRQUFRO0FBQ2pFO0FBQ0E7QUFDQSxlQUFlO0FBQ2YsV0FBVztBQUNYLElBQUk7QUFDSixHQUFHO0FBQ0gsRUFBRTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxREFBcUQsWUFBWTtBQUNqRTtBQUNBO0FBQ0EsZUFBZTtBQUNmLFdBQVc7QUFDWCxJQUFJO0FBQ0osR0FBRztBQUNILEVBQUU7O0FBRUY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxlQUFlO0FBQ2YsV0FBVztBQUNYLElBQUk7QUFDSixHQUFHO0FBQ0gsRUFBRTs7QUFFRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGVBQWU7QUFDZixXQUFXO0FBQ1gsSUFBSTtBQUNKLEdBQUc7QUFDSCxFQUFFOztBQUVGO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1EQUFtRCxPQUFPO0FBQzFEO0FBQ0E7QUFDQSxlQUFlO0FBQ2YsV0FBVztBQUNYLElBQUk7QUFDSixHQUFHO0FBQ0gsRUFBRTs7QUFFRjtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9EQUFvRCxRQUFRO0FBQzVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0JBQWdCO0FBQ2hCLFlBQVk7QUFDWjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJO0FBQ0osR0FBRztBQUNILEVBQUU7O0FBRUY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtEQUFrRCxTQUFTO0FBQzNEO0FBQ0E7QUFDQSxlQUFlO0FBQ2YsV0FBVztBQUNYLElBQUk7QUFDSixHQUFHO0FBQ0gsRUFBRTs7QUFFRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNDQUFzQztBQUN0Qyx5REFBeUQ7QUFDekQsTUFBTTtBQUNOO0FBQ0E7QUFDQSxXQUFXO0FBQ1gsSUFBSTtBQUNKLEdBQUc7QUFDSCxFQUFFOztBQUVGO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLElBQUk7O0FBRUo7QUFDQTtBQUNBLEdBQUc7QUFDSCxFQUFFOztBQUVGO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSCxFQUFFOztBQUVGO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsR0FBRztBQUNILEVBQUU7O0FBRUY7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGVBQWU7QUFDZixXQUFXO0FBQ1gsSUFBSTtBQUNKLEdBQUc7QUFDSCxFQUFFOztBQUVGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZUFBZTtBQUNmLFdBQVc7QUFDWCxJQUFJO0FBQ0osR0FBRztBQUNILEVBQUU7O0FBRUY7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0Esc0RBQXNELFVBQVUsRUFBRSxTQUFTLEVBQUUsT0FBTztBQUNwRjtBQUNBO0FBQ0EsZUFBZTtBQUNmLFdBQVc7QUFDWCxJQUFJO0FBQ0osR0FBRztBQUNILEVBQUU7O0FBRUY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9EQUFvRCxTQUFTO0FBQzdEO0FBQ0E7QUFDQSxlQUFlO0FBQ2YsV0FBVztBQUNYLElBQUk7QUFDSixHQUFHO0FBQ0gsRUFBRTs7QUFFRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGVBQWU7QUFDZixXQUFXO0FBQ1gsSUFBSTtBQUNKLEdBQUc7QUFDSCxFQUFFOztBQUVGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvREFBb0QsU0FBUztBQUM3RDtBQUNBO0FBQ0EsZUFBZTtBQUNmLFdBQVc7QUFDWCxJQUFJO0FBQ0osR0FBRztBQUNILEVBQUU7O0FBRUY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9EQUFvRCxTQUFTO0FBQzdEO0FBQ0E7QUFDQSxlQUFlO0FBQ2YsV0FBVztBQUNYLElBQUk7QUFDSixHQUFHO0FBQ0gsRUFBRTs7QUFFRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0RBQWtELFNBQVM7QUFDM0Q7QUFDQTtBQUNBLGVBQWU7QUFDZixXQUFXO0FBQ1gsSUFBSTtBQUNKLEdBQUc7QUFDSCxFQUFFOztBQUVGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZUFBZTtBQUNmLFdBQVc7QUFDWCxJQUFJO0FBQ0osR0FBRztBQUNILEVBQUU7O0FBRUY7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpREFBaUQsVUFBVSxFQUFFLFFBQVE7QUFDckU7QUFDQSxlQUFlO0FBQ2YsSUFBSTtBQUNKLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJOztBQUVKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBOzs7Ozs7Ozs7OztBQzdoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQSxzQkFBc0I7O0FBRXRCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsOEJBQThCO0FBQzlCO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQSw2QkFBNkI7O0FBRTdCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsY0FBYyxTQUFTLE9BQU87QUFDOUI7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBLDhCQUE4Qjs7QUFFOUIsc0JBQXNCOztBQUV0QjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsNEJBQTRCO0FBQzVCO0FBQ0EsMENBQTBDO0FBQzFDO0FBQ0EsUUFBUTs7QUFFUjtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQSw4QkFBOEI7O0FBRTlCOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLDhCQUE4Qjs7QUFFOUIsNkNBQTZDOztBQUU3QztBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLHFDQUFxQztBQUNyQztBQUNBO0FBQ0EsbUJBQW1CLFFBQVE7QUFDM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLHNCQUFzQjs7QUFFdEI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTOztBQUVULHFDQUFxQztBQUNyQzs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUEsc0JBQXNCOztBQUV0QjtBQUNBO0FBQ0EsZ0NBQWdDO0FBQ2hDLGlDQUFpQztBQUNqQztBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLG1DQUFtQztBQUNuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUEsOEJBQThCO0FBQzlCLHVCQUF1QiwyQkFBMkI7QUFDbEQ7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsNkNBQTZDO0FBQzdDLDRDQUE0QztBQUM1QyxRQUFRO0FBQ1I7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUEsZ0NBQWdDO0FBQ2hDLHlCQUF5QjtBQUN6QjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7QUM1U0EsVUFBVSxtQkFBTyxDQUFDLG1EQUFTOztBQUUzQjtBQUNBLGlCQUFpQjs7QUFFakI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1CQUFtQix5QkFBeUIsSUFBSSxNQUFNLElBQUksUUFBUTtBQUNsRTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFFO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDhFQUE4RTtBQUM5RSxhQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVLG1CQUFPLENBQUMsbURBQVM7QUFDM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQkFBa0IsZ0JBQWdCO0FBQ2xDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0JBQW9CLGVBQWU7QUFDbkM7QUFDQSw4QkFBOEIsNEJBQTRCO0FBQzFEO0FBQ0Esb0JBQW9CLHlCQUF5QjtBQUM3QyxHQUFHO0FBQ0g7QUFDQSxFQUFFO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtCQUFrQixJQUFJLEdBQUcsTUFBTTtBQUMvQjtBQUNBLGFBQWEsY0FBYyxHQUFHO0FBQzlCLEVBQUU7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsV0FBVztBQUNYO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvREFBb0Q7QUFDcEQ7QUFDQSxtQkFBbUIsb0JBQW9CO0FBQ3ZDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7QUNsUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0JBQW9CLFdBQVc7QUFDL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7Ozs7Ozs7Ozs7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsOEJBQThCO0FBQzlCLDBCQUEwQixzQkFBc0I7QUFDaEQsNEJBQTRCLHVCQUF1QjtBQUNuRCxpR0FBaUcsSUFBSSxFQUFFLEVBQUUscUNBQXFDLElBQUksRUFBRSxFQUFFLDBDQUEwQyxJQUFJLEVBQUUsRUFBRSxzREFBc0QsSUFBSSxxQkFBcUIsRUFBRSxxTUFBcU0sR0FBRyxlQUFlLElBQUk7QUFDcGY7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSwwQkFBMEI7O0FBRTFCO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUU7O0FBRUY7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQSw4QkFBOEIsMkNBQTJDOztBQUV6RTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRTs7QUFFRjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUU7O0FBRUY7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSwwQkFBMEIsTUFBTTtBQUNoQyxFQUFFOztBQUVGOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUU7O0FBRUY7QUFDQSx5QkFBeUI7QUFDekIsb0JBQW9CO0FBQ3BCLG9CQUFvQjtBQUNwQixzQkFBc0I7QUFDdEIsc0JBQXNCOztBQUV0QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUU7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDJDQUEyQyxxQkFBcUI7QUFDaEU7QUFDQSxFQUFFOztBQUVGO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUU7O0FBRUY7QUFDQTtBQUNBO0FBQ0Esa0JBQWtCLGtCQUFrQjtBQUNwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRTs7QUFFRjtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsWUFBWSxNQUFNLEdBQUcsS0FBSztBQUMxQixFQUFFOztBQUVGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRTs7QUFFRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSTtBQUNKO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7O0FDaEthO0FBQ2IsOENBQTZDLEVBQUUsYUFBYSxFQUFDO0FBQzdELDJCQUEyQjtBQUMzQixpQkFBaUIsbUJBQU8sQ0FBQyxpQ0FBVTtBQUNuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMkJBQTJCOzs7Ozs7Ozs7Ozs7QUMxQ2Q7QUFDYiw4Q0FBNkMsRUFBRSxhQUFhLEVBQUM7QUFDN0Qsb0JBQW9CO0FBQ3BCLGlCQUFpQixtQkFBTyxDQUFDLGlDQUFVO0FBQ25DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxnREFBZ0QsZUFBZTtBQUMvRDtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQWE7QUFDYixTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxQ0FBcUMsaUJBQWlCO0FBQ3RELG9DQUFvQyxpQkFBaUI7QUFDckQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx1Q0FBdUMsU0FBUztBQUNoRDtBQUNBO0FBQ0Esb0JBQW9COzs7Ozs7Ozs7Ozs7QUM5RFA7QUFDYiw4Q0FBNkMsRUFBRSxhQUFhLEVBQUM7QUFDN0QsY0FBYztBQUNkLGlCQUFpQixtQkFBTyxDQUFDLGlDQUFVO0FBQ25DLGlCQUFpQixtQkFBTyxDQUFDLGlDQUFVO0FBQ25DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw2REFBNkQ7QUFDN0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx3QkFBd0IseUJBQXlCO0FBQ2pEO0FBQ0E7QUFDQTtBQUNBLG9DQUFvQyx5QkFBeUI7QUFDN0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxjQUFjOzs7Ozs7Ozs7Ozs7QUN6REQ7QUFDYjtBQUNBLDRCQUE0QiwrREFBK0QsaUJBQWlCO0FBQzVHO0FBQ0Esb0NBQW9DLE1BQU0sK0JBQStCLFlBQVk7QUFDckYsbUNBQW1DLE1BQU0sbUNBQW1DLFlBQVk7QUFDeEYsZ0NBQWdDO0FBQ2hDO0FBQ0EsS0FBSztBQUNMO0FBQ0EsOENBQTZDLEVBQUUsYUFBYSxFQUFDO0FBQzdELHdCQUF3QjtBQUN4QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaURBQWlEO0FBQ2pEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2IsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx3QkFBd0I7Ozs7Ozs7Ozs7OztBQ25EWDtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZUFBZSxvQ0FBb0M7QUFDbkQ7QUFDQTtBQUNBLENBQUM7QUFDRDtBQUNBO0FBQ0EsQ0FBQztBQUNEO0FBQ0EsMENBQTBDLDRCQUE0QjtBQUN0RSxDQUFDO0FBQ0Q7QUFDQSxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4Q0FBNkMsRUFBRSxhQUFhLEVBQUM7QUFDN0QseUJBQXlCLG1CQUFPLENBQUMsOENBQVE7QUFDekMsb0JBQW9CLG1CQUFPLENBQUMsdUNBQWE7QUFDekMsb0JBQW9CLG1CQUFPLENBQUMsdUNBQWE7QUFDekMsaUJBQWlCLG1CQUFPLENBQUMsaUNBQVU7QUFDbkMsaUJBQWlCLG1CQUFPLENBQUMsaUNBQVU7QUFDbkMsaUJBQWlCLG1CQUFPLENBQUMsaUNBQVU7QUFDbkM7QUFDQTtBQUNBLENBQUM7QUFDRDtBQUNBO0FBQ0EsbUJBQW1CLHFCQUFxQixJQUFJLFFBQVE7QUFDcEQsQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvQkFBb0IsUUFBUTtBQUM1QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMLENBQUM7Ozs7Ozs7Ozs7OztBQzNFWTtBQUNiLDhDQUE2QyxFQUFFLGFBQWEsRUFBQztBQUM3RCxjQUFjO0FBQ2QsaUJBQWlCLG1CQUFPLENBQUMsaUNBQVU7QUFDbkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYzs7Ozs7Ozs7Ozs7O0FDeENEO0FBQ2IsOENBQTZDLEVBQUUsYUFBYSxFQUFDO0FBQzdELGNBQWM7QUFDZDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxjQUFjOzs7Ozs7Ozs7OztBQ3pEZDs7Ozs7Ozs7OztBQ0FBOzs7Ozs7VUNBQTtVQUNBOztVQUVBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBOztVQUVBO1VBQ0E7O1VBRUE7VUFDQTtVQUNBOzs7OztXQ3RCQTtXQUNBO1dBQ0E7V0FDQTtXQUNBLEdBQUc7V0FDSDtXQUNBO1dBQ0EsQ0FBQzs7Ozs7VUVQRDtVQUNBO1VBQ0E7VUFDQSIsInNvdXJjZXMiOlsid2VicGFjazovLy8uL25vZGVfbW9kdWxlcy90bWkuanMvaW5kZXguanMiLCJ3ZWJwYWNrOi8vLy4vbm9kZV9tb2R1bGVzL3RtaS5qcy9saWIvYXBpLmpzIiwid2VicGFjazovLy8uL25vZGVfbW9kdWxlcy90bWkuanMvbGliL2NsaWVudC5qcyIsIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvdG1pLmpzL2xpYi9jb21tYW5kcy5qcyIsIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvdG1pLmpzL2xpYi9ldmVudHMuanMiLCJ3ZWJwYWNrOi8vLy4vbm9kZV9tb2R1bGVzL3RtaS5qcy9saWIvbG9nZ2VyLmpzIiwid2VicGFjazovLy8uL25vZGVfbW9kdWxlcy90bWkuanMvbGliL3BhcnNlci5qcyIsIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvdG1pLmpzL2xpYi90aW1lci5qcyIsIndlYnBhY2s6Ly8vLi9ub2RlX21vZHVsZXMvdG1pLmpzL2xpYi91dGlscy5qcyIsIndlYnBhY2s6Ly8vLi9zcmMvYW5pbWF0aW9uLnRzIiwid2VicGFjazovLy8uL3NyYy9idWJibGUudHMiLCJ3ZWJwYWNrOi8vLy4vc3JjL2RvdGZhbi50cyIsIndlYnBhY2s6Ly8vLi9zcmMvbG9hZC1kYXRhLnRzIiwid2VicGFjazovLy8uL3NyYy9tYWluLnRzIiwid2VicGFjazovLy8uL3NyYy9zcHJpdGUudHMiLCJ3ZWJwYWNrOi8vLy4vc3JjL3ZlY3Rvci50cyIsIndlYnBhY2s6Ly8vaWdub3JlZHwvaG9tZS9jYW5pcy9zdHVkaWVzL3R5cGVzY3JpcHQvZG90ZW1vdGUvbm9kZV9tb2R1bGVzL3RtaS5qcy9saWJ8bm9kZS1mZXRjaCIsIndlYnBhY2s6Ly8vaWdub3JlZHwvaG9tZS9jYW5pcy9zdHVkaWVzL3R5cGVzY3JpcHQvZG90ZW1vdGUvbm9kZV9tb2R1bGVzL3RtaS5qcy9saWJ8d3MiLCJ3ZWJwYWNrOi8vL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovLy93ZWJwYWNrL3J1bnRpbWUvZ2xvYmFsIiwid2VicGFjazovLy93ZWJwYWNrL2JlZm9yZS1zdGFydHVwIiwid2VicGFjazovLy93ZWJwYWNrL3N0YXJ0dXAiLCJ3ZWJwYWNrOi8vL3dlYnBhY2svYWZ0ZXItc3RhcnR1cCJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBjbGllbnQgPSByZXF1aXJlKCcuL2xpYi9jbGllbnQnKTtcbm1vZHVsZS5leHBvcnRzID0ge1xuXHRjbGllbnQsXG5cdENsaWVudDogY2xpZW50XG59O1xuIiwiY29uc3QgZmV0Y2ggPSByZXF1aXJlKCdub2RlLWZldGNoJyk7XG5jb25zdCBfID0gcmVxdWlyZSgnLi91dGlscycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGFwaShvcHRpb25zLCBjYWxsYmFjaykge1xuXHQvLyBTZXQgdGhlIHVybCB0byBvcHRpb25zLnVyaSBvciBvcHRpb25zLnVybC4uXG5cdGxldCB1cmwgPSBvcHRpb25zLnVybCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy51cmwgOiBvcHRpb25zLnVyaTtcblxuXHQvLyBNYWtlIHN1cmUgaXQgaXMgYSB2YWxpZCB1cmwuLlxuXHRpZighXy5pc1VSTCh1cmwpKSB7XG5cdFx0dXJsID0gYGh0dHBzOi8vYXBpLnR3aXRjaC50di9rcmFrZW4ke3VybFswXSA9PT0gJy8nID8gdXJsIDogYC8ke3VybH1gfWA7XG5cdH1cblxuXHQvLyBXZSBhcmUgaW5zaWRlIGEgTm9kZSBhcHBsaWNhdGlvbiwgc28gd2UgY2FuIHVzZSB0aGUgbm9kZS1mZXRjaCBtb2R1bGUuLlxuXHRpZihfLmlzTm9kZSgpKSB7XG5cdFx0Y29uc3Qgb3B0cyA9IE9iamVjdC5hc3NpZ24oeyBtZXRob2Q6ICdHRVQnLCBqc29uOiB0cnVlIH0sIG9wdGlvbnMpO1xuXHRcdGlmKG9wdHMucXMpIHtcblx0XHRcdGNvbnN0IHFzID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhvcHRzLnFzKTtcblx0XHRcdHVybCArPSBgPyR7cXN9YDtcblx0XHR9XG5cdFx0LyoqIEB0eXBlIHtpbXBvcnQoJ25vZGUtZmV0Y2gnKS5SZXF1ZXN0SW5pdH0gKi9cblx0XHRjb25zdCBmZXRjaE9wdGlvbnMgPSB7fTtcblx0XHRpZignZmV0Y2hBZ2VudCcgaW4gdGhpcy5vcHRzLmNvbm5lY3Rpb24pIHtcblx0XHRcdGZldGNoT3B0aW9ucy5hZ2VudCA9IHRoaXMub3B0cy5jb25uZWN0aW9uLmZldGNoQWdlbnQ7XG5cdFx0fVxuXHRcdC8qKiBAdHlwZSB7UmV0dXJuVHlwZTxpbXBvcnQoJ25vZGUtZmV0Y2gnKVsnZGVmYXVsdCddPn0gKi9cblx0XHRjb25zdCBmZXRjaFByb21pc2UgPSBmZXRjaCh1cmwsIHtcblx0XHRcdC4uLmZldGNoT3B0aW9ucyxcblx0XHRcdG1ldGhvZDogb3B0cy5tZXRob2QsXG5cdFx0XHRoZWFkZXJzOiBvcHRzLmhlYWRlcnMsXG5cdFx0XHRib2R5OiBvcHRzLmJvZHlcblx0XHR9KTtcblx0XHRsZXQgcmVzcG9uc2UgPSB7fTtcblx0XHRmZXRjaFByb21pc2UudGhlbihyZXMgPT4ge1xuXHRcdFx0cmVzcG9uc2UgPSB7IHN0YXR1c0NvZGU6IHJlcy5zdGF0dXMsIGhlYWRlcnM6IHJlcy5oZWFkZXJzIH07XG5cdFx0XHRyZXR1cm4gb3B0cy5qc29uID8gcmVzLmpzb24oKSA6IHJlcy50ZXh0KCk7XG5cdFx0fSlcblx0XHQudGhlbihcblx0XHRcdGRhdGEgPT4gY2FsbGJhY2sobnVsbCwgcmVzcG9uc2UsIGRhdGEpLFxuXHRcdFx0ZXJyID0+IGNhbGxiYWNrKGVyciwgcmVzcG9uc2UsIG51bGwpXG5cdFx0KTtcblx0fVxuXHQvLyBXZWIgYXBwbGljYXRpb24sIGV4dGVuc2lvbiwgUmVhY3QgTmF0aXZlIGV0Yy5cblx0ZWxzZSB7XG5cdFx0Y29uc3Qgb3B0cyA9IE9iamVjdC5hc3NpZ24oeyBtZXRob2Q6ICdHRVQnLCBoZWFkZXJzOiB7fSB9LCBvcHRpb25zLCB7IHVybCB9KTtcblx0XHQvLyBwcmVwYXJlIHJlcXVlc3Rcblx0XHRjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblx0XHR4aHIub3BlbihvcHRzLm1ldGhvZCwgb3B0cy51cmwsIHRydWUpO1xuXHRcdGZvcihjb25zdCBuYW1lIGluIG9wdHMuaGVhZGVycykge1xuXHRcdFx0eGhyLnNldFJlcXVlc3RIZWFkZXIobmFtZSwgb3B0cy5oZWFkZXJzW25hbWVdKTtcblx0XHR9XG5cdFx0eGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcblx0XHQvLyBzZXQgcmVxdWVzdCBoYW5kbGVyXG5cdFx0eGhyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBfZXYgPT4ge1xuXHRcdFx0aWYoeGhyLnJlYWR5U3RhdGUgPT09IDQpIHtcblx0XHRcdFx0aWYoeGhyLnN0YXR1cyAhPT0gMjAwKSB7XG5cdFx0XHRcdFx0Y2FsbGJhY2soeGhyLnN0YXR1cywgbnVsbCwgbnVsbCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0Y2FsbGJhY2sobnVsbCwgbnVsbCwgeGhyLnJlc3BvbnNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdC8vIHN1Ym1pdFxuXHRcdHhoci5zZW5kKCk7XG5cdH1cbn07XG4iLCJjb25zdCBfZ2xvYmFsID0gdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOiB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHt9O1xyXG5jb25zdCBfV2ViU29ja2V0ID0gX2dsb2JhbC5XZWJTb2NrZXQgfHwgcmVxdWlyZSgnd3MnKTtcclxuY29uc3QgX2ZldGNoID0gX2dsb2JhbC5mZXRjaCB8fCByZXF1aXJlKCdub2RlLWZldGNoJyk7XHJcbmNvbnN0IGFwaSA9IHJlcXVpcmUoJy4vYXBpJyk7XHJcbmNvbnN0IGNvbW1hbmRzID0gcmVxdWlyZSgnLi9jb21tYW5kcycpO1xyXG5jb25zdCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuL2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcclxuY29uc3QgbG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcclxuY29uc3QgcGFyc2UgPSByZXF1aXJlKCcuL3BhcnNlcicpO1xyXG5jb25zdCBRdWV1ZSA9IHJlcXVpcmUoJy4vdGltZXInKTtcclxuY29uc3QgXyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcclxuXHJcbmxldCBfYXBpV2FybmVkID0gZmFsc2U7XHJcblxyXG4vLyBDbGllbnQgaW5zdGFuY2UuLlxyXG5jb25zdCBjbGllbnQgPSBmdW5jdGlvbiBjbGllbnQob3B0cykge1xyXG5cdGlmKHRoaXMgaW5zdGFuY2VvZiBjbGllbnQgPT09IGZhbHNlKSB7IHJldHVybiBuZXcgY2xpZW50KG9wdHMpOyB9XHJcblx0dGhpcy5vcHRzID0gXy5nZXQob3B0cywge30pO1xyXG5cdHRoaXMub3B0cy5jaGFubmVscyA9IHRoaXMub3B0cy5jaGFubmVscyB8fCBbXTtcclxuXHR0aGlzLm9wdHMuY29ubmVjdGlvbiA9IHRoaXMub3B0cy5jb25uZWN0aW9uIHx8IHt9O1xyXG5cdHRoaXMub3B0cy5pZGVudGl0eSA9IHRoaXMub3B0cy5pZGVudGl0eSB8fCB7fTtcclxuXHR0aGlzLm9wdHMub3B0aW9ucyA9IHRoaXMub3B0cy5vcHRpb25zIHx8IHt9O1xyXG5cclxuXHR0aGlzLmNsaWVudElkID0gXy5nZXQodGhpcy5vcHRzLm9wdGlvbnMuY2xpZW50SWQsIG51bGwpO1xyXG5cdHRoaXMuX2dsb2JhbERlZmF1bHRDaGFubmVsID0gXy5jaGFubmVsKF8uZ2V0KHRoaXMub3B0cy5vcHRpb25zLmdsb2JhbERlZmF1bHRDaGFubmVsLCAnI3RtaWpzJykpO1xyXG5cdHRoaXMuX3NraXBNZW1iZXJzaGlwID0gXy5nZXQodGhpcy5vcHRzLm9wdGlvbnMuc2tpcE1lbWJlcnNoaXAsIGZhbHNlKTtcclxuXHR0aGlzLl9za2lwVXBkYXRpbmdFbW90ZXNldHMgPSBfLmdldCh0aGlzLm9wdHMub3B0aW9ucy5za2lwVXBkYXRpbmdFbW90ZXNldHMsIGZhbHNlKTtcclxuXHR0aGlzLl91cGRhdGVFbW90ZXNldHNUaW1lciA9IG51bGw7XHJcblx0dGhpcy5fdXBkYXRlRW1vdGVzZXRzVGltZXJEZWxheSA9IF8uZ2V0KHRoaXMub3B0cy5vcHRpb25zLnVwZGF0ZUVtb3Rlc2V0c1RpbWVyLCA2MDAwMCk7XHJcblxyXG5cdHRoaXMubWF4UmVjb25uZWN0QXR0ZW1wdHMgPSBfLmdldCh0aGlzLm9wdHMuY29ubmVjdGlvbi5tYXhSZWNvbm5lY3RBdHRlbXB0cywgSW5maW5pdHkpO1xyXG5cdHRoaXMubWF4UmVjb25uZWN0SW50ZXJ2YWwgPSBfLmdldCh0aGlzLm9wdHMuY29ubmVjdGlvbi5tYXhSZWNvbm5lY3RJbnRlcnZhbCwgMzAwMDApO1xyXG5cdHRoaXMucmVjb25uZWN0ID0gXy5nZXQodGhpcy5vcHRzLmNvbm5lY3Rpb24ucmVjb25uZWN0LCB0cnVlKTtcclxuXHR0aGlzLnJlY29ubmVjdERlY2F5ID0gXy5nZXQodGhpcy5vcHRzLmNvbm5lY3Rpb24ucmVjb25uZWN0RGVjYXksIDEuNSk7XHJcblx0dGhpcy5yZWNvbm5lY3RJbnRlcnZhbCA9IF8uZ2V0KHRoaXMub3B0cy5jb25uZWN0aW9uLnJlY29ubmVjdEludGVydmFsLCAxMDAwKTtcclxuXHJcblx0dGhpcy5yZWNvbm5lY3RpbmcgPSBmYWxzZTtcclxuXHR0aGlzLnJlY29ubmVjdGlvbnMgPSAwO1xyXG5cdHRoaXMucmVjb25uZWN0VGltZXIgPSB0aGlzLnJlY29ubmVjdEludGVydmFsO1xyXG5cclxuXHR0aGlzLnNlY3VyZSA9IF8uZ2V0KFxyXG5cdFx0dGhpcy5vcHRzLmNvbm5lY3Rpb24uc2VjdXJlLFxyXG5cdFx0IXRoaXMub3B0cy5jb25uZWN0aW9uLnNlcnZlciAmJiAhdGhpcy5vcHRzLmNvbm5lY3Rpb24ucG9ydFxyXG5cdCk7XHJcblxyXG5cdC8vIFJhdyBkYXRhIGFuZCBvYmplY3QgZm9yIGVtb3RlLXNldHMuLlxyXG5cdHRoaXMuZW1vdGVzID0gJyc7XHJcblx0dGhpcy5lbW90ZXNldHMgPSB7fTtcclxuXHJcblx0dGhpcy5jaGFubmVscyA9IFtdO1xyXG5cdHRoaXMuY3VycmVudExhdGVuY3kgPSAwO1xyXG5cdHRoaXMuZ2xvYmFsdXNlcnN0YXRlID0ge307XHJcblx0dGhpcy5sYXN0Sm9pbmVkID0gJyc7XHJcblx0dGhpcy5sYXRlbmN5ID0gbmV3IERhdGUoKTtcclxuXHR0aGlzLm1vZGVyYXRvcnMgPSB7fTtcclxuXHR0aGlzLnBpbmdMb29wID0gbnVsbDtcclxuXHR0aGlzLnBpbmdUaW1lb3V0ID0gbnVsbDtcclxuXHR0aGlzLnJlYXNvbiA9ICcnO1xyXG5cdHRoaXMudXNlcm5hbWUgPSAnJztcclxuXHR0aGlzLnVzZXJzdGF0ZSA9IHt9O1xyXG5cdHRoaXMud2FzQ2xvc2VDYWxsZWQgPSBmYWxzZTtcclxuXHR0aGlzLndzID0gbnVsbDtcclxuXHJcblx0Ly8gQ3JlYXRlIHRoZSBsb2dnZXIuLlxyXG5cdGxldCBsZXZlbCA9ICdlcnJvcic7XHJcblx0aWYodGhpcy5vcHRzLm9wdGlvbnMuZGVidWcpIHsgbGV2ZWwgPSAnaW5mbyc7IH1cclxuXHR0aGlzLmxvZyA9IHRoaXMub3B0cy5sb2dnZXIgfHwgbG9nZ2VyO1xyXG5cclxuXHR0cnkgeyBsb2dnZXIuc2V0TGV2ZWwobGV2ZWwpOyB9IGNhdGNoKGVycikge31cclxuXHJcblx0Ly8gRm9ybWF0IHRoZSBjaGFubmVsIG5hbWVzLi5cclxuXHR0aGlzLm9wdHMuY2hhbm5lbHMuZm9yRWFjaCgocGFydCwgaW5kZXgsIHRoZUFycmF5KSA9PlxyXG5cdFx0dGhlQXJyYXlbaW5kZXhdID0gXy5jaGFubmVsKHBhcnQpXHJcblx0KTtcclxuXHJcblx0RXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XHJcblx0dGhpcy5zZXRNYXhMaXN0ZW5lcnMoMCk7XHJcbn07XHJcblxyXG5fLmluaGVyaXRzKGNsaWVudCwgRXZlbnRFbWl0dGVyKTtcclxuXHJcbi8vIFB1dCBhbGwgY29tbWFuZHMgaW4gcHJvdG90eXBlLi5cclxuZm9yKGNvbnN0IG1ldGhvZE5hbWUgaW4gY29tbWFuZHMpIHtcclxuXHRjbGllbnQucHJvdG90eXBlW21ldGhvZE5hbWVdID0gY29tbWFuZHNbbWV0aG9kTmFtZV07XHJcbn1cclxuXHJcbi8vIEVtaXQgbXVsdGlwbGUgZXZlbnRzLi5cclxuY2xpZW50LnByb3RvdHlwZS5lbWl0cyA9IGZ1bmN0aW9uIGVtaXRzKHR5cGVzLCB2YWx1ZXMpIHtcclxuXHRmb3IobGV0IGkgPSAwOyBpIDwgdHlwZXMubGVuZ3RoOyBpKyspIHtcclxuXHRcdGNvbnN0IHZhbCA9IGkgPCB2YWx1ZXMubGVuZ3RoID8gdmFsdWVzW2ldIDogdmFsdWVzW3ZhbHVlcy5sZW5ndGggLSAxXTtcclxuXHRcdHRoaXMuZW1pdC5hcHBseSh0aGlzLCBbIHR5cGVzW2ldIF0uY29uY2F0KHZhbCkpO1xyXG5cdH1cclxufTtcclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmNsaWVudC5wcm90b3R5cGUuYXBpID0gZnVuY3Rpb24oLi4uYXJncykge1xyXG5cdGlmKCFfYXBpV2FybmVkKSB7XHJcblx0XHR0aGlzLmxvZy53YXJuKCdDbGllbnQucHJvdG90eXBlLmFwaSBpcyBkZXByZWNhdGVkIGFuZCB3aWxsIGJlIHJlbW92ZWQgZm9yIHZlcnNpb24gMi4wLjAnKTtcclxuXHRcdF9hcGlXYXJuZWQgPSB0cnVlO1xyXG5cdH1cclxuXHRhcGkoLi4uYXJncyk7XHJcbn07XHJcbi8vIEhhbmRsZSBwYXJzZWQgY2hhdCBzZXJ2ZXIgbWVzc2FnZS4uXHJcbmNsaWVudC5wcm90b3R5cGUuaGFuZGxlTWVzc2FnZSA9IGZ1bmN0aW9uIGhhbmRsZU1lc3NhZ2UobWVzc2FnZSkge1xyXG5cdGlmKCFtZXNzYWdlKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRpZih0aGlzLmxpc3RlbmVyQ291bnQoJ3Jhd19tZXNzYWdlJykpIHtcclxuXHRcdHRoaXMuZW1pdCgncmF3X21lc3NhZ2UnLCBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpKSwgbWVzc2FnZSk7XHJcblx0fVxyXG5cclxuXHRjb25zdCBjaGFubmVsID0gXy5jaGFubmVsKF8uZ2V0KG1lc3NhZ2UucGFyYW1zWzBdLCBudWxsKSk7XHJcblx0bGV0IG1zZyA9IF8uZ2V0KG1lc3NhZ2UucGFyYW1zWzFdLCBudWxsKTtcclxuXHRjb25zdCBtc2dpZCA9IF8uZ2V0KG1lc3NhZ2UudGFnc1snbXNnLWlkJ10sIG51bGwpO1xyXG5cclxuXHQvLyBQYXJzZSBiYWRnZXMsIGJhZGdlLWluZm8gYW5kIGVtb3Rlcy4uXHJcblx0Y29uc3QgdGFncyA9IG1lc3NhZ2UudGFncyA9IHBhcnNlLmJhZGdlcyhwYXJzZS5iYWRnZUluZm8ocGFyc2UuZW1vdGVzKG1lc3NhZ2UudGFncykpKTtcclxuXHJcblx0Ly8gVHJhbnNmb3JtIElSQ3YzIHRhZ3MuLlxyXG5cdGZvcihjb25zdCBrZXkgaW4gdGFncykge1xyXG5cdFx0aWYoa2V5ID09PSAnZW1vdGUtc2V0cycgfHwga2V5ID09PSAnYmFuLWR1cmF0aW9uJyB8fCBrZXkgPT09ICdiaXRzJykge1xyXG5cdFx0XHRjb250aW51ZTtcclxuXHRcdH1cclxuXHRcdGxldCB2YWx1ZSA9IHRhZ3Nba2V5XTtcclxuXHRcdGlmKHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nKSB7IHZhbHVlID0gbnVsbDsgfVxyXG5cdFx0ZWxzZSBpZih2YWx1ZSA9PT0gJzEnKSB7IHZhbHVlID0gdHJ1ZTsgfVxyXG5cdFx0ZWxzZSBpZih2YWx1ZSA9PT0gJzAnKSB7IHZhbHVlID0gZmFsc2U7IH1cclxuXHRcdGVsc2UgaWYodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgeyB2YWx1ZSA9IF8udW5lc2NhcGVJUkModmFsdWUpOyB9XHJcblx0XHR0YWdzW2tleV0gPSB2YWx1ZTtcclxuXHR9XHJcblxyXG5cdC8vIE1lc3NhZ2VzIHdpdGggbm8gcHJlZml4Li5cclxuXHRpZihtZXNzYWdlLnByZWZpeCA9PT0gbnVsbCkge1xyXG5cdFx0c3dpdGNoKG1lc3NhZ2UuY29tbWFuZCkge1xyXG5cdFx0XHQvLyBSZWNlaXZlZCBQSU5HIGZyb20gc2VydmVyLi5cclxuXHRcdFx0Y2FzZSAnUElORyc6XHJcblx0XHRcdFx0dGhpcy5lbWl0KCdwaW5nJyk7XHJcblx0XHRcdFx0aWYodGhpcy5faXNDb25uZWN0ZWQoKSkge1xyXG5cdFx0XHRcdFx0dGhpcy53cy5zZW5kKCdQT05HJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Ly8gUmVjZWl2ZWQgUE9ORyBmcm9tIHNlcnZlciwgcmV0dXJuIGN1cnJlbnQgbGF0ZW5jeS4uXHJcblx0XHRcdGNhc2UgJ1BPTkcnOiB7XHJcblx0XHRcdFx0Y29uc3QgY3VyckRhdGUgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0XHRcdHRoaXMuY3VycmVudExhdGVuY3kgPSAoY3VyckRhdGUuZ2V0VGltZSgpIC0gdGhpcy5sYXRlbmN5LmdldFRpbWUoKSkgLyAxMDAwO1xyXG5cdFx0XHRcdHRoaXMuZW1pdHMoWyAncG9uZycsICdfcHJvbWlzZVBpbmcnIF0sIFsgWyB0aGlzLmN1cnJlbnRMYXRlbmN5IF0gXSk7XHJcblxyXG5cdFx0XHRcdGNsZWFyVGltZW91dCh0aGlzLnBpbmdUaW1lb3V0KTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHR0aGlzLmxvZy53YXJuKGBDb3VsZCBub3QgcGFyc2UgbWVzc2FnZSB3aXRoIG5vIHByZWZpeDpcXG4ke0pTT04uc3RyaW5naWZ5KG1lc3NhZ2UsIG51bGwsIDQpfWApO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblxyXG5cdC8vIE1lc3NhZ2VzIHdpdGggXCJ0bWkudHdpdGNoLnR2XCIgYXMgYSBwcmVmaXguLlxyXG5cdGVsc2UgaWYobWVzc2FnZS5wcmVmaXggPT09ICd0bWkudHdpdGNoLnR2Jykge1xyXG5cdFx0c3dpdGNoKG1lc3NhZ2UuY29tbWFuZCkge1xyXG5cdFx0XHRjYXNlICcwMDInOlxyXG5cdFx0XHRjYXNlICcwMDMnOlxyXG5cdFx0XHRjYXNlICcwMDQnOlxyXG5cdFx0XHRjYXNlICczNzInOlxyXG5cdFx0XHRjYXNlICczNzUnOlxyXG5cdFx0XHRjYXNlICdDQVAnOlxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Ly8gUmV0cmlldmUgdXNlcm5hbWUgZnJvbSBzZXJ2ZXIuLlxyXG5cdFx0XHRjYXNlICcwMDEnOlxyXG5cdFx0XHRcdHRoaXMudXNlcm5hbWUgPSBtZXNzYWdlLnBhcmFtc1swXTtcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdC8vIENvbm5lY3RlZCB0byBzZXJ2ZXIuLlxyXG5cdFx0XHRjYXNlICczNzYnOiB7XHJcblx0XHRcdFx0dGhpcy5sb2cuaW5mbygnQ29ubmVjdGVkIHRvIHNlcnZlci4nKTtcclxuXHRcdFx0XHR0aGlzLnVzZXJzdGF0ZVt0aGlzLl9nbG9iYWxEZWZhdWx0Q2hhbm5lbF0gPSB7fTtcclxuXHRcdFx0XHR0aGlzLmVtaXRzKFsgJ2Nvbm5lY3RlZCcsICdfcHJvbWlzZUNvbm5lY3QnIF0sIFsgWyB0aGlzLnNlcnZlciwgdGhpcy5wb3J0IF0sIFsgbnVsbCBdIF0pO1xyXG5cdFx0XHRcdHRoaXMucmVjb25uZWN0aW9ucyA9IDA7XHJcblx0XHRcdFx0dGhpcy5yZWNvbm5lY3RUaW1lciA9IHRoaXMucmVjb25uZWN0SW50ZXJ2YWw7XHJcblxyXG5cdFx0XHRcdC8vIFNldCBhbiBpbnRlcm5hbCBwaW5nIHRpbWVvdXQgY2hlY2sgaW50ZXJ2YWwuLlxyXG5cdFx0XHRcdHRoaXMucGluZ0xvb3AgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcblx0XHRcdFx0XHQvLyBNYWtlIHN1cmUgdGhlIGNvbm5lY3Rpb24gaXMgb3BlbmVkIGJlZm9yZSBzZW5kaW5nIHRoZSBtZXNzYWdlLi5cclxuXHRcdFx0XHRcdGlmKHRoaXMuX2lzQ29ubmVjdGVkKCkpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy53cy5zZW5kKCdQSU5HJyk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR0aGlzLmxhdGVuY3kgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0XHRcdFx0dGhpcy5waW5nVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZih0aGlzLndzICE9PSBudWxsKSB7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy53YXNDbG9zZUNhbGxlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMubG9nLmVycm9yKCdQaW5nIHRpbWVvdXQuJyk7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy53cy5jbG9zZSgpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRjbGVhckludGVydmFsKHRoaXMucGluZ0xvb3ApO1xyXG5cdFx0XHRcdFx0XHRcdGNsZWFyVGltZW91dCh0aGlzLnBpbmdUaW1lb3V0KTtcclxuXHRcdFx0XHRcdFx0XHRjbGVhclRpbWVvdXQodGhpcy5fdXBkYXRlRW1vdGVzZXRzVGltZXIpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9LCBfLmdldCh0aGlzLm9wdHMuY29ubmVjdGlvbi50aW1lb3V0LCA5OTk5KSk7XHJcblx0XHRcdFx0fSwgNjAwMDApO1xyXG5cclxuXHRcdFx0XHQvLyBKb2luIGFsbCB0aGUgY2hhbm5lbHMgZnJvbSB0aGUgY29uZmlnIHdpdGggYW4gaW50ZXJ2YWwuLlxyXG5cdFx0XHRcdGxldCBqb2luSW50ZXJ2YWwgPSBfLmdldCh0aGlzLm9wdHMub3B0aW9ucy5qb2luSW50ZXJ2YWwsIDIwMDApO1xyXG5cdFx0XHRcdGlmKGpvaW5JbnRlcnZhbCA8IDMwMCkge1xyXG5cdFx0XHRcdFx0am9pbkludGVydmFsID0gMzAwO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb25zdCBqb2luUXVldWUgPSBuZXcgUXVldWUoam9pbkludGVydmFsKTtcclxuXHRcdFx0XHRjb25zdCBqb2luQ2hhbm5lbHMgPSBbIC4uLm5ldyBTZXQoWyAuLi50aGlzLm9wdHMuY2hhbm5lbHMsIC4uLnRoaXMuY2hhbm5lbHMgXSkgXTtcclxuXHRcdFx0XHR0aGlzLmNoYW5uZWxzID0gW107XHJcblxyXG5cdFx0XHRcdGZvcihsZXQgaSA9IDA7IGkgPCBqb2luQ2hhbm5lbHMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRcdGNvbnN0IGNoYW5uZWwgPSBqb2luQ2hhbm5lbHNbaV07XHJcblx0XHRcdFx0XHRqb2luUXVldWUuYWRkKCgpID0+IHtcclxuXHRcdFx0XHRcdFx0aWYodGhpcy5faXNDb25uZWN0ZWQoKSkge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMuam9pbihjaGFubmVsKS5jYXRjaChlcnIgPT4gdGhpcy5sb2cuZXJyb3IoZXJyKSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0am9pblF1ZXVlLm5leHQoKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL2p1c3RpbnR2L1R3aXRjaC1BUEkvYmxvYi9tYXN0ZXIvY2hhdC9jYXBhYmlsaXRpZXMubWQjbm90aWNlXHJcblx0XHRcdGNhc2UgJ05PVElDRSc6IHtcclxuXHRcdFx0XHRjb25zdCBudWxsQXJyID0gWyBudWxsIF07XHJcblx0XHRcdFx0Y29uc3Qgbm90aWNlQXJyID0gWyBjaGFubmVsLCBtc2dpZCwgbXNnIF07XHJcblx0XHRcdFx0Y29uc3QgbXNnaWRBcnIgPSBbIG1zZ2lkIF07XHJcblx0XHRcdFx0Y29uc3QgY2hhbm5lbFRydWVBcnIgPSBbIGNoYW5uZWwsIHRydWUgXTtcclxuXHRcdFx0XHRjb25zdCBjaGFubmVsRmFsc2VBcnIgPSBbIGNoYW5uZWwsIGZhbHNlIF07XHJcblx0XHRcdFx0Y29uc3Qgbm90aWNlQW5kTnVsbCA9IFsgbm90aWNlQXJyLCBudWxsQXJyIF07XHJcblx0XHRcdFx0Y29uc3Qgbm90aWNlQW5kTXNnaWQgPSBbIG5vdGljZUFyciwgbXNnaWRBcnIgXTtcclxuXHRcdFx0XHRjb25zdCBiYXNpY0xvZyA9IGBbJHtjaGFubmVsfV0gJHttc2d9YDtcclxuXHRcdFx0XHRzd2l0Y2gobXNnaWQpIHtcclxuXHRcdFx0XHRcdC8vIFRoaXMgcm9vbSBpcyBub3cgaW4gc3Vic2NyaWJlcnMtb25seSBtb2RlLlxyXG5cdFx0XHRcdFx0Y2FzZSAnc3Vic19vbic6XHJcblx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYFske2NoYW5uZWx9XSBUaGlzIHJvb20gaXMgbm93IGluIHN1YnNjcmliZXJzLW9ubHkgbW9kZS5gKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdzdWJzY3JpYmVyJywgJ3N1YnNjcmliZXJzJywgJ19wcm9taXNlU3Vic2NyaWJlcnMnIF0sIFsgY2hhbm5lbFRydWVBcnIsIGNoYW5uZWxUcnVlQXJyLCBudWxsQXJyIF0pO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBUaGlzIHJvb20gaXMgbm8gbG9uZ2VyIGluIHN1YnNjcmliZXJzLW9ubHkgbW9kZS5cclxuXHRcdFx0XHRcdGNhc2UgJ3N1YnNfb2ZmJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhgWyR7Y2hhbm5lbH1dIFRoaXMgcm9vbSBpcyBubyBsb25nZXIgaW4gc3Vic2NyaWJlcnMtb25seSBtb2RlLmApO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ3N1YnNjcmliZXInLCAnc3Vic2NyaWJlcnMnLCAnX3Byb21pc2VTdWJzY3JpYmVyc29mZicgXSwgWyBjaGFubmVsRmFsc2VBcnIsIGNoYW5uZWxGYWxzZUFyciwgbnVsbEFyciBdKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gVGhpcyByb29tIGlzIG5vdyBpbiBlbW90ZS1vbmx5IG1vZGUuXHJcblx0XHRcdFx0XHRjYXNlICdlbW90ZV9vbmx5X29uJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhgWyR7Y2hhbm5lbH1dIFRoaXMgcm9vbSBpcyBub3cgaW4gZW1vdGUtb25seSBtb2RlLmApO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ2Vtb3Rlb25seScsICdfcHJvbWlzZUVtb3Rlb25seScgXSwgWyBjaGFubmVsVHJ1ZUFyciwgbnVsbEFyciBdKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gVGhpcyByb29tIGlzIG5vIGxvbmdlciBpbiBlbW90ZS1vbmx5IG1vZGUuXHJcblx0XHRcdFx0XHRjYXNlICdlbW90ZV9vbmx5X29mZic6XHJcblx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYFske2NoYW5uZWx9XSBUaGlzIHJvb20gaXMgbm8gbG9uZ2VyIGluIGVtb3RlLW9ubHkgbW9kZS5gKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdlbW90ZW9ubHknLCAnX3Byb21pc2VFbW90ZW9ubHlvZmYnIF0sIFsgY2hhbm5lbEZhbHNlQXJyLCBudWxsQXJyIF0pO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBEbyBub3QgaGFuZGxlIHNsb3dfb24vb2ZmIGhlcmUsIGxpc3RlbiB0byB0aGUgUk9PTVNUQVRFIG5vdGljZSBpbnN0ZWFkIGFzIGl0IHJldHVybnMgdGhlIGRlbGF5LlxyXG5cdFx0XHRcdFx0Y2FzZSAnc2xvd19vbic6XHJcblx0XHRcdFx0XHRjYXNlICdzbG93X29mZic6XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIERvIG5vdCBoYW5kbGUgZm9sbG93ZXJzX29uL29mZiBoZXJlLCBsaXN0ZW4gdG8gdGhlIFJPT01TVEFURSBub3RpY2UgaW5zdGVhZCBhcyBpdCByZXR1cm5zIHRoZSBkZWxheS5cclxuXHRcdFx0XHRcdGNhc2UgJ2ZvbGxvd2Vyc19vbl96ZXJvJzpcclxuXHRcdFx0XHRcdGNhc2UgJ2ZvbGxvd2Vyc19vbic6XHJcblx0XHRcdFx0XHRjYXNlICdmb2xsb3dlcnNfb2ZmJzpcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gVGhpcyByb29tIGlzIG5vdyBpbiByOWsgbW9kZS5cclxuXHRcdFx0XHRcdGNhc2UgJ3I5a19vbic6XHJcblx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYFske2NoYW5uZWx9XSBUaGlzIHJvb20gaXMgbm93IGluIHI5ayBtb2RlLmApO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ3I5a21vZGUnLCAncjlrYmV0YScsICdfcHJvbWlzZVI5a2JldGEnIF0sIFsgY2hhbm5lbFRydWVBcnIsIGNoYW5uZWxUcnVlQXJyLCBudWxsQXJyIF0pO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBUaGlzIHJvb20gaXMgbm8gbG9uZ2VyIGluIHI5ayBtb2RlLlxyXG5cdFx0XHRcdFx0Y2FzZSAncjlrX29mZic6XHJcblx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYFske2NoYW5uZWx9XSBUaGlzIHJvb20gaXMgbm8gbG9uZ2VyIGluIHI5ayBtb2RlLmApO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ3I5a21vZGUnLCAncjlrYmV0YScsICdfcHJvbWlzZVI5a2JldGFvZmYnIF0sIFsgY2hhbm5lbEZhbHNlQXJyLCBjaGFubmVsRmFsc2VBcnIsIG51bGxBcnIgXSk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIFRoZSBtb2RlcmF0b3JzIG9mIHRoaXMgcm9vbSBhcmU6IFsuLi4sIC4uLl1cclxuXHRcdFx0XHRcdGNhc2UgJ3Jvb21fbW9kcyc6IHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdFNwbGl0ID0gbXNnLnNwbGl0KCc6ICcpO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBtb2RzID0gKGxpc3RTcGxpdC5sZW5ndGggPiAxID8gbGlzdFNwbGl0WzFdIDogJycpLnRvTG93ZXJDYXNlKClcclxuXHRcdFx0XHRcdFx0LnNwbGl0KCcsICcpXHJcblx0XHRcdFx0XHRcdC5maWx0ZXIobiA9PiBuKTtcclxuXHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnX3Byb21pc2VNb2RzJywgJ21vZHMnIF0sIFsgWyBudWxsLCBtb2RzIF0sIFsgY2hhbm5lbCwgbW9kcyBdIF0pO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBUaGVyZSBhcmUgbm8gbW9kZXJhdG9ycyBmb3IgdGhpcyByb29tLlxyXG5cdFx0XHRcdFx0Y2FzZSAnbm9fbW9kcyc6XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnX3Byb21pc2VNb2RzJywgJ21vZHMnIF0sIFsgWyBudWxsLCBbXSBdLCBbIGNoYW5uZWwsIFtdIF0gXSk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIFRoZSBWSVBzIG9mIHRoaXMgY2hhbm5lbCBhcmU6IFsuLi4sIC4uLl1cclxuXHRcdFx0XHRcdGNhc2UgJ3ZpcHNfc3VjY2Vzcyc6IHtcclxuXHRcdFx0XHRcdFx0aWYobXNnLmVuZHNXaXRoKCcuJykpIHtcclxuXHRcdFx0XHRcdFx0XHRtc2cgPSBtc2cuc2xpY2UoMCwgLTEpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGNvbnN0IGxpc3RTcGxpdCA9IG1zZy5zcGxpdCgnOiAnKTtcclxuXHRcdFx0XHRcdFx0Y29uc3QgdmlwcyA9IChsaXN0U3BsaXQubGVuZ3RoID4gMSA/IGxpc3RTcGxpdFsxXSA6ICcnKS50b0xvd2VyQ2FzZSgpXHJcblx0XHRcdFx0XHRcdC5zcGxpdCgnLCAnKVxyXG5cdFx0XHRcdFx0XHQuZmlsdGVyKG4gPT4gbik7XHJcblxyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ19wcm9taXNlVmlwcycsICd2aXBzJyBdLCBbIFsgbnVsbCwgdmlwcyBdLCBbIGNoYW5uZWwsIHZpcHMgXSBdKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gVGhlcmUgYXJlIG5vIFZJUHMgZm9yIHRoaXMgcm9vbS5cclxuXHRcdFx0XHRcdGNhc2UgJ25vX3ZpcHMnOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ19wcm9taXNlVmlwcycsICd2aXBzJyBdLCBbIFsgbnVsbCwgW10gXSwgWyBjaGFubmVsLCBbXSBdIF0pO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBCYW4gY29tbWFuZCBmYWlsZWQuLlxyXG5cdFx0XHRcdFx0Y2FzZSAnYWxyZWFkeV9iYW5uZWQnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnYmFkX2Jhbl9hZG1pbic6XHJcblx0XHRcdFx0XHRjYXNlICdiYWRfYmFuX2Fub24nOlxyXG5cdFx0XHRcdFx0Y2FzZSAnYmFkX2Jhbl9icm9hZGNhc3Rlcic6XHJcblx0XHRcdFx0XHRjYXNlICdiYWRfYmFuX2dsb2JhbF9tb2QnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnYmFkX2Jhbl9tb2QnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnYmFkX2Jhbl9zZWxmJzpcclxuXHRcdFx0XHRcdGNhc2UgJ2JhZF9iYW5fc3RhZmYnOlxyXG5cdFx0XHRcdFx0Y2FzZSAndXNhZ2VfYmFuJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlQmFuJyBdLCBub3RpY2VBbmRNc2dpZCk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIEJhbiBjb21tYW5kIHN1Y2Nlc3MuLlxyXG5cdFx0XHRcdFx0Y2FzZSAnYmFuX3N1Y2Nlc3MnOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VCYW4nIF0sIG5vdGljZUFuZE51bGwpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBDbGVhciBjb21tYW5kIGZhaWxlZC4uXHJcblx0XHRcdFx0XHRjYXNlICd1c2FnZV9jbGVhcic6XHJcblx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYmFzaWNMb2cpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ25vdGljZScsICdfcHJvbWlzZUNsZWFyJyBdLCBub3RpY2VBbmRNc2dpZCk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIE1vZHMgY29tbWFuZCBmYWlsZWQuLlxyXG5cdFx0XHRcdFx0Y2FzZSAndXNhZ2VfbW9kcyc6XHJcblx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYmFzaWNMb2cpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ25vdGljZScsICdfcHJvbWlzZU1vZHMnIF0sIFsgbm90aWNlQXJyLCBbIG1zZ2lkLCBbXSBdIF0pO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBNb2QgY29tbWFuZCBzdWNjZXNzLi5cclxuXHRcdFx0XHRcdGNhc2UgJ21vZF9zdWNjZXNzJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlTW9kJyBdLCBub3RpY2VBbmROdWxsKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gVklQcyBjb21tYW5kIGZhaWxlZC4uXHJcblx0XHRcdFx0XHRjYXNlICd1c2FnZV92aXBzJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlVmlwcycgXSwgWyBub3RpY2VBcnIsIFsgbXNnaWQsIFtdIF0gXSk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIFZJUCBjb21tYW5kIGZhaWxlZC4uXHJcblx0XHRcdFx0XHRjYXNlICd1c2FnZV92aXAnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnYmFkX3ZpcF9ncmFudGVlX2Jhbm5lZCc6XHJcblx0XHRcdFx0XHRjYXNlICdiYWRfdmlwX2dyYW50ZWVfYWxyZWFkeV92aXAnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnYmFkX3ZpcF9tYXhfdmlwc19yZWFjaGVkJzpcclxuXHRcdFx0XHRcdGNhc2UgJ2JhZF92aXBfYWNoaWV2ZW1lbnRfaW5jb21wbGV0ZSc6XHJcblx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYmFzaWNMb2cpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ25vdGljZScsICdfcHJvbWlzZVZpcCcgXSwgWyBub3RpY2VBcnIsIFsgbXNnaWQsIFtdIF0gXSk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIFZJUCBjb21tYW5kIHN1Y2Nlc3MuLlxyXG5cdFx0XHRcdFx0Y2FzZSAndmlwX3N1Y2Nlc3MnOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VWaXAnIF0sIG5vdGljZUFuZE51bGwpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBNb2QgY29tbWFuZCBmYWlsZWQuLlxyXG5cdFx0XHRcdFx0Y2FzZSAndXNhZ2VfbW9kJzpcclxuXHRcdFx0XHRcdGNhc2UgJ2JhZF9tb2RfYmFubmVkJzpcclxuXHRcdFx0XHRcdGNhc2UgJ2JhZF9tb2RfbW9kJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlTW9kJyBdLCBub3RpY2VBbmRNc2dpZCk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIFVubW9kIGNvbW1hbmQgc3VjY2Vzcy4uXHJcblx0XHRcdFx0XHRjYXNlICd1bm1vZF9zdWNjZXNzJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlVW5tb2QnIF0sIG5vdGljZUFuZE51bGwpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBVbnZpcCBjb21tYW5kIHN1Y2Nlc3MuLi5cclxuXHRcdFx0XHRcdGNhc2UgJ3VudmlwX3N1Y2Nlc3MnOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VVbnZpcCcgXSwgbm90aWNlQW5kTnVsbCk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIFVubW9kIGNvbW1hbmQgZmFpbGVkLi5cclxuXHRcdFx0XHRcdGNhc2UgJ3VzYWdlX3VubW9kJzpcclxuXHRcdFx0XHRcdGNhc2UgJ2JhZF91bm1vZF9tb2QnOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VVbm1vZCcgXSwgbm90aWNlQW5kTXNnaWQpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBVbnZpcCBjb21tYW5kIGZhaWxlZC4uXHJcblx0XHRcdFx0XHRjYXNlICd1c2FnZV91bnZpcCc6XHJcblx0XHRcdFx0XHRjYXNlICdiYWRfdW52aXBfZ3JhbnRlZV9ub3RfdmlwJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlVW52aXAnIF0sIG5vdGljZUFuZE1zZ2lkKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gQ29sb3IgY29tbWFuZCBzdWNjZXNzLi5cclxuXHRcdFx0XHRcdGNhc2UgJ2NvbG9yX2NoYW5nZWQnOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VDb2xvcicgXSwgbm90aWNlQW5kTnVsbCk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIENvbG9yIGNvbW1hbmQgZmFpbGVkLi5cclxuXHRcdFx0XHRcdGNhc2UgJ3VzYWdlX2NvbG9yJzpcclxuXHRcdFx0XHRcdGNhc2UgJ3R1cmJvX29ubHlfY29sb3InOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VDb2xvcicgXSwgbm90aWNlQW5kTXNnaWQpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBDb21tZXJjaWFsIGNvbW1hbmQgc3VjY2Vzcy4uXHJcblx0XHRcdFx0XHRjYXNlICdjb21tZXJjaWFsX3N1Y2Nlc3MnOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VDb21tZXJjaWFsJyBdLCBub3RpY2VBbmROdWxsKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gQ29tbWVyY2lhbCBjb21tYW5kIGZhaWxlZC4uXHJcblx0XHRcdFx0XHRjYXNlICd1c2FnZV9jb21tZXJjaWFsJzpcclxuXHRcdFx0XHRcdGNhc2UgJ2JhZF9jb21tZXJjaWFsX2Vycm9yJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlQ29tbWVyY2lhbCcgXSwgbm90aWNlQW5kTXNnaWQpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBIb3N0IGNvbW1hbmQgc3VjY2Vzcy4uXHJcblx0XHRcdFx0XHRjYXNlICdob3N0c19yZW1haW5pbmcnOiB7XHJcblx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYmFzaWNMb2cpO1xyXG5cdFx0XHRcdFx0XHRjb25zdCByZW1haW5pbmdIb3N0ID0gKCFpc05hTihtc2dbMF0pID8gcGFyc2VJbnQobXNnWzBdKSA6IDApO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ25vdGljZScsICdfcHJvbWlzZUhvc3QnIF0sIFsgbm90aWNlQXJyLCBbIG51bGwsIH5+cmVtYWluaW5nSG9zdCBdIF0pO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBIb3N0IGNvbW1hbmQgZmFpbGVkLi5cclxuXHRcdFx0XHRcdGNhc2UgJ2JhZF9ob3N0X2hvc3RpbmcnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnYmFkX2hvc3RfcmF0ZV9leGNlZWRlZCc6XHJcblx0XHRcdFx0XHRjYXNlICdiYWRfaG9zdF9lcnJvcic6XHJcblx0XHRcdFx0XHRjYXNlICd1c2FnZV9ob3N0JzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlSG9zdCcgXSwgWyBub3RpY2VBcnIsIFsgbXNnaWQsIG51bGwgXSBdKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gcjlrYmV0YSBjb21tYW5kIGZhaWxlZC4uXHJcblx0XHRcdFx0XHRjYXNlICdhbHJlYWR5X3I5a19vbic6XHJcblx0XHRcdFx0XHRjYXNlICd1c2FnZV9yOWtfb24nOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VSOWtiZXRhJyBdLCBub3RpY2VBbmRNc2dpZCk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIHI5a2JldGFvZmYgY29tbWFuZCBmYWlsZWQuLlxyXG5cdFx0XHRcdFx0Y2FzZSAnYWxyZWFkeV9yOWtfb2ZmJzpcclxuXHRcdFx0XHRcdGNhc2UgJ3VzYWdlX3I5a19vZmYnOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VSOWtiZXRhb2ZmJyBdLCBub3RpY2VBbmRNc2dpZCk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIFRpbWVvdXQgY29tbWFuZCBzdWNjZXNzLi5cclxuXHRcdFx0XHRcdGNhc2UgJ3RpbWVvdXRfc3VjY2Vzcyc6XHJcblx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYmFzaWNMb2cpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ25vdGljZScsICdfcHJvbWlzZVRpbWVvdXQnIF0sIG5vdGljZUFuZE51bGwpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHRjYXNlICdkZWxldGVfbWVzc2FnZV9zdWNjZXNzJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhgWyR7Y2hhbm5lbH0gJHttc2d9XWApO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ25vdGljZScsICdfcHJvbWlzZURlbGV0ZW1lc3NhZ2UnIF0sIG5vdGljZUFuZE51bGwpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBTdWJzY3JpYmVyc29mZiBjb21tYW5kIGZhaWxlZC4uXHJcblx0XHRcdFx0XHRjYXNlICdhbHJlYWR5X3N1YnNfb2ZmJzpcclxuXHRcdFx0XHRcdGNhc2UgJ3VzYWdlX3N1YnNfb2ZmJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlU3Vic2NyaWJlcnNvZmYnIF0sIG5vdGljZUFuZE1zZ2lkKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gU3Vic2NyaWJlcnMgY29tbWFuZCBmYWlsZWQuLlxyXG5cdFx0XHRcdFx0Y2FzZSAnYWxyZWFkeV9zdWJzX29uJzpcclxuXHRcdFx0XHRcdGNhc2UgJ3VzYWdlX3N1YnNfb24nOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VTdWJzY3JpYmVycycgXSwgbm90aWNlQW5kTXNnaWQpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBFbW90ZW9ubHlvZmYgY29tbWFuZCBmYWlsZWQuLlxyXG5cdFx0XHRcdFx0Y2FzZSAnYWxyZWFkeV9lbW90ZV9vbmx5X29mZic6XHJcblx0XHRcdFx0XHRjYXNlICd1c2FnZV9lbW90ZV9vbmx5X29mZic6XHJcblx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYmFzaWNMb2cpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ25vdGljZScsICdfcHJvbWlzZUVtb3Rlb25seW9mZicgXSwgbm90aWNlQW5kTXNnaWQpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBFbW90ZW9ubHkgY29tbWFuZCBmYWlsZWQuLlxyXG5cdFx0XHRcdFx0Y2FzZSAnYWxyZWFkeV9lbW90ZV9vbmx5X29uJzpcclxuXHRcdFx0XHRcdGNhc2UgJ3VzYWdlX2Vtb3RlX29ubHlfb24nOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VFbW90ZW9ubHknIF0sIG5vdGljZUFuZE1zZ2lkKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gU2xvdyBjb21tYW5kIGZhaWxlZC4uXHJcblx0XHRcdFx0XHRjYXNlICd1c2FnZV9zbG93X29uJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlU2xvdycgXSwgbm90aWNlQW5kTXNnaWQpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBTbG93b2ZmIGNvbW1hbmQgZmFpbGVkLi5cclxuXHRcdFx0XHRcdGNhc2UgJ3VzYWdlX3Nsb3dfb2ZmJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlU2xvd29mZicgXSwgbm90aWNlQW5kTXNnaWQpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBUaW1lb3V0IGNvbW1hbmQgZmFpbGVkLi5cclxuXHRcdFx0XHRcdGNhc2UgJ3VzYWdlX3RpbWVvdXQnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnYmFkX3RpbWVvdXRfYWRtaW4nOlxyXG5cdFx0XHRcdFx0Y2FzZSAnYmFkX3RpbWVvdXRfYW5vbic6XHJcblx0XHRcdFx0XHRjYXNlICdiYWRfdGltZW91dF9icm9hZGNhc3Rlcic6XHJcblx0XHRcdFx0XHRjYXNlICdiYWRfdGltZW91dF9kdXJhdGlvbic6XHJcblx0XHRcdFx0XHRjYXNlICdiYWRfdGltZW91dF9nbG9iYWxfbW9kJzpcclxuXHRcdFx0XHRcdGNhc2UgJ2JhZF90aW1lb3V0X21vZCc6XHJcblx0XHRcdFx0XHRjYXNlICdiYWRfdGltZW91dF9zZWxmJzpcclxuXHRcdFx0XHRcdGNhc2UgJ2JhZF90aW1lb3V0X3N0YWZmJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlVGltZW91dCcgXSwgbm90aWNlQW5kTXNnaWQpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBVbmJhbiBjb21tYW5kIHN1Y2Nlc3MuLlxyXG5cdFx0XHRcdFx0Ly8gVW5iYW4gY2FuIGFsc28gYmUgdXNlZCB0byBjYW5jZWwgYW4gYWN0aXZlIHRpbWVvdXQuXHJcblx0XHRcdFx0XHRjYXNlICd1bnRpbWVvdXRfc3VjY2Vzcyc6XHJcblx0XHRcdFx0XHRjYXNlICd1bmJhbl9zdWNjZXNzJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlVW5iYW4nIF0sIG5vdGljZUFuZE51bGwpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBVbmJhbiBjb21tYW5kIGZhaWxlZC4uXHJcblx0XHRcdFx0XHRjYXNlICd1c2FnZV91bmJhbic6XHJcblx0XHRcdFx0XHRjYXNlICdiYWRfdW5iYW5fbm9fYmFuJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnbm90aWNlJywgJ19wcm9taXNlVW5iYW4nIF0sIG5vdGljZUFuZE1zZ2lkKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gRGVsZXRlIGNvbW1hbmQgZmFpbGVkLi5cclxuXHRcdFx0XHRcdGNhc2UgJ3VzYWdlX2RlbGV0ZSc6XHJcblx0XHRcdFx0XHRjYXNlICdiYWRfZGVsZXRlX21lc3NhZ2VfZXJyb3InOlxyXG5cdFx0XHRcdFx0Y2FzZSAnYmFkX2RlbGV0ZV9tZXNzYWdlX2Jyb2FkY2FzdGVyJzpcclxuXHRcdFx0XHRcdGNhc2UgJ2JhZF9kZWxldGVfbWVzc2FnZV9tb2QnOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VEZWxldGVtZXNzYWdlJyBdLCBub3RpY2VBbmRNc2dpZCk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIFVuaG9zdCBjb21tYW5kIGZhaWxlZC4uXHJcblx0XHRcdFx0XHRjYXNlICd1c2FnZV91bmhvc3QnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnbm90X2hvc3RpbmcnOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGJhc2ljTG9nKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdub3RpY2UnLCAnX3Byb21pc2VVbmhvc3QnIF0sIG5vdGljZUFuZE1zZ2lkKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gV2hpc3BlciBjb21tYW5kIGZhaWxlZC4uXHJcblx0XHRcdFx0XHRjYXNlICd3aGlzcGVyX2ludmFsaWRfbG9naW4nOlxyXG5cdFx0XHRcdFx0Y2FzZSAnd2hpc3Blcl9pbnZhbGlkX3NlbGYnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnd2hpc3Blcl9saW1pdF9wZXJfbWluJzpcclxuXHRcdFx0XHRcdGNhc2UgJ3doaXNwZXJfbGltaXRfcGVyX3NlYyc6XHJcblx0XHRcdFx0XHRjYXNlICd3aGlzcGVyX3Jlc3RyaWN0ZWQnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnd2hpc3Blcl9yZXN0cmljdGVkX3JlY2lwaWVudCc6XHJcblx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYmFzaWNMb2cpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ25vdGljZScsICdfcHJvbWlzZVdoaXNwZXInIF0sIG5vdGljZUFuZE1zZ2lkKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gUGVybWlzc2lvbiBlcnJvci4uXHJcblx0XHRcdFx0XHRjYXNlICdub19wZXJtaXNzaW9uJzpcclxuXHRcdFx0XHRcdGNhc2UgJ21zZ19iYW5uZWQnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnbXNnX3Jvb21fbm90X2ZvdW5kJzpcclxuXHRcdFx0XHRcdGNhc2UgJ21zZ19jaGFubmVsX3N1c3BlbmRlZCc6XHJcblx0XHRcdFx0XHRjYXNlICd0b3NfYmFuJzpcclxuXHRcdFx0XHRcdGNhc2UgJ2ludmFsaWRfdXNlcic6XHJcblx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYmFzaWNMb2cpO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFtcclxuXHRcdFx0XHRcdFx0XHQnbm90aWNlJyxcclxuXHRcdFx0XHRcdFx0XHQnX3Byb21pc2VCYW4nLFxyXG5cdFx0XHRcdFx0XHRcdCdfcHJvbWlzZUNsZWFyJyxcclxuXHRcdFx0XHRcdFx0XHQnX3Byb21pc2VVbmJhbicsXHJcblx0XHRcdFx0XHRcdFx0J19wcm9taXNlVGltZW91dCcsXHJcblx0XHRcdFx0XHRcdFx0J19wcm9taXNlRGVsZXRlbWVzc2FnZScsXHJcblx0XHRcdFx0XHRcdFx0J19wcm9taXNlTW9kcycsXHJcblx0XHRcdFx0XHRcdFx0J19wcm9taXNlTW9kJyxcclxuXHRcdFx0XHRcdFx0XHQnX3Byb21pc2VVbm1vZCcsXHJcblx0XHRcdFx0XHRcdFx0J19wcm9taXNlVmlwcycsXHJcblx0XHRcdFx0XHRcdFx0J19wcm9taXNlVmlwJyxcclxuXHRcdFx0XHRcdFx0XHQnX3Byb21pc2VVbnZpcCcsXHJcblx0XHRcdFx0XHRcdFx0J19wcm9taXNlQ29tbWVyY2lhbCcsXHJcblx0XHRcdFx0XHRcdFx0J19wcm9taXNlSG9zdCcsXHJcblx0XHRcdFx0XHRcdFx0J19wcm9taXNlVW5ob3N0JyxcclxuXHRcdFx0XHRcdFx0XHQnX3Byb21pc2VKb2luJyxcclxuXHRcdFx0XHRcdFx0XHQnX3Byb21pc2VQYXJ0JyxcclxuXHRcdFx0XHRcdFx0XHQnX3Byb21pc2VSOWtiZXRhJyxcclxuXHRcdFx0XHRcdFx0XHQnX3Byb21pc2VSOWtiZXRhb2ZmJyxcclxuXHRcdFx0XHRcdFx0XHQnX3Byb21pc2VTbG93JyxcclxuXHRcdFx0XHRcdFx0XHQnX3Byb21pc2VTbG93b2ZmJyxcclxuXHRcdFx0XHRcdFx0XHQnX3Byb21pc2VGb2xsb3dlcnMnLFxyXG5cdFx0XHRcdFx0XHRcdCdfcHJvbWlzZUZvbGxvd2Vyc29mZicsXHJcblx0XHRcdFx0XHRcdFx0J19wcm9taXNlU3Vic2NyaWJlcnMnLFxyXG5cdFx0XHRcdFx0XHRcdCdfcHJvbWlzZVN1YnNjcmliZXJzb2ZmJyxcclxuXHRcdFx0XHRcdFx0XHQnX3Byb21pc2VFbW90ZW9ubHknLFxyXG5cdFx0XHRcdFx0XHRcdCdfcHJvbWlzZUVtb3Rlb25seW9mZicsXHJcblx0XHRcdFx0XHRcdFx0J19wcm9taXNlV2hpc3BlcidcclxuXHRcdFx0XHRcdFx0XSwgWyBub3RpY2VBcnIsIFsgbXNnaWQsIGNoYW5uZWwgXSBdKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gQXV0b21vZC1yZWxhdGVkLi5cclxuXHRcdFx0XHRcdGNhc2UgJ21zZ19yZWplY3RlZCc6XHJcblx0XHRcdFx0XHRjYXNlICdtc2dfcmVqZWN0ZWRfbWFuZGF0b3J5JzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnYXV0b21vZCcsIGNoYW5uZWwsIG1zZ2lkLCBtc2cpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBVbnJlY29nbml6ZWQgY29tbWFuZC4uXHJcblx0XHRcdFx0XHRjYXNlICd1bnJlY29nbml6ZWRfY21kJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnbm90aWNlJywgY2hhbm5lbCwgbXNnaWQsIG1zZyk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIFNlbmQgdGhlIGZvbGxvd2luZyBtc2ctaWRzIHRvIHRoZSBub3RpY2UgZXZlbnQgbGlzdGVuZXIuLlxyXG5cdFx0XHRcdFx0Y2FzZSAnY21kc19hdmFpbGFibGUnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnaG9zdF90YXJnZXRfd2VudF9vZmZsaW5lJzpcclxuXHRcdFx0XHRcdGNhc2UgJ21zZ19jZW5zb3JlZF9icm9hZGNhc3Rlcic6XHJcblx0XHRcdFx0XHRjYXNlICdtc2dfZHVwbGljYXRlJzpcclxuXHRcdFx0XHRcdGNhc2UgJ21zZ19lbW90ZW9ubHknOlxyXG5cdFx0XHRcdFx0Y2FzZSAnbXNnX3ZlcmlmaWVkX2VtYWlsJzpcclxuXHRcdFx0XHRcdGNhc2UgJ21zZ19yYXRlbGltaXQnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnbXNnX3N1YnNvbmx5JzpcclxuXHRcdFx0XHRcdGNhc2UgJ21zZ190aW1lZG91dCc6XHJcblx0XHRcdFx0XHRjYXNlICdtc2dfYmFkX2NoYXJhY3RlcnMnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnbXNnX2NoYW5uZWxfYmxvY2tlZCc6XHJcblx0XHRcdFx0XHRjYXNlICdtc2dfZmFjZWJvb2snOlxyXG5cdFx0XHRcdFx0Y2FzZSAnbXNnX2ZvbGxvd2Vyc29ubHknOlxyXG5cdFx0XHRcdFx0Y2FzZSAnbXNnX2ZvbGxvd2Vyc29ubHlfZm9sbG93ZWQnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnbXNnX2ZvbGxvd2Vyc29ubHlfemVybyc6XHJcblx0XHRcdFx0XHRjYXNlICdtc2dfc2xvd21vZGUnOlxyXG5cdFx0XHRcdFx0Y2FzZSAnbXNnX3N1c3BlbmRlZCc6XHJcblx0XHRcdFx0XHRjYXNlICdub19oZWxwJzpcclxuXHRcdFx0XHRcdGNhc2UgJ3VzYWdlX2Rpc2Nvbm5lY3QnOlxyXG5cdFx0XHRcdFx0Y2FzZSAndXNhZ2VfaGVscCc6XHJcblx0XHRcdFx0XHRjYXNlICd1c2FnZV9tZSc6XHJcblx0XHRcdFx0XHRjYXNlICd1bmF2YWlsYWJsZV9jb21tYW5kJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhiYXNpY0xvZyk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnbm90aWNlJywgY2hhbm5lbCwgbXNnaWQsIG1zZyk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIElnbm9yZSB0aGlzIGJlY2F1c2Ugd2UgYXJlIGFscmVhZHkgbGlzdGVuaW5nIHRvIEhPU1RUQVJHRVQuLlxyXG5cdFx0XHRcdFx0Y2FzZSAnaG9zdF9vbic6XHJcblx0XHRcdFx0XHRjYXNlICdob3N0X29mZic6XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0XHRcdGlmKG1zZy5pbmNsdWRlcygnTG9naW4gdW5zdWNjZXNzZnVsJykgfHwgbXNnLmluY2x1ZGVzKCdMb2dpbiBhdXRoZW50aWNhdGlvbiBmYWlsZWQnKSkge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMud2FzQ2xvc2VDYWxsZWQgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLnJlY29ubmVjdCA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMucmVhc29uID0gbXNnO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMubG9nLmVycm9yKHRoaXMucmVhc29uKTtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLndzLmNsb3NlKCk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0ZWxzZSBpZihtc2cuaW5jbHVkZXMoJ0Vycm9yIGxvZ2dpbmcgaW4nKSB8fCBtc2cuaW5jbHVkZXMoJ0ltcHJvcGVybHkgZm9ybWF0dGVkIGF1dGgnKSkge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMud2FzQ2xvc2VDYWxsZWQgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLnJlY29ubmVjdCA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMucmVhc29uID0gbXNnO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMubG9nLmVycm9yKHRoaXMucmVhc29uKTtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLndzLmNsb3NlKCk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0ZWxzZSBpZihtc2cuaW5jbHVkZXMoJ0ludmFsaWQgTklDSycpKSB7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy53YXNDbG9zZUNhbGxlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMucmVjb25uZWN0ID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5yZWFzb24gPSAnSW52YWxpZCBOSUNLLic7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5sb2cuZXJyb3IodGhpcy5yZWFzb24pO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMud3MuY2xvc2UoKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLmxvZy53YXJuKGBDb3VsZCBub3QgcGFyc2UgTk9USUNFIGZyb20gdG1pLnR3aXRjaC50djpcXG4ke0pTT04uc3RyaW5naWZ5KG1lc3NhZ2UsIG51bGwsIDQpfWApO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnbm90aWNlJywgY2hhbm5lbCwgbXNnaWQsIG1zZyk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBIYW5kbGUgc3ViYW5uaXZlcnNhcnkgLyByZXN1Yi4uXHJcblx0XHRcdGNhc2UgJ1VTRVJOT1RJQ0UnOiB7XHJcblx0XHRcdFx0Y29uc3QgdXNlcm5hbWUgPSB0YWdzWydkaXNwbGF5LW5hbWUnXSB8fCB0YWdzWydsb2dpbiddO1xyXG5cdFx0XHRcdGNvbnN0IHBsYW4gPSB0YWdzWydtc2ctcGFyYW0tc3ViLXBsYW4nXSB8fCAnJztcclxuXHRcdFx0XHRjb25zdCBwbGFuTmFtZSA9IF8udW5lc2NhcGVJUkMoXy5nZXQodGFnc1snbXNnLXBhcmFtLXN1Yi1wbGFuLW5hbWUnXSwgJycpKSB8fCBudWxsO1xyXG5cdFx0XHRcdGNvbnN0IHByaW1lID0gcGxhbi5pbmNsdWRlcygnUHJpbWUnKTtcclxuXHRcdFx0XHRjb25zdCBtZXRob2RzID0geyBwcmltZSwgcGxhbiwgcGxhbk5hbWUgfTtcclxuXHRcdFx0XHRjb25zdCBzdHJlYWtNb250aHMgPSB+fih0YWdzWydtc2ctcGFyYW0tc3RyZWFrLW1vbnRocyddIHx8IDApO1xyXG5cdFx0XHRcdGNvbnN0IHJlY2lwaWVudCA9IHRhZ3NbJ21zZy1wYXJhbS1yZWNpcGllbnQtZGlzcGxheS1uYW1lJ10gfHwgdGFnc1snbXNnLXBhcmFtLXJlY2lwaWVudC11c2VyLW5hbWUnXTtcclxuXHRcdFx0XHRjb25zdCBnaWZ0U3ViQ291bnQgPSB+fnRhZ3NbJ21zZy1wYXJhbS1tYXNzLWdpZnQtY291bnQnXTtcclxuXHRcdFx0XHR0YWdzWydtZXNzYWdlLXR5cGUnXSA9IG1zZ2lkO1xyXG5cclxuXHRcdFx0XHRzd2l0Y2gobXNnaWQpIHtcclxuXHRcdFx0XHRcdC8vIEhhbmRsZSByZXN1YlxyXG5cdFx0XHRcdFx0Y2FzZSAncmVzdWInOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ3Jlc3ViJywgJ3N1YmFubml2ZXJzYXJ5JyBdLCBbXHJcblx0XHRcdFx0XHRcdFx0WyBjaGFubmVsLCB1c2VybmFtZSwgc3RyZWFrTW9udGhzLCBtc2csIHRhZ3MsIG1ldGhvZHMgXVxyXG5cdFx0XHRcdFx0XHRdKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gSGFuZGxlIHN1YlxyXG5cdFx0XHRcdFx0Y2FzZSAnc3ViJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdzdWJzY3JpcHRpb24nLCAnc3ViJyBdLCBbXHJcblx0XHRcdFx0XHRcdFx0WyBjaGFubmVsLCB1c2VybmFtZSwgbWV0aG9kcywgbXNnLCB0YWdzIF1cclxuXHRcdFx0XHRcdFx0XSk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIEhhbmRsZSBnaWZ0IHN1YlxyXG5cdFx0XHRcdFx0Y2FzZSAnc3ViZ2lmdCc6XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnc3ViZ2lmdCcsIGNoYW5uZWwsIHVzZXJuYW1lLCBzdHJlYWtNb250aHMsIHJlY2lwaWVudCwgbWV0aG9kcywgdGFncyk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIEhhbmRsZSBhbm9ueW1vdXMgZ2lmdCBzdWJcclxuXHRcdFx0XHRcdC8vIE5lZWQgcHJvb2YgdGhhdCB0aGlzIGV2ZW50IG9jY3VyXHJcblx0XHRcdFx0XHRjYXNlICdhbm9uc3ViZ2lmdCc6XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnYW5vbnN1YmdpZnQnLCBjaGFubmVsLCBzdHJlYWtNb250aHMsIHJlY2lwaWVudCwgbWV0aG9kcywgdGFncyk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIEhhbmRsZSByYW5kb20gZ2lmdCBzdWJzXHJcblx0XHRcdFx0XHRjYXNlICdzdWJteXN0ZXJ5Z2lmdCc6XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnc3VibXlzdGVyeWdpZnQnLCBjaGFubmVsLCB1c2VybmFtZSwgZ2lmdFN1YkNvdW50LCBtZXRob2RzLCB0YWdzKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gSGFuZGxlIGFub255bW91cyByYW5kb20gZ2lmdCBzdWJzXHJcblx0XHRcdFx0XHQvLyBOZWVkIHByb29mIHRoYXQgdGhpcyBldmVudCBvY2N1clxyXG5cdFx0XHRcdFx0Y2FzZSAnYW5vbnN1Ym15c3RlcnlnaWZ0JzpcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0KCdhbm9uc3VibXlzdGVyeWdpZnQnLCBjaGFubmVsLCBnaWZ0U3ViQ291bnQsIG1ldGhvZHMsIHRhZ3MpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHQvLyBIYW5kbGUgdXNlciB1cGdyYWRpbmcgZnJvbSBQcmltZSB0byBhIG5vcm1hbCB0aWVyIHN1YlxyXG5cdFx0XHRcdFx0Y2FzZSAncHJpbWVwYWlkdXBncmFkZSc6XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgncHJpbWVwYWlkdXBncmFkZScsIGNoYW5uZWwsIHVzZXJuYW1lLCBtZXRob2RzLCB0YWdzKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0Ly8gSGFuZGxlIHVzZXIgdXBncmFkaW5nIGZyb20gYSBnaWZ0ZWQgc3ViXHJcblx0XHRcdFx0XHRjYXNlICdnaWZ0cGFpZHVwZ3JhZGUnOiB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHNlbmRlciA9IHRhZ3NbJ21zZy1wYXJhbS1zZW5kZXItbmFtZSddIHx8IHRhZ3NbJ21zZy1wYXJhbS1zZW5kZXItbG9naW4nXTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0KCdnaWZ0cGFpZHVwZ3JhZGUnLCBjaGFubmVsLCB1c2VybmFtZSwgc2VuZGVyLCB0YWdzKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gSGFuZGxlIHVzZXIgdXBncmFkaW5nIGZyb20gYW4gYW5vbnltb3VzIGdpZnRlZCBzdWJcclxuXHRcdFx0XHRcdGNhc2UgJ2Fub25naWZ0cGFpZHVwZ3JhZGUnOlxyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXQoJ2Fub25naWZ0cGFpZHVwZ3JhZGUnLCBjaGFubmVsLCB1c2VybmFtZSwgdGFncyk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdC8vIEhhbmRsZSByYWlkXHJcblx0XHRcdFx0XHRjYXNlICdyYWlkJzoge1xyXG5cdFx0XHRcdFx0XHRjb25zdCB1c2VybmFtZSA9IHRhZ3NbJ21zZy1wYXJhbS1kaXNwbGF5TmFtZSddIHx8IHRhZ3NbJ21zZy1wYXJhbS1sb2dpbiddO1xyXG5cdFx0XHRcdFx0XHRjb25zdCB2aWV3ZXJzID0gK3RhZ3NbJ21zZy1wYXJhbS12aWV3ZXJDb3VudCddO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXQoJ3JhaWRlZCcsIGNoYW5uZWwsIHVzZXJuYW1lLCB2aWV3ZXJzLCB0YWdzKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQvLyBIYW5kbGUgcml0dWFsXHJcblx0XHRcdFx0XHRjYXNlICdyaXR1YWwnOiB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHJpdHVhbE5hbWUgPSB0YWdzWydtc2ctcGFyYW0tcml0dWFsLW5hbWUnXTtcclxuXHRcdFx0XHRcdFx0c3dpdGNoKHJpdHVhbE5hbWUpIHtcclxuXHRcdFx0XHRcdFx0XHQvLyBIYW5kbGUgbmV3IGNoYXR0ZXIgcml0dWFsXHJcblx0XHRcdFx0XHRcdFx0Y2FzZSAnbmV3X2NoYXR0ZXInOlxyXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5lbWl0KCduZXdjaGF0dGVyJywgY2hhbm5lbCwgdXNlcm5hbWUsIHRhZ3MsIG1zZyk7XHJcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdFx0XHQvLyBBbGwgdW5rbm93biByaXR1YWxzIHNob3VsZCBiZSBwYXNzZWQgdGhyb3VnaFxyXG5cdFx0XHRcdFx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmVtaXQoJ3JpdHVhbCcsIHJpdHVhbE5hbWUsIGNoYW5uZWwsIHVzZXJuYW1lLCB0YWdzLCBtc2cpO1xyXG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQvLyBBbGwgb3RoZXIgbXNnaWQgZXZlbnRzIHNob3VsZCBiZSBlbWl0dGVkIHVuZGVyIGEgdXNlcm5vdGljZSBldmVudFxyXG5cdFx0XHRcdFx0Ly8gdW50aWwgaXQgY29tZXMgdXAgYW5kIG5lZWRzIHRvIGJlIGFkZGVkLi5cclxuXHRcdFx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgndXNlcm5vdGljZScsIG1zZ2lkLCBjaGFubmVsLCB0YWdzLCBtc2cpO1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIENoYW5uZWwgaXMgbm93IGhvc3RpbmcgYW5vdGhlciBjaGFubmVsIG9yIGV4aXRlZCBob3N0IG1vZGUuLlxyXG5cdFx0XHRjYXNlICdIT1NUVEFSR0VUJzoge1xyXG5cdFx0XHRcdGNvbnN0IG1zZ1NwbGl0ID0gbXNnLnNwbGl0KCcgJyk7XHJcblx0XHRcdFx0Y29uc3Qgdmlld2VycyA9IH5+bXNnU3BsaXRbMV0gfHwgMDtcclxuXHRcdFx0XHQvLyBTdG9wcGVkIGhvc3RpbmcuLlxyXG5cdFx0XHRcdGlmKG1zZ1NwbGl0WzBdID09PSAnLScpIHtcclxuXHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYFske2NoYW5uZWx9XSBFeGl0ZWQgaG9zdCBtb2RlLmApO1xyXG5cdFx0XHRcdFx0dGhpcy5lbWl0cyhbICd1bmhvc3QnLCAnX3Byb21pc2VVbmhvc3QnIF0sIFsgWyBjaGFubmVsLCB2aWV3ZXJzIF0sIFsgbnVsbCBdIF0pO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gTm93IGhvc3RpbmcuLlxyXG5cdFx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhgWyR7Y2hhbm5lbH1dIE5vdyBob3N0aW5nICR7bXNnU3BsaXRbMF19IGZvciAke3ZpZXdlcnN9IHZpZXdlcihzKS5gKTtcclxuXHRcdFx0XHRcdHRoaXMuZW1pdCgnaG9zdGluZycsIGNoYW5uZWwsIG1zZ1NwbGl0WzBdLCB2aWV3ZXJzKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFNvbWVvbmUgaGFzIGJlZW4gdGltZWQgb3V0IG9yIGNoYXQgaGFzIGJlZW4gY2xlYXJlZCBieSBhIG1vZGVyYXRvci4uXHJcblx0XHRcdGNhc2UgJ0NMRUFSQ0hBVCc6XHJcblx0XHRcdFx0Ly8gVXNlciBoYXMgYmVlbiBiYW5uZWQgLyB0aW1lZCBvdXQgYnkgYSBtb2RlcmF0b3IuLlxyXG5cdFx0XHRcdGlmKG1lc3NhZ2UucGFyYW1zLmxlbmd0aCA+IDEpIHtcclxuXHRcdFx0XHRcdC8vIER1cmF0aW9uIHJldHVybnMgbnVsbCBpZiBpdCdzIGEgYmFuLCBvdGhlcndpc2UgaXQncyBhIHRpbWVvdXQuLlxyXG5cdFx0XHRcdFx0Y29uc3QgZHVyYXRpb24gPSBfLmdldChtZXNzYWdlLnRhZ3NbJ2Jhbi1kdXJhdGlvbiddLCBudWxsKTtcclxuXHJcblx0XHRcdFx0XHRpZihkdXJhdGlvbiA9PT0gbnVsbCkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGBbJHtjaGFubmVsfV0gJHttc2d9IGhhcyBiZWVuIGJhbm5lZC5gKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0KCdiYW4nLCBjaGFubmVsLCBtc2csIG51bGwsIG1lc3NhZ2UudGFncyk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhgWyR7Y2hhbm5lbH1dICR7bXNnfSBoYXMgYmVlbiB0aW1lZCBvdXQgZm9yICR7ZHVyYXRpb259IHNlY29uZHMuYCk7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgndGltZW91dCcsIGNoYW5uZWwsIG1zZywgbnVsbCwgfn5kdXJhdGlvbiwgbWVzc2FnZS50YWdzKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIENoYXQgd2FzIGNsZWFyZWQgYnkgYSBtb2RlcmF0b3IuLlxyXG5cdFx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5sb2cuaW5mbyhgWyR7Y2hhbm5lbH1dIENoYXQgd2FzIGNsZWFyZWQgYnkgYSBtb2RlcmF0b3IuYCk7XHJcblx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ2NsZWFyY2hhdCcsICdfcHJvbWlzZUNsZWFyJyBdLCBbIFsgY2hhbm5lbCBdLCBbIG51bGwgXSBdKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHQvLyBTb21lb25lJ3MgbWVzc2FnZSBoYXMgYmVlbiBkZWxldGVkXHJcblx0XHRcdGNhc2UgJ0NMRUFSTVNHJzpcclxuXHRcdFx0XHRpZihtZXNzYWdlLnBhcmFtcy5sZW5ndGggPiAxKSB7XHJcblx0XHRcdFx0XHRjb25zdCBkZWxldGVkTWVzc2FnZSA9IG1zZztcclxuXHRcdFx0XHRcdGNvbnN0IHVzZXJuYW1lID0gdGFnc1snbG9naW4nXTtcclxuXHRcdFx0XHRcdHRhZ3NbJ21lc3NhZ2UtdHlwZSddID0gJ21lc3NhZ2VkZWxldGVkJztcclxuXHJcblx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGBbJHtjaGFubmVsfV0gJHt1c2VybmFtZX0ncyBtZXNzYWdlIGhhcyBiZWVuIGRlbGV0ZWQuYCk7XHJcblx0XHRcdFx0XHR0aGlzLmVtaXQoJ21lc3NhZ2VkZWxldGVkJywgY2hhbm5lbCwgdXNlcm5hbWUsIGRlbGV0ZWRNZXNzYWdlLCB0YWdzKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHQvLyBSZWNlaXZlZCBhIHJlY29ubmVjdGlvbiByZXF1ZXN0IGZyb20gdGhlIHNlcnZlci4uXHJcblx0XHRcdGNhc2UgJ1JFQ09OTkVDVCc6XHJcblx0XHRcdFx0dGhpcy5sb2cuaW5mbygnUmVjZWl2ZWQgUkVDT05ORUNUIHJlcXVlc3QgZnJvbSBUd2l0Y2guLicpO1xyXG5cdFx0XHRcdHRoaXMubG9nLmluZm8oYERpc2Nvbm5lY3RpbmcgYW5kIHJlY29ubmVjdGluZyBpbiAke01hdGgucm91bmQodGhpcy5yZWNvbm5lY3RUaW1lciAvIDEwMDApfSBzZWNvbmRzLi5gKTtcclxuXHRcdFx0XHR0aGlzLmRpc2Nvbm5lY3QoKS5jYXRjaChlcnIgPT4gdGhpcy5sb2cuZXJyb3IoZXJyKSk7XHJcblx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB0aGlzLmNvbm5lY3QoKS5jYXRjaChlcnIgPT4gdGhpcy5sb2cuZXJyb3IoZXJyKSksIHRoaXMucmVjb25uZWN0VGltZXIpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Ly8gUmVjZWl2ZWQgd2hlbiBqb2luaW5nIGEgY2hhbm5lbCBhbmQgZXZlcnkgdGltZSB5b3Ugc2VuZCBhIFBSSVZNU0cgdG8gYSBjaGFubmVsLlxyXG5cdFx0XHRjYXNlICdVU0VSU1RBVEUnOlxyXG5cdFx0XHRcdG1lc3NhZ2UudGFncy51c2VybmFtZSA9IHRoaXMudXNlcm5hbWU7XHJcblxyXG5cdFx0XHRcdC8vIEFkZCB0aGUgY2xpZW50IHRvIHRoZSBtb2RlcmF0b3JzIG9mIHRoaXMgcm9vbS4uXHJcblx0XHRcdFx0aWYobWVzc2FnZS50YWdzWyd1c2VyLXR5cGUnXSA9PT0gJ21vZCcpIHtcclxuXHRcdFx0XHRcdGlmKCF0aGlzLm1vZGVyYXRvcnNbY2hhbm5lbF0pIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5tb2RlcmF0b3JzW2NoYW5uZWxdID0gW107XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZighdGhpcy5tb2RlcmF0b3JzW2NoYW5uZWxdLmluY2x1ZGVzKHRoaXMudXNlcm5hbWUpKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMubW9kZXJhdG9yc1tjaGFubmVsXS5wdXNoKHRoaXMudXNlcm5hbWUpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gTG9nZ2VkIGluIGFuZCB1c2VybmFtZSBkb2Vzbid0IHN0YXJ0IHdpdGgganVzdGluZmFuLi5cclxuXHRcdFx0XHRpZighXy5pc0p1c3RpbmZhbih0aGlzLmdldFVzZXJuYW1lKCkpICYmICF0aGlzLnVzZXJzdGF0ZVtjaGFubmVsXSkge1xyXG5cdFx0XHRcdFx0dGhpcy51c2Vyc3RhdGVbY2hhbm5lbF0gPSB0YWdzO1xyXG5cdFx0XHRcdFx0dGhpcy5sYXN0Sm9pbmVkID0gY2hhbm5lbDtcclxuXHRcdFx0XHRcdHRoaXMuY2hhbm5lbHMucHVzaChjaGFubmVsKTtcclxuXHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYEpvaW5lZCAke2NoYW5uZWx9YCk7XHJcblx0XHRcdFx0XHR0aGlzLmVtaXQoJ2pvaW4nLCBjaGFubmVsLCBfLnVzZXJuYW1lKHRoaXMuZ2V0VXNlcm5hbWUoKSksIHRydWUpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gRW1vdGUtc2V0cyBoYXMgY2hhbmdlZCwgdXBkYXRlIGl0Li5cclxuXHRcdFx0XHRpZihtZXNzYWdlLnRhZ3NbJ2Vtb3RlLXNldHMnXSAhPT0gdGhpcy5lbW90ZXMpIHtcclxuXHRcdFx0XHRcdHRoaXMuX3VwZGF0ZUVtb3Rlc2V0KG1lc3NhZ2UudGFnc1snZW1vdGUtc2V0cyddKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHRoaXMudXNlcnN0YXRlW2NoYW5uZWxdID0gdGFncztcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdC8vIERlc2NyaWJlIG5vbi1jaGFubmVsLXNwZWNpZmljIHN0YXRlIGluZm9ybWF0aW9ucy4uXHJcblx0XHRcdGNhc2UgJ0dMT0JBTFVTRVJTVEFURSc6XHJcblx0XHRcdFx0dGhpcy5nbG9iYWx1c2Vyc3RhdGUgPSB0YWdzO1xyXG5cdFx0XHRcdHRoaXMuZW1pdCgnZ2xvYmFsdXNlcnN0YXRlJywgdGFncyk7XHJcblxyXG5cdFx0XHRcdC8vIFJlY2VpdmVkIGVtb3RlLXNldHMuLlxyXG5cdFx0XHRcdGlmKHR5cGVvZiBtZXNzYWdlLnRhZ3NbJ2Vtb3RlLXNldHMnXSAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuXHRcdFx0XHRcdHRoaXMuX3VwZGF0ZUVtb3Rlc2V0KG1lc3NhZ2UudGFnc1snZW1vdGUtc2V0cyddKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHQvLyBSZWNlaXZlZCB3aGVuIGpvaW5pbmcgYSBjaGFubmVsIGFuZCBldmVyeSB0aW1lIG9uZSBvZiB0aGUgY2hhdCByb29tIHNldHRpbmdzLCBsaWtlIHNsb3cgbW9kZSwgY2hhbmdlLlxyXG5cdFx0XHQvLyBUaGUgbWVzc2FnZSBvbiBqb2luIGNvbnRhaW5zIGFsbCByb29tIHNldHRpbmdzLlxyXG5cdFx0XHRjYXNlICdST09NU1RBVEUnOlxyXG5cdFx0XHRcdC8vIFdlIHVzZSB0aGlzIG5vdGljZSB0byBrbm93IGlmIHdlIHN1Y2Nlc3NmdWxseSBqb2luZWQgYSBjaGFubmVsLi5cclxuXHRcdFx0XHRpZihfLmNoYW5uZWwodGhpcy5sYXN0Sm9pbmVkKSA9PT0gY2hhbm5lbCkgeyB0aGlzLmVtaXQoJ19wcm9taXNlSm9pbicsIG51bGwsIGNoYW5uZWwpOyB9XHJcblxyXG5cdFx0XHRcdC8vIFByb3ZpZGUgdGhlIGNoYW5uZWwgbmFtZSBpbiB0aGUgdGFncyBiZWZvcmUgZW1pdHRpbmcgaXQuLlxyXG5cdFx0XHRcdG1lc3NhZ2UudGFncy5jaGFubmVsID0gY2hhbm5lbDtcclxuXHRcdFx0XHR0aGlzLmVtaXQoJ3Jvb21zdGF0ZScsIGNoYW5uZWwsIG1lc3NhZ2UudGFncyk7XHJcblxyXG5cdFx0XHRcdGlmKCFfLmhhc093bihtZXNzYWdlLnRhZ3MsICdzdWJzLW9ubHknKSkge1xyXG5cdFx0XHRcdFx0Ly8gSGFuZGxlIHNsb3cgbW9kZSBoZXJlIGluc3RlYWQgb2YgdGhlIHNsb3dfb24vb2ZmIG5vdGljZS4uXHJcblx0XHRcdFx0XHQvLyBUaGlzIHJvb20gaXMgbm93IGluIHNsb3cgbW9kZS4gWW91IG1heSBzZW5kIG1lc3NhZ2VzIGV2ZXJ5IHNsb3dfZHVyYXRpb24gc2Vjb25kcy5cclxuXHRcdFx0XHRcdGlmKF8uaGFzT3duKG1lc3NhZ2UudGFncywgJ3Nsb3cnKSkge1xyXG5cdFx0XHRcdFx0XHRpZih0eXBlb2YgbWVzc2FnZS50YWdzLnNsb3cgPT09ICdib29sZWFuJyAmJiAhbWVzc2FnZS50YWdzLnNsb3cpIHtcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBkaXNhYmxlZCA9IFsgY2hhbm5lbCwgZmFsc2UsIDAgXTtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGBbJHtjaGFubmVsfV0gVGhpcyByb29tIGlzIG5vIGxvbmdlciBpbiBzbG93IG1vZGUuYCk7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdzbG93JywgJ3Nsb3dtb2RlJywgJ19wcm9taXNlU2xvd29mZicgXSwgWyBkaXNhYmxlZCwgZGlzYWJsZWQsIFsgbnVsbCBdIF0pO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IHNlY29uZHMgPSB+fm1lc3NhZ2UudGFncy5zbG93O1xyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGVuYWJsZWQgPSBbIGNoYW5uZWwsIHRydWUsIHNlY29uZHMgXTtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGBbJHtjaGFubmVsfV0gVGhpcyByb29tIGlzIG5vdyBpbiBzbG93IG1vZGUuYCk7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdzbG93JywgJ3Nsb3dtb2RlJywgJ19wcm9taXNlU2xvdycgXSwgWyBlbmFibGVkLCBlbmFibGVkLCBbIG51bGwgXSBdKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIEhhbmRsZSBmb2xsb3dlcnMgb25seSBtb2RlIGhlcmUgaW5zdGVhZCBvZiB0aGUgZm9sbG93ZXJzX29uL29mZiBub3RpY2UuLlxyXG5cdFx0XHRcdFx0Ly8gVGhpcyByb29tIGlzIG5vdyBpbiBmb2xsb3dlci1vbmx5IG1vZGUuXHJcblx0XHRcdFx0XHQvLyBUaGlzIHJvb20gaXMgbm93IGluIDxkdXJhdGlvbj4gZm9sbG93ZXJzLW9ubHkgbW9kZS5cclxuXHRcdFx0XHRcdC8vIFRoaXMgcm9vbSBpcyBubyBsb25nZXIgaW4gZm9sbG93ZXJzLW9ubHkgbW9kZS5cclxuXHRcdFx0XHRcdC8vIGR1cmF0aW9uIGlzIGluIG1pbnV0ZXMgKHN0cmluZylcclxuXHRcdFx0XHRcdC8vIC0xIHdoZW4gL2ZvbGxvd2Vyc29mZiAoc3RyaW5nKVxyXG5cdFx0XHRcdFx0Ly8gZmFsc2Ugd2hlbiAvZm9sbG93ZXJzIHdpdGggbm8gZHVyYXRpb24gKGJvb2xlYW4pXHJcblx0XHRcdFx0XHRpZihfLmhhc093bihtZXNzYWdlLnRhZ3MsICdmb2xsb3dlcnMtb25seScpKSB7XHJcblx0XHRcdFx0XHRcdGlmKG1lc3NhZ2UudGFnc1snZm9sbG93ZXJzLW9ubHknXSA9PT0gJy0xJykge1xyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGRpc2FibGVkID0gWyBjaGFubmVsLCBmYWxzZSwgMCBdO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYFske2NoYW5uZWx9XSBUaGlzIHJvb20gaXMgbm8gbG9uZ2VyIGluIGZvbGxvd2Vycy1vbmx5IG1vZGUuYCk7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5lbWl0cyhbICdmb2xsb3dlcnNvbmx5JywgJ2ZvbGxvd2Vyc21vZGUnLCAnX3Byb21pc2VGb2xsb3dlcnNvZmYnIF0sIFsgZGlzYWJsZWQsIGRpc2FibGVkLCBbIG51bGwgXSBdKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBtaW51dGVzID0gfn5tZXNzYWdlLnRhZ3NbJ2ZvbGxvd2Vycy1vbmx5J107XHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgZW5hYmxlZCA9IFsgY2hhbm5lbCwgdHJ1ZSwgbWludXRlcyBdO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYFske2NoYW5uZWx9XSBUaGlzIHJvb20gaXMgbm93IGluIGZvbGxvd2VyLW9ubHkgbW9kZS5gKTtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ2ZvbGxvd2Vyc29ubHknLCAnZm9sbG93ZXJzbW9kZScsICdfcHJvbWlzZUZvbGxvd2VycycgXSwgWyBlbmFibGVkLCBlbmFibGVkLCBbIG51bGwgXSBdKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdC8vIFdyb25nIGNsdXN0ZXIuLlxyXG5cdFx0XHRjYXNlICdTRVJWRVJDSEFOR0UnOlxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHR0aGlzLmxvZy53YXJuKGBDb3VsZCBub3QgcGFyc2UgbWVzc2FnZSBmcm9tIHRtaS50d2l0Y2gudHY6XFxuJHtKU09OLnN0cmluZ2lmeShtZXNzYWdlLCBudWxsLCA0KX1gKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cclxuXHQvLyBNZXNzYWdlcyBmcm9tIGp0di4uXHJcblx0ZWxzZSBpZihtZXNzYWdlLnByZWZpeCA9PT0gJ2p0dicpIHtcclxuXHRcdHN3aXRjaChtZXNzYWdlLmNvbW1hbmQpIHtcclxuXHRcdFx0Y2FzZSAnTU9ERSc6XHJcblx0XHRcdFx0aWYobXNnID09PSAnK28nKSB7XHJcblx0XHRcdFx0XHQvLyBBZGQgdXNlcm5hbWUgdG8gdGhlIG1vZGVyYXRvcnMuLlxyXG5cdFx0XHRcdFx0aWYoIXRoaXMubW9kZXJhdG9yc1tjaGFubmVsXSkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLm1vZGVyYXRvcnNbY2hhbm5lbF0gPSBbXTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmKCF0aGlzLm1vZGVyYXRvcnNbY2hhbm5lbF0uaW5jbHVkZXMobWVzc2FnZS5wYXJhbXNbMl0pKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMubW9kZXJhdG9yc1tjaGFubmVsXS5wdXNoKG1lc3NhZ2UucGFyYW1zWzJdKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR0aGlzLmVtaXQoJ21vZCcsIGNoYW5uZWwsIG1lc3NhZ2UucGFyYW1zWzJdKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZWxzZSBpZihtc2cgPT09ICctbycpIHtcclxuXHRcdFx0XHRcdC8vIFJlbW92ZSB1c2VybmFtZSBmcm9tIHRoZSBtb2RlcmF0b3JzLi5cclxuXHRcdFx0XHRcdGlmKCF0aGlzLm1vZGVyYXRvcnNbY2hhbm5lbF0pIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5tb2RlcmF0b3JzW2NoYW5uZWxdID0gW107XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR0aGlzLm1vZGVyYXRvcnNbY2hhbm5lbF0uZmlsdGVyKHZhbHVlID0+IHZhbHVlICE9PSBtZXNzYWdlLnBhcmFtc1syXSk7XHJcblxyXG5cdFx0XHRcdFx0dGhpcy5lbWl0KCd1bm1vZCcsIGNoYW5uZWwsIG1lc3NhZ2UucGFyYW1zWzJdKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdHRoaXMubG9nLndhcm4oYENvdWxkIG5vdCBwYXJzZSBtZXNzYWdlIGZyb20ganR2OlxcbiR7SlNPTi5zdHJpbmdpZnkobWVzc2FnZSwgbnVsbCwgNCl9YCk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gQW55dGhpbmcgZWxzZS4uXHJcblx0ZWxzZSB7XHJcblx0XHRzd2l0Y2gobWVzc2FnZS5jb21tYW5kKSB7XHJcblx0XHRcdGNhc2UgJzM1Myc6XHJcblx0XHRcdFx0dGhpcy5lbWl0KCduYW1lcycsIG1lc3NhZ2UucGFyYW1zWzJdLCBtZXNzYWdlLnBhcmFtc1szXS5zcGxpdCgnICcpKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJzM2Nic6XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHQvLyBTb21lb25lIGhhcyBqb2luZWQgdGhlIGNoYW5uZWwuLlxyXG5cdFx0XHRjYXNlICdKT0lOJzoge1xyXG5cdFx0XHRcdGNvbnN0IG5pY2sgPSBtZXNzYWdlLnByZWZpeC5zcGxpdCgnIScpWzBdO1xyXG5cdFx0XHRcdC8vIEpvaW5lZCBhIGNoYW5uZWwgYXMgYSBqdXN0aW5mYW4gKGFub255bW91cykgdXNlci4uXHJcblx0XHRcdFx0aWYoXy5pc0p1c3RpbmZhbih0aGlzLmdldFVzZXJuYW1lKCkpICYmIHRoaXMudXNlcm5hbWUgPT09IG5pY2spIHtcclxuXHRcdFx0XHRcdHRoaXMubGFzdEpvaW5lZCA9IGNoYW5uZWw7XHJcblx0XHRcdFx0XHR0aGlzLmNoYW5uZWxzLnB1c2goY2hhbm5lbCk7XHJcblx0XHRcdFx0XHR0aGlzLmxvZy5pbmZvKGBKb2luZWQgJHtjaGFubmVsfWApO1xyXG5cdFx0XHRcdFx0dGhpcy5lbWl0KCdqb2luJywgY2hhbm5lbCwgbmljaywgdHJ1ZSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBTb21lb25lIGVsc2Ugam9pbmVkIHRoZSBjaGFubmVsLCBqdXN0IGVtaXQgdGhlIGpvaW4gZXZlbnQuLlxyXG5cdFx0XHRcdGlmKHRoaXMudXNlcm5hbWUgIT09IG5pY2spIHtcclxuXHRcdFx0XHRcdHRoaXMuZW1pdCgnam9pbicsIGNoYW5uZWwsIG5pY2ssIGZhbHNlKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFNvbWVvbmUgaGFzIGxlZnQgdGhlIGNoYW5uZWwuLlxyXG5cdFx0XHRjYXNlICdQQVJUJzoge1xyXG5cdFx0XHRcdGxldCBpc1NlbGYgPSBmYWxzZTtcclxuXHRcdFx0XHRjb25zdCBuaWNrID0gbWVzc2FnZS5wcmVmaXguc3BsaXQoJyEnKVswXTtcclxuXHRcdFx0XHQvLyBDbGllbnQgbGVmdCBhIGNoYW5uZWwuLlxyXG5cdFx0XHRcdGlmKHRoaXMudXNlcm5hbWUgPT09IG5pY2spIHtcclxuXHRcdFx0XHRcdGlzU2VsZiA9IHRydWU7XHJcblx0XHRcdFx0XHRpZih0aGlzLnVzZXJzdGF0ZVtjaGFubmVsXSkgeyBkZWxldGUgdGhpcy51c2Vyc3RhdGVbY2hhbm5lbF07IH1cclxuXHJcblx0XHRcdFx0XHRsZXQgaW5kZXggPSB0aGlzLmNoYW5uZWxzLmluZGV4T2YoY2hhbm5lbCk7XHJcblx0XHRcdFx0XHRpZihpbmRleCAhPT0gLTEpIHsgdGhpcy5jaGFubmVscy5zcGxpY2UoaW5kZXgsIDEpOyB9XHJcblxyXG5cdFx0XHRcdFx0aW5kZXggPSB0aGlzLm9wdHMuY2hhbm5lbHMuaW5kZXhPZihjaGFubmVsKTtcclxuXHRcdFx0XHRcdGlmKGluZGV4ICE9PSAtMSkgeyB0aGlzLm9wdHMuY2hhbm5lbHMuc3BsaWNlKGluZGV4LCAxKTsgfVxyXG5cclxuXHRcdFx0XHRcdHRoaXMubG9nLmluZm8oYExlZnQgJHtjaGFubmVsfWApO1xyXG5cdFx0XHRcdFx0dGhpcy5lbWl0KCdfcHJvbWlzZVBhcnQnLCBudWxsKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIENsaWVudCBvciBzb21lb25lIGVsc2UgbGVmdCB0aGUgY2hhbm5lbCwgZW1pdCB0aGUgcGFydCBldmVudC4uXHJcblx0XHRcdFx0dGhpcy5lbWl0KCdwYXJ0JywgY2hhbm5lbCwgbmljaywgaXNTZWxmKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gUmVjZWl2ZWQgYSB3aGlzcGVyLi5cclxuXHRcdFx0Y2FzZSAnV0hJU1BFUic6IHtcclxuXHRcdFx0XHRjb25zdCBuaWNrID0gbWVzc2FnZS5wcmVmaXguc3BsaXQoJyEnKVswXTtcclxuXHRcdFx0XHR0aGlzLmxvZy5pbmZvKGBbV0hJU1BFUl0gPCR7bmlja30+OiAke21zZ31gKTtcclxuXHJcblx0XHRcdFx0Ly8gVXBkYXRlIHRoZSB0YWdzIHRvIHByb3ZpZGUgdGhlIHVzZXJuYW1lLi5cclxuXHRcdFx0XHRpZighXy5oYXNPd24obWVzc2FnZS50YWdzLCAndXNlcm5hbWUnKSkge1xyXG5cdFx0XHRcdFx0bWVzc2FnZS50YWdzLnVzZXJuYW1lID0gbmljaztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0bWVzc2FnZS50YWdzWydtZXNzYWdlLXR5cGUnXSA9ICd3aGlzcGVyJztcclxuXHJcblx0XHRcdFx0Y29uc3QgZnJvbSA9IF8uY2hhbm5lbChtZXNzYWdlLnRhZ3MudXNlcm5hbWUpO1xyXG5cdFx0XHRcdC8vIEVtaXQgZm9yIGJvdGgsIHdoaXNwZXIgYW5kIG1lc3NhZ2UuLlxyXG5cdFx0XHRcdHRoaXMuZW1pdHMoWyAnd2hpc3BlcicsICdtZXNzYWdlJyBdLCBbXHJcblx0XHRcdFx0XHRbIGZyb20sIG1lc3NhZ2UudGFncywgbXNnLCBmYWxzZSBdXHJcblx0XHRcdFx0XSk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNhc2UgJ1BSSVZNU0cnOlxyXG5cdFx0XHRcdC8vIEFkZCB1c2VybmFtZSAobG93ZXJjYXNlKSB0byB0aGUgdGFncy4uXHJcblx0XHRcdFx0bWVzc2FnZS50YWdzLnVzZXJuYW1lID0gbWVzc2FnZS5wcmVmaXguc3BsaXQoJyEnKVswXTtcclxuXHJcblx0XHRcdFx0Ly8gTWVzc2FnZSBmcm9tIEpUVi4uXHJcblx0XHRcdFx0aWYobWVzc2FnZS50YWdzLnVzZXJuYW1lID09PSAnanR2Jykge1xyXG5cdFx0XHRcdFx0Y29uc3QgbmFtZSA9IF8udXNlcm5hbWUobXNnLnNwbGl0KCcgJylbMF0pO1xyXG5cdFx0XHRcdFx0Y29uc3QgYXV0b2hvc3QgPSBtc2cuaW5jbHVkZXMoJ2F1dG8nKTtcclxuXHRcdFx0XHRcdC8vIFNvbWVvbmUgaXMgaG9zdGluZyB0aGUgY2hhbm5lbCBhbmQgdGhlIG1lc3NhZ2UgY29udGFpbnMgaG93IG1hbnkgdmlld2Vycy4uXHJcblx0XHRcdFx0XHRpZihtc2cuaW5jbHVkZXMoJ2hvc3RpbmcgeW91IGZvcicpKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGNvdW50ID0gXy5leHRyYWN0TnVtYmVyKG1zZyk7XHJcblxyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXQoJ2hvc3RlZCcsIGNoYW5uZWwsIG5hbWUsIGNvdW50LCBhdXRvaG9zdCk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cclxuXHRcdFx0XHRcdC8vIFNvbWUgaXMgaG9zdGluZyB0aGUgY2hhbm5lbCwgYnV0IG5vIHZpZXdlcihzKSBjb3VudCBwcm92aWRlZCBpbiB0aGUgbWVzc2FnZS4uXHJcblx0XHRcdFx0XHRlbHNlIGlmKG1zZy5pbmNsdWRlcygnaG9zdGluZyB5b3UnKSkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVtaXQoJ2hvc3RlZCcsIGNoYW5uZWwsIG5hbWUsIDAsIGF1dG9ob3N0KTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29uc3QgbWVzc2FnZXNMb2dMZXZlbCA9IF8uZ2V0KHRoaXMub3B0cy5vcHRpb25zLm1lc3NhZ2VzTG9nTGV2ZWwsICdpbmZvJyk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gTWVzc2FnZSBpcyBhbiBhY3Rpb24gKC9tZSA8bWVzc2FnZT4pLi5cclxuXHRcdFx0XHRcdGNvbnN0IGFjdGlvbk1lc3NhZ2UgPSBfLmFjdGlvbk1lc3NhZ2UobXNnKTtcclxuXHRcdFx0XHRcdG1lc3NhZ2UudGFnc1snbWVzc2FnZS10eXBlJ10gPSBhY3Rpb25NZXNzYWdlID8gJ2FjdGlvbicgOiAnY2hhdCc7XHJcblx0XHRcdFx0XHRtc2cgPSBhY3Rpb25NZXNzYWdlID8gYWN0aW9uTWVzc2FnZVsxXSA6IG1zZztcclxuXHRcdFx0XHRcdC8vIENoZWNrIGZvciBCaXRzIHByaW9yIHRvIGFjdGlvbnMgbWVzc2FnZVxyXG5cdFx0XHRcdFx0aWYoXy5oYXNPd24obWVzc2FnZS50YWdzLCAnYml0cycpKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnY2hlZXInLCBjaGFubmVsLCBtZXNzYWdlLnRhZ3MsIG1zZyk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRcdFx0Ly9IYW5kbGUgQ2hhbm5lbCBQb2ludCBSZWRlbXB0aW9ucyAoUmVxdWlyZSdzIFRleHQgSW5wdXQpXHJcblx0XHRcdFx0XHRcdGlmKF8uaGFzT3duKG1lc3NhZ2UudGFncywgJ21zZy1pZCcpKSB7XHJcblx0XHRcdFx0XHRcdFx0aWYobWVzc2FnZS50YWdzWydtc2ctaWQnXSA9PT0gJ2hpZ2hsaWdodGVkLW1lc3NhZ2UnKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRjb25zdCByZXdhcmR0eXBlID0gbWVzc2FnZS50YWdzWydtc2ctaWQnXTtcclxuXHRcdFx0XHRcdFx0XHRcdHRoaXMuZW1pdCgncmVkZWVtJywgY2hhbm5lbCwgbWVzc2FnZS50YWdzLnVzZXJuYW1lLCByZXdhcmR0eXBlLCBtZXNzYWdlLnRhZ3MsIG1zZyk7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdGVsc2UgaWYobWVzc2FnZS50YWdzWydtc2ctaWQnXSA9PT0gJ3NraXAtc3Vicy1tb2RlLW1lc3NhZ2UnKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRjb25zdCByZXdhcmR0eXBlID0gbWVzc2FnZS50YWdzWydtc2ctaWQnXTtcclxuXHRcdFx0XHRcdFx0XHRcdHRoaXMuZW1pdCgncmVkZWVtJywgY2hhbm5lbCwgbWVzc2FnZS50YWdzLnVzZXJuYW1lLCByZXdhcmR0eXBlLCBtZXNzYWdlLnRhZ3MsIG1zZyk7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGVsc2UgaWYoXy5oYXNPd24obWVzc2FnZS50YWdzLCAnY3VzdG9tLXJld2FyZC1pZCcpKSB7XHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgcmV3YXJkdHlwZSA9IG1lc3NhZ2UudGFnc1snY3VzdG9tLXJld2FyZC1pZCddO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMuZW1pdCgncmVkZWVtJywgY2hhbm5lbCwgbWVzc2FnZS50YWdzLnVzZXJuYW1lLCByZXdhcmR0eXBlLCBtZXNzYWdlLnRhZ3MsIG1zZyk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0aWYoYWN0aW9uTWVzc2FnZSkge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMubG9nW21lc3NhZ2VzTG9nTGV2ZWxdKGBbJHtjaGFubmVsfV0gKjwke21lc3NhZ2UudGFncy51c2VybmFtZX0+OiAke21zZ31gKTtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLmVtaXRzKFsgJ2FjdGlvbicsICdtZXNzYWdlJyBdLCBbXHJcblx0XHRcdFx0XHRcdFx0XHRbIGNoYW5uZWwsIG1lc3NhZ2UudGFncywgbXNnLCBmYWxzZSBdXHJcblx0XHRcdFx0XHRcdFx0XSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdC8vIE1lc3NhZ2UgaXMgYSByZWd1bGFyIGNoYXQgbWVzc2FnZS4uXHJcblx0XHRcdFx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMubG9nW21lc3NhZ2VzTG9nTGV2ZWxdKGBbJHtjaGFubmVsfV0gPCR7bWVzc2FnZS50YWdzLnVzZXJuYW1lfT46ICR7bXNnfWApO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMuZW1pdHMoWyAnY2hhdCcsICdtZXNzYWdlJyBdLCBbXHJcblx0XHRcdFx0XHRcdFx0XHRbIGNoYW5uZWwsIG1lc3NhZ2UudGFncywgbXNnLCBmYWxzZSBdXHJcblx0XHRcdFx0XHRcdFx0XSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdHRoaXMubG9nLndhcm4oYENvdWxkIG5vdCBwYXJzZSBtZXNzYWdlOlxcbiR7SlNPTi5zdHJpbmdpZnkobWVzc2FnZSwgbnVsbCwgNCl9YCk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG4vLyBDb25uZWN0IHRvIHNlcnZlci4uXHJcbmNsaWVudC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uIGNvbm5lY3QoKSB7XHJcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHRcdHRoaXMuc2VydmVyID0gXy5nZXQodGhpcy5vcHRzLmNvbm5lY3Rpb24uc2VydmVyLCAnaXJjLXdzLmNoYXQudHdpdGNoLnR2Jyk7XHJcblx0XHR0aGlzLnBvcnQgPSBfLmdldCh0aGlzLm9wdHMuY29ubmVjdGlvbi5wb3J0LCA4MCk7XHJcblxyXG5cdFx0Ly8gT3ZlcnJpZGUgcG9ydCBpZiB1c2luZyBhIHNlY3VyZSBjb25uZWN0aW9uLi5cclxuXHRcdGlmKHRoaXMuc2VjdXJlKSB7IHRoaXMucG9ydCA9IDQ0MzsgfVxyXG5cdFx0aWYodGhpcy5wb3J0ID09PSA0NDMpIHsgdGhpcy5zZWN1cmUgPSB0cnVlOyB9XHJcblxyXG5cdFx0dGhpcy5yZWNvbm5lY3RUaW1lciA9IHRoaXMucmVjb25uZWN0VGltZXIgKiB0aGlzLnJlY29ubmVjdERlY2F5O1xyXG5cdFx0aWYodGhpcy5yZWNvbm5lY3RUaW1lciA+PSB0aGlzLm1heFJlY29ubmVjdEludGVydmFsKSB7XHJcblx0XHRcdHRoaXMucmVjb25uZWN0VGltZXIgPSB0aGlzLm1heFJlY29ubmVjdEludGVydmFsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIENvbm5lY3QgdG8gc2VydmVyIGZyb20gY29uZmlndXJhdGlvbi4uXHJcblx0XHR0aGlzLl9vcGVuQ29ubmVjdGlvbigpO1xyXG5cdFx0dGhpcy5vbmNlKCdfcHJvbWlzZUNvbm5lY3QnLCBlcnIgPT4ge1xyXG5cdFx0XHRpZighZXJyKSB7IHJlc29sdmUoWyB0aGlzLnNlcnZlciwgfn50aGlzLnBvcnQgXSk7IH1cclxuXHRcdFx0ZWxzZSB7IHJlamVjdChlcnIpOyB9XHJcblx0XHR9KTtcclxuXHR9KTtcclxufTtcclxuLy8gT3BlbiBhIGNvbm5lY3Rpb24uLlxyXG5jbGllbnQucHJvdG90eXBlLl9vcGVuQ29ubmVjdGlvbiA9IGZ1bmN0aW9uIF9vcGVuQ29ubmVjdGlvbigpIHtcclxuXHRjb25zdCB1cmwgPSBgJHt0aGlzLnNlY3VyZSA/ICd3c3MnIDogJ3dzJ306Ly8ke3RoaXMuc2VydmVyfToke3RoaXMucG9ydH0vYDtcclxuXHQvKiogQHR5cGUge2ltcG9ydCgnd3MnKS5DbGllbnRPcHRpb25zfSAqL1xyXG5cdGNvbnN0IGNvbm5lY3Rpb25PcHRpb25zID0ge307XHJcblx0aWYoJ2FnZW50JyBpbiB0aGlzLm9wdHMuY29ubmVjdGlvbikge1xyXG5cdFx0Y29ubmVjdGlvbk9wdGlvbnMuYWdlbnQgPSB0aGlzLm9wdHMuY29ubmVjdGlvbi5hZ2VudDtcclxuXHR9XHJcblx0dGhpcy53cyA9IG5ldyBfV2ViU29ja2V0KHVybCwgJ2lyYycsIGNvbm5lY3Rpb25PcHRpb25zKTtcclxuXHJcblx0dGhpcy53cy5vbm1lc3NhZ2UgPSB0aGlzLl9vbk1lc3NhZ2UuYmluZCh0aGlzKTtcclxuXHR0aGlzLndzLm9uZXJyb3IgPSB0aGlzLl9vbkVycm9yLmJpbmQodGhpcyk7XHJcblx0dGhpcy53cy5vbmNsb3NlID0gdGhpcy5fb25DbG9zZS5iaW5kKHRoaXMpO1xyXG5cdHRoaXMud3Mub25vcGVuID0gdGhpcy5fb25PcGVuLmJpbmQodGhpcyk7XHJcbn07XHJcbi8vIENhbGxlZCB3aGVuIHRoZSBXZWJTb2NrZXQgY29ubmVjdGlvbidzIHJlYWR5U3RhdGUgY2hhbmdlcyB0byBPUEVOLlxyXG4vLyBJbmRpY2F0ZXMgdGhhdCB0aGUgY29ubmVjdGlvbiBpcyByZWFkeSB0byBzZW5kIGFuZCByZWNlaXZlIGRhdGEuLlxyXG5jbGllbnQucHJvdG90eXBlLl9vbk9wZW4gPSBmdW5jdGlvbiBfb25PcGVuKCkge1xyXG5cdGlmKCF0aGlzLl9pc0Nvbm5lY3RlZCgpKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQvLyBFbWl0dGluZyBcImNvbm5lY3RpbmdcIiBldmVudC4uXHJcblx0dGhpcy5sb2cuaW5mbyhgQ29ubmVjdGluZyB0byAke3RoaXMuc2VydmVyfSBvbiBwb3J0ICR7dGhpcy5wb3J0fS4uYCk7XHJcblx0dGhpcy5lbWl0KCdjb25uZWN0aW5nJywgdGhpcy5zZXJ2ZXIsIH5+dGhpcy5wb3J0KTtcclxuXHJcblx0dGhpcy51c2VybmFtZSA9IF8uZ2V0KHRoaXMub3B0cy5pZGVudGl0eS51c2VybmFtZSwgXy5qdXN0aW5mYW4oKSk7XHJcblx0dGhpcy5fZ2V0VG9rZW4oKVxyXG5cdC50aGVuKHRva2VuID0+IHtcclxuXHRcdGNvbnN0IHBhc3N3b3JkID0gXy5wYXNzd29yZCh0b2tlbik7XHJcblxyXG5cdFx0Ly8gRW1pdHRpbmcgXCJsb2dvblwiIGV2ZW50Li5cclxuXHRcdHRoaXMubG9nLmluZm8oJ1NlbmRpbmcgYXV0aGVudGljYXRpb24gdG8gc2VydmVyLi4nKTtcclxuXHRcdHRoaXMuZW1pdCgnbG9nb24nKTtcclxuXHJcblx0XHRsZXQgY2FwcyA9ICd0d2l0Y2gudHYvdGFncyB0d2l0Y2gudHYvY29tbWFuZHMnO1xyXG5cdFx0aWYoIXRoaXMuX3NraXBNZW1iZXJzaGlwKSB7XHJcblx0XHRcdGNhcHMgKz0gJyB0d2l0Y2gudHYvbWVtYmVyc2hpcCc7XHJcblx0XHR9XHJcblx0XHR0aGlzLndzLnNlbmQoJ0NBUCBSRVEgOicgKyBjYXBzKTtcclxuXHJcblx0XHQvLyBBdXRoZW50aWNhdGlvbi4uXHJcblx0XHRpZihwYXNzd29yZCkge1xyXG5cdFx0XHR0aGlzLndzLnNlbmQoYFBBU1MgJHtwYXNzd29yZH1gKTtcclxuXHRcdH1cclxuXHRcdGVsc2UgaWYoXy5pc0p1c3RpbmZhbih0aGlzLnVzZXJuYW1lKSkge1xyXG5cdFx0XHR0aGlzLndzLnNlbmQoJ1BBU1MgU0NITU9PUElJRScpO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy53cy5zZW5kKGBOSUNLICR7dGhpcy51c2VybmFtZX1gKTtcclxuXHR9KVxyXG5cdC5jYXRjaChlcnIgPT4ge1xyXG5cdFx0dGhpcy5lbWl0cyhbICdfcHJvbWlzZUNvbm5lY3QnLCAnZGlzY29ubmVjdGVkJyBdLCBbIFsgZXJyIF0sIFsgJ0NvdWxkIG5vdCBnZXQgYSB0b2tlbi4nIF0gXSk7XHJcblx0fSk7XHJcbn07XHJcbi8vIEZldGNoZXMgYSB0b2tlbiBmcm9tIHRoZSBvcHRpb24uXHJcbmNsaWVudC5wcm90b3R5cGUuX2dldFRva2VuID0gZnVuY3Rpb24gX2dldFRva2VuKCkge1xyXG5cdGNvbnN0IHBhc3N3b3JkT3B0aW9uID0gdGhpcy5vcHRzLmlkZW50aXR5LnBhc3N3b3JkO1xyXG5cdGxldCBwYXNzd29yZDtcclxuXHRpZih0eXBlb2YgcGFzc3dvcmRPcHRpb24gPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdHBhc3N3b3JkID0gcGFzc3dvcmRPcHRpb24oKTtcclxuXHRcdGlmKHBhc3N3b3JkIGluc3RhbmNlb2YgUHJvbWlzZSkge1xyXG5cdFx0XHRyZXR1cm4gcGFzc3dvcmQ7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHBhc3N3b3JkKTtcclxuXHR9XHJcblx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShwYXNzd29yZE9wdGlvbik7XHJcbn07XHJcbi8vIENhbGxlZCB3aGVuIGEgbWVzc2FnZSBpcyByZWNlaXZlZCBmcm9tIHRoZSBzZXJ2ZXIuLlxyXG5jbGllbnQucHJvdG90eXBlLl9vbk1lc3NhZ2UgPSBmdW5jdGlvbiBfb25NZXNzYWdlKGV2ZW50KSB7XHJcblx0Y29uc3QgcGFydHMgPSBldmVudC5kYXRhLnRyaW0oKS5zcGxpdCgnXFxyXFxuJyk7XHJcblxyXG5cdHBhcnRzLmZvckVhY2goc3RyID0+IHtcclxuXHRcdGNvbnN0IG1zZyA9IHBhcnNlLm1zZyhzdHIpO1xyXG5cdFx0aWYobXNnKSB7XHJcblx0XHRcdHRoaXMuaGFuZGxlTWVzc2FnZShtc2cpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59O1xyXG4vLyBDYWxsZWQgd2hlbiBhbiBlcnJvciBvY2N1cnMuLlxyXG5jbGllbnQucHJvdG90eXBlLl9vbkVycm9yID0gZnVuY3Rpb24gX29uRXJyb3IoKSB7XHJcblx0dGhpcy5tb2RlcmF0b3JzID0ge307XHJcblx0dGhpcy51c2Vyc3RhdGUgPSB7fTtcclxuXHR0aGlzLmdsb2JhbHVzZXJzdGF0ZSA9IHt9O1xyXG5cclxuXHQvLyBTdG9wIHRoZSBpbnRlcm5hbCBwaW5nIHRpbWVvdXQgY2hlY2sgaW50ZXJ2YWwuLlxyXG5cdGNsZWFySW50ZXJ2YWwodGhpcy5waW5nTG9vcCk7XHJcblx0Y2xlYXJUaW1lb3V0KHRoaXMucGluZ1RpbWVvdXQpO1xyXG5cdGNsZWFyVGltZW91dCh0aGlzLl91cGRhdGVFbW90ZXNldHNUaW1lcik7XHJcblxyXG5cdHRoaXMucmVhc29uID0gdGhpcy53cyA9PT0gbnVsbCA/ICdDb25uZWN0aW9uIGNsb3NlZC4nIDogJ1VuYWJsZSB0byBjb25uZWN0Lic7XHJcblxyXG5cdHRoaXMuZW1pdHMoWyAnX3Byb21pc2VDb25uZWN0JywgJ2Rpc2Nvbm5lY3RlZCcgXSwgWyBbIHRoaXMucmVhc29uIF0gXSk7XHJcblxyXG5cdC8vIFJlY29ubmVjdCB0byBzZXJ2ZXIuLlxyXG5cdGlmKHRoaXMucmVjb25uZWN0ICYmIHRoaXMucmVjb25uZWN0aW9ucyA9PT0gdGhpcy5tYXhSZWNvbm5lY3RBdHRlbXB0cykge1xyXG5cdFx0dGhpcy5lbWl0KCdtYXhyZWNvbm5lY3QnKTtcclxuXHRcdHRoaXMubG9nLmVycm9yKCdNYXhpbXVtIHJlY29ubmVjdGlvbiBhdHRlbXB0cyByZWFjaGVkLicpO1xyXG5cdH1cclxuXHRpZih0aGlzLnJlY29ubmVjdCAmJiAhdGhpcy5yZWNvbm5lY3RpbmcgJiYgdGhpcy5yZWNvbm5lY3Rpb25zIDw9IHRoaXMubWF4UmVjb25uZWN0QXR0ZW1wdHMgLSAxKSB7XHJcblx0XHR0aGlzLnJlY29ubmVjdGluZyA9IHRydWU7XHJcblx0XHR0aGlzLnJlY29ubmVjdGlvbnMgPSB0aGlzLnJlY29ubmVjdGlvbnMgKyAxO1xyXG5cdFx0dGhpcy5sb2cuZXJyb3IoYFJlY29ubmVjdGluZyBpbiAke01hdGgucm91bmQodGhpcy5yZWNvbm5lY3RUaW1lciAvIDEwMDApfSBzZWNvbmRzLi5gKTtcclxuXHRcdHRoaXMuZW1pdCgncmVjb25uZWN0Jyk7XHJcblx0XHRzZXRUaW1lb3V0KCgpID0+IHtcclxuXHRcdFx0dGhpcy5yZWNvbm5lY3RpbmcgPSBmYWxzZTtcclxuXHRcdFx0dGhpcy5jb25uZWN0KCkuY2F0Y2goZXJyID0+IHRoaXMubG9nLmVycm9yKGVycikpO1xyXG5cdFx0fSwgdGhpcy5yZWNvbm5lY3RUaW1lcik7XHJcblx0fVxyXG5cclxuXHR0aGlzLndzID0gbnVsbDtcclxufTtcclxuLy8gQ2FsbGVkIHdoZW4gdGhlIFdlYlNvY2tldCBjb25uZWN0aW9uJ3MgcmVhZHlTdGF0ZSBjaGFuZ2VzIHRvIENMT1NFRC4uXHJcbmNsaWVudC5wcm90b3R5cGUuX29uQ2xvc2UgPSBmdW5jdGlvbiBfb25DbG9zZSgpIHtcclxuXHR0aGlzLm1vZGVyYXRvcnMgPSB7fTtcclxuXHR0aGlzLnVzZXJzdGF0ZSA9IHt9O1xyXG5cdHRoaXMuZ2xvYmFsdXNlcnN0YXRlID0ge307XHJcblxyXG5cdC8vIFN0b3AgdGhlIGludGVybmFsIHBpbmcgdGltZW91dCBjaGVjayBpbnRlcnZhbC4uXHJcblx0Y2xlYXJJbnRlcnZhbCh0aGlzLnBpbmdMb29wKTtcclxuXHRjbGVhclRpbWVvdXQodGhpcy5waW5nVGltZW91dCk7XHJcblx0Y2xlYXJUaW1lb3V0KHRoaXMuX3VwZGF0ZUVtb3Rlc2V0c1RpbWVyKTtcclxuXHJcblx0Ly8gVXNlciBjYWxsZWQgLmRpc2Nvbm5lY3QoKSwgZG9uJ3QgdHJ5IHRvIHJlY29ubmVjdC5cclxuXHRpZih0aGlzLndhc0Nsb3NlQ2FsbGVkKSB7XHJcblx0XHR0aGlzLndhc0Nsb3NlQ2FsbGVkID0gZmFsc2U7XHJcblx0XHR0aGlzLnJlYXNvbiA9ICdDb25uZWN0aW9uIGNsb3NlZC4nO1xyXG5cdFx0dGhpcy5sb2cuaW5mbyh0aGlzLnJlYXNvbik7XHJcblx0XHR0aGlzLmVtaXRzKFsgJ19wcm9taXNlQ29ubmVjdCcsICdfcHJvbWlzZURpc2Nvbm5lY3QnLCAnZGlzY29ubmVjdGVkJyBdLCBbIFsgdGhpcy5yZWFzb24gXSwgWyBudWxsIF0sIFsgdGhpcy5yZWFzb24gXSBdKTtcclxuXHR9XHJcblxyXG5cdC8vIEdvdCBkaXNjb25uZWN0ZWQgZnJvbSBzZXJ2ZXIuLlxyXG5cdGVsc2Uge1xyXG5cdFx0dGhpcy5lbWl0cyhbICdfcHJvbWlzZUNvbm5lY3QnLCAnZGlzY29ubmVjdGVkJyBdLCBbIFsgdGhpcy5yZWFzb24gXSBdKTtcclxuXHJcblx0XHQvLyBSZWNvbm5lY3QgdG8gc2VydmVyLi5cclxuXHRcdGlmKHRoaXMucmVjb25uZWN0ICYmIHRoaXMucmVjb25uZWN0aW9ucyA9PT0gdGhpcy5tYXhSZWNvbm5lY3RBdHRlbXB0cykge1xyXG5cdFx0XHR0aGlzLmVtaXQoJ21heHJlY29ubmVjdCcpO1xyXG5cdFx0XHR0aGlzLmxvZy5lcnJvcignTWF4aW11bSByZWNvbm5lY3Rpb24gYXR0ZW1wdHMgcmVhY2hlZC4nKTtcclxuXHRcdH1cclxuXHRcdGlmKHRoaXMucmVjb25uZWN0ICYmICF0aGlzLnJlY29ubmVjdGluZyAmJiB0aGlzLnJlY29ubmVjdGlvbnMgPD0gdGhpcy5tYXhSZWNvbm5lY3RBdHRlbXB0cyAtIDEpIHtcclxuXHRcdFx0dGhpcy5yZWNvbm5lY3RpbmcgPSB0cnVlO1xyXG5cdFx0XHR0aGlzLnJlY29ubmVjdGlvbnMgPSB0aGlzLnJlY29ubmVjdGlvbnMgKyAxO1xyXG5cdFx0XHR0aGlzLmxvZy5lcnJvcihgQ291bGQgbm90IGNvbm5lY3QgdG8gc2VydmVyLiBSZWNvbm5lY3RpbmcgaW4gJHtNYXRoLnJvdW5kKHRoaXMucmVjb25uZWN0VGltZXIgLyAxMDAwKX0gc2Vjb25kcy4uYCk7XHJcblx0XHRcdHRoaXMuZW1pdCgncmVjb25uZWN0Jyk7XHJcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHRcdHRoaXMucmVjb25uZWN0aW5nID0gZmFsc2U7XHJcblx0XHRcdFx0dGhpcy5jb25uZWN0KCkuY2F0Y2goZXJyID0+IHRoaXMubG9nLmVycm9yKGVycikpO1xyXG5cdFx0XHR9LCB0aGlzLnJlY29ubmVjdFRpbWVyKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHRoaXMud3MgPSBudWxsO1xyXG59O1xyXG4vLyBNaW5pbXVtIG9mIDYwMG1zIGZvciBjb21tYW5kIHByb21pc2VzLCBpZiBjdXJyZW50IGxhdGVuY3kgZXhjZWVkcywgYWRkIDEwMG1zIHRvIGl0IHRvIG1ha2Ugc3VyZSBpdCBkb2Vzbid0IGdldCB0aW1lZCBvdXQuLlxyXG5jbGllbnQucHJvdG90eXBlLl9nZXRQcm9taXNlRGVsYXkgPSBmdW5jdGlvbiBfZ2V0UHJvbWlzZURlbGF5KCkge1xyXG5cdGlmKHRoaXMuY3VycmVudExhdGVuY3kgPD0gNjAwKSB7IHJldHVybiA2MDA7IH1cclxuXHRlbHNlIHsgcmV0dXJuIHRoaXMuY3VycmVudExhdGVuY3kgKyAxMDA7IH1cclxufTtcclxuLy8gU2VuZCBjb21tYW5kIHRvIHNlcnZlciBvciBjaGFubmVsLi5cclxuY2xpZW50LnByb3RvdHlwZS5fc2VuZENvbW1hbmQgPSBmdW5jdGlvbiBfc2VuZENvbW1hbmQoZGVsYXksIGNoYW5uZWwsIGNvbW1hbmQsIGZuKSB7XHJcblx0Ly8gUmFjZSBwcm9taXNlIGFnYWluc3QgZGVsYXkuLlxyXG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcblx0XHQvLyBNYWtlIHN1cmUgdGhlIHNvY2tldCBpcyBvcGVuZWQuLlxyXG5cdFx0aWYoIXRoaXMuX2lzQ29ubmVjdGVkKCkpIHtcclxuXHRcdFx0Ly8gRGlzY29ubmVjdGVkIGZyb20gc2VydmVyLi5cclxuXHRcdFx0cmV0dXJuIHJlamVjdCgnTm90IGNvbm5lY3RlZCB0byBzZXJ2ZXIuJyk7XHJcblx0XHR9XHJcblx0XHRlbHNlIGlmKGRlbGF5ID09PSBudWxsIHx8IHR5cGVvZiBkZWxheSA9PT0gJ251bWJlcicpIHtcclxuXHRcdFx0aWYoZGVsYXkgPT09IG51bGwpIHtcclxuXHRcdFx0XHRkZWxheSA9IHRoaXMuX2dldFByb21pc2VEZWxheSgpO1xyXG5cdFx0XHR9XHJcblx0XHRcdF8ucHJvbWlzZURlbGF5KGRlbGF5KS50aGVuKCgpID0+IHJlamVjdCgnTm8gcmVzcG9uc2UgZnJvbSBUd2l0Y2guJykpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEV4ZWN1dGluZyBhIGNvbW1hbmQgb24gYSBjaGFubmVsLi5cclxuXHRcdGlmKGNoYW5uZWwgIT09IG51bGwpIHtcclxuXHRcdFx0Y29uc3QgY2hhbiA9IF8uY2hhbm5lbChjaGFubmVsKTtcclxuXHRcdFx0dGhpcy5sb2cuaW5mbyhgWyR7Y2hhbn1dIEV4ZWN1dGluZyBjb21tYW5kOiAke2NvbW1hbmR9YCk7XHJcblx0XHRcdHRoaXMud3Muc2VuZChgUFJJVk1TRyAke2NoYW59IDoke2NvbW1hbmR9YCk7XHJcblx0XHR9XHJcblx0XHQvLyBFeGVjdXRpbmcgYSByYXcgY29tbWFuZC4uXHJcblx0XHRlbHNlIHtcclxuXHRcdFx0dGhpcy5sb2cuaW5mbyhgRXhlY3V0aW5nIGNvbW1hbmQ6ICR7Y29tbWFuZH1gKTtcclxuXHRcdFx0dGhpcy53cy5zZW5kKGNvbW1hbmQpO1xyXG5cdFx0fVxyXG5cdFx0aWYodHlwZW9mIGZuID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdGZuKHJlc29sdmUsIHJlamVjdCk7XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0cmVzb2x2ZSgpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59O1xyXG4vLyBTZW5kIGEgbWVzc2FnZSB0byBjaGFubmVsLi5cclxuY2xpZW50LnByb3RvdHlwZS5fc2VuZE1lc3NhZ2UgPSBmdW5jdGlvbiBfc2VuZE1lc3NhZ2UoZGVsYXksIGNoYW5uZWwsIG1lc3NhZ2UsIGZuKSB7XHJcblx0Ly8gUHJvbWlzZSBhIHJlc3VsdC4uXHJcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuXHRcdC8vIE1ha2Ugc3VyZSB0aGUgc29ja2V0IGlzIG9wZW5lZCBhbmQgbm90IGxvZ2dlZCBpbiBhcyBhIGp1c3RpbmZhbiB1c2VyLi5cclxuXHRcdGlmKCF0aGlzLl9pc0Nvbm5lY3RlZCgpKSB7XHJcblx0XHRcdHJldHVybiByZWplY3QoJ05vdCBjb25uZWN0ZWQgdG8gc2VydmVyLicpO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSBpZihfLmlzSnVzdGluZmFuKHRoaXMuZ2V0VXNlcm5hbWUoKSkpIHtcclxuXHRcdFx0cmV0dXJuIHJlamVjdCgnQ2Fubm90IHNlbmQgYW5vbnltb3VzIG1lc3NhZ2VzLicpO1xyXG5cdFx0fVxyXG5cdFx0Y29uc3QgY2hhbiA9IF8uY2hhbm5lbChjaGFubmVsKTtcclxuXHRcdGlmKCF0aGlzLnVzZXJzdGF0ZVtjaGFuXSkgeyB0aGlzLnVzZXJzdGF0ZVtjaGFuXSA9IHt9OyB9XHJcblxyXG5cdFx0Ly8gU3BsaXQgbG9uZyBsaW5lcyBvdGhlcndpc2UgdGhleSB3aWxsIGJlIGVhdGVuIGJ5IHRoZSBzZXJ2ZXIuLlxyXG5cdFx0aWYobWVzc2FnZS5sZW5ndGggPj0gNTAwKSB7XHJcblx0XHRcdGNvbnN0IG1zZyA9IF8uc3BsaXRMaW5lKG1lc3NhZ2UsIDUwMCk7XHJcblx0XHRcdG1lc3NhZ2UgPSBtc2dbMF07XHJcblxyXG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcclxuXHRcdFx0XHR0aGlzLl9zZW5kTWVzc2FnZShkZWxheSwgY2hhbm5lbCwgbXNnWzFdLCAoKSA9PiB7fSk7XHJcblx0XHRcdH0sIDM1MCk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy53cy5zZW5kKGBQUklWTVNHICR7Y2hhbn0gOiR7bWVzc2FnZX1gKTtcclxuXHJcblx0XHRjb25zdCBlbW90ZXMgPSB7fTtcclxuXHJcblx0XHQvLyBQYXJzZSByZWdleCBhbmQgc3RyaW5nIGVtb3Rlcy4uXHJcblx0XHRPYmplY3Qua2V5cyh0aGlzLmVtb3Rlc2V0cykuZm9yRWFjaChpZCA9PiB0aGlzLmVtb3Rlc2V0c1tpZF0uZm9yRWFjaChlbW90ZSA9PiB7XHJcblx0XHRcdGNvbnN0IGVtb3RlRnVuYyA9IF8uaXNSZWdleChlbW90ZS5jb2RlKSA/IHBhcnNlLmVtb3RlUmVnZXggOiBwYXJzZS5lbW90ZVN0cmluZztcclxuXHRcdFx0cmV0dXJuIGVtb3RlRnVuYyhtZXNzYWdlLCBlbW90ZS5jb2RlLCBlbW90ZS5pZCwgZW1vdGVzKTtcclxuXHRcdH0pXHJcblx0XHQpO1xyXG5cclxuXHRcdC8vIE1lcmdlIHVzZXJzdGF0ZSB3aXRoIHBhcnNlZCBlbW90ZXMuLlxyXG5cdFx0Y29uc3QgdXNlcnN0YXRlID0gT2JqZWN0LmFzc2lnbihcclxuXHRcdFx0dGhpcy51c2Vyc3RhdGVbY2hhbl0sXHJcblx0XHRcdHBhcnNlLmVtb3Rlcyh7IGVtb3RlczogcGFyc2UudHJhbnNmb3JtRW1vdGVzKGVtb3RlcykgfHwgbnVsbCB9KVxyXG5cdFx0KTtcclxuXHJcblx0XHRjb25zdCBtZXNzYWdlc0xvZ0xldmVsID0gXy5nZXQodGhpcy5vcHRzLm9wdGlvbnMubWVzc2FnZXNMb2dMZXZlbCwgJ2luZm8nKTtcclxuXHJcblx0XHQvLyBNZXNzYWdlIGlzIGFuIGFjdGlvbiAoL21lIDxtZXNzYWdlPikuLlxyXG5cdFx0Y29uc3QgYWN0aW9uTWVzc2FnZSA9IF8uYWN0aW9uTWVzc2FnZShtZXNzYWdlKTtcclxuXHRcdGlmKGFjdGlvbk1lc3NhZ2UpIHtcclxuXHRcdFx0dXNlcnN0YXRlWydtZXNzYWdlLXR5cGUnXSA9ICdhY3Rpb24nO1xyXG5cdFx0XHR0aGlzLmxvZ1ttZXNzYWdlc0xvZ0xldmVsXShgWyR7Y2hhbn1dICo8JHt0aGlzLmdldFVzZXJuYW1lKCl9PjogJHthY3Rpb25NZXNzYWdlWzFdfWApO1xyXG5cdFx0XHR0aGlzLmVtaXRzKFsgJ2FjdGlvbicsICdtZXNzYWdlJyBdLCBbXHJcblx0XHRcdFx0WyBjaGFuLCB1c2Vyc3RhdGUsIGFjdGlvbk1lc3NhZ2VbMV0sIHRydWUgXVxyXG5cdFx0XHRdKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly8gTWVzc2FnZSBpcyBhIHJlZ3VsYXIgY2hhdCBtZXNzYWdlLi5cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHR1c2Vyc3RhdGVbJ21lc3NhZ2UtdHlwZSddID0gJ2NoYXQnO1xyXG5cdFx0XHR0aGlzLmxvZ1ttZXNzYWdlc0xvZ0xldmVsXShgWyR7Y2hhbn1dIDwke3RoaXMuZ2V0VXNlcm5hbWUoKX0+OiAke21lc3NhZ2V9YCk7XHJcblx0XHRcdHRoaXMuZW1pdHMoWyAnY2hhdCcsICdtZXNzYWdlJyBdLCBbXHJcblx0XHRcdFx0WyBjaGFuLCB1c2Vyc3RhdGUsIG1lc3NhZ2UsIHRydWUgXVxyXG5cdFx0XHRdKTtcclxuXHRcdH1cclxuXHRcdGlmKHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRmbihyZXNvbHZlLCByZWplY3QpO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdHJlc29sdmUoKTtcclxuXHRcdH1cclxuXHR9KTtcclxufTtcclxuLy8gR3JhYiB0aGUgZW1vdGUtc2V0cyBvYmplY3QgZnJvbSB0aGUgQVBJLi5cclxuY2xpZW50LnByb3RvdHlwZS5fdXBkYXRlRW1vdGVzZXQgPSBmdW5jdGlvbiBfdXBkYXRlRW1vdGVzZXQoc2V0cykge1xyXG5cdGxldCBzZXRzQ2hhbmdlcyA9IHNldHMgIT09IHVuZGVmaW5lZDtcclxuXHRpZihzZXRzQ2hhbmdlcykge1xyXG5cdFx0aWYoc2V0cyA9PT0gdGhpcy5lbW90ZXMpIHtcclxuXHRcdFx0c2V0c0NoYW5nZXMgPSBmYWxzZTtcclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHR0aGlzLmVtb3RlcyA9IHNldHM7XHJcblx0XHR9XHJcblx0fVxyXG5cdGlmKHRoaXMuX3NraXBVcGRhdGluZ0Vtb3Rlc2V0cykge1xyXG5cdFx0aWYoc2V0c0NoYW5nZXMpIHtcclxuXHRcdFx0dGhpcy5lbWl0KCdlbW90ZXNldHMnLCBzZXRzLCB7fSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cdGNvbnN0IHNldEVtb3Rlc2V0VGltZXIgPSAoKSA9PiB7XHJcblx0XHRpZih0aGlzLl91cGRhdGVFbW90ZXNldHNUaW1lckRlbGF5ID4gMCkge1xyXG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5fdXBkYXRlRW1vdGVzZXRzVGltZXIpO1xyXG5cdFx0XHR0aGlzLl91cGRhdGVFbW90ZXNldHNUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fdXBkYXRlRW1vdGVzZXQoc2V0cyksIHRoaXMuX3VwZGF0ZUVtb3Rlc2V0c1RpbWVyRGVsYXkpO1xyXG5cdFx0fVxyXG5cdH07XHJcblx0dGhpcy5fZ2V0VG9rZW4oKVxyXG5cdC50aGVuKHRva2VuID0+IHtcclxuXHRcdGNvbnN0IHVybCA9IGBodHRwczovL2FwaS50d2l0Y2gudHYva3Jha2VuL2NoYXQvZW1vdGljb25faW1hZ2VzP2Vtb3Rlc2V0cz0ke3NldHN9YDtcclxuXHRcdC8qKiBAdHlwZSB7aW1wb3J0KCdub2RlLWZldGNoJykuUmVxdWVzdEluaXR9ICovXHJcblx0XHRjb25zdCBmZXRjaE9wdGlvbnMgPSB7fTtcclxuXHRcdGlmKCdmZXRjaEFnZW50JyBpbiB0aGlzLm9wdHMuY29ubmVjdGlvbikge1xyXG5cdFx0XHRmZXRjaE9wdGlvbnMuYWdlbnQgPSB0aGlzLm9wdHMuY29ubmVjdGlvbi5mZXRjaEFnZW50O1xyXG5cdFx0fVxyXG5cdFx0LyoqIEB0eXBlIHtpbXBvcnQoJ25vZGUtZmV0Y2gnKS5SZXNwb25zZX0gKi9cclxuXHRcdHJldHVybiBfZmV0Y2godXJsLCB7XHJcblx0XHRcdC4uLmZldGNoT3B0aW9ucyxcclxuXHRcdFx0aGVhZGVyczoge1xyXG5cdFx0XHRcdCdBY2NlcHQnOiAnYXBwbGljYXRpb24vdm5kLnR3aXRjaHR2LnY1K2pzb24nLFxyXG5cdFx0XHRcdCdBdXRob3JpemF0aW9uJzogYE9BdXRoICR7Xy50b2tlbih0b2tlbil9YCxcclxuXHRcdFx0XHQnQ2xpZW50LUlEJzogdGhpcy5jbGllbnRJZFxyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9KVxyXG5cdC50aGVuKHJlcyA9PiByZXMuanNvbigpKVxyXG5cdC50aGVuKGRhdGEgPT4ge1xyXG5cdFx0dGhpcy5lbW90ZXNldHMgPSBkYXRhLmVtb3RpY29uX3NldHMgfHwge307XHJcblx0XHR0aGlzLmVtaXQoJ2Vtb3Rlc2V0cycsIHNldHMsIHRoaXMuZW1vdGVzZXRzKTtcclxuXHRcdHNldEVtb3Rlc2V0VGltZXIoKTtcclxuXHR9KVxyXG5cdC5jYXRjaCgoKSA9PiBzZXRFbW90ZXNldFRpbWVyKCkpO1xyXG59O1xyXG4vLyBHZXQgY3VycmVudCB1c2VybmFtZS4uXHJcbmNsaWVudC5wcm90b3R5cGUuZ2V0VXNlcm5hbWUgPSBmdW5jdGlvbiBnZXRVc2VybmFtZSgpIHtcclxuXHRyZXR1cm4gdGhpcy51c2VybmFtZTtcclxufTtcclxuLy8gR2V0IGN1cnJlbnQgb3B0aW9ucy4uXHJcbmNsaWVudC5wcm90b3R5cGUuZ2V0T3B0aW9ucyA9IGZ1bmN0aW9uIGdldE9wdGlvbnMoKSB7XHJcblx0cmV0dXJuIHRoaXMub3B0cztcclxufTtcclxuLy8gR2V0IGN1cnJlbnQgY2hhbm5lbHMuLlxyXG5jbGllbnQucHJvdG90eXBlLmdldENoYW5uZWxzID0gZnVuY3Rpb24gZ2V0Q2hhbm5lbHMoKSB7XHJcblx0cmV0dXJuIHRoaXMuY2hhbm5lbHM7XHJcbn07XHJcbi8vIENoZWNrIGlmIHVzZXJuYW1lIGlzIGEgbW9kZXJhdG9yIG9uIGEgY2hhbm5lbC4uXHJcbmNsaWVudC5wcm90b3R5cGUuaXNNb2QgPSBmdW5jdGlvbiBpc01vZChjaGFubmVsLCB1c2VybmFtZSkge1xyXG5cdGNvbnN0IGNoYW4gPSBfLmNoYW5uZWwoY2hhbm5lbCk7XHJcblx0aWYoIXRoaXMubW9kZXJhdG9yc1tjaGFuXSkgeyB0aGlzLm1vZGVyYXRvcnNbY2hhbl0gPSBbXTsgfVxyXG5cdHJldHVybiB0aGlzLm1vZGVyYXRvcnNbY2hhbl0uaW5jbHVkZXMoXy51c2VybmFtZSh1c2VybmFtZSkpO1xyXG59O1xyXG4vLyBHZXQgcmVhZHlTdGF0ZS4uXHJcbmNsaWVudC5wcm90b3R5cGUucmVhZHlTdGF0ZSA9IGZ1bmN0aW9uIHJlYWR5U3RhdGUoKSB7XHJcblx0aWYodGhpcy53cyA9PT0gbnVsbCkgeyByZXR1cm4gJ0NMT1NFRCc7IH1cclxuXHRyZXR1cm4gWyAnQ09OTkVDVElORycsICdPUEVOJywgJ0NMT1NJTkcnLCAnQ0xPU0VEJyBdW3RoaXMud3MucmVhZHlTdGF0ZV07XHJcbn07XHJcbi8vIERldGVybWluZSBpZiB0aGUgY2xpZW50IGhhcyBhIFdlYlNvY2tldCBhbmQgaXQncyBvcGVuLi5cclxuY2xpZW50LnByb3RvdHlwZS5faXNDb25uZWN0ZWQgPSBmdW5jdGlvbiBfaXNDb25uZWN0ZWQoKSB7XHJcblx0cmV0dXJuIHRoaXMud3MgIT09IG51bGwgJiYgdGhpcy53cy5yZWFkeVN0YXRlID09PSAxO1xyXG59O1xyXG4vLyBEaXNjb25uZWN0IGZyb20gc2VydmVyLi5cclxuY2xpZW50LnByb3RvdHlwZS5kaXNjb25uZWN0ID0gZnVuY3Rpb24gZGlzY29ubmVjdCgpIHtcclxuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG5cdFx0aWYodGhpcy53cyAhPT0gbnVsbCAmJiB0aGlzLndzLnJlYWR5U3RhdGUgIT09IDMpIHtcclxuXHRcdFx0dGhpcy53YXNDbG9zZUNhbGxlZCA9IHRydWU7XHJcblx0XHRcdHRoaXMubG9nLmluZm8oJ0Rpc2Nvbm5lY3RpbmcgZnJvbSBzZXJ2ZXIuLicpO1xyXG5cdFx0XHR0aGlzLndzLmNsb3NlKCk7XHJcblx0XHRcdHRoaXMub25jZSgnX3Byb21pc2VEaXNjb25uZWN0JywgKCkgPT4gcmVzb2x2ZShbIHRoaXMuc2VydmVyLCB+fnRoaXMucG9ydCBdKSk7XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0dGhpcy5sb2cuZXJyb3IoJ0Nhbm5vdCBkaXNjb25uZWN0IGZyb20gc2VydmVyLiBTb2NrZXQgaXMgbm90IG9wZW5lZCBvciBjb25uZWN0aW9uIGlzIGFscmVhZHkgY2xvc2luZy4nKTtcclxuXHRcdFx0cmVqZWN0KCdDYW5ub3QgZGlzY29ubmVjdCBmcm9tIHNlcnZlci4gU29ja2V0IGlzIG5vdCBvcGVuZWQgb3IgY29ubmVjdGlvbiBpcyBhbHJlYWR5IGNsb3NpbmcuJyk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn07XHJcbmNsaWVudC5wcm90b3R5cGUub2ZmID0gY2xpZW50LnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lcjtcclxuXHJcbi8vIEV4cG9zZSBldmVyeXRoaW5nLCBmb3IgYnJvd3NlciBhbmQgTm9kZS4uXHJcbmlmKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XHJcblx0bW9kdWxlLmV4cG9ydHMgPSBjbGllbnQ7XHJcbn1cclxuaWYodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuXHR3aW5kb3cudG1pID0ge1xyXG5cdFx0Y2xpZW50LFxyXG5cdFx0Q2xpZW50OiBjbGllbnRcclxuXHR9O1xyXG59XHJcbiIsImNvbnN0IF8gPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbi8vIEVuYWJsZSBmb2xsb3dlcnMtb25seSBtb2RlIG9uIGEgY2hhbm5lbC4uXG5mdW5jdGlvbiBmb2xsb3dlcnNvbmx5KGNoYW5uZWwsIG1pbnV0ZXMpIHtcblx0Y2hhbm5lbCA9IF8uY2hhbm5lbChjaGFubmVsKTtcblx0bWludXRlcyA9IF8uZ2V0KG1pbnV0ZXMsIDMwKTtcblx0Ly8gU2VuZCB0aGUgY29tbWFuZCB0byB0aGUgc2VydmVyIGFuZCByYWNlIHRoZSBQcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdHJldHVybiB0aGlzLl9zZW5kQ29tbWFuZChudWxsLCBjaGFubmVsLCBgL2ZvbGxvd2VycyAke21pbnV0ZXN9YCwgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdC8vIFJlY2VpdmVkIF9wcm9taXNlRm9sbG93ZXJzIGV2ZW50LCByZXNvbHZlIG9yIHJlamVjdC4uXG5cdFx0dGhpcy5vbmNlKCdfcHJvbWlzZUZvbGxvd2VycycsIGVyciA9PiB7XG5cdFx0XHRpZighZXJyKSB7IHJlc29sdmUoWyBjaGFubmVsLCB+fm1pbnV0ZXMgXSk7IH1cblx0XHRcdGVsc2UgeyByZWplY3QoZXJyKTsgfVxuXHRcdH0pO1xuXHR9KTtcbn1cblxuLy8gRGlzYWJsZSBmb2xsb3dlcnMtb25seSBtb2RlIG9uIGEgY2hhbm5lbC4uXG5mdW5jdGlvbiBmb2xsb3dlcnNvbmx5b2ZmKGNoYW5uZWwpIHtcblx0Y2hhbm5lbCA9IF8uY2hhbm5lbChjaGFubmVsKTtcblx0Ly8gU2VuZCB0aGUgY29tbWFuZCB0byB0aGUgc2VydmVyIGFuZCByYWNlIHRoZSBQcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdHJldHVybiB0aGlzLl9zZW5kQ29tbWFuZChudWxsLCBjaGFubmVsLCAnL2ZvbGxvd2Vyc29mZicsIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHQvLyBSZWNlaXZlZCBfcHJvbWlzZUZvbGxvd2Vyc29mZiBldmVudCwgcmVzb2x2ZSBvciByZWplY3QuLlxuXHRcdHRoaXMub25jZSgnX3Byb21pc2VGb2xsb3dlcnNvZmYnLCBlcnIgPT4ge1xuXHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCBdKTsgfVxuXHRcdFx0ZWxzZSB7IHJlamVjdChlcnIpOyB9XG5cdFx0fSk7XG5cdH0pO1xufVxuXG4vLyBMZWF2ZSBhIGNoYW5uZWwuLlxuZnVuY3Rpb24gcGFydChjaGFubmVsKSB7XG5cdGNoYW5uZWwgPSBfLmNoYW5uZWwoY2hhbm5lbCk7XG5cdC8vIFNlbmQgdGhlIGNvbW1hbmQgdG8gdGhlIHNlcnZlciBhbmQgcmFjZSB0aGUgUHJvbWlzZSBhZ2FpbnN0IGEgZGVsYXkuLlxuXHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQobnVsbCwgbnVsbCwgYFBBUlQgJHtjaGFubmVsfWAsIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHQvLyBSZWNlaXZlZCBfcHJvbWlzZVBhcnQgZXZlbnQsIHJlc29sdmUgb3IgcmVqZWN0Li5cblx0XHR0aGlzLm9uY2UoJ19wcm9taXNlUGFydCcsIGVyciA9PiB7XG5cdFx0XHRpZighZXJyKSB7IHJlc29sdmUoWyBjaGFubmVsIF0pOyB9XG5cdFx0XHRlbHNlIHsgcmVqZWN0KGVycik7IH1cblx0XHR9KTtcblx0fSk7XG59XG5cbi8vIEVuYWJsZSBSOUtCZXRhIG1vZGUgb24gYSBjaGFubmVsLi5cbmZ1bmN0aW9uIHI5a2JldGEoY2hhbm5lbCkge1xuXHRjaGFubmVsID0gXy5jaGFubmVsKGNoYW5uZWwpO1xuXHQvLyBTZW5kIHRoZSBjb21tYW5kIHRvIHRoZSBzZXJ2ZXIgYW5kIHJhY2UgdGhlIFByb21pc2UgYWdhaW5zdCBhIGRlbGF5Li5cblx0cmV0dXJuIHRoaXMuX3NlbmRDb21tYW5kKG51bGwsIGNoYW5uZWwsICcvcjlrYmV0YScsIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHQvLyBSZWNlaXZlZCBfcHJvbWlzZVI5a2JldGEgZXZlbnQsIHJlc29sdmUgb3IgcmVqZWN0Li5cblx0XHR0aGlzLm9uY2UoJ19wcm9taXNlUjlrYmV0YScsIGVyciA9PiB7XG5cdFx0XHRpZighZXJyKSB7IHJlc29sdmUoWyBjaGFubmVsIF0pOyB9XG5cdFx0XHRlbHNlIHsgcmVqZWN0KGVycik7IH1cblx0XHR9KTtcblx0fSk7XG59XG5cbi8vIERpc2FibGUgUjlLQmV0YSBtb2RlIG9uIGEgY2hhbm5lbC4uXG5mdW5jdGlvbiByOWtiZXRhb2ZmKGNoYW5uZWwpIHtcblx0Y2hhbm5lbCA9IF8uY2hhbm5lbChjaGFubmVsKTtcblx0Ly8gU2VuZCB0aGUgY29tbWFuZCB0byB0aGUgc2VydmVyIGFuZCByYWNlIHRoZSBQcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdHJldHVybiB0aGlzLl9zZW5kQ29tbWFuZChudWxsLCBjaGFubmVsLCAnL3I5a2JldGFvZmYnLCAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0Ly8gUmVjZWl2ZWQgX3Byb21pc2VSOWtiZXRhb2ZmIGV2ZW50LCByZXNvbHZlIG9yIHJlamVjdC4uXG5cdFx0dGhpcy5vbmNlKCdfcHJvbWlzZVI5a2JldGFvZmYnLCBlcnIgPT4ge1xuXHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCBdKTsgfVxuXHRcdFx0ZWxzZSB7IHJlamVjdChlcnIpOyB9XG5cdFx0fSk7XG5cdH0pO1xufVxuXG4vLyBFbmFibGUgc2xvdyBtb2RlIG9uIGEgY2hhbm5lbC4uXG5mdW5jdGlvbiBzbG93KGNoYW5uZWwsIHNlY29uZHMpIHtcblx0Y2hhbm5lbCA9IF8uY2hhbm5lbChjaGFubmVsKTtcblx0c2Vjb25kcyA9IF8uZ2V0KHNlY29uZHMsIDMwMCk7XG5cdC8vIFNlbmQgdGhlIGNvbW1hbmQgdG8gdGhlIHNlcnZlciBhbmQgcmFjZSB0aGUgUHJvbWlzZSBhZ2FpbnN0IGEgZGVsYXkuLlxuXHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQobnVsbCwgY2hhbm5lbCwgYC9zbG93ICR7c2Vjb25kc31gLCAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0Ly8gUmVjZWl2ZWQgX3Byb21pc2VTbG93IGV2ZW50LCByZXNvbHZlIG9yIHJlamVjdC4uXG5cdFx0dGhpcy5vbmNlKCdfcHJvbWlzZVNsb3cnLCBlcnIgPT4ge1xuXHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCwgfn5zZWNvbmRzIF0pOyB9XG5cdFx0XHRlbHNlIHsgcmVqZWN0KGVycik7IH1cblx0XHR9KTtcblx0fSk7XG59XG5cbi8vIERpc2FibGUgc2xvdyBtb2RlIG9uIGEgY2hhbm5lbC4uXG5mdW5jdGlvbiBzbG93b2ZmKGNoYW5uZWwpIHtcblx0Y2hhbm5lbCA9IF8uY2hhbm5lbChjaGFubmVsKTtcblx0Ly8gU2VuZCB0aGUgY29tbWFuZCB0byB0aGUgc2VydmVyIGFuZCByYWNlIHRoZSBQcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdHJldHVybiB0aGlzLl9zZW5kQ29tbWFuZChudWxsLCBjaGFubmVsLCAnL3Nsb3dvZmYnLCAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0Ly8gUmVjZWl2ZWQgX3Byb21pc2VTbG93b2ZmIGV2ZW50LCByZXNvbHZlIG9yIHJlamVjdC4uXG5cdFx0dGhpcy5vbmNlKCdfcHJvbWlzZVNsb3dvZmYnLCBlcnIgPT4ge1xuXHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCBdKTsgfVxuXHRcdFx0ZWxzZSB7IHJlamVjdChlcnIpOyB9XG5cdFx0fSk7XG5cdH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0Ly8gU2VuZCBhY3Rpb24gbWVzc2FnZSAoL21lIDxtZXNzYWdlPikgb24gYSBjaGFubmVsLi5cblx0YWN0aW9uKGNoYW5uZWwsIG1lc3NhZ2UpIHtcblx0XHRjaGFubmVsID0gXy5jaGFubmVsKGNoYW5uZWwpO1xuXHRcdG1lc3NhZ2UgPSBgXFx1MDAwMUFDVElPTiAke21lc3NhZ2V9XFx1MDAwMWA7XG5cdFx0Ly8gU2VuZCB0aGUgY29tbWFuZCB0byB0aGUgc2VydmVyIGFuZCByYWNlIHRoZSBQcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdFx0cmV0dXJuIHRoaXMuX3NlbmRNZXNzYWdlKHRoaXMuX2dldFByb21pc2VEZWxheSgpLCBjaGFubmVsLCBtZXNzYWdlLCAocmVzb2x2ZSwgX3JlamVjdCkgPT4ge1xuXHRcdFx0Ly8gQXQgdGhpcyB0aW1lLCB0aGVyZSBpcyBubyBwb3NzaWJsZSB3YXkgdG8gZGV0ZWN0IGlmIGEgbWVzc2FnZSBoYXMgYmVlbiBzZW50IGhhcyBiZWVuIGVhdGVuXG5cdFx0XHQvLyBieSB0aGUgc2VydmVyLCBzbyB3ZSBjYW4gb25seSByZXNvbHZlIHRoZSBQcm9taXNlLlxuXHRcdFx0cmVzb2x2ZShbIGNoYW5uZWwsIG1lc3NhZ2UgXSk7XG5cdFx0fSk7XG5cdH0sXG5cblx0Ly8gQmFuIHVzZXJuYW1lIG9uIGNoYW5uZWwuLlxuXHRiYW4oY2hhbm5lbCwgdXNlcm5hbWUsIHJlYXNvbikge1xuXHRcdGNoYW5uZWwgPSBfLmNoYW5uZWwoY2hhbm5lbCk7XG5cdFx0dXNlcm5hbWUgPSBfLnVzZXJuYW1lKHVzZXJuYW1lKTtcblx0XHRyZWFzb24gPSBfLmdldChyZWFzb24sICcnKTtcblx0XHQvLyBTZW5kIHRoZSBjb21tYW5kIHRvIHRoZSBzZXJ2ZXIgYW5kIHJhY2UgdGhlIFByb21pc2UgYWdhaW5zdCBhIGRlbGF5Li5cblx0XHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQobnVsbCwgY2hhbm5lbCwgYC9iYW4gJHt1c2VybmFtZX0gJHtyZWFzb259YCwgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0Ly8gUmVjZWl2ZWQgX3Byb21pc2VCYW4gZXZlbnQsIHJlc29sdmUgb3IgcmVqZWN0Li5cblx0XHRcdHRoaXMub25jZSgnX3Byb21pc2VCYW4nLCBlcnIgPT4ge1xuXHRcdFx0XHRpZighZXJyKSB7IHJlc29sdmUoWyBjaGFubmVsLCB1c2VybmFtZSwgcmVhc29uIF0pOyB9XG5cdFx0XHRcdGVsc2UgeyByZWplY3QoZXJyKTsgfVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0sXG5cblx0Ly8gQ2xlYXIgYWxsIG1lc3NhZ2VzIG9uIGEgY2hhbm5lbC4uXG5cdGNsZWFyKGNoYW5uZWwpIHtcblx0XHRjaGFubmVsID0gXy5jaGFubmVsKGNoYW5uZWwpO1xuXHRcdC8vIFNlbmQgdGhlIGNvbW1hbmQgdG8gdGhlIHNlcnZlciBhbmQgcmFjZSB0aGUgUHJvbWlzZSBhZ2FpbnN0IGEgZGVsYXkuLlxuXHRcdHJldHVybiB0aGlzLl9zZW5kQ29tbWFuZChudWxsLCBjaGFubmVsLCAnL2NsZWFyJywgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0Ly8gUmVjZWl2ZWQgX3Byb21pc2VDbGVhciBldmVudCwgcmVzb2x2ZSBvciByZWplY3QuLlxuXHRcdFx0dGhpcy5vbmNlKCdfcHJvbWlzZUNsZWFyJywgZXJyID0+IHtcblx0XHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCBdKTsgfVxuXHRcdFx0XHRlbHNlIHsgcmVqZWN0KGVycik7IH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9LFxuXG5cdC8vIENoYW5nZSB0aGUgY29sb3Igb2YgeW91ciB1c2VybmFtZS4uXG5cdGNvbG9yKGNoYW5uZWwsIG5ld0NvbG9yKSB7XG5cdFx0bmV3Q29sb3IgPSBfLmdldChuZXdDb2xvciwgY2hhbm5lbCk7XG5cdFx0Ly8gU2VuZCB0aGUgY29tbWFuZCB0byB0aGUgc2VydmVyIGFuZCByYWNlIHRoZSBQcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdFx0cmV0dXJuIHRoaXMuX3NlbmRDb21tYW5kKG51bGwsICcjdG1panMnLCBgL2NvbG9yICR7bmV3Q29sb3J9YCwgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0Ly8gUmVjZWl2ZWQgX3Byb21pc2VDb2xvciBldmVudCwgcmVzb2x2ZSBvciByZWplY3QuLlxuXHRcdFx0dGhpcy5vbmNlKCdfcHJvbWlzZUNvbG9yJywgZXJyID0+IHtcblx0XHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgbmV3Q29sb3IgXSk7IH1cblx0XHRcdFx0ZWxzZSB7IHJlamVjdChlcnIpOyB9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSxcblxuXHQvLyBSdW4gY29tbWVyY2lhbCBvbiBhIGNoYW5uZWwgZm9yIFggc2Vjb25kcy4uXG5cdGNvbW1lcmNpYWwoY2hhbm5lbCwgc2Vjb25kcykge1xuXHRcdGNoYW5uZWwgPSBfLmNoYW5uZWwoY2hhbm5lbCk7XG5cdFx0c2Vjb25kcyA9IF8uZ2V0KHNlY29uZHMsIDMwKTtcblx0XHQvLyBTZW5kIHRoZSBjb21tYW5kIHRvIHRoZSBzZXJ2ZXIgYW5kIHJhY2UgdGhlIFByb21pc2UgYWdhaW5zdCBhIGRlbGF5Li5cblx0XHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQobnVsbCwgY2hhbm5lbCwgYC9jb21tZXJjaWFsICR7c2Vjb25kc31gLCAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHQvLyBSZWNlaXZlZCBfcHJvbWlzZUNvbW1lcmNpYWwgZXZlbnQsIHJlc29sdmUgb3IgcmVqZWN0Li5cblx0XHRcdHRoaXMub25jZSgnX3Byb21pc2VDb21tZXJjaWFsJywgZXJyID0+IHtcblx0XHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCwgfn5zZWNvbmRzIF0pOyB9XG5cdFx0XHRcdGVsc2UgeyByZWplY3QoZXJyKTsgfVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0sXG5cdFxuXHQvLyBEZWxldGUgYSBzcGVjaWZpYyBtZXNzYWdlIG9uIGEgY2hhbm5lbFxuXHRkZWxldGVtZXNzYWdlKGNoYW5uZWwsIG1lc3NhZ2VVVUlEKSB7XG5cdFx0Y2hhbm5lbCA9IF8uY2hhbm5lbChjaGFubmVsKTtcblx0XHQvLyBTZW5kIHRoZSBjb21tYW5kIHRvIHRoZSBzZXJ2ZXIgYW5kIHJhY2UgdGhlIFByb21pc2UgYWdhaW5zdCBhIGRlbGF5Li5cblx0XHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQobnVsbCwgY2hhbm5lbCwgYC9kZWxldGUgJHttZXNzYWdlVVVJRH1gLCAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHQvLyBSZWNlaXZlZCBfcHJvbWlzZURlbGV0ZW1lc3NhZ2UgZXZlbnQsIHJlc29sdmUgb3IgcmVqZWN0Li5cblx0XHRcdHRoaXMub25jZSgnX3Byb21pc2VEZWxldGVtZXNzYWdlJywgZXJyID0+IHtcblx0XHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCBdKTsgfVxuXHRcdFx0XHRlbHNlIHsgcmVqZWN0KGVycik7IH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9LFxuXG5cdC8vIEVuYWJsZSBlbW90ZS1vbmx5IG1vZGUgb24gYSBjaGFubmVsLi5cblx0ZW1vdGVvbmx5KGNoYW5uZWwpIHtcblx0XHRjaGFubmVsID0gXy5jaGFubmVsKGNoYW5uZWwpO1xuXHRcdC8vIFNlbmQgdGhlIGNvbW1hbmQgdG8gdGhlIHNlcnZlciBhbmQgcmFjZSB0aGUgUHJvbWlzZSBhZ2FpbnN0IGEgZGVsYXkuLlxuXHRcdHJldHVybiB0aGlzLl9zZW5kQ29tbWFuZChudWxsLCBjaGFubmVsLCAnL2Vtb3Rlb25seScsIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdC8vIFJlY2VpdmVkIF9wcm9taXNlRW1vdGVvbmx5IGV2ZW50LCByZXNvbHZlIG9yIHJlamVjdC4uXG5cdFx0XHR0aGlzLm9uY2UoJ19wcm9taXNlRW1vdGVvbmx5JywgZXJyID0+IHtcblx0XHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCBdKTsgfVxuXHRcdFx0XHRlbHNlIHsgcmVqZWN0KGVycik7IH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9LFxuXG5cdC8vIERpc2FibGUgZW1vdGUtb25seSBtb2RlIG9uIGEgY2hhbm5lbC4uXG5cdGVtb3Rlb25seW9mZihjaGFubmVsKSB7XG5cdFx0Y2hhbm5lbCA9IF8uY2hhbm5lbChjaGFubmVsKTtcblx0XHQvLyBTZW5kIHRoZSBjb21tYW5kIHRvIHRoZSBzZXJ2ZXIgYW5kIHJhY2UgdGhlIFByb21pc2UgYWdhaW5zdCBhIGRlbGF5Li5cblx0XHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQobnVsbCwgY2hhbm5lbCwgJy9lbW90ZW9ubHlvZmYnLCAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHQvLyBSZWNlaXZlZCBfcHJvbWlzZUVtb3Rlb25seW9mZiBldmVudCwgcmVzb2x2ZSBvciByZWplY3QuLlxuXHRcdFx0dGhpcy5vbmNlKCdfcHJvbWlzZUVtb3Rlb25seW9mZicsIGVyciA9PiB7XG5cdFx0XHRcdGlmKCFlcnIpIHsgcmVzb2x2ZShbIGNoYW5uZWwgXSk7IH1cblx0XHRcdFx0ZWxzZSB7IHJlamVjdChlcnIpOyB9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSxcblxuXHQvLyBFbmFibGUgZm9sbG93ZXJzLW9ubHkgbW9kZSBvbiBhIGNoYW5uZWwuLlxuXHRmb2xsb3dlcnNvbmx5LFxuXG5cdC8vIEFsaWFzIGZvciBmb2xsb3dlcnNvbmx5KCkuLlxuXHRmb2xsb3dlcnNtb2RlOiBmb2xsb3dlcnNvbmx5LFxuXG5cdC8vIERpc2FibGUgZm9sbG93ZXJzLW9ubHkgbW9kZSBvbiBhIGNoYW5uZWwuLlxuXHRmb2xsb3dlcnNvbmx5b2ZmLFxuXG5cdC8vIEFsaWFzIGZvciBmb2xsb3dlcnNvbmx5b2ZmKCkuLlxuXHRmb2xsb3dlcnNtb2Rlb2ZmOiBmb2xsb3dlcnNvbmx5b2ZmLFxuXG5cdC8vIEhvc3QgYSBjaGFubmVsLi5cblx0aG9zdChjaGFubmVsLCB0YXJnZXQpIHtcblx0XHRjaGFubmVsID0gXy5jaGFubmVsKGNoYW5uZWwpO1xuXHRcdHRhcmdldCA9IF8udXNlcm5hbWUodGFyZ2V0KTtcblx0XHQvLyBTZW5kIHRoZSBjb21tYW5kIHRvIHRoZSBzZXJ2ZXIgYW5kIHJhY2UgdGhlIFByb21pc2UgYWdhaW5zdCBhIGRlbGF5Li5cblx0XHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQoMjAwMCwgY2hhbm5lbCwgYC9ob3N0ICR7dGFyZ2V0fWAsIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdC8vIFJlY2VpdmVkIF9wcm9taXNlSG9zdCBldmVudCwgcmVzb2x2ZSBvciByZWplY3QuLlxuXHRcdFx0dGhpcy5vbmNlKCdfcHJvbWlzZUhvc3QnLCAoZXJyLCByZW1haW5pbmcpID0+IHtcblx0XHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCwgdGFyZ2V0LCB+fnJlbWFpbmluZyBdKTsgfVxuXHRcdFx0XHRlbHNlIHsgcmVqZWN0KGVycik7IH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9LFxuXG5cdC8vIEpvaW4gYSBjaGFubmVsLi5cblx0am9pbihjaGFubmVsKSB7XG5cdFx0Y2hhbm5lbCA9IF8uY2hhbm5lbChjaGFubmVsKTtcblx0XHQvLyBTZW5kIHRoZSBjb21tYW5kIHRvIHRoZSBzZXJ2ZXIgLi5cblx0XHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQodW5kZWZpbmVkLCBudWxsLCBgSk9JTiAke2NoYW5uZWx9YCwgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnROYW1lID0gJ19wcm9taXNlSm9pbic7XG5cdFx0XHRsZXQgaGFzRnVsZmlsbGVkID0gZmFsc2U7XG5cdFx0XHRjb25zdCBsaXN0ZW5lciA9IChlcnIsIGpvaW5lZENoYW5uZWwpID0+IHtcblx0XHRcdFx0aWYoY2hhbm5lbCA9PT0gXy5jaGFubmVsKGpvaW5lZENoYW5uZWwpKSB7XG5cdFx0XHRcdFx0Ly8gUmVjZWl2ZWQgX3Byb21pc2VKb2luIGV2ZW50IGZvciB0aGUgdGFyZ2V0IGNoYW5uZWwsIHJlc29sdmUgb3IgcmVqZWN0Li5cblx0XHRcdFx0XHR0aGlzLnJlbW92ZUxpc3RlbmVyKGV2ZW50TmFtZSwgbGlzdGVuZXIpO1xuXHRcdFx0XHRcdGhhc0Z1bGZpbGxlZCA9IHRydWU7XG5cdFx0XHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCBdKTsgfVxuXHRcdFx0XHRcdGVsc2UgeyByZWplY3QoZXJyKTsgfVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5vbihldmVudE5hbWUsIGxpc3RlbmVyKTtcblx0XHRcdC8vIFJhY2UgdGhlIFByb21pc2UgYWdhaW5zdCBhIGRlbGF5Li5cblx0XHRcdGNvbnN0IGRlbGF5ID0gdGhpcy5fZ2V0UHJvbWlzZURlbGF5KCk7XG5cdFx0XHRfLnByb21pc2VEZWxheShkZWxheSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdGlmKCFoYXNGdWxmaWxsZWQpIHtcblx0XHRcdFx0XHR0aGlzLmVtaXQoZXZlbnROYW1lLCAnTm8gcmVzcG9uc2UgZnJvbSBUd2l0Y2guJywgY2hhbm5lbCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9LFxuXG5cdC8vIE1vZCB1c2VybmFtZSBvbiBjaGFubmVsLi5cblx0bW9kKGNoYW5uZWwsIHVzZXJuYW1lKSB7XG5cdFx0Y2hhbm5lbCA9IF8uY2hhbm5lbChjaGFubmVsKTtcblx0XHR1c2VybmFtZSA9IF8udXNlcm5hbWUodXNlcm5hbWUpO1xuXHRcdC8vIFNlbmQgdGhlIGNvbW1hbmQgdG8gdGhlIHNlcnZlciBhbmQgcmFjZSB0aGUgUHJvbWlzZSBhZ2FpbnN0IGEgZGVsYXkuLlxuXHRcdHJldHVybiB0aGlzLl9zZW5kQ29tbWFuZChudWxsLCBjaGFubmVsLCBgL21vZCAke3VzZXJuYW1lfWAsIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdC8vIFJlY2VpdmVkIF9wcm9taXNlTW9kIGV2ZW50LCByZXNvbHZlIG9yIHJlamVjdC4uXG5cdFx0XHR0aGlzLm9uY2UoJ19wcm9taXNlTW9kJywgZXJyID0+IHtcblx0XHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCwgdXNlcm5hbWUgXSk7IH1cblx0XHRcdFx0ZWxzZSB7IHJlamVjdChlcnIpOyB9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSxcblxuXHQvLyBHZXQgbGlzdCBvZiBtb2RzIG9uIGEgY2hhbm5lbC4uXG5cdG1vZHMoY2hhbm5lbCkge1xuXHRcdGNoYW5uZWwgPSBfLmNoYW5uZWwoY2hhbm5lbCk7XG5cdFx0Ly8gU2VuZCB0aGUgY29tbWFuZCB0byB0aGUgc2VydmVyIGFuZCByYWNlIHRoZSBQcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdFx0cmV0dXJuIHRoaXMuX3NlbmRDb21tYW5kKG51bGwsIGNoYW5uZWwsICcvbW9kcycsIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdC8vIFJlY2VpdmVkIF9wcm9taXNlTW9kcyBldmVudCwgcmVzb2x2ZSBvciByZWplY3QuLlxuXHRcdFx0dGhpcy5vbmNlKCdfcHJvbWlzZU1vZHMnLCAoZXJyLCBtb2RzKSA9PiB7XG5cdFx0XHRcdGlmKCFlcnIpIHtcblx0XHRcdFx0XHQvLyBVcGRhdGUgdGhlIGludGVybmFsIGxpc3Qgb2YgbW9kZXJhdG9ycy4uXG5cdFx0XHRcdFx0bW9kcy5mb3JFYWNoKHVzZXJuYW1lID0+IHtcblx0XHRcdFx0XHRcdGlmKCF0aGlzLm1vZGVyYXRvcnNbY2hhbm5lbF0pIHsgdGhpcy5tb2RlcmF0b3JzW2NoYW5uZWxdID0gW107IH1cblx0XHRcdFx0XHRcdGlmKCF0aGlzLm1vZGVyYXRvcnNbY2hhbm5lbF0uaW5jbHVkZXModXNlcm5hbWUpKSB7IHRoaXMubW9kZXJhdG9yc1tjaGFubmVsXS5wdXNoKHVzZXJuYW1lKTsgfVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHJlc29sdmUobW9kcyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7IHJlamVjdChlcnIpOyB9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSxcblxuXHQvLyBMZWF2ZSBhIGNoYW5uZWwuLlxuXHRwYXJ0LFxuXG5cdC8vIEFsaWFzIGZvciBwYXJ0KCkuLlxuXHRsZWF2ZTogcGFydCxcblxuXHQvLyBTZW5kIGEgcGluZyB0byB0aGUgc2VydmVyLi5cblx0cGluZygpIHtcblx0XHQvLyBTZW5kIHRoZSBjb21tYW5kIHRvIHRoZSBzZXJ2ZXIgYW5kIHJhY2UgdGhlIFByb21pc2UgYWdhaW5zdCBhIGRlbGF5Li5cblx0XHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQobnVsbCwgbnVsbCwgJ1BJTkcnLCAocmVzb2x2ZSwgX3JlamVjdCkgPT4ge1xuXHRcdFx0Ly8gVXBkYXRlIHRoZSBpbnRlcm5hbCBwaW5nIHRpbWVvdXQgY2hlY2sgaW50ZXJ2YWwuLlxuXHRcdFx0dGhpcy5sYXRlbmN5ID0gbmV3IERhdGUoKTtcblx0XHRcdHRoaXMucGluZ1RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0aWYodGhpcy53cyAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdHRoaXMud2FzQ2xvc2VDYWxsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHR0aGlzLmxvZy5lcnJvcignUGluZyB0aW1lb3V0LicpO1xuXHRcdFx0XHRcdHRoaXMud3MuY2xvc2UoKTtcblxuXHRcdFx0XHRcdGNsZWFySW50ZXJ2YWwodGhpcy5waW5nTG9vcCk7XG5cdFx0XHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMucGluZ1RpbWVvdXQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCBfLmdldCh0aGlzLm9wdHMuY29ubmVjdGlvbi50aW1lb3V0LCA5OTk5KSk7XG5cblx0XHRcdC8vIFJlY2VpdmVkIF9wcm9taXNlUGluZyBldmVudCwgcmVzb2x2ZSBvciByZWplY3QuLlxuXHRcdFx0dGhpcy5vbmNlKCdfcHJvbWlzZVBpbmcnLCBsYXRlbmN5ID0+IHJlc29sdmUoWyBwYXJzZUZsb2F0KGxhdGVuY3kpIF0pKTtcblx0XHR9KTtcblx0fSxcblxuXHQvLyBFbmFibGUgUjlLQmV0YSBtb2RlIG9uIGEgY2hhbm5lbC4uXG5cdHI5a2JldGEsXG5cblx0Ly8gQWxpYXMgZm9yIHI5a2JldGEoKS4uXG5cdHI5a21vZGU6IHI5a2JldGEsXG5cblx0Ly8gRGlzYWJsZSBSOUtCZXRhIG1vZGUgb24gYSBjaGFubmVsLi5cblx0cjlrYmV0YW9mZixcblxuXHQvLyBBbGlhcyBmb3IgcjlrYmV0YW9mZigpLi5cblx0cjlrbW9kZW9mZjogcjlrYmV0YW9mZixcblxuXHQvLyBTZW5kIGEgcmF3IG1lc3NhZ2UgdG8gdGhlIHNlcnZlci4uXG5cdHJhdyhtZXNzYWdlKSB7XG5cdFx0Ly8gU2VuZCB0aGUgY29tbWFuZCB0byB0aGUgc2VydmVyIGFuZCByYWNlIHRoZSBQcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdFx0cmV0dXJuIHRoaXMuX3NlbmRDb21tYW5kKG51bGwsIG51bGwsIG1lc3NhZ2UsIChyZXNvbHZlLCBfcmVqZWN0KSA9PiB7XG5cdFx0XHRyZXNvbHZlKFsgbWVzc2FnZSBdKTtcblx0XHR9KTtcblx0fSxcblxuXHQvLyBTZW5kIGEgbWVzc2FnZSBvbiBhIGNoYW5uZWwuLlxuXHRzYXkoY2hhbm5lbCwgbWVzc2FnZSkge1xuXHRcdGNoYW5uZWwgPSBfLmNoYW5uZWwoY2hhbm5lbCk7XG5cblx0XHRpZigobWVzc2FnZS5zdGFydHNXaXRoKCcuJykgJiYgIW1lc3NhZ2Uuc3RhcnRzV2l0aCgnLi4nKSkgfHwgbWVzc2FnZS5zdGFydHNXaXRoKCcvJykgfHwgbWVzc2FnZS5zdGFydHNXaXRoKCdcXFxcJykpIHtcblx0XHRcdC8vIENoZWNrIGlmIHRoZSBtZXNzYWdlIGlzIGFuIGFjdGlvbiBtZXNzYWdlLi5cblx0XHRcdGlmKG1lc3NhZ2Uuc3Vic3RyKDEsIDMpID09PSAnbWUgJykge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5hY3Rpb24oY2hhbm5lbCwgbWVzc2FnZS5zdWJzdHIoNCkpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdC8vIFNlbmQgdGhlIGNvbW1hbmQgdG8gdGhlIHNlcnZlciBhbmQgcmFjZSB0aGUgUHJvbWlzZSBhZ2FpbnN0IGEgZGVsYXkuLlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQobnVsbCwgY2hhbm5lbCwgbWVzc2FnZSwgKHJlc29sdmUsIF9yZWplY3QpID0+IHtcblx0XHRcdFx0XHQvLyBBdCB0aGlzIHRpbWUsIHRoZXJlIGlzIG5vIHBvc3NpYmxlIHdheSB0byBkZXRlY3QgaWYgYSBtZXNzYWdlIGhhcyBiZWVuIHNlbnQgaGFzIGJlZW4gZWF0ZW5cblx0XHRcdFx0XHQvLyBieSB0aGUgc2VydmVyLCBzbyB3ZSBjYW4gb25seSByZXNvbHZlIHRoZSBQcm9taXNlLlxuXHRcdFx0XHRcdHJlc29sdmUoWyBjaGFubmVsLCBtZXNzYWdlIF0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gU2VuZCB0aGUgY29tbWFuZCB0byB0aGUgc2VydmVyIGFuZCByYWNlIHRoZSBQcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdFx0cmV0dXJuIHRoaXMuX3NlbmRNZXNzYWdlKHRoaXMuX2dldFByb21pc2VEZWxheSgpLCBjaGFubmVsLCBtZXNzYWdlLCAocmVzb2x2ZSwgX3JlamVjdCkgPT4ge1xuXHRcdFx0Ly8gQXQgdGhpcyB0aW1lLCB0aGVyZSBpcyBubyBwb3NzaWJsZSB3YXkgdG8gZGV0ZWN0IGlmIGEgbWVzc2FnZSBoYXMgYmVlbiBzZW50IGhhcyBiZWVuIGVhdGVuXG5cdFx0XHQvLyBieSB0aGUgc2VydmVyLCBzbyB3ZSBjYW4gb25seSByZXNvbHZlIHRoZSBQcm9taXNlLlxuXHRcdFx0cmVzb2x2ZShbIGNoYW5uZWwsIG1lc3NhZ2UgXSk7XG5cdFx0fSk7XG5cdH0sXG5cblx0Ly8gRW5hYmxlIHNsb3cgbW9kZSBvbiBhIGNoYW5uZWwuLlxuXHRzbG93LFxuXG5cdC8vIEFsaWFzIGZvciBzbG93KCkuLlxuXHRzbG93bW9kZTogc2xvdyxcblxuXHQvLyBEaXNhYmxlIHNsb3cgbW9kZSBvbiBhIGNoYW5uZWwuLlxuXHRzbG93b2ZmLFxuXG5cdC8vIEFsaWFzIGZvciBzbG93b2ZmKCkuLlxuXHRzbG93bW9kZW9mZjogc2xvd29mZixcblxuXHQvLyBFbmFibGUgc3Vic2NyaWJlcnMgbW9kZSBvbiBhIGNoYW5uZWwuLlxuXHRzdWJzY3JpYmVycyhjaGFubmVsKSB7XG5cdFx0Y2hhbm5lbCA9IF8uY2hhbm5lbChjaGFubmVsKTtcblx0XHQvLyBTZW5kIHRoZSBjb21tYW5kIHRvIHRoZSBzZXJ2ZXIgYW5kIHJhY2UgdGhlIFByb21pc2UgYWdhaW5zdCBhIGRlbGF5Li5cblx0XHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQobnVsbCwgY2hhbm5lbCwgJy9zdWJzY3JpYmVycycsIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdC8vIFJlY2VpdmVkIF9wcm9taXNlU3Vic2NyaWJlcnMgZXZlbnQsIHJlc29sdmUgb3IgcmVqZWN0Li5cblx0XHRcdHRoaXMub25jZSgnX3Byb21pc2VTdWJzY3JpYmVycycsIGVyciA9PiB7XG5cdFx0XHRcdGlmKCFlcnIpIHsgcmVzb2x2ZShbIGNoYW5uZWwgXSk7IH1cblx0XHRcdFx0ZWxzZSB7IHJlamVjdChlcnIpOyB9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSxcblxuXHQvLyBEaXNhYmxlIHN1YnNjcmliZXJzIG1vZGUgb24gYSBjaGFubmVsLi5cblx0c3Vic2NyaWJlcnNvZmYoY2hhbm5lbCkge1xuXHRcdGNoYW5uZWwgPSBfLmNoYW5uZWwoY2hhbm5lbCk7XG5cdFx0Ly8gU2VuZCB0aGUgY29tbWFuZCB0byB0aGUgc2VydmVyIGFuZCByYWNlIHRoZSBQcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdFx0cmV0dXJuIHRoaXMuX3NlbmRDb21tYW5kKG51bGwsIGNoYW5uZWwsICcvc3Vic2NyaWJlcnNvZmYnLCAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHQvLyBSZWNlaXZlZCBfcHJvbWlzZVN1YnNjcmliZXJzb2ZmIGV2ZW50LCByZXNvbHZlIG9yIHJlamVjdC4uXG5cdFx0XHR0aGlzLm9uY2UoJ19wcm9taXNlU3Vic2NyaWJlcnNvZmYnLCBlcnIgPT4ge1xuXHRcdFx0XHRpZighZXJyKSB7IHJlc29sdmUoWyBjaGFubmVsIF0pOyB9XG5cdFx0XHRcdGVsc2UgeyByZWplY3QoZXJyKTsgfVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0sXG5cblx0Ly8gVGltZW91dCB1c2VybmFtZSBvbiBjaGFubmVsIGZvciBYIHNlY29uZHMuLlxuXHR0aW1lb3V0KGNoYW5uZWwsIHVzZXJuYW1lLCBzZWNvbmRzLCByZWFzb24pIHtcblx0XHRjaGFubmVsID0gXy5jaGFubmVsKGNoYW5uZWwpO1xuXHRcdHVzZXJuYW1lID0gXy51c2VybmFtZSh1c2VybmFtZSk7XG5cblx0XHRpZihzZWNvbmRzICE9PSBudWxsICYmICFfLmlzSW50ZWdlcihzZWNvbmRzKSkge1xuXHRcdFx0cmVhc29uID0gc2Vjb25kcztcblx0XHRcdHNlY29uZHMgPSAzMDA7XG5cdFx0fVxuXG5cdFx0c2Vjb25kcyA9IF8uZ2V0KHNlY29uZHMsIDMwMCk7XG5cdFx0cmVhc29uID0gXy5nZXQocmVhc29uLCAnJyk7XG5cdFx0Ly8gU2VuZCB0aGUgY29tbWFuZCB0byB0aGUgc2VydmVyIGFuZCByYWNlIHRoZSBQcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdFx0cmV0dXJuIHRoaXMuX3NlbmRDb21tYW5kKG51bGwsIGNoYW5uZWwsIGAvdGltZW91dCAke3VzZXJuYW1lfSAke3NlY29uZHN9ICR7cmVhc29ufWAsIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdC8vIFJlY2VpdmVkIF9wcm9taXNlVGltZW91dCBldmVudCwgcmVzb2x2ZSBvciByZWplY3QuLlxuXHRcdFx0dGhpcy5vbmNlKCdfcHJvbWlzZVRpbWVvdXQnLCBlcnIgPT4ge1xuXHRcdFx0XHRpZighZXJyKSB7IHJlc29sdmUoWyBjaGFubmVsLCB1c2VybmFtZSwgfn5zZWNvbmRzLCByZWFzb24gXSk7IH1cblx0XHRcdFx0ZWxzZSB7IHJlamVjdChlcnIpOyB9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSxcblxuXHQvLyBVbmJhbiB1c2VybmFtZSBvbiBjaGFubmVsLi5cblx0dW5iYW4oY2hhbm5lbCwgdXNlcm5hbWUpIHtcblx0XHRjaGFubmVsID0gXy5jaGFubmVsKGNoYW5uZWwpO1xuXHRcdHVzZXJuYW1lID0gXy51c2VybmFtZSh1c2VybmFtZSk7XG5cdFx0Ly8gU2VuZCB0aGUgY29tbWFuZCB0byB0aGUgc2VydmVyIGFuZCByYWNlIHRoZSBQcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdFx0cmV0dXJuIHRoaXMuX3NlbmRDb21tYW5kKG51bGwsIGNoYW5uZWwsIGAvdW5iYW4gJHt1c2VybmFtZX1gLCAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHQvLyBSZWNlaXZlZCBfcHJvbWlzZVVuYmFuIGV2ZW50LCByZXNvbHZlIG9yIHJlamVjdC4uXG5cdFx0XHR0aGlzLm9uY2UoJ19wcm9taXNlVW5iYW4nLCBlcnIgPT4ge1xuXHRcdFx0XHRpZighZXJyKSB7IHJlc29sdmUoWyBjaGFubmVsLCB1c2VybmFtZSBdKTsgfVxuXHRcdFx0XHRlbHNlIHsgcmVqZWN0KGVycik7IH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9LFxuXG5cdC8vIEVuZCB0aGUgY3VycmVudCBob3N0aW5nLi5cblx0dW5ob3N0KGNoYW5uZWwpIHtcblx0XHRjaGFubmVsID0gXy5jaGFubmVsKGNoYW5uZWwpO1xuXHRcdC8vIFNlbmQgdGhlIGNvbW1hbmQgdG8gdGhlIHNlcnZlciBhbmQgcmFjZSB0aGUgUHJvbWlzZSBhZ2FpbnN0IGEgZGVsYXkuLlxuXHRcdHJldHVybiB0aGlzLl9zZW5kQ29tbWFuZCgyMDAwLCBjaGFubmVsLCAnL3VuaG9zdCcsIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdC8vIFJlY2VpdmVkIF9wcm9taXNlVW5ob3N0IGV2ZW50LCByZXNvbHZlIG9yIHJlamVjdC4uXG5cdFx0XHR0aGlzLm9uY2UoJ19wcm9taXNlVW5ob3N0JywgZXJyID0+IHtcblx0XHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCBdKTsgfVxuXHRcdFx0XHRlbHNlIHsgcmVqZWN0KGVycik7IH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9LFxuXG5cdC8vIFVubW9kIHVzZXJuYW1lIG9uIGNoYW5uZWwuLlxuXHR1bm1vZChjaGFubmVsLCB1c2VybmFtZSkge1xuXHRcdGNoYW5uZWwgPSBfLmNoYW5uZWwoY2hhbm5lbCk7XG5cdFx0dXNlcm5hbWUgPSBfLnVzZXJuYW1lKHVzZXJuYW1lKTtcblx0XHQvLyBTZW5kIHRoZSBjb21tYW5kIHRvIHRoZSBzZXJ2ZXIgYW5kIHJhY2UgdGhlIFByb21pc2UgYWdhaW5zdCBhIGRlbGF5Li5cblx0XHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQobnVsbCwgY2hhbm5lbCwgYC91bm1vZCAke3VzZXJuYW1lfWAsIChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdC8vIFJlY2VpdmVkIF9wcm9taXNlVW5tb2QgZXZlbnQsIHJlc29sdmUgb3IgcmVqZWN0Li5cblx0XHRcdHRoaXMub25jZSgnX3Byb21pc2VVbm1vZCcsIGVyciA9PiB7XG5cdFx0XHRcdGlmKCFlcnIpIHsgcmVzb2x2ZShbIGNoYW5uZWwsIHVzZXJuYW1lIF0pOyB9XG5cdFx0XHRcdGVsc2UgeyByZWplY3QoZXJyKTsgfVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0sXG5cblx0Ly8gVW52aXAgdXNlcm5hbWUgb24gY2hhbm5lbC4uXG5cdHVudmlwKGNoYW5uZWwsIHVzZXJuYW1lKSB7XG5cdFx0Y2hhbm5lbCA9IF8uY2hhbm5lbChjaGFubmVsKTtcblx0XHR1c2VybmFtZSA9IF8udXNlcm5hbWUodXNlcm5hbWUpO1xuXHRcdC8vIFNlbmQgdGhlIGNvbW1hbmQgdG8gdGhlIHNlcnZlciBhbmQgcmFjZSB0aGUgUHJvbWlzZSBhZ2FpbnN0IGEgZGVsYXkuLlxuXHRcdHJldHVybiB0aGlzLl9zZW5kQ29tbWFuZChudWxsLCBjaGFubmVsLCBgL3VudmlwICR7dXNlcm5hbWV9YCwgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0Ly8gUmVjZWl2ZWQgX3Byb21pc2VVbnZpcCBldmVudCwgcmVzb2x2ZSBvciByZWplY3QuLlxuXHRcdFx0dGhpcy5vbmNlKCdfcHJvbWlzZVVudmlwJywgZXJyID0+IHtcblx0XHRcdFx0aWYoIWVycikgeyByZXNvbHZlKFsgY2hhbm5lbCwgdXNlcm5hbWUgXSk7IH1cblx0XHRcdFx0ZWxzZSB7IHJlamVjdChlcnIpOyB9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSxcblxuXHQvLyBBZGQgdXNlcm5hbWUgdG8gVklQIGxpc3Qgb24gY2hhbm5lbC4uXG5cdHZpcChjaGFubmVsLCB1c2VybmFtZSkge1xuXHRcdGNoYW5uZWwgPSBfLmNoYW5uZWwoY2hhbm5lbCk7XG5cdFx0dXNlcm5hbWUgPSBfLnVzZXJuYW1lKHVzZXJuYW1lKTtcblx0XHQvLyBTZW5kIHRoZSBjb21tYW5kIHRvIHRoZSBzZXJ2ZXIgYW5kIHJhY2UgdGhlIFByb21pc2UgYWdhaW5zdCBhIGRlbGF5Li5cblx0XHRyZXR1cm4gdGhpcy5fc2VuZENvbW1hbmQobnVsbCwgY2hhbm5lbCwgYC92aXAgJHt1c2VybmFtZX1gLCAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHQvLyBSZWNlaXZlZCBfcHJvbWlzZVZpcCBldmVudCwgcmVzb2x2ZSBvciByZWplY3QuLlxuXHRcdFx0dGhpcy5vbmNlKCdfcHJvbWlzZVZpcCcsIGVyciA9PiB7XG5cdFx0XHRcdGlmKCFlcnIpIHsgcmVzb2x2ZShbIGNoYW5uZWwsIHVzZXJuYW1lIF0pOyB9XG5cdFx0XHRcdGVsc2UgeyByZWplY3QoZXJyKTsgfVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0sXG5cblx0Ly8gR2V0IGxpc3Qgb2YgVklQcyBvbiBhIGNoYW5uZWwuLlxuXHR2aXBzKGNoYW5uZWwpIHtcblx0XHRjaGFubmVsID0gXy5jaGFubmVsKGNoYW5uZWwpO1xuXHRcdC8vIFNlbmQgdGhlIGNvbW1hbmQgdG8gdGhlIHNlcnZlciBhbmQgcmFjZSB0aGUgUHJvbWlzZSBhZ2FpbnN0IGEgZGVsYXkuLlxuXHRcdHJldHVybiB0aGlzLl9zZW5kQ29tbWFuZChudWxsLCBjaGFubmVsLCAnL3ZpcHMnLCAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHQvLyBSZWNlaXZlZCBfcHJvbWlzZVZpcHMgZXZlbnQsIHJlc29sdmUgb3IgcmVqZWN0Li5cblx0XHRcdHRoaXMub25jZSgnX3Byb21pc2VWaXBzJywgKGVyciwgdmlwcykgPT4ge1xuXHRcdFx0XHRpZighZXJyKSB7IHJlc29sdmUodmlwcyk7IH1cblx0XHRcdFx0ZWxzZSB7IHJlamVjdChlcnIpOyB9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSxcblxuXHQvLyBTZW5kIGFuIHdoaXNwZXIgbWVzc2FnZSB0byBhIHVzZXIuLlxuXHR3aGlzcGVyKHVzZXJuYW1lLCBtZXNzYWdlKSB7XG5cdFx0dXNlcm5hbWUgPSBfLnVzZXJuYW1lKHVzZXJuYW1lKTtcblxuXHRcdC8vIFRoZSBzZXJ2ZXIgd2lsbCBub3Qgc2VuZCBhIHdoaXNwZXIgdG8gdGhlIGFjY291bnQgdGhhdCBzZW50IGl0LlxuXHRcdGlmKHVzZXJuYW1lID09PSB0aGlzLmdldFVzZXJuYW1lKCkpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdCgnQ2Fubm90IHNlbmQgYSB3aGlzcGVyIHRvIHRoZSBzYW1lIGFjY291bnQuJyk7XG5cdFx0fVxuXHRcdC8vIFNlbmQgdGhlIGNvbW1hbmQgdG8gdGhlIHNlcnZlciBhbmQgcmFjZSB0aGUgUHJvbWlzZSBhZ2FpbnN0IGEgZGVsYXkuLlxuXHRcdHJldHVybiB0aGlzLl9zZW5kQ29tbWFuZChudWxsLCAnI3RtaWpzJywgYC93ICR7dXNlcm5hbWV9ICR7bWVzc2FnZX1gLCAoX3Jlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0dGhpcy5vbmNlKCdfcHJvbWlzZVdoaXNwZXInLCBlcnIgPT4ge1xuXHRcdFx0XHRpZiAoZXJyKSB7IHJlamVjdChlcnIpOyB9XG5cdFx0XHR9KTtcblx0XHR9KS5jYXRjaChlcnIgPT4ge1xuXHRcdFx0Ly8gRWl0aGVyIGFuIFwiYWN0dWFsXCIgZXJyb3Igb2NjdXJlZCBvciB0aGUgdGltZW91dCB0cmlnZ2VyZWRcblx0XHRcdC8vIHRoZSBsYXR0ZXIgbWVhbnMgbm8gZXJyb3JzIGhhdmUgb2NjdXJlZCBhbmQgd2UgY2FuIHJlc29sdmVcblx0XHRcdC8vIGVsc2UganVzdCBlbGV2YXRlIHRoZSBlcnJvclxuXHRcdFx0aWYoZXJyICYmIHR5cGVvZiBlcnIgPT09ICdzdHJpbmcnICYmIGVyci5pbmRleE9mKCdObyByZXNwb25zZSBmcm9tIFR3aXRjaC4nKSAhPT0gMCkge1xuXHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmcm9tID0gXy5jaGFubmVsKHVzZXJuYW1lKTtcblx0XHRcdGNvbnN0IHVzZXJzdGF0ZSA9IE9iamVjdC5hc3NpZ24oe1xuXHRcdFx0XHQnbWVzc2FnZS10eXBlJzogJ3doaXNwZXInLFxuXHRcdFx0XHQnbWVzc2FnZS1pZCc6IG51bGwsXG5cdFx0XHRcdCd0aHJlYWQtaWQnOiBudWxsLFxuXHRcdFx0XHR1c2VybmFtZTogdGhpcy5nZXRVc2VybmFtZSgpXG5cdFx0XHR9LCB0aGlzLmdsb2JhbHVzZXJzdGF0ZSk7XG5cblx0XHRcdC8vIEVtaXQgZm9yIGJvdGgsIHdoaXNwZXIgYW5kIG1lc3NhZ2UuLlxuXHRcdFx0dGhpcy5lbWl0cyhbICd3aGlzcGVyJywgJ21lc3NhZ2UnIF0sIFtcblx0XHRcdFx0WyBmcm9tLCB1c2Vyc3RhdGUsIG1lc3NhZ2UsIHRydWUgXSxcblx0XHRcdFx0WyBmcm9tLCB1c2Vyc3RhdGUsIG1lc3NhZ2UsIHRydWUgXVxuXHRcdFx0XSk7XG5cdFx0XHRyZXR1cm4gWyB1c2VybmFtZSwgbWVzc2FnZSBdO1xuXHRcdH0pO1xuXHR9XG59O1xuIiwiLyogaXN0YW5idWwgaWdub3JlIGZpbGUgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG4vKlxuICogQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4gKlxuICogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbiAqIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbiAqIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuICogd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuICogZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuICogcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4gKiBmb2xsb3dpbmcgY29uZGl0aW9uczpcbiAqXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuICogaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKlxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuICogT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuICogTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuICogTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4gKiBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1JcbiAqIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbiAqIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG4qL1xuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG5cdHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcblx0dGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG5cdGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpIHtcblx0XHR0aHJvdyBUeXBlRXJyb3IoXCJuIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXJcIik7XG5cdH1cblxuXHR0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuXG5cdHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuXHR2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG5cdGlmICghdGhpcy5fZXZlbnRzKSB7IHRoaXMuX2V2ZW50cyA9IHt9OyB9XG5cblx0Ly8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuXHRpZiAodHlwZSA9PT0gXCJlcnJvclwiKSB7XG5cdFx0aWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHwgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG5cdFx0XHRlciA9IGFyZ3VtZW50c1sxXTtcblx0XHRcdGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7IHRocm93IGVyOyB9XG5cdFx0XHR0aHJvdyBUeXBlRXJyb3IoXCJVbmNhdWdodCwgdW5zcGVjaWZpZWQgXFxcImVycm9yXFxcIiBldmVudC5cIik7XG5cdFx0fVxuXHR9XG5cblx0aGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuXHRpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpIHsgcmV0dXJuIGZhbHNlOyB9XG5cblx0aWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcblx0XHRzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcblx0XHRcdC8vIGZhc3QgY2FzZXNcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0aGFuZGxlci5jYWxsKHRoaXMpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0aGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAzOlxuXHRcdFx0XHRoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdFx0Ly8gc2xvd2VyXG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblx0XHRcdFx0aGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcblx0XHR9XG5cdH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcblx0XHRhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblx0XHRsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG5cdFx0bGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcblx0XHRmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHsgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpOyB9XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuXHR2YXIgbTtcblxuXHRpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKSB7IHRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTsgfVxuXG5cdGlmICghdGhpcy5fZXZlbnRzKSB7IHRoaXMuX2V2ZW50cyA9IHt9OyB9XG5cblx0Ly8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcblx0Ly8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuXHRpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKSB7XG5cdFx0dGhpcy5lbWl0KFwibmV3TGlzdGVuZXJcIiwgdHlwZSwgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgPyBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblx0fVxuXG5cdC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuXHRpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSkgeyB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjsgfVxuXHQvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG5cdGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHsgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpOyB9XG5cdC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuXHRlbHNlIHsgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdOyB9XG5cblx0Ly8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcblx0aWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcblx0XHRpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcblx0XHRcdG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcblx0XHR9XG5cblx0XHRpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuXHRcdFx0dGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG5cdFx0XHRjb25zb2xlLmVycm9yKFwiKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiBVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC5cIiwgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG5cdFx0XHQvLyBOb3Qgc3VwcG9ydGVkIGluIElFIDEwXG5cdFx0XHRpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRjb25zb2xlLnRyYWNlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuLy8gTW9kaWZpZWQgdG8gc3VwcG9ydCBtdWx0aXBsZSBjYWxscy4uXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuXHRpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKSB7IHRocm93IFR5cGVFcnJvcihcImxpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvblwiKTsgfVxuXG5cdHZhciBmaXJlZCA9IGZhbHNlO1xuXG5cdGlmICh0aGlzLl9ldmVudHMuaGFzT3duUHJvcGVydHkodHlwZSkgJiYgdHlwZS5jaGFyQXQoMCkgPT09IFwiX1wiKSB7XG5cdFx0dmFyIGNvdW50ID0gMTtcblx0XHR2YXIgc2VhcmNoRm9yID0gdHlwZTtcblxuXHRcdGZvciAodmFyIGsgaW4gdGhpcy5fZXZlbnRzKXtcblx0XHRcdGlmICh0aGlzLl9ldmVudHMuaGFzT3duUHJvcGVydHkoaykgJiYgay5zdGFydHNXaXRoKHNlYXJjaEZvcikpIHtcblx0XHRcdFx0Y291bnQrKztcblx0XHRcdH1cblx0XHR9XG5cdFx0dHlwZSA9IHR5cGUgKyBjb3VudDtcblx0fVxuXG5cdGZ1bmN0aW9uIGcoKSB7XG5cdFx0aWYgKHR5cGUuY2hhckF0KDApID09PSBcIl9cIiAmJiAhaXNOYU4odHlwZS5zdWJzdHIodHlwZS5sZW5ndGggLSAxKSkpIHtcblx0XHRcdHR5cGUgPSB0eXBlLnN1YnN0cmluZygwLCB0eXBlLmxlbmd0aCAtIDEpO1xuXHRcdH1cblx0XHR0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG5cdFx0aWYgKCFmaXJlZCkge1xuXHRcdFx0ZmlyZWQgPSB0cnVlO1xuXHRcdFx0bGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0XHR9XG5cdH1cblxuXHRnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG5cdHRoaXMub24odHlwZSwgZyk7XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuXG4vLyBFbWl0cyBhIFwicmVtb3ZlTGlzdGVuZXJcIiBldmVudCBpZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWQuLlxuLy8gTW9kaWZpZWQgdG8gc3VwcG9ydCBtdWx0aXBsZSBjYWxscyBmcm9tIC5vbmNlKCkuLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG5cdHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG5cdGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpIHsgdGhyb3cgVHlwZUVycm9yKFwibGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpOyB9XG5cblx0aWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSkgeyByZXR1cm4gdGhpczsgfVxuXG5cdGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cdGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuXHRwb3NpdGlvbiA9IC0xO1xuXHRpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHwgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG5cdFx0ZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuXHRcdGlmICh0aGlzLl9ldmVudHMuaGFzT3duUHJvcGVydHkodHlwZSArIFwiMlwiKSAmJiB0eXBlLmNoYXJBdCgwKSA9PT0gXCJfXCIpIHtcblx0XHRcdHZhciBzZWFyY2hGb3IgPSB0eXBlO1xuXHRcdFx0Zm9yICh2YXIgayBpbiB0aGlzLl9ldmVudHMpe1xuXHRcdFx0XHRpZiAodGhpcy5fZXZlbnRzLmhhc093blByb3BlcnR5KGspICYmIGsuc3RhcnRzV2l0aChzZWFyY2hGb3IpKSB7XG5cdFx0XHRcdFx0aWYgKCFpc05hTihwYXJzZUludChrLnN1YnN0cihrLmxlbmd0aCAtIDEpKSkpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2V2ZW50c1t0eXBlICsgcGFyc2VJbnQoay5zdWJzdHIoay5sZW5ndGggLSAxKSAtIDEpXSA9IHRoaXMuX2V2ZW50c1trXTtcblx0XHRcdFx0XHRcdGRlbGV0ZSB0aGlzLl9ldmVudHNba107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2V2ZW50c1t0eXBlXSA9IHRoaXMuX2V2ZW50c1t0eXBlICsgXCIxXCJdO1xuXHRcdFx0ZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlICsgXCIxXCJdO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7IHRoaXMuZW1pdChcInJlbW92ZUxpc3RlbmVyXCIsIHR5cGUsIGxpc3RlbmVyKTsgfVxuXHR9XG5cdGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG5cdFx0Zm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuXHRcdFx0aWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG5cdFx0XHRcdChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuXHRcdFx0XHRwb3NpdGlvbiA9IGk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChwb3NpdGlvbiA8IDApIHsgcmV0dXJuIHRoaXM7IH1cblxuXHRcdGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0bGlzdC5sZW5ndGggPSAwO1xuXHRcdFx0ZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblx0XHR9XG5cdFx0ZWxzZSB7IGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTsgfVxuXG5cdFx0aWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikgeyB0aGlzLmVtaXQoXCJyZW1vdmVMaXN0ZW5lclwiLCB0eXBlLCBsaXN0ZW5lcik7IH1cblx0fVxuXG5cdHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG5cdHZhciBrZXksIGxpc3RlbmVycztcblxuXHRpZiAoIXRoaXMuX2V2ZW50cykgeyByZXR1cm4gdGhpczsgfVxuXG5cdC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcblx0aWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcblx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgeyB0aGlzLl9ldmVudHMgPSB7fTsgfVxuXHRcdGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSkgeyBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdOyB9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHQvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcblx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcblx0XHRmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcblx0XHRcdGlmIChrZXkgPT09IFwicmVtb3ZlTGlzdGVuZXJcIikgeyBjb250aW51ZTsgfVxuXHRcdFx0dGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcblx0XHR9XG5cdFx0dGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoXCJyZW1vdmVMaXN0ZW5lclwiKTtcblx0XHR0aGlzLl9ldmVudHMgPSB7fTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuXHRpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7IHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTsgfVxuXHRlbHNlIGlmIChsaXN0ZW5lcnMpIHsgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpIHsgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTsgfSB9XG5cdGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcblx0dmFyIHJldDtcblx0aWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSkgeyByZXQgPSBbXTsgfVxuXHRlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpIHsgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07IH1cblx0ZWxzZSB7IHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpOyB9XG5cdHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG5cdGlmICh0aGlzLl9ldmVudHMpIHtcblx0XHR2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuXHRcdGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKSB7IHJldHVybiAxOyB9XG5cdFx0ZWxzZSBpZiAoZXZsaXN0ZW5lcikgeyByZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGg7IH1cblx0fVxuXHRyZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuXHRyZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcblx0cmV0dXJuIHR5cGVvZiBhcmcgPT09IFwiZnVuY3Rpb25cIjtcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG5cdHJldHVybiB0eXBlb2YgYXJnID09PSBcIm51bWJlclwiO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcblx0cmV0dXJuIHR5cGVvZiBhcmcgPT09IFwib2JqZWN0XCIgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcblx0cmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiY29uc3QgXyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcblxubGV0IGN1cnJlbnRMZXZlbCA9ICdpbmZvJztcbmNvbnN0IGxldmVscyA9IHsgJ3RyYWNlJzogMCwgJ2RlYnVnJzogMSwgJ2luZm8nOiAyLCAnd2Fybic6IDMsICdlcnJvcic6IDQsICdmYXRhbCc6IDUgfTtcblxuLy8gTG9nZ2VyIGltcGxlbWVudGF0aW9uLi5cbmZ1bmN0aW9uIGxvZyhsZXZlbCkge1xuXHQvLyBSZXR1cm4gYSBjb25zb2xlIG1lc3NhZ2UgZGVwZW5kaW5nIG9uIHRoZSBsb2dnaW5nIGxldmVsLi5cblx0cmV0dXJuIGZ1bmN0aW9uKG1lc3NhZ2UpIHtcblx0XHRpZihsZXZlbHNbbGV2ZWxdID49IGxldmVsc1tjdXJyZW50TGV2ZWxdKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhgWyR7Xy5mb3JtYXREYXRlKG5ldyBEYXRlKCkpfV0gJHtsZXZlbH06ICR7bWVzc2FnZX1gKTtcblx0XHR9XG5cdH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHQvLyBDaGFuZ2UgdGhlIGN1cnJlbnQgbG9nZ2luZyBsZXZlbC4uXG5cdHNldExldmVsKGxldmVsKSB7XG5cdFx0Y3VycmVudExldmVsID0gbGV2ZWw7XG5cdH0sXG5cdHRyYWNlOiBsb2coJ3RyYWNlJyksXG5cdGRlYnVnOiBsb2coJ2RlYnVnJyksXG5cdGluZm86IGxvZygnaW5mbycpLFxuXHR3YXJuOiBsb2coJ3dhcm4nKSxcblx0ZXJyb3I6IGxvZygnZXJyb3InKSxcblx0ZmF0YWw6IGxvZygnZmF0YWwnKVxufTtcbiIsIi8qXHJcblx0Q29weXJpZ2h0IChjKSAyMDEzLTIwMTUsIEZpb25uIEtlbGxlaGVyIEFsbCByaWdodHMgcmVzZXJ2ZWQuXHJcblxyXG5cdFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dCBtb2RpZmljYXRpb24sXHJcblx0YXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxyXG5cclxuXHRcdFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcclxuXHRcdHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXHJcblxyXG5cdFx0UmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxyXG5cdFx0dGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzXHJcblx0XHRwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXHJcblxyXG5cdFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIENPUFlSSUdIVCBIT0xERVJTIEFORCBDT05UUklCVVRPUlMgXCJBUyBJU1wiIEFORFxyXG5cdEFOWSBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXHJcblx0V0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELlxyXG5cdElOIE5PIEVWRU5UIFNIQUxMIFRIRSBDT1BZUklHSFQgSE9MREVSIE9SIENPTlRSSUJVVE9SUyBCRSBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsXHJcblx0SU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTXHJcblx0KElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSxcclxuXHRPUiBQUk9GSVRTOyBPUiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GIExJQUJJTElUWSxcclxuXHRXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkcgTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpXHJcblx0QVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFlcclxuXHRPRiBTVUNIIERBTUFHRS5cclxuKi9cclxuY29uc3QgXyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcclxuY29uc3Qgbm9uc3BhY2VSZWdleCA9IC9cXFMrL2c7XHJcblxyXG5mdW5jdGlvbiBwYXJzZUNvbXBsZXhUYWcodGFncywgdGFnS2V5LCBzcGxBID0gJywnLCBzcGxCID0gJy8nLCBzcGxDKSB7XHJcblx0Y29uc3QgcmF3ID0gdGFnc1t0YWdLZXldO1xyXG5cdFxyXG5cdGlmKHJhdyA9PT0gdW5kZWZpbmVkKSB7XHJcblx0XHRyZXR1cm4gdGFncztcclxuXHR9XHJcblxyXG5cdGNvbnN0IHRhZ0lzU3RyaW5nID0gdHlwZW9mIHJhdyA9PT0gJ3N0cmluZyc7XHJcblx0dGFnc1t0YWdLZXkgKyAnLXJhdyddID0gdGFnSXNTdHJpbmcgPyByYXcgOiBudWxsO1xyXG5cclxuXHRpZihyYXcgPT09IHRydWUpIHtcclxuXHRcdHRhZ3NbdGFnS2V5XSA9IG51bGw7XHJcblx0XHRyZXR1cm4gdGFncztcclxuXHR9XHJcblxyXG5cdHRhZ3NbdGFnS2V5XSA9IHt9O1xyXG5cclxuXHRpZih0YWdJc1N0cmluZykge1xyXG5cdFx0Y29uc3Qgc3BsID0gcmF3LnNwbGl0KHNwbEEpO1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc3BsLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGNvbnN0IHBhcnRzID0gc3BsW2ldLnNwbGl0KHNwbEIpO1xyXG5cdFx0XHRsZXQgdmFsID0gcGFydHNbMV07XHJcblx0XHRcdGlmKHNwbEMgIT09IHVuZGVmaW5lZCAmJiB2YWwpIHtcclxuXHRcdFx0XHR2YWwgPSB2YWwuc3BsaXQoc3BsQyk7XHJcblx0XHRcdH1cclxuXHRcdFx0dGFnc1t0YWdLZXldW3BhcnRzWzBdXSA9IHZhbCB8fCBudWxsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gdGFncztcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcblx0Ly8gUGFyc2UgVHdpdGNoIGJhZGdlcy4uXHJcblx0YmFkZ2VzOiB0YWdzID0+IHBhcnNlQ29tcGxleFRhZyh0YWdzLCAnYmFkZ2VzJyksXHJcblxyXG5cdC8vIFBhcnNlIFR3aXRjaCBiYWRnZS1pbmZvLi5cclxuXHRiYWRnZUluZm86IHRhZ3MgPT4gcGFyc2VDb21wbGV4VGFnKHRhZ3MsICdiYWRnZS1pbmZvJyksXHJcblxyXG5cdC8vIFBhcnNlIFR3aXRjaCBlbW90ZXMuLlxyXG5cdGVtb3RlczogdGFncyA9PiBwYXJzZUNvbXBsZXhUYWcodGFncywgJ2Vtb3RlcycsICcvJywgJzonLCAnLCcpLFxyXG5cclxuXHQvLyBQYXJzZSByZWdleCBlbW90ZXMuLlxyXG5cdGVtb3RlUmVnZXgobXNnLCBjb2RlLCBpZCwgb2JqKSB7XHJcblx0XHRub25zcGFjZVJlZ2V4Lmxhc3RJbmRleCA9IDA7XHJcblx0XHRjb25zdCByZWdleCA9IG5ldyBSZWdFeHAoJyhcXFxcYnxefFxcXFxzKScgKyBfLnVuZXNjYXBlSHRtbChjb2RlKSArICcoXFxcXGJ8JHxcXFxccyknKTtcclxuXHRcdGxldCBtYXRjaDtcclxuXHJcblx0XHQvLyBDaGVjayBpZiBlbW90ZSBjb2RlIG1hdGNoZXMgdXNpbmcgUmVnRXhwIGFuZCBwdXNoIGl0IHRvIHRoZSBvYmplY3QuLlxyXG5cdFx0d2hpbGUgKChtYXRjaCA9IG5vbnNwYWNlUmVnZXguZXhlYyhtc2cpKSAhPT0gbnVsbCkge1xyXG5cdFx0XHRpZihyZWdleC50ZXN0KG1hdGNoWzBdKSkge1xyXG5cdFx0XHRcdG9ialtpZF0gPSBvYmpbaWRdIHx8IFtdO1xyXG5cdFx0XHRcdG9ialtpZF0ucHVzaChbIG1hdGNoLmluZGV4LCBub25zcGFjZVJlZ2V4Lmxhc3RJbmRleCAtIDEgXSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHQvLyBQYXJzZSBzdHJpbmcgZW1vdGVzLi5cclxuXHRlbW90ZVN0cmluZyhtc2csIGNvZGUsIGlkLCBvYmopIHtcclxuXHRcdG5vbnNwYWNlUmVnZXgubGFzdEluZGV4ID0gMDtcclxuXHRcdGxldCBtYXRjaDtcclxuXHJcblx0XHQvLyBDaGVjayBpZiBlbW90ZSBjb2RlIG1hdGNoZXMgYW5kIHB1c2ggaXQgdG8gdGhlIG9iamVjdC4uXHJcblx0XHR3aGlsZSAoKG1hdGNoID0gbm9uc3BhY2VSZWdleC5leGVjKG1zZykpICE9PSBudWxsKSB7XHJcblx0XHRcdGlmKG1hdGNoWzBdID09PSBfLnVuZXNjYXBlSHRtbChjb2RlKSkge1xyXG5cdFx0XHRcdG9ialtpZF0gPSBvYmpbaWRdIHx8IFtdO1xyXG5cdFx0XHRcdG9ialtpZF0ucHVzaChbIG1hdGNoLmluZGV4LCBub25zcGFjZVJlZ2V4Lmxhc3RJbmRleCAtIDEgXSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LFxyXG5cclxuXHQvLyBUcmFuc2Zvcm0gdGhlIGVtb3RlcyBvYmplY3QgdG8gYSBzdHJpbmcgd2l0aCB0aGUgZm9sbG93aW5nIGZvcm1hdC4uXHJcblx0Ly8gZW1vdGVfaWQ6Zmlyc3RfaW5kZXgtbGFzdF9pbmRleCxhbm90aGVyX2ZpcnN0LWFub3RoZXJfbGFzdC9hbm90aGVyX2Vtb3RlX2lkOmZpcnN0X2luZGV4LWxhc3RfaW5kZXhcclxuXHR0cmFuc2Zvcm1FbW90ZXMoZW1vdGVzKSB7XHJcblx0XHRsZXQgdHJhbnNmb3JtZWQgPSAnJztcclxuXHJcblx0XHRPYmplY3Qua2V5cyhlbW90ZXMpLmZvckVhY2goaWQgPT4ge1xyXG5cdFx0XHR0cmFuc2Zvcm1lZCA9IGAke3RyYW5zZm9ybWVkK2lkfTpgO1xyXG5cdFx0XHRlbW90ZXNbaWRdLmZvckVhY2goXHJcblx0XHRcdFx0aW5kZXggPT4gdHJhbnNmb3JtZWQgPSBgJHt0cmFuc2Zvcm1lZCtpbmRleC5qb2luKCctJyl9LGBcclxuXHRcdFx0KTtcclxuXHRcdFx0dHJhbnNmb3JtZWQgPSBgJHt0cmFuc2Zvcm1lZC5zbGljZSgwLCAtMSl9L2A7XHJcblx0XHR9KTtcclxuXHRcdHJldHVybiB0cmFuc2Zvcm1lZC5zbGljZSgwLCAtMSk7XHJcblx0fSxcclxuXHJcblx0Zm9ybVRhZ3ModGFncykge1xyXG5cdFx0Y29uc3QgcmVzdWx0ID0gW107XHJcblx0XHRmb3IoY29uc3Qga2V5IGluIHRhZ3MpIHtcclxuXHRcdFx0Y29uc3QgdmFsdWUgPSBfLmVzY2FwZUlSQyh0YWdzW2tleV0pO1xyXG5cdFx0XHRyZXN1bHQucHVzaChgJHtrZXl9PSR7dmFsdWV9YCk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gYEAke3Jlc3VsdC5qb2luKCc7Jyl9YDtcclxuXHR9LFxyXG5cclxuXHQvLyBQYXJzZSBUd2l0Y2ggbWVzc2FnZXMuLlxyXG5cdG1zZyhkYXRhKSB7XHJcblx0XHRjb25zdCBtZXNzYWdlID0ge1xyXG5cdFx0XHRyYXc6IGRhdGEsXHJcblx0XHRcdHRhZ3M6IHt9LFxyXG5cdFx0XHRwcmVmaXg6IG51bGwsXHJcblx0XHRcdGNvbW1hbmQ6IG51bGwsXHJcblx0XHRcdHBhcmFtczogW11cclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gUG9zaXRpb24gYW5kIG5leHRzcGFjZSBhcmUgdXNlZCBieSB0aGUgcGFyc2VyIGFzIGEgcmVmZXJlbmNlLi5cclxuXHRcdGxldCBwb3NpdGlvbiA9IDA7XHJcblx0XHRsZXQgbmV4dHNwYWNlID0gMDtcclxuXHJcblx0XHQvLyBUaGUgZmlyc3QgdGhpbmcgd2UgY2hlY2sgZm9yIGlzIElSQ3YzLjIgbWVzc2FnZSB0YWdzLlxyXG5cdFx0Ly8gaHR0cDovL2lyY3YzLmF0aGVtZS5vcmcvc3BlY2lmaWNhdGlvbi9tZXNzYWdlLXRhZ3MtMy4yXHJcblx0XHRpZihkYXRhLmNoYXJDb2RlQXQoMCkgPT09IDY0KSB7XHJcblx0XHRcdG5leHRzcGFjZSA9IGRhdGEuaW5kZXhPZignICcpO1xyXG5cclxuXHRcdFx0Ly8gTWFsZm9ybWVkIElSQyBtZXNzYWdlLi5cclxuXHRcdFx0aWYobmV4dHNwYWNlID09PSAtMSkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBUYWdzIGFyZSBzcGxpdCBieSBhIHNlbWkgY29sb24uLlxyXG5cdFx0XHRjb25zdCByYXdUYWdzID0gZGF0YS5zbGljZSgxLCBuZXh0c3BhY2UpLnNwbGl0KCc7Jyk7XHJcblxyXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHJhd1RhZ3MubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHQvLyBUYWdzIGRlbGltaXRlZCBieSBhbiBlcXVhbHMgc2lnbiBhcmUga2V5PXZhbHVlIHRhZ3MuXHJcblx0XHRcdFx0Ly8gSWYgdGhlcmUncyBubyBlcXVhbHMsIHdlIGFzc2lnbiB0aGUgdGFnIGEgdmFsdWUgb2YgdHJ1ZS5cclxuXHRcdFx0XHRjb25zdCB0YWcgPSByYXdUYWdzW2ldO1xyXG5cdFx0XHRcdGNvbnN0IHBhaXIgPSB0YWcuc3BsaXQoJz0nKTtcclxuXHRcdFx0XHRtZXNzYWdlLnRhZ3NbcGFpclswXV0gPSB0YWcuc3Vic3RyaW5nKHRhZy5pbmRleE9mKCc9JykgKyAxKSB8fCB0cnVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRwb3NpdGlvbiA9IG5leHRzcGFjZSArIDE7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gU2tpcCBhbnkgdHJhaWxpbmcgd2hpdGVzcGFjZS4uXHJcblx0XHR3aGlsZSAoZGF0YS5jaGFyQ29kZUF0KHBvc2l0aW9uKSA9PT0gMzIpIHtcclxuXHRcdFx0cG9zaXRpb24rKztcclxuXHRcdH1cclxuXHJcblx0XHQvLyBFeHRyYWN0IHRoZSBtZXNzYWdlJ3MgcHJlZml4IGlmIHByZXNlbnQuIFByZWZpeGVzIGFyZSBwcmVwZW5kZWQgd2l0aCBhIGNvbG9uLi5cclxuXHRcdGlmKGRhdGEuY2hhckNvZGVBdChwb3NpdGlvbikgPT09IDU4KSB7XHJcblx0XHRcdG5leHRzcGFjZSA9IGRhdGEuaW5kZXhPZignICcsIHBvc2l0aW9uKTtcclxuXHJcblx0XHRcdC8vIElmIHRoZXJlJ3Mgbm90aGluZyBhZnRlciB0aGUgcHJlZml4LCBkZWVtIHRoaXMgbWVzc2FnZSB0byBiZSBtYWxmb3JtZWQuXHJcblx0XHRcdGlmKG5leHRzcGFjZSA9PT0gLTEpIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bWVzc2FnZS5wcmVmaXggPSBkYXRhLnNsaWNlKHBvc2l0aW9uICsgMSwgbmV4dHNwYWNlKTtcclxuXHRcdFx0cG9zaXRpb24gPSBuZXh0c3BhY2UgKyAxO1xyXG5cclxuXHRcdFx0Ly8gU2tpcCBhbnkgdHJhaWxpbmcgd2hpdGVzcGFjZS4uXHJcblx0XHRcdHdoaWxlIChkYXRhLmNoYXJDb2RlQXQocG9zaXRpb24pID09PSAzMikge1xyXG5cdFx0XHRcdHBvc2l0aW9uKys7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRuZXh0c3BhY2UgPSBkYXRhLmluZGV4T2YoJyAnLCBwb3NpdGlvbik7XHJcblxyXG5cdFx0Ly8gSWYgdGhlcmUncyBubyBtb3JlIHdoaXRlc3BhY2UgbGVmdCwgZXh0cmFjdCBldmVyeXRoaW5nIGZyb20gdGhlXHJcblx0XHQvLyBjdXJyZW50IHBvc2l0aW9uIHRvIHRoZSBlbmQgb2YgdGhlIHN0cmluZyBhcyB0aGUgY29tbWFuZC4uXHJcblx0XHRpZihuZXh0c3BhY2UgPT09IC0xKSB7XHJcblx0XHRcdGlmKGRhdGEubGVuZ3RoID4gcG9zaXRpb24pIHtcclxuXHRcdFx0XHRtZXNzYWdlLmNvbW1hbmQgPSBkYXRhLnNsaWNlKHBvc2l0aW9uKTtcclxuXHRcdFx0XHRyZXR1cm4gbWVzc2FnZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBFbHNlLCB0aGUgY29tbWFuZCBpcyB0aGUgY3VycmVudCBwb3NpdGlvbiB1cCB0byB0aGUgbmV4dCBzcGFjZS4gQWZ0ZXJcclxuXHRcdC8vIHRoYXQsIHdlIGV4cGVjdCBzb21lIHBhcmFtZXRlcnMuXHJcblx0XHRtZXNzYWdlLmNvbW1hbmQgPSBkYXRhLnNsaWNlKHBvc2l0aW9uLCBuZXh0c3BhY2UpO1xyXG5cclxuXHRcdHBvc2l0aW9uID0gbmV4dHNwYWNlICsgMTtcclxuXHJcblx0XHQvLyBTa2lwIGFueSB0cmFpbGluZyB3aGl0ZXNwYWNlLi5cclxuXHRcdHdoaWxlIChkYXRhLmNoYXJDb2RlQXQocG9zaXRpb24pID09PSAzMikge1xyXG5cdFx0XHRwb3NpdGlvbisrO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdoaWxlIChwb3NpdGlvbiA8IGRhdGEubGVuZ3RoKSB7XHJcblx0XHRcdG5leHRzcGFjZSA9IGRhdGEuaW5kZXhPZignICcsIHBvc2l0aW9uKTtcclxuXHJcblx0XHRcdC8vIElmIHRoZSBjaGFyYWN0ZXIgaXMgYSBjb2xvbiwgd2UndmUgZ290IGEgdHJhaWxpbmcgcGFyYW1ldGVyLlxyXG5cdFx0XHQvLyBBdCB0aGlzIHBvaW50LCB0aGVyZSBhcmUgbm8gZXh0cmEgcGFyYW1zLCBzbyB3ZSBwdXNoIGV2ZXJ5dGhpbmdcclxuXHRcdFx0Ly8gZnJvbSBhZnRlciB0aGUgY29sb24gdG8gdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCB0byB0aGUgcGFyYW1zIGFycmF5XHJcblx0XHRcdC8vIGFuZCBicmVhayBvdXQgb2YgdGhlIGxvb3AuXHJcblx0XHRcdGlmKGRhdGEuY2hhckNvZGVBdChwb3NpdGlvbikgPT09IDU4KSB7XHJcblx0XHRcdFx0bWVzc2FnZS5wYXJhbXMucHVzaChkYXRhLnNsaWNlKHBvc2l0aW9uICsgMSkpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBJZiB3ZSBzdGlsbCBoYXZlIHNvbWUgd2hpdGVzcGFjZS4uLlxyXG5cdFx0XHRpZihuZXh0c3BhY2UgIT09IC0xKSB7XHJcblx0XHRcdFx0Ly8gUHVzaCB3aGF0ZXZlcidzIGJldHdlZW4gdGhlIGN1cnJlbnQgcG9zaXRpb24gYW5kIHRoZSBuZXh0XHJcblx0XHRcdFx0Ly8gc3BhY2UgdG8gdGhlIHBhcmFtcyBhcnJheS5cclxuXHRcdFx0XHRtZXNzYWdlLnBhcmFtcy5wdXNoKGRhdGEuc2xpY2UocG9zaXRpb24sIG5leHRzcGFjZSkpO1xyXG5cdFx0XHRcdHBvc2l0aW9uID0gbmV4dHNwYWNlICsgMTtcclxuXHJcblx0XHRcdFx0Ly8gU2tpcCBhbnkgdHJhaWxpbmcgd2hpdGVzcGFjZSBhbmQgY29udGludWUgbG9vcGluZy5cclxuXHRcdFx0XHR3aGlsZSAoZGF0YS5jaGFyQ29kZUF0KHBvc2l0aW9uKSA9PT0gMzIpIHtcclxuXHRcdFx0XHRcdHBvc2l0aW9uKys7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gSWYgd2UgZG9uJ3QgaGF2ZSBhbnkgbW9yZSB3aGl0ZXNwYWNlIGFuZCB0aGUgcGFyYW0gaXNuJ3QgdHJhaWxpbmcsXHJcblx0XHRcdC8vIHB1c2ggZXZlcnl0aGluZyByZW1haW5pbmcgdG8gdGhlIHBhcmFtcyBhcnJheS5cclxuXHRcdFx0aWYobmV4dHNwYWNlID09PSAtMSkge1xyXG5cdFx0XHRcdG1lc3NhZ2UucGFyYW1zLnB1c2goZGF0YS5zbGljZShwb3NpdGlvbikpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gbWVzc2FnZTtcclxuXHR9XHJcbn07XHJcbiIsIi8vIEluaXRpYWxpemUgdGhlIHF1ZXVlIHdpdGggYSBzcGVjaWZpYyBkZWxheS4uXG5jbGFzcyBRdWV1ZSB7XG5cdGNvbnN0cnVjdG9yKGRlZmF1bHREZWxheSkge1xuXHRcdHRoaXMucXVldWUgPSBbXTtcblx0XHR0aGlzLmluZGV4ID0gMDtcblx0XHR0aGlzLmRlZmF1bHREZWxheSA9IGRlZmF1bHREZWxheSA9PT0gdW5kZWZpbmVkID8gMzAwMCA6IGRlZmF1bHREZWxheTtcblx0fVxuXHQvLyBBZGQgYSBuZXcgZnVuY3Rpb24gdG8gdGhlIHF1ZXVlLi5cblx0YWRkKGZuLCBkZWxheSkge1xuXHRcdHRoaXMucXVldWUucHVzaCh7IGZuLCBkZWxheSB9KTtcblx0fVxuXHQvLyBHbyB0byB0aGUgbmV4dCBpbiBxdWV1ZS4uXG5cdG5leHQoKSB7XG5cdFx0Y29uc3QgaSA9IHRoaXMuaW5kZXgrKztcblx0XHRjb25zdCBhdCA9IHRoaXMucXVldWVbaV07XG5cdFx0aWYoIWF0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IG5leHQgPSB0aGlzLnF1ZXVlW3RoaXMuaW5kZXhdO1xuXHRcdGF0LmZuKCk7XG5cdFx0aWYobmV4dCkge1xuXHRcdFx0Y29uc3QgZGVsYXkgPSBuZXh0LmRlbGF5ID09PSB1bmRlZmluZWQgPyB0aGlzLmRlZmF1bHREZWxheSA6IG5leHQuZGVsYXk7XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHRoaXMubmV4dCgpLCBkZWxheSk7XG5cdFx0fVxuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUXVldWU7XG4iLCIvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29udHJvbC1yZWdleFxuY29uc3QgYWN0aW9uTWVzc2FnZVJlZ2V4ID0gL15cXHUwMDAxQUNUSU9OIChbXlxcdTAwMDFdKylcXHUwMDAxJC87XG5jb25zdCBqdXN0aW5GYW5SZWdleCA9IC9eKGp1c3RpbmZhbikoXFxkKyQpLztcbmNvbnN0IHVuZXNjYXBlSVJDUmVnZXggPSAvXFxcXChbc246clxcXFxdKS9nO1xuY29uc3QgZXNjYXBlSVJDUmVnZXggPSAvKFsgXFxuO1xcclxcXFxdKS9nO1xuY29uc3QgaXJjRXNjYXBlZENoYXJzID0geyBzOiAnICcsIG46ICcnLCAnOic6ICc7JywgcjogJycgfTtcbmNvbnN0IGlyY1VuZXNjYXBlZENoYXJzID0geyAnICc6ICdzJywgJ1xcbic6ICduJywgJzsnOiAnOicsICdcXHInOiAncicgfTtcbmNvbnN0IHVybFJlZ2V4ID0gbmV3IFJlZ0V4cCgnXig/Oig/Omh0dHBzP3xmdHApOi8vKSg/OlxcXFxTKyg/OjpcXFxcUyopP0ApPyg/Oig/ISg/OjEwfDEyNykoPzpcXFxcLlxcXFxkezEsM30pezN9KSg/ISg/OjE2OVxcXFwuMjU0fDE5MlxcXFwuMTY4KSg/OlxcXFwuXFxcXGR7MSwzfSl7Mn0pKD8hMTcyXFxcXC4oPzoxWzYtOV18MlxcXFxkfDNbMC0xXSkoPzpcXFxcLlxcXFxkezEsM30pezJ9KSg/OlsxLTldXFxcXGQ/fDFcXFxcZFxcXFxkfDJbMDFdXFxcXGR8MjJbMC0zXSkoPzpcXFxcLig/OjE/XFxcXGR7MSwyfXwyWzAtNF1cXFxcZHwyNVswLTVdKSl7Mn0oPzpcXFxcLig/OlsxLTldXFxcXGQ/fDFcXFxcZFxcXFxkfDJbMC00XVxcXFxkfDI1WzAtNF0pKXwoPzooPzpbYS16XFxcXHUwMGExLVxcXFx1ZmZmZjAtOV0tKikqW2EtelxcXFx1MDBhMS1cXFxcdWZmZmYwLTldKykoPzpcXFxcLig/OlthLXpcXFxcdTAwYTEtXFxcXHVmZmZmMC05XS0qKSpbYS16XFxcXHUwMGExLVxcXFx1ZmZmZjAtOV0rKSooPzpcXFxcLig/OlthLXpcXFxcdTAwYTEtXFxcXHVmZmZmXXsyLH0pKVxcXFwuPykoPzo6XFxcXGR7Miw1fSk/KD86Wy8/I11cXFxcUyopPyQnLCAnaScpO1xuY29uc3QgcmVnZXhFbW90ZVJlZ2V4ID0gL1t8XFxcXF4kKis/OiNdLztcbmNvbnN0IF8gPSBtb2R1bGUuZXhwb3J0cyA9IHtcblx0Ly8gUmV0dXJuIHRoZSBzZWNvbmQgdmFsdWUgaWYgdGhlIGZpcnN0IHZhbHVlIGlzIHVuZGVmaW5lZC4uXG5cdGdldDogKGEsIGIpID0+IHR5cGVvZiBhID09PSAndW5kZWZpbmVkJyA/IGIgOiBhLFxuXG5cdC8vIEluZGlyZWN0bHkgdXNlIGhhc093blByb3BlcnR5XG5cdGhhc093bjogKG9iaiwga2V5KSA9PiAoe30pLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpLFxuXG5cdC8vIFJhY2UgYSBwcm9taXNlIGFnYWluc3QgYSBkZWxheS4uXG5cdHByb21pc2VEZWxheTogdGltZSA9PiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgdGltZSkpLFxuXG5cdC8vIFZhbHVlIGlzIGEgZmluaXRlIG51bWJlci4uXG5cdGlzRmluaXRlOiBpbnQgPT4gaXNGaW5pdGUoaW50KSAmJiAhaXNOYU4ocGFyc2VGbG9hdChpbnQpKSxcblxuXHQvLyBQYXJzZSBzdHJpbmcgdG8gbnVtYmVyLiBSZXR1cm5zIE5hTiBpZiBzdHJpbmcgY2FuJ3QgYmUgcGFyc2VkIHRvIG51bWJlci4uXG5cdHRvTnVtYmVyKG51bSwgcHJlY2lzaW9uKSB7XG5cdFx0aWYobnVtID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdFx0Y29uc3QgZmFjdG9yID0gTWF0aC5wb3coMTAsIF8uaXNGaW5pdGUocHJlY2lzaW9uKSA/IHByZWNpc2lvbiA6IDApO1xuXHRcdHJldHVybiBNYXRoLnJvdW5kKG51bSAqIGZhY3RvcikgLyBmYWN0b3I7XG5cdH0sXG5cblx0Ly8gVmFsdWUgaXMgYW4gaW50ZWdlci4uXG5cdGlzSW50ZWdlcjogaW50ID0+ICFpc05hTihfLnRvTnVtYmVyKGludCwgMCkpLFxuXG5cdC8vIFZhbHVlIGlzIGEgcmVnZXguLlxuXHRpc1JlZ2V4OiBzdHIgPT4gcmVnZXhFbW90ZVJlZ2V4LnRlc3Qoc3RyKSxcblxuXHQvLyBWYWx1ZSBpcyBhIHZhbGlkIHVybC4uXG5cdGlzVVJMOiBzdHIgPT4gdXJsUmVnZXgudGVzdChzdHIpLFxuXG5cdC8vIFJldHVybiBhIHJhbmRvbSBqdXN0aW5mYW4gdXNlcm5hbWUuLlxuXHRqdXN0aW5mYW46ICgpID0+IGBqdXN0aW5mYW4ke01hdGguZmxvb3IoKE1hdGgucmFuZG9tKCkgKiA4MDAwMCkgKyAxMDAwKX1gLFxuXG5cdC8vIFVzZXJuYW1lIGlzIGEganVzdGluZmFuIHVzZXJuYW1lLi5cblx0aXNKdXN0aW5mYW46IHVzZXJuYW1lID0+IGp1c3RpbkZhblJlZ2V4LnRlc3QodXNlcm5hbWUpLFxuXG5cdC8vIFJldHVybiBhIHZhbGlkIGNoYW5uZWwgbmFtZS4uXG5cdGNoYW5uZWwoc3RyKSB7XG5cdFx0Y29uc3QgY2hhbm5lbCA9IChzdHIgPyBzdHIgOiAnJykudG9Mb3dlckNhc2UoKTtcblx0XHRyZXR1cm4gY2hhbm5lbFswXSA9PT0gJyMnID8gY2hhbm5lbCA6ICcjJyArIGNoYW5uZWw7XG5cdH0sXG5cblx0Ly8gUmV0dXJuIGEgdmFsaWQgdXNlcm5hbWUuLlxuXHR1c2VybmFtZShzdHIpIHtcblx0XHRjb25zdCB1c2VybmFtZSA9IChzdHIgPyBzdHIgOiAnJykudG9Mb3dlckNhc2UoKTtcblx0XHRyZXR1cm4gdXNlcm5hbWVbMF0gPT09ICcjJyA/IHVzZXJuYW1lLnNsaWNlKDEpIDogdXNlcm5hbWU7XG5cdH0sXG5cblx0Ly8gUmV0dXJuIGEgdmFsaWQgdG9rZW4uLlxuXHR0b2tlbjogc3RyID0+IHN0ciA/IHN0ci50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoJ29hdXRoOicsICcnKSA6ICcnLFxuXG5cdC8vIFJldHVybiBhIHZhbGlkIHBhc3N3b3JkLi5cblx0cGFzc3dvcmQoc3RyKSB7XG5cdFx0Y29uc3QgdG9rZW4gPSBfLnRva2VuKHN0cik7XG5cdFx0cmV0dXJuIHRva2VuID8gYG9hdXRoOiR7dG9rZW59YCA6ICcnO1xuXHR9LFxuXG5cdGFjdGlvbk1lc3NhZ2U6IG1zZyA9PiBtc2cubWF0Y2goYWN0aW9uTWVzc2FnZVJlZ2V4KSxcblxuXHQvLyBSZXBsYWNlIGFsbCBvY2N1cmVuY2VzIG9mIGEgc3RyaW5nIHVzaW5nIGFuIG9iamVjdC4uXG5cdHJlcGxhY2VBbGwoc3RyLCBvYmopIHtcblx0XHRpZihzdHIgPT09IG51bGwgfHwgdHlwZW9mIHN0ciA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IHggaW4gb2JqKSB7XG5cdFx0XHRzdHIgPSBzdHIucmVwbGFjZShuZXcgUmVnRXhwKHgsICdnJyksIG9ialt4XSk7XG5cdFx0fVxuXHRcdHJldHVybiBzdHI7XG5cdH0sXG5cblx0dW5lc2NhcGVIdG1sOiBzYWZlID0+XG5cdFx0c2FmZS5yZXBsYWNlKC9cXFxcJmFtcFxcXFw7L2csICcmJylcblx0XHQucmVwbGFjZSgvXFxcXCZsdFxcXFw7L2csICc8Jylcblx0XHQucmVwbGFjZSgvXFxcXCZndFxcXFw7L2csICc+Jylcblx0XHQucmVwbGFjZSgvXFxcXCZxdW90XFxcXDsvZywgJ1wiJylcblx0XHQucmVwbGFjZSgvXFxcXCYjMDM5XFxcXDsvZywgJ1xcJycpLFxuXG5cdC8vIEVzY2FwaW5nIHZhbHVlczpcblx0Ly8gaHR0cDovL2lyY3YzLm5ldC9zcGVjcy9jb3JlL21lc3NhZ2UtdGFncy0zLjIuaHRtbCNlc2NhcGluZy12YWx1ZXNcblx0dW5lc2NhcGVJUkMobXNnKSB7XG5cdFx0aWYoIW1zZyB8fCB0eXBlb2YgbXNnICE9PSAnc3RyaW5nJyB8fCAhbXNnLmluY2x1ZGVzKCdcXFxcJykpIHtcblx0XHRcdHJldHVybiBtc2c7XG5cdFx0fVxuXHRcdHJldHVybiBtc2cucmVwbGFjZShcblx0XHRcdHVuZXNjYXBlSVJDUmVnZXgsXG5cdFx0XHQobSwgcCkgPT4gcCBpbiBpcmNFc2NhcGVkQ2hhcnMgPyBpcmNFc2NhcGVkQ2hhcnNbcF0gOiBwXG5cdFx0KTtcblx0fSxcblx0XG5cdGVzY2FwZUlSQyhtc2cpIHtcblx0XHRpZighbXNnIHx8IHR5cGVvZiBtc2cgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gbXNnO1xuXHRcdH1cblx0XHRyZXR1cm4gbXNnLnJlcGxhY2UoXG5cdFx0XHRlc2NhcGVJUkNSZWdleCxcblx0XHRcdChtLCBwKSA9PiBwIGluIGlyY1VuZXNjYXBlZENoYXJzID8gYFxcXFwke2lyY1VuZXNjYXBlZENoYXJzW3BdfWAgOiBwXG5cdFx0KTtcblx0fSxcblxuXHQvLyBBZGQgd29yZCB0byBhIHN0cmluZy4uXG5cdGFkZFdvcmQ6IChsaW5lLCB3b3JkKSA9PiBsaW5lLmxlbmd0aCA/IGxpbmUgKyAnICcgKyB3b3JkIDogbGluZSArIHdvcmQsXG5cblx0Ly8gU3BsaXQgYSBsaW5lIGJ1dCB0cnkgbm90IHRvIGN1dCBhIHdvcmQgaW4gaGFsZi4uXG5cdHNwbGl0TGluZShpbnB1dCwgbGVuZ3RoKSB7XG5cdFx0bGV0IGxhc3RTcGFjZSA9IGlucHV0LnN1YnN0cmluZygwLCBsZW5ndGgpLmxhc3RJbmRleE9mKCcgJyk7XG5cdFx0Ly8gTm8gc3BhY2VzIGZvdW5kLCBzcGxpdCBhdCB0aGUgdmVyeSBlbmQgdG8gYXZvaWQgYSBsb29wLi5cblx0XHRpZihsYXN0U3BhY2UgPT09IC0xKSB7XG5cdFx0XHRsYXN0U3BhY2UgPSBsZW5ndGggLSAxO1xuXHRcdH1cblx0XHRyZXR1cm4gWyBpbnB1dC5zdWJzdHJpbmcoMCwgbGFzdFNwYWNlKSwgaW5wdXQuc3Vic3RyaW5nKGxhc3RTcGFjZSArIDEpIF07XG5cdH0sXG5cblx0Ly8gRXh0cmFjdCBhIG51bWJlciBmcm9tIGEgc3RyaW5nLi5cblx0ZXh0cmFjdE51bWJlcihzdHIpIHtcblx0XHRjb25zdCBwYXJ0cyA9IHN0ci5zcGxpdCgnICcpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmKF8uaXNJbnRlZ2VyKHBhcnRzW2ldKSkge1xuXHRcdFx0XHRyZXR1cm4gfn5wYXJ0c1tpXTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIDA7XG5cdH0sXG5cblx0Ly8gRm9ybWF0IHRoZSBkYXRlLi5cblx0Zm9ybWF0RGF0ZShkYXRlKSB7XG5cdFx0bGV0IGhvdXJzID0gZGF0ZS5nZXRIb3VycygpO1xuXHRcdGxldCBtaW5zICA9IGRhdGUuZ2V0TWludXRlcygpO1xuXG5cdFx0aG91cnMgPSAoaG91cnMgPCAxMCA/ICcwJyA6ICcnKSArIGhvdXJzO1xuXHRcdG1pbnMgPSAobWlucyA8IDEwID8gJzAnIDogJycpICsgbWlucztcblx0XHRyZXR1cm4gYCR7aG91cnN9OiR7bWluc31gO1xuXHR9LFxuXG5cdC8vIEluaGVyaXQgdGhlIHByb3RvdHlwZSBtZXRob2RzIGZyb20gb25lIGNvbnN0cnVjdG9yIGludG8gYW5vdGhlci4uXG5cdGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuXHRcdGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yO1xuXHRcdGNvbnN0IFRlbXBDdG9yID0gZnVuY3Rpb24gKCkge307XG5cdFx0VGVtcEN0b3IucHJvdG90eXBlID0gc3VwZXJDdG9yLnByb3RvdHlwZTtcblx0XHRjdG9yLnByb3RvdHlwZSA9IG5ldyBUZW1wQ3RvcigpO1xuXHRcdGN0b3IucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gY3Rvcjtcblx0fSxcblxuXHQvLyBSZXR1cm4gd2hldGhlciBpbnNpZGUgYSBOb2RlIGFwcGxpY2F0aW9uIG9yIG5vdC4uXG5cdGlzTm9kZSgpIHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIHR5cGVvZiBwcm9jZXNzID09PSAnb2JqZWN0JyAmJlxuXHRcdFx0XHRPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwocHJvY2VzcykgPT09ICdbb2JqZWN0IHByb2Nlc3NdJztcblx0XHR9IGNhdGNoKGUpIHt9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG5leHBvcnRzLkFuaW1hdGlvbkNvbnRyb2xsZXIgPSB2b2lkIDA7XG5jb25zdCB2ZWN0b3JfMSA9IHJlcXVpcmUoXCIuL3ZlY3RvclwiKTtcbmNsYXNzIEFuaW1hdGlvbkNvbnRyb2xsZXIge1xuICAgIGNvbnN0cnVjdG9yKGFuaW1hdGlvbnMpIHtcbiAgICAgICAgdGhpcy5hbmltYXRpb25zID0gYW5pbWF0aW9ucztcbiAgICAgICAgdGhpcy5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgIHRoaXMubmFtZUN1cnJlbnRBbmltYXRpb24gPSBcIlwiO1xuICAgICAgICB0aGlzLmN1cnJlbnRGcmFtZUluZGV4ID0gMDtcbiAgICB9XG4gICAgdXBkYXRlQW5pbWF0aW9uKGRlbHRhVGltZSkge1xuICAgICAgICBjb25zdCBmcmFtZSA9IHRoaXMuY3VycmVudEZyYW1lO1xuICAgICAgICB0aGlzLmN1cnJlbnRUaW1lICs9IGRlbHRhVGltZTtcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudFRpbWUgPj0gZnJhbWUuaG9sZFRpbWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFuaW1hdGlvbiA9IHRoaXMuY3VycmVudEFuaW1hdGlvbjtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudEZyYW1lSW5kZXggPSAodGhpcy5jdXJyZW50RnJhbWVJbmRleCArIDEpICUgYW5pbWF0aW9uLmZyYW1lcy5sZW5ndGg7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjaGFuZ2VBbmltYXRpb24obmV3QW5pbWF0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLm5hbWVDdXJyZW50QW5pbWF0aW9uLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudFRpbWUgPSAwO1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50RnJhbWVJbmRleCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5uYW1lQ3VycmVudEFuaW1hdGlvbiA9IG5ld0FuaW1hdGlvbjtcbiAgICB9XG4gICAgZ2V0IGNsaXAoKSB7XG4gICAgICAgIGNvbnN0IGZyYW1lID0gdGhpcy5jdXJyZW50RnJhbWU7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwb3NpdGlvbjogbmV3IHZlY3Rvcl8xLlZlY3RvcihmcmFtZS54LCBmcmFtZS55KSxcbiAgICAgICAgICAgIHNpemU6IG5ldyB2ZWN0b3JfMS5WZWN0b3IoZnJhbWUudywgZnJhbWUuaCksXG4gICAgICAgIH07XG4gICAgfVxuICAgIGdldCBjdXJyZW50QW5pbWF0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5hbmltYXRpb25zW3RoaXMubmFtZUN1cnJlbnRBbmltYXRpb25dO1xuICAgIH1cbiAgICBnZXQgY3VycmVudEZyYW1lKCkge1xuICAgICAgICBjb25zdCBjdXJyZW50QW5pbWF0aW9uID0gdGhpcy5jdXJyZW50QW5pbWF0aW9uO1xuICAgICAgICByZXR1cm4gY3VycmVudEFuaW1hdGlvbi5mcmFtZXNbdGhpcy5jdXJyZW50RnJhbWVJbmRleF07XG4gICAgfVxufVxuZXhwb3J0cy5BbmltYXRpb25Db250cm9sbGVyID0gQW5pbWF0aW9uQ29udHJvbGxlcjtcbiIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5TcGVlY2hCdWJibGUgPSB2b2lkIDA7XG5jb25zdCB2ZWN0b3JfMSA9IHJlcXVpcmUoXCIuL3ZlY3RvclwiKTtcbmNsYXNzIFNwZWVjaEJ1YmJsZSB7XG4gICAgY29uc3RydWN0b3IoY29udGVudCwgdHJhY2ssIG9mZnNldCkge1xuICAgICAgICB0aGlzLnRyYWNrID0gdHJhY2s7XG4gICAgICAgIHRoaXMub2Zmc2V0ID0gb2Zmc2V0O1xuICAgICAgICB0aGlzLmtpbGwgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgICAgdGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoXCJidWJibGVcIiwgXCJtZWRpdW1cIiwgXCJib3R0b21cIik7XG4gICAgICAgIHRoaXMuZWxlbWVudC5pbm5lclRleHQgPSBjb250ZW50O1xuICAgICAgICB0aGlzLmVsZW1lbnQuc3R5bGUub3BhY2l0eSA9IFwiMVwiO1xuICAgICAgICB0aGlzLnVwZGF0ZVBvc2l0aW9uKCk7XG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiYm9keVwiKVswXS5hcHBlbmRDaGlsZCh0aGlzLmVsZW1lbnQpO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGxldCBpbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgY3VycmVudE9wYWNpdHkgPSB0aGlzLm9wYWNpdHkgLSAwLjE7XG4gICAgICAgICAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLm9wYWNpdHkgPSBgJHtjdXJyZW50T3BhY2l0eX1gO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNob3VsZFN0YXJ0RmFkaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMua2lsbCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIDUwKTtcbiAgICAgICAgfSwgNTAwMCk7XG4gICAgfVxuICAgIHVwZGF0ZVBvc2l0aW9uKCkge1xuICAgICAgICBjb25zdCBhY3R1YWxQb3NpdGlvbiA9IHRoaXMudHJhY2suYWRkKHRoaXMub2Zmc2V0KTtcbiAgICAgICAgYWN0dWFsUG9zaXRpb24ueCAtPSB0aGlzLnNpemUueCAvIDQ7XG4gICAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS5sZWZ0ID0gYCR7YWN0dWFsUG9zaXRpb24ueH1weGA7XG4gICAgICAgIHRoaXMuZWxlbWVudC5zdHlsZS50b3AgPSBgJHthY3R1YWxQb3NpdGlvbi55fXB4YDtcbiAgICB9XG4gICAgYWRkT2Zmc2V0KG9mZnNldCkge1xuICAgICAgICB0aGlzLm9mZnNldC5pbnBsYWNlQWRkKG9mZnNldCk7XG4gICAgfVxuICAgIGRlbGV0ZUVsZW1lbnQoKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5yZW1vdmUoKTtcbiAgICB9XG4gICAgZ2V0IHNpemUoKSB7XG4gICAgICAgIHJldHVybiBuZXcgdmVjdG9yXzEuVmVjdG9yKHRoaXMuZWxlbWVudC5vZmZzZXRXaWR0aCwgdGhpcy5lbGVtZW50Lm9mZnNldEhlaWdodCk7XG4gICAgfVxuICAgIGdldCBsYXllcigpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSBwYXJzZUludCh0aGlzLmVsZW1lbnQuc3R5bGUuekluZGV4KSB8fCAwO1xuICAgICAgICByZXR1cm4gaW5kZXg7XG4gICAgfVxuICAgIGdldCBvcGFjaXR5KCkge1xuICAgICAgICBsZXQgb3BhY2l0eSA9IHBhcnNlRmxvYXQodGhpcy5lbGVtZW50LnN0eWxlLm9wYWNpdHkpO1xuICAgICAgICBpZiAoaXNOYU4ob3BhY2l0eSkpXG4gICAgICAgICAgICBvcGFjaXR5ID0gMTtcbiAgICAgICAgcmV0dXJuIG9wYWNpdHk7XG4gICAgfVxuICAgIGdldCBzaG91bGRLaWxsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5raWxsO1xuICAgIH1cbiAgICBnZXQgc2hvdWxkU3RhcnRGYWRpbmcoKSB7XG4gICAgICAgIGNvbnN0IG9wYWNpdHkgPSB0aGlzLm9wYWNpdHk7XG4gICAgICAgIHJldHVybiBvcGFjaXR5IDw9IDA7XG4gICAgfVxuICAgIHNldCBsYXllcihuZXdMYXllcikge1xuICAgICAgICB0aGlzLmVsZW1lbnQuc3R5bGUuekluZGV4ID0gYCR7bmV3TGF5ZXJ9YDtcbiAgICB9XG59XG5leHBvcnRzLlNwZWVjaEJ1YmJsZSA9IFNwZWVjaEJ1YmJsZTtcbiIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5Eb3RGYW4gPSB2b2lkIDA7XG5jb25zdCBidWJibGVfMSA9IHJlcXVpcmUoXCIuL2J1YmJsZVwiKTtcbmNvbnN0IHZlY3Rvcl8xID0gcmVxdWlyZShcIi4vdmVjdG9yXCIpO1xuY29uc3QgVkVMT0NJVFkgPSBuZXcgdmVjdG9yXzEuVmVjdG9yKDUwLCAwKTtcbmNsYXNzIERvdEZhbiB7XG4gICAgY29uc3RydWN0b3Ioc3ByaXRlLCBhbmltYXRpb25Db250cm9sbGVyKSB7XG4gICAgICAgIHRoaXMuc3ByaXRlID0gc3ByaXRlO1xuICAgICAgICB0aGlzLmFuaW1hdGlvbkNvbnRyb2xsZXIgPSBhbmltYXRpb25Db250cm9sbGVyO1xuICAgICAgICB0aGlzLmJ1YmJsZXMgPSBbXTtcbiAgICAgICAgY29uc3QgcG9zWVNwYXduID0gMDtcbiAgICAgICAgdGhpcy5wb3NpdGlvbiA9IG5ldyB2ZWN0b3JfMS5WZWN0b3Iod2luZG93LmlubmVyV2lkdGggKiBNYXRoLnJhbmRvbSgpLCBwb3NZU3Bhd24pO1xuICAgICAgICB0aGlzLmFuaW1hdGlvbkNvbnRyb2xsZXIuY2hhbmdlQW5pbWF0aW9uKFwiYW5kYW5kb1wiKTsgLy8gVE9ETzogbXVkYXIgaXNzbyBwcmEgY2FzbyB0ZW5oYSBtYWlzIGRlIHVtYSBhbmltYcOnw6NvXG4gICAgICAgIHRoaXMuZmxpcHBlZCA9IE1hdGgucmFuZG9tKCkgPj0gMC41O1xuICAgICAgICBpZiAodGhpcy5mbGlwcGVkKVxuICAgICAgICAgICAgdGhpcy5zcHJpdGUuZmxpcCgpO1xuICAgIH1cbiAgICBhZGRNZXNzYWdlKGNvbnRlbnQpIHtcbiAgICAgICAgbGV0IG9mZnNldCA9IG5ldyB2ZWN0b3JfMS5WZWN0b3IoMCwgLXRoaXMuc3ByaXRlLnNpemUueSk7XG4gICAgICAgIGxldCBuZXdCdWJibGUgPSBuZXcgYnViYmxlXzEuU3BlZWNoQnViYmxlKGNvbnRlbnQsIHRoaXMucG9zaXRpb24sIG9mZnNldCk7XG4gICAgICAgIGZvciAobGV0IGJ1YmJsZSBvZiB0aGlzLmJ1YmJsZXMpIHtcbiAgICAgICAgICAgIG9mZnNldC55ICs9IC1idWJibGUuc2l6ZS55O1xuICAgICAgICAgICAgYnViYmxlLmxheWVyID0gYnViYmxlLmxheWVyICsgMTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmJ1YmJsZXMucHVzaChuZXdCdWJibGUpO1xuICAgIH1cbiAgICB1cGRhdGUoZGVsdGFUaW1lKSB7XG4gICAgICAgIHRoaXMuYW5pbWF0aW9uQ29udHJvbGxlci51cGRhdGVBbmltYXRpb24oZGVsdGFUaW1lKTtcbiAgICAgICAgaWYgKE1hdGgucmFuZG9tKCkgPj0gMC45OTUpIHtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlLmZsaXAoKTtcbiAgICAgICAgICAgIHRoaXMuZmxpcHBlZCA9ICF0aGlzLmZsaXBwZWQ7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGFjdHVhbFZlbG9jaXR5ID0gVkVMT0NJVFkubXVsdGlwbHlTY2FsYXIoZGVsdGFUaW1lKTtcbiAgICAgICAgaWYgKHRoaXMuZmxpcHBlZClcbiAgICAgICAgICAgIGFjdHVhbFZlbG9jaXR5LmlucGxhY2VNdWx0aXBseVNjYWxhcigtMSk7XG4gICAgICAgIHRoaXMucG9zaXRpb24uaW5wbGFjZUFkZChhY3R1YWxWZWxvY2l0eSk7XG4gICAgICAgIHRoaXMuc3ByaXRlLmNsaXAgPSB0aGlzLmFuaW1hdGlvbkNvbnRyb2xsZXIuY2xpcDtcbiAgICAgICAgdGhpcy5zcHJpdGUucG9zaXRpb24gPSB0aGlzLnBvc2l0aW9uO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYnViYmxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYnViYmxlID0gdGhpcy5idWJibGVzW2ldO1xuICAgICAgICAgICAgYnViYmxlLnVwZGF0ZVBvc2l0aW9uKCk7XG4gICAgICAgICAgICBpZiAoYnViYmxlLnNob3VsZEtpbGwpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCB0aGlzLmJ1YmJsZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdXBkYXRpbmdCdWJibGUgPSB0aGlzLmJ1YmJsZXNbal07XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0aW5nQnViYmxlLmFkZE9mZnNldChuZXcgdmVjdG9yXzEuVmVjdG9yKDAsIGJ1YmJsZS5zaXplLnkpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnViYmxlLmRlbGV0ZUVsZW1lbnQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJ1YmJsZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIGktLTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBkcmF3KGN0eCkge1xuICAgICAgICB0aGlzLnNwcml0ZS5kcmF3KGN0eCk7XG4gICAgfVxufVxuZXhwb3J0cy5Eb3RGYW4gPSBEb3RGYW47XG4iLCJcInVzZSBzdHJpY3RcIjtcbnZhciBfX2F3YWl0ZXIgPSAodGhpcyAmJiB0aGlzLl9fYXdhaXRlcikgfHwgZnVuY3Rpb24gKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XG4gICAgfSk7XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5TcHJpdGVJbmZvTG9hZGVyID0gdm9pZCAwO1xuY2xhc3MgU3ByaXRlSW5mb0xvYWRlciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMucGF0aGVzID0gW107XG4gICAgICAgIHRoaXMuYW5pbWF0aW9uRGF0YWJhc2VzID0gW107XG4gICAgICAgIHRoaXMuY3VycmVudEluZGV4ID0gMDtcbiAgICB9XG4gICAgbG9hZCgpIHtcbiAgICAgICAgcmV0dXJuIF9fYXdhaXRlcih0aGlzLCB2b2lkIDAsIHZvaWQgMCwgZnVuY3Rpb24qICgpIHtcbiAgICAgICAgICAgIHlpZWxkIGZldGNoKFwiLi9kYXRhYmFzZS5qc29uXCIpXG4gICAgICAgICAgICAgICAgLnRoZW4ociA9PiByLmpzb24oKSlcbiAgICAgICAgICAgICAgICAudGhlbihyID0+IHtcbiAgICAgICAgICAgICAgICBsZXQganNvbkRhdGEgPSByLnNwcml0ZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQganNvbiBvZiBqc29uRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhqc29uKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXRoZXMucHVzaChqc29uLnBhdGgpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YWJhc2UgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgdGVzdGUgb2YganNvbi5hbmltYXRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhYmFzZVt0ZXN0ZS5uYW1lXSA9IHsgZnJhbWVzOiBbXSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YWJhc2VbdGVzdGUubmFtZV0uZnJhbWVzID0gdGVzdGUuZnJhbWVzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYW5pbWF0aW9uRGF0YWJhc2VzLnB1c2goZGF0YWJhc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh0aGlzLnBhdGhlcywgdGhpcy5hbmltYXRpb25EYXRhYmFzZXMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBnZXRSYW5kb21OdW1iZXIobWF4KSB7XG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBtYXgpO1xuICAgIH1cbiAgICBzZWxlY3RSYW5kb21TcHJpdGUoKSB7XG4gICAgICAgIHRoaXMuY3VycmVudEluZGV4ID0gdGhpcy5nZXRSYW5kb21OdW1iZXIodGhpcy5wYXRoZXMubGVuZ3RoKTtcbiAgICB9XG4gICAgZ2V0IHBhdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhdGhlc1t0aGlzLmN1cnJlbnRJbmRleF07XG4gICAgfVxuICAgIGdldCBhbmltYXRpb25EYXRhYmFzZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYW5pbWF0aW9uRGF0YWJhc2VzW3RoaXMuY3VycmVudEluZGV4XTtcbiAgICB9XG59XG5leHBvcnRzLlNwcml0ZUluZm9Mb2FkZXIgPSBTcHJpdGVJbmZvTG9hZGVyO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgX19jcmVhdGVCaW5kaW5nID0gKHRoaXMgJiYgdGhpcy5fX2NyZWF0ZUJpbmRpbmcpIHx8IChPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XG4gICAgaWYgKCFkZXNjIHx8IChcImdldFwiIGluIGRlc2MgPyAhbS5fX2VzTW9kdWxlIDogZGVzYy53cml0YWJsZSB8fCBkZXNjLmNvbmZpZ3VyYWJsZSkpIHtcbiAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XG4gICAgfVxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrMiwgZGVzYyk7XG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XG4gICAgb1trMl0gPSBtW2tdO1xufSkpO1xudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9ICh0aGlzICYmIHRoaXMuX19zZXRNb2R1bGVEZWZhdWx0KSB8fCAoT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xufSkgOiBmdW5jdGlvbihvLCB2KSB7XG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xufSk7XG52YXIgX19pbXBvcnRTdGFyID0gKHRoaXMgJiYgdGhpcy5fX2ltcG9ydFN0YXIpIHx8IGZ1bmN0aW9uIChtb2QpIHtcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xuICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICBpZiAobW9kICE9IG51bGwpIGZvciAodmFyIGsgaW4gbW9kKSBpZiAoayAhPT0gXCJkZWZhdWx0XCIgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG1vZCwgaykpIF9fY3JlYXRlQmluZGluZyhyZXN1bHQsIG1vZCwgayk7XG4gICAgX19zZXRNb2R1bGVEZWZhdWx0KHJlc3VsdCwgbW9kKTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmNvbnN0IHRtaSA9IF9faW1wb3J0U3RhcihyZXF1aXJlKFwidG1pLmpzXCIpKTtcbmNvbnN0IGxvYWRfZGF0YV8xID0gcmVxdWlyZShcIi4vbG9hZC1kYXRhXCIpO1xuY29uc3QgYW5pbWF0aW9uXzEgPSByZXF1aXJlKFwiLi9hbmltYXRpb25cIik7XG5jb25zdCBkb3RmYW5fMSA9IHJlcXVpcmUoXCIuL2RvdGZhblwiKTtcbmNvbnN0IHZlY3Rvcl8xID0gcmVxdWlyZShcIi4vdmVjdG9yXCIpO1xuY29uc3Qgc3ByaXRlXzEgPSByZXF1aXJlKFwiLi9zcHJpdGVcIik7XG5jb25zdCBjbGllbnQgPSBuZXcgdG1pLkNsaWVudCh7XG4gICAgY2hhbm5lbHM6IFsndmluaWRvdHJ1YW4nXVxufSk7XG5jbGllbnQuY29ubmVjdCgpO1xuY2xpZW50Lm9uKCdtZXNzYWdlJywgKGNoYW5uZWwsIHRhZ3MsIG1lc3NhZ2UsIHNlbGYpID0+IHtcbiAgICBjb25zb2xlLmxvZyhgJHt0YWdzWydkaXNwbGF5LW5hbWUnXX06ICR7bWVzc2FnZX1gKTtcbn0pO1xuY29uc3QgbG9hZGVkRGF0YSA9IG5ldyBsb2FkX2RhdGFfMS5TcHJpdGVJbmZvTG9hZGVyKCk7XG5sb2FkZWREYXRhLmxvYWQoKS50aGVuKCgpID0+IHtcbiAgICB2YXIgX2E7XG4gICAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJjYW52YXNcIik7XG4gICAgY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcbiAgICBpZiAoY3R4ID09PSBudWxsKVxuICAgICAgICB0aHJvdyBcIkZvZGFcIjtcbiAgICBjYW52YXMud2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICBjYW52YXMuaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xuICAgIGN0eC5pbWFnZVNtb290aGluZ0VuYWJsZWQgPSBmYWxzZTtcbiAgICBsZXQgZmFucyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTA7IGkrKykge1xuICAgICAgICBsb2FkZWREYXRhLnNlbGVjdFJhbmRvbVNwcml0ZSgpO1xuICAgICAgICBsZXQgZmFuID0gbmV3IGRvdGZhbl8xLkRvdEZhbihuZXcgc3ByaXRlXzEuU3ByaXRlKGxvYWRlZERhdGEucGF0aCwge1xuICAgICAgICAgICAgcG9zaXRpb246IG5ldyB2ZWN0b3JfMS5WZWN0b3IoMCwgMCksXG4gICAgICAgICAgICBzaXplOiBuZXcgdmVjdG9yXzEuVmVjdG9yKDY0LCA2NClcbiAgICAgICAgfSksIG5ldyBhbmltYXRpb25fMS5BbmltYXRpb25Db250cm9sbGVyKGxvYWRlZERhdGEuYW5pbWF0aW9uRGF0YWJhc2UpKTtcbiAgICAgICAgZmFucy5wdXNoKGZhbik7XG4gICAgfVxuICAgIC8vIE1haW4gTG9vcFxuICAgIGxldCB0ZW1wb0FudGlnbyA9IERhdGUubm93KCk7XG4gICAgc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgdGVtcG9BdHVhbCA9IERhdGUubm93KCk7XG4gICAgICAgIGxldCBkZWx0YVRpbWUgPSAodGVtcG9BdHVhbCAtIHRlbXBvQW50aWdvKSAvIDEwMDA7XG4gICAgICAgIHRlbXBvQW50aWdvID0gdGVtcG9BdHVhbDtcbiAgICAgICAgLy8gVXBkYXRlIFNwcml0ZXNcbiAgICAgICAgZm9yIChsZXQgZmFuIG9mIGZhbnMpXG4gICAgICAgICAgICBmYW4udXBkYXRlKGRlbHRhVGltZSk7XG4gICAgICAgIC8vIERyYXcgRXZlcnl0aGluZ1xuICAgICAgICBjdHguY2xlYXJSZWN0KDAsIDAsIGNhbnZhcy5vZmZzZXRXaWR0aCwgY2FudmFzLm9mZnNldEhlaWdodCk7XG4gICAgICAgIGZvciAobGV0IGZhbiBvZiBmYW5zKVxuICAgICAgICAgICAgZmFuLmRyYXcoY3R4KTtcbiAgICB9LCAxIC8gNjApO1xuICAgIChfYSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjZmFsYXJcIikpID09PSBudWxsIHx8IF9hID09PSB2b2lkIDAgPyB2b2lkIDAgOiBfYS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBsZXQgZmFuID0gZmFuc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBmYW5zLmxlbmd0aCldO1xuICAgICAgICBmYW4uYWRkTWVzc2FnZShcIk1lbnNhZ2VtIGRlIHRleHRvIHRlc3RhdmVsIHRlc3RhZGFcIik7XG4gICAgfSk7XG59KTtcbiIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5TcHJpdGUgPSB2b2lkIDA7XG5jb25zdCB2ZWN0b3JfMSA9IHJlcXVpcmUoXCIuL3ZlY3RvclwiKTtcbmNsYXNzIFNwcml0ZSB7XG4gICAgY29uc3RydWN0b3IocGF0aCwgdHJhbnNmb3JtKSB7XG4gICAgICAgIHRoaXMudHJhbnNmb3JtID0gdHJhbnNmb3JtO1xuICAgICAgICB0aGlzLmZsaXBwZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5pbWFnZSA9IG5ldyBJbWFnZSgpO1xuICAgICAgICB0aGlzLmltYWdlLnNyYyA9IHBhdGg7XG4gICAgICAgIHRoaXMuY3VycmVudENsaXAgPSB7XG4gICAgICAgICAgICBwb3NpdGlvbjogbmV3IHZlY3Rvcl8xLlZlY3RvcigwLCAwKSxcbiAgICAgICAgICAgIHNpemU6IG5ldyB2ZWN0b3JfMS5WZWN0b3IodGhpcy5pbWFnZS53aWR0aCwgdGhpcy5pbWFnZS5oZWlnaHQpXG4gICAgICAgIH07XG4gICAgfVxuICAgIGZsaXAoKSB7XG4gICAgICAgIHRoaXMuZmxpcHBlZCA9ICF0aGlzLmZsaXBwZWQ7XG4gICAgfVxuICAgIHNldCBjbGlwKG5ld0NsaXApIHtcbiAgICAgICAgdGhpcy5jdXJyZW50Q2xpcCA9IG5ld0NsaXA7XG4gICAgfVxuICAgIHNldCBwb3NpdGlvbihuZXdQb3NpdGlvbikge1xuICAgICAgICB0aGlzLnRyYW5zZm9ybS5wb3NpdGlvbi54ID0gbmV3UG9zaXRpb24ueDtcbiAgICAgICAgdGhpcy50cmFuc2Zvcm0ucG9zaXRpb24ueSA9IG5ld1Bvc2l0aW9uLnk7XG4gICAgfVxuICAgIGdldCBzaXplKCkge1xuICAgICAgICByZXR1cm4gdGhpcy50cmFuc2Zvcm0uc2l6ZTtcbiAgICB9XG4gICAgZHJhdyhjdHgpIHtcbiAgICAgICAgaWYgKHRoaXMuZmxpcHBlZCkge1xuICAgICAgICAgICAgY3R4LnRyYW5zbGF0ZSh0aGlzLnRyYW5zZm9ybS5zaXplLngsIDApO1xuICAgICAgICAgICAgY3R4LnNjYWxlKC0xLCAxKTtcbiAgICAgICAgfVxuICAgICAgICBjdHguZHJhd0ltYWdlKHRoaXMuaW1hZ2UsIHRoaXMuY3VycmVudENsaXAucG9zaXRpb24ueCwgdGhpcy5jdXJyZW50Q2xpcC5wb3NpdGlvbi55LCB0aGlzLmN1cnJlbnRDbGlwLnNpemUueCwgdGhpcy5jdXJyZW50Q2xpcC5zaXplLnksICh0aGlzLmZsaXBwZWQpID8gLXRoaXMudHJhbnNmb3JtLnBvc2l0aW9uLnggOiB0aGlzLnRyYW5zZm9ybS5wb3NpdGlvbi54LCB0aGlzLnRyYW5zZm9ybS5wb3NpdGlvbi55LCB0aGlzLnRyYW5zZm9ybS5zaXplLngsIHRoaXMudHJhbnNmb3JtLnNpemUueSk7XG4gICAgICAgIGlmICh0aGlzLmZsaXBwZWQpIHtcbiAgICAgICAgICAgIGN0eC50cmFuc2xhdGUodGhpcy50cmFuc2Zvcm0uc2l6ZS54LCAwKTtcbiAgICAgICAgICAgIGN0eC5zY2FsZSgtMSwgMSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5leHBvcnRzLlNwcml0ZSA9IFNwcml0ZTtcbiIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xuZXhwb3J0cy5WZWN0b3IgPSB2b2lkIDA7XG5jbGFzcyBWZWN0b3Ige1xuICAgIGNvbnN0cnVjdG9yKHgsIHkpIHtcbiAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgdGhpcy55ID0geTtcbiAgICB9XG4gICAgLy8gT3JpZ2luYWwgbWV0aG9kcyByZXR1cm5pbmcgbmV3IGluc3RhbmNlc1xuICAgIC8vIEFkZGl0aW9uXG4gICAgYWRkKG90aGVyKSB7XG4gICAgICAgIHJldHVybiBuZXcgVmVjdG9yKHRoaXMueCArIG90aGVyLngsIHRoaXMueSArIG90aGVyLnkpO1xuICAgIH1cbiAgICAvLyBTdWJ0cmFjdGlvblxuICAgIHN1YnRyYWN0KG90aGVyKSB7XG4gICAgICAgIHJldHVybiBuZXcgVmVjdG9yKHRoaXMueCAtIG90aGVyLngsIHRoaXMueSAtIG90aGVyLnkpO1xuICAgIH1cbiAgICAvLyBNdWx0aXBsaWNhdGlvbiBieSBzY2FsYXJcbiAgICBtdWx0aXBseVNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBWZWN0b3IodGhpcy54ICogc2NhbGFyLCB0aGlzLnkgKiBzY2FsYXIpO1xuICAgIH1cbiAgICAvLyBEaXZpc2lvbiBieSBzY2FsYXJcbiAgICBkaXZpZGVTY2FsYXIoc2NhbGFyKSB7XG4gICAgICAgIGlmIChzY2FsYXIgPT09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkRpdmlzaW9uIGJ5IHplcm9cIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBWZWN0b3IodGhpcy54IC8gc2NhbGFyLCB0aGlzLnkgLyBzY2FsYXIpO1xuICAgIH1cbiAgICAvLyBOZXcgbWV0aG9kcyBtb2RpZnlpbmcgdGhlIGluc3RhbmNlIGl0c2VsZlxuICAgIC8vIEluLXBsYWNlIGFkZGl0aW9uXG4gICAgaW5wbGFjZUFkZChvdGhlcikge1xuICAgICAgICB0aGlzLnggKz0gb3RoZXIueDtcbiAgICAgICAgdGhpcy55ICs9IG90aGVyLnk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvLyBJbi1wbGFjZSBzdWJ0cmFjdGlvblxuICAgIGlucGxhY2VTdWJ0cmFjdChvdGhlcikge1xuICAgICAgICB0aGlzLnggLT0gb3RoZXIueDtcbiAgICAgICAgdGhpcy55IC09IG90aGVyLnk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvLyBJbi1wbGFjZSBtdWx0aXBsaWNhdGlvbiBieSBzY2FsYXJcbiAgICBpbnBsYWNlTXVsdGlwbHlTY2FsYXIoc2NhbGFyKSB7XG4gICAgICAgIHRoaXMueCAqPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueSAqPSBzY2FsYXI7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvLyBJbi1wbGFjZSBkaXZpc2lvbiBieSBzY2FsYXJcbiAgICBpbnBsYWNlRGl2aWRlU2NhbGFyKHNjYWxhcikge1xuICAgICAgICBpZiAoc2NhbGFyID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJEaXZpc2lvbiBieSB6ZXJvXCIpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMueCAvPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueSAvPSBzY2FsYXI7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn1cbmV4cG9ydHMuVmVjdG9yID0gVmVjdG9yO1xuIiwiLyogKGlnbm9yZWQpICovIiwiLyogKGlnbm9yZWQpICovIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXS5jYWxsKG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIl9fd2VicGFja19yZXF1aXJlX18uZyA9IChmdW5jdGlvbigpIHtcblx0aWYgKHR5cGVvZiBnbG9iYWxUaGlzID09PSAnb2JqZWN0JykgcmV0dXJuIGdsb2JhbFRoaXM7XG5cdHRyeSB7XG5cdFx0cmV0dXJuIHRoaXMgfHwgbmV3IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ29iamVjdCcpIHJldHVybiB3aW5kb3c7XG5cdH1cbn0pKCk7IiwiIiwiLy8gc3RhcnR1cFxuLy8gTG9hZCBlbnRyeSBtb2R1bGUgYW5kIHJldHVybiBleHBvcnRzXG4vLyBUaGlzIGVudHJ5IG1vZHVsZSBpcyByZWZlcmVuY2VkIGJ5IG90aGVyIG1vZHVsZXMgc28gaXQgY2FuJ3QgYmUgaW5saW5lZFxudmFyIF9fd2VicGFja19leHBvcnRzX18gPSBfX3dlYnBhY2tfcmVxdWlyZV9fKFwiLi9zcmMvbWFpbi50c1wiKTtcbiIsIiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==