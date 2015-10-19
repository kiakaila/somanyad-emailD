// queue.forwarding

// documentation via: haraka -c /Users/r/dev/nodejs/radomail/emailD -h plugins/queue.forwarding

// Put your plugin code here
// type: `haraka -h Plugins` for documentation on how to create a plugin

var outbound = require('./outbound');

var it = exports
it.logwarn("outbound" + outbound.send_email)
exports.hook_queue_outbound = function (next, connection, params) {
	it.logwarn("xxxxxxx hook_queue_outbound");
	next()
}