// rcpt_to.disposable

// documentation via: haraka -c /Users/r/dev/nodejs/emailD -h plugins/rcpt_to.disposable

// Put your plugin code here
// type: `haraka -h Plugins` for documentation on how to create a plugin
var it = exports

var Address  = require('./address').Address;
var forward = require("../../somanyad").emailForward;

exports.hook_rcpt = function (next, connection, params) {
	var transaction = connection.transaction;
	var mail_from = transaction.mail_from
	var rcpt_to = transaction.rcpt_to[0]

	forward(mail_from, rcpt_to, function (err, address) {
		if (err || address == null) {
      err = err || new Error("address not found!");
			next(DENY, err);
			return;
		}

		var toAddress = new Address('<' + address + '>');
		// var toAddress = new Address('<ljy080829@gmail.com>');
		connection.transaction.rcpt_to.pop();
		connection.transaction.rcpt_to.push(toAddress);
		connection.relaying = true
		next(OK);
	});
}
