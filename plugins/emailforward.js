var async = require("async");
var Domain = require("../../somanyad").Domain;
var Forward = require("../../somanyad").Forward;
var BlackReceiveList = require("../../somanyad").BlackReceiveList;
var getPassVerifyAndAddressById = require("../../somanyad").getPassVerifyAndAddressById;
var hadRegisterEmailAddress = require("../../somanyad").hadRegisterEmailAddress;
var user_had_pay = require("../../somanyad").user_had_pay;
var ForwardRecords = require("../../somanyad").ForwardRecords;
var m = require("moment");
var secrets = require("../../somanyad").secrets;

exports.forward = emailForward

// 获取真正转发目的地( 其实就是转发)
function emailForward (mail_from, rcpt_to, cb) {
	var toHost = rcpt_to.host;
  var toUser = rcpt_to.user;
  var fromHost = mail_from.host;
  // 如果是自己发出去的邮件,那么直接转发
  if (fromHost == secrets.sendMailDomain) {
    // 发送给自己的邮件
  	if (toHost == secrets.sendMailDomain) {
  		return cb("编码测试", "ljy13928483788@gmail.com");
  	};
    // 发送给别人的邮件
    // 需要判断对方的邮件地址是否在数据库中, 防止垃圾转发
    var address = toUser + "@" + toHost;
    return hadRegisterEmailAddress(address, function(err, xaddress) {
      return cb(err, xaddress);
    });
  }
	// Check user's domain in db
	// 检测 to field 邮件地址的 host 是否位于数据库(或者域名)

  // 查看域名是否存在, 且通过验证
  function existVerifyDomain(done) {
    Domain.findOne({domain: rcpt_to.host, cnameVerifyStatus: true}, function (err, domain) {
      err = err || domain == null ? new Error("domain(" + rcpt_to.host + ") not found!") : null;
      done(err, domain);
    });
  }

  // 查看发送目的地(rcpt_to.user @ rcpt_to.host)是否处于废弃地址中
  function addressWasNotReject(domain, done) {
    // user: ObjectId,
    // // blockAddress@domain ==> email address
    // domain: ObjectId,
    // blockAddress: String,
    // replyInfo: String
    BlackReceiveList.findOne({domain: domain._id, blockAddress: rcpt_to.user}, function (err, blackRecord) {
      if (blackRecord) {
        err = new Error(blackRecord.replyInfo);
        return done(err);
      }
      done(err, domain)
    });
  }

  // 查看转发目的地记录, 且转发目的地已授权转发
  function findForwardVerifyAddress(domain, done) {
    // cb(err, is_verified, email)
    getPassVerifyAndAddressById(domain.forward_email, function (err, is_verified, email) {
      if (is_verified) {
        done(err, domain, email);
      } else {
        err = err || new Error("转发目的地(邮件地址)没有通过验证");
        done(err, domain, email);
      }
    });
  }

  // 确保发送者,和转发目的地不是同一个地址
  function makeSureForwardAddressWasNotEqualSendAddress(domain, address, done) {
    var fromAddress = mail_from.user + "@" + mail_from.host;
    if (fromAddress == address) {
      var err = new Error("请不要转发邮件给自己, 有的邮箱会拒绝接收,转发给自己的邮件")
      return done(err)
    }

    done(null, domain, address);
  }

  // 查看 用户是否续费
  function makeSureUserHasPayFee(domain, address, done) {
		user_had_pay(domain.user, function (err) {
			done(err, domain, address);
		});
  }

  async.waterfall([
    // 查看域名是否存在, 且通过验证
    existVerifyDomain,
    // 查看发送目的地(rcpt_to.user @ rcpt_to.host)是否处于废弃地址中
    addressWasNotReject,
    // 查看转发目的地记录, 且转发目的地已授权转发
    findForwardVerifyAddress,
    // 确保发送者,和转发目的地不是同一个地址
    makeSureForwardAddressWasNotEqualSendAddress,
    // 查看 转发是否超出限额, 并且计数
    // 如果不是流量包不足, 可以让发送邮件的帮她购买流量包...o^|^o...
    // 当然,顺便发送一封邮件到用户的转发目的地里...o^|^o...该交钱了,娃
    makeSureUserHasPayFee
  ], function (err, domain, address) {
    // 如果没有出现问题, 则说明可以转发, 那么计数, 并且添加转发记录
    // if (!err) {
    //
    //   // 然后添加一条转发记录
    //   var forwardrecord = new ForwardRecords({
    //     user: domain.user,
    //     from: {
    //       user: mail_from.user,
    //       host: mail_from.host
    //     },
    //     to: {
    //       user: rcpt_to.user,
    //       host: rcpt_to.host
    //     },
    //     forward: address
    //   })
    //   forwardrecord.save(function (err) {})
    // }

    // 计费不影响转发
    cb(err, address || null);
  });
}
